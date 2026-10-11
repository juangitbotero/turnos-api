'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, ApiError, Shift, Application, WagePayment } from '../../../lib/api';
import { connectSocket, getSocket, NewApplicationPayload } from '../../../lib/socket';
import { COMPANY_CANCEL_REASONS, paymentMethodLabel } from '@turnos/shared';
import { useT } from '../../../lib/i18n';
import { LanguageSwitcher } from '../../../components/LanguageSwitcher';
import { ApplicantList, WorkerProfilePanel } from '../../../components/Applicants';
import { CANDIDATES_CHANGED_EVENT } from '../../../components/DashboardShell';
import { IconAlert, IconBriefcase, IconFile, IconTarget, IconChat, IconQr, IconClipboard, Stars } from '../../../components/icons';

/** A shift row that stands for a multi-day job rather than a single day. */
const isMultiDay = (shift: Shift): boolean => (shift.seriesDates?.length ?? 0) > 1;

/** Colours only — the label comes from `domain.shiftStatus.*`. */
const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  DRAFT:              { color: '#6b7280', bg: '#f3f4f6' },
  OPEN:               { color: '#16a34a', bg: '#dcfce7' },
  PENDING_ACCEPTANCE: { color: '#d97706', bg: '#fef3c7' },
  FILLED:             { color: '#7c3aed', bg: '#ede9fe' },
  ACTIVE:             { color: '#2563eb', bg: '#dbeafe' },
  COMPLETED:          { color: '#0891b2', bg: '#cffafe' },
  CANCELLED:          { color: '#dc2626', bg: '#fee2e2' },
};

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

  // Client-side expiry detection (backup until nightly cron runs)
  const isExpiredShift = (sh: Shift) => {
    if (!['OPEN', 'PENDING_ACCEPTANCE'].includes(sh.status)) return sh.status === 'EXPIRED';
    const [h, m] = sh.endTime.split(':').map(Number);
    const [y, mo, d] = sh.date.split('-').map(Number);
    const end = new Date(y!, (mo! - 1), d!, h ?? 0, m ?? 0, 0);
    return end < new Date();
  };

  const active  = shifts.filter(sh => ['OPEN', 'FILLED', 'ACTIVE', 'PENDING_ACCEPTANCE'].includes(sh.status) && !isExpiredShift(sh));
  const expired = shifts.filter(sh => isExpiredShift(sh));
  const past    = shifts.filter(sh => ['COMPLETED', 'CANCELLED', 'DRAFT'].includes(sh.status));

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
        <div style={{ ...s.qrTipBanner, background: '#fffbeb', border: '1px solid rgba(217,119,6,0.25)' }}>
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

      {/* Active shifts */}
      {active.length > 0 && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>{t('admin.shifts.sectionActive')}</h2>
          <div style={s.table}>
            <div style={s.tableHead}>
              <span>Turno</span><span>Data</span><span>Horário</span>
              <span>Valor bruto</span><span>Estado</span><span>Ações</span>
            </div>
            {active.map(shift => (
              <ShiftRow
                key={shift.id}
                shift={shift}
                onCancel={handleCancel}
                onManualConfirm={handleManualConfirm}
                cancelling={cancelling}
                confirming={confirming}
                newAppCount={newAppCounts[shift.id] ?? 0}
                onViewApps={() => {
                  setViewingApps(shift);
                  setNewAppCounts(prev => ({ ...prev, [shift.id]: 0 }));
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Past shifts */}
      {past.length > 0 && (
        <section style={s.section}>
          <h2 style={{ ...s.sectionTitle, color: 'var(--color-text-secondary)' }}>{t('admin.shifts.sectionHistory')}</h2>
          <div style={s.table}>
            <div style={s.tableHead}>
              <span>Turno</span><span>Data</span><span>Horário</span>
              <span>Valor bruto</span><span>Estado</span><span>Ações</span>
            </div>
            {past.map(shift => (
              <ShiftRow
                key={shift.id}
                shift={shift}
                onCancel={handleCancel}
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
            <div style={s.table}>
              <div style={s.tableHead}>
                <span>Turno</span><span>Data</span><span>Horário</span>
                <span>Valor bruto</span><span>Estado</span><span>Ações</span>
              </div>
              {expired.map(shift => (
                <div key={shift.id} style={{ ...s.row, opacity: 0.85 }}>
                  <div style={s.rowMain}>
                    <p style={s.rowTitle}>{shift.title || shift.subcategory}</p>
                    <p style={s.rowSub}>{shift.employer?.companyName ?? ''}</p>
                  </div>
                  <span style={s.rowCell}>{fMediumDate(shift.date)}</span>
                  <span style={s.rowCell}>{shift.startTime.slice(0,5)}–{shift.endTime.slice(0,5)}</span>
                  <span style={s.rowCell}>€{Number(shift.grossHourlyRate).toFixed(2)}/hr</span>
                  <span style={{ ...s.statusPill, background: '#fee2e2', color: '#dc2626' }}>{t('admin.shifts.expiredPill')}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
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

function ShiftRow({ shift, onCancel, onManualConfirm, cancelling, confirming, onViewApps, newAppCount }: {
  shift: Shift;
  onCancel: (id: string) => void;
  onManualConfirm: (shift: Shift) => void;
  cancelling: string | null;
  confirming: string | null;
  onViewApps: () => void;
  newAppCount: number;
}) {
  const { t, tSkill, tCategory, fMediumDate, fDateRange } = useT();
  const st = STATUS_STYLE[shift.status] ?? { color: '#6b7280', bg: '#f3f4f6' };
  const statusLabel = t(`domain.shiftStatus.${shift.status}`, { defaultValue: shift.status });
  const canCancel        = ['OPEN', 'DRAFT', 'FILLED'].includes(shift.status);
  const canManualConfirm = ['FILLED', 'ACTIVE'].includes(shift.status);

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
        <p style={s.rowSub}>{tCategory(shift.category)} · {shift.address.split(',')[0]}</p>
      </div>
      <span style={s.rowCell}>
        {isMultiDay(shift) ? fDateRange(shift.seriesDates!) : fMediumDate(shift.date)}
      </span>
      <span style={s.rowCell}>{shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}</span>
      <span style={{ ...s.rowCell, fontWeight: 700 }}>€{Number(shift.grossHourlyRate).toFixed(2)}/hr</span>
      <span style={{ ...s.badge, color: st.color, background: st.bg }}>{statusLabel}</span>
      <div style={s.rowActions}>
        {['OPEN', 'FILLED'].includes(shift.status) && (
          <button style={s.viewAppsBtn} onClick={onViewApps}>
            {t('admin.shifts.viewApps')}
            {newAppCount > 0 && (
              <span style={s.newBadge}>{newAppCount}</span>
            )}
          </button>
        )}
        {['FILLED', 'ACTIVE'].includes(shift.status) && (
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

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: 32, maxWidth: 1200, margin: '0 auto' },
  header: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px', marginBottom: 4 },
  sub: { fontSize: 14, color: 'var(--color-text-secondary)' },
  headerActions: { display: 'flex', gap: 10, alignItems: 'center' },
  refreshBtn: {
    padding: '8px 16px', background: 'var(--color-primary-light)', border: '1px solid rgba(106,121,255,0.3)',
    borderRadius: 8, color: 'var(--color-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  qrCodesBtn: {
    padding: '8px 16px', background: '#f0fdf4', border: '1px solid rgba(22,163,74,0.3)',
    borderRadius: 8, color: '#16a34a', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'inline-block',
  },
  newBtn: {
    padding: '10px 20px', background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-block',
  },
  qrTipBanner: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#faf5ff', border: '1px solid rgba(124,58,237,0.2)',
    borderRadius: 8, padding: '10px 14px', fontSize: 13,
    color: 'var(--color-text-primary)', marginBottom: 24,
  },
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
  multiDayTag: {
    display: 'inline-flex', alignItems: 'center', margin: '5px 0 1px',
    padding: '2px 8px', borderRadius: 20,
    fontSize: 11, fontWeight: 700, color: '#1d4ed8',
    background: '#dbeafe', border: '1px solid #bfdbfe',
  },
  rowSub: { fontSize: 12, color: 'var(--color-text-secondary)' },
  rowCell: { color: 'var(--color-text-primary)' },
  badge: { display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fef9c3', border: '1px solid #fde68a', color: '#92400e' },
  rowActions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  viewAppsBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 10px', background: 'var(--color-primary-light)', border: '1px solid rgba(106,121,255,0.3)',
    borderRadius: 6, color: 'var(--color-primary)', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
  },
  newBadge: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 18, height: 18, borderRadius: 9, background: '#ef4444',
    color: '#fff', fontSize: 11, fontWeight: 700, padding: '0 4px',
  },
  confirmBtn: {
    padding: '6px 10px', background: '#f0fdf4', border: '1px solid #86efac',
    borderRadius: 6, color: '#16a34a', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
  },
  cancelBtn: {
    padding: '6px 10px', background: '#fee2e2', border: '1px solid #fca5a5',
    borderRadius: 6, color: '#dc2626', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
  },

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
    background: '#fff7ed', border: '1px solid #fed7aa',
    borderRadius: 10, padding: '12px 16px',
    cursor: 'pointer', fontFamily: 'inherit', color: '#92400e',
    fontSize: 14, fontWeight: 600,
  },
  expiredToggleIcon: { display: 'inline-flex' },
  expiredToggleTitle: { flex: 1, textAlign: 'left' as const },
  repostBtn: {
    padding: '6px 12px', background: 'var(--color-primary-light)',
    border: '1px solid rgba(106,121,255,0.3)', borderRadius: 8,
    color: 'var(--color-primary)', fontWeight: 600, fontSize: 12,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  deleteBtn: {
    padding: '6px 12px', background: '#fee2e2',
    border: '1px solid #fca5a5', borderRadius: 8,
    color: '#dc2626', fontWeight: 600, fontSize: 12,
    cursor: 'pointer', fontFamily: 'inherit',
  },
};
