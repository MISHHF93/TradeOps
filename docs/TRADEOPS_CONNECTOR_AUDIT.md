# TradeOps Connector & Demo-Data Audit

**Phase:** Live Connector Ecosystem & Production Data Platform  
**Date:** 2026-07-16  

## Rule

No production workspace KPI may be fabricated. Values must be:

1. Live connector / webhook  
2. Canonical store (normalized)  
3. Derived model (labeled)  
4. Explicit simulation / fixture (labeled)  
5. Unavailable (honest empty state)

---

## Production-ready (wired)

| Component | Status | Notes |
|-----------|--------|-------|
| Production connector catalog (`production-connectors.ts`) | **Live registry** | 35+ providers across commerce/supplier/payments/logistics/marketing/analytics/accounting/search/tax/AI |
| Live feed registry | **Merged** | Fixtures + production providers |
| Credential resolution | **Honest** | `credentials_required` until all env keys present |
| Live HTTP adapters | **Partial** | Shopify, Stripe, FX, WooCommerce, EasyPost, SerpAPI |
| LiveConnectorService | **Wired** | ensure installs, live-sync, capability resolve |
| Webhook queue + normalizer | **Wired** | Postgres receipts, retries, DLQ |
| OpsSyncScheduler | **Wired** | Webhook drain + probe + live HTTP interval |
| Capability Registry | **Wired** | AI resolves business capabilities, not vendor REST |
| Production isolation | **Wired** | `filterForProductionWorkspace`, simulation banner |
| Data provenance inventory | **Wired** | LIVE_DATA_INVENTORY + ops endpoints |
| Ops Center health API | **Wired** | `/ops/connectors/health` + production catalog summary |

---

## Explicit fixtures / simulation (allowed when labeled)

| Component | Location | Label requirement |
|-----------|----------|-------------------|
| Fixture supplier | `@tradeops/connector-fixture-supplier` | `isFixture: true` |
| Fixture marketplace | `@tradeops/connector-fixture-marketplace` | `isFixture: true` |
| Seed DB | `packages/database/seed` | Dev/demo seed only |
| Simulation mode | `TRADEOPS_SIMULATION_MODE` | Banner: SIMULATION MODE |
| Channel fee models | commerce-engine channel-profitability | `simulationLabel` |

---

## Registry-ready, HTTP not fully implemented

These appear in the production catalog with credential probes and capability ads.  
Calling live-sync with credentials present but no adapter returns `adapter_stub` — **never fake rows**.

| Domain | Providers |
|--------|-----------|
| Commerce | Amazon SP-API, eBay Sell, BigCommerce |
| Supplier | Alibaba, AliExpress, Inventory Source |
| Payments | PayPal, Square (Stripe done) |
| Logistics | ShipStation, UPS, FedEx, DHL, USPS, Canada Post (EasyPost done) |
| Marketing | Google Ads, Meta, TikTok |
| Analytics | GA4, PostHog, Mixpanel |
| Accounting | QuickBooks Online, Xero |
| Search | Keepa (SerpAPI + Merchant registry ready) |
| Tax | Avalara, TaxJar |
| AI | OpenAI, Anthropic, Gemini, xAI, Mistral (keys for runtime routing; not commerce sync) |

---

## Historical demo / risk surfaces (mitigated or still watch)

| Surface | Risk | Mitigation |
|---------|------|------------|
| Portfolio pending payouts | Invented % of revenue | Removed — null + empty state unless payout rows exist |
| Cashflow sparklines | Random / fake | Removed from production path |
| SaaS cockpit channel cards | Static SIMULATION | Must show simulation banner |
| Seed products in founder org | Fixture products in KPIs | `dataClass.fixtureProducts` count + production filter |
| Random number generators | KPI fabrication | Ops latency is lag-based, not Math.random for production metrics |

---

## Disconnected workflows (still by design until credentials)

- Publish to live Shopify/Amazon without OAuth tokens  
- Real-time ads ROAS without ad account tokens  
- Accounting P&L without QBO/Xero OAuth  
- Carrier ETAs without EasyPost/ShipStation/carrier keys  

These show **credentials_required** in Ops Center — not green “connected” status.

---

## Success criteria progress

| Criterion | State |
|-----------|-------|
| Demo data removed from production workspaces | Isolation helpers + labeled fixtures; strict filter available |
| Every KPI live or labeled simulation | Provenance inventory + portfolio nulls |
| Every connector reports health + sync | Ops health center |
| API responses normalized | normalizeExternalPayload + Product/Event upserts |
| Workflows on real events | Event fabric + bus events |
| AI cites operational evidence | evidenceLinks (prior work) + capability resolve |
| Commerce Runtime orchestrates integrations | Runtime + Ops + LiveConnectorService |
| Full vendor HTTP coverage | **Incremental** — core path done, catalog complete |

---

## Operator quick start

```bash
# Env examples (never commit secrets)
export SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
export SHOPIFY_ACCESS_TOKEN=shpat_...
export STRIPE_SECRET_KEY=sk_live_or_test_...
export OPENEXCHANGERATES_APP_ID=...

# After API boot (authenticated)
POST /ops/connectors/ensure-registry
POST /ops/connectors/live-sync
GET  /ops/connectors/health
GET  /ops/connectors/production
```
