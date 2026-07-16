import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  GOOGLE_MERCHANT_PROVIDER_KEY,
  GoogleMerchantConnector,
  isWeekendLocal,
  nextWeekendMorning,
  type GoogleMerchantCredentials,
  type GoogleWeekendPostResult,
} from '@tradeops/connector-google-merchant';
import { listLiveFeeds } from '@tradeops/connector-core';
import { assessProductPolicy } from '@tradeops/commerce-engine';
import { isAuthBypassEnabled, loadEnv } from '@tradeops/config';
import { AuditService } from '../identity/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Weekend Google Merchant feed automation.
 *
 * Saturday/Sunday: prepare (and only if credentials exist, attempt live) product feeds.
 * Default is shadow mode — never claims live success without authorized API result.
 */
@Injectable()
export class GoogleWeekendService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GoogleWeekendService.name);
  private timer: NodeJS.Timeout | null = null;
  private lastRunKey: string | null = null;
  private lastResult: GoogleWeekendPostResult | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    // Hourly check; runs once per weekend morning window.
    this.timer = setInterval(() => {
      void this.maybeRunWeekendJob();
    }, 60 * 60 * 1000);
    // Also evaluate shortly after boot so local dev can observe scheduling state.
    setTimeout(() => void this.maybeRunWeekendJob(), 15_000);
    this.logger.log(
      `Google weekend automation scheduler armed. Next window: ${nextWeekendMorning().toISOString()}`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  listFeedRegistry() {
    return listLiveFeeds().map((f) => ({
      ...f,
      weekendEligible: f.weekendAutomation,
    }));
  }

  getStatus() {
    const env = loadEnv();
    const credentials = this.readCredentialsFromEnv();
    const connector = new GoogleMerchantConnector(credentials);
    return {
      providerKey: GOOGLE_MERCHANT_PROVIDER_KEY,
      connectorStatus: connector.status(),
      hasCredentials: connector.status() === 'connected',
      isWeekend: isWeekendLocal(),
      nextWeekendMorning: nextWeekendMorning().toISOString(),
      lastRunKey: this.lastRunKey,
      lastResult: this.lastResult
        ? {
            mode: this.lastResult.mode,
            preparedCount: this.lastResult.preparedCount,
            postedCount: this.lastResult.postedCount,
            livePostSucceeded: this.lastResult.livePostSucceeded,
            status: this.lastResult.status,
            message: this.lastResult.message,
            scheduledFor: this.lastResult.scheduledFor,
            errors: this.lastResult.errors,
          }
        : null,
      authBypass: isAuthBypassEnabled(env),
      schedule: 'Saturday and Sunday 09:00 local (shadow by default)',
    };
  }

  /**
   * Prepare weekend Google Merchant feed for the demo org (or first org).
   * Shadow by default; live only if GOOGLE_MERCHANT_* credentials exist.
   */
  async prepareWeekendFeed(options?: {
    forceShadow?: boolean;
    organizationId?: string;
    userId?: string;
  }): Promise<GoogleWeekendPostResult> {
    const credentials = this.readCredentialsFromEnv();
    const connector = new GoogleMerchantConnector(credentials);

    const org =
      options?.organizationId
        ? await this.prisma.client.organization.findUnique({
            where: { id: options.organizationId },
          })
        : await this.prisma.client.organization.findFirst({
            where: { slug: 'demo-commerce' },
          }) ??
          (await this.prisma.client.organization.findFirst({ orderBy: { createdAt: 'asc' } }));

    if (!org) {
      const empty = await connector.prepareWeekendFeed([], {
        forceShadow: true,
      });
      empty.message = 'No organization found. Run setup:db before weekend Google automation.';
      empty.errors.push('organization_missing');
      this.lastResult = empty;
      return empty;
    }

    // Ensure google-merchant installation row exists with honest status.
    const status = connector.status();
    await this.prisma.client.connectorInstallation.upsert({
      where: {
        organizationId_providerKey: {
          organizationId: org.id,
          providerKey: GOOGLE_MERCHANT_PROVIDER_KEY,
        },
      },
      create: {
        organizationId: org.id,
        providerKey: GOOGLE_MERCHANT_PROVIDER_KEY,
        displayName: 'Google Merchant Center',
        family: 'marketplace',
        isFixture: false,
        status,
        capabilities: [
          'createListing',
          'updateListing',
          'pauseListing',
          'readInventory',
          'readFees',
        ],
        lastHealthAt: new Date(),
        lastError:
          status === 'credentials_required'
            ? 'OAuth credentials not configured (GOOGLE_MERCHANT_ACCESS_TOKEN / MERCHANT_ID)'
            : null,
      },
      update: {
        status,
        isFixture: false,
        lastHealthAt: new Date(),
        lastError:
          status === 'credentials_required'
            ? 'OAuth credentials not configured (GOOGLE_MERCHANT_ACCESS_TOKEN / MERCHANT_ID)'
            : null,
      },
    });

    const products = await this.prisma.client.product.findMany({
      where: { organizationId: org.id },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    // Fail-closed: never prepare policy-blocked SKUs for Google Merchant.
    const policySkipped: string[] = [];
    const eligible = products.filter((p) => {
      const policy = assessProductPolicy({
        title: p.title,
        description: p.description ?? undefined,
      });
      if (policy.outcome === 'blocked') {
        policySkipped.push(p.externalId);
        return false;
      }
      return true;
    });

    const feedProducts = eligible.map((p) => ({
      externalId: p.externalId,
      title: p.title,
      description: p.description,
      targetPriceMinor: p.targetPriceMinor,
      currency: p.currency,
      inventoryQuantity: p.inventoryQuantity,
      sourcePlatform: p.sourcePlatform,
      dataConfidence: p.dataConfidence,
      dataFreshnessAt: p.dataFreshnessAt,
      // Fixture-sourced products must not be posted as live Google catalog.
      isFixtureSource: p.sourcePlatform.startsWith('fixture'),
    }));

    const result = await connector.prepareWeekendFeed(feedProducts, {
      forceShadow: options?.forceShadow,
    });
    if (policySkipped.length > 0) {
      result.errors.push(
        `policy_blocked_skipped:${policySkipped.length} (${policySkipped.slice(0, 10).join(',')})`,
      );
      result.message = `${result.message} Skipped ${policySkipped.length} policy-blocked product(s).`;
    }
    this.lastResult = result;
    this.lastRunKey = `${new Date().toISOString().slice(0, 10)}:${result.mode}`;

    await this.audit.write({
      action: 'google.weekend_feed',
      resourceType: 'connector',
      resourceId: GOOGLE_MERCHANT_PROVIDER_KEY,
      organizationId: org.id,
      actorUserId: options?.userId ?? null,
      metadata: {
        mode: result.mode,
        preparedCount: result.preparedCount,
        postedCount: result.postedCount,
        livePostSucceeded: result.livePostSucceeded,
        status: result.status,
        message: result.message,
        scheduledFor: result.scheduledFor,
        errors: result.errors,
        policySkippedCount: policySkipped.length,
        policySkippedIds: policySkipped.slice(0, 50),
        // Store compact feed summary, not credentials
        offerIds: result.items.slice(0, 50).map((i) => i.offerId),
      },
    });

    this.logger.log(
      `Google weekend feed mode=${result.mode} prepared=${result.preparedCount} policySkipped=${policySkipped.length} live=${result.livePostSucceeded}`,
    );
    return result;
  }

  private async maybeRunWeekendJob(): Promise<void> {
    try {
      if (!isWeekendLocal()) {
        return;
      }
      const now = new Date();
      // Run once in the 09:00–10:59 local window.
      if (now.getHours() < 9 || now.getHours() > 10) {
        return;
      }
      const runKey = `${now.toISOString().slice(0, 10)}:weekend-google`;
      if (this.lastRunKey === runKey) {
        return;
      }
      this.logger.log(`Weekend Google automation window hit (${runKey})`);
      await this.prepareWeekendFeed({ forceShadow: false });
      this.lastRunKey = runKey;
    } catch (error) {
      this.logger.error(
        `Weekend Google job failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private readCredentialsFromEnv(): GoogleMerchantCredentials | null {
    const accessToken = process.env.GOOGLE_MERCHANT_ACCESS_TOKEN?.trim();
    const merchantId = process.env.GOOGLE_MERCHANT_ID?.trim();
    const dataSourceId = process.env.GOOGLE_MERCHANT_DATA_SOURCE_ID?.trim();
    if (!accessToken && !merchantId) {
      return null;
    }
    return {
      accessToken,
      merchantId,
      dataSourceId,
    };
  }
}
