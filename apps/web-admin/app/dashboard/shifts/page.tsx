'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, ApiError, Shift, Application, WagePayment } from '../../../lib/api';
import { connectSocket, getSocket, NewApplicationPayload } from '../../../lib/socket';
import { reportIdentityMismatch } from '../../../lib/identity';
import { COMPANY_CANCEL_REASONS, paymentMethodLabel } from '@turnos/shared';
import { useT } from '../../../lib/i18n';
import { ui, STATUS_DOT, NEUTRAL_DOT, statusPill } from '../../../lib/ui';
import { LanguageSwitcher } from '../../../components/LanguageSwitcher';
import { ApplicantList, WorkerProfilePanel } from '../../../components/Applicants';
import { CANDIDATES_CHANGED_EVENT } from '../../../components/DashboardShell';
import { IconAlert, IconBriefcase, IconFile, IconTarget, IconChat, IconQr, IconClipboard, Stars } from '../../../components/icons';

/** A shift row that stands for a multi-day job rather than a single day. */
const isMultiDay = (shift: Shift): boolean => (shift.seriesDates?.length ?? 0) > 1;


// ── Applicants Modal ──────────────────────────────────────────────────────────

function ShiftApplicationsModal({
  shift, onClose,
}: {
  shift: Shift;
  onClose: () => void;
}) {
  const { t, tSkill, fMediumDate } = useT();
  const [apps, setApps]             = useState<Application[]>([]);
  const [loading, setLoading]       = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<Application | null>(null);

  useEffect(() => {
    adminApi.getShiftApplications(shift.id)
      .then(list => {
        setApps(list);
        // Opening the list marks these candidates seen — refresh the sidebar badge.
        window.dispatchEvent(new Event(CANDIDATES_CHANGED_EVENT));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shift.id]);

  const handleApprove = async (appId: string) => {
    setProcessing(appId);
    try {
      await adminApi.approveApplication(shift.id, appId);
      setApps(prev => prev.map(a =>
        a.id === appId ? { ...a, status: 'APPROVED' as const } : { ...a, status: 'REJECTED' as const },
      ));
      setViewingProfile(null);
      window.dispatchEvent(new Event(CANDIDATES_CHANGED_EVENT));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('admin.shifts.approveError'));
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <div>
            <h2 style={s.modalTitle}>{t('admin.shifts.appsTitle', { shift: shift.title || tSkill(shift.subcategory) })}</h2>
            <p style={s.modalSub}>
              {apps.length === 1
                ? t('admin.shifts.appsSubOne', {
                    date: fMediumDate(shift.date),
                    time: `${shift.startTime.slice(0, 5)}–${shift.endTime.slice(0, 5)}`,
                  })
                : t('admin.shifts.appsSubOther', {
                    date: fMediumDate(shift.date),
                    time: `${shift.startTime.slice(0, 5)}–${shift.endTime.slice(0, 5)}`,
                    count: apps.length,
                  })}
            </p>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {viewingProfile ? (
          <WorkerProfilePanel
            app={viewingProfile}
            shiftRole={shift.subcategory}
            onBack={() => setViewingProfile(null)}
            onApprove={app => handleApprove(app.id)}
            processing={processing}
          />
        ) : loading ? (
          <p style={s.loadingText}>{t('admin.shifts.appsLoading')}</p>
        ) : apps.length === 0 ? (
          <p style={s.emptyApps}>{t('admin.shifts.appsEmpty')}</p>
        ) : (
          <ApplicantList
            shift={shift}
            apps={apps}
            processing={processing}
            onApprove={app => handleApprove(app.id)}
            onViewProfile={setViewingProfile}
          />
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const { t, tSkill, fMediumDate } = useT();
  const [shifts, setShifts]           = useState<Shift[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState('');
  const [cancelling, setCancelling]     = useState<string | null>(null);
  const [confirming, setConfirming]     = useState<string | null>(null);
  const [deletingExpired, setDeleting]  = useState<string | null>(null);
  const [showExpired, setShowExpired]   = useState(false);
  const [selectedExpired, setSelectedExpired] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [viewingApps, setViewingApps] = useState<Shift | null>(null);
  const [newAppCounts, setNewAppCounts] = useState<Record<string, number>>({});
  const [cancelTarget, setCancelTarget] = useState<Shift | null>(null);
  const [pendingWages, setPendingWages] = useState<WagePayment[]>([]);
  const [markPaidTarget, setMarkPaidTarget] = useState<WagePayment | null>(null);
  const [wageAction, setWageAction]     = useState<{ wage: WagePayment; mode: 'adjust' | 'problem' } | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      setShifts(await adminApi.getMyShifts());
      // Best-effort — the pending-payments strip is secondary to the shift list
      adminApi.getPendingWages().then(setPendingWages).catch(() => {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.shifts.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // WebSocket: live applicant notifications
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) connectSocket(token);

    const socket = getSocket();
    if (!socket) return;

    const onNewApplication = (payload: NewApplicationPayload) => {
      setNewAppCounts(prev => ({
        ...prev,
        [payload.shiftId]: (prev[payload.shiftId] ?? 0) + 1,
      }));
    };

    socket.on('shift:new_application', onNewApplication);
    return () => { socket.off('shift:new_application', onNewApplication); };
  }, []);

  /** Hours until the shift starts — drives the cancellation-policy tiers. */
  const hoursUntilStart = (sh: Shift) => {
    const start = new Date(`${sh.date}T${sh.startTime.slice(0, 5)}:00`);
    return (start.getTime() - Date.now()) / (1000 * 60 * 60);
  };

  const handleCancel = (id: string) => {
    const shift = shifts.find(sh => sh.id === id);
    if (!shift) return;
    // FILLED shifts follow the cancellation policy — open the reason modal.
    // Unfilled shifts cancel freely with a simple confirm.
    if (shift.status === 'FILLED') {
      setCancelTarget(shift);
      return;
    }
    if (!confirm(t('admin.shifts.cancelConfirmSimple'))) return;
    void doCancel(id);
  };

  const doCancel = async (id: string, reason?: { reasonCategory?: string; reasonNote?: string }) => {
    setCancelling(id);
    try {
      const res = await adminApi.cancelShift(id, reason);
      setShifts(prev => prev.map(sh => sh.id === id ? { ...sh, status: 'CANCELLED' as const } : sh));
      setCancelTarget(null);
      if (res.cancellationConsequence) alert(res.cancellationConsequence);
      // A <3h ERRO_EMPRESA cancellation creates a wage payment — refresh the strip
      adminApi.getPendingWages().then(setPendingWages).catch(() => {});
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('admin.shifts.cancelError'));
    } finally {
      setCancelling(null);
    }
  };

  /**
   * Cancel every shift of a request that hasn't started. Each slot goes through
   * the normal cancellation policy server-side; a confirmed slot <3h from its
   * start needs a reason, so that one is left for the per-row "Cancelar".
   */
  const handleCancelRequest = async (request: { id: string; name: string }) => {
    if (!confirm(t('admin.shifts.cancelRequestConfirm', { name: request.name }))) return;
    try {
      const res = await adminApi.cancelRequest(request.id);
      alert(t('admin.shifts.cancelRequestDone', { count: res.cancelled }));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('admin.shifts.cancelError'));
    } finally {
      void load();
      adminApi.getPendingWages().then(setPendingWages).catch(() => {});
    }
  };

  /** "Retirar oferta": the selected worker has not answered — reopen the shift. */
  const handleWithdrawOffer = async (shift: Shift) => {
    if (!confirm(t('admin.shifts.withdrawOfferConfirm'))) return;
    setCancelling(shift.id);
    try {
      await adminApi.withdrawOffer(shift.id);
      setShifts(prev => prev.map(sh => sh.id === shift.id ? { ...sh, status: 'OPEN' as const } : sh));
      // Candidates who had applied are waiting for an answer again
      window.dispatchEvent(new Event(CANDIDATES_CHANGED_EVENT));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('admin.shifts.withdrawOfferError'));
    } finally {
      setCancelling(null);
    }
  };

  /**
   * "Eliminar selecionados" / "Eliminar todos" — archives expired shifts so they
   * leave the dashboard (and the Início count). No ids = every expired shift.
   */
  const deleteExpiredBulk = async (ids?: string[]) => {
    const count = ids?.length ?? expired.length;
    if (!confirm(t('admin.shifts.deleteManyConfirm', { count }))) return;
    setBulkDeleting(true);
    try {
      await adminApi.deleteExpiredShifts(ids);
      const gone = new Set(ids ?? expired.map(sh => sh.id));
      setShifts(prev => prev.filter(sh => !gone.has(sh.id)));
      setSelectedExpired(new Set());
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('admin.shifts.deleteError'));
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleManualConfirm = async (shift: Shift) => {
    if (!confirm(t('admin.shifts.manualConfirmBody', {
      shift: shift.title || tSkill(shift.subcategory),
    }))) return;
    setConfirming(shift.id);
    try {
      await adminApi.manualConfirmShift(shift.id);
      setShifts(prev => prev.map(sh => sh.id === shift.id ? { ...sh, status: 'COMPLETED' as const } : sh));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('admin.shifts.confirmError'));
    } finally {
      setConfirming(null);
    }
  };

  // A shift nobody scanned: the company says it didn't take place, or reports
  // a no-show. "Concluído" reuses handleManualConfirm.
  const handleNotWorked = async (shift: Shift) => {
    if (!confirm(t('admin.shifts.notWorkedBody', { shift: shift.title || tSkill(shift.subcategory) }))) return;
    setConfirming(shift.id);
    try {
      await adminApi.markShiftNotWorked(shift.id);
      setShifts(prev => prev.map(sh => sh.id === shift.id ? { ...sh, status: 'CANCELLED' as const } : sh));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('admin.shifts.actionError'));
    } finally {
      setConfirming(null);
    }
  };

  const handleNoShow = async (shift: Shift) => {
    if (!confirm(t('admin.shifts.noShowBody', { shift: shift.title || tSkill(shift.subcategory) }))) return;
    setConfirming(shift.id);
    try {
      await adminApi.reportNoShow(shift.id);
      setShifts(prev => prev.map(sh => sh.id === shift.id ? { ...sh, noShowReportedAt: new Date().toISOString() } : sh));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('admin.shifts.actionError'));
    } finally {
      setConfirming(null);
    }
  };

  // Client-side expiry detection (backup until nightly cron runs)
  const isExpiredShift = (sh: Shift) => {
    if (!['OPEN', 'PENDING_ACCEPTANCE'].includes(sh.status)) return sh.status === 'EXPIRED';
    const [h, m] = sh.endTime.split(':').map(Number);
    const [y, mo, d] = sh.date.split('-').map(Number);
    const end = new Date(y!, (mo! - 1), d!, h ?? 0, m ?? 0, 0);
    return end < new Date();
  };

  // FILLED splits three ways: still to happen (active), ended with no check-in
  // ("to confirm" — the API sweep sets confirmRequestedAt, the end time is the
  // backup until it runs), and closed by a no-show report (history).
  const isNoShow    = (sh: Shift) => sh.status === 'FILLED' && !!sh.noShowReportedAt;
  const isToConfirm = (sh: Shift) => sh.status === 'FILLED' && !sh.noShowReportedAt
    && (!!sh.confirmRequestedAt || hasEnded(sh));

  const toConfirm = shifts.filter(isToConfirm);
  const active  = shifts.filter(sh => ['OPEN', 'FILLED', 'ACTIVE', 'PENDING_ACCEPTANCE'].includes(sh.status)
    && !isExpiredShift(sh) && !isToConfirm(sh) && !isNoShow(sh));
  const expired = shifts.filter(sh => isExpiredShift(sh));
  const past    = shifts.filter(sh => ['COMPLETED', 'CANCELLED', 'DRAFT'].includes(sh.status) || isNoShow(sh));

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>{t('admin.shifts.title')}</h1>
          <p style={s.sub}>
            {isLoading
              ? t('common.loading')
              : t('admin.shifts.subCount', { total: shifts.length, active: active.length })}
          </p>
        </div>
        <div style={s.headerActions}>
          <LanguageSwitcher />
          <button style={s.refreshBtn} onClick={load} disabled={isLoading}>{t('admin.shifts.refresh')}</button>
          {/* QR codes are per-employer (static), not per shift */}
          <Link href="/dashboard/qr-codes" style={s.qrCodesBtn}>{t('admin.shifts.qrCodes')}</Link>
          {/* Several roles at once (hotels, events) — the single form stays as it is */}
          <Link href="/dashboard/new-request" style={s.refreshBtn}>{t('admin.shifts.newRequest')}</Link>
          <Link href="/dashboard/new-shift" style={s.newBtn}>{t('admin.shifts.newShift')}</Link>
        </div>
      </div>

      {error && <div style={s.errorBanner}><IconAlert size={15} /> {error}</div>}

      {/* ── Pending wage payments (Pay Link + trust loop) ── */}
      {pendingWages.length > 0 && (
        <section style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
          padding: '16px 20px', marginBottom: 20,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#92400e', marginBottom: 10 }}>
            {t('admin.shifts.pendingTitle', { count: pendingWages.length })}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingWages.map(w => (
              <div key={w.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                background: '#fff', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px',
              }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e1b4b' }}>
                    {w.type === 'CANCELLATION_MINIMUM' ? t('admin.shifts.cancellationMin') : ''}{w.shiftTitle}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {w.shiftDate ? fMediumDate(w.shiftDate) : ''} · {t(`domain.paymentMethods.${w.paymentMethod}`, { defaultValue: paymentMethodLabel(w.paymentMethod) })}
                    {w.status === 'MARKED_PAID' && t('admin.shifts.awaitingWorker')}
                    {w.status === 'DISPUTED' && t('admin.shifts.disputed')}
                  </div>
                  {/* Coordinates for a manual transfer — the company needs these to pay */}
                  {w.workerIban && w.status === 'PENDING' && (
                    <div style={{
                      fontSize: 12, color: '#374151', marginTop: 6, lineHeight: 1.6,
                      background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6,
                      padding: '6px 10px',
                    }}>
                      <div><strong>{w.workerName ?? t('admin.shifts.workerFallback')}</strong></div>
                      <div>{t('admin.shifts.ibanLabel')} <code style={{ fontSize: 12 }}>{w.workerIban}</code></div>
                      <div>{t('admin.shifts.referenceLabel')} <code style={{ fontSize: 12 }}>{w.paymentReference}</code></div>
                    </div>
                  )}
                  {w.workerIbanWithheld && w.status === 'PENDING' && (
                    <div style={{
                      fontSize: 12, color: '#92400e', marginTop: 6, lineHeight: 1.5,
                      background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6,
                      padding: '6px 10px',
                    }}>
                      {t('admin.shifts.ibanWithheld')}
                    </div>
                  )}
                  {w.paymentProofUrl && (
                    <a
                      href={w.paymentProofUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, textDecoration: 'none' }}
                    >
                      {t('admin.shifts.viewProof')}
                    </a>
                  )}
                  {!w.paymentProofUrl && w.status === 'MARKED_PAID' && (
                    <div style={{ fontSize: 12, color: '#b45309' }}>
                      {t('admin.shifts.noProofDeclared')}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1e1b4b' }}>
                  €{Number(w.amount).toFixed(2)}
                </div>
                {w.payLinkUrl && w.status === 'PENDING' && (
                  <a href={w.payLinkUrl} target="_blank" rel="noreferrer" style={{
                    background: '#6a79ff', color: '#fff', fontWeight: 700, fontSize: 13,
                    padding: '8px 16px', borderRadius: 8, textDecoration: 'none',
                  }}>
                    {t('admin.shifts.payNow')}
                  </a>
                )}
                {!w.payLinkUrl && (w.status === 'PENDING' || w.status === 'DISPUTED') && (
                  <button
                    onClick={() => setMarkPaidTarget(w)}
                    style={{
                      background: '#fff', color: '#16a34a', fontWeight: 700, fontSize: 13,
                      padding: '8px 16px', borderRadius: 8, border: '1.5px solid #86efac',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {t('admin.shifts.markPaid')}
                  </button>
                )}
                {w.status === 'PENDING' && w.type === 'SHIFT_COMPLETION' && (
                  <>
                    <button
                      onClick={() => setWageAction({ wage: w, mode: 'adjust' })}
                      style={{
                        background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 12,
                        padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {t('admin.shifts.adjustHours')}
                    </button>
                    <button
                      onClick={() => setWageAction({ wage: w, mode: 'problem' })}
                      style={{
                        background: '#fff', color: '#dc2626', fontWeight: 600, fontSize: 12,
                        padding: '8px 12px', borderRadius: 8, border: '1.5px solid #fecaca',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {t('admin.shifts.reportProblem')}
                    </button>
                  </>
                )}
                {w.status === 'UNDER_REVIEW' && (
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
                    {t('admin.shifts.underReview')}
                  </span>
                )}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#92400e', marginTop: 10 }}>
            {t('admin.shifts.pendingFooter')}
          </p>
        </section>
      )}

      {/* QR tip banner — shown when there are FILLED/ACTIVE shifts */}
      {active.some(sh => ['FILLED', 'ACTIVE'].includes(sh.status)) && (
        <div style={s.qrTipBanner}>
          <IconQr size={15} />
          <span>
            {t('admin.shifts.qrTip1')}
            <Link href="/dashboard/qr-codes" style={{ color: '#7c3aed', fontWeight: 700 }}>
              {t('admin.shifts.qrTipLink')}
            </Link>
            {t('admin.shifts.qrTip2')}
          </span>
        </div>
      )}

      {/* Hire reminder — FILLED means a worker has just been confirmed and has
          not started yet, which is exactly the window for the company to
          communicate the admission. Informative only: Turnos does not do it. */}
      {active.some(sh => sh.status === 'FILLED') && (
        <div style={{ ...s.qrTipBanner, ...ui.bannerAction }}>
          <span>
            {t('admin.shifts.hireTip')}
            <Link href="/dashboard/compliance?tab=mcd" style={{ color: '#b45309', fontWeight: 700 }}>
              {t('admin.shifts.hireTipLink')}
            </Link>
          </span>
        </div>
      )}

      {!isLoading && shifts.length === 0 && !error && (
        <div style={s.empty}>
          <div style={s.emptyIcon}><IconClipboard size={44} /></div>
          <p style={s.emptyText}>{t('admin.shifts.emptyText')}</p>
          <Link href="/dashboard/new-shift" style={s.emptyBtn}>{t('admin.shifts.emptyCta')}</Link>
        </div>
      )}

      {/* To confirm — ended without a check-in. Completes on its own unless
          the company says otherwise; these are the only buttons it needs. */}
      {toConfirm.length > 0 && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>{t('admin.shifts.sectionToConfirm')}</h2>
          <p style={s.toConfirmIntro}>{t('admin.shifts.toConfirmIntro')}</p>
          <div style={s.table}>
            <div style={s.tableHead}>
              <span>{t('admin.shifts.colShift')}</span><span>{t('admin.shifts.colDate')}</span><span>{t('admin.shifts.colTime')}</span>
              <span>{t('admin.shifts.colRate')}</span><span>{t('admin.shifts.colStatus')}</span><span>{t('admin.shifts.colActions')}</span>
            </div>
            {toConfirm.map(shift => (
              <ToConfirmRow
                key={shift.id}
                shift={shift}
                busy={confirming === shift.id}
                onCompleted={handleManualConfirm}
                onNoShow={handleNoShow}
                onNotWorked={handleNotWorked}
              />
            ))}
          </div>
        </section>
      )}

      {/* Active shifts */}
      {active.length > 0 && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>{t('admin.shifts.sectionActive')}</h2>
          <div style={s.table}>
            <div style={s.tableHead}>
              <span>{t('admin.shifts.colShift')}</span><span>{t('admin.shifts.colDate')}</span><span>{t('admin.shifts.colTime')}</span>
              <span>{t('admin.shifts.colRate')}</span><span>{t('admin.shifts.colStatus')}</span><span>{t('admin.shifts.colActions')}</span>
            </div>
            {active.map(shift => (
              <ShiftRow
                onCancelRequest={handleCancelRequest}
                key={shift.id}
                shift={shift}
                onCancel={handleCancel}
                onWithdrawOffer={handleWithdrawOffer}
                onManualConfirm={handleManualConfirm}
                cancelling={cancelling}
                confirming={confirming}
                newAppCount={newAppCounts[shift.id] ?? 0}
                onIdentityReported={id => setShifts(prev => prev.map(sh => sh.id === id ? { ...sh, status: 'CANCELLED' as const } : sh))}
                onViewApps={() => {
                  setViewingApps(shift);
                  setNewAppCounts(prev => ({ ...prev, [shift.id]: 0 }));
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Caducados section */}
      {expired.length > 0 && (
        <section style={s.section}>
          <button
            style={s.expiredToggle}
            onClick={() => setShowExpired(v => !v)}
          >
            <span style={s.expiredToggleIcon}><IconAlert size={14} /></span>
            <span style={s.expiredToggleTitle}>
              {t('admin.shifts.expiredToggle', { count: expired.length })}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 12 }}>
              {showExpired ? t('admin.shifts.expiredClose') : t('admin.shifts.expiredOpen')}
            </span>
          </button>

          {showExpired && (
            <div style={s.bulkBar}>
              <label style={s.bulkSelectAll}>
                <input
                  type="checkbox"
                  checked={selectedExpired.size > 0 && selectedExpired.size === expired.length}
                  onChange={e => setSelectedExpired(e.target.checked ? new Set(expired.map(sh => sh.id)) : new Set())}
                />
                {t('admin.shifts.selectAll')}
              </label>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                {selectedExpired.size > 0 && (
                  <button
                    style={{ ...s.deleteBtn, opacity: bulkDeleting ? 0.5 : 1 }}
                    disabled={bulkDeleting}
                    onClick={() => void deleteExpiredBulk([...selectedExpired])}
                  >
                    {t('admin.shifts.deleteSelected', { count: selectedExpired.size })}
                  </button>
                )}
                <button
                  style={{ ...s.deleteAllBtn, opacity: bulkDeleting ? 0.5 : 1 }}
                  disabled={bulkDeleting}
                  onClick={() => void deleteExpiredBulk()}
                >
                  {bulkDeleting ? '...' : t('admin.shifts.deleteAll', { count: expired.length })}
                </button>
              </div>
            </div>
          )}

          {showExpired && (
            <div style={s.table}>
              <div style={s.tableHead}>
                <span>{t('admin.shifts.colShift')}</span><span>{t('admin.shifts.colDate')}</span><span>{t('admin.shifts.colTime')}</span>
                <span>{t('admin.shifts.colRate')}</span><span>{t('admin.shifts.colStatus')}</span><span>{t('admin.shifts.colActions')}</span>
              </div>
              {expired.map(shift => (
                <div key={shift.id} style={s.tableRow}>
                  <label style={s.expiredRowMain}>
                    <input
                      type="checkbox"
                      style={{ marginTop: 3 }}
                      checked={selectedExpired.has(shift.id)}
                      onChange={e => setSelectedExpired(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(shift.id); else next.delete(shift.id);
                        return next;
                      })}
                    />
                    <span>
                      <p style={s.rowTitle}>{shift.title || tSkill(shift.subcategory)}</p>
                      <p style={s.rowSub}>{shift.address.split(',')[0]}</p>
                    </span>
                  </label>
                  <span style={s.rowCell}>{fMediumDate(shift.date)}</span>
                  <span style={s.rowCell}>{shift.startTime.slice(0,5)}–{shift.endTime.slice(0,5)}</span>
                  <span style={s.rowCell}>€{Number(shift.grossHourlyRate).toFixed(2)}/hr</span>
                  <span style={s.badge}><span style={{ ...ui.dot, background: NEUTRAL_DOT }} />{t('admin.shifts.expiredPill')}</span>
                  <div style={s.rowActions}>
                    <button
                      style={s.repostBtn}
                      onClick={() => {
                        // Pre-fill new-shift with this shift's data via sessionStorage
                        sessionStorage.setItem('repost_shift', JSON.stringify(shift));
                        window.location.href = '/dashboard/new-shift';
                      }}
                    >
                      {t('admin.shifts.repost')}
                    </button>
                    <button
                      style={{ ...s.deleteBtn, opacity: deletingExpired === shift.id ? 0.5 : 1 }}
                      disabled={deletingExpired === shift.id}
                      onClick={async () => {
                        if (!confirm(t('admin.shifts.deleteConfirm'))) return;
                        setDeleting(shift.id);
                        try {
                          await adminApi.deleteExpiredShift(shift.id);
                          setShifts(prev => prev.filter(s => s.id !== shift.id));
                        } catch {
                          alert(t('admin.shifts.deleteError'));
                        } finally {
                          setDeleting(null);
                        }
                      }}
                    >
                      {deletingExpired === shift.id ? '...' : t('admin.shifts.deleteExpired')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Past shifts */}
      {past.length > 0 && (
        <section style={s.section}>
          <h2 style={{ ...s.sectionTitle, color: 'var(--color-text-secondary)' }}>{t('admin.shifts.sectionHistory')}</h2>
          <div style={s.table}>
            <div style={s.tableHead}>
              <span>{t('admin.shifts.colShift')}</span><span>{t('admin.shifts.colDate')}</span><span>{t('admin.shifts.colTime')}</span>
              <span>{t('admin.shifts.colRate')}</span><span>{t('admin.shifts.colStatus')}</span><span>{t('admin.shifts.colActions')}</span>
            </div>
            {past.map(shift => (
              <ShiftRow
                onCancelRequest={handleCancelRequest}
                key={shift.id}
                shift={shift}
                onCancel={handleCancel}
                onWithdrawOffer={handleWithdrawOffer}
                onManualConfirm={handleManualConfirm}
                cancelling={cancelling}
                confirming={confirming}
                newAppCount={0}
                onViewApps={() => setViewingApps(shift)}
              />
            ))}
          </div>
        </section>
      )}


      {viewingApps && (
        <ShiftApplicationsModal shift={viewingApps} onClose={() => setViewingApps(null)} />
      )}

      {cancelTarget && (
        <CancelShiftModal
          shift={cancelTarget}
          hoursUntil={hoursUntilStart(cancelTarget)}
          busy={cancelling === cancelTarget.id}
          onClose={() => setCancelTarget(null)}
          onConfirm={reason => doCancel(cancelTarget.id, reason)}
        />
      )}

      {wageAction && (
        <WageActionModal
          wage={wageAction.wage}
          mode={wageAction.mode}
          onClose={() => setWageAction(null)}
          onDone={updated => {
            setPendingWages(prev => prev.map(w => w.id === updated.id ? updated : w));
            setWageAction(null);
          }}
        />
      )}

      {markPaidTarget && (
        <MarkPaidModal
          wage={markPaidTarget}
          onClose={() => setMarkPaidTarget(null)}
          onDone={updated => {
            setPendingWages(prev => prev.map(w => w.id === updated.id ? updated : w));
            setMarkPaidTarget(null);
          }}
        />
      )}
    </div>
  );
}

// ── Mark-as-paid modal — manual methods, with proof of payment ───────────────

function MarkPaidModal({ wage, onClose, onDone }: {
  wage: WagePayment;
  onClose: () => void;
  onDone: (updated: WagePayment) => void;
}) {
  const { t, fMediumDate } = useT();
  const [proof, setProof]   = useState<File | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      onDone(await adminApi.markWagePaid(wage.id, proof ?? undefined, reason.trim() || undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.shifts.genericRetry'));
      setBusy(false);
    }
  };

  // Either attach the receipt, or say why there isn't one — never a bare click.
  const canSubmit = proof !== null || reason.trim().length >= 5;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,15,35,0.55)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1e1b4b', marginBottom: 6 }}>
          {t('admin.shifts.markPaidTitle')}
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          {t('admin.shifts.markPaidSub', { shift: wage.shiftTitle, date: wage.shiftDate ? fMediumDate(wage.shiftDate) : '' })}
          <strong>€{Number(wage.amount).toFixed(2)}</strong>
          {t('admin.shifts.markPaidVia', { method: t(`domain.paymentMethods.${wage.paymentMethod}`, { defaultValue: paymentMethodLabel(wage.paymentMethod) }) })}
        </p>

        {wage.workerIban ? (
          <div style={{
            background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8,
            padding: '10px 12px', fontSize: 13, lineHeight: 1.7, marginBottom: 14,
          }}>
            <div><strong>{wage.workerName ?? t('admin.shifts.workerFallback')}</strong></div>
            <div>{t('admin.shifts.ibanLabel')} <code>{wage.workerIban}</code></div>
            <div>{t('admin.shifts.referenceLabel')} <code>{wage.paymentReference}</code></div>
          </div>
        ) : wage.workerIbanWithheld ? (
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
            padding: '10px 12px', fontSize: 13, lineHeight: 1.5, marginBottom: 14, color: '#92400e',
          }}>
            {t('admin.shifts.ibanWithheldShort')}
          </div>
        ) : null}

        <p style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>
          {t('admin.shifts.proofLead')}
          <strong>{t('admin.shifts.proofBold')}</strong>
          {t('admin.shifts.proofRest')}
        </p>

        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={e => setProof(e.target.files?.[0] ?? null)}
          style={{ fontSize: 13, marginBottom: 12, fontFamily: 'inherit', width: '100%' }}
        />

        {!proof && (
          <>
            <p style={{ fontSize: 12, color: '#b45309', marginBottom: 6 }}>
              {t('admin.shifts.noProofPrompt')}
            </p>
            <input
              type="text"
              placeholder={t('admin.shifts.noProofPlaceholder')}
              value={reason}
              onChange={e => setReason(e.target.value.slice(0, 200))}
              style={{
                width: '100%', height: 40, padding: '0 12px', fontSize: 13,
                border: '1.5px solid #e5e7eb', borderRadius: 8, marginBottom: 12, fontFamily: 'inherit',
              }}
            />
          </>
        )}

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: '8px 12px', fontSize: 13, color: '#991b1b', marginBottom: 12,
          }}>
            <IconAlert size={15} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: '#fff', color: '#6b7280', border: '1.5px solid #e5e7eb',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Voltar
          </button>
          <button
            onClick={submit}
            disabled={busy || !canSubmit}
            style={{
              padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 700,
              background: '#16a34a', color: '#fff', border: 'none',
              cursor: busy || !canSubmit ? 'not-allowed' : 'pointer',
              opacity: busy || !canSubmit ? 0.6 : 1, fontFamily: 'inherit',
            }}
          >
            {busy ? t('admin.shifts.sending') : t('admin.shifts.markPaidSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Wage adjust-hours / report-problem modal (guardrail A) ───────────────────

function WageActionModal({ wage, mode, onClose, onDone }: {
  wage: WagePayment;
  mode: 'adjust' | 'problem';
  onClose: () => void;
  onDone: (updated: WagePayment) => void;
}) {
  const { t, fMediumDate } = useT();
  const [hours, setHours] = useState('');
  const [note, setNote]   = useState('');
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const updated = mode === 'adjust'
        ? await adminApi.adjustWageHours(wage.id, parseFloat(hours), note.trim() || undefined)
        : await adminApi.reportWageProblem(wage.id, 'PROBLEMA_TURNO', note.trim());
      onDone(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.shifts.genericRetry'));
    } finally {
      setBusy(false);
    }
  };

  const hoursNum = parseFloat(hours);
  const canSubmit = mode === 'adjust'
    ? !Number.isNaN(hoursNum) && hoursNum > 0
    : note.trim().length >= 10;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,15,35,0.55)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1e1b4b', marginBottom: 6 }}>
          {mode === 'adjust' ? t('admin.shifts.adjustTitle') : t('admin.shifts.problemTitle')}
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          {t('admin.shifts.wageModalSub', {
            shift: wage.shiftTitle,
            date: wage.shiftDate ? fMediumDate(wage.shiftDate) : '',
            amount: Number(wage.amount).toFixed(2),
          })}
        </p>

        {mode === 'adjust' ? (
          <>
            <p style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>
              {t('admin.shifts.adjustLead')}
              <strong>{t('admin.shifts.adjustBold')}</strong>
              {t('admin.shifts.adjustRest')}
            </p>
            <input
              type="number"
              min={2}
              step={0.5}
              placeholder={t('admin.shifts.adjustPlaceholder')}
              value={hours}
              onChange={e => setHours(e.target.value)}
              style={{
                width: '100%', height: 44, padding: '0 12px', fontSize: 15,
                border: '1.5px solid #e5e7eb', borderRadius: 8, marginBottom: 10, fontFamily: 'inherit',
              }}
            />
          </>
        ) : (
          <p style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>
            {t('admin.shifts.problemLead')}
            <strong>{t('admin.shifts.problemBold')}</strong>
            {t('admin.shifts.problemRest')}
          </p>
        )}

        <textarea
          placeholder={mode === 'adjust' ? t('admin.shifts.adjustNotePlaceholder') : t('admin.shifts.problemNotePlaceholder')}
          value={note}
          onChange={e => setNote(e.target.value.slice(0, 500))}
          style={{
            width: '100%', minHeight: 80, padding: 10, fontSize: 13, fontFamily: 'inherit',
            border: '1.5px solid #e5e7eb', borderRadius: 8, resize: 'vertical', marginBottom: 12,
          }}
        />

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: '8px 12px', fontSize: 13, color: '#991b1b', marginBottom: 12,
          }}>
            <IconAlert size={15} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: '#fff', color: '#6b7280', border: '1.5px solid #e5e7eb',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Voltar
          </button>
          <button
            onClick={submit}
            disabled={busy || !canSubmit}
            style={{
              padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 700,
              background: mode === 'adjust' ? '#6a79ff' : '#dc2626', color: '#fff', border: 'none',
              cursor: busy || !canSubmit ? 'not-allowed' : 'pointer',
              opacity: busy || !canSubmit ? 0.6 : 1, fontFamily: 'inherit',
            }}
          >
            {busy ? t('admin.shifts.sending') : mode === 'adjust' ? t('admin.shifts.adjustSubmit') : t('admin.shifts.problemSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Cancel-shift modal (policy v1.1) ─────────────────────────────────────────

function CancelShiftModal({ shift, hoursUntil, busy, onClose, onConfirm }: {
  shift: Shift;
  hoursUntil: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason?: { reasonCategory?: string; reasonNote?: string }) => void;
}) {
  const { t, tSkill, fMediumDate } = useT();
  const [category, setCategory] = useState<string>('');
  const [note, setNote]         = useState('');

  const isUnder3h  = hoursUntil <= 3 && hoursUntil > -1;
  const isUnder24h = hoursUntil <= 24 && hoursUntil > 3;
  const minimumEur = 2 * Number(shift.grossHourlyRate);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,15,35,0.55)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e1b4b', marginBottom: 6 }}>
          {t('admin.shifts.cancelTitle')}
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          {t('admin.shifts.cancelSub', {
            shift: shift.title || tSkill(shift.subcategory),
            date: fMediumDate(shift.date),
            time: shift.startTime.slice(0, 5),
          })}
        </p>

        {isUnder3h ? (
          <>
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
              padding: '12px 14px', fontSize: 13, color: '#991b1b', marginBottom: 16, lineHeight: 1.5,
            }}>
              {t('admin.shifts.under3h1')}
              <strong>{t('admin.shifts.under3hBold1')}</strong>
              {t('admin.shifts.under3h2')}
              <strong>{t('admin.shifts.under3hBold2', { amount: minimumEur.toFixed(2) })}</strong>
              {t('admin.shifts.under3h3')}
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>
              {t('admin.shifts.reasonLabel')} <span style={{ color: '#dc2626' }}>*</span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {Object.keys(COMPANY_CANCEL_REASONS).map(key => (
                <label key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                  border: category === key ? '2px solid #6a79ff' : '1.5px solid #e5e7eb',
                  borderRadius: 8, cursor: 'pointer', fontSize: 13,
                  background: category === key ? '#eef0ff' : '#fff',
                  fontWeight: category === key ? 700 : 500,
                }}>
                  <input
                    type="radio"
                    name="cancel-reason"
                    checked={category === key}
                    onChange={() => setCategory(key)}
                  />
                  {t(`domain.companyCancelReasons.${key}`)}
                  {key === 'ERRO_EMPRESA' && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#dc2626', fontWeight: 700 }}>
                      {t('admin.shifts.erroEmpresaTag')}
                    </span>
                  )}
                </label>
              ))}
            </div>
            <textarea
              placeholder={t('admin.shifts.cancelNotePlaceholder')}
              value={note}
              onChange={e => setNote(e.target.value.slice(0, 500))}
              style={{
                width: '100%', minHeight: 70, padding: 10, fontSize: 13, fontFamily: 'inherit',
                border: '1.5px solid #e5e7eb', borderRadius: 8, resize: 'vertical', marginBottom: 16,
              }}
            />
          </>
        ) : (
          <div style={{
            background: isUnder24h ? '#fffbeb' : '#f0fdf4',
            border: `1px solid ${isUnder24h ? '#fde68a' : '#bbf7d0'}`,
            borderRadius: 10, padding: '12px 14px', fontSize: 13,
            color: isUnder24h ? '#92400e' : '#166534', marginBottom: 16, lineHeight: 1.5,
          }}>
            {isUnder24h ? t('admin.shifts.under24h') : t('admin.shifts.over24h')}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: '#fff', color: '#6b7280', border: '1.5px solid #e5e7eb',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Voltar
          </button>
          <button
            onClick={() => onConfirm(isUnder3h
              ? { reasonCategory: category, reasonNote: note.trim() || undefined }
              : undefined)}
            disabled={busy || (isUnder3h && !category)}
            style={{
              padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 700,
              background: '#dc2626', color: '#fff', border: 'none',
              cursor: busy || (isUnder3h && !category) ? 'not-allowed' : 'pointer',
              opacity: busy || (isUnder3h && !category) ? 0.6 : 1, fontFamily: 'inherit',
            }}
          >
            {busy ? t('admin.shifts.cancelling') : t('admin.shifts.cancelSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shift row ─────────────────────────────────────────────────────────────────

function ShiftRow({ shift, onCancel, onWithdrawOffer, onManualConfirm, cancelling, confirming, onViewApps, newAppCount, onCancelRequest, onIdentityReported }: {
  shift: Shift;
  onCancelRequest?: (request: { id: string; name: string }) => void;
  onIdentityReported?: (shiftId: string) => void;
  onCancel: (id: string) => void;
  onWithdrawOffer: (shift: Shift) => void;
  onManualConfirm: (shift: Shift) => void;
  cancelling: string | null;
  confirming: string | null;
  onViewApps: () => void;
  newAppCount: number;
}) {
  const { t, tSkill, tCategory, fMediumDate, fDateRange } = useT();
  // A no-show keeps status FILLED in the database; show what it really is.
  const shown = shift.status === 'FILLED' && shift.noShowReportedAt ? 'NO_SHOW' : shift.status;
  const dot = STATUS_DOT[shown] ?? NEUTRAL_DOT;
  const statusLabel = t(`domain.shiftStatus.${shown}`, { defaultValue: shown });
  // PENDING_ACCEPTANCE had no action at all before 2026-10-11 — a shift could
  // sit on "A aguardar trabalhador" with nothing the company could do.
  const closed           = shown === 'NO_SHOW';
  const canCancel        = ['OPEN', 'DRAFT', 'FILLED', 'PENDING_ACCEPTANCE'].includes(shift.status) && !closed;
  const canManualConfirm = ['FILLED', 'ACTIVE'].includes(shift.status) && !closed;
  const worker = shift.assignedWorker;
  const [reporting, setReporting] = useState(false);

  return (
    <div style={s.tableRow}>
      <div>
        <p style={s.rowTitle}>{shift.title || tSkill(shift.subcategory)}</p>
        {/* Own line, not trailing the title: inline, a long shift name pushed
            the chip to wrap and it broke across two lines mid-pill. */}
        {isMultiDay(shift) && (
          <div>
            <span style={s.multiDayTag}>{t('admin.shifts.multiDayTag', { count: shift.seriesDates!.length })}</span>
          </div>
        )}
        {/* Posted with "Publicar vários turnos" — every slot carries its request */}
        {shift.request && (
          <div style={s.requestRow}>
            <span style={s.multiDayTag}><IconClipboard size={11} /> {shift.request.name}</span>
            {canCancel && onCancelRequest && (
              <button type="button" style={s.requestCancel} onClick={() => onCancelRequest(shift.request!)}>
                {t('admin.shifts.cancelRequest')}
              </button>
            )}
          </div>
        )}
        <p style={s.rowSub}>{tCategory(shift.category)} · {shift.address.split(',')[0]}</p>
        {/* Who is coming — the company checks this face and their ID at the door */}
        {worker && ['PENDING_ACCEPTANCE', 'FILLED', 'ACTIVE'].includes(shift.status) && !closed && (
          <div style={s.workerChip} title={shift.status === 'PENDING_ACCEPTANCE' ? undefined : t('admin.shifts.identityHint')}>
            {worker.photoUrl
              ? <img src={worker.photoUrl} alt="" style={s.workerChipPhoto} />
              : <span style={s.workerChipPhoto} />}
            <span style={s.workerChipName}>{worker.fullName ?? t('admin.shifts.noName')}</span>
            {shift.status !== 'PENDING_ACCEPTANCE' && (
              <span style={s.workerChipHint}>· {t('admin.shifts.identityHint')}</span>
            )}
          </div>
        )}
      </div>
      <span style={s.rowCell}>
        {isMultiDay(shift) ? fDateRange(shift.seriesDates!) : fMediumDate(shift.date)}
      </span>
      <span style={s.rowCell}>{shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}</span>
      <span style={{ ...s.rowCell, fontWeight: 700 }}>€{Number(shift.grossHourlyRate).toFixed(2)}/hr</span>
      <span style={statusPill(shown)}><span style={{ ...ui.dot, background: dot }} />{statusLabel}</span>
      <div style={s.rowActions}>
        {shift.status === 'ACTIVE' && worker && (
          <button
            style={{ ...s.cancelBtn, opacity: reporting ? 0.6 : 1 }}
            disabled={reporting}
            title={t('admin.shifts.identityTitle')}
            onClick={async () => {
              setReporting(true);
              const done = await reportIdentityMismatch(t, { id: shift.id, title: shift.title || tSkill(shift.subcategory) }, worker.fullName);
              setReporting(false);
              if (done) onIdentityReported?.(shift.id);
            }}
          >
            {t('admin.shifts.identityBtn')}
          </button>
        )}
        {['OPEN', 'FILLED'].includes(shift.status) && !closed && (
          <button style={s.viewAppsBtn} onClick={onViewApps}>
            {t('admin.shifts.viewApps')}
            {newAppCount > 0 && (
              <span style={s.newBadge}>{newAppCount}</span>
            )}
          </button>
        )}
        {['FILLED', 'ACTIVE'].includes(shift.status) && !closed && (
          <Link
            href={`/dashboard/compliance?tab=mcd&month=${shift.date.slice(0, 7)}`}
            style={{ ...s.viewAppsBtn, textDecoration: 'none' }}
            title={t('admin.shifts.hireDataTitle')}
          >
            {t('admin.shifts.hireDataBtn')}
          </Link>
        )}
        {canManualConfirm && (
          <button
            style={{ ...s.confirmBtn, opacity: confirming === shift.id ? 0.6 : 1 }}
            onClick={() => onManualConfirm(shift)}
            disabled={confirming === shift.id}
            title={t('admin.shifts.manualDoneTitle')}
          >
            {confirming === shift.id ? '...' : t('admin.shifts.manualDone')}
          </button>
        )}
        {shift.status === 'PENDING_ACCEPTANCE' && (
          <button
            style={{ ...s.viewAppsBtn, opacity: cancelling === shift.id ? 0.6 : 1 }}
            onClick={() => onWithdrawOffer(shift)}
            disabled={cancelling === shift.id}
            title={t('admin.shifts.withdrawOfferTitle')}
          >
            {t('admin.shifts.withdrawOfferBtn')}
          </button>
        )}
        {canCancel && (
          <button
            style={{ ...s.cancelBtn, opacity: cancelling === shift.id ? 0.6 : 1 }}
            onClick={() => onCancel(shift.id)}
            disabled={cancelling === shift.id}
          >
            {cancelling === shift.id ? '...' : t('admin.shifts.cancelBtn')}
          </button>
        )}
      </div>
    </div>
  );
}

// ── "To confirm" row ──────────────────────────────────────────────────────────

function ToConfirmRow({ shift, busy, onCompleted, onNoShow, onNotWorked }: {
  shift: Shift;
  busy: boolean;
  onCompleted: (shift: Shift) => void;
  onNoShow: (shift: Shift) => void;
  onNotWorked: (shift: Shift) => void;
}) {
  const { t, tSkill, tCategory, fMediumDate, fDateRange, fDateTime } = useT();
  const note = shift.workerConfirmation === 'NOT_WORKED'
    ? t('admin.shifts.toConfirmWorkerSaidNo')
    : shift.autoConfirmAt
      ? t('admin.shifts.toConfirmAuto', { when: fDateTime(shift.autoConfirmAt) })
      : shift.confirmRequestedAt
        ? t('admin.shifts.toConfirmManual')
        : t('admin.shifts.toConfirmWorkerPending');

  return (
    <div style={s.tableRow}>
      <div>
        <p style={s.rowTitle}>{shift.title || tSkill(shift.subcategory)}</p>
        <p style={s.rowSub}>{tCategory(shift.category)} · {shift.address.split(',')[0]}</p>
        <p style={s.toConfirmNote}>{note}</p>
      </div>
      <span style={s.rowCell}>
        {isMultiDay(shift) ? fDateRange(shift.seriesDates!) : fMediumDate(shift.date)}
      </span>
      <span style={s.rowCell}>{shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}</span>
      <span style={{ ...s.rowCell, fontWeight: 700 }}>€{Number(shift.grossHourlyRate).toFixed(2)}/hr</span>
      <span style={statusPill('TO_CONFIRM')}>
        <span style={{ ...ui.dot, background: STATUS_DOT.TO_CONFIRM }} />{t('domain.shiftStatus.TO_CONFIRM')}
      </span>
      <div style={{ ...s.rowActions, opacity: busy ? 0.6 : 1 }}>
        <button style={s.confirmBtn} disabled={busy} onClick={() => onCompleted(shift)}>
          {t('admin.shifts.manualDone')}
        </button>
        <button style={s.viewAppsBtn} disabled={busy} onClick={() => onNotWorked(shift)}>
          {t('admin.shifts.notWorkedBtn')}
        </button>
        <button style={s.cancelBtn} disabled={busy} onClick={() => onNoShow(shift)}>
          {t('admin.shifts.noShowBtn')}
        </button>
      </div>
    </div>
  );
}

/** Scheduled end has passed (Lisbon wall clock read as local — same as isExpiredShift). */
function hasEnded(sh: Shift): boolean {
  const [y, mo, d] = sh.date.split('-').map(Number);
  const [sH, sM] = sh.startTime.split(':').map(Number);
  const [eH, eM] = sh.endTime.split(':').map(Number);
  const end = new Date(y!, mo! - 1, d!, eH ?? 0, eM ?? 0, 0);
  // Overnight shift: the end is on the next day
  if ((eH! * 60 + eM!) <= (sH! * 60 + sM!)) end.setDate(end.getDate() + 1);
  return end < new Date();
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  workerChip: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  workerChipPhoto: { width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', background: 'var(--color-border)', flexShrink: 0, display: 'inline-block' },
  workerChipName: { fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-primary)' },
  workerChipHint: { fontSize: 11.5, color: 'var(--color-text-muted)' },
  page: { padding: 32, maxWidth: 1200, margin: '0 auto' },
  header: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' },
  title: { fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px', marginBottom: 4, whiteSpace: 'nowrap' },
  sub: { fontSize: 14, color: 'var(--color-text-secondary)' },
  headerActions: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' },
  refreshBtn: { ...ui.btnLg, whiteSpace: 'nowrap' },
  qrCodesBtn: { ...ui.btnLg, whiteSpace: 'nowrap' },
  newBtn: { ...ui.primary, whiteSpace: 'nowrap' },
  qrTipBanner: { ...ui.banner, marginBottom: 24 },
  errorBanner: {
    background: '#fee2e2', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8,
    padding: '12px 16px', fontSize: 13, color: '#ef4444', marginBottom: 24,
  },
  empty: { textAlign: 'center', padding: '80px 0' },
  emptyIcon: { display: 'flex', justifyContent: 'center', marginBottom: 16, color: 'var(--color-text-muted, #9ca3af)' },
  emptyText: { fontSize: 16, color: 'var(--color-text-secondary)', fontWeight: 500, marginBottom: 20 },
  emptyBtn: {
    display: 'inline-block', padding: '12px 24px',
    background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
  },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 },
  toConfirmIntro: { fontSize: 13, color: 'var(--color-text-secondary)', margin: '-4px 0 12px', maxWidth: 760, lineHeight: 1.5 },
  toConfirmNote: { fontSize: 12, color: '#92400e', fontWeight: 600, marginTop: 4 },
  table: {
    background: '#fff', borderRadius: 12, border: '1px solid var(--color-border)',
    overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  tableHead: {
    display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1.8fr',
    padding: '12px 20px', background: 'var(--color-secondary)',
    fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)',
    borderBottom: '1px solid var(--color-border)', gap: 12,
  },
  tableRow: {
    display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1.8fr',
    padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
    alignItems: 'center', gap: 12, fontSize: 13,
  },
  rowTitle: { fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 },
  multiDayTag: { ...ui.pill, margin: '5px 0 1px' },
  requestRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  requestCancel: {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 11.5, fontWeight: 600, color: '#dc2626',
  },
  rowSub: { fontSize: 12, color: 'var(--color-text-secondary)' },
  rowCell: { color: 'var(--color-text-primary)' },
  badge: ui.pill,
  rowActions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  viewAppsBtn: ui.btn,
  newBadge: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 18, height: 18, borderRadius: 9, background: '#ef4444',
    color: '#fff', fontSize: 11, fontWeight: 700, padding: '0 4px',
  },
  confirmBtn: ui.btn,
  cancelBtn: { ...ui.btn, ...ui.danger },

  // Modal
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
  },
  modal: {
    background: '#fff', borderRadius: 16, padding: 28, width: '100%',
    maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '80vh',
    display: 'flex', flexDirection: 'column',
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 4 },
  modalSub: { fontSize: 13, color: 'var(--color-text-secondary)' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
    color: 'var(--color-text-secondary)', padding: 4,
  },
  loadingText: { fontSize: 14, color: 'var(--color-text-secondary)', textAlign: 'center', padding: '24px 0' },
  emptyApps: { fontSize: 14, color: 'var(--color-text-secondary)', textAlign: 'center', padding: '24px 0' },

  // Worker profile panel (inside modal)

  // Sort bar

  // Skill match

  // Caducados section
  expiredToggle: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: 10, padding: '12px 16px',
    cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text-primary)',
    fontSize: 14, fontWeight: 600,
  },
  expiredToggleIcon: { display: 'inline-flex' },
  expiredToggleTitle: { flex: 1, textAlign: 'left' as const },
  bulkBar: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    padding: '10px 4px', marginTop: 8,
  },
  bulkSelectAll: {
    display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
    fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)',
  },
  deleteAllBtn: { ...ui.btn, ...ui.danger },
  expiredRowMain: { display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' },
  repostBtn: ui.btn,
  deleteBtn: { ...ui.btn, ...ui.danger },
};
