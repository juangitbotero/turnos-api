'use client';

/**
 * Spending page — Employer monthly/yearly spending dashboard.
 *
 * Shows:
 *   - KPI cards: total gross, TSU owed to State, Turnos fees, avg cost/shift
 *   - Period toggle: month | year
 *   - Year view: monthly bar breakdown (gross + TSU)
 *   - Shift-by-shift breakdown table with CSV export for accountant
 *
 * TSU reminder: Employer must pay 23.75% of gross to SS — shown prominently.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminApi, SpendingReport, PaymentRecord } from '../../../lib/api';
import { formatDate, formatEuro } from '../../../lib/format';

type Period = 'month' | 'year';

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function downloadCsv(records: PaymentRecord[], period: string) {
  const header = 'Data,Turno ID,Gross (€),Taxa Turnos (€),TSU Entidade (€),TSU Trabalhador (€),Horas,Líquido Trabalhador (€)';
  const rows = records.map(r =>
    [
      r.shiftDate ?? '',
      r.shiftId ?? '',
      Number(r.grossAmount).toFixed(2),
      Number(r.turnosFee ?? 0).toFixed(2),
      Number(r.employerTsu ?? 0).toFixed(2),
      Number(r.workerTsu ?? 0).toFixed(2),
      Number(r.scheduledHours ?? 0).toFixed(1),
      Number(r.workerNet ?? 0).toFixed(2),
    ].join(','),
  );
  const csv   = [header, ...rows].join('\n');
  const blob  = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url   = URL.createObjectURL(blob);
  const link  = document.createElement('a');
  link.href   = url;
  link.download = `turnos-gastos-${period}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function SpendingPage() {
  const router = useRouter();

  const now   = new Date();
  const [period,      setPeriod]      = useState<Period>('month');
  const [month,       setMonth]       = useState(now.getMonth() + 1);
  const [year,        setYear]        = useState(now.getFullYear());
  const [report,      setReport]      = useState<SpendingReport | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    adminApi.getEmployerSpending(period, period === 'month' ? month : undefined, year)
      .then(setReport)
      .catch(err => setError(err instanceof Error ? err.message : 'Erro ao carregar dados.'))
      .finally(() => setLoading(false));
  }, [period, month, year]);

  useEffect(() => { load(); }, [load]);

  const periodLabel = period === 'month'
    ? `${MONTHS_PT[month - 1]} ${year}`
    : String(year);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <button style={s.backBtn} onClick={() => router.push('/dashboard')}>← Dashboard</button>
          <h1 style={s.pageTitle}>Gastos</h1>
          <p style={s.pageSub}>Análise de custos por turno e relatório TSU para contabilidade</p>
        </div>
        {report && report.records.length > 0 && (
          <button
            style={s.csvBtn}
            onClick={() => downloadCsv(report.records, periodLabel)}
          >
            ⬇ Exportar CSV
          </button>
        )}
      </div>

      {/* Period controls */}
      <div style={s.controls}>
        <div style={s.toggleGroup}>
          <button
            style={{ ...s.toggleBtn, ...(period === 'month' ? s.toggleBtnActive : {}) }}
            onClick={() => setPeriod('month')}
          >
            Mês
          </button>
          <button
            style={{ ...s.toggleBtn, ...(period === 'year' ? s.toggleBtnActive : {}) }}
            onClick={() => setPeriod('year')}
          >
            Ano
          </button>
        </div>

        {period === 'month' && (
          <div style={s.pickerRow}>
            <select style={s.select} value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTHS_PT.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select style={s.select} value={year} onChange={e => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        {period === 'year' && (
          <select style={s.select} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={s.centered}>
          <div style={s.spinner} />
          <p style={s.loadingText}>A carregar dados de {periodLabel}…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={s.errorBanner}>⚠️ {error}</div>
      )}

      {/* Empty */}
      {!loading && !error && report?.records.length === 0 && (
        <div style={s.emptyState}>
          <div style={s.emptyIcon}>💶</div>
          <div style={s.emptyTitle}>Sem turnos pagos em {periodLabel}</div>
          <p style={s.emptySub}>
            Os dados aparecem aqui após os trabalhadores fazerem check-out e o pagamento ser processado.
          </p>
          <Link href="/dashboard/shifts" style={s.emptyLink}>Ver Turnos →</Link>
        </div>
      )}

      {/* Content */}
      {!loading && !error && report && report.records.length > 0 && (
        <>
          {/* KPI cards */}
          <section style={s.kpiGrid}>
            <KpiCard
              icon="💶"
              label="Total bruto pago"
              value={formatEuro(report.totalGross)}
              sub={`${report.shiftCount} turno${report.shiftCount !== 1 ? 's' : ''} no período`}
              color="#6a79ff"
            />
            <KpiCard
              icon="🏛️"
              label="TSU a pagar ao Estado"
              value={formatEuro(report.employerTsu)}
              sub="23.75% do gross — Segurança Social"
              color="#f59e0b"
            />
            <KpiCard
              icon="📊"
              label="Taxas Turnos"
              value={formatEuro(report.turnosFees)}
              sub="10% de comissão da plataforma"
              color="#8b5cf6"
            />
            <KpiCard
              icon="📈"
              label="Custo médio por turno"
              value={formatEuro(report.avgCostPerShift)}
              sub="Gross + TSU entidade"
              color="#10b981"
            />
          </section>

          {/* TSU reminder */}
          <div style={s.tsuReminder}>
            <div style={s.tsuReminderLeft}>
              <span style={s.tsuReminderIcon}>⚠️</span>
              <div>
                <div style={s.tsuReminderTitle}>Lembra-te: TSU da entidade empregadora</div>
                <div style={s.tsuReminderText}>
                  Deves entregar <strong>{formatEuro(report.employerTsu)}</strong> à Segurança Social
                  referente a {periodLabel}. A taxa é de 23,75% sobre o total dos salários brutos.
                  Prazo de entrega: até ao dia 20 do mês seguinte.
                </div>
              </div>
            </div>
          </div>

          {/* Monthly breakdown (year view only) */}
          {period === 'year' && report.monthlyBreakdown && report.monthlyBreakdown.length > 0 && (
            <div style={s.card}>
              <h2 style={s.cardTitle}>Detalhe mensal — {year}</h2>
              <div style={s.monthGrid}>
                {report.monthlyBreakdown.map(({ month: m, gross, tsu }) => {
                  const mLabel = MONTHS_PT[Number(m.split('-')[1]) - 1] ?? m;
                  const maxGross = Math.max(...(report.monthlyBreakdown ?? []).map(x => x.gross), 1);
                  const barPct = Math.round((gross / maxGross) * 100);
                  return (
                    <div key={m} style={s.monthBar}>
                      <div style={s.monthBarLabel}>{mLabel.slice(0, 3)}</div>
                      <div style={s.monthBarBg}>
                        <div style={{ ...s.monthBarFill, height: `${barPct}%` }} />
                      </div>
                      <div style={s.monthBarValue}>{formatEuro(gross)}</div>
                      <div style={s.monthBarTsu}>TSU {formatEuro(tsu)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Shift breakdown table */}
          <div style={s.card}>
            <div style={s.tableCardHeader}>
              <h2 style={s.cardTitle}>Turnos — {periodLabel}</h2>
              <span style={s.tableCount}>{report.records.length} registos</span>
            </div>
            <div style={s.tableWrap}>
              <div style={{ ...s.tableRow, ...s.tableHeader }}>
                <div>Data</div>
                <div>Gross</div>
                <div>Taxa Turnos</div>
                <div>TSU Entidade</div>
                <div>TSU Trabalhador</div>
                <div>Horas</div>
                <div>Líquido Trabalhador</div>
              </div>
              {report.records.map(r => (
                <div key={r.id} style={s.tableRow}>
                  <div style={s.cellDate}>{r.shiftDate ? formatDate(r.shiftDate) : '—'}</div>
                  <div style={s.cellGross}>{formatEuro(Number(r.grossAmount))}</div>
                  <div style={s.cellFee}>{formatEuro(Number(r.turnosFee ?? 0))}</div>
                  <div style={s.cellTsu}>{formatEuro(Number(r.employerTsu ?? 0))}</div>
                  <div style={s.cellTsu}>{formatEuro(Number(r.workerTsu ?? 0))}</div>
                  <div style={s.cellHours}>{Number(r.scheduledHours ?? 0).toFixed(1)}h</div>
                  <div style={s.cellNet}>{formatEuro(Number(r.workerNet ?? 0))}</div>
                </div>
              ))}
            </div>

            {/* Column totals */}
            <div style={{ ...s.tableRow, ...s.tableTotals }}>
              <div style={s.totalLabel}>Total</div>
              <div style={s.totalVal}>{formatEuro(report.totalGross)}</div>
              <div style={s.totalVal}>{formatEuro(report.turnosFees)}</div>
              <div style={{ ...s.totalVal, color: '#d97706' }}>{formatEuro(report.employerTsu)}</div>
              <div style={s.totalVal}>
                {formatEuro(report.records.reduce((s, r) => s + Number(r.workerTsu ?? 0), 0))}
              </div>
              <div style={s.totalVal}>
                {report.records.reduce((s, r) => s + Number(r.scheduledHours ?? 0), 0).toFixed(1)}h
              </div>
              <div style={s.totalVal}>
                {formatEuro(report.records.reduce((s, r) => s + Number(r.workerNet ?? 0), 0))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Nav */}
      <div style={s.navRow}>
        <Link href="/dashboard/billing" style={s.navLink}>Ver Faturação →</Link>
        <Link href="/dashboard" style={s.navLink}>← Dashboard</Link>
      </div>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string; sub: string; color: string;
}) {
  return (
    <div style={sk.card}>
      <div style={{ ...sk.icon, background: `${color}18`, color }}>{icon}</div>
      <div>
        <div style={sk.value}>{value}</div>
        <div style={sk.label}>{label}</div>
        <div style={sk.sub}>{sub}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Styles ─────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-muted)',
    fontSize: 13,
    cursor: 'pointer',
    padding: 0,
    marginBottom: 8,
    fontFamily: 'inherit',
    display: 'block',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: 'var(--color-text-primary)',
    letterSpacing: '-0.8px',
    margin: 0,
  },
  pageSub: {
    fontSize: 14,
    color: 'var(--color-text-muted)',
    marginTop: 4,
  },
  csvBtn: {
    padding: '10px 20px',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-full)',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  /* Period controls */
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap' as const,
  },
  toggleGroup: {
    display: 'flex',
    gap: 4,
    background: 'var(--color-neutral-light)',
    borderRadius: 'var(--radius-full)',
    padding: 3,
  },
  toggleBtn: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: 'var(--radius-full)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: 'var(--color-text-secondary)',
    background: 'transparent',
    transition: 'background 0.15s, color 0.15s',
  },
  toggleBtnActive: {
    background: '#fff',
    color: 'var(--color-primary)',
    boxShadow: 'var(--shadow-sm)',
  },
  pickerRow: { display: 'flex', gap: 8 },
  select: {
    padding: '8px 12px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 13,
    background: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  /* States */
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 60,
    gap: 16,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid var(--color-border)',
    borderTopColor: 'var(--color-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { fontSize: 14, color: 'var(--color-text-muted)' },
  errorBanner: {
    background: '#fee2e2',
    border: '1px solid #fca5a5',
    borderRadius: 'var(--radius-md)',
    padding: '16px 20px',
    fontSize: 14,
    color: '#991b1b',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 24px',
    textAlign: 'center',
    gap: 8,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
  },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' },
  emptySub: { fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, maxWidth: 340 },
  emptyLink: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-primary)',
    textDecoration: 'none',
  },

  /* KPI grid */
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
  },

  /* TSU reminder banner */
  tsuReminder: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    borderRadius: 'var(--radius-md)',
    padding: '16px 20px',
  },
  tsuReminderLeft: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  tsuReminderIcon: { fontSize: 20, flexShrink: 0, marginTop: 2 },
  tsuReminderTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#92400e',
    marginBottom: 4,
  },
  tsuReminderText: {
    fontSize: 13,
    color: '#78350f',
    lineHeight: 1.6,
  },

  /* Card */
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: 24,
    boxShadow: 'var(--shadow-sm)',
    overflowX: 'auto' as const,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    margin: '0 0 20px',
  },
  tableCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tableCount: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    background: 'var(--color-neutral-light)',
    padding: '2px 10px',
    borderRadius: 'var(--radius-full)',
  },

  /* Monthly bar chart */
  monthGrid: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-end',
    height: 180,
    padding: '0 8px',
    overflowX: 'auto' as const,
  },
  monthBar: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 60,
  },
  monthBarLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    marginBottom: 4,
  },
  monthBarBg: {
    width: '100%',
    height: 100,
    background: 'var(--color-neutral-light)',
    borderRadius: 4,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  monthBarFill: {
    width: '100%',
    background: 'linear-gradient(180deg, var(--color-primary), #9b6dff)',
    borderRadius: '4px 4px 0 0',
  },
  monthBarValue: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--color-primary)',
    textAlign: 'center' as const,
  },
  monthBarTsu: {
    fontSize: 9,
    color: '#d97706',
    textAlign: 'center' as const,
  },

  /* Table */
  tableWrap: { overflowX: 'auto' as const },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr 1fr 1.2fr 1.2fr 0.7fr 1.2fr',
    gap: 8,
    padding: '10px 8px',
    borderBottom: '1px solid var(--color-neutral-light)',
    alignItems: 'center',
    fontSize: 13,
  },
  tableHeader: {
    fontWeight: 700,
    fontSize: 11,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    borderBottom: '2px solid var(--color-border)',
  },
  tableTotals: {
    fontWeight: 700,
    background: 'var(--color-neutral-light)',
    borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
    borderBottom: 'none',
    marginTop: 4,
  },
  totalLabel: { fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' },
  totalVal:   { fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' },
  cellDate:   { color: 'var(--color-text-secondary)', fontSize: 12 },
  cellGross:  { fontWeight: 600, color: 'var(--color-text-primary)' },
  cellFee:    { color: '#7c3aed' },
  cellTsu:    { color: '#d97706', fontWeight: 600 },
  cellHours:  { color: 'var(--color-text-secondary)' },
  cellNet:    { color: '#166534', fontWeight: 600 },

  navRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navLink: {
    fontSize: 13,
    color: 'var(--color-primary)',
    textDecoration: 'none',
    fontWeight: 600,
  },
};

const sk: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '20px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    boxShadow: 'var(--shadow-sm)',
  },
  icon: {
    fontSize: 22,
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
    flexShrink: 0,
  },
  value: {
    fontSize: 24,
    fontWeight: 800,
    color: 'var(--color-text-primary)',
    letterSpacing: '-0.8px',
    lineHeight: 1.1,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    marginTop: 4,
  },
  sub: {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    marginTop: 2,
  },
};
