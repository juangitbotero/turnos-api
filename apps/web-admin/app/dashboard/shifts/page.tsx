'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi, ApiError, Shift, Application } from '../../../lib/api';
import { connectSocket, getSocket, NewApplicationPayload } from '../../../lib/socket';

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: 'Rascunho',   color: '#6b7280', bg: '#f3f4f6' },
  OPEN:      { label: 'Aberto',     color: '#16a34a', bg: '#dcfce7' },
  FILLED:    { label: 'Preenchido', color: '#7c3aed', bg: '#ede9fe' },
  ACTIVE:    { label: 'Ativo',      color: '#2563eb', bg: '#dbeafe' },
  COMPLETED: { label: 'Concluído',  color: '#0891b2', bg: '#cffafe' },
  CANCELLED: { label: 'Cancelado',  color: '#dc2626', bg: '#fee2e2' },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── QR Display Modal ──────────────────────────────────────────────────────────

function QrDisplayModal({
  shift,
  onClose,
}: {
  shift: Shift;
  onClose: () => void;
}) {
  const [qrData, setQrData]       = useState<{ qrDataUrl: string; expiresAt: number } | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError]     = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed]   = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);

  const fetchQr = useCallback(async () => {
    try {
      setQrLoading(true);
      setQrError('');
      const data = await adminApi.getShiftQr(shift.id);
      setQrData(data);
      setSecondsLeft(30);
    } catch (err) {
      setQrError(err instanceof ApiError ? err.message : 'Erro ao gerar QR code.');
    } finally {
      setQrLoading(false);
    }
  }, [shift.id]);

  // Initial fetch + auto-refresh every 25s
  useEffect(() => {
    fetchQr();
    const refreshTimer = setInterval(fetchQr, 25_000);
    return () => clearInterval(refreshTimer);
  }, [fetchQr]);

  // Countdown timer display (purely cosmetic — shows time until next refresh)
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft(s => (s > 0 ? s - 1 : 30));
    }, 1_000);
    return () => clearInterval(tick);
  }, []);

  const handleManualConfirm = async () => {
    if (!window.confirm('Confirmar turno manualmente?\n\nEsta ação marca o turno como concluído e desencadeia o pagamento. Não pode ser desfeita.')) return;
    setConfirming(true);
    try {
      await adminApi.manualConfirmShift(shift.id);
      setConfirmed(true);
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Erro ao confirmar manualmente.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div style={s.overlay}>
      <div style={{ ...s.modal, maxWidth: 420 }}>
        {/* Header */}
        <div style={s.modalHeader}>
          <div>
            <h2 style={s.modalTitle}>QR Check-in / Check-out</h2>
            <p style={s.modalSub}>
              {shift.title || shift.subcategory} · {formatDate(shift.date)} · {shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}
            </p>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* QR Panel */}
        {confirmed ? (
          <div style={s.confirmedBox}>
            <div style={s.confirmedIcon}>✅</div>
            <p style={s.confirmedTitle}>Turno confirmado manualmente</p>
            <p style={s.confirmedSub}>O pagamento será processado no próximo dia útil.</p>
            <button style={s.approveBtn} onClick={onClose}>Fechar</button>
          </div>
        ) : (
          <>
            <div style={s.qrWrapper}>
              {qrLoading && !qrData && (
                <div style={s.qrPlaceholder}>
                  <div style={s.qrSpinner} />
                  <p style={s.loadingText}>A gerar QR code...</p>
                </div>
              )}
              {qrError && !qrData && (
                <div style={s.qrPlaceholder}>
                  <p style={{ color: '#dc2626', fontSize: 13, textAlign: 'center' }}>{qrError}</p>
                  <button style={s.retryBtn} onClick={fetchQr}>↻ Tentar novamente</button>
                </div>
              )}
              {qrData && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrData.qrDataUrl}
                  alt="QR Code para check-in/check-out"
                  style={s.qrImage}
                />
              )}
            </div>

            {/* Refresh countdown */}
            <div style={s.refreshRow}>
              <span style={s.refreshDot} />
              <span style={s.refreshText}>
                Atualiza em <strong>{secondsLeft}s</strong>
              </span>
              <button style={s.qrRefreshNowBtn} onClick={fetchQr} disabled={qrLoading}>
                ↻ Agora
              </button>
            </div>

            {/* Instructions */}
            <div style={s.instructionBox}>
              <p style={s.instructionText}>
                <strong>Como usar:</strong> Mostre este ecrã ao trabalhador. Ele aponta a câmara
                do telemóvel para fazer check-in ao começar e check-out ao terminar o turno.
                O QR expira a cada 30 segundos por segurança.
              </p>
            </div>

            {/* Manual fallback */}
            <div style={s.manualSection}>
              <p style={s.manualLabel}>Sem leitura de QR? Use a confirmação manual:</p>
              <button
                style={{ ...s.manualBtn, opacity: confirming ? 0.6 : 1 }}
                onClick={handleManualConfirm}
                disabled={confirming}
              >
                {confirming ? 'A confirmar...' : '✓ Confirmar turno manualmente'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Applicants Modal ──────────────────────────────────────────────────────────

function ShiftApplicationsModal({
  shift, onClose,
}: {
  shift: Shift;
  onClose: () => void;
}) {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

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
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erro ao aprovar.');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <div>
            <h2 style={s.modalTitle}>Candidatos — {shift.title || shift.subcategory}</h2>
            <p style={s.modalSub}>{formatDate(shift.date)} · {shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}</p>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <p style={s.loadingText}>A carregar candidatos...</p>
        ) : apps.length === 0 ? (
          <p style={s.emptyApps}>Nenhum candidato ainda.</p>
        ) : (
          <div style={s.appList}>
            {apps.map(app => (
              <div key={app.id} style={s.appCard}>
                <div style={s.appLeft}>
                  <div style={s.appAvatar}>
                    {(app.worker?.fullName?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div>
                    <p style={s.appName}>{app.worker?.fullName ?? 'Nome não definido'}</p>
                    <p style={s.appScore}>Score: {app.worker?.profileQualityScore ?? '—'}/100</p>
                    {app.worker?.skills && app.worker.skills.length > 0 && (
                      <p style={s.appSkills}>{app.worker.skills.slice(0, 3).join(', ')}</p>
                    )}
                  </div>
                </div>
                <div style={s.appRight}>
                  {app.status === 'APPROVED' && (
                    <span style={{ ...s.statusBadge, ...s.statusApproved }}>✓ Aprovado</span>
                  )}
                  {app.status === 'REJECTED' && (
                    <span style={{ ...s.statusBadge, ...s.statusRejected }}>✕ Rejeitado</span>
                  )}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const [shifts, setShifts]         = useState<Shift[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [viewingApps, setViewingApps] = useState<Shift | null>(null);
  const [viewingQr, setViewingQr]     = useState<Shift | null>(null);
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

  const active = shifts.filter(sh => ['OPEN', 'FILLED', 'ACTIVE'].includes(sh.status));
  const past   = shifts.filter(sh => ['COMPLETED', 'CANCELLED', 'DRAFT'].includes(sh.status));

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Os Meus Turnos</h1>
          <p style={s.sub}>
            {isLoading ? 'A carregar...' : `${shifts.length} turnos no total · ${active.length} ativos`}
          </p>
        </div>
        <div style={s.headerActions}>
          <button style={s.refreshBtn} onClick={load} disabled={isLoading}>↻ Atualizar</button>
          <Link href="/dashboard/new-shift" style={s.newBtn}>+ Publicar Turno</Link>
        </div>
      </div>

      {error && <div style={s.errorBanner}>⚠️ {error}</div>}

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
                cancelling={cancelling}
                newAppCount={newAppCounts[shift.id] ?? 0}
                onViewApps={() => {
                  setViewingApps(shift);
                  setNewAppCounts(prev => ({ ...prev, [shift.id]: 0 }));
                }}
                onViewQr={() => setViewingQr(shift)}
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
                cancelling={cancelling}
                newAppCount={0}
                onViewApps={() => setViewingApps(shift)}
                onViewQr={() => setViewingQr(shift)}
              />
            ))}
          </div>
        </section>
      )}

      {viewingApps && (
        <ShiftApplicationsModal shift={viewingApps} onClose={() => setViewingApps(null)} />
      )}
      {viewingQr && (
        <QrDisplayModal shift={viewingQr} onClose={() => setViewingQr(null)} />
      )}
    </div>
  );
}

// ── Shift row ─────────────────────────────────────────────────────────────────

function ShiftRow({ shift, onCancel, cancelling, onViewApps, onViewQr, newAppCount }: {
  shift: Shift;
  onCancel: (id: string) => void;
  cancelling: string | null;
  onViewApps: () => void;
  onViewQr: () => void;
  newAppCount: number;
}) {
  const st = STATUS_LABEL[shift.status] ?? { label: shift.status, color: '#6b7280', bg: '#f3f4f6' };
  const canCancel  = ['OPEN', 'DRAFT', 'FILLED'].includes(shift.status);
  const canViewQr  = ['FILLED', 'ACTIVE'].includes(shift.status);

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
        {canViewQr && (
          <button style={s.qrBtn} onClick={onViewQr} title="Mostrar QR code para check-in/check-out">
            📲 QR
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
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  title: { fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px', marginBottom: 4 },
  sub: { fontSize: 14, color: 'var(--color-text-secondary)' },
  headerActions: { display: 'flex', gap: 10, alignItems: 'center' },
  refreshBtn: {
    padding: '8px 16px', background: 'var(--color-primary-light)', border: '1px solid rgba(106,121,255,0.3)',
    borderRadius: 8, color: 'var(--color-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  newBtn: {
    padding: '10px 20px', background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-block',
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
  badge: { display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  rowActions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  viewAppsBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 10px', background: 'var(--color-primary-light)', border: '1px solid rgba(106,121,255,0.3)',
    borderRadius: 6, color: 'var(--color-primary)', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
  },
  qrBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '6px 10px', background: '#f0fdf4', border: '1px solid rgba(22,163,74,0.3)',
    borderRadius: 6, color: '#16a34a', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
  },
  newBadge: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 18, height: 18, borderRadius: 9, background: '#ef4444',
    color: '#fff', fontSize: 11, fontWeight: 700, padding: '0 4px',
  },
  cancelBtn: {
    padding: '6px 10px', background: '#fee2e2', border: '1px solid #fca5a5',
    borderRadius: 6, color: '#dc2626', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
  },

  // ── Modal shared ──────────────────────────────────────────────────────────
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
  },
  modal: {
    background: '#fff', borderRadius: 16, padding: 28, width: '100%',
    maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column', overflowY: 'auto',
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 4 },
  modalSub: { fontSize: 13, color: 'var(--color-text-secondary)' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
    color: 'var(--color-text-secondary)', padding: 4, flexShrink: 0,
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
  appRight: { display: 'flex', alignItems: 'center' },
  statusBadge: { padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  statusApproved: { background: '#dcfce7', color: '#16a34a' },
  statusRejected: { background: '#fee2e2', color: '#dc2626' },
  approveBtn: {
    padding: '8px 16px', background: '#dcfce7', border: '1px solid #86efac',
    borderRadius: 8, color: '#16a34a', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },

  // ── QR Modal specific ─────────────────────────────────────────────────────
  qrWrapper: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 280, background: '#f9fafb', borderRadius: 12,
    border: '1px solid var(--color-border)', marginBottom: 16,
  },
  qrPlaceholder: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 12, padding: 24,
  },
  qrSpinner: {
    width: 32, height: 32, borderRadius: 16,
    border: '3px solid rgba(106,121,255,0.2)',
    borderTopColor: 'var(--color-primary)',
    animation: 'spin 0.8s linear infinite',
  },
  qrImage: { width: 280, height: 280, borderRadius: 8 },
  retryBtn: {
    padding: '8px 16px', background: 'var(--color-primary-light)', border: '1px solid rgba(106,121,255,0.3)',
    borderRadius: 8, color: 'var(--color-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  refreshRow: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
    fontSize: 12, color: 'var(--color-text-secondary)',
  },
  refreshDot: { width: 8, height: 8, borderRadius: 4, background: '#22c55e', flexShrink: 0 },
  refreshText: { flex: 1 },
  qrRefreshNowBtn: {
    padding: '4px 10px', background: 'var(--color-secondary)', border: '1px solid var(--color-border)',
    borderRadius: 6, color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
  },
  instructionBox: {
    background: '#eff6ff', border: '1px solid rgba(59,130,246,0.2)',
    borderRadius: 8, padding: '12px 14px', marginBottom: 20,
  },
  instructionText: { fontSize: 12, color: '#1d4ed8', lineHeight: 1.6 },
  manualSection: {
    borderTop: '1px solid var(--color-border)', paddingTop: 16,
  },
  manualLabel: { fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10 },
  manualBtn: {
    width: '100%', padding: '10px 0', background: '#f0fdf4', border: '1px solid #86efac',
    borderRadius: 8, color: '#16a34a', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  confirmedBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '32px 0', gap: 8,
  },
  confirmedIcon: { fontSize: 48, marginBottom: 8 },
  confirmedTitle: { fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)' },
  confirmedSub: { fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 },
};
