'use client';

/**
 * "Publicar vários turnos" — several roles at once, N workers each (a hotel's
 * Saturday: 2 waiters, 1 barman, 1 dishwasher). A separate page on purpose:
 * most companies post one role at a time, and "Publicar turno" stays exactly
 * as it is for them.
 *
 * What is common to the whole request is filled in once (name, dates, address,
 * payment, dress code, description); each row is a role with its quantity,
 * hours, rate, level, tasks and languages. The API creates one normal shift per
 * worker needed, all or nothing — see ShiftsService.createRequest.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SHIFT_CATEGORIES, ShiftCategory, LANGUAGES, calculateTSU,
  PAYMENT_METHOD_LABELS, PaymentMethod, RECOMMENDED_PAYMENT_METHOD,
  MAX_SERIES_DAYS, TURNOS_FEE_FIXED_EUR,
} from '@turnos/shared';
import { adminApi, ApiError } from '../../../lib/api';
import { useT } from '../../../lib/i18n';
import { LanguageSwitcher } from '../../../components/LanguageSwitcher';
import { MultiSelect } from '../../../components/MultiSelect';
import { Breadcrumbs } from '../../../components/PageNav';
import { RoleRequirements } from '../../../components/RoleRequirements';
import { geocodeAddress, type GeoResult } from '../../../lib/geocode';
import { IconAlert, IconCheck, IconCalendar, IconClose, IconClipboard } from '../../../components/icons';

const MAX_LINES = 10;
const MAX_QUANTITY = 10;
const DURATIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
const TIMES = Array.from({ length: 48 }, (_, i) =>
  `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`);

interface Line {
  key: number;
  category: ShiftCategory;
  role: string;
  level: number;
  tasks: string[];
  languages: string[];
  quantity: number;
  startTime: string;
  duration: number;
  rate: string;
  open: boolean;           // level / tasks / languages expanded
}

let nextKey = 1;
const newLine = (category: ShiftCategory = 'Sala e Bar'): Line => ({
  key: nextKey++,
  category,
  role: SHIFT_CATEGORIES[category][0] ?? '',
  level: 1,
  tasks: [],
  languages: [],
  quantity: 1,
  startTime: '',
  duration: 4,
  rate: '9.00',
  open: true,
});

const endOf = (start: string, hours: number) => {
  if (!start) return '';
  const [h, m] = start.split(':').map(Number);
  const mins = ((h ?? 0) * 60 + (m ?? 0) + hours * 60) % (24 * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
};

export default function NewRequestPage() {
  const router = useRouter();
  const { t, tCategory, tSkill, tWorkerLanguage, fShortDate } = useT();

  // ── Common to the whole request ─────────────────────────────────────────
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [dates, setDates]             = useState<string[]>([]);
  const [newDate, setNewDate]         = useState('');
  const [address, setAddress]         = useState('');
  const [geo, setGeo]                 = useState<GeoResult>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoError, setGeoError]       = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(RECOMMENDED_PAYMENT_METHOD);
  const [hasDressCode, setHasDressCode]   = useState(false);
  const [dressCode, setDressCode]         = useState('');

  // ── One row per role ─────────────────────────────────────────────────────
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (key: number, patch: Partial<Line>) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));

  const addDate = () => {
    if (!newDate || dates.includes(newDate)) { setNewDate(''); return; }
    if (dates.length >= MAX_SERIES_DAYS) { setError(t('admin.newShift.maxDays', { max: MAX_SERIES_DAYS })); return; }
    setDates([...dates, newDate].sort());
    setNewDate('');
  };

  const handleGeocode = async () => {
    if (!address.trim()) return;
    setIsGeocoding(true); setGeoError(''); setGeo(null);
    const result = await geocodeAddress(address);
    if (!result) setGeoError(t('admin.newShift.addressNotFound'));
    else setGeo(result);
    setIsGeocoding(false);
  };

  // ── Summary ──────────────────────────────────────────────────────────────
  const days = Math.max(1, dates.length);
  const totalShifts = lines.reduce((n, l) => n + l.quantity, 0);
  const grossTotal = lines.reduce((sum, l) => sum + l.quantity * l.duration * days * (parseFloat(l.rate) || 0), 0);
  const employerTotal = lines.reduce((sum, l) => {
    const rate = parseFloat(l.rate) || 0;
    return sum + (rate > 0 ? calculateTSU(rate).employerTotalCost * l.quantity * l.duration * days : 0);
  }, 0);

  const shiftsLabel = totalShifts === 1 ? t('admin.newRequest.shiftsOne') : t('admin.newRequest.shiftsOther', { count: totalShifts });
  const rolesLabel  = lines.length === 1 ? t('admin.newRequest.rolesOne') : t('admin.newRequest.rolesOther', { count: lines.length });

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) return setError(t('admin.newRequest.errName'));
    if (dates.length === 0) return setError(t('admin.newRequest.errDates'));
    if (!geo) return setError(t('admin.newShift.errGeo'));
    if (hasDressCode && !dressCode.trim()) return setError(t('admin.newShift.errDressCode'));
    const missingStart = lines.findIndex(l => !l.startTime);
    if (missingStart !== -1) return setError(t('admin.newRequest.errStart', { row: missingStart + 1 }));
    const badRate = lines.findIndex(l => !(parseFloat(l.rate) > 0));
    if (badRate !== -1) return setError(t('admin.newRequest.errRate', { row: badRate + 1 }));

    setIsSubmitting(true);
    try {
      await adminApi.createRequest({
        name: name.trim(),
        description: description.trim() || undefined,
        dates,
        address,
        lat: geo.lat,
        lng: geo.lng,
        paymentMethod,
        hasDressCode,
        dressCode: hasDressCode ? dressCode.trim() : null,
        lines: lines.map(l => ({
          subcategory: l.role,
          requiredLevel: l.level,
          tasksRequired: l.tasks.length ? l.tasks : undefined,
          quantity: l.quantity,
          startTime: `${l.startTime}:00`,
          endTime: `${endOf(l.startTime, l.duration)}:00`,
          grossHourlyRate: parseFloat(l.rate),
          languagesRequired: l.languages.length ? l.languages : undefined,
        })),
      });
      router.push('/dashboard/shifts');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.newShift.errSubmit'));
      setIsSubmitting(false);
    }
  };

  return (
    <div style={s.page}>
      <Breadcrumbs trail={[
        { label: t('admin.nav.shifts'), href: '/dashboard/shifts' },
        { label: t('admin.newRequest.title') },
      ]} />
      <div style={s.header}>
        <div>
          <h1 style={s.title}>{t('admin.newRequest.title')}</h1>
          <p style={s.sub}>{t('admin.newRequest.sub')}</p>
        </div>
        <LanguageSwitcher />
      </div>

      {error && <div style={s.errorBanner}><IconAlert size={15} /> {error}</div>}

      {/* ── Common to every role ── */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}><IconClipboard size={15} /> {t('admin.newRequest.commonSection')}</h2>
        <p style={s.hint}>{t('admin.newRequest.commonHint')}</p>
        <div style={s.field}>
          <label style={s.label}>{t('admin.newRequest.labelName')}</label>
          <input style={s.input} value={name} maxLength={120} onChange={e => setName(e.target.value)}
            placeholder={t('admin.newRequest.namePlaceholder')} />
        </div>

        <div style={s.field}>
          <label style={s.label}>{t('admin.newRequest.labelDates')}</label>
          <div style={s.row}>
            <input style={{ ...s.input, maxWidth: 200 }} type="date"
              min={new Date().toISOString().slice(0, 10)} value={newDate} onChange={e => setNewDate(e.target.value)} />
            <button type="button" style={s.secondaryBtn} onClick={addDate}>{t('admin.newShift.addDay')}</button>
          </div>
          {dates.length > 0 && (
            <div style={s.chips}>
              {dates.map(d => (
                <span key={d} style={s.chip}>
                  <IconCalendar size={12} /> {fShortDate(d)}
                  <button type="button" style={s.chipX} onClick={() => setDates(dates.filter(x => x !== d))}
                    aria-label={t('admin.newShift.removeDay', { date: d })}>×</button>
                </span>
              ))}
            </div>
          )}
          {dates.length > 1 && <p style={s.hint}>{t('admin.newRequest.multiDayHint', { count: dates.length })}</p>}
        </div>

        <div style={s.field}>
          <label style={s.label}>{t('admin.newShift.labelAddress')}</label>
          <div style={s.row}>
            <input style={{ ...s.input, flex: 1 }} value={address}
              onChange={e => { setAddress(e.target.value); setGeo(null); setGeoError(''); }}
              placeholder={t('admin.newShift.addressPlaceholder')} />
            <button type="button" style={s.secondaryBtn} onClick={handleGeocode} disabled={!address.trim() || isGeocoding}>
              {isGeocoding ? '...' : t('admin.newShift.verifyAddress')}
            </button>
          </div>
          {geoError && <p style={s.errText}>{geoError}</p>}
          {geo && <p style={s.okText}><IconCheck size={13} /> {geo.display.split(',').slice(0, 3).join(',')}</p>}
        </div>

        <div style={s.field}>
          <label style={s.label}>{t('admin.newShift.paymentSection')}</label>
          <div style={s.chips}>
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(method => {
              const active = paymentMethod === method;
              return (
                <button key={method} type="button" onClick={() => setPaymentMethod(method)}
                  style={{ ...s.choice, ...(active ? s.choiceOn : {}) }}>
                  {active && <IconCheck size={13} />} {t(`domain.paymentMethods.${method}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div style={s.field}>
          <label style={{ ...s.label, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={hasDressCode}
              onChange={e => { setHasDressCode(e.target.checked); if (!e.target.checked) setDressCode(''); }} />
            {t('admin.newShift.dressCodeToggle')}
          </label>
          {hasDressCode && (
            <textarea style={{ ...s.input, minHeight: 70 }} value={dressCode} maxLength={300}
              onChange={e => setDressCode(e.target.value)} placeholder={t('admin.newShift.dressCodePlaceholder')} />
          )}
        </div>

        <div style={s.field}>
          <label style={s.label}>{t('admin.newShift.labelDescription')} <span style={s.optional}>{t('common.optional')}</span></label>
          <textarea style={{ ...s.input, minHeight: 70 }} value={description}
            onChange={e => setDescription(e.target.value)} placeholder={t('admin.newRequest.descPlaceholder')} />
        </div>
      </div>

      {/* ── Roles ── */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>{t('admin.newRequest.rolesSection')}</h2>
        <p style={s.hint}>{t('admin.newRequest.rolesHint')}</p>

        {lines.map((l, i) => (
          <div key={l.key} style={s.lineCard}>
            <div style={s.lineHead}>
              <span style={s.lineNum}>{i + 1}</span>
              <strong style={{ flex: 1 }}>{tSkill(l.role)}</strong>
              {lines.length > 1 && (
                <button type="button" style={s.iconBtn} onClick={() => setLines(lines.filter(x => x.key !== l.key))}
                  aria-label={t('admin.newRequest.removeRole')}>
                  <IconClose size={14} />
                </button>
              )}
            </div>

            <div style={s.lineGrid}>
              <div style={s.field}>
                <label style={s.label}>{t('admin.newShift.labelCategory')}</label>
                <select style={s.select} value={l.category} onChange={e => {
                  const cat = e.target.value as ShiftCategory;
                  update(l.key, { category: cat, role: SHIFT_CATEGORIES[cat][0] ?? '', level: 1, tasks: [] });
                }}>
                  {(Object.keys(SHIFT_CATEGORIES) as ShiftCategory[]).map(cat =>
                    <option key={cat} value={cat}>{tCategory(cat)}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>{t('admin.newShift.labelRole')}</label>
                <select style={s.select} value={l.role}
                  onChange={e => update(l.key, { role: e.target.value, level: 1, tasks: [] })}>
                  {SHIFT_CATEGORIES[l.category].map(r => <option key={r} value={r}>{tSkill(r)}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>{t('admin.newRequest.labelQuantity')}</label>
                <select style={s.select} value={l.quantity} onChange={e => update(l.key, { quantity: Number(e.target.value) })}>
                  {Array.from({ length: MAX_QUANTITY }, (_, n) => n + 1).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>{t('admin.newShift.labelStart')}</label>
                <select style={s.select} value={l.startTime} onChange={e => update(l.key, { startTime: e.target.value })}>
                  <option value="">{t('admin.newShift.pickTime')}</option>
                  {TIMES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>{t('admin.newShift.labelDuration')}</label>
                <select style={s.select} value={l.duration} onChange={e => update(l.key, { duration: Number(e.target.value) })}>
                  {DURATIONS.map(h => <option key={h} value={h}>{h}h</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>{t('admin.newRequest.labelRate')}</label>
                <input style={s.input} type="number" step="0.10" min="5" value={l.rate}
                  onChange={e => update(l.key, { rate: e.target.value })} />
              </div>
            </div>
            {l.startTime && (
              <p style={s.hint}>{l.startTime} → {endOf(l.startTime, l.duration)} · {t('admin.newRequest.lineTotal', {
                count: l.quantity, amount: (l.quantity * l.duration * days * (parseFloat(l.rate) || 0)).toFixed(2),
              })}</p>
            )}

            <button type="button" style={s.expand} onClick={() => update(l.key, { open: !l.open })}>
              {l.open ? '▲' : '▼'} {t('admin.newRequest.requirements')}
            </button>
            {l.open && (
              <div style={s.requirements}>
                <RoleRequirements
                  role={l.role}
                  level={l.level}
                  onLevel={level => update(l.key, { level })}
                  tasks={l.tasks}
                  onTasks={tasks => update(l.key, { tasks })}
                  languages={l.languages}
                />
                <div style={s.field}>
                  <label style={s.label}>{t('admin.newShift.languagesSection')} <span style={s.optional}>{t('common.optional')}</span></label>
                  <MultiSelect
                    options={LANGUAGES as readonly string[]}
                    selected={l.languages}
                    onChange={languages => update(l.key, { languages })}
                    label={tWorkerLanguage}
                    placeholder={t('admin.newShift.languagesPlaceholder')}
                    countLabel={n => t('admin.newShift.languagesCount', { count: n })}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {lines.length < MAX_LINES && (
          <button type="button" style={s.addLine}
            onClick={() => setLines([...lines.map(l => ({ ...l, open: false })), newLine(lines[lines.length - 1]?.category)])}>
            + {t('admin.newRequest.addRole')}
          </button>
        )}
      </div>

      {/* ── Summary ── */}
      <div style={s.summary}>
        <div>
          <p style={s.summaryMain}>{t('admin.newRequest.summary', { shifts: shiftsLabel, roles: rolesLabel })}</p>
          <p style={s.summarySub}>
            {t('admin.newRequest.summaryCost', { gross: grossTotal.toFixed(2), total: employerTotal.toFixed(2) })}
            {dates.length > 1 && <> · {t('admin.newRequest.summaryDays', { count: dates.length })}</>}
          </p>
          <p style={s.summarySub}>{t('admin.newRequest.summaryQuota', { shifts: shiftsLabel, fee: TURNOS_FEE_FIXED_EUR })}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" style={s.secondaryBtn} onClick={() => router.push('/dashboard/shifts')}>{t('common.cancel')}</button>
          <button type="button" style={{ ...s.submit, opacity: isSubmitting ? 0.65 : 1 }} onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? t('admin.newShift.submitting') : t('admin.newRequest.submit', { shifts: shiftsLabel })}
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: 32, maxWidth: 960, margin: '0 auto', paddingBottom: 60 },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px', marginBottom: 4 },
  sub: { fontSize: 14, color: 'var(--color-text-secondary)', maxWidth: 560, lineHeight: 1.5 },
  errorBanner: {
    display: 'flex', alignItems: 'center', gap: 8, background: '#fee2e2',
    borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(239,68,68,0.2)', borderRadius: 8,
    padding: '12px 16px', fontSize: 13, color: '#b91c1c', marginBottom: 20,
  },
  section: {
    background: '#fff', borderRadius: 12, borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)',
    padding: 24, display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20,
  },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 },
  hint: { fontSize: 12, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' },
  optional: { fontWeight: 400, color: 'var(--color-text-secondary)' },
  input: {
    padding: '10px 12px', fontSize: 14, borderRadius: 8, borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--color-border)',
    fontFamily: 'inherit', outline: 'none', color: 'var(--color-text-primary)', width: '100%', boxSizing: 'border-box',
  },
  select: {
    padding: '10px 12px', fontSize: 14, borderRadius: 8, borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--color-border)',
    fontFamily: 'inherit', outline: 'none', color: 'var(--color-text-primary)', background: '#fff', width: '100%',
  },
  row: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#1d4ed8',
    background: '#dbeafe', borderRadius: 20, padding: '4px 10px',
  },
  chipX: { border: 'none', background: 'transparent', cursor: 'pointer', color: '#1d4ed8', fontSize: 15, lineHeight: 1, padding: 0, fontWeight: 700 },
  choice: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text-secondary)',
  },
  choiceOn: { borderWidth: '2px', borderColor: 'var(--color-primary)', background: 'var(--color-primary-light)', color: 'var(--color-primary)' },
  secondaryBtn: {
    padding: '10px 16px', background: '#fff', borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--color-border)',
    borderRadius: 8, color: 'var(--color-text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  errText: { fontSize: 12, color: '#dc2626', margin: 0 },
  okText: { fontSize: 12, color: '#15803d', margin: 0, display: 'flex', alignItems: 'center', gap: 6 },
  lineCard: {
    borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)', borderRadius: 12,
    padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--color-secondary)',
  },
  lineHead: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--color-text-primary)' },
  lineNum: {
    width: 24, height: 24, borderRadius: 12, background: 'var(--color-primary)', color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800,
  },
  iconBtn: {
    background: '#fff', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)', borderRadius: 8,
    width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#dc2626',
  },
  lineGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 },
  expand: {
    alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 12.5, fontWeight: 700, color: 'var(--color-primary)',
  },
  requirements: {
    display: 'flex', flexDirection: 'column', gap: 14, background: '#fff', borderRadius: 10, padding: 14,
    borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)',
  },
  addLine: {
    padding: '12px 16px', borderWidth: '1.5px', borderStyle: 'dashed', borderColor: 'var(--color-primary)', borderRadius: 10,
    background: '#f5f6ff', color: 'var(--color-primary)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
  },
  summary: {
    position: 'sticky', bottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
    flexWrap: 'wrap', background: '#fff', borderRadius: 12, padding: '16px 20px',
    borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border)', boxShadow: '0 8px 24px rgba(30,27,75,0.08)',
  },
  summaryMain: { fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 },
  summarySub: { fontSize: 12.5, color: 'var(--color-text-secondary)', margin: '2px 0 0' },
  submit: {
    padding: '12px 24px', background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)', border: 'none', borderRadius: 8,
    fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
  },
};
