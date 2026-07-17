import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '../../components/auth-forms';
import { authRouteRedirectTarget, isFounderDirectAccess } from '../../lib/access-mode';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  if (isFounderDirectAccess()) {
    redirect(authRouteRedirectTarget());
  }

  return (
    <section className="hero">
      <div className="auth-panel">
        <h1>Merchant sign in</h1>
        <p className="meta">
          Authenticates against the TradeOps API and sets a session cookie. Public pages remain
          separate — this is the workspace boundary.
        </p>
        <LoginForm />
      </div>
    </section>
  );
}
