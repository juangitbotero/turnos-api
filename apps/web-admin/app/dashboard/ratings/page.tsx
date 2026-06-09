'use client';

/**
 * /dashboard/ratings — Worker Reputation Overview
 *
 * Shows all workers hired by this employer with their rating summary,
 * badges, no-show count, and an inline rating modal for completed shifts.
 *
 * Stint 7: employer rates worker (one-way).
 * Stint 8 TODO: two-way ratings + dispute resolution.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, ApiError, HiredWorker, Shift } from '../../../lib/api';
import { WORKER_RATING_TAGS } from '@turnos/shared';

// ─── Rating Modal ─────────────────────────────────────────────────────────────

interface RatingModalProps {
  worker: HiredWorker;
  shifts: Shift[];
  onClose: () => void;
  onSuccess: () => void;
}

function RatingModal({ worker, shifts, onClose, onSuccess }: RatingModalProps) {
  // Only COMPLETED shifts that haven't been rated yet
  const [unratedShifts, setUnratedShifts] = useState<Shift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [score, setScore]                     = useState(0);
  const [selectedTags, setSelectedTags]       = useState<string[]>([]);
  const [review, setReview]                   = useState('');  // Written review visible to other employers
  const [submitting, setSubmitting]           = useState(false);
  const [error, setError]                     = useState('');
  const [loadingShifts, setLoadingShifts]     = useState(true);

  // Filter to completed shifts for this worker and check which are unrated
  useEffect(() => {
    const completedWithWorker = shifts.filter(s => s.status === 'COMPLETED');
    if (completedWithWorker.length === 0) {
      setUnratedShifts([]);
      setLoadingShifts(false);
      return;
    }
    Promise.allSettled(
      completedWithWorker.map(s =>
        adminApi.hasRatedShift(s.id).then(r => ({ shift: s, hasRated: r.hasRated })),
      ),
    ).then(results => {
      const unrated = results
        .filter(r => r.status === 'fulfilled' && !r.value.hasRated)
        .map(r => (r as PromiseFulfilledResult<{ shift: Shift; hasRated: boolean }>).value.shift);
      setUnratedShifts(unrated);
      if (unrated.length > 0) setSelectedShiftId(unrated[0]!.id);
    }).finally(() => setLoadingShifts(false));
  }, [shifts]);

  const toggleTag = (key: string) => {
    setSelectedTags(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key],
    );
  };

  const handleSubmit = async () => {
    if (!selectedShiftId || score === 0) return;
    setSubmitting(true);
    setError('');
    try {
      await adminApi.submitRating({
        shiftId: selectedShiftId,
        score,
        tags: selectedTags,
        review: review.trim() || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao enviar avaliação.');
      setSubmitting(false);
    }
  };

  return (
    <div style={m.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={m.modal}>
        {/* Header */}
        <div style={m.header}>
          <div>
            <p style={m.headerLabel}>Avaliar trabalhador</p>
            <p style={m.headerName}>{worker.fullName ?? 'Trabalhador'}</p>
          </div>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loadingShifts ? (
          <p style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            A carregar turnos...
          </p>
        ) : unratedShifts.length === 0 ? (
          <div style={m.noShifts}>
            <p style={m.noShiftsIcon}>✓</p>
            <p style={m.noShiftsTitle}>Todos os turnos já foram avaliados</p>
            <p style={m.noShiftsSub}>Não há turnos concluídos pendentes de avaliação com este trabalhador.</p>
            <button style={m.cancelBtn} onClick={onClose}>Fechar</button>
          </div>
        ) : (
          <div style={m.body}>
            {/* Shift selector */}
            {unratedShifts.length > 1 && (
              <div style={m.field}>
                <label style={m.label}>Seleciona o turno</label>
                <select
                  style={m.select}
                  value={selectedShiftId}
                  onChange={e => setSelectedShiftId(e.target.value)}
                >
                  {unratedShifts.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} — {new Date(s.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Stars */}
            <div style={m.field}>
              <label style={m.label}>Como foi o desempenho?</label>
              <div style={m.starsRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    style={{ ...m.star, color: n <= score ? '#fbbf24' : '#d1d5db' }}
                    onClick={() => setScore(n)}
                  >
                    ★
                  </button>
                ))}
              </div>
              {score > 0 && (
                <p style={m.scoreLabel}>
                  {['', 'Mau 😞', 'Razoável 😐', 'Bom 😊', 'Muito bom 😄', 'Excelente 🤩'][score]}
                </p>
              )}
            </div>

            {/* Tags */}
            <div style={m.field}>
              <label style={m.label}>O que destacas? (opcional)</label>
              <div style={m.tagsRow}>
                {WORKER_RATING_TAGS.map(tag => (
                  <button
                    key={tag.key}
                    style={{
                      ...m.tagChip,
                      ...(selectedTags.includes(tag.key) ? m.tagChipActive : {}),
                    }}
                    onClick={() => toggleTag(tag.key)}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Written review — visible to other employers */}
            <div style={m.field}>
              <label style={m.label}>
                Avaliação escrita <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional · visível a outros empregadores)</span>
              </label>
              <textarea
                style={m.textarea}
                rows={3}
                placeholder="Ex: Muito pontual e profissional. Recomendo para turnos de eventos..."
                value={review}
                onChange={e => setReview(e.target.value.slice(0, 150))}
              />
              <p style={m.charCount}>{review.length}/150</p>
            </div>

            {error && <p style={m.error}>{error}</p>}

            {/* Actions */}
            <div style={m.actions}>
              <button style={m.cancelBtn} onClick={onClose} disabled={submitting}>
                Cancelar
              </button>
              <button
                style={{ ...m.submitBtn, ...(score === 0 || submitting ? m.submitBtnDisabled : {}) }}
                onClick={handleSubmit}
                disabled={score === 0 || submitting}
              >
                {submitting ? 'A enviar...' : 'Enviar avaliação'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── No-show Modal ────────────────────────────────────────────────────────────

interface NoShowModalProps {
  worker: HiredWorker;
  shifts: Shift[];
  onClose: () => void;
  onSuccess: () => void;
}

function NoShowModal({ worker, shifts, onClose, onSuccess }: NoShowModalProps) {
  const filledShifts = shifts.filter(s =>
    ['FILLED', 'ACTIVE', 'OPEN'].includes(s.status),
  );
  const [selectedShiftId, setSelectedShiftId] = useState(filledShifts[0]?.id ?? '');
  const [note, setNote]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async () => {
    if (!selectedShiftId) return;
    setSubmitting(true);
    setError('');
    try {
      await adminApi.reportNoShow(selectedShiftId, note.trim() || undefined);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao reportar falta.');
      setSubmitting(false);
    }
  };

  return (
    <div style={m.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...m.modal, maxWidth: 440 }}>
        <div style={m.header}>
          <div>
            <p style={m.headerLabel}>Reportar falta</p>
            <p style={m.headerName}>{worker.fullName ?? 'Trabalhador'}</p>
          </div>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={m.body}>
          {filledShifts.length === 0 ? (
            <>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
                Não há turnos confirmados associados a este trabalhador para reportar falta.
              </p>
              <button style={m.cancelBtn} onClick={onClose}>Fechar</button>
            </>
          ) : (
            <>
              {filledShifts.length > 1 && (
                <div style={m.field}>
                  <label style={m.label}>Seleciona o turno</label>
                  <select
                    style={m.select}
                    value={selectedShiftId}
                    onChange={e => setSelectedShiftId(e.target.value)}
                  >
                    {filledShifts.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.title} — {new Date(s.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div style={m.field}>
                <label style={m.label}>Nota (opcional)</label>
                <textarea
                  style={m.textarea}
                  rows={2}
                  placeholder="Descreve o que aconteceu..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>
              {error && <p style={m.error}>{error}</p>}
              <div style={m.actions}>
                <button style={m.cancelBtn} onClick={onClose} disabled={submitting}>Cancelar</button>
                <button
                  style={{ ...m.submitBtn, background: '#dc2626', ...(submitting ? m.submitBtnDisabled : {}) }}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'A reportar...' : 'Reportar falta'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RatingsPage() {
  const router = useRouter();
  const [workers, setWorkers]       = useState<HiredWorker[]>([]);
  const [shifts, setShifts]         = useState<Shift[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [ratingTarget, setRatingTarget]   = useState<HiredWorker | null>(null);
  const [noShowTarget, setNoShowTarget]   = useState<HiredWorker | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [w, s] = await Promise.all([
        adminApi.getMyWorkers(),
        adminApi.getMyShifts(),
      ]);
      setWorkers(w);
      setShifts(s);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar dados.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = workers.filter(w =>
    !search || (w.fullName ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  /** Returns COMPLETED shifts that were assigned to the given worker.
   *  We approximate by matching shifts where status === COMPLETED (employer only
   *  has their own shifts). Fine for this page's purpose. */
  const shiftsForWorker = (worker: HiredWorker): Shift[] =>
    shifts.filter(s => s.status === 'COMPLETED');

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <button style={s.backBtn} onClick={() => router.push('/dashboard')}>← Dashboard</button>
          <h1 style={s.title}>Reputação</h1>
          <p style={s.sub}>Avaliações e histórico de desempenho dos trabalhadores</p>
        </div>
        <div style={s.headerRight}>
          <input
            style={s.searchInput}
            placeholder="Pesquisar trabalhador..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button style={s.refreshBtn} onClick={load} disabled={isLoading}>↻ Atualizar</button>
        </div>
      </div>

      {error && <div style={s.errorBanner}>⚠️ {error}</div>}

      {/* Empty state */}
      {!isLoading && workers.length === 0 && !error && (
        <div style={s.empty}>
          <div style={s.emptyIcon}>⭐</div>
          <p style={s.emptyTitle}>Ainda sem avaliações</p>
          <p style={s.emptySub}>
            As avaliações aparecem aqui após a conclusão dos turnos com trabalhadores contratados.
          </p>
          <button style={s.emptyBtn} onClick={() => router.push('/dashboard/shifts')}>
            Ver os meus turnos →
          </button>
        </div>
      )}

      {/* Worker cards grid */}
      <div style={s.grid}>
        {filtered.map(worker => {
          const avgR = worker.avgRating != null ? Number(worker.avgRating) : null;
          const noShowColor = worker.noShowCount === 0 ? '#16a34a' : worker.noShowCount >= 3 ? '#dc2626' : '#d97706';

          return (
            <div key={worker.id} style={s.card}>
              {/* Card header */}
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

                  {/* Stars + avg */}
                  <div style={s.starsRow}>
                    <span style={s.stars}>
                      {'★'.repeat(Math.round(avgR ?? 0))}{'☆'.repeat(5 - Math.round(avgR ?? 0))}
                    </span>
                    <span style={s.avgVal}>
                      {avgR != null ? avgR.toFixed(1) : '—'}
                    </span>
                    <span style={s.totalRatings}>· {worker.totalRatings} aval.</span>
                  </div>

                  {/* Badges */}
                  {worker.badges && worker.badges.length > 0 && (
                    <div style={s.badgeRow}>
                      {worker.badges.includes('TOP_RATED') && (
                        <span style={s.badge}>🏆 Top Rated</span>
                      )}
                      {worker.badges.includes('RELIABLE') && (
                        <span style={s.badge}>✅ Fiável</span>
                      )}
                      {worker.badges.includes('VERIFIED') && (
                        <span style={{ ...s.badge, background: '#dbeafe', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
                          ✔️ Verificado
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div style={s.statsRow}>
                <div style={s.stat}>
                  <span style={s.statValue}>{worker.shiftsWorked}</span>
                  <span style={s.statLabel}>turnos</span>
                </div>
                <div style={s.statDivider} />
                <div style={s.stat}>
                  <span style={{ ...s.statValue, color: noShowColor }}>{worker.noShowCount}</span>
                  <span style={s.statLabel}>falta{worker.noShowCount !== 1 ? 's' : ''}</span>
                </div>
                <div style={s.statDivider} />
                <div style={s.stat}>
                  <span style={s.statValue}>{worker.profileQualityScore}%</span>
                  <span style={s.statLabel}>perfil</span>
                </div>
              </div>

              {/* Completion bar */}
              <div style={s.completionBar}>
                <div
                  style={{
                    ...s.completionFill,
                    width: `${worker.shiftsWorked > 0 ? Math.min(100, 100 - worker.noShowCount * 10) : 0}%`,
                  }}
                />
              </div>

              {/* Action buttons */}
              <div style={s.actions}>
                <button
                  style={s.rateBtn}
                  onClick={() => setRatingTarget(worker)}
                >
                  ⭐ Avaliar
                </button>
                <button
                  style={s.noShowBtn}
                  onClick={() => setNoShowTarget(worker)}
                >
                  ⚠ Reportar falta
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {ratingTarget && (
        <RatingModal
          worker={ratingTarget}
          shifts={shiftsForWorker(ratingTarget)}
          onClose={() => setRatingTarget(null)}
          onSuccess={() => { setRatingTarget(null); load(); }}
        />
      )}
      {noShowTarget && (
        <NoShowModal
          worker={noShowTarget}
          shifts={shiftsForWorker(noShowTarget)}
          onClose={() => setNoShowTarget(null)}
          onSuccess={() => { setNoShowTarget(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: 32, maxWidth: 1200, margin: '0 auto' },
  header: {
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    marginBottom: 32, gap: 16, flexWrap: 'wrap',
  },
  backBtn: {
    display: 'block', background: 'none', border: 'none', padding: 0,
    fontSize: 13, color: 'var(--color-text-secondary)', cursor: 'pointer',
    fontFamily: 'inherit', marginBottom: 6,
  },
  title: { fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px', marginBottom: 4 },
  sub: { fontSize: 14, color: 'var(--color-text-secondary)' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  searchInput: {
    padding: '8px 14px', border: '1px solid var(--color-border)',
    borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
    background: '#fff', color: 'var(--color-text-primary)', outline: 'none', width: 220,
  },
  refreshBtn: {
    padding: '8px 16px', background: 'var(--color-primary-light)', border: '1px solid rgba(106,121,255,0.3)',
    borderRadius: 8, color: 'var(--color-primary)', fontWeight: 600, fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit',
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
  photo: { width: 52, height: 52, borderRadius: 26, objectFit: 'cover', flexShrink: 0 },
  photoPlaceholder: {
    width: 52, height: 52, borderRadius: 26, background: 'var(--color-primary-light)',
    color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 800, flexShrink: 0,
  },
  cardInfo: { flex: 1 },
  workerName: { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 },
  starsRow: { display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 },
  stars: { fontSize: 14, color: '#fbbf24', letterSpacing: '-1px' },
  avgVal: { fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' },
  totalRatings: { fontSize: 12, color: 'var(--color-text-secondary)' },
  badgeRow: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  badge: {
    fontSize: 10, fontWeight: 700, padding: '2px 7px',
    background: '#fef9c3', color: '#92400e',
    borderRadius: 10, border: '1px solid #fde68a',
  },
  statsRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-around',
    background: 'var(--color-secondary)', borderRadius: 8, padding: '10px 0',
  },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  statValue: { fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)' },
  statLabel: { fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 28, background: 'var(--color-border)' },
  completionBar: { height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  completionFill: { height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #16a34a, #4ade80)' },
  actions: { display: 'flex', gap: 8 },
  rateBtn: {
    flex: 1, padding: '8px 0', background: 'var(--color-primary-light)',
    border: '1px solid rgba(106,121,255,0.3)', borderRadius: 8,
    color: 'var(--color-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  noShowBtn: {
    flex: 1, padding: '8px 0', background: '#fff5f5',
    border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8,
    color: '#dc2626', fontWeight: 700, fontSize: 13, cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

// ─── Modal Styles ─────────────────────────────────────────────────────────────

const m: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 20,
  },
  modal: {
    background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520,
    maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '20px 24px 16px', borderBottom: '1px solid var(--color-border)',
  },
  headerLabel: { fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 },
  headerName: { fontSize: 17, fontWeight: 800, color: 'var(--color-text-primary)' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18,
    color: 'var(--color-text-secondary)', cursor: 'pointer',
    padding: '0 0 0 12px', fontFamily: 'inherit',
  },
  body: { padding: 24, display: 'flex', flexDirection: 'column', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' },
  select: {
    padding: '8px 12px', border: '1px solid var(--color-border)',
    borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
    background: '#fff', color: 'var(--color-text-primary)', outline: 'none',
  },
  starsRow: { display: 'flex', gap: 4 },
  star: {
    fontSize: 36, background: 'none', border: 'none', cursor: 'pointer',
    padding: '0 2px', lineHeight: 1, fontFamily: 'inherit',
  },
  scoreLabel: { fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: 2 },
  tagsRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
    background: 'var(--color-secondary)', border: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
  },
  tagChipActive: {
    background: 'var(--color-primary)', borderColor: 'var(--color-primary)',
    color: '#fff',
  },
  textarea: {
    padding: '10px 12px', border: '1px solid var(--color-border)',
    borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
    color: 'var(--color-text-primary)', resize: 'vertical', outline: 'none',
  },
  charCount: { fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'right' },
  error: { fontSize: 13, color: '#dc2626' },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancelBtn: {
    padding: '10px 20px', background: 'var(--color-secondary)',
    border: '1px solid var(--color-border)', borderRadius: 8,
    fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  submitBtn: {
    padding: '10px 24px', background: 'var(--color-primary)',
    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
    color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
  },
  submitBtnDisabled: { background: '#d1d5db', cursor: 'not-allowed' },
  noShifts: {
    padding: 32, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 10, textAlign: 'center',
  },
  noShiftsIcon: { fontSize: 40, color: '#16a34a' },
  noShiftsTitle: { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' },
  noShiftsSub: { fontSize: 13, color: 'var(--color-text-secondary)', maxWidth: 300 },
};
