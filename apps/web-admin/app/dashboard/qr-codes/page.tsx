'use client';

/**
 * /dashboard/qr-codes
 *
 * Employer's permanent QR code management page (v2.1 — check-in only).
 *
 * The employer prints ONE QR code and posts it at the venue entrance:
 * the worker scans it on arrival. There is no check-out scan — shifts
 * complete automatically at their scheduled end time.
 *
 * The code is static (never expires): employer ID + action signed with
 * HMAC-SHA256. If the print is lost, regenerate here — it's deterministic.
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { adminApi, ApiError } from '../../../lib/api';
import { useT } from '../../../lib/i18n';
import { LanguageSwitcher } from '../../../components/LanguageSwitcher';
import { IconBulb, IconAlert, IconDoor, IconClock, IconInfo } from '../../../components/icons';

interface QrData {
  checkInQrDataUrl:  string;
  employerName:      string;
}

export default function QrCodesPage() {
  const { t } = useT();
  const [data, setData]       = useState<QrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminApi.getEmployerQrCodes());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.qrCodes.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
          <Link href="/dashboard/shifts" style={s.backLink}>{t('admin.qrCodes.back')}</Link>
          <h1 style={s.title}>{t('admin.qrCodes.title')}</h1>
          <p style={s.sub}>{t('admin.qrCodes.sub')}</p>
        </div>
        <div style={s.headerActions} className="no-print">
          <LanguageSwitcher />
          <button style={s.printBtn} onClick={() => window.print()} disabled={!data}>
            {t('admin.qrCodes.print')}
          </button>
          <button style={s.refreshBtn} onClick={fetch} disabled={loading}>
            {t('admin.qrCodes.regenerate')}
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div style={s.infoBanner} className="no-print">
        <div style={s.infoIcon}><IconBulb size={18} /></div>
        <div>
          <strong>{t('admin.qrCodes.infoLead')}</strong>{t('admin.qrCodes.infoBody1')}
          <em>{t('admin.qrCodes.infoCheckIn')}</em>{t('admin.qrCodes.infoBody2')}
          <strong>{t('admin.qrCodes.infoAuto')}</strong>{t('admin.qrCodes.infoBody3')}
          <em>{t('admin.qrCodes.infoMyShifts')}</em>{t('admin.qrCodes.infoBody4')}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={s.centered}>
          <div style={s.spinner} />
          <p style={s.loadingText}>{t('admin.qrCodes.loading')}</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={s.errorBanner}>
          <IconAlert size={15} /> {error}
          <button style={s.retryBtn} onClick={fetch}>{t('common.retry')}</button>
        </div>
      )}

      {/* QR codes */}
      {data && !loading && (
        <div id="print-area">

          {/* Print header (only shows when printing) */}
          <div style={s.printHeader}>
            <p style={s.printTitle}>{t('admin.qrCodes.printTitle')}</p>
            {data.employerName && <p style={s.printEmployer}>{data.employerName}</p>}
          </div>

          <div style={s.qrGrid}>

            {/* CHECK-IN */}
            <div style={{ ...s.qrCard, ...s.qrCardIn }}>
              <div style={s.qrCardHeader}>
                <div style={{ ...s.qrBadge, background: '#7c3aed' }}>↑</div>
                <div>
                  <h2 style={s.qrCardTitle}>{t('admin.qrCodes.cardTitle')}</h2>
                  <p style={s.qrCardSub}>{t('admin.qrCodes.cardSub')}</p>
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.checkInQrDataUrl}
                alt={t('admin.qrCodes.qrAlt')}
                style={s.qrImage}
              />
              <p style={s.qrInstruction}>
                {t('admin.qrCodes.instruction1')}
                <strong>{t('admin.qrCodes.instructionBold')}</strong>
                {t('admin.qrCodes.instruction2')}
              </p>
              <button
                style={{ ...s.downloadBtn, ...s.downloadBtnIn }}
                onClick={() => downloadQr(data.checkInQrDataUrl, `turnos-check-in-${data.employerName.replace(/\s+/g, '-').toLowerCase()}.png`)}
                className="no-print"
              >
                {t('admin.qrCodes.download')}
              </button>
            </div>

          </div>

          {/* Placement guide */}
          <div style={s.placementCard} className="no-print">
            <h3 style={s.placementTitle}>{t('admin.qrCodes.placementTitle')}</h3>
            <div style={s.placementGrid}>
              <div style={s.placementItem}>
                <div style={s.placementIcon}><IconDoor size={18} /></div>
                <div>
                  <strong>{t('admin.qrCodes.placementInLabel')}</strong>{t('admin.qrCodes.placementInWhere')}
                  <p style={s.placementDesc}>{t('admin.qrCodes.placementInDesc')}</p>
                </div>
              </div>
              <div style={s.placementItem}>
                <div style={s.placementIcon}><IconClock size={18} /></div>
                <div>
                  <strong>{t('admin.qrCodes.placementEndLabel')}</strong>{t('admin.qrCodes.placementEndWhere')}
                  <p style={s.placementDesc}>{t('admin.qrCodes.placementEndDesc')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Fallback note */}
          <div style={s.fallbackNote} className="no-print">
            <IconInfo size={15} />
            <span>
              {t('admin.qrCodes.fallback1')}
              <Link href="/dashboard/shifts" style={{ color: 'var(--color-primary)' }}>{t('admin.qrCodes.fallbackLink')}</Link>
              {t('admin.qrCodes.fallback2')}
              <strong>{t('admin.qrCodes.fallbackButton')}</strong>
              {t('admin.qrCodes.fallback3')}
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
  infoIcon: { display: 'inline-flex', flexShrink: 0, marginTop: 1 },

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
  placementIcon: { display: 'inline-flex', flexShrink: 0, color: 'var(--color-primary)' },
  placementDesc: { fontSize: 12, fontWeight: 400, color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.5 },

  // Fallback note
  fallbackNote: {
    display: 'flex', gap: 10, background: '#f8fafc', border: '1px solid var(--color-border)',
    borderRadius: 8, padding: '12px 16px', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6,
  },
};
