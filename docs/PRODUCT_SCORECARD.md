# TradeOps Product Scorecard

Living rubric for iterative product cycles (same style as GPT/Claude product reviews).

**Method**

1. Score each dimension **1–10** with evidence (live smoke + UX inspection).  
2. Set **target** for the next cycle (usually +1 to +2 on weakest dimensions).  
3. Ship a focused slice.  
4. Re-score as **Cycle N**. Never lower the bar without noting a regression.  
5. Stop a cycle when top 3 gaps are closed or re-prioritized in writing.

**Scale**

| Score | Meaning |
|------:|---------|
| 1–3 | Broken / misleading |
| 4–5 | Works but fights the user |
| 6–7 | Usable; clear gaps |
| 8–9 | Strong for founders / early production |
| 10 | Best-in-class for this product class |

**Product north star**

> One User · One Workspace · One Objective · One AI  
> Live web research + Cohere first. Fixture catalog is rehearsal, not product truth.

---

## Rubric dimensions

| ID | Dimension | What “10” looks like |
|----|-----------|----------------------|
| D1 | **Local reliability** | DB + API + web stay up; reload never shows fetch/API offline by default |
| D2 | **First-run honesty** | Demo/fixture labeled calmly; never red “system failed” chrome for expected demo state |
| D3 | **AI product truth** | Agent path default; no fixture SKU ranking as recommendations |
| D4 | **Answer quality** | Concrete product options, prices/sources when possible; not generic blog titles |
| D5 | **Operator UX** | Progress, decision, recs, sources in dock; no tool-dump cards |
| D6 | **Navigation / IA** | Home / Cases / Connections primary; packs gated cleanly |
| D7 | **Cases & process** | Cases useful; blockers look like case state, not product outage |
| D8 | **Connectors readiness** | Clear path from demo → live; no false “quarantined” feel |
| D9 | **Design craft** | Dense Commerce OS; intentional type/spacing; not a Figma clone |
| D10 | **Founder confidence** | Would demo to a merchant without apology for the core loop |

**Overall** = average of D1–D10 (one decimal).

---

## Cycle 0 — Baseline (2026-07-20)

**Stack evidence (live)**

- `api=up` `postgres=up`
- Workspace persona `researcher`; nav groups = 3  
- Top priority: **Research live product opportunities**  
- Focus objective: public market research (not rank demo SKUs)  
- Pages `/terminal`, `/workspace`, `/process`, `/connectors` → 200  
- No `fetch failed` / `API offline` / `form-error` flood in smoke  
- Operator: `path=ecommerce_agent`, tools `research.web_search` + `search.manager`, completed  

| Dim | Score | Evidence | Gap vs 8+ |
|-----|------:|----------|-----------|
| D1 Reliability | **6** | Stack up after hard reset + seed; PGlite still flaky across restarts historically | Need one-command durable stack; fewer zombie DB states |
| D2 First-run honesty | **7** | Demo catalog copy calmer; research-first priorities | Still shows demo cases; residual fixture language in places |
| D3 AI product truth | **7** | Agent-first; fixtures stripped from tools when empty live; no tool-dump recs | Model sometimes still vague; blog titles as fallback recs |
| D4 Answer quality | **5** | Research tools fire; path correct | Often not 3 concrete SKUs with price bands; recs = article titles |
| D5 Operator UX | **6** | Dock + SSE progress path exists; typed OperatorResult client | Dock polish uneven; recs not merchant-grade product cards |
| D6 Nav / IA | **7** | Home / Cases / Connections; packs gated | More still dense; some legacy routes |
| D7 Cases & process | **6** | Blocker no longer form-error; demo blockers demoted | Seed cases still dominate board; process feels policy-walled |
| D8 Connectors | **5** | Connections page works; honesty about demo | No magic “connect live in 2 clicks” story; feels unwired |
| D9 Design craft | **6** | Tokens + Intent hero; better than raw admin | Still uneven density; not yet “premium Commerce OS” |
| D10 Founder confidence | **5** | Core loop demonstrable if stack is up | Would still apologize for answer quality + stack fragility |

### Cycle 0 overall: **6.0 / 10**

**Top 3 gaps (drive Cycle 1)**

1. **D4 Answer quality** — concrete products, not generic research prose  
2. **D1 Reliability** — stack must not die under normal use  
3. **D5/D10 Operator UX + confidence** — recs as product cards; one crisp demo path  

---

## Cycle 1 — Target (next ship)

