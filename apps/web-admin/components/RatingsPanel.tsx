'use client';

/**
 * Reviews tab of "Quem já trabalhou" — worker reputation overview.
 * Was the standalone /dashboard/ratings page (never linked from the sidebar)
 * until 2026-10-11; that URL now redirects to /dashboard/workers?tab=reviews,
 * which is where the rate-the-worker emails land.
 *
 * Shows all workers hired by this employer with their rating summary,
 * badges and no-show count. "Avaliar" appears only while the worker has a
 * job this company hasn't reviewed — one review per job, so working together
 * again means a new review. "Reportar falta" appears only for that worker's
 * started shifts with no check-in. Both lists come from the server per worker
 * (until 2026-10-11 the modals listed every shift of the company, and the
 * server acts on whoever worked the chosen shift).
 *
 * Stint 7: employer rates worker (one-way).
 * Stint 8 TODO: two-way ratings + dispute resolution.
 */

import { useEffect, useState, useCallback } from 'react';
import { adminApi, ApiError, HiredWorker, WorkerJobRef } from '../lib/api';
import { ui } from '../lib/ui';
import { WORKER_RATING_TAGS } from '@turnos/shared';
import { useT } from '../lib/i18n';
import { IconAlert, IconStar, Stars } from './icons';

// ─── Rating Modal ─────────────────────────────────────────────────────────────

interface RatingModalProps {
  worker: HiredWorker;
  onClose: () => void;
  onSuccess: () => void;
}

