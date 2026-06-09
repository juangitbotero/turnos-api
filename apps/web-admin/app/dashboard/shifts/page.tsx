'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminApi, ApiError, Shift, Application } from '../../../lib/api';
import { connectSocket, getSocket, NewApplicationPayload } from '../../../lib/socket';
import { formatDate } from '../../../lib/format';

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

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      setShifts(await adminApi.getMyShifts());
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

  const handleCancel = async (id: string) => {
    if (!confirm('Tem a certeza que quer cancelar este turno?')) return;
    setCancelling(id);
    try {
      await adminApi.cancelShift(id);
      setShifts(prev => prev.map(sh => sh.id === id ? { ...sh, status: 'CANCELLED' as const } : sh));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erro ao cancelar.');
    } finally {
      setCancelling(null);
    }
  };

  const handleManualConfirm = async (shift: Shift) => {
    if (!confirm(
      `Marcar como concluído: "${shift.title || shift.subcategory}"\n\n` +
      `O turno será encerrado e o pagamento será desencadeado automaticamente. Esta ação não pode ser desfeita.\n\n` +
      `Usa esta opção apenas se o trabalhador não conseguiu fazer check-out via QR.`
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
            title="Marcar como concluído (sem QR) — usar quando o trabalhador não conseguiu fazer check-out"
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
