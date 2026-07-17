# TradeOps Live Examples

Live examples are **preconfigured objectives** executed through real services:

`LiveExamples page → POST /api/v1/ai/live-examples/:id/run → AiOperatorService → runOperatorCycle → OperatorRun`

## Catalog

| ID | Name | Risk | Runnable |
| --- | --- | --- | --- |
| `canadian-product-opportunity-scan` | Canadian Product Opportunity Scan | read_only | **Yes** |
| `supplier-comparison-listing-draft` | Supplier Comparison and Listing Draft | draft | Yes |
| `approved-listing-publication` | Approved Listing Publication | approval_required | Yes (fixture/credential) |
| `customer-order-supplier-fulfillment` | Customer Order to Supplier Fulfillment | financial | Yes (fixture path) |
| `margin-protection-workflow` | Margin Protection Workflow | approval_required | **No** (schedule not wired) |

## Example 1 — Canadian Product Opportunity Scan

**Objective (canonical):**  
Search connected supplier and marketplace sources for products worth selling in Canada; margin >25%; evidence + next actions.

**Classification:** `READ_ONLY_ANALYSIS`, `approvalRequired: false`

**UI:** `/terminal/live-examples` → Run → `/terminal/opportunities?runId=` + `/terminal/objectives/:id`

## Honesty

Readiness uses connector installations + product store.  
`partially_ready` with fixture product store is valid for founder development and is **never** labeled live marketplace data.

## Extending

Add definitions in `packages/ai-runtime/src/live-examples.ts` and ensure tools/capabilities exist before setting `runnable: true`.

## Product media on live products

After any product import or scan, open `/terminal/products/:productId` and use **Discover / bootstrap artifacts** to attach a complete authorized media set (primary, gallery, packaging, spec, manual, external-video slot). Fixture media is labeled **TEST FIXTURE — NOT LIVE DATA**. See [TRADEOPS_PRODUCT_ARTIFACT_MODEL.md](./TRADEOPS_PRODUCT_ARTIFACT_MODEL.md).
