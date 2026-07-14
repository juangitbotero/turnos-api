'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminApi, ApiError, Shift, Application, WagePayment } from '../../../lib/api';
import { connectSocket, getSocket, NewApplicationPayload } from '../../../lib/socket';
import { formatDate } from '../../../lib/format';
import { COMPANY_CANCEL_REASONS, PAYMENT_METHOD_LABELS, PaymentMethod } from '@turnos/shared';

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:              { label: 'Rascunho',          color: '#6b7280', bg: '#f3f4f6' },
  OPEN:               { label: 'Aberto',            color: '#16a34a', bg: '#dcfce7' },
  PENDING_ACCEPTANCE: { label: 'A aguardar worker', color: '#d97706', bg: '#fef3c7' },
  FILLED:             { label: 'Preenchido',        color: '#7c3aed', bg: '#ede9fe' },
  ACTIVE:             { label: 'Ativo',             color: '#2563eb', bg: '#dbeafe' },
  COMPLETED:          { label: 'Concluído',         color: '#0891b2', bg: '#cffafe' },
  CANCELLED:          { label: 'Cancelado',         color: '#dc2626', bg: '#fee2e2' },
};

// ── Applicants Modal ──────────────────────────────────────────────────────────

function WorkerProfilePanel({ app, onBack }: { app: Application; onBack: () => void }) {
  const w = app.worker;
  const score = w?.profileQualityScore ?? 0;
  const scoreColor = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  const avgR = w?.avgRating != null ? Number(w.avgRating) : null;
  const filledStars = Math.round(avgR ?? 0);
  const statusLabel: Record<string, string> = {
    INCOMPLETE: 'Perfil incompleto', PENDING_REVIEW: 'A aguardar aprovação',
    ACTIVE: 'Ativo', SUSPENDED: 'Suspenso', REJECTED: 'Rejeitado',
  };

  return (
    <div style={s.profilePanel}>
      <button style={s.backInPanel} onClick={onBack}>← Voltar à lista</button>

      {/* Header: photo + name + status + rating */}
      <div style={s.profileTop}>
        {w?.photoUrl
          ? <img src={w.photoUrl} alt={w.fullName ?? ''} style={s.profilePhoto} />
          : <div style={s.profileAvatar}>{(w?.fullName?.[0] ?? '?').toUpperCase()}</div>
        }
        <div style={{ flex: 1 }}>
          <p style={s.profileName}>{w?.fullName ?? 'Nome não definido'}</p>
          <span style={{
            ...s.profileStatusBadge,
            background: w?.status === 'ACTIVE' ? '#dcfce7' : '#fef9c3',
            color:      w?.status === 'ACTIVE' ? '#166534' : '#854d0e',
          }}>
            {statusLabel[w?.status ?? ''] ?? w?.status ?? '—'}
          </span>
          {avgR != null && (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#fbbf24', fontSize: 14 }}>{'★'.repeat(filledStars)}{'☆'.repeat(5 - filledStars)}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b' }}>{avgR.toFixed(1)}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>({w?.totalRatings ?? 0} aval.)</span>
            </div>
          )}
          {w?.badges && w.badges.length > 0 && (
            <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
              {w.badges.includes('TOP_RATED') && <span style={s.badge}>🏆 Top Rated</span>}
              {w.badges.includes('RELIABLE')  && <span style={s.badge}>✅ Fiável</span>}
              {w.badges.includes('VERIFIED')  && <span style={s.badge}>✔️ Verificado</span>}
            </div>
          )}
        </div>
      </div>

      {/* Cover note from worker */}
      {app.coverNote && (
        <div style={s.coverNoteBox}>
          <p style={s.profileSectionTitle}>💬 Mensagem do candidato</p>
          <p style={s.coverNoteText}>"{app.coverNote}"</p>
        </div>
      )}

      {/* Bio */}
      {w?.bio && (
        <div style={s.profileSection}>
          <p style={s.profileSectionTitle}>Apresentação</p>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, margin: 0 }}>{w.bio}</p>
        </div>
      )}

      {/* Score bar */}
      <div style={s.scoreSection}>
        <div style={s.scoreHeader}>
          <span style={s.scoreLabel}>Perfil completo</span>
          <span style={{ ...s.scoreValue, color: scoreColor }}>{score}%</span>
        </div>
        <div style={s.scoreBarBg}>
          <div style={{ ...s.scoreBarFill, width: `${score}%`, background: scoreColor }} />
        </div>
      </div>

      {/* Skills */}
      {w?.skills && w.skills.length > 0 && (
        <div style={s.profileSection}>
          <p style={s.profileSectionTitle}>Competências</p>
          <div style={s.skillTags}>
            {w.skills.map(sk => <span key={sk} style={s.skillTag}>{sk}</span>)}
          </div>
        </div>
      )}

      {/* Languages */}
      {w?.languages && w.languages.length > 0 && (
        <div style={s.profileSection}>
          <p style={s.profileSectionTitle}>Idiomas</p>
          <div style={s.skillTags}>
            {w.languages.map(lang => (
              <span key={lang} style={{ ...s.skillTag, background: '#f0fdf4', color: '#15803d' }}>{lang}</span>
            ))}
          </div>
        </div>
      )}

      {/* Available days */}
      {w?.availableDays && w.availableDays.length > 0 && (
        <div style={s.profileSection}>
          <p style={s.profileSectionTitle}>Disponibilidade semanal</p>
          <div style={s.skillTags}>
            {w.availableDays.map(d => (
              <span key={d} style={{ ...s.skillTag, background: '#dbeafe', color: '#1d4ed8' }}>{d}</span>
            ))}
          </div>
        </div>
      )}

      {!w?.bio && (!w?.skills || w.skills.length === 0) && (!w?.availableDays || w.availableDays.length === 0) && (
        <p style={s.emptyApps}>Este candidato ainda não preencheu o perfil completo.</p>
      )}
    </div>
  );
}

