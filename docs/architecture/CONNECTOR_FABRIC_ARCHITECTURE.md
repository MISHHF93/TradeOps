# Connector Fabric Architecture

**Role:** Lead Enterprise Architect — capability-first connector redesign  
**Status:** Target architecture (ownership consistency; not feature expansion)  
**Goal:** Connectors expose **business capabilities**, not vendor APIs. Higher layers (AI Runtime, commerce services, Search Manager supplier/marketplace adapters, UI) request capabilities such as **Search Suppliers**, **Publish Listing**, **Create Shipment**, **Verify Payment**, **Update Inventory**. Vendor selection, SDKs, REST/GraphQL, and credentials stay inside the **Connector Fabric**.  
**Aligns with:** `CONNECTOR_FLOW.md`, `business-capabilities.ts`, `fabric.ts`, `SEARCH_MANAGER_ARCHITECTURE.md`, `AI_RUNTIME_ARCHITECTURE.md`, audit A6  
**Code anchors today:**  
`packages/connector-core/*`, `apps/api/src/commerce/live-connector.service.ts`, `ecosystem.service.ts`, `connector-ops.service.ts`, `@tradeops/connector-live-http`, AI `listConnectorCapabilities` / listing deps

---

## 1. Principle

| Layer | Sees | Never sees |
|-------|------|------------|
| **AI Runtime / tools** | Business capability ids + canonical inputs/outputs | `shopify-graphql-admin`, GraphQL mutations, Stripe path, EasyPost labels API, env key names |
| **Commerce domain services** | Capability invoke results as **canonical BOs** (Product, Listing, Order, Shipment, Payment) | Vendor SDK types |
| **Search Manager** | Capabilities `supplier_search`, `marketplace_discovery` → Fabric invoke | Tavily-as-connector confusion for catalog; vendor catalog URLs |
| **Connector Fabric** | Capability → provider resolution → technical operation → live/fixture adapter → normalize | Generative prompts, case stage ownership |
| **Provider adapters** | Vendor APIs, credentials, rate limits | AI tools, UI personas |

```text
Caller (AI | Commerce | Search Manager | Workflow)
        │  request: BusinessCapability + canonical input
        ▼
┌───────────────────────────────────────────────────────┐
│  CONNECTOR FABRIC  (sole external I/O boundary)         │
│  1. Authorize capability for org + loopMode + approvals │
│  2. Resolve provider (install health, fixture policy)   │
│  3. Map capability → technical operation contract       │
│  4. Invoke live-http OR fixture adapter                 │
│  5. Normalize → canonical models                        │
│  6. Persist (optional) + Event Fabric                   │
│  7. Return CapabilityResult (canonical + provenance)    │
└───────────────────────────────────────────────────────┘
        │
        ▼
 Provider adapters (Shopify, Stripe, EasyPost, fixtures, …)
```

**Rule:** If a higher layer names a `providerKey` or vendor operation string to *perform work*, that is a **leak**. Ops/admin UIs may *display* provider health; they must not be the AI execution path.

---

## 2. Current state — where details leak

### 2.1 What already exists (keep intent)

- `BusinessCapability` catalog and `CONNECTOR_TO_BUSINESS` mapping  
- `selectProvidersForCapabilities` / `LiveConnectorService.resolveCapability`  
- Fabric descriptors with `businessCapabilities`  
- Production connectors declare both business + technical caps  
- Docs: “AI reasons over business capabilities, not vendor REST”

### 2.2 Leak inventory

