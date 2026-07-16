import type { Metadata } from 'next';
import { LoginForm } from '../../components/auth-forms';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
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
