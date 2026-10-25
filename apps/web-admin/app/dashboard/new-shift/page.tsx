'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  SHIFT_CATEGORIES, ShiftCategory, LANGUAGES, calculateTSU,
  PAYMENT_METHOD_LABELS, PaymentMethod, RECOMMENDED_PAYMENT_METHOD,
  MAX_SERIES_DAYS, TURNOS_FEE_FIXED_EUR,
  getRole, roleMaxLevel, roleTaskIds, roleCategory, normalizeSkill, ROLE_CERTIFICATE_LABELS,
} from '@turnos/shared';
import { adminApi, ApiError } from '../../../lib/api';
import { useT } from '../../../lib/i18n';
import { LanguageSwitcher } from '../../../components/LanguageSwitcher';
import { MultiSelect } from '../../../components/MultiSelect';
import { Breadcrumbs } from '../../../components/PageNav';
import { IconShield, IconCheck, IconCalendar, IconAlert, IconUsers } from '../../../components/icons';

type GeoResult = { lat: number; lng: number; display: string } | null;

// NOTE: this header goes to Nominatim (OpenStreetMap), NOT the Turnos API — it
// picks the language of the returned place names. Kept at 'pt' deliberately:
// the address is stored and shown to workers who will physically go there, and
// a Portuguese street name is what the signage and their map app will say.
async function geocodeAddress(address: string): Promise<GeoResult> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=pt`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'pt' } });
  const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;
  const first = data[0];
  if (!first) return null;
  return { lat: parseFloat(first.lat), lng: parseFloat(first.lon), display: first.display_name };
}

// ── Role requirements — level cards, tasks, live match count ─────────────────

function RoleRequirements({
  role, level, onLevel, tasks, onTasks, languages,
}: {
  role: string;
  level: number;
  onLevel: (level: number) => void;
  tasks: string[];
  onTasks: (tasks: string[]) => void;
  languages: string[];
}) {
  const { t, tRoleLevel, tTask, language } = useT();
  const def = getRole(role);
  const maxLevel = roleMaxLevel(role);
  const [count, setCount] = useState<number | null>(null);

  // Live count of workers who could take it — debounced, refetched on any change
  const langKey = languages.join(',');
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      adminApi.matchCount(role, level, langKey ? langKey.split(',') : [])
        .then(r => { if (!cancelled) setCount(r.count); })
        .catch(() => { if (!cancelled) setCount(null); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [role, level, langKey]);

  if (!def) return null;
  const toggleTask = (id: string) =>
    onTasks(tasks.includes(id) ? tasks.filter(x => x !== id) : [...tasks, id]);

  return (
    <>
      {/* ── Level ── */}
      <div style={rr.block}>
        <h2 style={rr.blockTitle}>{t('admin.newShift.levelSection')}</h2>
        <p style={rr.hint}>{t('admin.newShift.levelHint')}</p>
        {def.certificate && (
          <div style={rr.certificate}>
            <IconShield size={14} />
            {t('admin.newShift.certificateRequired', { doc: ROLE_CERTIFICATE_LABELS[def.certificate][language] })}
          </div>
        )}
        {maxLevel === 1 ? (
          <div style={rr.single}>
            <strong>{tRoleLevel(role, 1)}</strong>
            <span style={rr.singleNote}>{t('admin.newShift.singleLevel')}</span>
          </div>
        ) : (
          <div style={{ ...rr.levels, gridTemplateColumns: `repeat(${maxLevel}, 1fr)` }}>
            {Array.from({ length: maxLevel }, (_, i) => i + 1).map(n => {
              const active = level === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onLevel(n)}
                  style={{ ...rr.levelCard, ...(active ? rr.levelCardActive : {}) }}
                >
                  <span style={rr.levelHead}>
                    {active && <IconCheck size={13} />}
                    {t('admin.newShift.levelN', { level: n })}
                  </span>
                  <span style={rr.levelText}>{tRoleLevel(role, n)}</span>
                  {n === 1 && <span style={rr.levelOpen}>{t('admin.newShift.levelOpen')}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Tasks ── */}
      <div style={rr.block}>
        <h2 style={rr.blockTitle}>
          {t('admin.newShift.tasksSection')}
          <span style={rr.badge}>{t('admin.newShift.optional')}</span>
        </h2>
        <p style={rr.hint}>{t('admin.newShift.tasksHint')}</p>
        <div style={rr.tasks}>
          {def.tasks.map(task => {
            const on = tasks.includes(task.id);
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => toggleTask(task.id)}
                style={{ ...rr.task, ...(on ? rr.taskOn : {}) }}
              >
                {on ? '✓ ' : '+ '}{tTask(role, task.id)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Who this reaches ── */}
      {count !== null && (
        <div style={{ ...rr.count, ...(count === 0 && level > 1 ? rr.countNone : {}) }}>
          <IconUsers size={15} />
          <span>
            {level <= 1
              ? t('admin.newShift.matchCountOpen', { count })
              : count === 0
                ? t('admin.newShift.matchCountNone')
                : count === 1
                  ? t('admin.newShift.matchCountOne')
                  : t('admin.newShift.matchCountOther', { count })}
          </span>
        </div>
      )}
    </>
  );
}

const rr: Record<string, React.CSSProperties> = {
  block: { display: 'flex', flexDirection: 'column', gap: 10 },
  blockTitle: {
    fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)',
    display: 'flex', alignItems: 'center', gap: 10, margin: 0,
  },
  hint: { fontSize: 12, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 },
  badge: {
    fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
    background: 'var(--color-secondary)', border: '1px solid var(--color-border)',
    borderRadius: 20, padding: '2px 8px',
  },
  certificate: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600,
    color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d',
    borderRadius: 8, padding: '8px 12px',
  },
  levels: { display: 'grid', gap: 10 },
  levelCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, textAlign: 'left',
    padding: '12px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--color-border)', background: '#fff',
  },
  levelCardActive: { borderWidth: '2px', borderColor: 'var(--color-primary)', background: 'var(--color-primary-light)' },
  levelHead: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 12, fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: 0.3,
  },
  levelText: { fontSize: 13, lineHeight: 1.45, color: 'var(--color-text-primary)' },
  levelOpen: { fontSize: 11, fontWeight: 600, color: '#15803d' },
  single: {
    display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13,
    border: '1.5px solid var(--color-border)', borderRadius: 10, padding: '12px 14px',
  },
  singleNote: { fontSize: 12, color: 'var(--color-text-secondary)' },
  tasks: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  task: {
    padding: '6px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--color-border)',
    background: 'var(--color-secondary)', color: 'var(--color-text-secondary)',
  },
  taskOn: {
    background: 'var(--color-primary-light)', borderColor: 'rgba(106,121,255,0.5)',
    color: 'var(--color-primary)',
  },
  count: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600,
    color: '#166534', background: '#f0fdf4',
    borderWidth: '1px', borderStyle: 'solid', borderColor: '#bbf7d0',
    borderRadius: 8, padding: '10px 12px',
  },
  countNone: { color: '#92400e', background: '#fffbeb', borderColor: '#fcd34d' },
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewShiftPage() {
  const router = useRouter();
  const { t, tCategory, tSkill, tWorkerLanguage, fShortDate, fDateRange } = useT();

  const [category, setCategory]   = useState<ShiftCategory>('Sala e Bar');
  const [subcategory, setSubcategory] = useState<string>(SHIFT_CATEGORIES['Sala e Bar'][0] ?? '');
  const [requiredLevel, setRequiredLevel] = useState(1);
  const [tasksRequired, setTasksRequired] = useState<string[]>([]);
  const [title, setTitle]         = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate]               = useState('');
  // Multi-day: `date` stays the first day; extraDates holds the rest. The API
  // creates one shift row per day, linked as a series, applied to as one job.
  const [isMultiDay, setIsMultiDay]   = useState(false);
  const [extraDates, setExtraDates]   = useState<string[]>([]);
  const [newExtraDate, setNewExtraDate] = useState('');
  const [startTime, setStartTime]     = useState('');
  const [durationHours, setDuration]  = useState(4); // default 4h, min 2h
  const [hourlyRate, setHourlyRate] = useState('8.00');
  const [address, setAddress]     = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [hasDressCode, setHasDressCode] = useState(false);
  const [dressCode, setDressCode]       = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(RECOMMENDED_PAYMENT_METHOD);

  // Set when the form was pre-filled from an expired shift ("Re-publicar")
  const [isRepost, setIsRepost] = useState(false);

  // Pre-fill form when re-posting a caducated shift
  useEffect(() => {
    const raw = sessionStorage.getItem('repost_shift');
    if (!raw) return;
    sessionStorage.removeItem('repost_shift');
    try {
      const sh = JSON.parse(raw);
      setIsRepost(true);
      // Older shifts may carry a renamed role — read it through the aliases
      const role = sh.subcategory ? normalizeSkill(sh.subcategory) : '';
      const roleCat = role ? roleCategory(role) : undefined;
      if (roleCat) {
        setCategory(roleCat);
        setSubcategory(role);
        setRequiredLevel(Math.min(Number(sh.requiredLevel) || 1, roleMaxLevel(role)));
        const valid = new Set(roleTaskIds(role));
        setTasksRequired((sh.tasksRequired ?? []).filter((id: string) => valid.has(id)));
      }
      if (sh.title) setTitle(sh.title);
      if (sh.description) setDescription(sh.description);
      if (sh.grossHourlyRate) setHourlyRate(String(Number(sh.grossHourlyRate).toFixed(2)));
      if (sh.address) setAddress(sh.address);
      if (sh.languagesRequired?.length) setSelectedLanguages(sh.languagesRequired);
      if (sh.hasDressCode && sh.dressCode) {
        setHasDressCode(true);
        setDressCode(sh.dressCode);
      }
      if (sh.paymentMethod && sh.paymentMethod in PAYMENT_METHOD_LABELS) {
        setPaymentMethod(sh.paymentMethod as PaymentMethod);
      }
      // The address was already geocoded once — reuse it instead of making the
      // company press "find address" again for the same place.
      if (sh.address && sh.lat != null && sh.lng != null) {
        setGeo({ lat: Number(sh.lat), lng: Number(sh.lng), display: sh.address });
      }
      // Neither the date nor the start time is copied: the reason to re-post
      // is that the old slot passed, so the company picks a new one. The
      // length of the shift is kept — it usually doesn't change.
      if (sh.startTime && sh.endTime) {
        const [sh_, sm_] = sh.startTime.split(':').map(Number);
        const [eh_, em_] = sh.endTime.split(':').map(Number);
        let mins = ((eh_ ?? 0) * 60 + (em_ ?? 0)) - ((sh_ ?? 0) * 60 + (sm_ ?? 0));
        if (mins < 0) mins += 24 * 60; // overnight — 20:00→00:00 is 4h, not −20h
        if (mins >= 120) setDuration(Math.round(mins / 60));
      }
    } catch { /* ignore parse errors */ }
  }, []);
  const [geo, setGeo]             = useState<GeoResult>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoError, setGeoError]   = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]         = useState('');

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cat = e.target.value as ShiftCategory;
    setCategory(cat);
    changeRole(SHIFT_CATEGORIES[cat][0] ?? '');
  };

  // Level and tasks belong to one role — start fresh when it changes
  const changeRole = (role: string) => {
    setSubcategory(role);
    setRequiredLevel(1);
    setTasksRequired([]);
  };

  const handleGeocode = async () => {
    if (!address.trim()) return;
    setIsGeocoding(true);
    setGeoError('');
    setGeo(null);
    const result = await geocodeAddress(address);
    if (!result) setGeoError(t('admin.newShift.addressNotFound'));
    else setGeo(result);
    setIsGeocoding(false);
  };

  const rateNum = parseFloat(hourlyRate) || 0;
  const tsu = rateNum > 0 ? calculateTSU(rateNum) : null;

  // Every day of the job, first day included, deduplicated and ordered
  const allDates = [...new Set([date, ...(isMultiDay ? extraDates : [])].filter(Boolean))].sort();

  const addExtraDate = () => {
    if (!newExtraDate) return;
    if (newExtraDate === date || extraDates.includes(newExtraDate)) { setNewExtraDate(''); return; }
    if (allDates.length >= MAX_SERIES_DAYS) {
      setError(t('admin.newShift.maxDays', { max: MAX_SERIES_DAYS }));
      return;
    }
    setExtraDates([...extraDates, newExtraDate].sort());
    setNewExtraDate('');
  };

  // Compute end time from start + duration
  const computedEndTime = (() => {
    if (!startTime) return '';
    const [h, m] = startTime.split(':').map(Number);
    const totalMins = ((h ?? 0) * 60 + (m ?? 0) + durationHours * 60) % (24 * 60);
    const eh = Math.floor(totalMins / 60);
    const em = totalMins % 60;
    return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
  })();

  // Portuguese law alerts based on duration
  const lawAlert = (() => {
    if (durationHours >= 8) return {
      level: 'warn' as const,
      msg: t('admin.newShift.law8h'),
    };
    if (durationHours >= 4) return {
      level: 'info' as const,
      msg: t('admin.newShift.law4h'),
    };
    return null;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geo) { setError(t('admin.newShift.errGeo')); return; }
    if (durationHours < 2) { setError(t('admin.newShift.errDuration')); return; }
    if (!startTime) { setError(t('admin.newShift.errStart')); return; }
    if (hasDressCode && !dressCode.trim()) { setError(t('admin.newShift.errDressCode')); return; }
    setError('');
    setIsSubmitting(true);
    try {
      await adminApi.createShift({
        title: title || subcategory,
        description,
        category,
        subcategory,
        role: title || undefined,
        date: allDates[0] ?? date,
        dates: allDates.length > 1 ? allDates : undefined,
        startTime: `${startTime}:00`,
        endTime: `${computedEndTime}:00`,
        grossHourlyRate: rateNum,
        address,
        lat: geo.lat,
        lng: geo.lng,
        // Matching runs on role + level (+ tasks for ranking); skillsRequired
        // is just the role, kept for clients that still read it.
        skillsRequired: [subcategory],
        requiredLevel,
        tasksRequired: tasksRequired.length ? tasksRequired : undefined,
        languagesRequired: selectedLanguages.length > 0 ? selectedLanguages : undefined,
        hasDressCode,
        dressCode: hasDressCode ? dressCode.trim() : null,
        paymentMethod,
      });
      router.push('/dashboard/shifts');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.newShift.errSubmit'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={s.page}>
      <Breadcrumbs trail={[
        { label: t('admin.nav.shifts'), href: '/dashboard/shifts' },
        { label: t('admin.newShift.title') },
      ]} />
      <div style={s.header}>
        <div>
          <h1 style={s.title}>{t('admin.newShift.title')}</h1>
          <p style={s.sub}>{t('admin.newShift.sub')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <LanguageSwitcher />
        </div>
      </div>

      {isRepost && (
        <div style={s.repostBanner}><IconCalendar size={15} /> {t('admin.newShift.repostBanner')}</div>
      )}
      {error && <div style={s.errorBanner}><IconAlert size={15} /> {error}</div>}

      <form onSubmit={handleSubmit} style={s.form}>

        {/* ── Role & Category ── */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>{t('admin.newShift.roleSection')}</h2>
          <div style={s.grid2}>
            <div style={s.field}>
              <label style={s.label}>{t('admin.newShift.labelCategory')}</label>
              {/* value stays the stored PT category */}
              <select style={s.select} value={category} onChange={handleCategoryChange}>
                {Object.keys(SHIFT_CATEGORIES).map(cat => (
                  <option key={cat} value={cat}>{tCategory(cat)}</option>
                ))}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>{t('admin.newShift.labelRole')}</label>
              <select style={s.select} value={subcategory} onChange={e => changeRole(e.target.value)}>
                {SHIFT_CATEGORIES[category].map(sub => (
                  <option key={sub} value={sub}>{tSkill(sub)}</option>
                ))}
              </select>
            </div>
            <div style={{ ...s.field, gridColumn: '1 / -1' }}>
              <label style={s.label}>{t('admin.newShift.labelTitle')} <span style={s.optional}>{t('common.optional')}</span></label>
              <input
                style={s.input}
                type="text"
                placeholder={t('admin.newShift.titlePlaceholder')}
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
            <div style={{ ...s.field, gridColumn: '1 / -1' }}>
              <label style={s.label}>{t('admin.newShift.labelDescription')}</label>
              <textarea
                style={{ ...s.input, height: 90, resize: 'vertical' }}
                required
                placeholder={t('admin.newShift.descPlaceholder')}
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Level & tasks — what the worker must be able to do ── */}
        <div style={s.section}>
          <RoleRequirements
            role={subcategory}
            level={requiredLevel}
            onLevel={setRequiredLevel}
            tasks={tasksRequired}
            onTasks={setTasksRequired}
            languages={selectedLanguages}
          />
        </div>

        {/* ── Languages ── */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>
            {t('admin.newShift.languagesSection')}
            <span style={s.sectionBadge}>{t('admin.newShift.optional')}</span>
          </h2>
          <p style={s.sectionHint}>{t('admin.newShift.languagesHint')}</p>
          <MultiSelect
            options={LANGUAGES as readonly string[]}
            selected={selectedLanguages}
            onChange={setSelectedLanguages}
            label={tWorkerLanguage}
            placeholder={t('admin.newShift.languagesPlaceholder')}
            countLabel={n => t('admin.newShift.languagesCount', { count: n })}
          />
        </div>

        {/* ── Dress code ── */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>
            {t('admin.newShift.dressCodeSection')}
            <span style={s.sectionBadge}>{t('admin.newShift.optional')}</span>
          </h2>
          <p style={s.sectionHint}>{t('admin.newShift.dressCodeHint')}</p>
          <div style={s.multiDayBox}>
            <label style={s.multiDayToggle}>
              <input
                type="checkbox"
                checked={hasDressCode}
                onChange={e => {
                  setHasDressCode(e.target.checked);
                  if (!e.target.checked) setDressCode('');
                }}
              />
              <span><strong>{t('admin.newShift.dressCodeToggle')}</strong></span>
            </label>

            {hasDressCode && (
              <div style={s.multiDayBody}>
                <textarea
                  style={{ ...s.input, minHeight: 84, resize: 'vertical' as const, lineHeight: 1.5 }}
                  value={dressCode}
                  maxLength={300}
                  onChange={e => setDressCode(e.target.value)}
                  placeholder={t('admin.newShift.dressCodePlaceholder')}
                />
                <div style={s.dressCodeFoot}>
                  <span style={s.dressCodeTip}>{t('admin.newShift.dressCodeTip')}</span>
                  <span style={s.dressCodeCounter}>
                    {t('admin.newShift.dressCodeCounter', { count: dressCode.length })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Payment method ── */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>{t('admin.newShift.paymentSection')}</h2>
          <p style={s.sectionHint}>{t('admin.newShift.paymentHint')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(method => {
              const label = t(`domain.paymentMethods.${method}`);
              const active = paymentMethod === method;
              const recommended = method === RECOMMENDED_PAYMENT_METHOD;
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    border: active ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                    background: active ? 'var(--color-primary-light)' : 'var(--color-surface)',
                    color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  }}
                >
                  {active && <IconCheck size={14} />}{label}
                  {recommended && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                      background: active ? 'var(--color-primary)' : 'var(--color-primary-light)',
                      color: active ? '#fff' : 'var(--color-primary)',
                    }}>
                      {t('admin.newShift.recommended')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {paymentMethod === 'TURNOS_PAY_LINK' && (
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 8 }}>
              {t('admin.newShift.payLinkNote')}
            </p>
          )}
          {(paymentMethod === 'TRANSFERENCIA' || paymentMethod === 'MBWAY') && (
            <p style={{ fontSize: 12, color: '#b45309', marginTop: 8 }}>
              {t('admin.newShift.manualPayNote')}
            </p>
          )}
        </div>

        {/* ── Date & Time ── */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>
            {t('admin.newShift.dateSection')}
            <span style={s.minShiftBadge}>{t('admin.newShift.minBadge')}</span>
          </h2>

          <div style={s.grid3}>
            {/* Date */}
            <div style={s.field}>
              <label style={s.label}>{isMultiDay ? t('admin.newShift.labelFirstDay') : t('admin.newShift.labelDate')}</label>
              <input
                style={s.input}
                type="date"
                required
                min={new Date().toISOString().slice(0, 10)}
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>

            {/* Start time — dropdown */}
            <div style={s.field}>
              <label style={s.label}>{t('admin.newShift.labelStart')}</label>
              <select
                style={s.select}
                required
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              >
                <option value="">{t('admin.newShift.pickTime')}</option>
                {Array.from({ length: 48 }, (_, i) => {
                  const h = Math.floor(i / 2);
                  const m = i % 2 === 0 ? '00' : '30';
                  const val = `${String(h).padStart(2, '0')}:${m}`;
                  return <option key={val} value={val}>{val}</option>;
                })}
              </select>
            </div>

            {/* Duration — dropdown */}
            <div style={s.field}>
              <label style={s.label}>{t('admin.newShift.labelDuration')}</label>
              <select
                style={s.select}
                value={durationHours}
                onChange={e => setDuration(Number(e.target.value))}
              >
                {[2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map(h => (
                  <option key={h} value={h}>{h}h {h === 2 ? t('admin.newShift.durationMin') : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Multi-day toggle + day list ── */}
          <div style={s.multiDayBox}>
            <label style={s.multiDayToggle}>
              <input
                type="checkbox"
                checked={isMultiDay}
                onChange={e => {
                  setIsMultiDay(e.target.checked);
                  if (!e.target.checked) setExtraDates([]);
                }}
              />
              <span>
                <strong>{t('admin.newShift.multiDayLabel')}</strong>
                <span style={s.multiDayHint}>{t('admin.newShift.multiDayHint')}</span>
              </span>
            </label>

            {isMultiDay && (
              <div style={s.multiDayBody}>
                <div style={s.multiDayAddRow}>
                  <input
                    style={{ ...s.input, maxWidth: 200 }}
                    type="date"
                    min={date || new Date().toISOString().slice(0, 10)}
                    value={newExtraDate}
                    onChange={e => setNewExtraDate(e.target.value)}
                  />
                  <button type="button" style={s.multiDayAddBtn} onClick={addExtraDate}>
                    {t('admin.newShift.addDay')}
                  </button>
                </div>

                {allDates.length > 0 && (
                  <>
                    <div style={s.multiDayChips}>
                      {allDates.map(d => (
                        <span key={d} style={s.multiDayChip}>
                          {fShortDate(d)}
                          {d !== date && (
                            <button
                              type="button"
                              style={s.multiDayChipX}
                              onClick={() => setExtraDates(extraDates.filter(x => x !== d))}
                              aria-label={t('admin.newShift.removeDay', { date: d })}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                    <div style={s.multiDaySummary}>
                      <IconCalendar size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                      <strong>
                        {allDates.length === 1
                          ? t('admin.newShift.daysOne')
                          : t('admin.newShift.daysOther', { count: allDates.length })}
                      </strong>
                      {allDates.length > 1 && <> · {fDateRange(allDates)}</>}
                      {' · '}
                      {t('admin.newShift.totalHours', { hours: (durationHours * allDates.length).toFixed(0) })}
                      {rateNum > 0 && <> · {t('admin.newShift.grossEstimate', { amount: (rateNum * durationHours * allDates.length).toFixed(2) })}</>}
                    </div>
                    {allDates.length > 1 && (
                      <div style={s.multiDayNote}>
                        {t('admin.newShift.feeNote1')}
                        <strong>{t('admin.newShift.feeNoteBold1', { fee: TURNOS_FEE_FIXED_EUR })}</strong>
                        {t('admin.newShift.feeNote2')}
                        <strong>{t('admin.newShift.feeNoteBold2')}</strong>
                        {t('admin.newShift.feeNote3')}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Computed end time display */}
          {startTime && computedEndTime && (
            <div style={s.computedTime}>
              <span style={s.computedLabel}>{t('admin.newShift.endLabel')}</span>
              <span style={s.computedValue}>{startTime} → {computedEndTime}</span>
              <span style={s.computedDuration}>{t('admin.newShift.endDuration', { hours: durationHours })}</span>
              {computedEndTime < startTime && (
                <span style={s.nextDayBadge}>{t('admin.newShift.nextDay')}</span>
              )}
            </div>
          )}

          {/* Portuguese labour law alerts */}
          {lawAlert && (
            <div style={{
              ...s.lawAlert,
              background: lawAlert.level === 'warn' ? '#fffbeb' : '#eff6ff',
              borderColor: lawAlert.level === 'warn' ? '#fcd34d' : '#93c5fd',
              color: lawAlert.level === 'warn' ? '#92400e' : '#1d4ed8',
            }}>
              {lawAlert.msg}
            </div>
          )}
        </div>

        {/* ── Location ── */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>{t('admin.newShift.locationSection')}</h2>
          <div style={s.field}>
            <label style={s.label}>{t('admin.newShift.labelAddress')}</label>
            <div style={s.addrRow}>
              <input
                style={{ ...s.input, flex: 1 }}
                type="text"
                required
                placeholder={t('admin.newShift.addressPlaceholder')}
                value={address}
                onChange={e => { setAddress(e.target.value); setGeo(null); setGeoError(''); }}
              />
              <button type="button" style={s.geocodeBtn} onClick={handleGeocode} disabled={!address.trim() || isGeocoding}>
                {isGeocoding ? '...' : t('admin.newShift.verifyAddress')}
              </button>
            </div>
            {geoError && <p style={s.geoError}>{geoError}</p>}
            {geo && (
              <div style={s.geoSuccess}>
                <IconCheck size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                <strong>{geo.display.split(',').slice(0, 3).join(',')}</strong>
                <span style={s.geoCoords}> ({geo.lat.toFixed(4)}, {geo.lng.toFixed(4)})</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Pay & TSU ── */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>{t('admin.newShift.paySection')}</h2>
          <div style={s.grid2}>
            <div style={s.field}>
              <label style={s.label}>{t('admin.newShift.labelRate')}</label>
              <input
                style={{ ...s.input, fontSize: 22, fontWeight: 700 }}
                type="number"
                step="0.10"
                min="5.00"
                required
                value={hourlyRate}
                onChange={e => setHourlyRate(e.target.value)}
              />
              <p style={s.hint}>{t('admin.newShift.minWageHint')}</p>
            </div>
            {tsu && (
              <div style={s.tsuBox}>
                <div style={s.tsuRow}>
                  <span>{t('admin.newShift.tsuGross')}</span>
                  <span style={s.tsuVal}>€{tsu.grossAmount.toFixed(2)}/hr</span>
                </div>
                <div style={s.tsuRow}>
                  <span>{t('admin.newShift.tsuEmployer')}</span>
                  <span style={s.tsuVal}>€{tsu.employerContribution.toFixed(2)}/hr</span>
                </div>
                <div style={{ ...s.tsuRow, ...s.tsuTotal }}>
                  <span>{t('admin.newShift.tsuTotal')}</span>
                  <span>€{tsu.employerTotalCost.toFixed(2)}/hr</span>
                </div>
                {startTime && (
                  <div style={{ ...s.tsuRow, marginTop: 8, color: '#6366f1' }}>
                    <span>{t('admin.newShift.tsuShiftCost', { hours: durationHours })}</span>
                    <span style={{ fontWeight: 700 }}>€{(tsu.employerTotalCost * durationHours).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={s.actions}>
          <button type="button" style={s.cancelBtn} onClick={() => router.push('/dashboard/shifts')}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            style={{ ...s.submitBtn, opacity: isSubmitting ? 0.65 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? t('admin.newShift.submitting') : t('admin.newShift.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: 32, maxWidth: 900, margin: '0 auto' },
  repostBanner: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
    background: 'var(--color-primary-light)', border: '1px solid rgba(106,121,255,0.3)', borderRadius: 10,
    padding: '12px 14px', fontSize: 13.5, fontWeight: 600, color: 'var(--color-primary)',
  },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 },
  title: { fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px', marginBottom: 4 },
  sub: { fontSize: 14, color: 'var(--color-text-secondary)', maxWidth: 500 },
  backBtn: {
    padding: '8px 16px', background: 'none', border: '1.5px solid var(--color-border)',
    borderRadius: 8, color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
  },
  errorBanner: {
    background: '#fee2e2', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8,
    padding: '12px 16px', fontSize: 13, color: '#ef4444', marginBottom: 24,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 24 },
  section: {
    background: '#fff', borderRadius: 12, border: '1px solid var(--color-border)',
    padding: 24, display: 'flex', flexDirection: 'column', gap: 16,
  },
  sectionTitle: {
    fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4,
    display: 'flex', alignItems: 'center', gap: 10,
  },
  sectionBadge: {
    fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
    background: 'var(--color-secondary)', border: '1px solid var(--color-border)',
    borderRadius: 20, padding: '2px 8px',
  },
  sectionHint: { fontSize: 12, color: 'var(--color-text-secondary)', marginTop: -8 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' },
  optional: { fontWeight: 400, color: 'var(--color-text-secondary)' },
  input: {
    padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1.5px solid var(--color-border)',
    fontFamily: 'inherit', outline: 'none', color: 'var(--color-text-primary)', width: '100%',
    boxSizing: 'border-box' as const,
  },
  select: {
    padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1.5px solid var(--color-border)',
    fontFamily: 'inherit', outline: 'none', color: 'var(--color-text-primary)', background: '#fff',
  },
  hint: { fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 },
  hoursHint: { fontSize: 13, color: 'var(--color-text-secondary)', marginTop: -8 },

  // Min shift badge
  minShiftBadge: {
    fontSize: 11, fontWeight: 600, color: '#d97706',
    background: '#fffbeb', border: '1px solid #fcd34d',
    borderRadius: 20, padding: '2px 10px', marginLeft: 10,
  },

  // Multi-day series
  multiDayBox: {
    border: '1px solid var(--color-neutral)', borderRadius: 10,
    padding: '12px 14px', background: '#fafafa',
  },
  multiDayToggle: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    fontSize: 13, color: 'var(--color-text-primary)', cursor: 'pointer', lineHeight: 1.5,
  },
  multiDayHint: { color: 'var(--color-text-secondary)', fontWeight: 400 },
  dressCodeFoot: {
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
    gap: 12, flexWrap: 'wrap' as const,
  },
  dressCodeTip: { fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, flex: 1 },
  dressCodeCounter: { fontSize: 11, color: 'var(--color-text-secondary)', flexShrink: 0 },
  multiDayBody: { marginTop: 12, display: 'flex', flexDirection: 'column' as const, gap: 10 },
  multiDayAddRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const },
  multiDayAddBtn: {
    fontSize: 13, fontWeight: 700, color: 'var(--color-primary)',
    background: '#fff', border: '1px solid var(--color-primary)',
    borderRadius: 8, padding: '9px 14px', cursor: 'pointer',
  },
  multiDayChips: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  multiDayChip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 12, fontWeight: 600, color: '#1d4ed8',
    background: '#dbeafe', border: '1px solid #bfdbfe',
    borderRadius: 20, padding: '4px 10px',
  },
  multiDayChipX: {
    border: 'none', background: 'transparent', cursor: 'pointer',
    color: '#1d4ed8', fontSize: 15, lineHeight: 1, padding: 0, fontWeight: 700,
  },
  multiDaySummary: {
    fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)',
    background: '#fff', border: '1px solid var(--color-neutral)',
    borderRadius: 8, padding: '8px 12px',
  },
  multiDayNote: {
    fontSize: 12, lineHeight: 1.6, color: '#166534',
    background: '#f0fdf4', border: '1px solid #bbf7d0',
    borderRadius: 8, padding: '8px 12px',
  },

  // Computed end time
  computedTime: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const,
    background: 'var(--color-primary-light)', borderRadius: 8,
    padding: '10px 14px', marginTop: -4,
  },
  computedLabel: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' },
  computedValue: { fontSize: 15, fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-0.3px' },
  computedDuration: { fontSize: 12, color: 'var(--color-text-secondary)' },
  nextDayBadge: {
    fontSize: 10, fontWeight: 700, color: '#7c3aed',
    background: '#ede9fe', borderRadius: 20, padding: '2px 8px',
  },

  // Portuguese law alert
  lawAlert: {
    fontSize: 12, fontWeight: 500, lineHeight: 1.6,
    padding: '10px 14px', borderRadius: 8, borderWidth: '1px', borderStyle: 'solid',
    marginTop: 4,
  },
  addrRow: { display: 'flex', gap: 10 },
  geocodeBtn: {
    padding: '10px 16px', background: 'var(--color-primary-light)', border: '1px solid rgba(106,121,255,0.3)',
    borderRadius: 8, color: 'var(--color-primary)', fontWeight: 600, fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
  },
  geoError: { fontSize: 12, color: '#ef4444', marginTop: 4 },
  geoSuccess: {
    fontSize: 12, color: '#16a34a', marginTop: 6, background: '#dcfce7',
    padding: '8px 12px', borderRadius: 6, border: '1px solid #86efac',
  },
  geoCoords: { color: '#15803d', fontSize: 11 },
  tsuBox: {
    background: '#f0f4ff', borderRadius: 10, padding: 16,
    border: '1px solid rgba(99,102,241,0.2)', display: 'flex', flexDirection: 'column', gap: 8,
    fontSize: 13, color: '#1e1b4b',
  },
  tsuRow: { display: 'flex', justifyContent: 'space-between' },
  tsuVal: { color: '#4338ca' },
  tsuTotal: { fontWeight: 700, fontSize: 14, borderTop: '1px solid rgba(99,102,241,0.2)', paddingTop: 8, marginTop: 2 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 12, paddingBottom: 40 },
  cancelBtn: {
    padding: '12px 24px', background: 'none', border: '1.5px solid var(--color-border)',
    borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', color: 'var(--color-text-secondary)',
  },
  submitBtn: {
    padding: '12px 28px', background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
    color: '#fff', fontFamily: 'inherit',
  },
};