| ID | Location | Leak | Severity |
|----|----------|------|----------|
| **C1** | `ConnectorCapability` type (`createListing`, `searchProducts`, …) | Technical ops are the primary type surface; often treated as peer to business caps | High |
| **C2** | `CapabilityAdvertisement.technicalCapabilities` + `supportedOperations` | Board exposes technical strings to AI/UI consumers of ecosystem board | High |
| **C3** | AI tool `listConnectorCapabilities` | Returns full board including technical ops, providerKeys, feeds | High |
| **C4** | Live feed registry `capabilities: ['products','orders',…]` | Vendor-ish resource nouns, not business capabilities | Medium |
| **C5** | `syncLive({ providerKeys })` | Callers can target vendors by key | High |
| **C6** | `liveSyncProvider(providerKey, …)` | Provider-first orchestration in host | High |
| **C7** | AI `searchConnectedProducts` / Prisma | Bypasses Fabric **and** business capability `discover_products` / Search Manager | High |
| **C8** | AI `draftListing` / host create draft | Local domain write; does not go through `prepare_listing` / `publish_listing` Fabric contracts | Medium |
| **C9** | Triple registry (manifests + live feeds + production connectors) | Duplicate capability advertisements; merge logic leaks inconsistencies upward | Medium |
| **C10** | Cohere/Tavily as “connectors” with business caps | Blurs **AI/Search providers** with **commerce Fabric capabilities** | Medium |
| **C11** | UI/ops may surface GraphQL admin names as operational identity | Acceptable for ops; must not be AI tool input | Low if gated |
| **C12** | `CAPABILITY_PROVIDER_MAP` (if hardcoded preferred vendors) | Policy OK **inside Fabric**; leak if imported by AI | Medium |
| **C13** | Webhooks topics as Shopify-shaped strings on ads | Vendor webhook catalog leaking into capability board | Low–Med |
| **C14** | Payment tools call commerce payment service directly | Correct for **canonical store** inspect; live **verify** should still be capability when hitting processor | Medium |

### 2.3 Target: no leak above Fabric invoke

Higher layers may only:

1. **Discover** which *business* capabilities are available (no technical list required for AI).  
2. **Invoke** `Fabric.invoke({ capability, input, context })`.  
3. Read **canonical** results + `dataMode` + blocked reasons.

---

## 3. Ownership boundaries

| Concern | Owner | Notes |
|---------|--------|------|
| Business capability catalog + contracts | **Connector Fabric** (`connector-core`) | Versioned, source-controlled |
| Technical operations + vendor mapping | **Fabric only** | Not exported to AI tool schemas |
| Provider manifests, auth, rate limits | **Fabric / production registry** | Ops UI may read redacted health |
| Live HTTP / fixture adapters | **`connector-live-http` + fixtures** | Behind Fabric invoke |
| Normalize vendor payload → canonical BO | **Fabric normalize** | Already `normalize.ts` direction |
| Persist Product/Order/Listing | **Commerce domain** after Fabric returns canonical (or Fabric host service under commerce) | Single write path |
| Domain events | **Event Fabric** via host after successful capability | e.g. `ListingPublished` |
| Search of *catalogs* | **Search Manager** → Fabric capabilities `search_suppliers` / `marketplace_discovery` | Not AI→vendor |
| Generative AI | **AI Runtime** | Never holds vendor clients for commerce I/O |
| Public web research | **Search Manager** (not commerce Fabric publish path) | Tavily is search provider, not `publish_listing` |
| Cohere | **AI Runtime provider abstraction** | Remove as commerce connector for execution (catalog noise) |

---

## 4. Business capability catalog (contracts)

Canonical **ids** use stable snake_case (code). **Labels** match operator language.

### 4.1 Core commerce capabilities (user-facing set + existing)