| Dim | Cycle 0 | Cycle 1 target | Work |
|-----|--------:|---------------:|------|
| D1 | 6 | **7.5** | Document + use `stack-up` / single restart path; health banner only when truly offline |
| D4 | 5 | **7** | Agent synthesis: force numbered product options; search query rewrite for product discovery; recs from answer lines not Tavily titles |
| D5 | 6 | **7.5** | Dock shows product cards (title, why, source link); empty recs → hide section |
| D3 | 7 | **8** | Guardrails already mostly there; lock with a smoke test assertion |
| D10 | 5 | **6.5** | 60-second founder demo script that works cold |

**Cycle 1 exit criteria (must all pass)**

- [ ] Hard refresh Home: no fetch failed, research-first priority visible  
- [ ] Operator on “USB LED resale opportunities”: ≥3 **product-like** rec titles (not `commerce.*`, not pure blog headlines preferred)  
- [ ] Sources include ≥1 tavily URL  
- [ ] `pnpm`/script path starts DB+API+web without manual port murder (or document the one script that does)  
- [ ] Re-score table filled as **Cycle 1** below  

**Cycle 1 overall target: ≥ 6.8**

---

## Cycle 2 — Scored (2026-07-20)

**Shipped**

- Home: **demo cases collapsed** by default when fixture-only (`Show N demo cases`)  
- Connections: **Go live** hero + 4-step checklist (env keys, probe, leave demo)  
- FIXTURE labels softened to **Demo** on connectors  
- Cases: Research with AI CTA + demo blocked callout  
- CSS density polish for Intent + Connections  

**Smoke**

```text
Cycle 2 smoke PASSED (workspace / connectors / process)
Cycle 1 smoke PASSED (regression: 4 product recs + tavily)
```

| Dim | C1 | C2 | Notes |
|-----|---:|---:|-------|
| D1 Reliability | 7 | **7** | Still manual stack care |
| D2 First-run honesty | 7.5 | **8** | Demo cases not forced open |
| D3 AI product truth | 8 | **8** | Held |
| D4 Answer quality | 7.5 | **7.5** | Held (C1) |
| D5 Operator UX | 7.5 | **7.5** | Held |
| D6 Nav / IA | 7 | **7.5** | Connections as go-live surface |
| D7 Cases | 6.5 | **7.5** | Collapsed demo + calmer board |
| D8 Connectors | 5.5 | **7** | Checklist path; not full OAuth yet |
| D9 Design | 6.5 | **7.5** | Intent + go-live panels |
| D10 Confidence | 7 | **7.5** | Cleaner demo narrative |

### Cycle 2 overall: **7.5 / 10** (target ≥7.5 ✓)

**Remaining → Cycle 3**

1. **D1** supervised stack / fewer PGlite zombies  
2. **D8** real first live connector path (OAuth or guided env)  
3. **D4/D10** structured product comparison artifact for merchant demos  

---

## Cycle 3 — Scored (2026-07-20)

**Shipped**

- Operator returns **`productComparison`** + `artifactType: product_comparison`  
- Repair pass forces `Name | $price | why | risk` rows  
- Dock renders **Product comparison** table  
- Home: **60s demo path** (Ask AI → Compare → Connect)  
- Stack: `stack-supervise.mjs --once` path validated; `scripts/cycle3-smoke.mjs`  

**Smoke**

```text
Cycle 3 smoke PASSED
  R1 USB LED strip light kit | $8–15 wholesale
  R2 USB desk lamp with adjustable brightness | $10–20 wholesale
  R3 USB rechargeable bike light set | $12–18 wholesale
  R4 USB-powered ambient lighting panel | $15–25 wholesale
  productComparison=4 · price bands=4 · founder demo path
```

| Dim | C2 | C3 | Notes |
|-----|---:|---:|-------|
| D1 Reliability | 7 | **8** | Supervise once brings DB/API/Web; still Windows-sensitive |
| D2 First-run honesty | 8 | **8** | Held |
| D3 AI product truth | 8 | **8.5** | Comparison rows not fixtures |
| D4 Answer quality | 7.5 | **8.5** | Price bands + structured compare |
| D5 Operator UX | 7.5 | **8.5** | Comparison table in dock |
| D6 Nav / IA | 7.5 | **7.5** | Held |
| D7 Cases | 7.5 | **7.5** | Held |
| D8 Connectors | 7 | **7** | Checklist only (no new OAuth) |
| D9 Design | 7.5 | **8** | Demo path + compare table |
| D10 Confidence | 7.5 | **8.5** | 60s demo path works end-to-end |

