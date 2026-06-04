'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SHIFT_CATEGORIES, ShiftCategory, LANGUAGES } from '@turnos/shared';
import { adminApi, WorkerSearchResult, Shift, ApiError } from '../../../lib/api';

// ── Sidebar nav (same structure as home page) ──────────────────────────────────

const SIDEBAR_NAV = [
  { icon: '🏠', label: 'Dashboard',         href: '/dashboard' },
  { icon: '📋', label: 'Turnos',             href: '/dashboard/shifts' },
  { icon: '🔍', label: 'Procurar Workers',   href: '/dashboard/workers-search' },
  { icon: '👷', label: 'Trabalhadores',      href: '/dashboard/workers' },
  { icon: '📲', label: 'QR Check-in',        href: '/dashboard/qr-codes' },
  { icon: '📊', label: 'Conformidade',       href: '/dashboard/compliance' },
  { icon: '💶', label: 'Gastos',             href: '/dashboard/spending' },
  { icon: '💳', label: 'Faturação',          href: '/dashboard/billing' },
];

const ALL_SKILLS = [...new Set(
  (Object.values(SHIFT_CATEGORIES) as unknown as string[][]).flat()
)].sort();

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
  const [inviting, setInviting]       = useState(false);
  const [selectedShift, setSelectedShift] = useState('');
  const [invited, setInvited]         = useState(false);

  const openShifts = myShifts.filter(s => s.status === 'OPEN');
  const avgR = worker.avgRating != null ? Number(worker.avgRating) : null;
  const filledStars = Math.round(avgR ?? 0);

  const handleInvite = async () => {
    if (!selectedShift) return;
    setInviting(true);
    try {
      await adminApi.inviteWorker(selectedShift, worker.id);
      setInvited(true);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erro ao convidar.');
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
              <h2 style={p.name}>{worker.fullName ?? 'Nome não definido'}</h2>
              {avgR != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <span style={{ color: '#fbbf24', fontSize: 14 }}>{'★'.repeat(filledStars)}{'☆'.repeat(5 - filledStars)}</span>
                  <span style={p.ratingVal}>{avgR.toFixed(1)}</span>
                  <span style={p.ratingCount}>({worker.totalRatings} aval.)</span>
                </div>
              )}
              <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {worker.badges?.includes('TOP_RATED') && <span style={p.badge}>🏆 Top Rated</span>}
                {worker.badges?.includes('RELIABLE')  && <span style={p.badge}>✅ Fiável</span>}
                {worker.badges?.includes('VERIFIED')  && <span style={p.badge}>✔️ Verificado</span>}
              </div>
            </div>
          </div>
          <button style={p.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={p.body}>
          {/* Profile completeness */}
          <div style={p.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={p.sectionTitle}>Perfil Completo</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: worker.profileQualityScore >= 80 ? '#16a34a' : '#d97706' }}>
                {worker.profileQualityScore}%
              </span>
            </div>
            <div style={p.barBg}><div style={{ ...p.barFill, width: `${worker.profileQualityScore}%` }} /></div>
          </div>

          {/* Bio */}
          {worker.bio && (
            <div style={p.section}>
              <div style={p.sectionTitle}>Apresentação</div>
              <p style={p.bio}>{worker.bio}</p>
            </div>
          )}

          {/* Skills */}
          {worker.skills && worker.skills.length > 0 && (
            <div style={p.section}>
              <div style={p.sectionTitle}>Competências</div>
              <div style={p.tags}>
                {worker.skills.map(sk => <span key={sk} style={p.tag}>{sk}</span>)}
              </div>
            </div>
          )}

          {/* Languages */}
          {worker.languages && worker.languages.length > 0 && (
            <div style={p.section}>
              <div style={p.sectionTitle}>Idiomas</div>
              <div style={p.tags}>
                {worker.languages.map(l => <span key={l} style={{ ...p.tag, background: '#f0fdf4', color: '#15803d' }}>{l}</span>)}
              </div>
            </div>
          )}

          {/* Availability */}
          {worker.availableDays && worker.availableDays.length > 0 && (
            <div style={p.section}>
              <div style={p.sectionTitle}>Disponibilidade</div>
              <div style={p.tags}>
                {worker.availableDays.map(d => <span key={d} style={{ ...p.tag, background: '#dbeafe', color: '#1d4ed8' }}>{d}</span>)}
              </div>
            </div>
          )}

          {/* Stats */}
          <div style={p.statsRow}>
            <div style={p.stat}>
              <div style={p.statVal}>{worker.noShowCount}</div>
              <div style={p.statLabel}>faltas</div>
            </div>
            <div style={p.stat}>
              <div style={p.statVal}>{worker.totalRatings}</div>
              <div style={p.statLabel}>avaliações</div>
            </div>
            <div style={p.stat}>
              <div style={p.statVal}>{worker.profileQualityScore}%</div>
              <div style={p.statLabel}>perfil</div>
            </div>
          </div>

          {/* Invite to shift */}
          <div style={p.inviteBox}>
            <div style={p.sectionTitle}>Convidar para um turno</div>
            {invited ? (
              <div style={p.inviteSuccess}>
                ✅ Convite enviado! O worker tem 2h para aceitar.
              </div>
            ) : openShifts.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Não tens turnos abertos. <Link href="/dashboard/new-shift" style={{ color: 'var(--color-primary)' }}>Publicar turno →</Link>
              </p>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <select
                  style={p.select}
                  value={selectedShift}
                  onChange={e => setSelectedShift(e.target.value)}
                >
                  <option value="">Seleciona um turno...</option>
                  {openShifts.map(sh => (
                    <option key={sh.id} value={sh.id}>
                      {sh.title || sh.subcategory} · {new Date(sh.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })} · {sh.startTime.slice(0,5)}
                    </option>
                  ))}
                </select>
                <button
                  style={{ ...p.inviteBtn, opacity: (!selectedShift || inviting) ? 0.6 : 1 }}
                  disabled={!selectedShift || inviting}
                  onClick={handleInvite}
                >
                  {inviting ? '...' : '⚡ Convidar'}
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

  const [workers, setWorkers]         = useState<WorkerSearchResult[]>([]);
  const [myShifts, setMyShifts]       = useState<Shift[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selected, setSelected]       = useState<WorkerSearchResult | null>(null);

  // Filters
  const [searchText, setSearchText]   = useState('');
  const [filterSkills, setFilterSkills] = useState<string[]>([]);
  const [filterLangs, setFilterLangs] = useState<string[]>([]);
  const [filterDays, setFilterDays]   = useState<string[]>([]);
  const [minRating, setMinRating]     = useState<number>(0);
  const [showSkillFilter, setShowSkillFilter] = useState(false);

  useEffect(() => {
    adminApi.getMyShifts().then(setMyShifts).catch(() => {});
    doSearch();
  }, []);

  const doSearch = useCallback(async () => {
    setLoading(true);
    try {
      const results = await adminApi.searchWorkers({
        skills:    filterSkills.length   ? filterSkills   : undefined,
        languages: filterLangs.length    ? filterLangs    : undefined,
        available: filterDays.length     ? filterDays     : undefined,
        minRating: minRating > 0         ? minRating      : undefined,
      });
      setWorkers(results);
    } catch {
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [filterSkills, filterLangs, filterDays, minRating]);

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

  const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <div style={s.shell}>

      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.sidebarTop}>
          <div style={s.logoWrap}>
            <span style={s.logoText}>turnos</span>
            <span style={s.logoDot} />
          </div>
          <div style={s.divider} />
          <nav style={s.nav}>
            {SIDEBAR_NAV.map(({ icon, label, href }) => {
              const active = href === '/dashboard/workers-search';
              return (
                <Link key={href} href={href}
                  style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}
                >
                  <span style={s.navIcon}>{icon}</span>
                  <span>{label}</span>
                  {active && <span style={s.activeDot} />}
                </Link>
              );
            })}
          </nav>
        </div>
        <Link href="/login" style={s.logoutBtn}>Sair →</Link>
      </aside>

      {/* Main */}
      <main style={s.main}>
        <header style={s.topBar}>
          <div>
            <button style={s.backBtn} onClick={() => router.push('/dashboard')}>← Dashboard</button>
            <h1 style={s.title}>Procurar Trabalhadores</h1>
            <p style={s.sub}>Workers com perfil ≥80% activos na plataforma</p>
          </div>
          <button style={s.searchBtn} onClick={doSearch} disabled={loading}>
            {loading ? 'A pesquisar...' : '🔍 Pesquisar'}
          </button>
        </header>

        {/* Filter bar */}
        <div style={s.filterBar}>
          {/* Text search */}
          <input
            style={s.searchInput}
            placeholder="Nome, competência ou bio..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />

          {/* Skills dropdown */}
          <div style={{ position: 'relative' }}>
            <button style={s.filterBtn} onClick={() => setShowSkillFilter(v => !v)}>
              🎯 Competências {filterSkills.length > 0 ? `(${filterSkills.length})` : ''}
            </button>
            {showSkillFilter && (
              <div style={s.skillDropdown}>
                <div style={s.skillDropdownInner}>
                  {ALL_SKILLS.map(sk => (
                    <label key={sk} style={s.checkRow}>
                      <input
                        type="checkbox"
                        checked={filterSkills.includes(sk)}
                        onChange={() => toggleFilter(filterSkills, setFilterSkills, sk)}
                      />
                      <span style={{ fontSize: 13 }}>{sk}</span>
                    </label>
                  ))}
                </div>
                <button style={s.applySkills} onClick={() => { setShowSkillFilter(false); doSearch(); }}>
                  Aplicar filtros
                </button>
              </div>
            )}
          </div>

          {/* Languages */}
          <select style={s.filterBtn} value="" onChange={e => { if (e.target.value) toggleFilter(filterLangs, setFilterLangs, e.target.value); }}>
            <option value="">🌐 Idioma{filterLangs.length > 0 ? ` (${filterLangs.length})` : ''}...</option>
            {(LANGUAGES as readonly string[]).map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          {/* Rating */}
          <select
            style={s.filterBtn}
            value={minRating}
            onChange={e => setMinRating(Number(e.target.value))}
          >
            <option value={0}>⭐ Qualquer avaliação</option>
            <option value={3}>⭐⭐⭐ 3+ estrelas</option>
            <option value={4}>⭐⭐⭐⭐ 4+ estrelas</option>
            <option value={4.5}>⭐⭐⭐⭐½ 4.5+ estrelas</option>
          </select>

          {/* Available days */}
          <div style={s.dayChips}>
            {DAYS.map(d => (
              <button
                key={d}
                style={{ ...s.dayChip, ...(filterDays.includes(d) ? s.dayChipActive : {}) }}
                onClick={() => toggleFilter(filterDays, setFilterDays, d)}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Active filter chips */}
          {[...filterSkills, ...filterLangs].map(f => (
            <span key={f} style={s.activeChip}>
              {f}
              <button style={s.chipRemove} onClick={() => {
                setFilterSkills(filterSkills.filter(x => x !== f));
                setFilterLangs(filterLangs.filter(x => x !== f));
              }}>✕</button>
            </span>
          ))}
        </div>

        {/* Results */}
        <div style={s.resultsMeta}>
          {loading ? 'A pesquisar...' : `${filtered.length} worker${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`}
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
                    <p style={s.cardName}>{w.fullName ?? 'Nome não definido'}</p>
                    {avgR != null && (
                      <div style={s.starsRow}>
                        <span style={{ color: '#fbbf24', fontSize: 12 }}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
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
                    {w.badges.includes('TOP_RATED') && <span style={s.badge}>🏆 Top</span>}
                    {w.badges.includes('RELIABLE')  && <span style={s.badge}>✅ Fiável</span>}
                    {w.badges.includes('VERIFIED')  && <span style={s.badge}>✔️ Verif.</span>}
                  </div>
                )}

                {/* Bio */}
                {w.bio && <p style={s.bio}>{w.bio}</p>}

                {/* Top skills */}
                {w.skills && w.skills.length > 0 && (
                  <div style={s.skillRow}>
                    {w.skills.slice(0, 3).map(sk => <span key={sk} style={s.skill}>{sk}</span>)}
                    {w.skills.length > 3 && <span style={s.more}>+{w.skills.length - 3}</span>}
                  </div>
                )}

                {/* Languages + availability */}
                <div style={s.cardMeta}>
                  {w.languages && w.languages.length > 0 && (
                    <span style={s.metaItem}>🌐 {w.languages.slice(0,2).join(', ')}{w.languages.length > 2 ? ` +${w.languages.length - 2}` : ''}</span>
                  )}
                  {w.availableDays && w.availableDays.length > 0 && (
                    <span style={s.metaItem}>📅 {w.availableDays.join(', ')}</span>
                  )}
                </div>

                <button style={s.viewBtn}>Ver perfil & convidar →</button>
              </div>
            );
          })}

          {!loading && filtered.length === 0 && (
            <div style={s.empty}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <p style={s.emptyTitle}>Nenhum worker encontrado</p>
              <p style={s.emptySub}>Tenta ajustar os filtros ou pesquisa por nome.</p>
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
  navIcon: { fontSize: 16, width: 20, textAlign: 'center' as const },
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
  searchBtn: {
    padding: '12px 24px', background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    color: '#fff', border: 'none', borderRadius: 'var(--radius-full)',
    fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  },

  /* Filter bar */
  filterBar: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: 8,
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', padding: '12px 16px',
  },
  searchInput: {
    padding: '8px 14px', fontSize: 13, borderRadius: 8, border: '1.5px solid var(--color-border)',
    fontFamily: 'inherit', outline: 'none', color: 'var(--color-text-primary)',
    minWidth: 220,
  },
  filterBtn: {
    padding: '7px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8,
    background: 'var(--color-surface)', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text-primary)',
  },
  dayChips: { display: 'flex', gap: 4 },
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
  skillDropdown: {
    position: 'absolute', top: '110%', left: 0, zIndex: 100,
    background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.1)', width: 300,
    display: 'flex', flexDirection: 'column',
  },
  skillDropdownInner: {
    maxHeight: 300, overflowY: 'auto', padding: '12px 16px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  checkRow: {
    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
  },
  applySkills: {
    margin: '8px 12px 12px', padding: '8px',
    background: 'var(--color-primary)', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
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
  cardMeta: { display: 'flex', flexDirection: 'column' as const, gap: 3 },
  metaItem: { fontSize: 11, color: 'var(--color-text-secondary)' },
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
