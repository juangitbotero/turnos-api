'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  SHIFT_CATEGORIES, ShiftCategory, LANGUAGES, calculateTSU,
  PAYMENT_METHOD_LABELS, PaymentMethod, RECOMMENDED_PAYMENT_METHOD,
  MAX_SERIES_DAYS, formatSeriesRange, TURNOS_FEE_FIXED_EUR,
} from '@turnos/shared';
import { adminApi, ApiError } from '../../../lib/api';

type GeoResult = { lat: number; lng: number; display: string } | null;

async function geocodeAddress(address: string): Promise<GeoResult> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=pt`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'pt' } });
  const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;
  const first = data[0];
  if (!first) return null;
  return { lat: parseFloat(first.lat), lng: parseFloat(first.lon), display: first.display_name };
}

// ── Category icons ─────────────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, string> = {
  'Restauração':      '🍽️',
  'Hotelaria':        '🏨',
  'Eventos':          '🎪',
  'Vendas':           '🏷️',
  'Apoio ao Cliente': '🎧',
  'Logística':          '📦',
  'Administração':      '💼',
  'Limpeza e Segurança': '🧹',
};

// ── Skills selector — grouped by category accordion ───────────────────────────

function CategoryRow({
  cat, skills, selected, onToggle,
}: {
  cat: ShiftCategory;
  skills: readonly string[];
  selected: string[];
  onToggle: (skill: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = skills.filter(sk => selected.includes(sk)).length;

  return (
    <div style={sk.catWrapper}>
      {/* Header row */}
      <button
        type="button"
        style={sk.catHeader}
        onClick={() => setOpen(v => !v)}
      >
        <span style={sk.catIcon}>{CATEGORY_ICONS[cat] ?? '📋'}</span>
        <span style={sk.catLabel}>{cat}</span>
        {count > 0 && (
          <span style={sk.catBadge}>{count}</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded chip grid */}
      {open && (
        <div style={sk.catBody}>
          <div style={sk.suggestions}>
            {skills.map(skill => {
              const isSelected = selected.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  style={{ ...sk.tag, ...(isSelected ? sk.tagSelected : sk.tagUnselected) }}
                  onClick={() => onToggle(skill)}
                >
                  {isSelected ? '✓ ' : '+ '}{skill}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillsSelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (skills: string[]) => void;
}) {
  const [customInput, setCustomInput] = useState('');

  const toggle = (skill: string) =>
    onChange(selected.includes(skill) ? selected.filter(s => s !== skill) : [...selected, skill]);

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed || selected.includes(trimmed)) { setCustomInput(''); return; }
    onChange([...selected, trimmed]);
    setCustomInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* One accordion row per category */}
      {(Object.keys(SHIFT_CATEGORIES) as ShiftCategory[]).map(cat => (
        <CategoryRow
          key={cat}
          cat={cat}
          skills={SHIFT_CATEGORIES[cat]}
          selected={selected}
          onToggle={toggle}
        />
      ))}

      {/* Custom skill input */}
      <div style={{ ...sk.customRow, marginTop: 4 }}>
        <input
          style={sk.customInput}
          type="text"
          placeholder="Adicionar competência personalizada..."
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
        />
        <button
          type="button"
          style={sk.addBtn}
          onClick={addCustom}
          disabled={!customInput.trim()}
        >
          + Adicionar
        </button>
      </div>

      {/* Selected summary */}
      {selected.length > 0 && (
        <div style={sk.selectedWrap}>
          <span style={sk.selectedLabel}>Selecionadas:</span>
          <div style={sk.selectedChips}>
            {selected.map(skill => (
              <span key={skill} style={sk.chip}>
                {skill}
                <button
                  type="button"
                  style={sk.chipRemove}
                  onClick={() => onChange(selected.filter(s => s !== skill))}
                >✕</button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const sk: Record<string, React.CSSProperties> = {
  /* Category accordion */
  catWrapper: {
    border: '1.5px solid var(--color-border)', borderRadius: 10, overflow: 'hidden',
  },
  catHeader: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', background: '#fff', border: 'none',
    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const,
    transition: 'background 0.15s',
  },
  catIcon: { fontSize: 16 },
  catLabel: { fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 },
  catBadge: {
    fontSize: 11, fontWeight: 700, color: '#fff',
    background: 'var(--color-primary)', borderRadius: 20,
    padding: '1px 7px', lineHeight: 1.6,
  },
  catBody: {
    padding: '10px 14px 12px', background: '#fafbff',
    borderTop: '1px solid var(--color-border)',
  },
  /* Chips */
  suggestions: { display: 'flex', flexWrap: 'wrap' as const, gap: 7 },
  tag: {
    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid', transition: 'all 0.15s',
  },
  tagUnselected: {
    background: 'var(--color-secondary)', borderColor: 'var(--color-border)',
    color: 'var(--color-text-secondary)',
  },
  tagSelected: {
    background: 'var(--color-primary-light)', borderColor: 'rgba(106,121,255,0.5)',
    color: 'var(--color-primary)',
  },
  /* Custom input */
  customRow: { display: 'flex', gap: 8 },
  customInput: {
    flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 8,
    border: '1.5px solid var(--color-border)', fontFamily: 'inherit',
    outline: 'none', color: 'var(--color-text-primary)',
  },
  addBtn: {
    padding: '8px 14px', background: 'var(--color-primary-light)',
    border: '1px solid rgba(106,121,255,0.3)', borderRadius: 8,
    color: 'var(--color-primary)', fontWeight: 600, fontSize: 12,
    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
  },
  /* Selected summary */
  selectedWrap: { display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' as const },
  selectedLabel: { fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', paddingTop: 4, flexShrink: 0 },
  selectedChips: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'var(--color-primary-light)', borderRadius: 20,
    padding: '3px 10px 3px 12px', fontSize: 12, fontWeight: 600,
    color: 'var(--color-primary)', border: '1px solid rgba(106,121,255,0.3)',
  },
  chipRemove: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
    color: 'var(--color-primary)', fontSize: 10, fontWeight: 700, lineHeight: 1,
  },
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewShiftPage() {
  const router = useRouter();

  const [category, setCategory]   = useState<ShiftCategory>('Hotelaria');
  const [subcategory, setSubcategory] = useState<string>(SHIFT_CATEGORIES['Hotelaria'][0] ?? '');
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
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(RECOMMENDED_PAYMENT_METHOD);

  // Pre-fill form when re-posting a caducated shift
  useEffect(() => {
    const raw = sessionStorage.getItem('repost_shift');
    if (!raw) return;
    sessionStorage.removeItem('repost_shift');
    try {
      const sh = JSON.parse(raw);
      if (sh.category && SHIFT_CATEGORIES[sh.category as ShiftCategory]) {
        setCategory(sh.category as ShiftCategory);
        setSubcategory(sh.subcategory ?? SHIFT_CATEGORIES[sh.category as ShiftCategory][0]);
      }
      if (sh.title) setTitle(sh.title);
      if (sh.description) setDescription(sh.description);
      if (sh.grossHourlyRate) setHourlyRate(String(Number(sh.grossHourlyRate).toFixed(2)));
      if (sh.address) setAddress(sh.address);
      if (sh.skillsRequired?.length) setSelectedSkills(sh.skillsRequired);
      if (sh.languagesRequired?.length) setSelectedLanguages(sh.languagesRequired);
      if (sh.startTime) setStartTime(sh.startTime.slice(0, 5));
      // Recalculate duration from original start/end if available
      if (sh.startTime && sh.endTime) {
        const [sh_, sm_] = sh.startTime.split(':').map(Number);
        const [eh_, em_] = sh.endTime.split(':').map(Number);
        const mins = ((eh_ ?? 0) * 60 + (em_ ?? 0)) - ((sh_ ?? 0) * 60 + (sm_ ?? 0));
        if (mins >= 120) setDuration(Math.round(mins / 60));
      }
      // Don't copy the date — employer must choose a new one
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
    setSubcategory(SHIFT_CATEGORIES[cat][0]);
    // Keep selected skills — let employer manually remove irrelevant ones
  };

  const handleGeocode = async () => {
    if (!address.trim()) return;
    setIsGeocoding(true);
    setGeoError('');
    setGeo(null);
    const result = await geocodeAddress(address);
    if (!result) setGeoError('Morada não encontrada. Tente ser mais específico (ex: "Rua Augusta 1, Lisboa").');
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
      setError(`Um trabalho de vários dias pode ter no máximo ${MAX_SERIES_DAYS} dias.`);
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
      msg: '⚠️ Turno ≥ 8h: o trabalhador tem direito a pausa de 1h e subsídio de refeição (~€6,00/dia). Certifica-te de que o valor/hora reflecte este custo.',
    };
    if (durationHours >= 4) return {
      level: 'info' as const,
      msg: 'ℹ️ Turno ≥ 4h: o trabalhador tem direito a pausa obrigatória de 15–30 min (não computada no horário de trabalho).',
    };
    return null;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geo) { setError('Por favor verifique a localização antes de publicar.'); return; }
    if (durationHours < 2) { setError('A duração mínima de um turno é 2 horas.'); return; }
    if (!startTime) { setError('Por favor selecione a hora de início.'); return; }
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
        skillsRequired: selectedSkills.length > 0 ? selectedSkills : undefined,
        languagesRequired: selectedLanguages.length > 0 ? selectedLanguages : undefined,
        paymentMethod,
      });
      router.push('/dashboard/shifts');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao publicar turno.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Publicar Turno</h1>
          <p style={s.sub}>Preencha os detalhes do turno. O valor bruto e o custo TSU são calculados automaticamente.</p>
        </div>
        <button style={s.backBtn} onClick={() => router.push('/dashboard/shifts')}>← Voltar</button>
      </div>

      {error && <div style={s.errorBanner}>⚠️ {error}</div>}

      <form onSubmit={handleSubmit} style={s.form}>

        {/* ── Role & Category ── */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>Função & Categoria</h2>
          <div style={s.grid2}>
            <div style={s.field}>
              <label style={s.label}>Categoria</label>
              <select style={s.select} value={category} onChange={handleCategoryChange}>
                {Object.keys(SHIFT_CATEGORIES).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Função</label>
              <select style={s.select} value={subcategory} onChange={e => setSubcategory(e.target.value)}>
                {SHIFT_CATEGORIES[category].map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
            <div style={{ ...s.field, gridColumn: '1 / -1' }}>
              <label style={s.label}>Título personalizado <span style={s.optional}>(opcional)</span></label>
              <input
                style={s.input}
                type="text"
                placeholder="Ex: Bartender Sénior, Chef de Linha..."
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
            <div style={{ ...s.field, gridColumn: '1 / -1' }}>
              <label style={s.label}>Descrição</label>
              <textarea
                style={{ ...s.input, height: 90, resize: 'vertical' }}
                required
                placeholder="Descreva o turno, ambiente de trabalho, requisitos específicos..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Skills ── */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>
            Competências necessárias
            <span style={s.sectionBadge}>opcional</span>
          </h2>
          <p style={s.sectionHint}>
            Selecione as competências mais relevantes para este turno.
            Pode também adicionar competências personalizadas.
          </p>
          <SkillsSelector
            selected={selectedSkills}
            onChange={setSelectedSkills}
          />
        </div>

        {/* ── Languages ── */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>
            Idiomas necessários
            <span style={s.sectionBadge}>opcional</span>
          </h2>
          <p style={s.sectionHint}>
            Selecione os idiomas necessários para este turno. Apenas trabalhadores com esses idiomas serão notificados.
          </p>
          <div style={sk.suggestions}>
            {(LANGUAGES as readonly string[]).map(lang => {
              const active = selectedLanguages.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  style={{
                    ...sk.tag,
                    ...(active ? sk.tagSelected : sk.tagUnselected),
                  }}
                  onClick={() =>
                    setSelectedLanguages(prev =>
                      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
                    )
                  }
                >
                  {active ? '✓ ' : '+ '}{lang}
                </button>
              );
            })}
          </div>
          {selectedLanguages.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600, marginTop: 4 }}>
              {selectedLanguages.length} idioma{selectedLanguages.length !== 1 ? 's' : ''} selecionado{selectedLanguages.length !== 1 ? 's' : ''}: {selectedLanguages.join(', ')}
            </p>
          )}
        </div>

        {/* ── Payment method ── */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>Como vais pagar ao trabalhador?</h2>
          <p style={s.sectionHint}>
            O pagamento é feito diretamente por ti ao trabalhador após o turno — não passa pela Turnos.
            O método escolhido é mostrado ao trabalhador antes de se candidatar.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([method, label]) => {
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
                  {active ? '✓ ' : ''}{label}
                  {recommended && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                      background: active ? 'var(--color-primary)' : 'var(--color-primary-light)',
                      color: active ? '#fff' : 'var(--color-primary)',
                    }}>
                      Recomendado
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {paymentMethod === 'TURNOS_PAY_LINK' && (
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 8 }}>
              💳 Recebes um link após o turno e pagas por cartão ou MB WAY. O dinheiro vai direto
              para a conta do trabalhador e o pagamento fica confirmado automaticamente.
            </p>
          )}
          {(paymentMethod === 'TRANSFERENCIA' || paymentMethod === 'MBWAY') && (
            <p style={{ fontSize: 12, color: '#b45309', marginTop: 8 }}>
              💡 Depois de pagares, anexa o comprovativo no dashboard. É o que resolve a disputa
              se o trabalhador reportar que não recebeu.
            </p>
          )}
        </div>

        {/* ── Date & Time ── */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>
            Data & Horário
            <span style={s.minShiftBadge}>⏱ Mínimo 2 horas</span>
          </h2>

          <div style={s.grid3}>
            {/* Date */}
            <div style={s.field}>
              <label style={s.label}>{isMultiDay ? 'Primeiro dia' : 'Data do turno'}</label>
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
              <label style={s.label}>Hora de início</label>
              <select
                style={s.select}
                required
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              >
                <option value="">Selecionar hora...</option>
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
              <label style={s.label}>Duração</label>
              <select
                style={s.select}
                value={durationHours}
                onChange={e => setDuration(Number(e.target.value))}
              >
                {[2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map(h => (
                  <option key={h} value={h}>{h}h {h === 2 ? '(mínimo)' : ''}</option>
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
                <strong>Trabalho de vários dias</strong>
                <span style={s.multiDayHint}>
                  {' '}— o mesmo horário em várias datas. O trabalhador candidata-se uma vez e
                  compromete-se com todos os dias.
                </span>
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
                    + Adicionar dia
                  </button>
                </div>

                {allDates.length > 0 && (
                  <>
                    <div style={s.multiDayChips}>
                      {allDates.map(d => (
                        <span key={d} style={s.multiDayChip}>
                          {new Date(d).toLocaleDateString('pt-PT', {
                            weekday: 'short', day: '2-digit', month: 'short',
                          })}
                          {d !== date && (
                            <button
                              type="button"
                              style={s.multiDayChipX}
                              onClick={() => setExtraDates(extraDates.filter(x => x !== d))}
                              aria-label={`Remover ${d}`}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                    <div style={s.multiDaySummary}>
                      📅 <strong>{allDates.length} dia{allDates.length !== 1 ? 's' : ''}</strong>
                      {allDates.length > 1 && <> · {formatSeriesRange(allDates)}</>}
                      {' · '}
                      {(durationHours * allDates.length).toFixed(0)}h no total
                      {rateNum > 0 && <> · ≈ €{(rateNum * durationHours * allDates.length).toFixed(2)} bruto</>}
                    </div>
                    {allDates.length > 1 && (
                      <div style={s.multiDayNote}>
                        A taxa Turnos é de <strong>€{TURNOS_FEE_FIXED_EUR} por trabalho</strong>, não por dia.
                        O pagamento ao trabalhador é feito <strong>uma vez, no fim</strong> de todos os dias.
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
              <span style={s.computedLabel}>Fim do turno:</span>
              <span style={s.computedValue}>{startTime} → {computedEndTime}</span>
              <span style={s.computedDuration}>· {durationHours}h de trabalho</span>
              {computedEndTime < startTime && (
                <span style={s.nextDayBadge}>+1 dia</span>
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
          <h2 style={s.sectionTitle}>Localização</h2>
          <div style={s.field}>
            <label style={s.label}>Morada completa</label>
            <div style={s.addrRow}>
              <input
                style={{ ...s.input, flex: 1 }}
                type="text"
                required
                placeholder="Ex: Rua Augusta 1, 1100-048 Lisboa"
                value={address}
                onChange={e => { setAddress(e.target.value); setGeo(null); setGeoError(''); }}
              />
              <button type="button" style={s.geocodeBtn} onClick={handleGeocode} disabled={!address.trim() || isGeocoding}>
                {isGeocoding ? '...' : '📍 Verificar'}
              </button>
            </div>
            {geoError && <p style={s.geoError}>{geoError}</p>}
            {geo && (
              <div style={s.geoSuccess}>
                ✅ <strong>{geo.display.split(',').slice(0, 3).join(',')}</strong>
                <span style={s.geoCoords}> ({geo.lat.toFixed(4)}, {geo.lng.toFixed(4)})</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Pay & TSU ── */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>Remuneração & Custos</h2>
          <div style={s.grid2}>
            <div style={s.field}>
              <label style={s.label}>Valor bruto/hora (€) para o trabalhador</label>
              <input
                style={{ ...s.input, fontSize: 22, fontWeight: 700 }}
                type="number"
                step="0.10"
                min="5.00"
                required
                value={hourlyRate}
                onChange={e => setHourlyRate(e.target.value)}
              />
              <p style={s.hint}>Salário mínimo em Portugal: €5,41/hr (2024)</p>
            </div>
            {tsu && (
              <div style={s.tsuBox}>
                <div style={s.tsuRow}>
                  <span>Bruto trabalhador</span>
                  <span style={s.tsuVal}>€{tsu.grossAmount.toFixed(2)}/hr</span>
                </div>
                <div style={s.tsuRow}>
                  <span>TSU entidade (23,75%)</span>
                  <span style={s.tsuVal}>€{tsu.employerContribution.toFixed(2)}/hr</span>
                </div>
                <div style={{ ...s.tsuRow, ...s.tsuTotal }}>
                  <span>Custo total empregador</span>
                  <span>€{tsu.employerTotalCost.toFixed(2)}/hr</span>
                </div>
                {startTime && (
                  <div style={{ ...s.tsuRow, marginTop: 8, color: '#6366f1' }}>
                    <span>Custo total do turno ({durationHours}h)</span>
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
            Cancelar
          </button>
          <button
            type="submit"
            style={{ ...s.submitBtn, opacity: isSubmitting ? 0.65 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'A publicar...' : '✓ Publicar Turno'}
          </button>
        </div>
      </form>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: 32, maxWidth: 900, margin: '0 auto' },
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
