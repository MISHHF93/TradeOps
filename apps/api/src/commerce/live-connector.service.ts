import { Injectable, Logger } from '@nestjs/common';
import {
  CAPABILITY_PROVIDER_MAP,
  LIVE_HTTP_IMPLEMENTED,
  listProductionConnectors,
  listProductionRuntime,
  resolveCredentialStatus,
  type BusinessCapability,
  type LiveConnectorRuntimeRecord,
} from '@tradeops/connector-core';
import {
  liveSyncProvider,
  probeCredentials,
} from '@tradeops/connector-live-http';
import { PrismaService } from '../prisma/prisma.service';
import { recordOpsMetric } from '../observability/telemetry';
import { EventFabricService } from '../events/event-fabric.service';

/**
 * Live connector orchestration:
 * - Catalog = production registry + credential resolution
 * - Sync = credential-gated HTTP adapters → normalize → canonical store / bus
 * - Never marks connected without env credentials
 * - Never invents KPI values
 */
@Injectable()
export class LiveConnectorService {
  private readonly logger = new Logger(LiveConnectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventFabricService,
  ) {}

  /** Full production catalog with env credential status. */
  catalog(env: NodeJS.ProcessEnv = process.env): {
    connectors: LiveConnectorRuntimeRecord[];
    summary: {
      total: number;
      liveReady: number;
      credentialsRequired: number;
      httpImplemented: number;
    };
    honesty: { note: string };
  } {
    const connectors = listProductionRuntime(env);
    const liveReady = connectors.filter((c) => c.liveReady).length;
    return {
      connectors,
      summary: {
        total: connectors.length,
        liveReady,
        credentialsRequired: connectors.length - liveReady,
        httpImplemented: connectors.filter((c) => LIVE_HTTP_IMPLEMENTED.has(c.id))
          .length,
      },
      honesty: {
        note:
          'liveReady means env credentials are present — not that a successful vendor call has completed. Fixtures are excluded from this catalog. Simulation mode is separate (TRADEOPS_SIMULATION_MODE).',
      },
    };
  }

  /**
   * Upsert connector installations for this org from production catalog + env.
   * Does not claim connected without credentials.
   */
  async ensureRegistryInstalls(organizationId: string) {
    const runtime = listProductionRuntime();
    let upserted = 0;
    for (const c of runtime) {
      const status = c.liveReady ? 'connected' : 'credentials_required';
      await this.prisma.client.connectorInstallation.upsert({
        where: {
          organizationId_providerKey: {
            organizationId,
            providerKey: c.id,
          },
        },
        create: {
          organizationId,
          providerKey: c.id,
          displayName: c.displayName,
          family: String(c.category).slice(0, 32),
          isFixture: false,
          status,
          capabilities: c.technicalCapabilities as object,
          lastError: c.liveReady
            ? null
            : `Missing: ${c.missingKeys.join(', ')}`.slice(0, 500),
          metadataJson: {
            authMethod: c.authMethod,
            apiVersion: c.apiVersion,
            scopes: c.scopes,
            webhookTopics: c.webhookTopics,
            pollingStrategy: c.pollingStrategy,
            syncIntervalSeconds: c.syncIntervalSeconds,
            rateLimitRpm: c.rateLimitRpm ?? null,
            docsUrl: c.docsUrl,
            businessCapabilities: c.businessCapabilities,
            liveHttpImplemented: LIVE_HTTP_IMPLEMENTED.has(c.id),
            domain: c.domain,
          } as object,
        },
        update: {
          displayName: c.displayName,
          status,
          isFixture: false,
          capabilities: c.technicalCapabilities as object,
          lastError: c.liveReady
            ? null
            : `Missing: ${c.missingKeys.join(', ')}`.slice(0, 500),
          metadataJson: {
            authMethod: c.authMethod,
            apiVersion: c.apiVersion,
            scopes: c.scopes,
            webhookTopics: c.webhookTopics,
            pollingStrategy: c.pollingStrategy,
            syncIntervalSeconds: c.syncIntervalSeconds,
            rateLimitRpm: c.rateLimitRpm ?? null,
            docsUrl: c.docsUrl,
            businessCapabilities: c.businessCapabilities,
            liveHttpImplemented: LIVE_HTTP_IMPLEMENTED.has(c.id),
            domain: c.domain,
            lastRegistrySyncAt: new Date().toISOString(),
          } as object,
        },
      });
      upserted += 1;
    }
    return { upserted, liveReady: runtime.filter((r) => r.liveReady).length };
  }