| Id | Label | Purpose | Risk | Approval default |
|----|-------|---------|------|------------------|
| `search_suppliers` | **Search Suppliers** | Find supplier offers/products from authorized supplier connectors | read_only | no |
| `discover_products` | Discover Products | Import/search products into digital twin (supplier or storefront pull) | read_only | no |
| `compare_suppliers` | Compare Suppliers | Rank offers for a product/case | read_only | no |
| `marketplace_discovery` | Marketplace Discovery | Discover channel catalog / competitive listings | read_only | no |
| `prepare_listing` | Prepare Listing | Create/update **draft** listing on channel or local draft bind | draft | no* |
| `publish_listing` | **Publish Listing** | Create/update **live** external listing | financial_contractual | **yes** |
| `update_inventory` | **Update Inventory** | Push inventory levels to channel | reversible_operational | policy |
| `read_orders` | Read Orders | Pull orders from channel | read_only | no |
| `create_shipment` | **Create Shipment** | Create shipment/label with carrier partner | reversible_operational | policy |
| `monitor_fulfillment` | Monitor Fulfillment | Tracking / fulfillment status | read_only | no |
| `verify_payment` | **Verify Payment** | Confirm payment/payout state with processor or channel | read_only | no |
| `reconcile_payments` | Reconcile Payments | Match expected vs actual settlement | read_only / draft ledger | no |
| `submit_supplier_purchase` | Submit Supplier Purchase | Place supplier PO | financial_contractual | **yes** |
| `synchronize_inventory` | Synchronize Inventory | Bidirectional or pull inventory snapshot | read_only / write | policy |
| `calculate_landed_cost` | Calculate Landed Cost | Rates/fees inputs from connectors when available | read_only | no |
| `attach_media` | Attach Media | Upload/attach media to listing | draft | no |
| `receive_webhooks` | Receive Webhooks | Subscription health (ops; not AI-primary invoke) | read_only | no |
| `detect_exceptions` | Detect Exceptions | Exception signals from logistics/observability | read_only | no |
| `estimate_demand` | Estimate Demand | Analytics signals when connector authorized | read_only | no |
| `generate_executive_insights` | Generate Executive Insights | Aggregated metrics connectors | read_only | no |

\* Local draft without channel write may be pure commerce domain; channel draft uses Fabric `prepare_listing`.

**Rename/alias note:** Existing ids `publish_listing`, `monitor_fulfillment`, etc. remain. Add first-class:

- `search_suppliers` (preferred over overloading `compare_suppliers` + `discover_products`)  
- `create_shipment` (split from generic `monitor_fulfillment`)  
- `verify_payment` (split from `read_payments` / `reconcile_payments`)  
- `update_inventory` (explicit write vs `synchronize_inventory` pull)

Keep aliases in catalog for one migration window if needed.

### 4.2 Capability contract shape

Every business capability has a **versioned contract**:

```ts
type CapabilityContract = {
  id: BusinessCapability;
  version: string;
  label: string;
  description: string;
  lifecycleStages: CommerceStage[];
  risk: {
    actionClass: 'read_only' | 'draft' | 'reversible_operational' | 'financial_contractual' | 'prohibited';
    approvalRequired: boolean;
  };
  inputSchema: JsonSchemaLite;   // canonical fields only
  outputSchema: JsonSchemaLite;  // canonical BOs / summaries only
  /** Technical ops allowed to implement this capability — FABRIC PRIVATE */
  implementsVia: TechnicalOperation[];  // not exported to AI
  idempotent: boolean;
  produces?: Array<'product' | 'listing' | 'order' | 'shipment' | 'payment' | 'offer' | 'inventory_level'>;
};
```

#### Example contracts (normative)

**Search Suppliers** (`search_suppliers`)

```text
Input:  { query: string, filters?: { maxCostMinor?, maxDeliveryDays?, category? }, limit?: number, caseId?: string }
Output: { offers: CanonicalSupplierOffer[], hits: SearchHit-compatible[], dataMode, blocked? }
ImplementsVia (private): searchProducts, readSupplier, readInventory (supplier family)
```

**Publish Listing** (`publish_listing`)

```text
Input:  { listingId: string, productId: string, channelHint?: string, dryRun?: boolean }
Output: { listing: CanonicalListing, externalId?: string, dataMode, requiresApproval? }
Risk: financial_contractual, approvalRequired: true
ImplementsVia: createListing, updateListing (marketplace/storefront)
```

**Create Shipment** (`create_shipment`)

