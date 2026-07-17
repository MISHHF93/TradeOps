import { isFounderDirectAccess } from '../../lib/access-mode';

/**
 * Visible only when founder_direct is on AND the deployment looks public
 * (or TRADEOPS_PUBLIC_WARNING is set). Not shown on typical localhost.
 */
export function FounderAccessBanner({ forcePublicWarning }: { forcePublicWarning?: boolean }) {
  if (!isFounderDirectAccess()) return null;

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.WEB_ORIGIN ??
    'http://localhost:3000';
  let publicish = forcePublicWarning === true;
  if (!publicish) {
    try {
      const host = new URL(origin).hostname.toLowerCase();
      publicish =
        host !== 'localhost' &&
        host !== '127.0.0.1' &&
        host !== '::1' &&
        !host.endsWith('.local') &&
        !host.endsWith('.localhost');
    } catch {
      publicish = false;
    }
  }
  if (process.env.TRADEOPS_PUBLIC_WARNING === 'true' || process.env.TRADEOPS_PUBLIC_WARNING === '1') {
    publicish = true;
  }
  if (!publicish) return null;

  return (
    <div
      role="status"
      className="founder-access-banner"
      style={{
        background: 'var(--warn-bg, #3d2a00)',
        color: 'var(--warn-fg, #ffd78a)',
        padding: '8px 14px',
        fontSize: '0.85rem',
        borderBottom: '1px solid rgba(255,215,138,0.25)',
      }}
    >
      <strong>Direct Founder Access is enabled.</strong> This deployment should not be treated as a
      public multi-user environment.
    </div>
  );
}
