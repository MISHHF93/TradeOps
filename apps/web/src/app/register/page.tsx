import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RegisterForm } from '../../components/auth-forms';
import { authRouteRedirectTarget, isFounderDirectAccess } from '../../lib/access-mode';

export const metadata: Metadata = { title: 'Register' };

export default function RegisterPage() {
  if (isFounderDirectAccess()) {
    redirect(authRouteRedirectTarget());
  }

  return (
    <section className="hero">
      <div className="auth-panel" style={{ maxWidth: 480 }}>
        <h1>Register your organization</h1>
        <p className="meta">
          Creates a real user, organization membership (owner), and session. No live marketplace
          credentials are invented.
        </p>
        <RegisterForm />
      </div>
    </section>
  );
}