```text
Input:  { orderId: string, fromAddressId?, toAddress?, parcels: [...], serviceHint? }
Output: { shipment: CanonicalShipment, trackingNumber?, labelUrl?, dataMode }
ImplementsVia: submitFulfillment, quoteShipping, labels (shipping family)
```

**Verify Payment** (`verify_payment`)

```text
Input:  { paymentId?: string, orderId?: string, externalPaymentId?: string }
Output: { payment: CanonicalPayment, status, verified: boolean, dataMode }
ImplementsVia: readPayments (payment/channel family)
```

**Update Inventory** (`update_inventory`)

```text
Input:  { productId | sku, quantity: number, locationHint?, listingId? }
Output: { inventoryLevel: CanonicalInventoryLevel, dataMode }
ImplementsVia: readInventory + write inventory ops when declared
```

---

## 5. Fabric invoke API (single entry)

```ts
type FabricInvokeRequest = {
  organizationId: string;
  capability: BusinessCapability;
  input: Record<string, unknown>;
  context?: {
    userId?: string | null;
    caseId?: string;
    loopMode?: OperationLoopMode;
    correlationId?: string;
    traceId?: string;
    /** Host sets after approval service — never AI-forged */
    approvalId?: string;
  };
  /** Explicit fixture force for tests only */
  forceFixture?: boolean;
};

type FabricInvokeResult = {
  capability: BusinessCapability;
  ok: boolean;
  dataMode: 'live' | 'fixture' | 'simulation' | 'shadow' | 'blocked';
  /** Canonical payload — no vendor SDK shapes */
  data: unknown;
  /** Which provider fulfilled — OK for audit logs; strip from AI tool default view if needed */
  fulfilledBy?: { providerKey: string; isFixture: boolean };
  blocked?: { code: string; message: string; missing?: string[] };
  error?: { code: string; message: string };
  provenance: {
    collectedAt: string;
    confidence?: number;
    operation?: string; // technical op id internal
  };
};
```

### 5.1 Invoke algorithm

```text
1. Load CapabilityContract(capability)
2. Validate input against inputSchema
3. Check loopMode allows risk class; check permissions
4. If approvalRequired && !approvalId → return blocked | awaiting_approval artifact path
5. Resolve provider:
     - org installations + health
     - capability advertised
     - prefer live if credentials + LIVE_HTTP; else fixture if loopMode allows
     - NEVER silent live→fixture on live failure (honesty: failed/blocked)
6. Map to technical operation(s)
7. Adapter.invoke(op, normalizedInput)
8. normalize(vendorPayload) → canonical
9. Optional persist via commerce ports
10. Event Fabric domain event
11. Return FabricInvokeResult
```

### 5.2 What is private to Fabric

- `providerKey` selection scoring  
- `LIVE_HTTP_IMPLEMENTED`  
- Credential env key names  
- GraphQL documents / REST paths  
- `technicalCapabilities` arrays  
- Webhook topic vendor strings  

Ops endpoints may expose redacted diagnostics; AI default tool responses return **capability outcome + canonical data + dataMode**, not adapter internals.

---

## 6. AI Runtime integration

### 6.1 Port

```ts
// AI Runtime ports
interface FabricPort {
  /** Available business capabilities for org (labels + risk only) */
  listCapabilities(orgId: string): Promise<CapabilitySummary[]>;
  /** Rank providers is INTERNAL — optional debug, not for model planning */
  invoke(req: FabricInvokeRequest): Promise<FabricInvokeResult>;
}
```

### 6.2 Tools → capabilities (not vendors)

| AI tool (conceptual) | Invokes capability | Must not |
|----------------------|--------------------|----------|
| `searchSuppliers` | `search_suppliers` | Call Shopify GraphQL |
| `discoverProducts` | `discover_products` | Prisma-as-search only without Manager (prefer Search Manager for store) |
| `prepareListing` | `prepare_listing` | Hardcode channel |
| `publishListing` | `publish_listing` | Skip approval |
| `updateInventory` | `update_inventory` | Vendor inventory API |
| `createShipment` | `create_shipment` | EasyPost-specific fields in tool schema |
| `verifyPayment` | `verify_payment` | Stripe SDK in runtime |
| `listBusinessCapabilities` | Fabric list | Return technical ops |

