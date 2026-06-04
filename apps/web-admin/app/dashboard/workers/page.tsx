'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, ApiError, HiredWorker } from '../../../lib/api';

const WEEK_DAYS_PT: Record<string, string> = {
  Seg: 'Seg', Ter: 'Ter', Qua: 'Qua', Qui: 'Qui', Sex: 'Sex', Sáb: 'Sáb', Dom: 'Dom',
};

export default function WorkersPage() {
  const router = useRouter();
  const [workers, setWorkers]   = useState<HiredWorker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      setWorkers(await adminApi.getMyWorkers());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar trabalhadores.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <button style={s.backBtn} onClick={() => router.push('/dashboard')}>← Dashboard</button>
          <h1 style={s.title}>Os Meus Trabalhadores</h1>
          <p style={s.sub}>
            {isLoading
              ? 'A carregar...'
              : workers.length === 0
                ? 'Nenhum trabalhador contratado ainda'
                : `${workers.length} trabalhador${workers.length !== 1 ? 'es' : ''} contratado${workers.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button style={s.refreshBtn} onClick={load} disabled={isLoading}>↻ Atualizar</button>
      </div>

      {error && <div style={s.errorBanner}>⚠️ {error}</div>}

      {/* Empty state */}
      {!isLoading && workers.length === 0 && !error && (
        <div style={s.empty}>
          <div style={s.emptyIcon}>👷</div>
          <p style={s.emptyTitle}>Ainda não contratou nenhum trabalhador</p>
          <p style={s.emptySub}>
            Os trabalhadores aprovados nos seus turnos aparecerão aqui.
          </p>
          <button style={s.emptyBtn} onClick={() => router.push('/dashboard/shifts')}>
            Ver os meus turnos →
          </button>
        </div>
      )}

      {/* Worker cards */}
      <div style={s.grid}>
        {workers.map(worker => {
          const score = worker.profileQualityScore;
          const scoreColor = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
          return (
            <div key={worker.id} style={s.card}>
              {/* Top: photo + name */}
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
                  <div style={s.ratingRow}>
                    <span style={s.ratingStars}>
                      {(() => { const r = Math.round(Number(worker.avgRating ?? 0)); return '★'.repeat(r) + '☆'.repeat(5 - r); })()}
                    </span>
                    <span style={s.ratingVal}>
                      {worker.avgRating != null ? Number(worker.avgRating).toFixed(1) : '—'}
                    </span>
                    <span style={s.ratingCount}>· {worker.totalRatings} aval.</span>
                  </div>
                  {worker.badges && worker.badges.length > 0 && (
                    <div style={s.badgeRow}>
                      {worker.badges.includes('TOP_RATED') && <span style={s.badge}>🏆 Top</span>}
                      {worker.badges.includes('RELIABLE')  && <span style={s.badge}>✅ Fiável</span>}
                      {worker.badges.includes('VERIFIED')  && <span style={s.badge}>✔️ Verif.</span>}
                    </div>
                  )}
                  <div style={s.scoreBadge}>
                    <span style={{ ...s.scoreValue, color: scoreColor }}>{score}/100</span>
                    <span style={s.scoreLabel}>perfil completo</span>
                  </div>
                  <p style={s.shiftCount}>
                    {worker.shiftsWorked} turno{worker.shiftsWorked !== 1 ? 's' : ''} realizados
                    {worker.lastShiftDate ? ` · último ${new Date(worker.lastShiftDate).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}` : ''}
                  </p>
                  {worker.noShowCount > 0 && (
                    <p style={{ ...s.noShow, color: worker.noShowCount >= 3 ? '#dc2626' : '#d97706' }}>
                      ⚠ {worker.noShowCount} falta{worker.noShowCount !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Score bar */}
              <div style={s.scoreBar}>
                <div style={{ ...s.scoreBarFill, width: `${score}%`, background: scoreColor }} />
              </div>

              {/* Skills */}
              {worker.skills && worker.skills.length > 0 && (
                <div style={s.detailSection}>
                  <p style={s.detailLabel}>Competências</p>
                  <div style={s.tagRow}>
                    {worker.skills.map(sk => (
                      <span key={sk} style={s.tag}>{sk}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Available days */}
              {worker.availableDays && worker.availableDays.length > 0 && (
                <div style={s.detailSection}>
                  <p style={s.detailLabel}>Disponibilidade</p>
                  <div style={s.tagRow}>
                    {worker.availableDays.map(d => (
                      <span key={d} style={{ ...s.tag, background: '#dbeafe', color: '#1d4ed8' }}>
                        {WEEK_DAYS_PT[d] ?? d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: 32, maxWidth: 1200, margin: '0 auto' },
  header: {
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32,
  },
  backBtn: {
    display: 'block', background: 'none', border: 'none', padding: 0,
    fontSize: 13, color: 'var(--color-text-secondary)', cursor: 'pointer',
    fontFamily: 'inherit', marginBottom: 6,
  },
  title: { fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px', marginBottom: 4 },
  sub: { fontSize: 14, color: 'var(--color-text-secondary)' },
  refreshBtn: {
    padding: '8px 16px', background: 'var(--color-primary-light)', border: '1px solid rgba(106,121,255,0.3)',
    borderRadius: 8, color: 'var(--color-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  errorBanner: {
    background: '#fee2e2', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8,
    padding: '12px 16px', fontSize: 13, color: '#ef4444', marginBottom: 24,
  },
  empty: { textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' },
  emptySub: { fontSize: 14, color: 'var(--color-text-secondary)', maxWidth: 360 },
  emptyBtn: {
    marginTop: 8, padding: '10px 24px',
    background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
    color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 },
  card: {
    background: '#fff', borderRadius: 12, border: '1px solid var(--color-border)',
    padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  cardTop: { display: 'flex', gap: 14, alignItems: 'flex-start' },
  photo: { width: 56, height: 56, borderRadius: 28, objectFit: 'cover', flexShrink: 0 },
  photoPlaceholder: {
    width: 56, height: 56, borderRadius: 28, background: 'var(--color-primary-light)',
    color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 800, flexShrink: 0,
  },
  cardInfo: { flex: 1 },
  workerName: { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 },
  scoreBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: 'var(--color-secondary)', borderRadius: 20,
    padding: '2px 8px', border: '1px solid var(--color-border)', marginBottom: 4,
  },
  scoreValue: { fontSize: 13, fontWeight: 800 },
  scoreLabel: { fontSize: 11, color: 'var(--color-text-secondary)' },
  shiftCount: { fontSize: 12, color: 'var(--color-text-secondary)' },
  ratingRow: { display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 },
  ratingStars: { fontSize: 13, color: '#fbbf24', letterSpacing: '-1px' },
  ratingVal: { fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' },
  ratingCount: { fontSize: 12, color: 'var(--color-text-secondary)' },
  badgeRow: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  badge: {
    fontSize: 10, fontWeight: 700, padding: '2px 6px',
    background: '#fef9c3', color: '#92400e',
    borderRadius: 10, border: '1px solid #fde68a',
  },
  noShow: { fontSize: 11, fontWeight: 600 },
  scoreBar: { height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 3 },
  detailSection: { display: 'flex', flexDirection: 'column', gap: 6 },
  detailLabel: { fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 5 },
  tag: {
    padding: '3px 9px', background: 'var(--color-primary-light)', borderRadius: 20,
    fontSize: 11, fontWeight: 600, color: 'var(--color-primary)',
    border: '1px solid rgba(106,121,255,0.2)',
  },
};