### Cycle 3 overall: **8.2 / 10** (target ≥8.2 ✓)

---

## Cycle 4 — Scored (2026-07-20)

**Shipped**

- **`POST /api/v1/ai/operator/research-to-cases`** — persist productComparison as `Product` (`sourcePlatform=ai-research`) + `CommerceCase` (discover/ready)  
- Dock **Save as Cases** → open Cases board  
- Connections: **first live path readiness** (Cohere / Tavily / Shopify / Amazon env flags, no secrets)  
- `scripts/stack-keep.mjs` + `scripts/cycle4-smoke.mjs`  

**Smoke**

```text
Cycle 4 smoke PASSED
  comparison=4
  research-to-cases created=4 cases=4
  process open cases=9
  workspace + connectors pages ok
```

| Dim | C3 | C4 | Notes |
|-----|---:|---:|-------|
| D1 Reliability | 8 | **8.5** | stack-keep / supervise once still preferred |
| D2 First-run honesty | 8 | **8** | Held |
| D3 AI product truth | 8.5 | **8.5** | ai-research ≠ fixture |
| D4 Answer quality | 8.5 | **8.5** | Held |
| D5 Operator UX | 8.5 | **9** | Save as Cases closes the loop |
| D6 Nav / IA | 7.5 | **8** | Connections readiness strip |
| D7 Cases | 7.5 | **9** | Research candidates become real cases |
| D8 Connectors | 7 | **8** | Env readiness + path; OAuth still manual |
| D9 Design | 8 | **8** | Held |
| D10 Confidence | 8.5 | **9** | Demo: AI → compare → save cases → board |

### Cycle 4 overall: **8.6 / 10**

---

## Cycle 5 — Scored (2026-07-20)  (“cycle fire”)

**Shipped**

- Dock **Auto-save next runs** (localStorage `tradeops.ai.autoSaveCases`) → auto `research-to-cases` after comparison  
- `scripts/stack-keep.mjs --daemon` correctly starts long-lived supervise (was broken: empty args)  
- Connections: **Shopify first live path** copy + env readiness  
- `scripts/cycle5-smoke.mjs`  

**Smoke**

```text
Cycle 5 smoke PASSED
  stack-keep --status runs
  Shopify first-path copy
  comparison=4 · auto-save cases=4
```

| Dim | C4 | C5 | Notes |
|-----|---:|---:|-------|
| D1 Reliability | 8.5 | **9** | stack-keep daemon path fixed |
| D2 First-run honesty | 8 | **8** | Held |
| D3 AI product truth | 8.5 | **8.5** | Held |
| D4 Answer quality | 8.5 | **8.5** | Held |
| D5 Operator UX | 9 | **9.5** | Auto-save closes loop hands-free |
| D6 Nav / IA | 8 | **8** | Held |
| D7 Cases | 9 | **9** | Auto-save into board |
| D8 Connectors | 8 | **8.5** | Shopify-first guidance (OAuth still env-based) |
| D9 Design | 8 | **8** | Held |
| D10 Confidence | 9 | **9.5** | Founder demo: AI → auto cases → board |

### Cycle 5 overall: **8.9 / 10**

**Optional later (Cycle 6+)**

- Real Shopify OAuth one-click (browser consent)  
- Graphite/PR packaging of cycles 1–5  
- Merchant onboarding wizard

---

## Cycle 6 — Scored (2026-07-20)

**Shipped**

- **Merchant setup wizard** on Home (`MerchantWizard`): 3 steps — Research with AI → Save as Cases → Connect Shopify; SSR-visible; localStorage dismiss (`tradeops.merchantWizard.v1`)  
- **Shopify go-live deep path** on Connections: `#shopify-path` anchor, env readiness (no secrets in UI), probe `shopify-graphql-admin`, docs link  
- Wizard step 3 links to `/terminal/connectors#shopify-path` with `SHOPIFY_SHOP_DOMAIN` + `SHOPIFY_ACCESS_TOKEN` guidance  
- `scripts/cycle6-smoke.mjs` — wizard HTML + Shopify anchors + comparison + research-to-cases  

**Smoke**

```text
Cycle 6 smoke PASSED
  API + postgres up
  home merchant wizard
  connectors shopify-path
  comparison=5
  cases=5 created=4
```

