import { redirect } from 'next/navigation';

/** Legacy control tower — Terminal is the process control center. */
export default function LegacyControlTowerRedirect() {
  redirect('/terminal/cockpit');
}
