import { redirect } from 'next/navigation';
import { authRouteRedirectTarget, isFounderDirectAccess } from '../../lib/access-mode';

export default function VerifyEmailPage() {
  if (isFounderDirectAccess()) {
    redirect(authRouteRedirectTarget());
  }
  redirect('/login');
}
