'use client';

/**
 * Applicants for one shift — the list a company chooses from, and the profile
 * panel behind "Ver perfil". Used by the applicants modal on the shifts page
 * and by the Candidates page, so both rank and show people the same way.
 *
 * Two sorts only (2026-10-11): Best rated and Best match. "Most complete
 * profile" and "Oldest first" were dropped — every applicant already cleared
 * the 80-point profile gate, and application order says nothing about fit.
 * Best match uses skillMatch() from shared and always shows WHY.
 */
import { useState } from 'react';
import { skillMatch } from '@turnos/shared';
import { Application, Shift } from '../lib/api';
import { useT } from '../lib/i18n';
import { WorkerReviews } from './WorkerReviews';
import { IconArrowLeft, IconBriefcase, IconChat, IconFile, IconTarget, Stars } from './icons';

export type SortMode = 'rating' | 'match';

type App = Application & { isNew?: boolean };

/** Best rated: average, then number of ratings (5★ from 1 rating < 4.9★ from 30), then completed shifts. */
function byRating(a: App, b: App): number {
  const ra = Number(a.worker?.avgRating ?? 0);
  const rb = Number(b.worker?.avgRating ?? 0);
  if (rb !== ra) return rb - ra;
  const ca = a.worker?.totalRatings ?? 0;
  const cb = b.worker?.totalRatings ?? 0;
  if (cb !== ca) return cb - ca;
  return (b.worker?.completedShifts ?? 0) - (a.worker?.completedShifts ?? 0);
}

