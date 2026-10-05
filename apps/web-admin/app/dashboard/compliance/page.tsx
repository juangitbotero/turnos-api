'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, TsuReport, McdContract, AuditLogEntry } from '../../../lib/api';
import { useT } from '../../../lib/i18n';
import { LanguageSwitcher } from '../../../components/LanguageSwitcher';
import { IconInbox, Spinner } from '../../../components/icons';

type Tab = 'tsu' | 'mcd' | 'audit';

/**
 * Semicolon-separated with a BOM: Excel in a Portuguese locale uses `;` as the
 * list separator, so a comma CSV opens as one column, and without the BOM it
 * misreads UTF-8 accents (Função, João).
 */
function downloadHiresCsv(rows: McdContract[], header: string, filename: string) {
  const cell = (v: unknown) => {
    const str = String(v ?? '');
    return /[;"\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = rows.map(c => [
    c.workerName, c.workerNif, c.role ?? '', c.shiftDate, c.startTime, c.endTime,
    Number(c.grossHourlyRate).toFixed(2).replace('.', ','), c.address,
    c.employerName, c.employerNipc, c.shiftStatus ?? '',
  ].map(cell).join(';'));
  const blob = new Blob(['﻿' + [header, ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatEvent(event: string) {
  return event.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export default function CompliancePage() {
  const router = useRouter();
  const { t, fMediumDate, fMoney, fMonthName, fTimestamp } = useT();
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Deep link from the shifts page: ?tab=mcd&month=YYYY-MM. Read from
  // window rather than useSearchParams, which would need a Suspense boundary
  // for the static build.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('tab') === 'mcd') setTab('mcd');
    const m = q.get('month')?.match(/^(\d{4})-(\d{2})$/);
    if (m) { setYear(Number(m[1])); setMonth(Number(m[2])); }
  }, []);

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

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const monthContracts = contracts.filter(c => c.shiftDate.startsWith(monthKey));

  const copyContract = async (c: McdContract) => {
    const text = t('admin.compliance.copyTemplate', {
      worker: c.workerName, nif: c.workerNif, role: c.role || '—',
      date: fMediumDate(c.shiftDate), start: c.startTime, end: c.endTime,
      rate: Number(c.grossHourlyRate).toFixed(2), address: c.address,
      company: c.employerName, nipc: c.employerNipc,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(id => (id === c.id ? null : id)), 2000);
    } catch { /* clipboard blocked — the row is still readable on screen */ }
  };

  const monthYearSelectors = (
    <>
      <select style={s.select} value={month} onChange={e => setMonth(Number(e.target.value))}>
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i + 1} value={i + 1}>{fMonthName(i, year)}</option>
        ))}
      </select>
      <select style={s.select} value={year} onChange={e => setYear(Number(e.target.value))}>
        {[now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1].map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </>
  );

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
          <button style={s.backBtn} onClick={() => router.push('/dashboard')}>{t('admin.chrome.backDashboard')}</button>
          <h1 style={s.title}>{t('admin.compliance.title')}</h1>
          <p style={s.subtitle}>{t('admin.compliance.sub')}</p>
        </div>
        <LanguageSwitcher />
      </div>

      {/* Tabs */}
      <div style={s.tabBar}>
        {([
          { id: 'tsu',   label: t('admin.compliance.tabTsu') },
          { id: 'mcd',   label: t('admin.compliance.tabMcd') },
          { id: 'audit', label: t('admin.compliance.tabAudit') },
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
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{fMonthName(i, year)}</option>
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
            <div style={s.center}><Spinner size={15} style={{ verticalAlign: -2 }} /> {t('common.loading')}</div>
          ) : !tsuReport || !tsuReport.rows?.length ? (
            <div style={s.emptyState}>
              <p style={s.emptyIcon}><IconInbox size={44} /></p>
              <p style={s.emptyText}>
                {t('admin.compliance.emptyTsu', { month: fMonthName((month ?? 1) - 1, year), year })}
              </p>
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div style={s.kpiRow}>
                <div style={s.kpiCard}>
                  <span style={s.kpiLabel}>{t('admin.compliance.kpiGross')}</span>
                  <span style={s.kpiValue}>{fMoney(tsuReport.totalGross)}</span>
                </div>
                <div style={s.kpiCard}>
                  <span style={s.kpiLabel}>{t('admin.compliance.kpiEmployerTsu')}</span>
                  <span style={{ ...s.kpiValue, color: '#dc2626' }}>{fMoney(tsuReport.totalEmployerTsu)}</span>
                </div>
                <div style={s.kpiCard}>
                  <span style={s.kpiLabel}>{t('admin.compliance.kpiTurnosFees')}</span>
                  <span style={{ ...s.kpiValue, color: '#7c3aed' }}>{fMoney(tsuReport.totalTurnosFees)}</span>
                </div>
              </div>

              {/* Rows table */}
              <div style={s.tableWrap}>
                <div style={{ ...s.tableRow7, ...s.tableHeader }}>
                  <span>{t('admin.compliance.colShift')}</span>
                  <span>{t('admin.compliance.colDate')}</span>
                  <span>{t('admin.compliance.colWorker')}</span>
                  <span>{t('admin.compliance.colGross')}</span>
                  <span>{t('admin.compliance.colTurnosFee')}</span>
                  <span>{t('admin.compliance.colEmployerTsu')}</span>
                  <span>{t('admin.compliance.colWorkerNet')}</span>
                </div>
                {(tsuReport.rows ?? []).map(row => (
                  <div key={row.shiftId} style={s.tableRow7}>
                    <span style={s.rowTitle}>{row.shiftTitle}</span>
                    <span style={s.rowCell}>{fMediumDate(row.shiftDate)}</span>
                    <span style={s.rowCell}>{row.workerName}</span>
                    <span style={{ ...s.rowCell, fontWeight: 700 }}>{fMoney(row.grossAmount)}</span>
                    <span style={{ ...s.rowCell, color: '#7c3aed' }}>−{fMoney(row.turnosFee)}</span>
                    <span style={{ ...s.rowCell, color: '#dc2626' }}>{fMoney(row.employerTsu)}</span>
                    <span style={{ ...s.rowCell, color: '#16a34a', fontWeight: 700 }}>{fMoney(row.workerNetAmount)}</span>
                  </div>
                ))}
              </div>

              <p style={s.legalNote}>{t('admin.compliance.legalNote')}</p>
            </>
          )}
        </div>
      )}

      {/* ── MCD Contracts tab ───────────────────────────────────────────── */}
      {tab === 'mcd' && (
        <div>
          <p style={s.hireNotice}>{t('admin.compliance.hireNotice')}</p>
          <div style={s.filterRow}>
            {monthYearSelectors}
            <button
              style={{ ...s.exportBtn, opacity: monthContracts.length ? 1 : 0.5 }}
              disabled={!monthContracts.length}
              onClick={() => downloadHiresCsv(
                monthContracts,
                t('admin.compliance.csvHeader'),
                `${t('admin.compliance.csvFilename')}-${monthKey}`,
              )}
            >
              {t('admin.compliance.exportCsv')}
            </button>
          </div>
          {contractsLoading ? (
            <div style={s.center}><Spinner size={15} style={{ verticalAlign: -2 }} /> {t('common.loading')}</div>
          ) : monthContracts.length === 0 ? (
            <div style={s.emptyState}>
              <p style={s.emptyIcon}><IconInbox size={44} /></p>
              <p style={s.emptyText}>{t('admin.compliance.emptyMcd', { month: fMonthName(month - 1, year), year })}</p>
            </div>
          ) : (
            <div style={s.tableWrap}>
              <div style={{ ...s.tableRow, ...s.tableHeader }}>
                <span>{t('admin.compliance.colWorkerNif')}</span>
                <span>{t('admin.compliance.colShiftDate')}</span>
                <span>{t('admin.compliance.colSchedule')}</span>
                <span>{t('admin.compliance.colRole')}</span>
                <span>{t('admin.compliance.colRate')}</span>
                <span />
              </div>
              {monthContracts.map(c => {
                const cancelled = c.shiftStatus === 'CANCELLED';
                return (
                  <div key={c.id} style={{ ...s.tableRow, opacity: cancelled ? 0.6 : 1 }}>
                    <div>
                      <p style={s.rowTitle}>{c.workerName}</p>
                      <p style={s.rowSub}>{c.workerNif}</p>
                    </div>
                    <span style={s.rowCell}>{fMediumDate(c.shiftDate)}</span>
                    <span style={s.rowCell}>{c.startTime}–{c.endTime}</span>
                    <span style={s.rowCell}>{c.role || '—'}</span>
                    <span style={{ ...s.rowCell, fontWeight: 700 }}>€{Number(c.grossHourlyRate).toFixed(2)}/hr</span>
                    {cancelled ? (
                      <span style={{ ...s.badge, color: '#991b1b', background: '#fee2e2' }}>{t('admin.compliance.cancelledTag')}</span>
                    ) : (
                      <button style={s.copyBtn} onClick={() => copyContract(c)}>
                        {copiedId === c.id ? t('admin.compliance.copied') : t('admin.compliance.copyRow')}
                      </button>
                    )}
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
          <p style={s.auditNote}>{t('admin.compliance.auditNote')}</p>
          {auditLoading ? (
            <div style={s.center}><Spinner size={15} style={{ verticalAlign: -2 }} /> {t('common.loading')}</div>
          ) : auditLog.length === 0 ? (
            <div style={s.emptyState}>
              <p style={s.emptyIcon}><IconInbox size={44} /></p>
              <p style={s.emptyText}>{t('admin.compliance.emptyAudit')}</p>
            </div>
          ) : (
            <div style={s.tableWrap}>
              <div style={{ ...s.tableRow, gridTemplateColumns: '1.5fr 2fr 0.8fr 3fr', ...s.tableHeader }}>
                <span>{t('admin.compliance.colDateTime')}</span>
                <span>{t('admin.compliance.colEvent')}</span>
                <span>{t('admin.compliance.colShiftShort')}</span>
                <span>{t('admin.compliance.colDetails')}</span>
              </div>
              {auditLog.map(entry => (
                <div key={entry.id} style={{ ...s.tableRow, gridTemplateColumns: '1.5fr 2fr 0.8fr 3fr' }}>
                  <span style={s.rowCell}>
                    {fTimestamp(entry.createdAt)}
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

  // Hires
  hireNotice: { fontSize: 13, color: '#92400e', background: '#fffbeb', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 8, padding: '10px 16px', marginBottom: 16 },
  exportBtn: {
    marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(22,163,74,0.3)',
    background: '#f0fdf4', color: '#16a34a', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  copyBtn: {
    justifySelf: 'start', padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(106,121,255,0.3)',
    background: 'rgba(106,121,255,0.08)', color: '#6a79ff', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
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
  emptyIcon: { display: 'flex', justifyContent: 'center', margin: '0 0 8px', color: 'var(--color-text-muted, #9ca3af)' },
  emptyText: { fontSize: 16, color: '#6b7280', margin: 0 },
};
