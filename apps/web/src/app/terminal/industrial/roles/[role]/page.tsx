import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ProcessPageHeader,
  ProcessRelatedLinks,
} from '../../../../../components/commerce/process-chrome';
import { terminalGet } from '../../../../../lib/terminal-api';

const ROLE_IDS = [
  'procurement',
  'supply_chain',
  'manufacturing',
  'engineering',
  'maintenance',
  'warehouse',
  'logistics',
  'executive',
  'finance',
  'sales',
] as const;

type Props = { params: Promise<{ role: string }> };

export default async function IndustrialRolePage({ params }: Props) {
  const { role } = await params;
  if (!ROLE_IDS.includes(role as (typeof ROLE_IDS)[number])) {
    notFound();
  }

  const catalog = await terminalGet<{
    roles?: Array<{
      id: string;
      label: string;
      mission: string;
      homeHref: string;
      defaultObjective: string;
      focusHrefs: Array<{ href: string; label: string }>;
      kpis: string[];
    }>;
  }>('/api/v1/industrial/catalog');

  const def = catalog.ok
    ? (catalog.data.roles ?? []).find((r) => r.id === role)
    : null;

  return (
    <section>
      <ProcessPageHeader
        pill="Industrial role"
        title={def?.label ?? role}
        lede={
          def?.mission ??
          'Role surface mapped into the TradeOps Commerce OS without a separate product.'
        }
        breadcrumbs={[
          { href: '/terminal/industrial', label: 'Industrial' },
          { label: def?.label ?? role },
        ]}
      />
      <ProcessRelatedLinks primary="process" />

      {def ? (
        <div className="detail-grid">
          <article className="panel">
            <h2>Focus workflows</h2>
            <ul className="meta">
              {def.focusHrefs.map((f) => (
                <li key={f.href}>
                  <Link href={f.href}>{f.label}</Link>
                </li>
              ))}
            </ul>
            <p className="meta" style={{ marginTop: 12 }}>
              Default AI objective:
            </p>
            <p>{def.defaultObjective}</p>
            <p style={{ marginTop: 12 }}>
              <Link
                className="btn primary"
                href={`/terminal/ai?objective=${encodeURIComponent(def.defaultObjective)}`}
              >
                Resolve with AI
              </Link>
            </p>
          </article>
          <article className="panel">
            <h2>KPI focus</h2>
            <ul className="meta">
              {def.kpis.map((k) => (
                <li key={k}>
                  <code>{k}</code>
                </li>
              ))}
            </ul>
            <p className="meta">
              KPIs are role attention labels — live values come from twin, procurement, and portfolio
              APIs when data exists.
            </p>
          </article>
        </div>
      ) : (
        <p className="form-error">{catalog.ok ? 'Role not found' : catalog.error}</p>
      )}
    </section>
  );
}
