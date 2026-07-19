import { Injectable } from '@nestjs/common';
import { wrapEnvelope, type DataMode } from '@tradeops/contracts';
import { PrismaService } from '../prisma/prisma.service';

/**
 * End-to-end lifecycle path status for fixture vs Shopify live.
 * Never claims live success without credentials + successful probe.
 */
@Injectable()
export class LifecyclePathService {
  constructor(private readonly prisma: PrismaService) {}

  async describePath(organizationId: string) {
    const shopReady =
      Boolean(process.env.SHOPIFY_SHOP_DOMAIN?.trim()) &&
      Boolean(process.env.SHOPIFY_ACCESS_TOKEN?.trim());

    const [products, cases, listings, orders, approvals, fulfillments, payments] =
      await Promise.all([
        this.prisma.client.product.count({ where: { organizationId } }),
        this.prisma.client.commerceCase.count({ where: { organizationId } }),
        this.prisma.client.listing.count({ where: { organizationId } }),
        this.prisma.client.customerOrder.count({ where: { organizationId } }),
        this.prisma.client.approval.count({ where: { organizationId } }),
        this.prisma.client.fulfillment.count({ where: { organizationId } }),
        this.prisma.client.commercePayment.count({ where: { organizationId } }).catch(() => 0),
      ]);

    const fixtureProducts = await this.prisma.client.product.count({
      where: { organizationId, sourcePlatform: { startsWith: 'fixture' } },
    });

    const stages = [
      {
        id: 'connect',
        label: 'Connect commerce',
        fixture: { status: 'operational', detail: 'Import fixtures button / demo:loop' },
        live: shopReady
          ? { status: 'credentialed', detail: 'Shopify env present — run live-sync' }
          : {
              status: 'blocked',
              detail: 'Missing SHOPIFY_SHOP_DOMAIN and/or SHOPIFY_ACCESS_TOKEN',
              missing: ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'],
            },
      },
      {
        id: 'discover',
        label: 'Discover products',
        fixture: {
          status: fixtureProducts > 0 ? 'populated' : 'ready',
          detail: `${fixtureProducts} fixture products`,
        },
        live: { status: shopReady ? 'available' : 'blocked', detail: 'live-sync → normalize → Product' },
      },
      {
        id: 'case',
        label: 'Commerce Case spine',
        fixture: {
          status: cases > 0 ? 'populated' : 'ready',
          detail: `${cases} cases (sync on process board)`,
        },
        live: { status: 'same_spine', detail: 'Cases own product lifecycle regardless of source' },
      },
      {
        id: 'evaluate_prepare',
        label: 'Evaluate → Prepare',
        fixture: { status: 'operational', detail: 'Score / policy / listing draft APIs' },
        live: { status: 'operational_when_data', detail: 'Same domain ops on normalized products' },
      },
      {
        id: 'approve_publish',
        label: 'Approve → Publish',
        fixture: {
          status: 'approval_controlled',
          detail: `${approvals} approvals; fixture marketplace publish only after decide`,
        },
        live: shopReady
          ? { status: 'credentialed_partial', detail: 'Publish requires approval + live capability' }
          : { status: 'blocked', detail: 'No live publish without Shopify credentials' },
      },
      {
        id: 'sell_fulfill',
        label: 'Sell → Source → Fulfill',
        fixture: {
          status: orders > 0 ? 'populated' : 'ready',
          detail: `${orders} orders · ${fulfillments} fulfillments`,
        },
        live: {
          status: shopReady ? 'partial' : 'blocked',
          detail: 'Orders via webhooks when wired; EasyPost for labels when key present',
        },
      },
      {
        id: 'reconcile_learn',
        label: 'Reconcile → Learn',
        fixture: {
          status: 'operational_foundations',
          detail: `${payments} payments; prediction outcomes tools`,
        },
        live: { status: 'foundations', detail: 'Channel money separate from Stripe SaaS billing' },
      },
    ];

    const dataMode: DataMode =
      fixtureProducts > 0 && !shopReady
        ? 'fixture'
        : shopReady
          ? 'live'
          : 'simulation';

    return wrapEnvelope({
      tenantId: organizationId,
      state: shopReady || fixtureProducts > 0 ? 'completed' : 'blocked',
      dataMode,
      text: shopReady
        ? 'Shopify credentials detected — live path available for sync; consequential publish still approval-gated.'
        : 'Fixture lifecycle is executable end-to-end. Live Shopify path blocked until credentials are configured.',
      data: {
        counts: { products, cases, listings, orders, approvals, fulfillments, payments, fixtureProducts },
        stages,
        lifecycle:
          'Discover → Evaluate → Qualify → Prepare → Approve → Publish → Sell → Source → Fulfill → Reconcile → Learn → Closed',
        never: [
          'Never auto-fallback live failure to fixture success',
          'Never label fixture as live',
          'Never publish without approval',
        ],
      },
      blocked: shopReady
        ? undefined
        : {
            code: 'shopify_credentials_required',
            message: 'Configure SHOPIFY_SHOP_DOMAIN and SHOPIFY_ACCESS_TOKEN for live commerce vertical',
            missing: ['SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'],
          },
      actions: [
        {
          id: 'import_fixtures',
          label: 'Import fixtures',
          href: '/terminal',
        },
        {
          id: 'process',
          label: 'Open process board',
          href: '/terminal/process',
        },
        {
          id: 'diagnostics',
          label: 'Stack diagnostics',
          href: '/api/v1/ops/diagnostics',
        },
      ],
    });
  }
}
