import { redirect } from 'next/navigation';
import { authRouteRedirectTarget, isFounderDirectAccess } from '../../lib/access-mode';

/** Alias of /register — founder_direct goes to workspace. */
export default function SignupAliasPage() {
  if (isFounderDirectAccess()) {
    redirect(authRouteRedirectTarget());
  }
  redirect('/register');
}
