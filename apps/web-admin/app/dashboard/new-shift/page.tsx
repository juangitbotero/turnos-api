'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SHIFT_CATEGORIES, ShiftCategory, calculateTSU } from '@turnos/shared';
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

export default function NewShiftPage() {
  const router = useRouter();

  const [category, setCategory] = useState<ShiftCategory>('Hospitality');
  const [subcategory, setSubcategory] = useState<string>(SHIFT_CATEGORIES['Hospitality'][0] ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [hourlyRate, setHourlyRate] = useState('8.00');
  const [address, setAddress] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [geo, setGeo] = useState<GeoResult>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cat = e.target.value as ShiftCategory;
    setCategory(cat);
    setSubcategory(SHIFT_CATEGORIES[cat][0]);
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

  const hoursEstimate = (() => {
    if (!startTime || !endTime) return null;
    const sp = startTime.split(':').map(Number);
    const ep = endTime.split(':').map(Number);
    const sh = sp[0] ?? 0, sm = sp[1] ?? 0;
    const eh = ep[0] ?? 0, em = ep[1] ?? 0;
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins > 0 ? mins / 60 : null;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geo) { setError('Por favor verifique a localização antes de publicar.'); return; }
    setError('');
    setIsSubmitting(true);
    try {
      const skills = skillsInput.split(',').map(s => s.trim()).filter(Boolean);
      await adminApi.createShift({
        title: title || subcategory,
        description,
        category,
        subcategory,
        role: title || undefined,
        date,
        startTime: `${startTime}:00`,
        endTime: `${endTime}:00`,
        grossHourlyRate: rateNum,
        address,
        lat: geo.lat,
        lng: geo.lng,
        skillsRequired: skills.length > 0 ? skills : undefined,
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
            <div style={{ ...s.field, gridColumn: '1 / -1' }}>
              <label style={s.label}>Competências necessárias <span style={s.optional}>(separadas por vírgula)</span></label>
              <input
                style={s.input}
                type="text"
                placeholder="Ex: serviço de mesa, inglês, experiência em eventos..."
                value={skillsInput}
                onChange={e => setSkillsInput(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Date & Time ── */}
        <div style={s.section}>
          <h2 style={s.sectionTitle}>Data & Horário</h2>
          <div style={s.grid3}>
            <div style={s.field}>
              <label style={s.label}>Data</label>
              <input style={s.input} type="date" required value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Início</label>
              <input style={s.input} type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Fim</label>
              <input style={s.input} type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
          {hoursEstimate !== null && (
            <p style={s.hoursHint}>Duração estimada: <strong>{hoursEstimate.toFixed(1)}h</strong></p>
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
                {hoursEstimate && (
                  <div style={{ ...s.tsuRow, marginTop: 8, color: '#6366f1' }}>
                    <span>Custo total do turno ({hoursEstimate.toFixed(1)}h)</span>
                    <span style={{ fontWeight: 700 }}>€{(tsu.employerTotalCost * hoursEstimate).toFixed(2)}</span>
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
  sectionTitle: { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 },
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