type SortMode = 'rating' | 'score' | 'date';

function skillMatch(app: Application, shift: Shift): number {
  const required = shift.skillsRequired ?? [];
  if (required.length === 0) return -1; // no requirement — don't show indicator
  const workerSkills = app.worker?.skills ?? [];
  return required.filter(r => workerSkills.includes(r)).length;
}

function ShiftApplicationsModal({
  shift, onClose,
}: {
  shift: Shift;
  onClose: () => void;
}) {
  const [apps, setApps]             = useState<Application[]>([]);
  const [loading, setLoading]       = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<Application | null>(null);
  const [sortMode, setSortMode]     = useState<SortMode>('rating');

  useEffect(() => {
    adminApi.getShiftApplications(shift.id).then(setApps).catch(() => {}).finally(() => setLoading(false));
  }, [shift.id]);

  const handleApprove = async (appId: string) => {
    setProcessing(appId);
    try {
      await adminApi.approveApplication(shift.id, appId);
      setApps(prev => prev.map(a =>
        a.id === appId ? { ...a, status: 'APPROVED' as const } : { ...a, status: 'REJECTED' as const },
      ));
      setViewingProfile(null);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erro ao aprovar.');
    } finally {
      setProcessing(null);
    }
  };

  const sorted = [...apps].sort((a, b) => {
    if (sortMode === 'rating') {
      return Number(b.worker?.avgRating ?? 0) - Number(a.worker?.avgRating ?? 0);
    }
    if (sortMode === 'score') {
      return (b.worker?.profileQualityScore ?? 0) - (a.worker?.profileQualityScore ?? 0);
    }
    // date — earliest first (most committed)
    return new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime();
  });

  const requiredCount = shift.skillsRequired?.length ?? 0;

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <div>
            <h2 style={s.modalTitle}>Candidatos — {shift.title || shift.subcategory}</h2>
            <p style={s.modalSub}>{formatDate(shift.date)} · {shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)} · {apps.length} candidato{apps.length !== 1 ? 's' : ''}</p>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {viewingProfile ? (
          <WorkerProfilePanel app={viewingProfile} onBack={() => setViewingProfile(null)} />
        ) : loading ? (
          <p style={s.loadingText}>A carregar candidatos...</p>
        ) : apps.length === 0 ? (
          <p style={s.emptyApps}>Nenhum candidato ainda.</p>
        ) : (
          <>
            {/* Sort bar */}
            <div style={s.sortBar}>
              <span style={s.sortLabel}>Ordenar:</span>
              {([['rating', '⭐ Melhor avaliação'], ['score', '📋 Perfil mais completo'], ['date', '🕐 Mais antigo']] as [SortMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  style={{ ...s.sortBtn, ...(sortMode === mode ? s.sortBtnActive : {}) }}
                  onClick={() => setSortMode(mode)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={s.appList}>
              {sorted.map(app => {
                const match = skillMatch(app, shift);
                const matchLabel = requiredCount > 0
                  ? `${match}/${requiredCount} competências`
                  : null;
                const isFullMatch = match === requiredCount && requiredCount > 0;

                return (
                  <div key={app.id} style={s.appCard}>
                    <div style={s.appLeft}>
                      {app.worker?.photoUrl
                        ? <img src={app.worker.photoUrl} alt={app.worker.fullName ?? ''} style={{ ...s.appAvatar, objectFit: 'cover' } as React.CSSProperties} />
                        : <div style={s.appAvatar}>{(app.worker?.fullName?.[0] ?? '?').toUpperCase()}</div>
                      }
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <p style={s.appName}>{app.worker?.fullName ?? 'Nome não definido'}</p>
                          {isFullMatch && <span style={s.matchBadge}>✓ Match total</span>}
                        </div>
                        <p style={s.appScore}>Perfil: {app.worker?.profileQualityScore ?? '—'}%
                          {app.worker?.avgRating != null && (
                            <span style={{ marginLeft: 8, color: '#fbbf24' }}>
                              ★ {Number(app.worker.avgRating).toFixed(1)}
                              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}> ({app.worker.totalRatings ?? 0})</span>
                            </span>
                          )}
                        </p>
                        {matchLabel && (
                          <p style={{ ...s.appSkills, color: isFullMatch ? '#16a34a' : 'var(--color-text-secondary)' }}>
                            🎯 {matchLabel}
                          </p>
                        )}
                        {app.worker?.skills && app.worker.skills.length > 0 && (
                          <p style={s.appSkills}>{app.worker.skills.slice(0, 3).join(', ')}{app.worker.skills.length > 3 ? ` +${app.worker.skills.length - 3}` : ''}</p>
                        )}
                        {app.coverNote && (
                          <p style={s.coverNote}>💬 "{app.coverNote}"</p>
                        )}
                      </div>
                    </div>
                    <div style={{ ...s.appRight, gap: 8 }}>
                      <button style={s.viewProfileBtn} onClick={() => setViewingProfile(app)}>Ver perfil →</button>
                      {app.status === 'APPROVED' && <span style={{ ...s.statusBadge, ...s.statusApproved }}>✓ Aprovado</span>}
                      {app.status === 'REJECTED' && <span style={{ ...s.statusBadge, ...s.statusRejected }}>✕ Rejeitado</span>}
                      {app.status === 'PENDING' && (
                        <button
                          style={{ ...s.approveBtn, opacity: processing === app.id ? 0.6 : 1 }}
                          onClick={() => handleApprove(app.id)}
                          disabled={!!processing}
                        >
                          {processing === app.id ? '...' : 'Selecionar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const router = useRouter();
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
  const [markingPaid, setMarkingPaid]   = useState<string | null>(null);
  const [wageAction, setWageAction]     = useState<{ wage: WagePayment; mode: 'adjust' | 'problem' } | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      setShifts(await adminApi.getMyShifts());
      // Best-effort — the pending-payments strip is secondary to the shift list
      adminApi.getPendingWages().then(setPendingWages).catch(() => {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar turnos.');
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
    if (!confirm('Tem a certeza que quer cancelar este turno?')) return;
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
      alert(err instanceof ApiError ? err.message : 'Erro ao cancelar.');
    } finally {
      setCancelling(null);
    }
  };

  const handleMarkPaid = async (wage: WagePayment) => {
    if (!confirm(`Confirmas que pagaste €${Number(wage.amount).toFixed(2)} ao trabalhador pelo turno "${wage.shiftTitle}"? O trabalhador será notificado para confirmar a receção.`)) return;
    setMarkingPaid(wage.id);
    try {
      const updated = await adminApi.markWagePaid(wage.id);
      setPendingWages(prev => prev.map(w => w.id === wage.id ? updated : w));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erro ao marcar como pago.');
    } finally {
      setMarkingPaid(null);
    }
  };

  const handleManualConfirm = async (shift: Shift) => {
    if (!confirm(
      `Marcar como concluído: "${shift.title || shift.subcategory}"\n\n` +
      `O turno será encerrado e o pagamento será desencadeado automaticamente. Esta ação não pode ser desfeita.\n\n` +
      `Usa esta opção apenas se o turno não concluiu automaticamente (ex.: check-in falhou).`
    )) return;
    setConfirming(shift.id);
    try {
      await adminApi.manualConfirmShift(shift.id);
      setShifts(prev => prev.map(sh => sh.id === shift.id ? { ...sh, status: 'COMPLETED' as const } : sh));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erro ao confirmar.');
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
          <button style={s.backBtn} onClick={() => router.push('/dashboard')}>← Dashboard</button>
          <h1 style={s.title}>Os Meus Turnos</h1>
          <p style={s.sub}>
            {isLoading ? 'A carregar...' : `${shifts.length} turnos no total · ${active.length} ativos`}
          </p>
        </div>
        <div style={s.headerActions}>
          <button style={s.refreshBtn} onClick={load} disabled={isLoading}>↻ Atualizar</button>
          {/* QR codes are per-employer (static), not per shift */}
          <Link href="/dashboard/qr-codes" style={s.qrCodesBtn}>📲 Códigos QR</Link>
          <Link href="/dashboard/new-shift" style={s.newBtn}>+ Publicar Turno</Link>
        </div>
      </div>

      {error && <div style={s.errorBanner}>⚠️ {error}</div>}

      {/* ── Pending wage payments (Pay Link + trust loop) ── */}
      {pendingWages.length > 0 && (
        <section style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
          padding: '16px 20px', marginBottom: 20,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#92400e', marginBottom: 10 }}>
            💶 Pagamentos pendentes a trabalhadores ({pendingWages.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingWages.map(w => (
              <div key={w.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                background: '#fff', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px',
              }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e1b4b' }}>
                    {w.type === 'CANCELLATION_MINIMUM' ? '⚠️ Mínimo 2h (cancelamento) — ' : ''}{w.shiftTitle}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {w.shiftDate ?? ''} · {PAYMENT_METHOD_LABELS[w.paymentMethod as PaymentMethod] ?? w.paymentMethod}
                    {w.status === 'MARKED_PAID' && ' · aguarda confirmação do trabalhador'}
                    {w.status === 'DISPUTED' && ' · 🚩 trabalhador reporta não ter recebido'}
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1e1b4b' }}>
                  €{Number(w.amount).toFixed(2)}
                </div>
                {w.payLinkUrl && w.status === 'PENDING' && (
                  <a href={w.payLinkUrl} target="_blank" rel="noreferrer" style={{
                    background: '#6a79ff', color: '#fff', fontWeight: 700, fontSize: 13,
                    padding: '8px 16px', borderRadius: 8, textDecoration: 'none',
                  }}>
                    💳 Pagar agora
                  </a>
                )}
                {!w.payLinkUrl && (w.status === 'PENDING' || w.status === 'DISPUTED') && (
                  <button
                    onClick={() => handleMarkPaid(w)}
                    disabled={markingPaid === w.id}
                    style={{
                      background: '#fff', color: '#16a34a', fontWeight: 700, fontSize: 13,
                      padding: '8px 16px', borderRadius: 8, border: '1.5px solid #86efac',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {markingPaid === w.id ? '...' : '✓ Marcar como pago'}
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
                      ✏️ Ajustar horas
                    </button>
                    <button
                      onClick={() => setWageAction({ wage: w, mode: 'problem' })}
                      style={{
                        background: '#fff', color: '#dc2626', fontWeight: 600, fontSize: 12,
                        padding: '8px 12px', borderRadius: 8, border: '1.5px solid #fecaca',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      ⚠️ Reportar problema
                    </button>
                  </>
                )}
                {w.status === 'UNDER_REVIEW' && (
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
                    ⚖️ Em análise pela Turnos (48h)
                  </span>
                )}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#92400e', marginTop: 10 }}>
            Pagamentos em falta há mais de 72h suspendem a publicação de novos turnos.
          </p>
        </section>
      )}

      {/* QR tip banner — shown when there are FILLED/ACTIVE shifts */}
      {active.some(sh => ['FILLED', 'ACTIVE'].includes(sh.status)) && (
        <div style={s.qrTipBanner}>
          <span>📲</span>
          <span>
            Tem turnos confirmados hoje. Certifique-se de que os{' '}
            <Link href="/dashboard/qr-codes" style={{ color: '#7c3aed', fontWeight: 700 }}>
              QR codes
            </Link>{' '}
            estão visíveis no seu local de trabalho.
          </span>
        </div>
      )}

      {!isLoading && shifts.length === 0 && !error && (
        <div style={s.empty}>
          <div style={s.emptyIcon}>📋</div>
          <p style={s.emptyText}>Ainda não publicou nenhum turno.</p>
          <Link href="/dashboard/new-shift" style={s.emptyBtn}>Publicar primeiro turno →</Link>
        </div>
      )}

      {/* Active shifts */}
      {active.length > 0 && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Turnos Ativos</h2>
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
          <h2 style={{ ...s.sectionTitle, color: 'var(--color-text-secondary)' }}>Histórico</h2>
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
            <span style={s.expiredToggleIcon}>⚠️</span>
            <span style={s.expiredToggleTitle}>
              Caducados ({expired.length}) — Turnos sem trabalhador confirmado
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 12 }}>{showExpired ? '▲ Fechar' : '▼ Ver'}</span>
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
                  <span style={s.rowCell}>{formatDate(shift.date)}</span>
                  <span style={s.rowCell}>{shift.startTime.slice(0,5)}–{shift.endTime.slice(0,5)}</span>
                  <span style={s.rowCell}>€{Number(shift.grossHourlyRate).toFixed(2)}/hr</span>
                  <span style={{ ...s.statusPill, background: '#fee2e2', color: '#dc2626' }}>Caducado</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      style={s.repostBtn}
                      onClick={() => {
                        // Pre-fill new-shift with this shift's data via sessionStorage
                        sessionStorage.setItem('repost_shift', JSON.stringify(shift));
                        window.location.href = '/dashboard/new-shift';
                      }}
                    >
                      🔁 Re-publicar
                    </button>
                    <button
                      style={{ ...s.deleteBtn, opacity: deletingExpired === shift.id ? 0.5 : 1 }}
                      disabled={deletingExpired === shift.id}
                      onClick={async () => {
                        if (!confirm('Eliminar este turno caducado?')) return;
                        setDeleting(shift.id);
                        try {
                          await adminApi.deleteExpiredShift(shift.id);
                          setShifts(prev => prev.filter(s => s.id !== shift.id));
                        } catch {
                          alert('Erro ao eliminar.');
                        } finally {
                          setDeleting(null);
                        }
                      }}
                    >
                      {deletingExpired === shift.id ? '...' : '🗑 Eliminar'}
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
      setError(err instanceof ApiError ? err.message : 'Erro — tenta novamente.');
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
          {mode === 'adjust' ? 'Ajustar horas trabalhadas' : 'Reportar problema no turno'}
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          {wage.shiftTitle} · {wage.shiftDate ?? ''} · atual: €{Number(wage.amount).toFixed(2)}
        </p>

        {mode === 'adjust' ? (
          <>
            <p style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>
              Quantas horas trabalhou realmente? <strong>Mínimo 2 horas</strong> (política de
              turno terminado antecipadamente). O valor e o Pay Link são recalculados e o
              trabalhador é notificado.
            </p>
            <input
              type="number"
              min={2}
              step={0.5}
              placeholder="Ex.: 3.5"
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
            Descreve o que aconteceu (ex.: o trabalhador abandonou o turno a meio). O ciclo
            de lembretes de pagamento fica <strong>pausado</strong> enquanto a equipa Turnos
            analisa (até 48h).
          </p>
        )}

        <textarea
          placeholder={mode === 'adjust' ? 'Motivo (opcional)' : 'Descrição do problema (obrigatório)'}
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
            ⚠️ {error}
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
            {busy ? 'A enviar…' : mode === 'adjust' ? 'Ajustar e recalcular' : 'Reportar problema'}
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
          Cancelar turno preenchido
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          {shift.title || shift.subcategory} · {formatDate(shift.date)} · {shift.startTime.slice(0, 5)}
        </p>

        {isUnder3h ? (
          <>
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
              padding: '12px 14px', fontSize: 13, color: '#991b1b', marginBottom: 16, lineHeight: 1.5,
            }}>
              ⚠️ Faltam menos de <strong>3 horas</strong> para o início. Se o cancelamento for por
              erro/decisão da empresa, deves pagar o <strong>mínimo de 2 horas
              (€{minimumEur.toFixed(2)})</strong> ao trabalhador + a taxa normal de 3€.
              Motivos justificados são avaliados pela Turnos em até 48h.
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>
              Motivo do cancelamento <span style={{ color: '#dc2626' }}>*</span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {Object.entries(COMPANY_CANCEL_REASONS).map(([key, label]) => (
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
                  {label}
                  {key === 'ERRO_EMPRESA' && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#dc2626', fontWeight: 700 }}>
                      2h mín. + 3€
                    </span>
                  )}
                </label>
              ))}
            </div>
            <textarea
              placeholder="Descrição (opcional, recomendado para motivos justificados)"
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
            {isUnder24h
              ? '⏳ Faltam menos de 24 horas. O cancelamento é gratuito mas fica registado na fiabilidade da empresa. O trabalhador será notificado com um pedido de desculpas.'
              : '✓ Faltam mais de 24 horas — cancelamento gratuito. O trabalhador será notificado com um pedido de desculpas e o turno reabre para outros workers.'}
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
            {busy ? 'A cancelar…' : 'Cancelar turno'}
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
  const st = STATUS_LABEL[shift.status] ?? { label: shift.status, color: '#6b7280', bg: '#f3f4f6' };
  const canCancel        = ['OPEN', 'DRAFT', 'FILLED'].includes(shift.status);
  const canManualConfirm = ['FILLED', 'ACTIVE'].includes(shift.status);

  return (
    <div style={s.tableRow}>
      <div>
        <p style={s.rowTitle}>{shift.title || shift.subcategory}</p>
        <p style={s.rowSub}>{shift.category} · {shift.address.split(',')[0]}</p>
      </div>
      <span style={s.rowCell}>{formatDate(shift.date)}</span>
      <span style={s.rowCell}>{shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}</span>
      <span style={{ ...s.rowCell, fontWeight: 700 }}>€{Number(shift.grossHourlyRate).toFixed(2)}/hr</span>
      <span style={{ ...s.badge, color: st.color, background: st.bg }}>{st.label}</span>
      <div style={s.rowActions}>
        {['OPEN', 'FILLED'].includes(shift.status) && (
          <button style={s.viewAppsBtn} onClick={onViewApps}>
            👥 Candidatos
            {newAppCount > 0 && (
              <span style={s.newBadge}>{newAppCount}</span>
            )}
          </button>
        )}
        {canManualConfirm && (
          <button
            style={{ ...s.confirmBtn, opacity: confirming === shift.id ? 0.6 : 1 }}
            onClick={() => onManualConfirm(shift)}
            disabled={confirming === shift.id}
            title="Marcar como concluído (sem QR) — usar quando o turno não concluiu automaticamente"
          >
            {confirming === shift.id ? '...' : '🏁 Concluído'}
          </button>
        )}
        {canCancel && (
          <button
            style={{ ...s.cancelBtn, opacity: cancelling === shift.id ? 0.6 : 1 }}
            onClick={() => onCancel(shift.id)}
            disabled={cancelling === shift.id}
          >
            {cancelling === shift.id ? '...' : 'Cancelar'}
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
  backBtn: {
    display: 'inline-block', background: 'none', border: 'none', padding: 0,
    fontSize: 13, color: 'var(--color-text-secondary)', cursor: 'pointer',
    fontFamily: 'inherit', marginBottom: 6,
  },
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
  emptyIcon: { fontSize: 48, marginBottom: 16 },
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
  appList: { display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' },
  appCard: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-secondary)',
  },
  appLeft: { display: 'flex', gap: 12, alignItems: 'center' },
  appAvatar: {
    width: 44, height: 44, borderRadius: 22, background: 'var(--color-primary-light)',
    color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 800, flexShrink: 0,
  },
  appName: { fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 2 },
  appScore: { fontSize: 12, color: 'var(--color-text-secondary)' },
  appSkills: { fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 },
  appRight: { display: 'flex', alignItems: 'center', flexDirection: 'column' as const },
  statusBadge: { padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  statusApproved: { background: '#dcfce7', color: '#16a34a' },
  statusRejected: { background: '#fee2e2', color: '#dc2626' },
  viewProfileBtn: {
    padding: '5px 10px', background: 'none', border: '1px solid var(--color-border)',
    borderRadius: 6, color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: 11,
    cursor: 'pointer', fontFamily: 'inherit', marginBottom: 4,
  },
  approveBtn: {
    padding: '8px 16px', background: '#dcfce7', border: '1px solid #86efac',
    borderRadius: 8, color: '#16a34a', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },

  // Worker profile panel (inside modal)
  profilePanel: { display: 'flex', flexDirection: 'column' as const, gap: 16, overflowY: 'auto' as const },
  backInPanel: {
    background: 'none', border: 'none', padding: 0, fontSize: 13,
    color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
    textAlign: 'left' as const, marginBottom: 4,
  },
  profileTop: { display: 'flex', gap: 14, alignItems: 'center' },
  profilePhoto: { width: 64, height: 64, borderRadius: 32, objectFit: 'cover' as const, flexShrink: 0 },
  profileAvatar: {
    width: 64, height: 64, borderRadius: 32, background: 'var(--color-primary-light)',
    color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, fontWeight: 800, flexShrink: 0,
  },
  profileName: { fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 6 },
  profileStatusBadge: { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  scoreSection: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  scoreHeader: { display: 'flex', justifyContent: 'space-between' },
  scoreLabel: { fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' },
  scoreValue: { fontSize: 14, fontWeight: 800 },
  scoreBarBg: { height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 4, transition: 'width 0.3s ease' },
  profileSection: { display: 'flex', flexDirection: 'column' as const, gap: 8 },
  profileSectionTitle: { fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  skillTags: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  skillTag: {
    padding: '4px 10px', background: 'var(--color-primary-light)', borderRadius: 20,
    fontSize: 12, fontWeight: 600, color: 'var(--color-primary)',
    border: '1px solid rgba(106,121,255,0.2)',
  },
  coverNoteBox: {
    background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
    padding: '12px 14px', display: 'flex', flexDirection: 'column' as const, gap: 6,
  },
  coverNoteText: {
    fontSize: 13, color: '#374151', lineHeight: 1.5, margin: 0,
    fontStyle: 'italic' as const,
  },

  // Sort bar
  sortBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 0', borderBottom: '1px solid var(--color-border)', marginBottom: 4,
  },
  sortLabel: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', flexShrink: 0 },
  sortBtn: {
    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--color-border)',
    background: 'none',
    color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  sortBtnActive: {
    background: 'var(--color-primary-light)', borderColor: 'rgba(106,121,255,0.4)',
    color: 'var(--color-primary)',
  },

  // Skill match
  matchBadge: {
    fontSize: 10, fontWeight: 700, color: '#16a34a',
    background: '#dcfce7', border: '1px solid #86efac',
    borderRadius: 20, padding: '2px 7px',
  },
  coverNote: {
    fontSize: 12, color: '#6b7280', fontStyle: 'italic' as const,
    marginTop: 2, maxWidth: 260,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  },

  // Caducados section
  expiredToggle: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    background: '#fff7ed', border: '1px solid #fed7aa',
    borderRadius: 10, padding: '12px 16px',
    cursor: 'pointer', fontFamily: 'inherit', color: '#92400e',
    fontSize: 14, fontWeight: 600,
  },
  expiredToggleIcon: { fontSize: 18 },
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