  /**
   * Resolve which provider should fulfill a business capability for this org.
   * Prefers live-ready + installed; never returns vendor REST paths.
   */
  async resolveCapability(
    organizationId: string,
    capability: BusinessCapability | string,
  ) {
    const preferred = CAPABILITY_PROVIDER_MAP[capability] ?? [];
    const installs = await this.prisma.client.connectorInstallation.findMany({
      where: { organizationId, isFixture: false },
    });
    const installByKey = new Map(installs.map((i) => [i.providerKey, i]));
    const runtime = listProductionRuntime();
    const candidates = runtime
      .filter(
        (r) =>
          r.businessCapabilities.includes(capability as BusinessCapability) ||
          preferred.includes(r.id),
      )
      .map((r) => {
        const inst = installByKey.get(r.id);
        const cred = probeCredentials(r.id);
        const score =
          (cred.ready ? 100 : 0) +
          (inst?.status === 'connected' ? 50 : 0) +
          (LIVE_HTTP_IMPLEMENTED.has(r.id) ? 25 : 0) +
          (preferred.includes(r.id) ? 10 : 0) -
          (inst?.lastError ? 5 : 0);
        return {
          providerKey: r.id,
          displayName: r.displayName,
          liveReady: cred.ready,
          missingKeys: cred.missingKeys,
          httpImplemented: LIVE_HTTP_IMPLEMENTED.has(r.id),
          installStatus: inst?.status ?? 'not_installed',
          score,
        };
      })
      .sort((a, b) => b.score - a.score);

    return {
      capability,
      selected: candidates[0] ?? null,
      ranked: candidates.slice(0, 8),
      honesty: {
        note:
          'AI must request business capabilities only. Runtime selects provider. Vendor-specific REST is never exposed to the AI tool plane.',
      },
    };
  }