export function ApplicantList({
  shift, apps, processing, onApprove, onViewProfile,
}: {
  shift: Shift;
  apps: App[];
  processing: string | null;
  onApprove: (app: App) => void;
  onViewProfile: (app: App) => void;
}) {
  const { t, tSkill, tWorkerLanguage } = useT();
  const [sortMode, setSortMode] = useState<SortMode>('rating');

  const matches = new Map(apps.map(a => [a.id, a.worker ? skillMatch(a.worker as any, shift) : null]));
  const sorted = [...apps].sort((a, b) => {
    if (sortMode === 'match') {
      const d = (matches.get(b.id)?.score ?? 0) - (matches.get(a.id)?.score ?? 0);
      if (d !== 0) return d;
    }
    return byRating(a, b);
  });

  return (
    <>
      <div style={s.sortBar}>
        <span style={s.sortLabel}>{t('admin.shifts.sortLabel')}</span>
        {([
          ['rating', t('admin.shifts.sortRating')],
          ['match',  t('admin.shifts.sortMatch')],
        ] as [SortMode, string][]).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            style={{ ...s.sortBtn, ...(sortMode === mode ? s.sortBtnActive : {}) }}
            onClick={() => setSortMode(mode)}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={s.appList}>
        {sorted.map(app => {
          const w = app.worker;
          const m = matches.get(app.id);
          // Why they matched — only the parts the shift actually asks for.
          const reasons: string[] = [];
          if (m?.hasRole) reasons.push(`${t('admin.shifts.matchRole')} ✓`);
          if (m?.experience) reasons.push(t(`domain.experienceLevelsShort.${m.experience}`));
          if (m && m.skills.total > 0) reasons.push(t('admin.shifts.matchCount', { matched: m.skills.matched.length, total: m.skills.total }));
          if (m && m.languages.total > 0) {
            reasons.push(m.languages.matched.length
              ? m.languages.matched.map(tWorkerLanguage).join('/')
              : t('admin.shifts.matchLangs', { matched: 0, total: m.languages.total }));
          }
          const matchColor = !m ? '#6b7280' : m.score >= 80 ? '#16a34a' : m.score >= 50 ? '#d97706' : '#6b7280';

          return (
            <div key={app.id} style={s.appCard}>
              <div style={s.appLeft}>
                {w?.photoUrl
                  ? <img src={w.photoUrl} alt={w.fullName ?? ''} style={{ ...s.appAvatar, objectFit: 'cover' } as React.CSSProperties} />
                  : <div style={s.appAvatar}>{(w?.fullName?.[0] ?? '?').toUpperCase()}</div>}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <p style={s.appName}>{w?.fullName ?? t('admin.shifts.noName')}</p>
                    {app.isNew && <span style={s.newBadge}>{t('admin.shifts.newBadge')}</span>}
                  </div>
                  <p style={s.appMeta}>
                    {w?.avgRating != null && Number(w.avgRating) > 0 && (
                      <span style={{ color: '#d97706', fontWeight: 700, marginRight: 8 }}>
                        ★ {Number(w.avgRating).toFixed(1)}
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}> ({w.totalRatings ?? 0})</span>
                      </span>
                    )}
                    {(w?.completedShifts ?? 0) > 0 && (
                      <span style={{ color: '#16a34a', fontWeight: 600, marginRight: 8 }}>
                        {t('admin.shifts.appCompleted', { count: w!.completedShifts! })}
                      </span>
                    )}
                    {t('admin.shifts.appProfile', { score: w?.profileQualityScore ?? '—' })}
                  </p>
                  {m && (
                    <p style={{ ...s.appMatch, color: matchColor }}>
                      <IconTarget size={12} /> {t('admin.shifts.matchScore', { score: m.score })}
                    </p>
                  )}
                  {reasons.length > 0 && <p style={s.matchWhy}>{reasons.join(' · ')}</p>}
                  {w?.skills && w.skills.length > 0 && (
                    <p style={s.appSkills}>
                      {w.skills.slice(0, 3).map(tSkill).join(', ')}{w.skills.length > 3 ? ` +${w.skills.length - 3}` : ''}
                    </p>
                  )}
                  {app.coverNote && <p style={s.coverNote}><IconChat size={12} /> "{app.coverNote}"</p>}
                </div>
              </div>

              {/* Same size, side by side: outlined secondary, filled primary. */}
              <div style={s.appRight}>
                <button type="button" style={{ ...s.actionBtn, ...s.viewBtn }} onClick={() => onViewProfile(app)}>
                  {t('admin.shifts.viewProfile')}
                </button>
                {app.status === 'PENDING' && (
                  <button
                    type="button"
                    style={{ ...s.actionBtn, ...s.selectBtn, opacity: processing === app.id ? 0.6 : 1 }}
                    onClick={() => onApprove(app)}
                    disabled={!!processing}
                  >
                    {processing === app.id ? '...' : t('admin.shifts.select')}
                  </button>
                )}
                {app.status === 'APPROVED' && <span style={{ ...s.actionBtn, ...s.statusApproved }}>{t('admin.shifts.approved')}</span>}
                {app.status === 'REJECTED' && <span style={{ ...s.actionBtn, ...s.statusRejected }}>{t('admin.shifts.rejected')}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function WorkerProfilePanel({ app, onBack, onApprove, processing }: {
  app: App;
  onBack: () => void;
  onApprove?: (app: App) => void;
  processing?: string | null;
}) {
  const { t, tSkill, tWorkerLanguage, tWeekday } = useT();
  const w = app.worker;
  const score = w?.profileQualityScore ?? 0;
  const scoreColor = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  const avgR = w?.avgRating != null ? Number(w.avgRating) : null;
  return (
    <div style={s.profilePanel}>
      <div style={s.panelTopBar}>
        <button type="button" style={s.backInPanel} onClick={onBack}>
          <span style={s.backCircle}><IconArrowLeft size={16} /></span>
          {t('admin.shifts.backToList')}
        </button>
        {onApprove && app.status === 'PENDING' && (
          <button
            type="button"
            style={{ ...s.actionBtn, ...s.selectBtn, opacity: processing === app.id ? 0.6 : 1 }}
            onClick={() => onApprove(app)}
            disabled={!!processing}
          >
            {processing === app.id ? '...' : t('admin.shifts.select')}
          </button>
        )}
      </div>

      <div style={s.profileTop}>
        {w?.photoUrl
          ? <img src={w.photoUrl} alt={w.fullName ?? ''} style={s.profilePhoto} />
          : <div style={s.profileAvatar}>{(w?.fullName?.[0] ?? '?').toUpperCase()}</div>}
        <div style={{ flex: 1 }}>
          <p style={s.profileName}>{w?.fullName ?? t('admin.shifts.noName')}</p>
          <span style={{
            ...s.profileStatusBadge,
            background: w?.status === 'ACTIVE' ? '#dcfce7' : '#fef9c3',
            color:      w?.status === 'ACTIVE' ? '#166534' : '#854d0e',
          }}>
            {w?.status ? t(`domain.workerStatus.${w.status}`, { defaultValue: w.status }) : '—'}
          </span>
          {avgR != null && (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Stars value={avgR ?? 0} size={14} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b' }}>{avgR.toFixed(1)}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{t('admin.shifts.ratingsCount', { count: w?.totalRatings ?? 0 })}</span>
            </div>
          )}
          {w?.badges && w.badges.length > 0 && (
            <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
              {w.badges.includes('TOP_RATED') && <span style={s.badge}>{t('admin.workersSearch.badgeTop')}</span>}
              {w.badges.includes('RELIABLE')  && <span style={s.badge}>{t('admin.workersSearch.badgeReliable')}</span>}
              {w.badges.includes('VERIFIED')  && <span style={s.badge}>{t('admin.workersSearch.badgeVerified')}</span>}
            </div>
          )}
        </div>
      </div>

      {app.coverNote && (
        <div style={s.coverNoteBox}>
          <p style={s.profileSectionTitle}>{t('admin.shifts.coverNoteTitle')}</p>
          <p style={s.coverNoteText}>"{app.coverNote}"</p>
        </div>
      )}

      {w?.bio && (
        <div style={s.profileSection}>
          <p style={s.profileSectionTitle}>{t('admin.shifts.panelBio')}</p>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, margin: 0 }}>{w.bio}</p>
        </div>
      )}

      {/* What other companies wrote — the same evidence as the talent search panel. */}
      {w?.id && <WorkerReviews workerId={w.id} />}

      <div style={s.scoreSection}>
        <div style={s.scoreHeader}>
          <span style={s.scoreLabel}>{t('admin.shifts.panelScore')}</span>
          <span style={{ ...s.scoreValue, color: scoreColor }}>{score}%</span>
        </div>
        <div style={s.scoreBarBg}>
          <div style={{ ...s.scoreBarFill, width: `${score}%`, background: scoreColor }} />
        </div>
      </div>

      {w?.skills && w.skills.length > 0 && (
        <div style={s.profileSection}>
          <p style={s.profileSectionTitle}>{t('admin.shifts.panelSkills')}</p>
          <div style={s.skillTags}>
            {w.skills.map(sk => <span key={sk} style={s.skillTag}>{tSkill(sk)}</span>)}
          </div>
        </div>
      )}

      {/* Experience — the strongest signal when choosing between candidates */}
      {w?.experiences && w.experiences.length > 0 && (
        <div style={s.profileSection}>
          <p style={s.profileSectionTitle}>{t('admin.shifts.panelExperience')}</p>
          <div style={s.skillTags}>
            {w.experiences.map(exp => (
              <span key={exp.jobTitle} style={{ ...s.skillTag, background: '#fef3c7', color: '#92400e' }}>
                <IconBriefcase size={12} /> {tSkill(exp.jobTitle)} · {t(`domain.experienceLevels.${exp.level}`)}
              </span>
            ))}
          </div>
        </div>
      )}

      {w?.cvUrl && (
        <div style={s.profileSection}>
          <p style={s.profileSectionTitle}>{t('admin.shifts.panelCv')}</p>
          <a href={w.cvUrl} target="_blank" rel="noopener noreferrer" style={s.cvLink}>
            <IconFile size={12} /> {w.cvFileName ?? t('admin.shifts.panelCvFallback')}
          </a>
        </div>
      )}

      {w?.languages && w.languages.length > 0 && (
        <div style={s.profileSection}>
          <p style={s.profileSectionTitle}>{t('admin.shifts.panelLanguages')}</p>
          <div style={s.skillTags}>
            {w.languages.map(lang => (
              <span key={lang} style={{ ...s.skillTag, background: '#f0fdf4', color: '#15803d' }}>{tWorkerLanguage(lang)}</span>
            ))}
          </div>
        </div>
      )}

      {/* Availability — master switch, then the days it covers */}
      <div style={s.profileSection}>
        <p style={s.profileSectionTitle}>{t('admin.shifts.panelAvailability')}</p>
        <div style={s.skillTags}>
          <span style={{
            ...s.skillTag,
            background: w?.isAvailableForWork ? '#f0fdf4' : '#f3f4f6',
            color:      w?.isAvailableForWork ? '#166534' : '#6b7280',
          }}>
            {w?.isAvailableForWork ? t('admin.shifts.availableOn') : t('admin.shifts.availableOff')}
          </span>
          {w?.availableDays?.map(d => (
            <span key={d} style={{ ...s.skillTag, background: '#dbeafe', color: '#1d4ed8' }}>{tWeekday(d)}</span>
          ))}
        </div>
      </div>

      {!w?.bio && (!w?.skills || w.skills.length === 0) && (!w?.availableDays || w.availableDays.length === 0) && (
        <p style={s.emptyApps}>{t('admin.shifts.profileIncomplete')}</p>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  sortBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 0', borderBottom: '1px solid var(--color-border)', marginBottom: 4,
  },
  sortLabel: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', flexShrink: 0 },
  sortBtn: {
    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--color-border)',
    background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
  },
  sortBtnActive: {
    background: 'var(--color-primary-light)', borderColor: 'rgba(106,121,255,0.4)', color: 'var(--color-primary)',
  },

  appList: { display: 'flex', flexDirection: 'column', gap: 10 },
  appCard: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
    padding: '14px 16px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)',
  },
  appLeft: { display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 },
  appAvatar: {
    width: 44, height: 44, borderRadius: 22, background: 'var(--color-primary-light)',
    color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 800, flexShrink: 0,
  },
  appName: { fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' },
  newBadge: {
    fontSize: 10, fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase',
    color: '#fff', background: 'var(--color-primary)', borderRadius: 20, padding: '2px 7px',
  },
  appMeta: { fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 },
  appMatch: { fontSize: 12, fontWeight: 700, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  matchWhy: { fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 },
  appSkills: { fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 },
  coverNote: {
    fontSize: 12, color: '#6b7280', fontStyle: 'italic', marginTop: 3, maxWidth: 360,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  appRight: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  actionBtn: {
    width: 112, height: 36, borderRadius: 8, fontSize: 13, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontFamily: 'inherit', boxSizing: 'border-box',
  },
  viewBtn: { background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', color: 'var(--color-text-primary)' },
  selectBtn: { background: 'var(--color-primary)', border: '1.5px solid var(--color-primary)', color: '#fff' },
  statusApproved: { background: '#dcfce7', border: '1.5px solid #86efac', color: '#16a34a', cursor: 'default' },
  statusRejected: { background: '#fee2e2', border: '1.5px solid #fecaca', color: '#dc2626', cursor: 'default' },

  profilePanel: { display: 'flex', flexDirection: 'column', gap: 16 },
  panelTopBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  backInPanel: {
    display: 'inline-flex', alignItems: 'center', gap: 10,
    background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-secondary)',
  },
  backCircle: {
    width: 36, height: 36, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)',
  },
  profileTop: { display: 'flex', gap: 14, alignItems: 'center' },
  profilePhoto: { width: 64, height: 64, borderRadius: 32, objectFit: 'cover', flexShrink: 0 },
  profileAvatar: {
    width: 64, height: 64, borderRadius: 32, background: 'var(--color-primary-light)',
    color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, fontWeight: 800, flexShrink: 0,
  },
  profileName: { fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 6 },
  profileStatusBadge: { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  badge: { display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fef9c3', border: '1px solid #fde68a', color: '#92400e' },
  coverNoteBox: {
    background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  coverNoteText: { fontSize: 13, color: '#374151', lineHeight: 1.5, margin: 0, fontStyle: 'italic' },
  profileSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  profileSectionTitle: { fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  scoreSection: { display: 'flex', flexDirection: 'column', gap: 6 },
  scoreHeader: { display: 'flex', justifyContent: 'space-between' },
  scoreLabel: { fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' },
  scoreValue: { fontSize: 14, fontWeight: 800 },
  scoreBarBg: { height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 4, transition: 'width 0.3s ease' },
  skillTags: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  skillTag: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '4px 10px', background: 'var(--color-primary-light)', borderRadius: 20,
    fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', border: '1px solid rgba(106,121,255,0.2)',
  },
  cvLink: {
    display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    fontSize: 13, fontWeight: 700, color: 'var(--color-primary)',
    textDecoration: 'none', padding: '8px 12px', borderRadius: 8,
    background: 'var(--color-primary-light)', border: '1px solid rgba(106,121,255,0.2)',
  },
  emptyApps: { fontSize: 14, color: 'var(--color-text-secondary)', textAlign: 'center', padding: '24px 0' },
};
