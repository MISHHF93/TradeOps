import { redirect } from 'next/navigation';

/**
 * Command center merged into Executive workspace home.
 * Feature page → persona workspace (reduce cognitive load).
 */
export default function CockpitRedirectPage() {
  redirect('/terminal/workspace/executive');
}