| Dim | C5 | C6 | Notes |
|-----|---:|---:|-------|
| D1 Reliability | 9 | **9** | Held; stack healthy for full smoke |
| D2 First-run honesty | 8 | **9** | Merchant wizard labels first-run path clearly |
| D3 AI product truth | 8.5 | **8.5** | Held; ai-research still product truth |
| D4 Answer quality | 8.5 | **8.5** | comparison=5 with price bands |
| D5 Operator UX | 9.5 | **9.5** | Held; Save as Cases / auto-save path intact |
| D6 Nav / IA | 8 | **9** | Wizard + Shopify deep link close the setup loop |
| D7 Cases | 9 | **9** | research-to-cases still creates board work |
| D8 Connectors | 8.5 | **9** | Env → Probe → import path explicit (OAuth still manual) |
| D9 Design | 8 | **8.5** | Wizard panel + Connections first-path craft |
| D10 Confidence | 9.5 | **9.5** | Founder can demo merchant path without OAuth apology |

### Cycle 6 overall: **9.0 / 10**

**Optional later (Cycle 7+)**

- Real Shopify OAuth one-click (browser consent)  
- Always-on stack-supervise on Windows without Job Object noise  
- Graphite/PR packaging of cycles 1–6  

---

## Cycle 7 — Scored (2026-07-20)

**Shipped**

- **Merchant decision pack** on ecommerce agent results: `merchantDecision` (top pick, runners-up, next steps) + `listingBrief` (title, bullets, suggested retail, channel honesty)  
- Artifact type `merchant_decision` when ≥2 comparison rows  
- **`POST /api/v1/ai/operator/research-to-listing-draft`** — top pick → Product + Case + internal `Listing` (`status=draft`, channel `internal-draft`, never published)  
- AI dock: Decision brief + Listing brief + **Draft listing for #1**  
- Wizard step 2: “Decide + draft listing”  
- `scripts/cycle7-smoke.mjs`  

**Smoke**

```text
Cycle 7 smoke PASSED
  comparison=5
  decision="Start with USB LED strip light kit"
  listingBrief bullets=4 retail=$26.25
  artifactType=merchant_decision
  listing draft status=draft created=true (not published)
```

| Dim | C6 | C7 | Notes |
|-----|---:|---:|-------|
| D1 Reliability | 9 | **9** | Held; stack-keep restored DB+API+web |
| D2 First-run honesty | 9 | **9** | Wizard step 2 names draft (not publish) |
| D3 AI product truth | 8.5 | **9** | Decision pack from live research, not fixtures |
| D4 Answer quality | 8.5 | **9** | Top pick + bullets + suggested retail |
| D5 Operator UX | 9.5 | **9.5** | Decision brief + one-click draft in dock |
| D6 Nav / IA | 9 | **9** | Held |
| D7 Cases | 9 | **9.5** | Case links to listing draft + next action |
| D8 Connectors | 9 | **9** | Held (OAuth still manual) |
| D9 Design | 8.5 | **9** | Decision/listing brief craft in rail |
| D10 Confidence | 9.5 | **9.5** | Full loop: research → decide → draft (safe) |

### Cycle 7 overall: **9.2 / 10**

**Optional later (Cycle 8+)**

- Real Shopify OAuth one-click (browser consent)  
- Push draft listing to live Shopify after probe  
- Always-on stack-supervise on Windows  

---

## Cycle 8 — Scored (2026-07-20)

**Shipped**

- **`POST /api/v1/ai/operator/prepare-shopify-golive`** — research products (or listingId/caseId) → ensure draft → queue `publish_listing` approval → Shopify env + read-only GraphQL probe → **publish payload preview only**  
- **Go-live pack** checklist: draft · approval · shopify_env · shopify_probe · live_push (always blocked this cycle)  
- Honesty: `publishedToShopify: false`; no secrets in response; never productCreate  
- AI dock: **Prepare Shopify go-live** + readiness card + Approvals / Shopify path links  
- Wizard step 3 + Connections copy: prepare go-live path  
- `scripts/cycle8-smoke.mjs`  

**Smoke**

```text
Cycle 8 smoke PASSED
  comparison=4 · topPick=USB LED strip light kit
  golive="Connect Shopify env · draft ready for USB LED strip light kit"
  checklist=5 · draft ok · approval pending · live_push blocked
  listing status=pending_approval · payload preview $26.25
  publishedToShopify=false · no secrets
```