function RatingModal({ worker, onClose, onSuccess }: RatingModalProps) {
  const { t, fMediumDate, tSkill, tRoleLevel } = useT();
  // This worker's jobs not yet reviewed — already filtered by the server
  const unratedShifts: WorkerJobRef[] = worker.pendingReviews;
  const [selectedShiftId, setSelectedShiftId] = useState(unratedShifts[0]?.shiftId ?? '');
  const [score, setScore]                     = useState(0);
  const [selectedTags, setSelectedTags]       = useState<string[]>([]);
  const [review, setReview]                   = useState('');  // Written review visible to other employers
  // "Did the level match?" — asked only when the worker declared the shift's role
  const [levelMatched, setLevelMatched]       = useState<boolean | null>(null);
  const [submitting, setSubmitting]           = useState(false);
  const [error, setError]                     = useState('');
  const selected = unratedShifts.find(s => s.shiftId === selectedShiftId);
  const askLevel = !!selected?.role && selected.declaredLevel != null;
  const canSubmit = score > 0 && (!askLevel || levelMatched !== null) && !submitting;

  const toggleTag = (key: string) => {
    setSelectedTags(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key],
    );
  };

  const handleSubmit = async () => {
    if (!selectedShiftId || !canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await adminApi.submitRating({
        shiftId: selectedShiftId,
        score,
        tags: selectedTags,
        review: review.trim() || undefined,
        levelMatched: askLevel ? levelMatched ?? undefined : undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.ratings.rateError'));
      setSubmitting(false);
    }
  };

  return (
    <div style={m.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={m.modal}>
        {/* Header */}
        <div style={m.header}>
          <div>
            <p style={m.headerLabel}>{t('admin.ratings.rateTitle')}</p>
            <p style={m.headerName}>{worker.fullName ?? t('admin.ratings.workerFallback')}</p>
          </div>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>

        {unratedShifts.length === 0 ? (
          <div style={m.noShifts}>
            <p style={m.noShiftsIcon}>✓</p>
            <p style={m.noShiftsTitle}>{t('admin.ratings.rateAllDone')}</p>
            <p style={m.noShiftsSub}>{t('admin.ratings.rateAllDoneSub')}</p>
            <button style={m.cancelBtn} onClick={onClose}>{t('common.close')}</button>
          </div>
        ) : (
          <div style={m.body}>
            {/* Shift selector */}
            {unratedShifts.length > 1 && (
              <div style={m.field}>
                <label style={m.label}>{t('admin.ratings.pickShift')}</label>
                <select
                  style={m.select}
                  value={selectedShiftId}
                  onChange={e => { setSelectedShiftId(e.target.value); setLevelMatched(null); }}
                >
                  {unratedShifts.map(s => (
                    <option key={s.shiftId} value={s.shiftId}>
                      {s.title} — {fMediumDate(s.date)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Stars */}
            <div style={m.field}>
              <label style={m.label}>{t('admin.ratings.rateQuestion')}</label>
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
                <p style={m.scoreLabel}>{t(`admin.ratings.scores.${score}`)}</p>
              )}
            </div>

            {/* Level check — turns declared roles into "Confirmado" over time */}
            {askLevel && selected && (
              <div style={m.field}>
                <label style={m.label}>
                  {t('admin.ratings.levelQuestion', { role: tSkill(selected.role!), level: selected.declaredLevel })}
                </label>
                <p style={m.levelDeclared}>{tRoleLevel(selected.role!, selected.declaredLevel!)}</p>
                <div style={m.tagsRow}>
                  {([[true, t('admin.ratings.levelYes')], [false, t('admin.ratings.levelBelow')]] as [boolean, string][]).map(([value, label]) => (
                    <button
                      key={String(value)}
                      type="button"
                      style={{ ...m.tagChip, ...(levelMatched === value ? m.tagChipActive : {}) }}
                      onClick={() => setLevelMatched(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p style={m.levelHint}>{t('admin.ratings.levelHint')}</p>
              </div>
            )}

            {/* Tags */}
            <div style={m.field}>
              <label style={m.label}>{t('admin.ratings.tagsLabel')}</label>
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
                    {t(`domain.ratingTags.${tag.key}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Written review — visible to other employers */}
            <div style={m.field}>
              <label style={m.label}>
                {t('admin.ratings.reviewLabel')} <span style={{ fontWeight: 400, color: '#9ca3af' }}>{t('admin.ratings.reviewHint')}</span>
              </label>
              <textarea
                style={m.textarea}
                rows={3}
                placeholder={t('admin.ratings.reviewPlaceholder')}
                value={review}
                onChange={e => setReview(e.target.value.slice(0, 150))}
              />
              <p style={m.charCount}>{review.length}/150</p>
            </div>

            {error && <p style={m.error}>{error}</p>}

            {/* Actions */}
            <div style={m.actions}>
              <button style={m.cancelBtn} onClick={onClose} disabled={submitting}>
                {t('common.cancel')}
              </button>
              <button
                style={{ ...m.submitBtn, ...(!canSubmit ? m.submitBtnDisabled : {}) }}
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {submitting ? t('admin.ratings.rateSubmitting') : t('admin.ratings.rateSubmit')}
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
  onClose: () => void;
  onSuccess: () => void;
}

function NoShowModal({ worker, onClose, onSuccess }: NoShowModalProps) {
  const { t, fShortDate } = useT();
  // This worker's started shifts with no check-in — from the server
  const filledShifts: WorkerJobRef[] = worker.noShowShifts;
  const [selectedShiftId, setSelectedShiftId] = useState(filledShifts[0]?.shiftId ?? '');
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
      setError(err instanceof ApiError ? err.message : t('admin.ratings.noShowError'));
      setSubmitting(false);
    }
  };

  return (
    <div style={m.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...m.modal, maxWidth: 440 }}>
        <div style={m.header}>
          <div>
            <p style={m.headerLabel}>{t('admin.ratings.noShowTitle')}</p>
            <p style={m.headerName}>{worker.fullName ?? t('admin.ratings.workerFallback')}</p>
          </div>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={m.body}>
          {filledShifts.length === 0 ? (
            <>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
                {t('admin.ratings.noShowNoShifts')}
              </p>
              <button style={m.cancelBtn} onClick={onClose}>{t('common.close')}</button>
            </>
          ) : (
            <>
              {filledShifts.length > 1 && (
                <div style={m.field}>
                  <label style={m.label}>{t('admin.ratings.pickShift')}</label>
                  <select
                    style={m.select}
                    value={selectedShiftId}
                    onChange={e => setSelectedShiftId(e.target.value)}
                  >
                    {filledShifts.map(s => (
                      <option key={s.shiftId} value={s.shiftId}>
                        {s.title} — {fShortDate(s.date)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div style={m.field}>
                <label style={m.label}>{t('admin.ratings.noShowNoteLabel')}</label>
                <textarea
                  style={m.textarea}
                  rows={2}
                  placeholder={t('admin.ratings.noShowPlaceholder')}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>
              {error && <p style={m.error}>{error}</p>}
              <div style={m.actions}>
                <button style={m.cancelBtn} onClick={onClose} disabled={submitting}>{t('common.cancel')}</button>
                <button
                  style={{ ...m.submitBtn, background: '#dc2626', ...(submitting ? m.submitBtnDisabled : {}) }}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? t('admin.ratings.noShowSubmitting') : t('admin.ratings.noShowSubmit')}
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

export function RatingsPanel() {
  const { t } = useT();
  const [workers, setWorkers]       = useState<HiredWorker[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [ratingTarget, setRatingTarget]   = useState<HiredWorker | null>(null);
  const [noShowTarget, setNoShowTarget]   = useState<HiredWorker | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setWorkers(await adminApi.getMyWorkers());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.ratings.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = workers.filter(w =>
    !search || (w.fullName ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={s.page}>
      {/* Toolbar */}
      <div style={s.header}>
        <p style={s.sub}>{t('admin.ratings.sub')}</p>
        <div style={s.headerRight}>
          <input
            style={s.searchInput}
            placeholder={t('admin.ratings.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button style={s.refreshBtn} onClick={load} disabled={isLoading}>{t('admin.ratings.refresh')}</button>
        </div>
      </div>

      {error && <div style={s.errorBanner}><IconAlert size={15} /> {error}</div>}

      {/* Empty state */}
      {!isLoading && workers.length === 0 && !error && (
        <div style={s.empty}>
          <div style={s.emptyIcon}><IconStar size={44} /></div>
          <p style={s.emptyTitle}>{t('admin.ratings.emptyTitle')}</p>
          <p style={s.emptySub}>{t('admin.ratings.emptySub')}</p>
          <button style={s.emptyBtn} onClick={() => { window.location.href = '/dashboard/shifts'; }}>
            {t('admin.ratings.emptyCta')}
          </button>
        </div>
      )}

      {/* Worker cards grid */}
      <div style={s.grid}>
        {filtered.map(worker => {
          const avgR = worker.avgRating != null ? Number(worker.avgRating) : null;
          // Colour only when there is something to notice
          const noShowColor = worker.noShowCount > 0 ? '#b91c1c' : 'var(--color-text-primary)';

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
                  <p style={s.workerName}>{worker.fullName ?? t('admin.ratings.noName')}</p>

                  {/* Stars + avg */}
                  <div style={s.starsRow}>
                    <span style={s.stars}>
                      <Stars value={avgR ?? 0} size={14} />
                    </span>
                    <span style={s.avgVal}>
                      {avgR != null ? avgR.toFixed(1) : '—'}
                    </span>
                    <span style={s.totalRatings}>{t('admin.ratings.totalRatings', { count: worker.totalRatings })}</span>
                  </div>

                  {/* Badges */}
                  {worker.badges && worker.badges.length > 0 && (
                    <div style={s.badgeRow}>
                      {worker.badges.includes('TOP_RATED') && (
                        <span style={s.badge}>{t('admin.workersSearch.badgeTop')}</span>
                      )}
                      {worker.badges.includes('RELIABLE') && (
                        <span style={s.badge}>{t('admin.workersSearch.badgeReliable')}</span>
                      )}
                      {worker.badges.includes('VERIFIED') && (
                        <span style={s.badge}>
                          {t('admin.workersSearch.badgeVerified')}
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
                  <span style={s.statLabel}>{t('admin.ratings.statShifts')}</span>
                </div>
                <div style={s.statDivider} />
                <div style={s.stat}>
                  <span style={{ ...s.statValue, color: noShowColor }}>{worker.noShowCount}</span>
                  <span style={s.statLabel}>
                    {worker.noShowCount === 1
                      ? t('admin.ratings.statNoShowOne')
                      : t('admin.ratings.statNoShowOther')}
                  </span>
                </div>
                <div style={s.statDivider} />
                <div style={s.stat}>
                  <span style={s.statValue}>{worker.profileQualityScore}%</span>
                  <span style={s.statLabel}>{t('admin.ratings.statProfile')}</span>
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
                {worker.pendingReviews.length > 0 ? (
                  <button style={s.rateBtn} onClick={() => setRatingTarget(worker)}>
                    {worker.pendingReviews.length > 1
                      ? t('admin.ratings.rateBtnCount', { count: worker.pendingReviews.length })
                      : t('admin.ratings.rateBtn')}
                  </button>
                ) : (
                  <span style={s.reviewedNote}>{t('admin.ratings.allReviewed')}</span>
                )}
                {worker.noShowShifts.length > 0 && (
                  <button style={s.noShowBtn} onClick={() => setNoShowTarget(worker)}>
                    {t('admin.ratings.noShowBtn')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {ratingTarget && (
        <RatingModal
          worker={ratingTarget}
          onClose={() => setRatingTarget(null)}
          onSuccess={() => { setRatingTarget(null); load(); }}
        />
      )}
      {noShowTarget && (
        <NoShowModal
          worker={noShowTarget}
          onClose={() => setNoShowTarget(null)}
          onSuccess={() => { setNoShowTarget(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {},
  header: {
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    marginBottom: 32, gap: 16, flexWrap: 'wrap',
  },
  sub: { fontSize: 13.5, color: 'var(--color-text-secondary)' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  searchInput: {
    padding: '8px 14px', border: '1px solid var(--color-border)',
    borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
    background: '#fff', color: 'var(--color-text-primary)', outline: 'none', width: 220,
  },
  refreshBtn: ui.btnLg,
  errorBanner: {
    background: '#fee2e2', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8,
    padding: '12px 16px', fontSize: 13, color: '#ef4444', marginBottom: 24,
  },
  empty: { textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  emptyIcon: { display: 'flex', justifyContent: 'center', color: 'var(--color-text-muted, #9ca3af)' },
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
  badge: { ...ui.pill, fontSize: 10, padding: '2px 8px' },
  statsRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-around',
    background: 'var(--color-secondary)', borderRadius: 8, padding: '10px 0',
  },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  statValue: { fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)' },
  statLabel: { fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 28, background: 'var(--color-border)' },
  completionBar: { height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  completionFill: { height: '100%', borderRadius: 3, background: 'var(--color-primary)' },
  actions: { display: 'flex', gap: 8 },
  // "Avaliar" is the card's call to action while a review is owed — the one
  // place the brand colour is used here
  rateBtn: { ...ui.btnLg, flex: 1, color: 'var(--color-primary)', borderColor: 'rgba(106,121,255,0.45)' },
  noShowBtn: { ...ui.btnLg, ...ui.danger, flex: 1 },
  reviewedNote: {
    flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '8px 0', fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)',
  },
};

// ─── Modal Styles ─────────────────────────────────────────────────────────────

const m: Record<string, React.CSSProperties> = {
  levelDeclared: { fontSize: 12.5, color: '#374151', background: '#f5f6ff', borderRadius: 8, padding: '8px 10px', margin: 0, lineHeight: 1.45 },
  levelHint: { fontSize: 11.5, color: '#6b7280', margin: 0, lineHeight: 1.45 },
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
