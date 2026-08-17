'use client';

/**
 * Billing page — Employer card setup + €45/mo "Turnos Starter" subscription.
 * Per-shift fees (3€) accumulate as Stripe InvoiceItems and appear on the
 * monthly subscription invoice, itemized per shift.
 *
 * Flow:
 *   1. If no payment method saved → show "Add card" button (opens Stripe Checkout-like UI).
 *      Since we don't embed Stripe Elements here (requires stripe-js), we show a clear CTA
 *      that explains the next step and links to Stripe's hosted page when ready.
 *   2. If card saved but no active subscription → show "Activate subscription" button.
 *   3. If subscription active → show plan details + cancel option.
 *
 * Note: Full Stripe Elements card form requires `@stripe/react-stripe-js` + `@stripe/stripe-js`.
 * This page uses the API layer and shows a "setup required" state for now. The stripe-js
 * integration can be dropped in once the package is installed:
 *   npm install @stripe/react-stripe-js @stripe/stripe-js
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminApi, ApiError } from '../../../lib/api';
import { useT } from '../../../lib/i18n';
import { LanguageSwitcher } from '../../../components/LanguageSwitcher';
import { IconAlert, IconBriefcase, IconClipboard, IconUsers, IconQr, IconChart, IconBuilding, IconEuro, IconBolt } from '../../../components/icons';

type BillingState =
  | 'loading'
  | 'no_card'          // no payment method saved
  | 'card_no_sub'      // card saved but no active subscription
  | 'active'           // subscription active
  | 'past_due'         // subscription past due
  | 'cancelled'        // subscription cancelled
  | 'error';

interface EmployerBillingInfo {
  companyName:        string | null;
  subscriptionTier:   string;
  subscriptionStatus: string;
  stripeCustomerId:   string | null;
  stripePaymentMethod: string | null;
}

export default function BillingPage() {
  const router = useRouter();
  const { t } = useT();
  const [state, setState]       = useState<BillingState>('loading');
  const [info, setInfo]         = useState<EmployerBillingInfo | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage]   = useState('');
  const [error, setError]       = useState('');

  useEffect(() => {
    adminApi.getMyProfile()
      .then(profile => {
        // Map subscription status from profile
        const tier   = profile.subscriptionTier ?? 'NONE';
        const status = (profile as any).subscriptionStatus ?? 'INACTIVE';

        setInfo({
          companyName:        profile.companyName,
          subscriptionTier:   tier,
          subscriptionStatus: status,
          stripeCustomerId:   null,   // not exposed via /me
          stripePaymentMethod: null,  // not exposed via /me
        });

        if (status === 'ACTIVE') {
          setState('active');
        } else if (status === 'PAST_DUE') {
          setState('past_due');
        } else if (status === 'CANCELLED') {
          setState('cancelled');
        } else {
          // INACTIVE — assume no card yet (server will tell us on subscribe attempt)
          setState('no_card');
        }
      })
      .catch(() => setState('error'));
  }, []);

  const handleActivateSubscription = async () => {
    setActionLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await adminApi.createSubscription();
      if (result.status === 'active' || result.status === 'ACTIVE') {
        setMessage(t('admin.billing.activated'));
        setState('active');
        setInfo(prev => prev ? { ...prev, subscriptionStatus: 'ACTIVE', subscriptionTier: 'STARTER' } : prev);
      } else {
        setMessage(t('admin.billing.activateStatus', { status: result.status }));
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('admin.billing.activateError');
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm(t('admin.billing.cancelConfirm'))) return;
    setActionLoading(true);
    setError('');
    setMessage('');
    try {
      await adminApi.cancelSubscription();
      setMessage(t('admin.billing.cancelled'));
      setState('cancelled');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('admin.billing.cancelError');
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <button style={s.backBtn} onClick={() => router.push('/dashboard')}>{t('admin.chrome.backDashboard')}</button>
          <h1 style={s.pageTitle}>{t('admin.billing.title')}</h1>
          <p style={s.pageSub}>{t('admin.billing.sub')}</p>
        </div>
        <LanguageSwitcher />
      </div>

      {/* Loading */}
      {state === 'loading' && (
        <div style={s.loadingCard}>
          <div style={s.spinner} />
          <p style={s.loadingText}>{t('admin.billing.loading')}</p>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div style={s.errorBanner}><IconAlert size={15} /> {t('admin.billing.loadError')}</div>
      )}

      {/* Plan card */}
      {state !== 'loading' && state !== 'error' && (
        <div style={s.grid}>

          {/* Current plan */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <h2 style={s.cardTitle}>{t('admin.billing.currentPlan')}</h2>
              <StatusBadge status={state} />
            </div>

            <div style={s.planName}>
              <span style={s.planIcon}><IconBriefcase size={22} /></span>
              <div>
                <div style={s.planTitle}>{t('admin.billing.planName')}</div>
                <div style={s.planPrice}>{t('admin.billing.planPrice')} <span style={s.planPriceSub}>{t('admin.billing.planPriceSub')}</span></div>
              </div>
            </div>

            <ul style={s.featureList}>
              {PLAN_FEATURE_KEYS.map(key => (
                <li key={key} style={s.featureItem}>
                  <span style={s.featureCheck}>✓</span>
                  {t(`admin.billing.features.${key}`)}
                </li>
              ))}
            </ul>

            {/* Feedback messages */}
            {message && <div style={s.successMsg}>{message}</div>}
            {error   && <div style={s.errorMsg}>{error}</div>}

            {/* CTA */}
            {(state === 'no_card' || state === 'cancelled') && (
              <div style={s.ctaSection}>
                <p style={s.ctaNote}>{t('admin.billing.ctaNote')}</p>
                <button
                  style={{ ...s.btn, ...s.btnPrimary }}
                  onClick={handleActivateSubscription}
                  disabled={actionLoading}
                >
                  {actionLoading ? t('admin.billing.processing') : t('admin.billing.activate')}
                </button>
                <p style={s.ctaSubNote}>{t('admin.billing.ctaSubNote')}</p>
              </div>
            )}

            {state === 'card_no_sub' && (
              <button
                style={{ ...s.btn, ...s.btnPrimary }}
                onClick={handleActivateSubscription}
                disabled={actionLoading}
              >
                {actionLoading ? t('admin.billing.processing') : t('admin.billing.activate')}
              </button>
            )}

            {state === 'past_due' && (
              <div style={s.warningBanner}>{t('admin.billing.pastDueBanner')}</div>
            )}

            {state === 'active' && (
              <button
                style={{ ...s.btn, ...s.btnDanger }}
                onClick={handleCancelSubscription}
                disabled={actionLoading}
              >
                {actionLoading ? t('admin.billing.processing') : t('admin.billing.cancel')}
              </button>
            )}
          </div>

          {/* What's included */}
          <div style={s.card}>
            <h2 style={s.cardTitle}>{t('admin.billing.aboutTitle')}</h2>
            <div style={s.infoSection}>
              <InfoRow icon={<IconClipboard size={15} />} label={t('admin.billing.rowShifts')} value={t('admin.billing.rowShiftsVal')} />
              <InfoRow icon={<IconUsers size={15} />} label={t('admin.billing.rowWorkers')} value={t('admin.billing.rowWorkersVal')} />
              <InfoRow icon={<IconQr size={15} />} label={t('admin.billing.rowQr')} value={t('admin.billing.rowQrVal')} />
              <InfoRow icon={<IconChart size={15} />} label={t('admin.billing.rowTsu')} value={t('admin.billing.rowTsuVal')} />
              <InfoRow icon={<IconBuilding size={15} />} label={t('admin.billing.rowSs')} value={t('admin.billing.rowSsVal')} />
              <InfoRow icon={<IconEuro size={15} />} label={t('admin.billing.rowFee')} value={t('admin.billing.rowFeeVal')} />
              <InfoRow icon={<IconBolt size={15} />} label={t('admin.billing.rowWage')} value={t('admin.billing.rowWageVal')} />
            </div>

            <div style={s.divider} />

            <h3 style={s.subSectionTitle}>{t('admin.billing.cancelPolicyTitle')}</h3>
            <p style={s.infoText}>
              {t('admin.billing.cancelPolicy1')}
              <strong>{t('admin.billing.cancelPolicyBold1')}</strong>
              {t('admin.billing.cancelPolicy2')}
              <strong>{t('admin.billing.cancelPolicyBold2')}</strong>
              {t('admin.billing.cancelPolicy3')}
              <strong>{t('admin.billing.cancelPolicyBold3')}</strong>
              {t('admin.billing.cancelPolicy4')}
            </p>

            <div style={s.divider} />

            <h3 style={s.subSectionTitle}>{t('admin.billing.proTitle')}</h3>
            <p style={s.infoText}>
              {t('admin.billing.proBody1')}
              <strong>{t('admin.billing.proPrice')}</strong>
              {t('admin.billing.proBody2')}
            </p>
          </div>

        </div>
      )}

      {/* Navigation */}
      <div style={s.navRow}>
        <Link href="/dashboard/spending" style={s.navLink}>{t('admin.billing.navSpending')}</Link>
        <Link href="/dashboard" style={s.navLink}>{t('admin.chrome.backToDashboard')}</Link>
      </div>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BillingState }) {
  const { t } = useT();
  // Colours here, labels in `admin.billing.status.*`
  const MAP: Record<string, { key: string; color: string; bg: string }> = {
    active:      { key: 'active',    color: '#166534', bg: '#dcfce7' },
    past_due:    { key: 'past_due',  color: '#92400e', bg: '#fef3c7' },
    cancelled:   { key: 'cancelled', color: '#991b1b', bg: '#fee2e2' },
    no_card:     { key: 'inactive',  color: '#6b7280', bg: '#f3f4f6' },
    card_no_sub: { key: 'inactive',  color: '#6b7280', bg: '#f3f4f6' },
  };
  const cfg = MAP[status];
  if (!cfg) return <span style={{ ...sb.badge, color: '#6b7280', background: '#f3f4f6' }}>—</span>;
  return (
    <span style={{ ...sb.badge, color: cfg.color, background: cfg.bg }}>
      {t(`admin.billing.status.${cfg.key}`)}
    </span>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={sb.infoRow}>
      <span style={sb.infoIcon}>{icon}</span>
      <span style={sb.infoLabel}>{label}</span>
      <span style={sb.infoValue}>{value}</span>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Feature ids — the copy lives in `admin.billing.features.*`. */
const PLAN_FEATURE_KEYS = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'] as const;

/* ─────────────────────────── Styles ─────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
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
  loadingCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
    gap: 16,
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
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
  warningBanner: {
    background: '#fef3c7',
    border: '1px solid #fcd34d',
    borderRadius: 'var(--radius-sm)',
    padding: '12px 16px',
    fontSize: 13,
    color: '#92400e',
    marginTop: 16,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: 20,
    alignItems: 'start',
  },
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: 28,
    boxShadow: 'var(--shadow-sm)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  planName: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '16px 20px',
    background: 'linear-gradient(135deg, var(--color-primary-light), #f5f3ff)',
    borderRadius: 'var(--radius-sm)',
    marginBottom: 20,
    border: '1px solid rgba(106,121,255,0.2)',
  },
  planIcon: { display: 'inline-flex', color: 'var(--color-primary)' },
  planTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--color-text-primary)',
    letterSpacing: '-0.5px',
  },
  planPrice: {
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--color-primary)',
    marginTop: 4,
  },
  planPriceSub: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.5,
  },
  featureCheck: {
    color: '#16a34a',
    fontWeight: 700,
    flexShrink: 0,
    fontSize: 14,
    marginTop: 1,
  },
  btn: {
    width: '100%',
    padding: '14px',
    border: 'none',
    borderRadius: 'var(--radius-full)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
    marginTop: 8,
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, var(--color-primary), #9b6dff)',
    color: '#fff',
    boxShadow: '0 4px 16px var(--color-primary-glow)',
  },
  btnDanger: {
    background: '#fee2e2',
    color: '#991b1b',
  },
  ctaSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  ctaNote: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.6,
    background: '#f9fafb',
    borderRadius: 'var(--radius-sm)',
    padding: '12px 14px',
    border: '1px solid var(--color-border)',
  },
  ctaSubNote: {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    lineHeight: 1.5,
    textAlign: 'center' as const,
  },
  successMsg: {
    background: '#dcfce7',
    border: '1px solid #86efac',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    fontSize: 13,
    color: '#166534',
    marginBottom: 12,
  },
  errorMsg: {
    background: '#fee2e2',
    border: '1px solid #fca5a5',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    fontSize: 13,
    color: '#991b1b',
    marginBottom: 12,
  },
  infoSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 20,
  },
  divider: {
    height: 1,
    background: 'var(--color-border)',
    margin: '20px 0',
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.6,
    marginBottom: 8,
  },
  policyList: {
    margin: '8px 0 12px 16px',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
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

const sb: Record<string, React.CSSProperties> = {
  badge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 'var(--radius-full)',
    letterSpacing: '0.3px',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 0',
    borderBottom: '1px solid var(--color-neutral-light)',
  },
  infoIcon: { display: 'inline-flex', justifyContent: 'center', width: 22, color: 'var(--color-text-secondary)' },
  infoLabel: {
    flex: 1,
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    textAlign: 'right' as const,
  },
};