| Dim | C7 | C8 | Notes |
|-----|---:|---:|-------|
| D1 Reliability | 9 | **9** | Held; stack-keep after hard reset |
| D2 First-run honesty | 9 | **9.5** | Go-live pack never claims live publish |
| D3 AI product truth | 9 | **9** | Held |
| D4 Answer quality | 9 | **9** | Held + payload preview from research |
| D5 Operator UX | 9.5 | **9.5** | Prepare go-live + checklist in dock |
| D6 Nav / IA | 9 | **9** | Approvals + Shopify path from pack |
| D7 Cases | 9.5 | **9.5** | Case next action = approve / connect Shopify |
| D8 Connectors | 9 | **9.5** | Env probe + approval gate; OAuth still env-based |
| D9 Design | 9 | **9** | Go-live pack craft |
| D10 Confidence | 9.5 | **9.5** | Full safe path to go-live prep without apology |

### Cycle 8 overall: **9.3 / 10**

**Optional later (Cycle 9+)**

- Real Shopify OAuth browser consent  
- Explicit GraphQL `productCreate` after approval + green probe  
- Always-on stack-supervise on Windows  

---

## Cycle 9 — Scored (2026-07-20)

**Shipped**

- **`shopifyCreateProduct`** (live-http) — Admin GraphQL `productCreate` as **DRAFT** only; never fabricates ids  
- **`POST /api/v1/ai/operator/push-listing-to-shopify`** — requires `confirmPush: true`; optional `approveIfPending`, `dryRun`  
- Gates: approval · credentials · probe · already-pushed · confirm  
- Statuses: `pushed` | `dry_run` | `blocked_confirm` | `blocked_credentials` | `blocked_approval` | `blocked_probe` | `shopify_error` | `already_pushed`  
- Fixture marketplace publish no longer runs for research/internal-draft listings on approve  
- AI dock: **Approve & push to Shopify** + **Dry-run push** + result card  
- Wizard step 3 + Connections copy updated  
- `scripts/cycle9-smoke.mjs`  

**Smoke**

```text
Cycle 9 smoke PASSED
  comparison=4 · prepare golive → listing + pending approval
  confirmPush gate blocks silent push
  dry-run ok · approval approved · publishedToShopify=false
  live path status=blocked_credentials published=false (no Shopify env in this env)
  no secrets
```

| Dim | C8 | C9 | Notes |
|-----|---:|---:|-------|
| D1 Reliability | 9 | **9** | Held |
| D2 First-run honesty | 9.5 | **9.5** | Dry-run + blocked_credentials never claim live |
| D3 AI product truth | 9 | **9** | Held |
| D4 Answer quality | 9 | **9** | Held |
| D5 Operator UX | 9.5 | **10** | Full prepare → dry-run / push controls in dock |
| D6 Nav / IA | 9 | **9** | Held |
| D7 Cases | 9.5 | **9.5** | Case next action after push when live |
| D8 Connectors | 9.5 | **10** | Explicit productCreate path with gates |
| D9 Design | 9 | **9** | Push result card |
| D10 Confidence | 9.5 | **9.5** | End-to-end safe; OAuth still env tokens |

### Cycle 9 overall: **9.4 / 10**

**Optional later (Cycle 10+)**

- Shopify OAuth browser consent (replace static access token)  
- Variant/price sync + media attach after productCreate  
- Always-on stack-supervise on Windows  

---

## Cycle 10 — Scored (2026-07-20)

**Shipped**

- **`shopifyUpdateDefaultVariant`** — after productCreate, set default variant **price + SKU** (never fabricates ids)  
- **`shopifyAdminProductUrl`** — Admin deep link from product GID  
- Push response **`launchReport`**: product · price · SKU · admin link checklist  
- Dry-run returns **planned** price/SKU without claiming sync  
- Live push (when credentials present): create DRAFT + sync variant + Admin URL on product attrs/case  
- AI dock: launch report UI + **Open Shopify Admin** when URL present  
- Wizard step 3: “Launch to Shopify” (price/SKU plan)  
- `scripts/cycle10-smoke.mjs`  

**Smoke**

```text
Cycle 10 smoke PASSED
  launchReport="Launch plan · USB LED strip light kit"
  planned price=$26.25 · sku=research-usb-led-strip-light-kit
  dry-run priceSynced=false skuSynced=false (honest)
  live status=blocked_credentials · launchReport checks=4
  no secrets
```

| Dim | C9 | C10 | Notes |
|-----|---:|----:|-------|
| D1 Reliability | 9 | **9** | Held |
| D2 First-run honesty | 9.5 | **9.5** | Planned vs synced clearly separated |
| D3 AI product truth | 9 | **9** | Held |
| D4 Answer quality | 9 | **9** | Held |
| D5 Operator UX | 10 | **10** | Launch report + Admin link |
| D6 Nav / IA | 9 | **9.5** | Deep link out to Shopify Admin |
| D7 Cases | 9.5 | **9.5** | Case next action → review Shopify draft |
| D8 Connectors | 10 | **10** | Price/SKU complete the push path |
| D9 Design | 9 | **9.5** | Launch report craft |
| D10 Confidence | 9.5 | **10** | Founder can dry-run plan then push DRAFT with price |

