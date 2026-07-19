# TradeOps Close-Out Audit

**Date:** 2026-07-16  
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
| amazon-sp-api | Y | Y | stub | topics listed | generic | Y | catalog |
| ebay-sell | Y | Y | stub | — | generic | Y | catalog |
| bigcommerce-rest | Y | Y | stub | topics | generic | Y | catalog |
| paypal / square | Y | Y | stub | topics | generic | Y | catalog |
| shipstation + carriers | Y | Y | stub | partial | generic | Y | catalog |
| google-ads / meta / tiktok | Y | Y | stub | — | — | Y | catalog |
| ga4 / posthog / mixpanel | Y | Y | stub | — | — | Y | catalog |
| qbo / xero | Y | Y | stub | partial | — | Y | catalog |
| keepa / avalara / taxjar | Y | Y | stub | — | — | Y | catalog |
| AI providers (openai…mistral) | Y | Y | key only | n/a | n/a | Y | catalog |
| fixture-* | Y | n/a | fixture pkg | Y | Y | Y | fixture tests |
| google-merchant | Y | Y | dedicated pkg | — | weekend | Y | merchant tests |

**PARTIAL (documented, not blocking):** Full HTTP for remaining catalog vendors; OAuth redirect UIs.

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
| connector-live-http tests | 3 pass |
| ai-runtime tests | 13 pass |
| commerce-engine tests | 54 pass |
| API build | (verify after fixes) |
| Web typecheck | (verify after fixes) |

---

## Material fixes applied in close-out

1. Founder landing → workspace resolver → persona home  
2. Workspace index redirects to `homeHref` unless `?switch=1`  
3. All “Switch persona” nav links → `?switch=1`  
4. FIRST_RUN.md updated for intelligence + persona home  
5. Process related links include Workspace + AI (lean spine)

---

## Residual backlog (honest PARTIAL)

1. Live HTTP adapters for Amazon, eBay, BigCommerce, PayPal, carriers, ads, analytics, accounting  
2. Provider OAuth install UIs (env token path works)  
3. Production Prometheus/Grafana/Sentry hard wiring  
4. Optional: auto-run live-sync only for orgs with installs + rate limit per provider  
5. Optional: deeper product-list production isolation filter on scanner default query  

None of the above are silent — catalog + docs mark registry-ready vs HTTP-implemented.
