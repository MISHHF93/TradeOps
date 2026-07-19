# TradeOps Close-Out Audit

**Date:** 2026-07-17 (rescan — live HTTP expansion + production isolation)  
**Standard:** Finished **or** explicitly PARTIAL with next step — no silent half-work.

---

## A. Demo / mock / fake inventory

| Item | Status | Notes |
|------|--------|-------|
| Fixture supplier/marketplace packages | DONE | `isFixture: true`, labeled in UI |
| Seed DB | DONE | Dev seed only; not production live claim |
| Random production KPIs | DONE | Ops latency lag-based; no Math.random KPIs in commerce path |
| Portfolio pending payouts invented | DONE | Null + empty state without payout rows |
| Cashflow sparklines fake | DONE | Removed earlier |
| Channel fee models | DONE | Labeled simulation when modeled |
| Simulation mode | DONE | `TRADEOPS_SIMULATION_MODE` + banners |
| Production isolation helpers | DONE | `production-isolation.ts` |
| FIRST_RUN still pointing at cockpit as home | **FIXED** | Now workspace → persona home |

---

## B. Connector completeness

| Connector | Catalog | Cred probe | Live HTTP | Webhooks | Normalize | Ops health | Tests |
|-----------|---------|------------|-----------|----------|-----------|------------|-------|
| shopify-graphql-admin | Y | Y | Y | Queue | Y | Y | core+http |
| stripe-api | Y | Y | Y | Queue | Y | Y | core+http |
| open-exchange-rates | Y | Y | Y | n/a | event | Y | http |
| woocommerce-rest | Y | Y | Y | Queue | Y | Y | http |
| easypost-api | Y | Y | Y | Queue | Y | Y | http |
| serpapi | Y | Y | Y | n/a | event | Y | http |
| bigcommerce-rest | Y | Y | Y | topics | Y (products) | Y | http |
| ebay-sell | Y | Y | Y | — | Y (inventory) | Y | http |
| paypal-rest | Y | Y | Y | topics | event (balances) | Y | http |
| square-api | Y | Y | Y | topics | Y (catalog) | Y | http |
| shipstation-api | Y | Y | Y | partial | event (shipments) | Y | http |
| keepa-api | Y | Y | Y | n/a | Y (ASIN query) | Y | http |
| amazon-sp-api | Y | Y | stub | topics listed | generic | Y | catalog |
| carriers (ups/fedex/dhl/usps/canada-post) | Y | Y | stub | partial | generic | Y | catalog |
| google-ads / meta / tiktok | Y | Y | stub | — | — | Y | catalog |
| ga4 / posthog / mixpanel | Y | Y | stub | — | — | Y | catalog |
| qbo / xero | Y | Y | stub | partial | — | Y | catalog |
| avalara / taxjar | Y | Y | stub | — | — | Y | catalog |
| AI providers (openai…mistral) | Y | Y | key only | n/a | n/a | Y | catalog |
| fixture-* | Y | n/a | fixture pkg | Y | Y | Y | fixture tests |
| google-merchant | Y | Y | dedicated pkg | — | weekend | Y | merchant tests |

**DONE this pass:** 12 live HTTP adapters (was 6). Stubs remain explicit `adapter_stub` — never fake payloads.  
**PARTIAL (documented, not blocking):** Full HTTP for Amazon SP-API, carriers, ads, analytics, accounting; OAuth redirect UIs.

---

## C. Workspace / nav completeness

| Item | Status |
|------|--------|
| Six personas + procedures | DONE |
| Focus + More dynamic nav | DONE |
| Persona home intelligence surface | DONE |
| Landing → persona home (not feature dump) | **FIXED** (`/terminal/workspace` → `homeHref`) |
| Switch persona via `?switch=1` | **FIXED** |
| Cockpit → executive | DONE |
| Pipeline → process | DONE |
| ROUTE_OWNERSHIP catalog | DONE (major terminal routes) |
| Process related links lean + workspace/AI | **FIXED** |
| Capital/network out of default nav | DONE |

---

## D. AI / intelligence completeness

| Item | Status |
|------|--------|
| Execution Package builder | DONE |
| Operator run attaches package | DONE |
| Navigator resolve endpoint | DONE |
| Objectives detail renders package | DONE |
| Knowledge base delta persist/load | DONE |
| Intelligence signals from DB | DONE |
| Persona-weighted insights | DONE |
| AI focus objective prefill | DONE |
| AI never vendor REST | DONE (capability registry) |
| Command bar AI navigate | DONE |

---

## E. Quality gates (this close-out run)

| Gate | Result |
|------|--------|
| connector-core tests | 14 pass |
| connector-live-http tests | 5 pass |
| ai-runtime tests | 13 pass |
| commerce-engine tests | 55 pass |
| API build | pass |
| Web typecheck | pass |

---

## Material fixes applied in close-out

1. Founder landing → workspace resolver → persona home  
2. Workspace index redirects to `homeHref` unless `?switch=1`  
3. All “Switch persona” nav links → `?switch=1`  
4. FIRST_RUN.md updated for intelligence + persona home  
5. Process related links include Workspace + AI (lean spine)

### 2026-07-17 follow-on (keep building)

1. Live HTTP adapters expanded: BigCommerce, eBay Inventory, PayPal balances, ShipStation, Keepa ASIN, Square catalog  
2. `LIVE_HTTP_IMPLEMENTED` = 12 providers; product persist path covers catalog importers  
3. Scanner returns `{ items, isolation }` — fixtures excluded when `TRADEOPS_PRODUCTION_WORKSPACE=1`  
4. Portfolio KPI totals respect the same production isolation filter  
5. Ops live-sync only targets orgs with installs + per-provider cooldown (`TRADEOPS_LIVE_SYNC_PROVIDER_COOLDOWN_MS`)  
6. Demand forecast upgraded to transparent **baseline-ma-v2** (SMA × DOW × half-window trend) — still not neural  
7. `.env.example` documents all live connector keys + isolation/sync flags  

### 2026-07-17 critique pass

1. **Honesty fix:** Live examples no longer label non-connected installs as `CONNECTED`  
2. **Workflow depth:** `product_opportunity_discovery` ranks real Opportunity rows; `inventory_protection` elevated to shadow_only with draft pause evidence  
3. **AI tool:** `forecastDemand` (baseline-ma-v2) registered and tested  
4. **Intelligence:** fixture-majority mixed catalogs raise `ins-fixture-skew`  
5. **UI:** portfolio/cashflow isolation pills; scanner TEST FIXTURE labels  
6. **Public status board:** process path corrected; live HTTP + isolation capabilities listed  

---

## Residual backlog (honest PARTIAL)

1. Live HTTP for Amazon SP-API, carriers, ads platforms, analytics, QBO/Xero, tax  
2. Provider OAuth install UIs (env token path works)  
3. Production Prometheus/Grafana/Sentry hard wiring  
4. Neural demand models (baseline-ma-v2 is intentional interim)  
5. Email verify / password reset / Stripe charge ledger  

None of the above are silent — catalog + docs mark registry-ready vs HTTP-implemented.
