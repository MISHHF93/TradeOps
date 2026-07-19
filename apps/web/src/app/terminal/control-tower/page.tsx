import { redirect } from 'next/navigation';

/**
 * Legacy control tower → Ops Command Center.
 * Canonical COS visibility surface (connectors + AI + events + queues).
 * Executive home remains at /terminal/workspace/executive.
 */
export default function LegacyControlTowerRedirect() {
  redirect('/terminal/ops');
}
