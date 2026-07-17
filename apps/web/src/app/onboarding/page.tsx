import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { OnboardingForm } from '../../components/onboarding-form';
import { authRouteRedirectTarget, isFounderDirectAccess } from '../../lib/access-mode';
import { noIndexMeta } from '../../lib/seo';

export const metadata: Metadata = {
  ...noIndexMeta,
  title: 'Onboarding',
};

export default function OnboardingPage() {
  if (isFounderDirectAccess()) {
    redirect(authRouteRedirectTarget());
  }

  return (
    <section className="hero">
      <div className="auth-panel" style={{ maxWidth: 520 }}>
        <h1>Segment onboarding</h1>
        <p className="meta">
          TradeOps is multi-tenant SaaS. Tell us who you are so we can set plan defaults, workspace
          persona, and hide enterprise complexity until you need it. You can change this later.
        </p>
        <OnboardingForm />
      </div>
    </section>
  );
}