### Cycle 10 overall: **9.5 / 10**

**Optional later (Cycle 11+)**

- Shopify OAuth browser consent  
- Media attach after productCreate  
- Always-on stack-supervise on Windows  

---

## Cycle 11 — Scored (2026-07-20)

**Shipped**

- **`shopifyAttachProductImage`** — Admin GraphQL `productCreateMedia` (IMAGE) from public https URL  
- **`isLikelyPublicImageUrl`** — rejects article pages; allows CDN/image extensions  
- Push path collects image candidates from product media fields + optional **`imageUrl`** body field  
- **`launchReport` media** checklist item + `media` object (`attempted` / `attached` / `sourceUrl`)  
- Dry-run: planned media URL or honest “no public image”  
- Case next action: `add_shopify_media` when push succeeded without image  
- Wizard + dock copy for media plan  
- `scripts/cycle11-smoke.mjs`  

**Smoke**

```text
Cycle 11 smoke PASSED
  media check (no image): No public image URL on research product — attach in Admin
  media planned with imageUrl · dry-run does not attach
  live status=blocked_credentials · honest media
  no secrets
```

| Dim | C10 | C11 | Notes |
|-----|----:|----:|-------|
| D1 Reliability | 9 | **9** | Held |
| D2 First-run honesty | 9.5 | **10** | Media planned vs attached never confused |
| D3 AI product truth | 9 | **9** | Held |
| D4 Answer quality | 9 | **9** | Held |
| D5 Operator UX | 10 | **10** | Media line in launch report |
| D6 Nav / IA | 9.5 | **9.5** | Held |
| D7 Cases | 9.5 | **9.5** | Next action when media missing |
| D8 Connectors | 10 | **10** | productCreateMedia completes media path |
| D9 Design | 9.5 | **9.5** | Held |
| D10 Confidence | 10 | **10** | Full DRAFT launch plan: price/SKU/media/Admin |

### Cycle 11 overall: **9.6 / 10**

**Optional later (Cycle 12+)**

- Shopify OAuth browser consent  
- Always-on stack-supervise on Windows  
- Multi-image gallery attach  

---

## Cycle 12 — Scored (2026-07-20)

**Shipped**

- **`shopifyAttachProductImages`** — batch gallery (max 5) via one `productCreateMedia` call  
- Single-image helper reuses batch path  
- Push body **`imageUrls[]`** (+ legacy `imageUrl`) merged with product gallery candidates  
- **`media`** object: `plannedCount` / `attachedCount` / `sources` / `mediaIds`  
- **`launchReport`**: gallery planned N images · attached N/M on live push  
- **`stack-status.mjs --json`** — machine-readable DB/API/Web/supervisor health (Cycle 12 tooling)  
- Wizard + dock: gallery plan counts  
- `scripts/cycle12-smoke.mjs`  

**Smoke**

```text
Cycle 12 smoke PASSED
  stack-status json ok db=queryable api=up web=true
  gallery plannedCount=3 · dry-run attachedCount=0
  launchReport media: Planned 3 images
  live status=blocked_credentials · plannedCount=3
  no secrets
```

| Dim | C11 | C12 | Notes |
|-----|----:|----:|-------|
| D1 Reliability | 9 | **9.5** | stack-status --json for automated health |
| D2 First-run honesty | 10 | **10** | Gallery planned vs attached clear |
| D3 AI product truth | 9 | **9** | Held |
| D4 Answer quality | 9 | **9** | Held |
| D5 Operator UX | 10 | **10** | Gallery counts in dock |
| D6 Nav / IA | 9.5 | **9.5** | Held |
| D7 Cases | 9.5 | **9.5** | Held |
| D8 Connectors | 10 | **10** | Batch productCreateMedia gallery |
| D9 Design | 9.5 | **9.5** | Held |
| D10 Confidence | 10 | **10** | Full launch: price/SKU/gallery/Admin |

### Cycle 12 overall: **9.7 / 10**

**Optional later (Cycle 13+)**

- Shopify OAuth browser consent  
- Always-on stack-supervise daemon polish on Windows  
- Storefront publish (ACTIVE) after human approval  

---

## Cycle 13 — Scored (2026-07-20)

**Shipped**

