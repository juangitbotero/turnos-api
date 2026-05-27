'use client';

/**
 * /dashboard/qr-codes
 *
 * Employer's permanent QR code management page.
 *
 * The employer prints these two QR codes once and posts them at their venue:
 *   • CHECK-IN  QR  (purple) — worker scans on arrival
 *   • CHECK-OUT QR  (green)  — worker scans on departure
 *
 * Both codes are static (never expire). They encode the employer's ID + action,
 * signed with HMAC-SHA256.  If the printed copies are lost or damaged, the
 * employer regenerates them here and prints again — the codes are deterministic.
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { adminApi, ApiError } from '../../../lib/api';

interface QrData {
  checkInQrDataUrl:  string;
  checkOutQrDataUrl: string;
  employerName:      string;
}

export default function QrCodesPage() {
  const [data, setData]       = useState<QrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminApi.getEmployerQrCodes());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar os QR codes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const downloadQr = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href     = dataUrl;
    link.download = filename;
    link.click();
  };

  return (
    <div style={s.page}>

      {/* Print-only header */}
      <div className="print-only" style={{ display: 'none' }}>
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #print-area, #print-area * { visibility: visible !important; }
            #print-area { position: fixed; inset: 0; }
            .print-only { display: block !important; }
            .no-print { display: none !important; }
          }
        `}</style>
      </div>

      {/* Screen header */}
      <div style={s.header} className="no-print">
        <div>
          <Link href="/dashboard/shifts" style={s.backLink}>← Voltar aos Turnos</Link>
          <h1 style={s.title}>Códigos QR de Check-in / Check-out</h1>
          <p style={s.sub}>
            Imprima estes dois QR codes e afixe-os no seu local de trabalho.
            Os trabalhadores Turnos usam a aplicação para os digitalizar na chegada e saída.
          </p>
        </div>
        <div style={s.headerActions} className="no-print">
          <button style={s.printBtn} onClick={() => window.print()} disabled={!data}>
            🖨️ Imprimir
          </button>
          <button style={s.refreshBtn} onClick={fetch} disabled={loading}>
            ↻ Regenerar
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div style={s.infoBanner} className="no-print">
        <div style={s.infoIcon}>💡</div>
        <div>
          <strong>Como funciona:</strong> Estes QR codes são permanentes — não expiram.
          Imprima-os uma vez e afixe-os na entrada/saída do seu espaço.
          Em caso de perda ou dano, pode sempre voltar a esta página para imprimir novamente.
          O trabalhador abre a aplicação Turnos, toca em <em>Check-in</em> ou <em>Check-out</em>,
          e aponta a câmara para o QR correspondente.
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={s.centered}>
          <div style={s.spinner} />
          <p style={s.loadingText}>A gerar QR codes...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={s.errorBanner}>
          ⚠️ {error}
          <button style={s.retryBtn} onClick={fetch}>Tentar novamente</button>
        </div>
      )}

      {/* QR codes */}
      {data && !loading && (
        <div id="print-area">

          {/* Print header (only shows when printing) */}
          <div style={s.printHeader}>
            <p style={s.printTitle}>Turnos — Check-in / Check-out</p>
            {data.employerName && <p style={s.printEmployer}>{data.employerName}</p>}
          </div>

          <div style={s.qrGrid}>

            {/* CHECK-IN */}
            <div style={{ ...s.qrCard, ...s.qrCardIn }}>
              <div style={s.qrCardHeader}>
                <div style={{ ...s.qrBadge, background: '#7c3aed' }}>↑</div>
                <div>
                  <h2 style={s.qrCardTitle}>CHECK-IN</h2>
                  <p style={s.qrCardSub}>Digitalizar na chegada</p>
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.checkInQrDataUrl}
                alt="QR Code Check-in"
                style={s.qrImage}
              />
              <p style={s.qrInstruction}>
                📱 Trabalhador abre a app → toca em <strong>Fazer Check-in</strong> → aponta a câmara aqui
              </p>
              <button
                style={{ ...s.downloadBtn, ...s.downloadBtnIn }}
                onClick={() => downloadQr(data.checkInQrDataUrl, `turnos-check-in-${data.employerName.replace(/\s+/g, '-').toLowerCase()}.png`)}
                className="no-print"
              >
                ⬇ Descarregar PNG
              </button>
            </div>

            {/* CHECK-OUT */}
            <div style={{ ...s.qrCard, ...s.qrCardOut }}>
              <div style={s.qrCardHeader}>
                <div style={{ ...s.qrBadge, background: '#16a34a' }}>↓</div>
                <div>
                  <h2 style={s.qrCardTitle}>CHECK-OUT</h2>
                  <p style={s.qrCardSub}>Digitalizar na saída</p>
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.checkOutQrDataUrl}
                alt="QR Code Check-out"
                style={s.qrImage}
              />
              <p style={s.qrInstruction}>
                📱 Trabalhador abre a app → toca em <strong>Fazer Check-out</strong> → aponta a câmara aqui
              </p>
              <button
                style={{ ...s.downloadBtn, ...s.downloadBtnOut }}
                onClick={() => downloadQr(data.checkOutQrDataUrl, `turnos-check-out-${data.employerName.replace(/\s+/g, '-').toLowerCase()}.png`)}
                className="no-print"
              >
                ⬇ Descarregar PNG
              </button>
            </div>

          </div>

          {/* Placement guide */}
          <div style={s.placementCard} className="no-print">
            <h3 style={s.placementTitle}>📌 Onde colocar os QR codes</h3>
            <div style={s.placementGrid}>
              <div style={s.placementItem}>
                <div style={s.placementIcon}>🚪</div>
                <div>
                  <strong>CHECK-IN</strong> — Entrada / Receção
                  <p style={s.placementDesc}>À entrada do espaço de trabalho, onde o trabalhador chega.</p>
                </div>
              </div>
              <div style={s.placementItem}>
                <div style={s.placementIcon}>🚶</div>
                <div>
                  <strong>CHECK-OUT</strong> — Saída / Receção
                  <p style={s.placementDesc}>Junto à saída ou na receção, onde o trabalhador se despede.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Fallback note */}
          <div style={s.fallbackNote} className="no-print">
            <span>ℹ️</span>
            <span>
              Se o trabalhador não conseguir digitalizar o QR (câmara com problemas, etc.),
              pode confirmar manualmente o turno na página{' '}
              <Link href="/dashboard/shifts" style={{ color: 'var(--color-primary)' }}>Os Meus Turnos</Link>{' '}
              com o botão <strong>✓ Confirmar</strong>.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: 32, maxWidth: 960, margin: '0 auto' },

  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 24 },
  backLink: { fontSize: 13, color: 'var(--color-text-secondary)', textDecoration: 'none', display: 'block', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px', marginBottom: 6 },
  sub: { fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, maxWidth: 560 },
  headerActions: { display: 'flex', gap: 10, flexShrink: 0, alignItems: 'flex-start', paddingTop: 4 },
  printBtn: {
    padding: '10px 20px', background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  refreshBtn: {
    padding: '10px 16px', background: 'var(--color-primary-light)', border: '1px solid rgba(106,121,255,0.3)',
    borderRadius: 8, color: 'var(--color-primary)', fontWeight: 600, fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit',
  },

  infoBanner: {
    display: 'flex', gap: 12, background: '#eff6ff', border: '1px solid rgba(59,130,246,0.2)',
    borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#1d4ed8',
    lineHeight: 1.6, marginBottom: 28,
  },
  infoIcon: { fontSize: 20, flexShrink: 0, marginTop: 1 },

  centered: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 16 },
  spinner: {
    width: 36, height: 36, borderRadius: 18,
    border: '3px solid rgba(106,121,255,0.2)', borderTopColor: 'var(--color-primary)',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { fontSize: 14, color: 'var(--color-text-secondary)' },

  errorBanner: {
    background: '#fee2e2', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10,
    padding: '16px 20px', color: '#dc2626', fontSize: 13,
    display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
  },
  retryBtn: {
    padding: '6px 14px', background: '#fff', border: '1px solid #fca5a5',
    borderRadius: 6, color: '#dc2626', fontWeight: 600, fontSize: 12,
    cursor: 'pointer', fontFamily: 'inherit',
  },

  // Print-only header (invisible on screen)
  printHeader: { display: 'none', textAlign: 'center', marginBottom: 24 },
  printTitle: { fontSize: 20, fontWeight: 800 },
  printEmployer: { fontSize: 14, color: '#6b7280', marginTop: 4 },

  // QR grid
  qrGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 24, marginBottom: 28,
  },
  qrCard: {
    borderRadius: 16, padding: 28, border: '2px solid transparent',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
  },
  qrCardIn:  { background: '#faf5ff', borderColor: 'rgba(124,58,237,0.2)' },
  qrCardOut: { background: '#f0fdf4', borderColor: 'rgba(22,163,74,0.2)'  },

  qrCardHeader: {
    display: 'flex', alignItems: 'center', gap: 12, alignSelf: 'flex-start', width: '100%',
  },
  qrBadge: {
    width: 40, height: 40, borderRadius: 10, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 800, flexShrink: 0,
  },
  qrCardTitle: { fontSize: 20, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: 1 },
  qrCardSub:   { fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 },

  qrImage: {
    width: 280, height: 280, borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.06)',
  },

  qrInstruction: {
    fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'center',
    lineHeight: 1.6, maxWidth: 280,
  },

  downloadBtn: {
    width: '100%', padding: '10px 0', borderRadius: 8, fontWeight: 700,
    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid transparent',
  },
  downloadBtnIn:  { background: '#ede9fe', borderColor: 'rgba(124,58,237,0.3)', color: '#7c3aed' },
  downloadBtnOut: { background: '#dcfce7', borderColor: 'rgba(22,163,74,0.3)',  color: '#16a34a' },

  // Placement guide
  placementCard: {
    background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12,
    padding: '20px 24px', marginBottom: 20,
  },
  placementTitle: { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 16 },
  placementGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  placementItem: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    padding: 12, background: 'var(--color-secondary)', borderRadius: 8,
    fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)',
  },
  placementIcon: { fontSize: 24, flexShrink: 0 },
  placementDesc: { fontSize: 12, fontWeight: 400, color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.5 },

  // Fallback note
  fallbackNote: {
    display: 'flex', gap: 10, background: '#f8fafc', border: '1px solid var(--color-border)',
    borderRadius: 8, padding: '12px 16px', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6,
  },
};
