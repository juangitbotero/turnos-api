'use client';

/**
 * Candidatos — everyone waiting for an answer, grouped by job (2026-10-11).
 *
 * Before this page a company learnt that someone had applied only by opening
 * Turnos → the shift → Candidatos, one shift at a time. Here every open job with
 * pending applicants is listed, soonest first, with the same applicant cards,
 * sorts and profile panel as the shifts-page modal (components/Applicants).
 *
 * Opening the page marks what it shows as seen (the sidebar badge turns grey);
 * the "Novo" labels stay until the page is opened again, so the company still
 * sees which ones are new this time.
 */
import { useCallback, useEffect, useState } from 'react';
import { adminApi, ApiError, CandidateGroup, Application } from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import { useT } from '../../../lib/i18n';
import { LanguageSwitcher } from '../../../components/LanguageSwitcher';
import { ApplicantList, WorkerProfilePanel } from '../../../components/Applicants';
import { CANDIDATES_CHANGED_EVENT } from '../../../components/DashboardShell';
import { IconAlert, IconCalendar, IconCheck, IconClock, IconUserCheck, Spinner } from '../../../components/icons';

type App = Application & { isNew?: boolean };

export default function CandidatesPage() {
  const { t, tSkill, fMediumDate } = useT();
  const [groups, setGroups] = useState<CandidateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [profile, setProfile] = useState<{ app: App; group: CandidateGroup } | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      setGroups(await adminApi.getCandidates());
      await adminApi.markCandidatesSeen().catch(() => {});
      window.dispatchEvent(new Event(CANDIDATES_CHANGED_EVENT));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.candidates.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  // A new applicant while the page is open appears without a refresh.
  useEffect(() => {
    const socket = getSocket();
    const onNew = () => { void load(true); };
    socket?.on('shift:new_application', onNew);
    return () => { socket?.off('shift:new_application', onNew); };
  }, [load]);

  const approve = async (group: CandidateGroup, app: App) => {
    setProcessing(app.id);
    try {
      await adminApi.approveApplication(group.shift.id, app.id);
      // The job now waits for the worker's confirmation — no longer a candidate list.
      setGroups(prev => prev.filter(g => g.shift.id !== group.shift.id));
      setProfile(null);
      setNotice(t('admin.candidates.selected'));
      window.dispatchEvent(new Event(CANDIDATES_CHANGED_EVENT));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('admin.shifts.approveError'));
    } finally {
      setProcessing(null);
    }
  };

  const total = groups.reduce((n, g) => n + g.applications.length, 0);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>{t('admin.candidates.title')}</h1>
          <p style={s.sub}>
            {loading ? t('common.loading')
              : total > 0 ? t('admin.candidates.subCount', { count: total })
              : t('admin.candidates.sub')}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <LanguageSwitcher />
          <button type="button" style={s.refreshBtn} onClick={() => void load()} disabled={loading}>
            {t('admin.workers.refresh')}
          </button>
        </div>
      </div>

      {notice && (
        <div style={s.notice}>
          <IconCheck size={15} /> <span style={{ flex: 1 }}>{notice}</span>
          <button type="button" style={s.noticeClose} onClick={() => setNotice('')}>✕</button>
        </div>
      )}
      {error && <div style={s.errorBanner}><IconAlert size={15} /> {error}</div>}

      {loading ? (
        <div style={s.loading}><Spinner size={22} /> {t('admin.candidates.loading')}</div>
      ) : !error && groups.length === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyIcon}><IconUserCheck size={44} /></div>
          <p style={s.emptyTitle}>{t('admin.candidates.emptyTitle')}</p>
          <p style={s.emptySub}>{t('admin.candidates.emptySub')}</p>
          <a href="/dashboard/new-shift" style={s.emptyBtn}>{t('admin.candidates.emptyCta')}</a>
        </div>
      ) : (
        <div style={s.groups}>
          {groups.map(group => {
            const sh = group.shift;
            const days = sh.seriesDates?.length ?? 1;
            const newCount = group.applications.filter(a => a.isNew).length;
            return (
              <section key={sh.id} style={s.group}>
                <header style={s.groupHead}>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={s.groupTitle}>{sh.title || tSkill(sh.subcategory)}</h2>
                    <p style={s.groupMeta}>
                      <span style={s.metaItem}><IconCalendar size={13} /> {fMediumDate(sh.date)}
                        {days > 1 && <> · {t('admin.candidates.multiDay', { count: days })}</>}
                      </span>
                      <span style={s.metaItem}><IconClock size={13} /> {sh.startTime.slice(0, 5)}–{sh.endTime.slice(0, 5)}</span>
                      <span style={s.metaItem}>€{Number(sh.grossHourlyRate).toFixed(2)}/h</span>
                    </p>
                  </div>
                  <div style={s.groupCounts}>
                    <span style={s.countPill}>
                      {group.applications.length === 1
                        ? t('admin.candidates.countOne')
                        : t('admin.candidates.countOther', { count: group.applications.length })}
                    </span>
                    {newCount > 0 && <span style={s.newPill}>{t('admin.candidates.newCount', { count: newCount })}</span>}
                  </div>
                </header>
                <ApplicantList
                  shift={sh}
                  apps={group.applications}
                  processing={processing}
                  onApprove={app => void approve(group, app)}
                  onViewProfile={app => setProfile({ app, group })}
                />
              </section>
            );
          })}
        </div>
      )}

      {profile && (
        <div style={s.overlay} onClick={() => setProfile(null)}>
          <aside style={s.drawer} onClick={e => e.stopPropagation()}>
            <WorkerProfilePanel
              app={profile.app}
              onBack={() => setProfile(null)}
              onApprove={app => void approve(profile.group, app)}
              processing={processing}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: 32, maxWidth: 1100, margin: '0 auto' },
  header: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px', marginBottom: 4 },
  sub: { fontSize: 14, color: 'var(--color-text-secondary)' },
  refreshBtn: {
    padding: '8px 16px', background: 'var(--color-primary-light)', border: '1px solid rgba(106,121,255,0.3)',
    borderRadius: 8, color: 'var(--color-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  notice: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
    background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
    padding: '12px 14px', fontSize: 13.5, color: '#166534', fontWeight: 600,
  },
  noticeClose: { background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontSize: 14 },
  errorBanner: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#fee2e2', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8,
    padding: '12px 16px', fontSize: 13, color: '#ef4444', marginBottom: 24,
  },
  loading: { display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '60px 0', color: 'var(--color-text-secondary)', fontSize: 14 },
  empty: { textAlign: 'center', padding: '72px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  emptyIcon: { color: 'var(--color-text-muted)' },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' },
  emptySub: { fontSize: 14, color: 'var(--color-text-secondary)', maxWidth: 420, lineHeight: 1.55 },
  emptyBtn: {
    marginTop: 8, padding: '10px 24px', textDecoration: 'none',
    background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 700, color: '#fff',
  },
  groups: { display: 'flex', flexDirection: 'column', gap: 20 },
  group: {
    background: 'var(--color-secondary)', border: '1px solid var(--color-border)',
    borderRadius: 14, padding: '18px 20px',
  },
  groupHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 4 },
  groupTitle: { fontSize: 17, fontWeight: 800, color: 'var(--color-text-primary)' },
  groupMeta: { display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 5, fontSize: 13, color: 'var(--color-text-secondary)' },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 5 },
  groupCounts: { display: 'flex', gap: 6, flexShrink: 0 },
  countPill: {
    fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
    background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)',
  },
  newPill: { fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: '#dc2626', color: '#fff' },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,15,35,0.45)', zIndex: 200,
    display: 'flex', justifyContent: 'flex-end',
  },
  drawer: {
    width: 480, maxWidth: '100%', height: '100%', overflowY: 'auto',
    background: 'var(--color-surface)', padding: 24, boxShadow: '-8px 0 30px rgba(15,15,35,0.15)',
  },
};