**Replace / reshape today:**

| Today | Target |
|-------|--------|
| `listConnectorCapabilities` + full board | `listBusinessCapabilities` → summaries only |
| `selectConnectorsForCapabilities` in AI deps | **Remove from AI** — Fabric resolve inside invoke |
| `searchConnectedProducts` Prisma | Search Manager `internal_retrieval` and/or Fabric `discover_products` |
| `draftListing` host-only | Domain draft **or** Fabric `prepare_listing` with clear dataMode |
| Direct `syncLive(providerKeys)` from AI | `invoke({ capability: discover_products \| synchronize_inventory })` |

### 6.3 Relationship to Search Manager

| Retrieval need | Owner |
|----------------|--------|
| Internal canonical products/cases | Search Manager `internal_retrieval` |
| Public web | Search Manager `public_search` |
| Supplier catalogs live | Search Manager `supplier_search` → **Fabric `search_suppliers`** |
| Marketplace discovery | Search Manager `marketplace_discovery` → **Fabric `marketplace_discovery`** |

AI Runtime does not choose between “call Fabric” vs “call Tavily” for catalog — it asks Search Manager or FabricPort by **capability**, per architecture docs.

---

## 7. Technical layer (Fabric private)

Keep `ConnectorCapability` / technical operations as **implementation vocabulary**:

```text
BusinessCapability  ──implementsVia──►  TechnicalOperation[]
TechnicalOperation  ──boundTo──►  ProviderAdapter.method
```

Example private map:

| Business capability | Technical ops | Example providers |
|---------------------|---------------|-------------------|
| `search_suppliers` | `searchProducts`, `readSupplier` | fixture-supplier, future Alibaba… |
| `publish_listing` | `createListing`, `updateListing` | shopify-graphql-admin, fixture-marketplace |
| `create_shipment` | `submitFulfillment`, shipping label ops | easypost-api |
| `verify_payment` | `readPayments` | stripe-api, channel payment read |
| `update_inventory` | inventory write/read | shopify-graphql-admin |

`CONNECTOR_TO_BUSINESS` becomes the reverse index for **advertisement** only; invoke uses **forward** `implementsVia` on contracts.

---

## 8. Registry consolidation

Today: manifests + live feeds + production connectors + ecosystem merge.

**Target:**

| Registry | Role |
|----------|------|
| **Capability contract registry** | Business capabilities + schemas |
| **Provider manifest registry** | One record per providerKey: family, auth, technical ops, fixture flag, maps to business caps |
| **Org installation store** | Prisma `ConnectorInstallation` status/health |

Deprecate parallel “live feed string capabilities” as a second truth — feeds become manifests or are generated from production descriptors.

**Exclude from commerce Fabric execution catalog:**

- Cohere (AI Runtime)  
- Tavily (Search Manager public adapter)  
- Pure observability (Sentry/OTEL) unless `detect_exceptions` is explicitly fabric-mediated for ops agents  

They may remain in an **integrations catalog** for ops, not as AI commerce capability advertisements.

---

## 9. Fixture vs live (unchanged honesty, clearer boundary)

| Policy | Behavior |
|--------|----------|
| Same contract | Fixture adapters implement same capability contracts |
| Selection | Loop mode + install; never auto-fallback live failure → fixture |
| Labeling | `dataMode: fixture \| live` on every result |
| AI | Must surface fixture honesty in envelope (Response Contracts) |

---

## 10. Events after capability success

