'use client';

/**
 * What other companies wrote about a worker.
 *
 * The API has returned this since Stint 7 and nothing rendered it — the
 * employer side showed only a star average and a count, which tells you a
 * worker is good but never *why*. This is the part an employer actually reads
 * before picking someone for a shift.
 *
 * Self-fetching on purpose: it drops into any worker panel with just an id,
 * and a slow ratings call never delays the profile around it.
 */
import { useState, useEffect } from 'react';
import { adminApi, RatingRecord } from '../lib/api';
import { useT } from '../lib/i18n';

export function WorkerReviews({ workerId }: { workerId: string }) {
  const { t, fShortDate } = useT();
  const [reviews, setReviews] = useState<RatingRecord[] | null>(null);
  const [failed, setFailed]   = useState(false);

  useEffect(() => {
    let live = true;
    adminApi.getWorkerRatingSummary(workerId)
      .then(s => { if (live) setReviews(s.recentRatings ?? []); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [workerId]);

  // Nothing to say yet, or the call failed — stay out of the way rather than
  // showing an error box next to a profile the employer is trying to read.
  if (failed) return null;
  if (reviews === null) {
    return (
      <div style={s.section}>
        <div style={s.title}>{t('admin.reviews.title')}</div>
        <div style={s.muted}>{t('common.loading')}</div>
      </div>
    );
  }

  // Only reviews with text are worth the space — a bare star with no words adds
  // nothing the average above hasn't already said.
  const written = reviews.filter(r => r.review && r.review.trim() !== '');
  if (written.length === 0) {
    return (
      <div style={s.section}>
        <div style={s.title}>{t('admin.reviews.title')}</div>
        <div style={s.muted}>{t('admin.reviews.empty')}</div>
      </div>
    );
  }

  return (
    <div style={s.section}>
      <div style={s.title}>{t('admin.reviews.title')}</div>
      <div style={s.list}>
        {written.map((r, i) => (
          <div key={`${r.createdAt}-${i}`} style={s.card}>
            <div style={s.head}>
              <span style={s.stars}>
                {'★'.repeat(r.score)}
                <span style={s.starsDim}>{'★'.repeat(5 - r.score)}</span>
              </span>
              <span style={s.date}>{fShortDate(r.createdAt)}</span>
            </div>
            <p style={s.text}>&ldquo;{r.review}&rdquo;</p>
            <div style={s.author}>— {r.raterName}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  section: { marginTop: 20 },
  title: {
    fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)',
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10,
  },
  muted: { fontSize: 13, color: 'var(--color-text-secondary)' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    background: '#fff', border: '1px solid #eef0f4', borderRadius: 10,
    padding: '12px 14px',
  },
  head: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6,
  },
  stars: { color: '#f59e0b', fontSize: 14, letterSpacing: 1 },
  starsDim: { color: '#e5e7eb' },
  date: { fontSize: 12, color: 'var(--color-text-secondary)' },
  text: {
    fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-primary)', margin: 0,
  },
  author: {
    fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: 6,
  },
};
