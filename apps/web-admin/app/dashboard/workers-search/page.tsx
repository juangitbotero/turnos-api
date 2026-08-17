'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LANGUAGES, ALL_SKILLS, STORED_WEEKDAYS } from '@turnos/shared';
import { adminApi, WorkerSearchResult, Shift, ApiError } from '../../../lib/api';
import { SIDEBAR_NAV } from '../../../lib/nav';
import { useT } from '../../../lib/i18n';
import { LanguageSwitcher } from '../../../components/LanguageSwitcher';
import { WorkerReviews } from '../../../components/WorkerReviews';
import { Logo } from '../../../components/Logo';
import {
  IconSearch, IconBriefcase, IconGlobe, IconStar, IconCalendar,
  IconDownload, IconReset, IconChevron, IconFile, Stars,
} from '../../../components/icons';

// ── Worker detail panel ────────────────────────────────────────────────────────

function WorkerDetailPanel({
  worker,
  onClose,
  myShifts,
}: {
  worker: WorkerSearchResult;
  onClose: () => void;
  myShifts: Shift[];
}) {
  const { t, tSkill, tWorkerLanguage, tWeekday, fShortDate } = useT();
  const [inviting, setInviting]       = useState(false);
  const [selectedShift, setSelectedShift] = useState('');
  const [invited, setInvited]         = useState(false);

  const openShifts = myShifts.filter(s => s.status === 'OPEN');
  const avgR = worker.avgRating != null ? Number(worker.avgRating) : null;

  const handleInvite = async () => {
    if (!selectedShift) return;
    setInviting(true);
    try {
      await adminApi.inviteWorker(selectedShift, worker.id);
      setInvited(true);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('admin.workersSearch.inviteFailed'));
    } finally {
      setInviting(false);
    }
  };

  return (
    <div style={p.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={p.panel}>
        {/* Header */}
        <div style={p.header}>
          <div style={p.headerLeft}>
            {worker.photoUrl
              ? <img src={worker.photoUrl} alt={worker.fullName ?? ''} style={p.photo} />
              : <div style={p.avatar}>{(worker.fullName?.[0] ?? '?').toUpperCase()}</div>
            }
            <div>
              <h2 style={p.name}>{worker.fullName ?? t('admin.workersSearch.noName')}</h2>
              {avgR != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Stars value={avgR ?? 0} size={14} />
                  <span style={p.ratingVal}>{avgR.toFixed(1)}</span>
                  <span style={p.ratingCount}>{t('admin.workersSearch.ratings', { count: worker.totalRatings })}</span>
                </div>
              )}
              <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {worker.badges?.includes('TOP_RATED') && <span style={p.badge}>{t('admin.workersSearch.badgeTop')}</span>}
                {worker.badges?.includes('RELIABLE')  && <span style={p.badge}>{t('admin.workersSearch.badgeReliable')}</span>}
                {worker.badges?.includes('VERIFIED')  && <span style={p.badge}>{t('admin.workersSearch.badgeVerified')}</span>}
              </div>
            </div>
          </div>
          <button style={p.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={p.body}>
          {/* Profile completeness */}
          <div style={p.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={p.sectionTitle}>{t('admin.workersSearch.panelCompleteness')}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: worker.profileQualityScore >= 80 ? '#16a34a' : '#d97706' }}>
                {worker.profileQualityScore}%
              </span>
            </div>
            <div style={p.barBg}><div style={{ ...p.barFill, width: `${worker.profileQualityScore}%` }} /></div>
          </div>

          {/* Bio */}
          {worker.bio && (
            <div style={p.section}>
              <div style={p.sectionTitle}>{t('admin.workersSearch.panelBio')}</div>
              <p style={p.bio}>{worker.bio}</p>
            </div>
          )}

          {/* CV */}
          {worker.cvUrl && (
            <div style={p.section}>
              <div style={p.sectionTitle}>{t('admin.workersSearch.panelCv')}</div>
              {/* download forces a save rather than an in-tab preview, which is
                  what an employer collecting CVs actually wants; the filename
                  hint keeps the worker's original name. */}
              <a
                href={worker.cvUrl}
                download={worker.cvFileName ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                style={p.cvLink}
              >
                <IconDownload size={15} />
                <span style={{ flex: 1 }}>{worker.cvFileName ?? t('admin.workersSearch.panelCvFallback')}</span>
                <span style={p.cvAction}>{t('admin.workersSearch.cvDownload')}</span>
              </a>
            </div>
          )}

          {/* Experience per job title */}
          {worker.experiences && worker.experiences.length > 0 && (
            <div style={p.section}>
              <div style={p.sectionTitle}>{t('admin.workersSearch.panelExperience')}</div>
              <div style={p.expList}>
                {worker.experiences.map(exp => (
                  <div key={exp.jobTitle} style={p.expRow}>
                    <span style={p.expTitle}>{tSkill(exp.jobTitle)}</span>
                    <span style={p.expLevel}>{t(`domain.experienceLevels.${exp.level}`)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills */}
          {worker.skills && worker.skills.length > 0 && (
            <div style={p.section}>
              <div style={p.sectionTitle}>{t('admin.workersSearch.panelSkills')}</div>
              <div style={p.tags}>
                {worker.skills.map(sk => <span key={sk} style={p.tag}>{tSkill(sk)}</span>)}
              </div>
            </div>
          )}

          {/* Languages */}
          {worker.languages && worker.languages.length > 0 && (
            <div style={p.section}>
              <div style={p.sectionTitle}>{t('admin.workersSearch.panelLanguages')}</div>
              <div style={p.tags}>
                {worker.languages.map(l => <span key={l} style={{ ...p.tag, background: '#f0fdf4', color: '#15803d' }}>{tWorkerLanguage(l)}</span>)}
              </div>
            </div>
          )}

          {/* Availability — master switch first, then the days it covers */}
          <div style={p.section}>
            <div style={p.sectionTitle}>{t('admin.workersSearch.panelAvailability')}</div>
            <div style={worker.isAvailableForWork ? p.availOn : p.availOff}>
              {worker.isAvailableForWork
                ? t('admin.workersSearch.availableOn')
                : t('admin.workersSearch.availableOff')}
            </div>
            {worker.availableDays && worker.availableDays.length > 0 && (
              <div style={{ ...p.tags, marginTop: 8 }}>
                {worker.availableDays.map(d => <span key={d} style={{ ...p.tag, background: '#dbeafe', color: '#1d4ed8' }}>{tWeekday(d)}</span>)}
              </div>
            )}
          </div>

          {/* Stats */}
          <div style={p.statsRow}>
            <div style={p.stat}>
              <div style={p.statVal}>{worker.noShowCount}</div>
              <div style={p.statLabel}>{t('admin.workersSearch.statNoShows')}</div>
            </div>
            <div style={p.stat}>
              <div style={p.statVal}>{worker.totalRatings}</div>
              <div style={p.statLabel}>{t('admin.workersSearch.statRatings')}</div>
            </div>
            <div style={p.stat}>
              <div style={p.statVal}>{worker.profileQualityScore}%</div>
              <div style={p.statLabel}>{t('admin.workersSearch.statProfile')}</div>
            </div>
          </div>

          {/* What other companies wrote — the reason to pick this worker over
              the next one, so it sits directly above the invite control. */}
          <WorkerReviews workerId={worker.id} />

          {/* Invite to shift */}
          <div style={p.inviteBox}>
            <div style={p.sectionTitle}>{t('admin.workersSearch.inviteTitle')}</div>
            {invited ? (
              <div style={p.inviteSuccess}>{t('admin.workersSearch.inviteSuccess')}</div>
            ) : openShifts.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {t('admin.workersSearch.inviteNoShifts')} <Link href="/dashboard/new-shift" style={{ color: 'var(--color-primary)' }}>{t('admin.workersSearch.inviteNoShiftsCta')}</Link>
              </p>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <select
                  style={p.select}
                  value={selectedShift}
                  onChange={e => setSelectedShift(e.target.value)}
                >
                  <option value="">{t('admin.workersSearch.invitePick')}</option>
                  {openShifts.map(sh => (
                    <option key={sh.id} value={sh.id}>
                      {sh.title || tSkill(sh.subcategory)} · {fShortDate(sh.date)} · {sh.startTime.slice(0,5)}
                    </option>
                  ))}
                </select>
                <button
                  style={{ ...p.inviteBtn, opacity: (!selectedShift || inviting) ? 0.6 : 1 }}
                  disabled={!selectedShift || inviting}
                  onClick={handleInvite}
                >
                  {inviting ? '...' : t('admin.workersSearch.inviteBtn')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkersSearchPage() {
  const router = useRouter();
  const { t, tSkill, tWorkerLanguage, tWeekday } = useT();

  const [workers, setWorkers]         = useState<WorkerSearchResult[]>([]);
  const [myShifts, setMyShifts]       = useState<Shift[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selected, setSelected]       = useState<WorkerSearchResult | null>(null);

  // Filters
  const [searchText, setSearchText]   = useState('');
  const [filterSkills, setFilterSkills] = useState<string[]>([]);
  const [filterLangs, setFilterLangs] = useState<string[]>([]);
  const [filterDays, setFilterDays]   = useState<string[]>([]);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [minRating, setMinRating]     = useState<number>(0);
  const [showSkillFilter, setShowSkillFilter] = useState(false);
  const [showDayFilter, setShowDayFilter]     = useState(false);

  useEffect(() => {
    adminApi.getMyShifts().then(setMyShifts).catch(() => {});
  }, []);

  const hasFilters =
    filterSkills.length > 0 || filterLangs.length > 0 || filterDays.length > 0 ||
    onlyAvailable || minRating > 0 || searchText.trim() !== '';

  const resetFilters = () => {
    setFilterSkills([]); setFilterLangs([]); setFilterDays([]);
    setOnlyAvailable(false); setMinRating(0); setSearchText('');
  };

  const doSearch = useCallback(async () => {
    setLoading(true);
    try {
      const results = await adminApi.searchWorkers({
        skills:    filterSkills.length   ? filterSkills   : undefined,
        languages: filterLangs.length    ? filterLangs    : undefined,
        available: filterDays.length     ? filterDays     : undefined,
        availableNow: onlyAvailable      ? true           : undefined,
        minRating: minRating > 0         ? minRating      : undefined,
      });
      setWorkers(results);
    } catch {
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [filterSkills, filterLangs, filterDays, onlyAvailable, minRating]);

  /**
   * Filters apply themselves.
   *
   * Previously only the availability toggle re-queried; everything else waited
   * for a "Pesquisar" click, so a tickbox could be on screen while the results
   * below it still reflected the previous query. Now every filter re-runs the
   * search, debounced so ticking four skills is one request rather than four.
   *
   * 250ms: long enough to coalesce a burst of clicks, short enough that the
   * list feels like it is reacting to you.
   */
  const didMount = useRef(false);
  useEffect(() => {
    const id = setTimeout(() => { doSearch(); }, didMount.current ? 250 : 0);
    didMount.current = true;
    return () => clearTimeout(id);
  }, [doSearch]);


  const filtered = workers.filter(w => {
    if (!searchText.trim()) return true;
    const q = searchText.toLowerCase();
    return (
      w.fullName?.toLowerCase().includes(q) ||
      w.bio?.toLowerCase().includes(q) ||
      w.skills?.some(s => s.toLowerCase().includes(q))
    );
  });

  const toggleFilter = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  return (
    <div style={s.shell}>

      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.sidebarTop}>
          <div style={s.logoWrap}><Logo height={30} href="/dashboard" /></div>
          <div style={s.divider} />
          <nav style={s.nav}>
            {SIDEBAR_NAV.map(({ Icon, key, href, soon }) => {
              const label = t(`admin.nav.${key}`);
              if (soon || !href) {
                return (
                  <div key={key} style={{ ...s.navItem, opacity: 0.45, cursor: 'default' }}>
                    <span style={s.navIcon}><Icon size={17} /></span>
                    <span>{label}</span>
                    <span style={s.soonPill}>{t('admin.chrome.soon')}</span>
                  </div>
                );
              }
              const active = href === '/dashboard/workers-search';
              return (
                <Link key={href} href={href}
                  style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}
                >
                  <span style={s.navIcon}><Icon size={17} /></span>
                  <span>{label}</span>
                  {active && <span style={s.activeDot} />}
                </Link>
              );
            })}
          </nav>
        </div>
        <Link href="/login" style={s.logoutBtn}>{t('admin.chrome.logout')}</Link>
      </aside>

      {/* Main */}
      <main style={s.main}>
        <header style={s.topBar}>
          <div>
            <button style={s.backBtn} onClick={() => router.push('/dashboard')}>{t('admin.chrome.backDashboard')}</button>
            <h1 style={s.title}>{t('admin.workersSearch.title')}</h1>
            <p style={s.sub}>{t('admin.workersSearch.sub')}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <LanguageSwitcher />
            {/* Search runs itself now, so this slot holds the escape hatch
                instead: one click back to an unfiltered list. */}
            <button
              style={{ ...s.resetBtn, ...(hasFilters ? {} : s.resetBtnIdle) }}
              onClick={resetFilters}
              disabled={!hasFilters}
            >
              <IconReset size={15} />
              {t('admin.workersSearch.resetFilters')}
            </button>
          </div>
        </header>

        {/* Filter bar */}
        <div style={s.filterBar}>
          {/* Text search */}
          <div style={s.searchWrap}>
            <IconSearch size={16} style={s.searchIcon} />
            <input
              style={s.searchInput}
              placeholder={t('admin.workersSearch.searchPlaceholder')}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
          </div>

          {/* Skills */}
          <div style={{ position: 'relative' }}>
            <button
              style={{ ...s.filterBtn, ...(filterSkills.length ? s.filterBtnOn : {}) }}
              onClick={() => { setShowSkillFilter(v => !v); setShowDayFilter(false); }}
            >
              <IconBriefcase size={15} />
              {filterSkills.length > 0
                ? t('admin.workersSearch.filterSkillsCount', { count: filterSkills.length })
                : t('admin.workersSearch.filterSkills')}
              <IconChevron size={13} />
            </button>
            {showSkillFilter && (
              <>
                <div style={s.backdrop} onClick={() => setShowSkillFilter(false)} />
                <div style={s.dropdown}>
                  <div style={s.dropdownInner}>
                    {ALL_SKILLS.map(sk => (
                      <label key={sk} style={s.checkRow}>
                        <input
                          type="checkbox"
                          checked={filterSkills.includes(sk)}
                          onChange={() => toggleFilter(filterSkills, setFilterSkills, sk)}
                        />
                        <span style={{ fontSize: 13 }}>{tSkill(sk)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/*
            Days — was a permanently-visible row of seven chips that ate a whole
            line and read as decoration rather than a control. Folded into the
            same dropdown shape as Skills so the bar has one grammar, and the
            count in the label makes its filtering role explicit.
          */}
          <div style={{ position: 'relative' }}>
            <button
              style={{ ...s.filterBtn, ...(filterDays.length ? s.filterBtnOn : {}) }}
              onClick={() => { setShowDayFilter(v => !v); setShowSkillFilter(false); }}
            >
              <IconCalendar size={15} />
              {filterDays.length > 0
                ? t('admin.workersSearch.filterDaysCount', { count: filterDays.length })
                : t('admin.workersSearch.filterDays')}
              <IconChevron size={13} />
            </button>
            {showDayFilter && (
              <>
                <div style={s.backdrop} onClick={() => setShowDayFilter(false)} />
                <div style={{ ...s.dropdown, padding: 10, minWidth: 'auto' }}>
                  {/* Stored PT values are the payload; only the label changes */}
                  <div style={s.dayGrid}>
                    {STORED_WEEKDAYS.map(d => (
                      <button
                        key={d}
                        style={{ ...s.dayChip, ...(filterDays.includes(d) ? s.dayChipActive : {}) }}
                        onClick={() => toggleFilter(filterDays, setFilterDays, d)}
                      >
                        {tWeekday(d)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Languages */}
          <div style={s.selectWrap}>
            <IconGlobe size={15} style={s.selectIcon} />
            <select
              style={{ ...s.selectInput, ...(filterLangs.length ? s.filterBtnOn : {}) }}
              value=""
              onChange={e => { if (e.target.value) toggleFilter(filterLangs, setFilterLangs, e.target.value); }}
            >
              <option value="">
                {filterLangs.length > 0
                  ? t('admin.workersSearch.filterLanguageCount', { count: filterLangs.length })
                  : t('admin.workersSearch.filterLanguage')}
              </option>
              {/* value stays the stored PT language name */}
              {(LANGUAGES as readonly string[]).map(l => <option key={l} value={l}>{tWorkerLanguage(l)}</option>)}
            </select>
          </div>

          {/* Rating */}
          <div style={s.selectWrap}>
            <IconStar size={15} filled={minRating > 0} style={s.selectIcon} />
            <select
              style={{ ...s.selectInput, ...(minRating > 0 ? s.filterBtnOn : {}) }}
              value={minRating}
              onChange={e => setMinRating(Number(e.target.value))}
            >
              <option value={0}>{t('admin.workersSearch.ratingAny')}</option>
              <option value={3}>{t('admin.workersSearch.rating3')}</option>
              <option value={4}>{t('admin.workersSearch.rating4')}</option>
              <option value={4.5}>{t('admin.workersSearch.rating45')}</option>
            </select>
          </div>

          {/* Availability — master switch, ANDs with the day filter */}
          <button
            style={{ ...s.filterBtn, ...(onlyAvailable ? s.filterBtnOn : {}) }}
            onClick={() => setOnlyAvailable(v => !v)}
            title={t('admin.workersSearch.filterAvailableTitle')}
          >
            <span style={{ ...s.availDot, background: onlyAvailable ? '#16a34a' : '#c9cedb' }} />
            {t('admin.workersSearch.filterAvailable')}
          </button>

          {/* Active filter chips */}
          {[...filterSkills, ...filterLangs].map(f => (
            <span key={f} style={s.activeChip}>
              {filterSkills.includes(f) ? tSkill(f) : tWorkerLanguage(f)}
              <button style={s.chipRemove} onClick={() => {
                setFilterSkills(filterSkills.filter(x => x !== f));
                setFilterLangs(filterLangs.filter(x => x !== f));
              }}>✕</button>
            </span>
          ))}
        </div>

        {/* Results */}
        <div style={s.resultsMeta}>
          {loading
            ? t('admin.workersSearch.searching')
            : filtered.length === 1
              ? t('admin.workersSearch.resultsOne')
              : t('admin.workersSearch.resultsOther', { count: filtered.length })}
        </div>

        <div style={s.grid}>
          {filtered.map(w => {
            const avgR = w.avgRating != null ? Number(w.avgRating) : null;
            const stars = Math.round(avgR ?? 0);
            return (
              <div key={w.id} style={s.card} onClick={() => setSelected(w)}>
                {/* Avatar + name */}
                <div style={s.cardHeader}>
                  {w.photoUrl
                    ? <img src={w.photoUrl} alt={w.fullName ?? ''} style={s.cardPhoto} />
                    : <div style={s.cardAvatar}>{(w.fullName?.[0] ?? '?').toUpperCase()}</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={s.cardName}>{w.fullName ?? t('admin.workersSearch.noName')}</p>
                    {avgR != null && (
                      <div style={s.starsRow}>
                        <Stars value={stars} size={12} />
                        <span style={s.ratingNum}>{avgR.toFixed(1)}</span>
                        <span style={s.ratingCnt}>({w.totalRatings})</span>
                      </div>
                    )}
                  </div>
                  <div style={{ ...s.scoreChip, background: w.profileQualityScore >= 90 ? '#dcfce7' : '#f0f4ff' }}>
                    {w.profileQualityScore}%
                  </div>
                </div>

                {/* Badges */}
                {w.badges && w.badges.length > 0 && (
                  <div style={s.badgeRow}>
                    {w.badges.includes('TOP_RATED') && <span style={s.badge}>{t('admin.workersSearch.badgeTopShort')}</span>}
                    {w.badges.includes('RELIABLE')  && <span style={s.badge}>{t('admin.workersSearch.badgeReliableShort')}</span>}
                    {w.badges.includes('VERIFIED')  && <span style={s.badge}>{t('admin.workersSearch.badgeVerifiedShort')}</span>}
                  </div>
                )}

                {/* Bio */}
                {w.bio && <p style={s.bio}>{w.bio}</p>}

                {/* Top skills */}
                {w.skills && w.skills.length > 0 && (
                  <div style={s.skillRow}>
                    {w.skills.slice(0, 3).map(sk => <span key={sk} style={s.skill}>{tSkill(sk)}</span>)}
                    {w.skills.length > 3 && <span style={s.more}>+{w.skills.length - 3}</span>}
                  </div>
                )}

                {/* Top experience — most relevant thing when picking a candidate */}
                {w.experiences && w.experiences.length > 0 && (
                  <div style={s.skillRow}>
                    {w.experiences.slice(0, 2).map(exp => (
                      <span key={exp.jobTitle} style={s.expPill}>
                        <IconBriefcase size={12} /> {tSkill(exp.jobTitle)} · {t(`domain.experienceLevelsShort.${exp.level}`)}
                      </span>
                    ))}
                    {w.experiences.length > 2 && <span style={s.more}>+{w.experiences.length - 2}</span>}
                  </div>
                )}

                {/* Languages + availability */}
                <div style={s.cardMeta}>
                  {w.isAvailableForWork && <span style={s.availPill}>{t('admin.workersSearch.availablePill')}</span>}
                  {w.cvUrl && <span style={s.metaItem}><IconFile size={12} /> CV</span>}
                  {w.languages && w.languages.length > 0 && (
                    <span style={s.metaItem}><IconGlobe size={12} /> {w.languages.slice(0,2).map(tWorkerLanguage).join(', ')}{w.languages.length > 2 ? ` +${w.languages.length - 2}` : ''}</span>
                  )}
                  {w.availableDays && w.availableDays.length > 0 && (
                    <span style={s.metaItem}><IconCalendar size={12} /> {w.availableDays.map(tWeekday).join(', ')}</span>
                  )}
                </div>

                <button style={s.viewBtn}>{t('admin.workersSearch.viewProfile')}</button>
              </div>
            );
          })}

          {!loading && filtered.length === 0 && (
            <div style={s.empty}>
              <div style={{ marginBottom: 12, color: 'var(--color-text-secondary)' }}><IconSearch size={40} /></div>
              <p style={s.emptyTitle}>{t('admin.workersSearch.emptyTitle')}</p>
              <p style={s.emptySub}>{t('admin.workersSearch.emptySub')}</p>
            </div>
          )}
        </div>
      </main>

      {selected && (
        <WorkerDetailPanel
          worker={selected}
          myShifts={myShifts}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/* ── Panel styles ─────────────────────────────────────────────────────────── */

const p: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', justifyContent: 'flex-end', zIndex: 200,
  },
  panel: {
    width: 480, height: '100vh', background: '#fff',
    display: 'flex', flexDirection: 'column',
    boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
    overflowY: 'auto',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '24px', borderBottom: '1px solid var(--color-border)', gap: 12,
  },
  headerLeft: { display: 'flex', alignItems: 'flex-start', gap: 14 },
  photo: { width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' as const, flexShrink: 0 },
  avatar: {
    width: 64, height: 64, borderRadius: '50%',
    background: 'var(--color-primary-light)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: 24, fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0,
  },
  name: { fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 },
  ratingVal: { fontSize: 13, fontWeight: 700, color: '#1e1b4b', marginLeft: 4 },
  ratingCount: { fontSize: 12, color: '#6b7280' },
  badge: {
    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
    background: '#fef9c3', border: '1px solid #fde68a', color: '#92400e',
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
    color: 'var(--color-text-secondary)', flexShrink: 0,
    padding: 4,
  },
  body: { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 },
  section: {},
  sectionTitle: { fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 8 },
  barBg: { height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', background: 'var(--color-primary)', borderRadius: 3 },
  bio: { fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6, fontStyle: 'italic', margin: 0 },
  tags: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  tag: {
    padding: '4px 10px', background: 'var(--color-primary-light)', borderRadius: 20,
    fontSize: 12, fontWeight: 600, color: 'var(--color-primary)',
    border: '1px solid rgba(106,121,255,0.2)',
  },
  cvLink: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 13, fontWeight: 700, color: 'var(--color-primary)',
    textDecoration: 'none',
    padding: '8px 12px', borderRadius: 8,
    background: 'var(--color-primary-light)',
    border: '1px solid rgba(106,121,255,0.2)',
  },
  expList: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  expRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    padding: '8px 12px', background: '#f9fafb',
    border: '1px solid var(--color-border)', borderRadius: 8,
  },
  expTitle: { fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' },
  expLevel: { fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', whiteSpace: 'nowrap' as const },
  availOn: {
    fontSize: 13, fontWeight: 700, color: '#166534',
    background: '#f0fdf4', border: '1px solid #bbf7d0',
    borderRadius: 8, padding: '8px 12px',
  },
  availOff: {
    fontSize: 13, fontWeight: 600, color: '#6b7280',
    background: '#f9fafb', border: '1px solid var(--color-border)',
    borderRadius: 8, padding: '8px 12px',
  },
  statsRow: {
    display: 'flex', gap: 0,
    background: '#f9fafb', borderRadius: 10, border: '1px solid var(--color-border)',
    overflow: 'hidden',
  },
  stat: {
    flex: 1, padding: '12px 0', textAlign: 'center' as const,
    borderRight: '1px solid var(--color-border)',
  },
  statVal: { fontSize: 20, fontWeight: 800, color: 'var(--color-text-primary)' },
  statLabel: { fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 },
  inviteBox: {
    background: '#f0f4ff', borderRadius: 10, padding: '16px',
    border: '1px solid rgba(106,121,255,0.2)',
  },
  inviteSuccess: {
    fontSize: 13, fontWeight: 600, color: '#16a34a', marginTop: 8,
    background: '#dcfce7', padding: '10px 14px', borderRadius: 8,
  },
  select: {
    flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 8,
    border: '1.5px solid var(--color-border)', fontFamily: 'inherit',
    outline: 'none', color: 'var(--color-text-primary)', background: '#fff',
  },
  inviteBtn: {
    padding: '8px 16px', background: 'var(--color-primary)',
    color: '#fff', border: 'none', borderRadius: 8,
    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    flexShrink: 0,
  },
};

/* ── Page styles ──────────────────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' },

  /* Sidebar */
  sidebar: {
    width: 240, flexShrink: 0, background: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column',
    padding: '24px 16px', position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
  },
  sidebarTop: { flex: 1, display: 'flex', flexDirection: 'column' },
  logoWrap: { display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', marginBottom: 8 },
  logoText: { fontSize: 20, fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-0.5px' },
  logoDot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', opacity: 0.7, marginBottom: 2 },
  divider: { height: 1, background: 'var(--color-border)', margin: '8px 0 16px' },
  nav: { display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
    borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 500,
    color: 'var(--color-text-secondary)', textDecoration: 'none', position: 'relative',
  },
  navItemActive: { background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontWeight: 700 },
  soonPill: { marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '2px 5px', letterSpacing: 0.5 },
  navIcon: { width: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  activeDot: { marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)' },
  logoutBtn: {
    fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'none',
    padding: '8px 12px', display: 'block', textAlign: 'center',
    borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
  },

  /* Main */
  main: { flex: 1, padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 20 },
  topBar: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  backBtn: {
    background: 'none', border: 'none', fontSize: 13, color: 'var(--color-text-secondary)',
    cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 8, display: 'block',
  },
  title: { fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px' },
  sub: { fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 },
  /* Reset replaces the old gradient Search button — a secondary action, so it
     is outlined rather than filled and never competes with the results. */
  resetBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 16px', background: 'var(--color-surface)',
    color: 'var(--color-text-secondary)',
    border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-full)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  resetBtnIdle: { opacity: 0.45, cursor: 'default' },

  /* Filter bar */
  filterBar: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: 8,
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', padding: '12px 16px',
  },
  searchWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchIcon: {
    position: 'absolute', left: 11, color: 'var(--color-text-secondary)', pointerEvents: 'none',
  },
  searchInput: {
    padding: '8px 14px 8px 33px', fontSize: 13, borderRadius: 8,
    border: '1.5px solid var(--color-border)',
    fontFamily: 'inherit', outline: 'none', color: 'var(--color-text-primary)',
    minWidth: 220, background: 'var(--color-surface)',
  },
  /* One shape for every filter control, so the bar reads as a single set. */
  filterBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 34, padding: '0 12px',
    border: '1.5px solid var(--color-border)', borderRadius: 8,
    background: 'var(--color-surface)', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text-primary)',
    whiteSpace: 'nowrap',
  },
  /* Active state is the SAME for every filter — brand tint, no per-filter
     colour. The green/blue/purple mix was most of what made this look busy. */
  filterBtnOn: {
    borderColor: 'rgba(106,121,255,0.55)',
    background: 'var(--color-primary-light)',
    color: 'var(--color-primary)', fontWeight: 700,
  },
  selectWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  selectIcon: {
    position: 'absolute', left: 11, color: 'var(--color-text-secondary)', pointerEvents: 'none',
  },
  selectInput: {
    height: 34, padding: '0 12px 0 33px', appearance: 'none',
    border: '1.5px solid var(--color-border)', borderRadius: 8,
    background: 'var(--color-surface)', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text-primary)',
  },
  availDot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' },
  dayGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 },
  dayChip: {
    padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
  },
  dayChipActive: { background: 'var(--color-primary-light)', borderColor: 'rgba(106,121,255,0.5)', color: 'var(--color-primary)' },
  activeChip: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', borderRadius: 20,
    background: 'var(--color-primary-light)', color: 'var(--color-primary)',
    fontSize: 12, fontWeight: 600, border: '1px solid rgba(106,121,255,0.3)',
  },
  chipRemove: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
    color: 'var(--color-primary)', fontSize: 11, fontWeight: 700,
  },

  // Skills dropdown
  /* Click-away layer — the dropdowns previously only closed via their own
     Apply button, which no longer exists now that filters self-apply. */
  backdrop: { position: 'fixed', inset: 0, zIndex: 90 },
  dropdown: {
    position: 'absolute', top: '110%', left: 0, zIndex: 100,
    background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 300,
    display: 'flex', flexDirection: 'column',
  },
  dropdownInner: {
    maxHeight: 300, overflowY: 'auto', padding: '12px 16px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  checkRow: {
    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
  },
  cvAction: {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3,
    opacity: 0.75,
  },

  /* Results */
  resultsMeta: { fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },

  /* Worker card */
  card: {
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 12, padding: '16px', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', gap: 10,
    boxShadow: 'var(--shadow-sm)', transition: 'box-shadow 0.15s',
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10 },
  cardPhoto: { width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' as const, flexShrink: 0 },
  cardAvatar: {
    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
    background: 'var(--color-primary-light)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 700, color: 'var(--color-primary)',
  },
  cardName: { fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 },
  starsRow: { display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 },
  ratingNum: { fontSize: 12, fontWeight: 700, color: '#1e1b4b' },
  ratingCnt: { fontSize: 11, color: '#6b7280' },
  scoreChip: {
    fontSize: 11, fontWeight: 700, color: 'var(--color-primary)',
    padding: '3px 8px', borderRadius: 20, flexShrink: 0, marginLeft: 'auto',
  },
  badgeRow: { display: 'flex', gap: 4, flexWrap: 'wrap' as const },
  badge: { fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#fef9c3', border: '1px solid #fde68a', color: '#92400e' },
  bio: { fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0, fontStyle: 'italic' as const },
  skillRow: { display: 'flex', flexWrap: 'wrap' as const, gap: 5 },
  skill: {
    fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
    background: 'var(--color-primary-light)', color: 'var(--color-primary)',
    border: '1px solid rgba(106,121,255,0.2)',
  },
  more: { fontSize: 11, color: 'var(--color-text-secondary)', padding: '3px 4px', fontWeight: 600 },
  expPill: {
    padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a',
  },
  availPill: {
    padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0',
  },
  cardMeta: { display: 'flex', flexDirection: 'column' as const, gap: 3 },
  metaItem: { fontSize: 11, color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 },
  viewBtn: {
    marginTop: 4, padding: '8px 0', background: 'none',
    border: '1.5px solid var(--color-border)', borderRadius: 8,
    fontSize: 12, fontWeight: 700, color: 'var(--color-primary)',
    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' as const,
  },

  /* Empty state */
  empty: {
    gridColumn: '1 / -1', textAlign: 'center' as const,
    padding: '60px 20px',
  },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 },
  emptySub: { fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 8 },
};
