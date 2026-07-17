/** theme.md §19 — truthfulness labels for data age */
export function FreshnessBadge({
  iso,
  maxAgeHours = 24,
}: {
  iso: string | null | undefined;
  maxAgeHours?: number;
}) {
  if (!iso) {
    return <span className="truth-label">UNAVAILABLE</span>;
  }
  const ageMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ageMs)) {
    return <span className="truth-label">UNAVAILABLE</span>;
  }
  const mins = Math.floor(ageMs / 60_000);
  if (mins < 5) {
    return <span className="truth-label truth-live">LIVE</span>;
  }
  if (mins < 60) {
    return <span className="truth-label">UPDATED {mins}M AGO</span>;
  }
  const hours = Math.floor(mins / 60);
  if (hours < maxAgeHours) {
    return <span className="truth-label">UPDATED {hours}H AGO</span>;
  }
  return <span className="truth-label truth-stale">STALE</span>;
}
