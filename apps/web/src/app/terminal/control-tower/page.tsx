import { redirect } from 'next/navigation';

/**
 * Legacy control tower → Ops Command Center.
 * Canonical COS visibility surface (connectors + AI + events + queues).
 */
export default function LegacyControlTowerRedirect() {
  redirect('/terminal/ops');
}