| Capability (examples) | Domain events |
|----------------------|---------------|
| `discover_products` / `search_suppliers` (persist) | `ProductDiscovered` (+ case ensure) |
| `prepare_listing` | `ListingPrepared` |
| `publish_listing` | `ListingPublished` |
| `create_shipment` | `ShipmentCreated` / `ShipmentUpdated` |
| `verify_payment` / reconcile | `PaymentVerified` / `ReconciliationCompleted` |
| `update_inventory` | inventory domain event if defined; else ops sync event |
| Any failure | `ToolExecutionFailed` or `ConnectorHealthChanged` / SyncFailed |

Always include `caseId` when resolvable (case-first orchestration).

---

## 11. Interaction review (by caller)

| Caller interaction today | Vendor leak? | Target |
|--------------------------|--------------|--------|
| Ecosystem capability board → AI | Yes (technical + providerKey) | Business summary board only for AI |
| LiveConnectorService.syncLive | Yes (providerKeys) | Capability invoke batch: `discover_products` / sync |
| live-http `liveSyncProvider(key)` | Internal OK | Only Fabric may call |
| Listing publish in commerce services | Often channel-specific | `publish_listing` invoke |
| Order pull | Provider-specific sync | `read_orders` invoke |
| EasyPost labels | Vendor service | `create_shipment` |
| Stripe billing vs commerce pay | Mixed SaaS vs shop | SaaS billing ≠ Fabric commerce; shop pay → `verify_payment` |
| AI research Tavily | In runtime | Search Manager (not Fabric publish) |
| Connector ops UI | Displays vendors | Allowed for humans; not AI tools |

---

## 12. Layer diagram (full COS)

```text
AI Runtime
  tools → FabricPort.invoke(capability) | SearchPort.search(capability)
                │                              │
                ▼                              ▼
         Connector Fabric              Search Manager
                │                         │
                │              supplier/marketplace ──► Fabric
                │              public ──► Tavily adapter
                │              internal ──► Prisma
                ▼
         Provider adapters → normalize → Commerce BOs → Case facts
```

---

## 13. Normalization sequence

1. **Freeze** AI-facing API: only business capability ids in tool schemas.  
2. **Add** contracts for `search_suppliers`, `create_shipment`, `verify_payment`, `update_inventory` (and aliases).  
3. **Implement** `Fabric.invoke` in API (`ConnectorFabricService`) wrapping resolve + live-http + normalize.  
4. **Strip** technicalCapabilities from AI board responses; keep on ops routes.  
5. **Retarget** AI tools to FabricPort / SearchPort; remove `selectConnectors` from AI deps.  
6. **Replace** `syncLive(providerKeys)` public AI use with capability invokes.  
7. **Split** integrations catalog (AI/search/observability) from commerce Fabric advertisements.  
8. **Unify** registries (single provider manifest source).  
9. **Tests:** AI package has no imports of `LIVE_HTTP_IMPLEMENTED`, vendor keys, or live-http.  
10. **Docs:** Update `CONNECTOR_FLOW.md` to point at this file as normative.

---

## 14. Guardrails

| Guard | Enforcement |
|-------|-------------|
| AI tools cannot take `providerKey` as required input for commerce actions | Schema + review |
| No `@tradeops/connector-live-http` import from `ai-runtime` | Package boundary |
| Capability invoke is only write path to vendor APIs | Fabric service gate |
| Approval required flags honored before live publish/PO | Contract + host |
| Fixture never claimed as live | dataMode on result |

---

## 15. Closing judgment

TradeOps already **names** business capabilities but still **executes and advertises** along vendor and technical axes. Normalization means:

1. **Capability contracts** are the public API of the Connector Fabric.  
2. **Fabric.invoke** is the only execution entry for external commerce I/O.  
3. **AI Runtime requests** Search Suppliers, Publish Listing, Create Shipment, Verify Payment, Update Inventory — never Shopify/Stripe/EasyPost operations.  
4. **Technical ops, provider keys, and SDKs** remain Fabric-private implementation details.  
5. **Search Manager** consumes Fabric for supplier/marketplace retrieval; it does not re-open vendor APIs to AI.

This is architectural consistency with the COS vision and audit A6 — not a new connector product surface.