  /**
   * Run live sync for providers that have credentials + HTTP adapters.
   * Writes canonical Product rows for Shopify/Woo when data arrives.
   * Emits durable bus events. Never invents metrics.
   */
  async syncLive(
    organizationId: string,
    options?: { providerKeys?: string[]; searchQuery?: string },
  ) {
    await this.ensureRegistryInstalls(organizationId);
    const targets =
      options?.providerKeys?.length
        ? options.providerKeys
        : [...LIVE_HTTP_IMPLEMENTED];

    const results: Array<Record<string, unknown>> = [];

    for (const providerKey of targets) {
      const cred = probeCredentials(providerKey);
      if (!cred.ready) {
        results.push({
          providerKey,
          ok: false,
          skipped: true,
          reason: 'credentials_required',
          missingKeys: cred.missingKeys,
        });
        continue;
      }

      const t0 = Date.now();
      try {
        const fetchResult = await liveSyncProvider(providerKey, {
          query: options?.searchQuery,
        });
        const latencyMs = Date.now() - t0;

        if (!fetchResult.ok) {
          await this.touchInstall(organizationId, providerKey, {
            ok: false,
            error: fetchResult.error,
            latencyMs,
          });
          await this.events.ingest({
            organizationId,
            eventType: 'SyncFailed',
            providerKey,
            externalEventId: `sync-fail-${providerKey}-${Date.now()}`,
            isFixture: false,
            payload: {
              error: fetchResult.error,
              latencyMs,
              isLive: true,
            },
          });
          results.push({
            providerKey,
            ok: false,
            error: fetchResult.error,
            latencyMs,
          });
          continue;
        }

        const normalized = await this.persistLivePayload(
          organizationId,
          providerKey,
          fetchResult.data,
        );

        await this.touchInstall(organizationId, providerKey, {
          ok: true,
          latencyMs: fetchResult.latencyMs ?? latencyMs,
          counts: normalized.counts,
        });

        await this.events.ingest({
          organizationId,
          eventType: 'SyncCompleted',
          providerKey,
          externalEventId: `sync-ok-${providerKey}-${Date.now()}`,
          isFixture: false,
          payload: {
            counts: normalized.counts,
            latencyMs: fetchResult.latencyMs ?? latencyMs,
            isLive: true,
            fetchedAt: fetchResult.fetchedAt,
          },
        });

        recordOpsMetric('live_sync_ok');
        results.push({
          providerKey,
          ok: true,
          counts: normalized.counts,
          latencyMs: fetchResult.latencyMs ?? latencyMs,
          fetchedAt: fetchResult.fetchedAt,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`live sync ${providerKey}: ${msg}`);
        await this.touchInstall(organizationId, providerKey, {
          ok: false,
          error: msg,
          latencyMs: Date.now() - t0,
        });
        results.push({ providerKey, ok: false, error: msg });
      }
    }

    return {
      organizationId,
      results,
      honesty: {
        note:
          'Only credential-gated live HTTP adapters run. Empty results mean no vendor data or credentials missing — not fabricated zeros.',
      },
    };
  }

  /**
   * Persist live payload into canonical models where applicable.
   */
  private async persistLivePayload(
    organizationId: string,
    providerKey: string,
    data: unknown,
  ): Promise<{ counts: Record<string, number> }> {
    const counts: Record<string, number> = {};

    if (providerKey === 'shopify-graphql-admin' || providerKey === 'woocommerce-rest') {
      const payload = data as {
        products?: Array<{
          externalId: string;
          title: string;
          description: string;
          status: string;
        }>;
        orders?: Array<{
          externalId: string;
          name: string;
          totalMinor: number;
          currency: string;
          financialStatus: string;
        }>;
      };
      const products =
        payload.products ??
        (Array.isArray(data)
          ? (data as Array<{
              externalId: string;
              title: string;
              description: string;
              status: string;
            }>)
          : []);

      let productUpserts = 0;
      for (const p of products.slice(0, 50)) {
        await this.prisma.client.product.upsert({
          where: {
            organizationId_sourcePlatform_externalId: {
              organizationId,
              sourcePlatform: providerKey,
              externalId: p.externalId.slice(0, 128),
            },
          },
          create: {
            organizationId,
            title: (p.title || 'Untitled').slice(0, 500),
            description: (p.description || '').slice(0, 50_000),
            category: 'live_import',
            sourcePlatform: providerKey,
            externalId: p.externalId.slice(0, 128),
            currency: 'USD',
            supplierCostMinor: 0,
            shippingCostMinor: 0,
            targetPriceMinor: 0,
            marketplaceFeeMinor: 0,
            paymentFeeMinor: 0,
            inventoryQuantity: 0,
            dataConfidence: 0.85,
            dataFreshnessAt: new Date(),
            sourceProvenance: `live_http:${providerKey}`,
            schemaVersion: '2',
          },
          update: {
            title: (p.title || 'Untitled').slice(0, 500),
            description: (p.description || '').slice(0, 50_000),
            dataConfidence: 0.85,
            dataFreshnessAt: new Date(),
            sourceProvenance: `live_http:${providerKey}`,
          },
        });
        productUpserts += 1;

        await this.events.ingest({
          organizationId,
          eventType: 'ProductCreated',
          providerKey,
          externalEventId: `product-${providerKey}-${p.externalId}`.slice(0, 128),
          isFixture: false,
          payload: {
            externalId: p.externalId,
            title: p.title,
            status: p.status,
            isLive: true,
          },
        });
      }
      counts.products = productUpserts;

      if (payload.orders?.length) {
        let orderEvents = 0;
        for (const o of payload.orders.slice(0, 25)) {
          await this.events.ingest({
            organizationId,
            eventType: 'OrderCreated',
            providerKey,
            externalEventId: `order-${providerKey}-${o.externalId}`.slice(0, 128),
            isFixture: false,
            payload: {
              kind: 'order',
              externalId: o.externalId,
              name: o.name,
              totalMinor: o.totalMinor,
              currency: o.currency,
              status: o.financialStatus,
              isLive: true,
              sourcePlatform: providerKey,
            },
          });
          orderEvents += 1;
        }
        counts.orders = orderEvents;
      }
    }

    if (providerKey === 'stripe-api') {
      const payload = data as {
        payouts?: Array<{
          externalPayoutId: string;
          amountMinor: number;
          currency: string;
          status: string;
        }>;
        balance?: {
          available: Array<{ amount: number; currency: string }>;
          pending: Array<{ amount: number; currency: string }>;
        } | null;
      };
      let payoutEvents = 0;
      for (const p of payload.payouts ?? []) {
        await this.events.ingest({
          organizationId,
          eventType: 'PaymentSucceeded',
          providerKey,
          externalEventId: `payout-${p.externalPayoutId}`.slice(0, 128),
          isFixture: false,
          payload: {
            kind: 'payout',
            externalId: p.externalPayoutId,
            amountMinor: p.amountMinor,
            currency: p.currency,
            status: p.status,
            isLive: true,
          },
        });
        payoutEvents += 1;
      }
      counts.payouts = payoutEvents;
      if (payload.balance) {
        await this.events.ingest({
          organizationId,
          eventType: 'SyncCompleted',
          providerKey,
          externalEventId: `balance-${Date.now()}`,
          isFixture: false,
          payload: {
            kind: 'stripe_balance',
            balance: payload.balance,
            isLive: true,
          },
        });
        counts.balanceSnapshots = 1;
      }
    }

    if (providerKey === 'open-exchange-rates') {
      const rates = data as { base: string; rates: Record<string, number> };
      await this.events.ingest({
        organizationId,
        eventType: 'SyncCompleted',
        providerKey,
        externalEventId: `fx-${rates.base}-${Date.now()}`,
        isFixture: false,
        payload: {
          kind: 'fx_rates',
          base: rates.base,
          rateCount: Object.keys(rates.rates ?? {}).length,
          sample: {
            EUR: rates.rates?.EUR,
            CAD: rates.rates?.CAD,
            GBP: rates.rates?.GBP,
          },
          isLive: true,
        },
      });
      counts.fxCurrencies = Object.keys(rates.rates ?? {}).length;
    }

    if (providerKey === 'easypost-api') {
      const trackers = Array.isArray(data)
        ? (data as Array<{
            externalId: string;
            trackingCode: string;
            status: string;
            carrier: string;
          }>)
        : [];
      let n = 0;
      for (const t of trackers.slice(0, 25)) {
        const delayed =
          /delay|exception|failure|return/i.test(t.status) ||
          t.status === 'error';
        await this.events.ingest({
          organizationId,
          eventType: delayed ? 'ShipmentDelayed' : 'WebhookReceived',
          providerKey,
          externalEventId: `tracker-${t.externalId}`.slice(0, 128),
          isFixture: false,
          payload: {
            kind: 'shipment_tracker',
            trackingCode: t.trackingCode,
            status: t.status,
            carrier: t.carrier,
            isLive: true,
          },
        });
        n += 1;
      }
      counts.trackers = n;
    }

    if (providerKey === 'serpapi') {
      const items = Array.isArray(data) ? data : [];
      await this.events.ingest({
        organizationId,
        eventType: 'SyncCompleted',
        providerKey,
        externalEventId: `serp-${Date.now()}`,
        isFixture: false,
        payload: {
          kind: 'shopping_search',
          resultCount: items.length,
          sample: items.slice(0, 5),
          isLive: true,
        },
      });
      counts.searchResults = items.length;
    }

    return { counts };
  }

  private async touchInstall(
    organizationId: string,
    providerKey: string,
    result: {
      ok: boolean;
      error?: string;
      latencyMs?: number;
      counts?: Record<string, number>;
    },
  ) {
    const inst = await this.prisma.client.connectorInstallation.findUnique({
      where: {
        organizationId_providerKey: { organizationId, providerKey },
      },
    });
    if (!inst) return;
    const prev =
      inst.metadataJson && typeof inst.metadataJson === 'object'
        ? (inst.metadataJson as Record<string, unknown>)
        : {};
    await this.prisma.client.connectorInstallation.update({
      where: { id: inst.id },
      data: {
        lastHealthAt: new Date(),
        lastError: result.ok ? null : (result.error ?? 'sync_failed').slice(0, 500),
        status: result.ok ? 'connected' : 'unhealthy',
        metadataJson: {
          ...prev,
          lastLiveSyncAt: new Date().toISOString(),
          lastLatencyMs: result.latencyMs ?? null,
          lastSyncCounts: result.counts ?? null,
          lastSyncOk: result.ok,
        } as object,
      },
    });
  }

  /** List production connectors for OAuth/credential install UI. */
  listDescriptors() {
    return listProductionConnectors().map((c) => {
      const cred = resolveCredentialStatus(c);
      return {
        id: c.id,
        provider: c.provider,
        displayName: c.displayName,
        category: c.category,
        domain: c.domain,
        authMethod: c.authMethod,
        apiVersion: c.apiVersion,
        docsUrl: c.docsUrl,
        scopes: c.scopes,
        businessCapabilities: c.businessCapabilities,
        technicalCapabilities: c.technicalCapabilities,
        webhookTopics: c.webhookTopics,
        pollingStrategy: c.pollingStrategy,
        syncIntervalSeconds: c.syncIntervalSeconds,
        rateLimitRpm: c.rateLimitRpm ?? null,
        credentialEnvKeys: c.credentialEnvKeys.map((k) =>
          // Never return secret values — only key names + presence
          ({ key: k, present: Boolean(process.env[k]?.trim()) }),
        ),
        status: cred.status,
        oauthStatus: cred.oauthStatus,
        liveReady: cred.ready,
        httpImplemented: LIVE_HTTP_IMPLEMENTED.has(c.id),
        isFixture: false as const,
      };
    });
  }
}
