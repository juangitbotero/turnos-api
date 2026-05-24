'use client';

import { useEffect, useState } from 'react';
import { adminApi, ApiError } from '../../../lib/api';

type Worker = {
  id: string;
  fullName: string | null;
  nif: string | null;
  iban: string | null;
  skills: string[] | null;
  availableDays: string[] | null;
  profileQualityScore: number;
  photoUrl: string | null;
  createdAt: string;
  userEmail: string | null;
  userPhone: string | null;
};

export default function WorkersApprovalPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]     = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await adminApi.getPendingWorkers();
      setWorkers(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar trabalhadores.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      await adminApi.approveWorker(id);
      setWorkers(prev => prev.filter(w => w.id !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erro ao aprovar.');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setProcessing(rejectTarget);
    try {
      await adminApi.rejectWorker(rejectTarget, rejectReason || 'Perfil não aprovado');
      setWorkers(prev => prev.filter(w => w.id !== rejectTarget));
      setRejectTarget(null);
      setRejectReason('');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erro ao rejeitar.');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Aprovação de Trabalhadores</h1>
          <p style={s.sub}>
            {isLoading ? 'A carregar...' : `${workers.length} perfis aguardam revisão`}
          </p>
        </div>
        <button style={s.refreshBtn} onClick={load} disabled={isLoading}>
          ↻ Atualizar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={s.errorBanner}>⚠️ {error}</div>
      )}

      {/* Empty state */}
      {!isLoading && workers.length === 0 && !error && (
        <div style={s.empty}>
          <div style={s.emptyIcon}>✅</div>
          <p style={s.emptyText}>Nenhum perfil pendente de revisão.</p>
        </div>
      )}

      {/* Worker cards */}
      <div style={s.grid}>
        {workers.map(worker => (
          <div key={worker.id} style={s.card}>
            {/* Photo + name */}
            <div style={s.cardTop}>
              {worker.photoUrl ? (
                <img src={worker.photoUrl} alt={worker.fullName ?? 'Worker'} style={s.photo} />
              ) : (
                <div style={s.photoPlaceholder}>
                  {(worker.fullName?.[0] ?? '?').toUpperCase()}
                </div>
              )}
              <div style={s.cardInfo}>
                <p style={s.workerName}>{worker.fullName ?? 'Nome não definido'}</p>
                <p style={s.workerContact}>{worker.userPhone ?? worker.userEmail ?? '—'}</p>
                <div style={s.scoreBadge}>
                  <span style={{
                    ...s.scoreValue,
                    color: worker.profileQualityScore >= 80 ? '#16a34a' : '#d97706',
                  }}>
                    {worker.profileQualityScore}/100
                  </span>
                  <span style={s.scoreLabel}>pontuação</span>
                </div>
              </div>
            </div>

            {/* Details */}
            <div style={s.details}>
              <div style={s.detailRow}>
                <span style={s.detailKey}>NIF</span>
                <span style={s.detailVal}>{worker.nif ?? '—'}</span>
              </div>
              <div style={s.detailRow}>
                <span style={s.detailKey}>IBAN</span>
                <span style={s.detailVal}>{worker.iban ?? '—'}</span>
              </div>
              {worker.skills && worker.skills.length > 0 && (
                <div style={s.detailRow}>
                  <span style={s.detailKey}>Competências</span>
                  <span style={s.detailVal}>{worker.skills.slice(0, 3).join(', ')}{worker.skills.length > 3 ? ` +${worker.skills.length - 3}` : ''}</span>
                </div>
              )}
              {worker.availableDays && worker.availableDays.length > 0 && (
                <div style={s.detailRow}>
                  <span style={s.detailKey}>Disponibilidade</span>
                  <span style={s.detailVal}>{worker.availableDays.join(', ')}</span>
                </div>
              )}
              <div style={s.detailRow}>
                <span style={s.detailKey}>Registado</span>
                <span style={s.detailVal}>{new Date(worker.createdAt).toLocaleDateString('pt-PT')}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={s.actions}>
              <button
                style={{ ...s.approveBtn, opacity: processing === worker.id ? 0.6 : 1 }}
                onClick={() => handleApprove(worker.id)}
                disabled={processing === worker.id}
              >
                {processing === worker.id ? '...' : '✓ Aprovar'}
              </button>
              <button
                style={{ ...s.rejectBtn, opacity: processing === worker.id ? 0.6 : 1 }}
                onClick={() => setRejectTarget(worker.id)}
                disabled={processing === worker.id}
              >
                ✕ Rejeitar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Reject modal */}
      {rejectTarget && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h2 style={s.modalTitle}>Rejeitar Trabalhador</h2>
            <p style={s.modalSub}>Indique o motivo da rejeição (opcional):</p>
            <textarea
              style={s.textarea}
              placeholder="Ex: Documentação incompleta, NIF inválido..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
            />
            <div style={s.modalActions}>
              <button style={s.cancelBtn} onClick={() => { setRejectTarget(null); setRejectReason(''); }}>
                Cancelar
              </button>
              <button style={s.confirmRejectBtn} onClick={handleReject} disabled={!!processing}>
                {processing ? '...' : 'Confirmar Rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '32px',
    maxWidth: 1200,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: 'var(--color-text-primary)',
    letterSpacing: '-0.5px',
    marginBottom: 4,
  },
  sub: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
  },
  refreshBtn: {
    padding: '8px 16px',
    background: 'var(--color-primary-light)',
    border: '1px solid rgba(106,121,255,0.3)',
    borderRadius: 8,
    color: 'var(--color-primary)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  errorBanner: {
    background: 'var(--color-error-light, #fee2e2)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 8,
    padding: '12px 16px',
    fontSize: 13,
    color: 'var(--color-error, #ef4444)',
    marginBottom: 24,
  },
  empty: {
    textAlign: 'center',
    padding: '80px 0',
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 16, color: 'var(--color-text-secondary)', fontWeight: 500 },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 20,
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid var(--color-border, #e5e7eb)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  cardTop: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
  },
  photo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    objectFit: 'cover',
    flexShrink: 0,
    border: '2px solid var(--color-border, #e5e7eb)',
  },
  photoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    background: 'var(--color-primary-light)',
    color: 'var(--color-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    fontWeight: 800,
    flexShrink: 0,
  },
  cardInfo: { flex: 1 },
  workerName: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    marginBottom: 2,
  },
  workerContact: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    marginBottom: 8,
  },
  scoreBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'var(--color-secondary)',
    borderRadius: 20,
    padding: '3px 10px',
    border: '1px solid var(--color-border, #e5e7eb)',
  },
  scoreValue: {
    fontSize: 13,
    fontWeight: 800,
  },
  scoreLabel: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
  },

  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 13,
    borderTop: '1px solid var(--color-border, #e5e7eb)',
    paddingTop: 12,
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailKey: {
    color: 'var(--color-text-secondary)',
    fontWeight: 600,
    flexShrink: 0,
  },
  detailVal: {
    color: 'var(--color-text-primary)',
    textAlign: 'right',
    wordBreak: 'break-all',
  },

  actions: {
    display: 'flex',
    gap: 10,
  },
  approveBtn: {
    flex: 1,
    height: 40,
    background: '#dcfce7',
    border: '1px solid #86efac',
    borderRadius: 8,
    color: '#16a34a',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  rejectBtn: {
    flex: 1,
    height: 40,
    background: '#fee2e2',
    border: '1px solid #fca5a5',
    borderRadius: 8,
    color: '#dc2626',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  // Modal
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  modal: {
    background: '#fff',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--color-text-primary)',
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    marginBottom: 14,
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: 8,
    border: '1.5px solid var(--color-border, #e5e7eb)',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    color: 'var(--color-text-primary)',
    marginBottom: 16,
  },
  modalActions: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '10px 20px',
    background: 'none',
    border: '1.5px solid var(--color-border, #e5e7eb)',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: 'var(--color-text-secondary)',
  },
  confirmRejectBtn: {
    padding: '10px 20px',
    background: '#dc2626',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: '#fff',
  },
};
