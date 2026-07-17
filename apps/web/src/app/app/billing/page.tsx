import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CheckoutPlanButton,
  OpenBillingPortalButton,
} from '../../../components/terminal/billing-actions';
import { formatMoney } from '../../../lib/money';
import { noIndexMeta } from '../../../lib/seo';
import { terminalGet } from '../../../lib/terminal-api';

export const metadata: Metadata = {
  ...noIndexMeta,
  title: 'Billing',
};

type BillingStatus = {
  domain: 'saas_billing';
  organizationId: string;
  planTier: string;
  accessAllowed: boolean;
  account: {
    id: string;
    provider: string;
    providerCustomerId: string;
    status: string;
    defaultCurrency: string;
  } | null;
  subscription: {
    id: string;
    planId: string;
    status: string;
    periodStart: string | null;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    providerSubscriptionId: string;
  } | null;
  invoices: Array<{
    id: string;
    status: string;
    currency: string;
    amountDueMinor: number;
    amountPaidMinor: number;
    hostedInvoiceUrl: string | null;
    periodStart: string | null;
    periodEnd: string | null;
  }>;
  plans: Array<{
    id: string;
    displayName: string;
    planTier: string;
    description: string;
    monthlyPriceMinor: number;
    annualPriceMinor: number;
    currency: string;
    stripeLiveCheckout: boolean;
  }>;
  mode: string;
  honesty: { note: string };
};

/**
 * SaaS billing — organizations pay TradeOps (Stripe Checkout / portal).
 * Separate from /terminal/finance/* commerce payments.
 */
export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const result = await terminalGet<BillingStatus>('/api/v1/billing/subscription');

  const flash =
    sp.dev_activated === '1'
      ? 'Development fixture subscription activated (no card data collected).'
      : sp.checkout === 'success'
        ? 'Checkout redirect received — access updates only after verified Stripe webhook, not from this URL alone.'
        : sp.checkout === 'cancelled'
          ? 'Checkout cancelled.'
          : null;

  if (!result.ok) {
    return (
      <section className="hero">
        <h1>Billing</h1>
        <p className="form-error">{result.error}</p>
        <Link href="/app">Back to workspace</Link>
      </section>
    );
  }

  const b = result.data;

  return (
    <section className="hero">
      <div className="app-header">
        <div>
          <p className="pill">SaaS billing · how you pay TradeOps</p>
          <h1>Billing &amp; subscription</h1>
          <p className="lede">
            This is how merchants pay <strong>TradeOps for software access</strong> (Stripe Checkout).
            Shopper checkout stays on Shopify, Amazon, eBay, PayPal, or your own processor—see{' '}
            <Link href="/terminal/finance/payments">channel payments</Link>. TradeOps is not an
            investment or custody product.
          </p>
        </div>
        <div className="app-actions">
          <OpenBillingPortalButton />
          <Link className="btn ghost" href="/terminal/cashflow">
            Cash flow
          </Link>
          <Link className="btn ghost" href="/app">
            Workspace
          </Link>
        </div>
      </div>

      {flash ? <p className="meta">{flash}</p> : null}

      <p className="meta">
        Mode: <code>{b.mode}</code> · Access allowed:{' '}
        <strong>{b.accessAllowed ? 'yes' : 'restricted'}</strong> · Plan tier:{' '}
        <strong>{b.planTier}</strong>
      </p>
      <p className="meta">{b.honesty.note}</p>

      <div className="grid">
        <article className="card">
          <h2>Current subscription</h2>
          {b.subscription ? (
            <ul className="kv">
              <li>
                <span>Plan</span>
                <strong>{b.subscription.planId}</strong>
              </li>
              <li>
                <span>Status</span>
                <strong>{b.subscription.status}</strong>
              </li>
              <li>
                <span>Period end</span>
                <strong>
                  {b.subscription.periodEnd
                    ? new Date(b.subscription.periodEnd).toLocaleString()
                    : '—'}
                </strong>
              </li>
              <li>
                <span>Provider sub</span>
                <strong>
                  <code>{b.subscription.providerSubscriptionId}</code>
                </strong>
              </li>
              <li>
                <span>Cancel at period end</span>
                <strong>{b.subscription.cancelAtPeriodEnd ? 'yes' : 'no'}</strong>
              </li>
            </ul>
          ) : (
            <p className="meta">No active subscription row yet. Choose a plan below.</p>
          )}
          {b.account ? (
            <p className="meta" style={{ marginTop: 12 }}>
              Billing account: {b.account.status} · customer{' '}
              <code>{b.account.providerCustomerId}</code>
            </p>
          ) : null}
        </article>

        <article className="card">
          <h2>Invoices</h2>
          {b.invoices.length === 0 ? (
            <p className="meta">No synced invoices yet.</p>
          ) : (
            <ul className="kv">
              {b.invoices.map((inv) => (
                <li key={inv.id}>
                  <span>
                    {inv.status} · {formatMoney(inv.amountDueMinor, inv.currency)}
                  </span>
                  <strong>
                    {inv.hostedInvoiceUrl ? (
                      <a href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : (
                      inv.id.slice(0, 8)
                    )}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <h2 style={{ marginTop: 24 }}>Plans</h2>
      <div className="grid">
        {b.plans.map((plan) => (
          <article className="card" key={plan.id}>
            <h3>{plan.displayName}</h3>
            <p className="meta">{plan.description}</p>
            <p>
              <strong>
                {plan.monthlyPriceMinor > 0
                  ? `${formatMoney(plan.monthlyPriceMinor, plan.currency)}/mo`
                  : 'Custom'}
              </strong>
              {plan.annualPriceMinor > 0 ? (
                <span className="meta">
                  {' '}
                  · {formatMoney(plan.annualPriceMinor, plan.currency)}/yr
                </span>
              ) : null}
            </p>
            <p className="meta">
              Entitlement tier: <code>{plan.planTier}</code>
              {plan.stripeLiveCheckout ? ' · Stripe Price configured' : ' · fixture or env Price ID'}
            </p>
            {plan.id !== 'enterprise' || plan.monthlyPriceMinor > 0 ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <CheckoutPlanButton planId={plan.id} interval="month" label="Monthly" />
                {plan.annualPriceMinor > 0 ? (
                  <CheckoutPlanButton planId={plan.id} interval="year" label="Annual" />
                ) : null}
              </div>
            ) : (
              <p className="meta">Contact sales for Enterprise (or configure Stripe Price IDs).</p>
            )}
          </article>
        ))}
      </div>

      <article className="card" style={{ marginTop: 24 }}>
        <h2>Security notes</h2>
        <ul>
          <li>Card data is collected only on Stripe-hosted Checkout — never stored in TradeOps.</li>
          <li>
            Browser redirect after Checkout is <strong>not</strong> proof of payment; webhooks and
            provider retrieval are source of truth.
          </li>
          <li>
            Webhook: <code>POST /api/v1/webhooks/stripe</code> with signature verification.
          </li>
        </ul>
      </article>
    </section>
  );
}
