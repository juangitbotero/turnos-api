'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, TsuReport, McdContract, AuditLogEntry } from '../../../lib/api';
import { formatDate, formatEuro } from '../../../lib/format';

type Tab = 'tsu' | 'mcd' | 'audit';

const SS_STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:    { label: 'Pendente',   color: '#92400e', bg: '#fef3c7' },
  EMAIL_SENT: { label: 'Email Sent', color: '#1d4ed8', bg: '#dbeafe' },
  SUBMITTED:  { label: 'Submetido', color: '#166534', bg: '#dcfce7' },
  FAILED:     { label: 'Falhou',    color: '#991b1b', bg: '#fee2e2' },
};

function formatEvent(event: string) {
  return event.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function CompliancePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('tsu');

  // TSU report state
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [tsuReport, setTsuReport] = useState<TsuReport | null>(null);
  const [tsuLoading, setTsuLoading] = useState(false);

  // MCD contracts state
  const [contracts, setContracts] = useState<McdContract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);

  // Audit log state
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Load TSU when tab/month/year changes
  useEffect(() => {
    if (tab !== 'tsu') return;
    setTsuLoading(true);
    adminApi.getTsuReport(month, year)
      .then(setTsuReport)
      .catch(() => setTsuReport(null))
      .finally(() => setTsuLoading(false));
  }, [tab, month, year]);

  // Load MCD contracts once when tab activated
  useEffect(() => {
    if (tab !== 'mcd') return;
    setContractsLoading(true);
    adminApi.getMcdContracts()
      .then(setContracts)
      .catch(() => setContracts([]))
      .finally(() => setContractsLoading(false));
  }, [tab]);

  // Load audit log once when tab activated
  useEffect(() => {
    if (tab !== 'audit') return;
    setAuditLoading(true);
    adminApi.getAuditLog()
      .then(setAuditLog)
      .catch(() => setAuditLog([]))
      .finally(() => setAuditLoading(false));
  }, [tab]);

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <button style={s.backBtn} onClick={() => router.push('/dashboard')}>← Dashboard</button>
          <h1 style={s.title}>📊 Conformidade Legal</h1>
          <p style={s.subtitle}>
            TSU / SS Direta · Contratos MCD · Registo de auditoria ACT
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabBar}>
        {([
          { id: 'tsu',   label: '💶 Relatório TSU' },
          { id: 'mcd',   label: '📄 Contratos MCD' },
          { id: 'audit', label: '🔒 Auditoria ACT'  },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            style={tab === t.id ? { ...s.tab, ...s.tabActive } : s.tab}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TSU Report tab ──────────────────────────────────────────────── */}
      {tab === 'tsu' && (
        <div>
          {/* Month/year selector */}
          <div style={s.filterRow}>
            <select
              style={s.select}
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              style={s.select}
              value={year}
              onChange={e => setYear(Number(e.target.value))}
            >
              {[now.getFullYear(), now.getFullYear() - 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {tsuLoading ? (
            <div style={s.center}><span style={s.spinner}>⏳</span> A carregar...</div>
          ) : !tsuReport || !tsuReport.rows?.length ? (
            <div style={s.emptyState}>
              <p style={s.emptyIcon}>📭</p>
              <p style={s.emptyText}>Sem turnos concluídos em {MONTHS[(month ?? 1) - 1]} {year}</p>
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div style={s.kpiRow}>
                <div style={s.kpiCard}>
                  <span style={s.kpiLabel}>Bruto Total</span>
                  <span style={s.kpiValue}>{formatEuro(tsuReport.totalGross)}</span>
                </div>
                <div style={s.kpiCard}>
                  <span style={s.kpiLabel}>TSU Entidade (23.75%)</span>
                  <span style={{ ...s.kpiValue, color: '#dc2626' }}>{formatEuro(tsuReport.totalEmployerTsu)}</span>
                </div>
                <div style={s.kpiCard}>
                  <span style={s.kpiLabel}>Taxas Turnos (10%)</span>
                  <span style={{ ...s.kpiValue, color: '#7c3aed' }}>{formatEuro(tsuReport.totalTurnosFees)}</span>
                </div>
              </div>

              {/* Rows table */}
              <div style={s.tableWrap}>
                <div style={{ ...s.tableRow7, ...s.tableHeader }}>
                  <span>Turno</span>
                  <span>Data</span>
                  <span>Trabalhador</span>
                  <span>Bruto</span>
                  <span>Taxa Turnos</span>
                  <span>TSU Emp.</span>
                  <span>Líquido Trabalh.</span>
                </div>
                {(tsuReport.rows ?? []).map(row => (
                  <div key={row.shiftId} style={s.tableRow7}>
                    <span style={s.rowTitle}>{row.shiftTitle}</span>
                    <span style={s.rowCell}>{formatDate(row.shiftDate)}</span>
                    <span style={s.rowCell}>{row.workerName}</span>
                    <span style={{ ...s.rowCell, fontWeight: 700 }}>{formatEuro(row.grossAmount)}</span>
                    <span style={{ ...s.rowCell, color: '#7c3aed' }}>−{formatEuro(row.turnosFee)}</span>
                    <span style={{ ...s.rowCell, color: '#dc2626' }}>{formatEuro(row.employerTsu)}</span>
                    <span style={{ ...s.rowCell, color: '#16a34a', fontWeight: 700 }}>{formatEuro(row.workerNetAmount)}</span>
                  </div>
                ))}
              </div>

              <p style={s.legalNote}>
                ℹ️ SS Trabalhador (11%) é entregue pelo próprio trabalhador via SS Direta — não incluído acima.
                TSU Entidade (23.75%) deve ser pago mensalmente pelo empregador.
              </p>
            </>
          )}
        </div>
      )}

      {/* ── MCD Contracts tab ───────────────────────────────────────────── */}
      {tab === 'mcd' && (
        <div>
          {contractsLoading ? (
            <div style={s.center}><span style={s.spinner}>⏳</span> A carregar...</div>
          ) : contracts.length === 0 ? (
            <div style={s.emptyState}>
              <p style={s.emptyIcon}>📭</p>
              <p style={s.emptyText}>Sem contratos MCD registados ainda</p>
            </div>
          ) : (
            <div style={s.tableWrap}>
              <div style={{ ...s.tableRow, ...s.tableHeader }}>
                <span>Trabalhador / NIF</span>
                <span>Data do Turno</span>
                <span>Horário</span>
                <span>Função</span>
                <span>Valor/hora</span>
                <span>SS Direta</span>
              </div>
              {contracts.map(c => {
                const st = SS_STATUS_LABEL[c.ssStatus] ?? { label: c.ssStatus, color: '#6b7280', bg: '#f3f4f6' };
                return (
                  <div key={c.id} style={s.tableRow}>
                    <div>
                      <p style={s.rowTitle}>{c.workerName}</p>
                      <p style={s.rowSub}>{c.workerNif}</p>
                    </div>
                    <span style={s.rowCell}>{formatDate(c.shiftDate)}</span>
                    <span style={s.rowCell}>{c.startTime}–{c.endTime}</span>
                    <span style={s.rowCell}>{c.role || '—'}</span>
                    <span style={{ ...s.rowCell, fontWeight: 700 }}>€{Number(c.grossHourlyRate).toFixed(2)}/hr</span>
                    <span style={{ ...s.badge, color: st.color, background: st.bg }}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Audit log tab ───────────────────────────────────────────────── */}
      {tab === 'audit' && (
        <div>
          <p style={s.auditNote}>
            🔒 Registo imutável de todos os eventos de conformidade. Usado em inspeções da ACT.
          </p>
          {auditLoading ? (
            <div style={s.center}><span style={s.spinner}>⏳</span> A carregar...</div>
          ) : auditLog.length === 0 ? (
            <div style={s.emptyState}>
              <p style={s.emptyIcon}>📭</p>
              <p style={s.emptyText}>Sem eventos de auditoria</p>
            </div>
          ) : (
            <div style={s.tableWrap}>
              <div style={{ ...s.tableRow, gridTemplateColumns: '1.5fr 2fr 0.8fr 3fr', ...s.tableHeader }}>
                <span>Data/Hora</span>
                <span>Evento</span>
                <span>Turno</span>
                <span>Detalhes</span>
              </div>
              {auditLog.map(entry => (
                <div key={entry.id} style={{ ...s.tableRow, gridTemplateColumns: '1.5fr 2fr 0.8fr 3fr' }}>
                  <span style={s.rowCell}>
                    {new Date(entry.createdAt).toLocaleString('pt-PT', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <span style={{ ...s.badge, color: '#1d4ed8', background: '#dbeafe', fontSize: 11 }}>
                    {formatEvent(entry.event)}
                  </span>
                  <span style={s.rowCell}>{entry.shiftId?.slice(0, 8) ?? '—'}</span>
                  <span style={s.auditDetails}>
                    {Object.entries(entry.details ?? {}).map(([k, v]) => (
                      <span key={k} style={s.auditKv}>
                        <b>{k}:</b> {String(v)}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: 32, maxWidth: 1200, margin: '0 auto' },
  header: { marginBottom: 24 },
  backBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#6b7280', fontSize: 14, marginBottom: 8, padding: 0,
  },
  title: { fontSize: 28, fontWeight: 800, color: '#111827', margin: '0 0 4px' },
  subtitle: { fontSize: 14, color: '#6b7280', margin: 0 },

  // Tabs
  tabBar: { display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #e5e7eb', paddingBottom: 0 },
  tab: {
    padding: '10px 20px', border: 'none', borderRadius: '8px 8px 0 0',
    cursor: 'pointer', fontSize: 14, fontWeight: 600,
    background: '#f3f4f6', color: '#6b7280',
    borderBottom: '2px solid transparent', marginBottom: -1,
  },
  tabActive: {
    background: '#fff', color: '#6a79ff',
    borderBottom: '2px solid #6a79ff',
    boxShadow: '0 -1px 3px rgba(0,0,0,0.06)',
  },

  // Filters
  filterRow: { display: 'flex', gap: 12, marginBottom: 20 },
  select: {
    padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb',
    fontSize: 14, color: '#374151', background: '#fff', cursor: 'pointer',
  },

  // KPI cards
  kpiRow: { display: 'flex', gap: 16, marginBottom: 24 },
  kpiCard: {
    flex: 1, background: '#fff', borderRadius: 12, padding: '16px 20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 4,
  },
  kpiLabel: { fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValue: { fontSize: 24, fontWeight: 800, color: '#111827' },

  // Table
  tableWrap: { background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  tableHeader: {
    background: '#f9fafb', fontWeight: 700, fontSize: 12,
    color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
    gap: 8,
    padding: '12px 20px',
    borderBottom: '1px solid #f3f4f6',
    alignItems: 'center',
    fontSize: 13,
    color: '#374151',
  },
  tableRow7: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr',
    gap: 8,
    padding: '12px 20px',
    borderBottom: '1px solid #f3f4f6',
    alignItems: 'center',
    fontSize: 13,
    color: '#374151',
  },
  rowTitle: { fontWeight: 600, margin: 0 },
  rowSub:   { fontSize: 11, color: '#9ca3af', margin: 0 },
  rowCell:  { fontSize: 13, color: '#374151' },
  badge: {
    display: 'inline-block', padding: '3px 10px', borderRadius: 20,
    fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
  },

  // Audit
  auditNote: { fontSize: 13, color: '#1d4ed8', background: '#dbeafe', borderRadius: 8, padding: '10px 16px', marginBottom: 16 },
  auditDetails: { display: 'flex', flexDirection: 'column', gap: 2 },
  auditKv: { fontSize: 11, color: '#6b7280' },

  // Legal note
  legalNote: {
    marginTop: 16, fontSize: 12, color: '#92400e',
    background: '#fef3c7', borderRadius: 8, padding: '10px 16px',
  },

  // Empty / loading
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 48, color: '#6b7280' },
  spinner: { fontSize: 24 },
  emptyState: { textAlign: 'center', padding: 64 },
  emptyIcon: { fontSize: 48, margin: '0 0 8px' },
  emptyText: { fontSize: 16, color: '#6b7280', margin: 0 },
};
