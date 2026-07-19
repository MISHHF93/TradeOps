import { Injectable } from '@nestjs/common';
import {
  describeAiProviders,
  describeWebSearchProviders,
  resolveProviderFromEnv,
} from '@tradeops/ai-runtime';
import { LIVE_HTTP_IMPLEMENTED, listLiveFeeds } from '@tradeops/connector-core';
import { CORE_WIRING_MATRIX } from '@tradeops/contracts';
import { checkDatabaseHealth } from '@tradeops/database';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export type DiagnosticProbe = {
  id: string;
  label: string;
  status: 'ok' | 'degraded' | 'blocked' | 'missing_config' | 'error';
  dataMode?: string;
  detail: string;
  missing?: string[];
};

/**
 * Protected stack diagnostics — never returns secret values.
 */
@Injectable()
export class DiagnosticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async probeStack(organizationId?: string): Promise<{
    at: string;
    probes: DiagnosticProbe[];
    wiring: typeof CORE_WIRING_MATRIX;
    summary: { ok: number; blocked: number; degraded: number };
    honesty: string;
  }> {
    const probes: DiagnosticProbe[] = [];

    try {
      const db = await checkDatabaseHealth(this.prisma.client);
      probes.push({
        id: 'database',
        label: 'PostgreSQL / PGlite',
        status: db.status === 'up' ? 'ok' : 'error',
        detail: db.message ?? `status=${db.status}`,
      });
    } catch (e) {
      probes.push({
        id: 'database',
        label: 'PostgreSQL / PGlite',
        status: 'error',
        detail: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const r = await this.redis.checkHealth();
      probes.push({
        id: 'redis',
        label: 'Redis',
        status: r.status === 'up' ? 'ok' : 'degraded',
        detail:
          r.status === 'up'
            ? `reachable (${r.latencyMs}ms)`
            : (r.message ?? 'unavailable — queues optional for first UI'),
      });
    } catch {
      probes.push({
        id: 'redis',
        label: 'Redis',
        status: 'degraded',
        detail: 'unavailable — worker/queues optional',
      });
    }

    const cohereKey = Boolean(
      process.env.COHERE_API_KEY?.trim() || process.env.CO_API_KEY?.trim(),
    );
    probes.push({
      id: 'cohere',
      label: 'Cohere Chat/Embed/Rerank',
      status: cohereKey ? 'ok' : 'missing_config',
      detail: cohereKey
        ? `configured (provider resolve=${resolveProviderFromEnv()})`
        : 'COHERE_API_KEY missing — generation blocked; tools still run',
      missing: cohereKey ? undefined : ['COHERE_API_KEY'],
    });
    probes.push({
      id: 'ai_providers',
      label: 'AI provider policy',
      status: 'ok',
      detail: describeAiProviders()
        .map((p) => `${p.id}:${p.configured ? 'cfg' : 'off'}${p.active ? '*' : ''}`)
        .join(', '),
    });

    const tavily = Boolean(process.env.TAVILY_API_KEY?.trim());
    probes.push({
      id: 'tavily',
      label: 'Public web search (Tavily)',
      status: tavily ? 'ok' : 'missing_config',
      detail: tavily ? 'configured' : 'TAVILY_API_KEY missing — research tools blocked',
      missing: tavily ? undefined : ['TAVILY_API_KEY'],
    });
    probes.push({
      id: 'web_search_policy',
      label: 'Web search providers',
      status: 'ok',
      detail: describeWebSearchProviders()
        .map((p) => `${p.id}:${p.configured ? 'cfg' : 'off'}`)
        .join(', '),
    });

    const shopReady =
      Boolean(process.env.SHOPIFY_SHOP_DOMAIN?.trim()) &&
      Boolean(process.env.SHOPIFY_ACCESS_TOKEN?.trim());
    probes.push({
      id: 'shopify',
      label: 'Shopify Admin GraphQL',
      status: shopReady ? 'ok' : 'missing_config',
      dataMode: shopReady ? 'live' : 'blocked',
      detail: shopReady
        ? 'credentials present (probe network separately)'
        : 'missing SHOPIFY_SHOP_DOMAIN / SHOPIFY_ACCESS_TOKEN — use fixtures',
      missing: shopReady ? undefined : ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'],
    });

    const stripe = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
    probes.push({
      id: 'stripe',
      label: 'Stripe Billing',
      status: stripe ? 'ok' : 'missing_config',
      detail: stripe
        ? 'STRIPE_SECRET_KEY set'
        : 'missing STRIPE_SECRET_KEY (dev fixture billing may apply)',
      missing: stripe ? undefined : ['STRIPE_SECRET_KEY'],
    });

    const easy = Boolean(process.env.EASYPOST_API_KEY?.trim());
    probes.push({
      id: 'easypost',
      label: 'EasyPost logistics',
      status: easy ? 'ok' : 'missing_config',
      detail: easy ? 'EASYPOST_API_KEY set' : 'missing EASYPOST_API_KEY',
      missing: easy ? undefined : ['EASYPOST_API_KEY'],
    });

    probes.push({
      id: 'ga4',
      label: 'GA4 tenant analytics',
      status: process.env.GA4_PROPERTY_ID?.trim() ? 'ok' : 'missing_config',
      detail: process.env.GA4_PROPERTY_ID?.trim()
        ? 'GA4_PROPERTY_ID set'
        : 'optional until tenant OAuth productized',
    });
    probes.push({
      id: 'posthog',
      label: 'PostHog product analytics',
      status: process.env.POSTHOG_API_KEY?.trim() ? 'ok' : 'missing_config',
      detail: process.env.POSTHOG_API_KEY?.trim() ? 'configured' : 'optional',
    });

    const feeds = listLiveFeeds();
    probes.push({
      id: 'connector_registry',
      label: 'Active connector registry',
      status: 'ok',
      detail: `${feeds.length} active feeds; LIVE_HTTP={${[...LIVE_HTTP_IMPLEMENTED].join(',')}}`,
    });

    probes.push({
      id: 'schemas_prompts_tools',
      label: 'AI registries',
      status: 'ok',
      detail: 'prompt/schema/artifact registries + tool registry loaded at AI module boot',
    });

    if (organizationId) {
      const [products, cases, runs] = await Promise.all([
        this.prisma.client.product.count({ where: { organizationId } }),
        this.prisma.client.commerceCase.count({ where: { organizationId } }),
        this.prisma.client.operatorRun.count({ where: { organizationId } }),
      ]);
      probes.push({
        id: 'tenant_data',
        label: 'Tenant data spine',
        status: products > 0 || cases > 0 ? 'ok' : 'degraded',
        detail: `products=${products} cases=${cases} operatorRuns=${runs}`,
      });
    }

    const summary = {
      ok: probes.filter((p) => p.status === 'ok').length,
      blocked: probes.filter((p) => p.status === 'missing_config' || p.status === 'blocked')
        .length,
      degraded: probes.filter((p) => p.status === 'degraded' || p.status === 'error').length,
    };

    return {
      at: new Date().toISOString(),
      probes,
      wiring: CORE_WIRING_MATRIX,
      summary,
      honesty:
        'Diagnostics never return secret values. missing_config means configure env or use fixtures — never silent demo data.',
    };
  }
}
