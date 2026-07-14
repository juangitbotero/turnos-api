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
        setMessage('✅ Subscrição ativada com sucesso! Podes agora publicar turnos.');
        setState('active');
        setInfo(prev => prev ? { ...prev, subscriptionStatus: 'ACTIVE', subscriptionTier: 'STARTER' } : prev);
      } else {
        setMessage(`Estado da subscrição: ${result.status}`);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Erro ao ativar a subscrição.';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Tens a certeza que queres cancelar a subscrição? Perderás o acesso no final do período atual.')) return;
    setActionLoading(true);
    setError('');
    setMessage('');
    try {
      await adminApi.cancelSubscription();
      setMessage('Subscrição cancelada. O acesso mantém-se até ao fim do período atual.');
      setState('cancelled');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Erro ao cancelar a subscrição.';
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
          <button style={s.backBtn} onClick={() => router.push('/dashboard')}>← Dashboard</button>
          <h1 style={s.pageTitle}>Faturação</h1>
          <p style={s.pageSub}>Gerir o teu plano de subscrição Turnos</p>
        </div>
      </div>

      {/* Loading */}
      {state === 'loading' && (
        <div style={s.loadingCard}>
          <div style={s.spinner} />
          <p style={s.loadingText}>A carregar informação de faturação…</p>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div style={s.errorBanner}>
          ⚠️ Não foi possível carregar a informação de faturação. Tenta novamente.
        </div>
      )}

      {/* Plan card */}
      {state !== 'loading' && state !== 'error' && (
        <div style={s.grid}>

          {/* Current plan */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <h2 style={s.cardTitle}>Plano atual</h2>
              <StatusBadge status={state} />
            </div>

            <div style={s.planName}>
              <span style={s.planIcon}>💼</span>
              <div>
                <div style={s.planTitle}>Turnos Starter</div>
                <div style={s.planPrice}>€45 <span style={s.planPriceSub}>/mês por empresa + 3€ por turno concluído</span></div>
              </div>
            </div>

            <ul style={s.featureList}>
              {PLAN_FEATURES.map(f => (
                <li key={f} style={s.featureItem}>
                  <span style={s.featureCheck}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {/* Feedback messages */}
            {message && <div style={s.successMsg}>{message}</div>}
            {error   && <div style={s.errorMsg}>{error}</div>}

            {/* CTA */}
            {(state === 'no_card' || state === 'cancelled') && (
              <div style={s.ctaSection}>
                <p style={s.ctaNote}>
                  Para ativar a subscrição, precisas primeiro de adicionar um cartão de crédito.
                  Usa o painel de pagamentos Stripe para guardar o teu método de pagamento.
                </p>
                <button
                  style={{ ...s.btn, ...s.btnPrimary }}
                  onClick={handleActivateSubscription}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'A processar…' : '🚀 Ativar subscrição — €45/mês'}
                </button>
                <p style={s.ctaSubNote}>
                  Nota: Se ainda não tens cartão guardado, a ativação irá falhar com uma
                  mensagem clara. Fala com o suporte Turnos para adicionar o cartão via Stripe Dashboard.
                </p>
              </div>
            )}

            {state === 'card_no_sub' && (
              <button
                style={{ ...s.btn, ...s.btnPrimary }}
                onClick={handleActivateSubscription}
                disabled={actionLoading}
              >
                {actionLoading ? 'A processar…' : '🚀 Ativar subscrição — €45/mês'}
              </button>
            )}

            {state === 'past_due' && (
              <div style={s.warningBanner}>
                ⚠️ O pagamento do teu plano falhou. Por favor atualiza o método de pagamento
                no Stripe Dashboard ou contacta o suporte Turnos.
              </div>
            )}

            {state === 'active' && (
              <button
                style={{ ...s.btn, ...s.btnDanger }}
                onClick={handleCancelSubscription}
                disabled={actionLoading}
              >
                {actionLoading ? 'A processar…' : 'Cancelar subscrição'}
              </button>
            )}
          </div>

          {/* What's included */}
          <div style={s.card}>
            <h2 style={s.cardTitle}>Sobre o plano Starter</h2>
            <div style={s.infoSection}>
              <InfoRow icon="📋" label="Turnos simultâneos" value="Até 15 turnos ativos" />
              <InfoRow icon="👷" label="Trabalhadores" value="Ilimitados" />
              <InfoRow icon="📲" label="QR Check-in/out" value="Incluído" />
              <InfoRow icon="📊" label="Relatório TSU" value="Incluído (informativo)" />
              <InfoRow icon="🏛️" label="SS Direta (MCD)" value="Automático" />
              <InfoRow icon="💶" label="Taxa por turno concluído" value="3€ fixos — faturados 1×/mês" />
              <InfoRow icon="⚡" label="Salário do trabalhador" value="Pagas diretamente — 0% de comissão" />
            </div>

            <div style={s.divider} />

            <h3 style={s.subSectionTitle}>Política de cancelamento de turnos</h3>
            <p style={s.infoText}>
              Cancelar um turno preenchido com menos de <strong>3 horas</strong> de antecedência,
              sem justificação, obriga ao pagamento de um <strong>mínimo de 2 horas</strong> ao
              trabalhador (via Pay Link) + a taxa normal de 3€. Entre 24h e 3h o cancelamento é
              gratuito mas fica registado na fiabilidade da empresa. Cancelamentos justificados
              (atraso do trabalhador, força maior, etc.) e com mais de 24h são{' '}
              <strong>gratuitos</strong>.
            </p>

            <div style={s.divider} />

            <h3 style={s.subSectionTitle}>Turnos Pro — brevemente 🚀</h3>
            <p style={s.infoText}>
              Turnos ilimitados em simultâneo, 5 utilizadores, taxa de 2€/turno,
              filtros avançados de pesquisa e convite direto de trabalhadores,
              relatórios de contabilidade — <strong>€99/mês</strong>. Fala connosco para saber mais.
            </p>
          </div>

        </div>
      )}

      {/* Navigation */}
      <div style={s.navRow}>
        <Link href="/dashboard/spending" style={s.navLink}>Ver Gastos →</Link>
        <Link href="/dashboard" style={s.navLink}>← Voltar ao Dashboard</Link>
      </div>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BillingState }) {
  const MAP: Record<string, { label: string; color: string; bg: string }> = {
    active:    { label: 'Ativo',          color: '#166534', bg: '#dcfce7' },
    past_due:  { label: 'Pagamento em falta', color: '#92400e', bg: '#fef3c7' },
    cancelled: { label: 'Cancelado',      color: '#991b1b', bg: '#fee2e2' },
    no_card:   { label: 'Inativo',        color: '#6b7280', bg: '#f3f4f6' },
    card_no_sub: { label: 'Inativo',      color: '#6b7280', bg: '#f3f4f6' },
  };
  const cfg = MAP[status] ?? { label: '—', color: '#6b7280', bg: '#f3f4f6' };
  return (
    <span style={{ ...sb.badge, color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={sb.infoRow}>
      <span style={sb.infoIcon}>{icon}</span>
      <span style={sb.infoLabel}>{label}</span>
      <span style={sb.infoValue}>{value}</span>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLAN_FEATURES = [
  'Publicar até 15 turnos em simultâneo',
  'Procurar e convidar trabalhadores por competência e idioma',
  'Gestão de candidaturas e aprovação de trabalhadores',
  'QR Check-in no local + conclusão automática do turno',
  'Conformidade MCD — contratos e SS Direta automáticos',
  'Relatório TSU mensal pronto para a contabilidade',
  'Notificações push em tempo real',
];

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
  planIcon: { fontSize: 36 },
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
  infoIcon: { fontSize: 16, width: 22, textAlign: 'center' as const },
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