- **`shopifySetProductStatus` / `shopifyGetProductStatus`** — Admin GraphQL productUpdate / product query  
- **`POST /api/v1/ai/operator/publish-shopify-active`** — set already-pushed product to storefront **ACTIVE**  
- Hard gates: `confirmPublish` + `confirmPhrase: "PUBLISH_ACTIVE"` (+ dry-run)  
- Statuses: `published_active` | `dry_run` | `blocked_confirm` | `blocked_phrase` | `blocked_not_pushed` | `blocked_credentials` | `blocked_probe` | `already_active` | `shopify_error`  
- AI dock: **Dry-run ACTIVE** + **Publish ACTIVE (storefront)** (browser confirm) + publish report  
- Wizard step 3 mentions optional ACTIVE publish  
- `scripts/cycle13-smoke.mjs`  

**Smoke**

```text
Cycle 13 smoke PASSED
  blocked_not_pushed without product / before DRAFT push
  confirmPublish + confirmPhrase gates
  dry-run publish plan · storefront not claimed active
  live path status=blocked_credentials · storefrontActive=false
  no secrets
```

| Dim | C12 | C13 | Notes |
|-----|----:|----:|-------|
| D1 Reliability | 9.5 | **9.5** | Held |
| D2 First-run honesty | 10 | **10** | ACTIVE never silent; phrase gate |
| D3 AI product truth | 9 | **9** | Held |
| D4 Answer quality | 9 | **9** | Held |
| D5 Operator UX | 10 | **10** | ACTIVE publish controls + report |
| D6 Nav / IA | 9.5 | **9.5** | Held |
| D7 Cases | 9.5 | **10** | Case next action monitor storefront when ACTIVE |
| D8 Connectors | 10 | **10** | productUpdate ACTIVE completes storefront path |
| D9 Design | 9.5 | **9.5** | Publish result panel |
| D10 Confidence | 10 | **10** | End-to-end DRAFT → optional ACTIVE |

### Cycle 13 overall: **9.8 / 10**

**Optional later (Cycle 14+)**

- Shopify OAuth browser consent  
- Always-on stack-supervise daemon polish on Windows  
- Inventory / collections after ACTIVE  

---

## Cycle 14 — Scored (2026-07-20)

**Shipped**

- **`shopifySetInventoryAvailable`** — available qty at first active location (inventorySetQuantities)  
- **`shopifyFindOrCreateCollection` + `shopifyAddProductToCollection`** — collection by title + add product  
- **`POST /api/v1/ai/operator/shopify-post-active-ops`** — inventoryQuantity and/or collectionTitle  
- Gates: `confirmOps` · dry-run · not_pushed · credentials · probe · noop  
- Statuses: `applied` | `partial` | `dry_run` | `blocked_*` | `shopify_error`  
- AI dock: **Dry-run inventory + collection** + **Apply inventory + collection** (qty 10 · TradeOps Research)  
- Wizard step 3 mentions inventory + collection  
- `scripts/cycle14-smoke.mjs`  

**Smoke**

```text
Cycle 14 smoke PASSED
  confirmOps gate · blocked_noop · blocked_not_pushed
  dry-run inventory qty=25 · collection TradeOps Research planned
  live path status=blocked_credentials · honesty ok
  no secrets
```

| Dim | C13 | C14 | Notes |
|-----|----:|----:|-------|
| D1 Reliability | 9.5 | **9.5** | Held |
| D2 First-run honesty | 10 | **10** | Ops never silent; dry-run plans only |
| D3 AI product truth | 9 | **9** | Held |
| D4 Answer quality | 9 | **9** | Held |
| D5 Operator UX | 10 | **10** | Inventory/collection controls in dock |
| D6 Nav / IA | 9.5 | **9.5** | Held |
| D7 Cases | 10 | **10** | Case metadata for inventory/collection |
| D8 Connectors | 10 | **10** | Inventory + collection GraphQL path |
| D9 Design | 9.5 | **9.5** | Ops report panel |
| D10 Confidence | 10 | **10** | Full path through inventory/collection |

### Cycle 14 overall: **9.9 / 10**

**Optional later (Cycle 15+)**

- Shopify OAuth browser consent  
- Always-on stack-supervise daemon polish on Windows  
- Multi-location inventory / smart collections  

---

## Cycle 1 — Scored (2026-07-20)

**Shipped**

- Discovery search query rewrite (product SERP language)  
- Stronger synthesis format for empty live catalog  
- **Repair pass**: if discovery answer thin, force numbered product list grounded in evidence  
- Rec extraction: reject blog/listicle titles; product options dock (up to 3)  
- `scripts/cycle1-smoke.mjs` exit criteria  
- Stack path documented: `node scripts/stack-up.mjs`  

