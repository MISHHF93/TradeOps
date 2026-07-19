import { redirect } from 'next/navigation';

/** Legacy control tower — use Executive workspace home. */
export default function LegacyControlTowerRedirect() {
  redirect('/terminal/workspace/executive');
}
