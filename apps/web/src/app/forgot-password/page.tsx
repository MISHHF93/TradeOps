import { redirect } from 'next/navigation';
import { authRouteRedirectTarget, isFounderDirectAccess } from '../../lib/access-mode';

export default function ForgotPasswordPage() {
  if (isFounderDirectAccess()) {
    redirect(authRouteRedirectTarget());
  }
  redirect('/login');
}