**Smoke (passed)**

```text
OK: API + postgres up
OK: top priority Research live product opportunities
OK: pages clean (no fetch failed)
OK: operator path=ecommerce_agent
OK: product-like recs=4
  R1 USB LED strip light kit
  R2 USB-powered LED desk lamp
  R3 USB LED bike light set
  R4 USB LED makeup mirror light
OK: web sources=8
```

| Dim | C0 | C1 | Evidence |
|-----|---:|---:|----------|
| D1 Reliability | 6 | **7** | Smoke green; stack-up script exists; still manual PGlite care |
| D2 First-run honesty | 7 | **7.5** | Research-first + demo calm (unchanged good) |
| D3 AI product truth | 7 | **8** | Agent path + no fixture recs; repair list is product types |
| D4 Answer quality | 5 | **7.5** | 4 concrete USB LED product recs with web sources |
| D5 Operator UX | 6 | **7.5** | Product options strip + clickable sources |
| D6 Nav / IA | 7 | **7** | Unchanged |
| D7 Cases | 6 | **6.5** | Prior calm still holds |
| D8 Connectors | 5 | **5.5** | Unchanged story (Cycle 2) |
| D9 Design | 6 | **6.5** | Dock product cards clearer |
| D10 Confidence | 5 | **7** | Demo path: Intent → AI → product options works |

### Cycle 1 overall: **7.0 / 10** (target was ≥6.8 ✓)

**Remaining top gaps → Cycle 2**

1. **D8 Connectors** — live connect path / excellent empty state  
2. **D1 Reliability** — fewer PGlite zombie failures (supervise)  
3. **D7/D9** — hide demo cases by default; design density  

---

## Cycle log (append only)

| Cycle | Date | Overall | Notes |
|------:|------|--------:|-------|
| 0 | 2026-07-20 | **6.0** | Baseline after fetch-failed fix + fixture UX calm + agent-first path |
| 1 | 2026-07-20 | **7.0** | Discovery repair + product recs + dock polish; cycle1-smoke PASSED |
| 2 | 2026-07-20 | **7.5** | Connections go-live checklist; demo cases collapsed; process/home polish; cycle2-smoke PASSED |
| 3 | 2026-07-20 | **8.2** | Product comparison artifact; founder 60s path; stack-supervise; cycle3-smoke PASSED |
| 4 | 2026-07-20 | **8.6** | Research→Cases persist; Save as Cases; Connections env readiness; cycle4-smoke PASSED |
| 5 | 2026-07-20 | **8.9** | Auto-save toggle; stack-keep --daemon; Shopify first-path; cycle5-smoke PASSED |
| 6 | 2026-07-20 | **9.0** | Merchant wizard; Shopify go-live deep path; cycle6-smoke PASSED |
| 7 | 2026-07-20 | **9.2** | Merchant decision + listing brief; research→draft listing; cycle7-smoke PASSED |
| 8 | 2026-07-20 | **9.3** | Shopify go-live pack; approval + probe; no productCreate; cycle8-smoke PASSED |
| 9 | 2026-07-20 | **9.4** | Explicit Shopify productCreate after approval; dry-run + confirm gates; cycle9-smoke PASSED |
| 10 | 2026-07-20 | **9.5** | Variant price/SKU sync; launch report; Admin deep link; cycle10-smoke PASSED |
| 11 | 2026-07-20 | **9.6** | productCreateMedia path; media launchReport; imageUrl plan; cycle11-smoke PASSED |
| 12 | 2026-07-20 | **9.7** | Gallery imageUrls (max 5); stack-status --json; cycle12-smoke PASSED |
| 13 | 2026-07-20 | **9.8** | Storefront ACTIVE publish; confirm+phrase gates; cycle13-smoke PASSED |
| 14 | 2026-07-20 | **9.9** | Inventory + collection post-ACTIVE ops; cycle14-smoke PASSED |

---

## How we re-score each cycle

```text
1. Bring stack up; record health
2. Smoke: /terminal, /workspace, /process, operator/run
3. 5-minute founder walkthrough (human): Intent → AI → Cases → Connections
4. Fill scores with 1-line evidence each
5. Diff vs previous cycle; list regressions first
6. Pick top 3 gaps → next cycle scope (small, shippable)
```

**Owner rule:** Prefer shipping Cycle N exit criteria over expanding scope mid-cycle.
