# CommerceCase Model

**Table:** `commerce_cases`  
**Uniqueness:** one open spine per `(organizationId, productId)`.

## Fields

| Field | Role |
|-------|------|
| currentStage | Lifecycle position |
| stageStatus | not_started / ready / in_progress / waiting / blocked / completed / failed |
| opportunityScore / confidence / expectedProfitMinor | Evaluation snapshot |
| nextActionCode / nextActionLabel | Next-action engine output |
| blockerCode / blockerMessage | First-class blockers |
| listingDraftId / publishedListingId | Prepare / Publish links |
| stageHistoryJson | Journey audit trail |
| metadataJson.facts | Last sync CaseFacts |

## Sync

`CommerceCaseService.syncOrganization` re-infers stage from live Product, Opportunity, Listing, Approval, Order, PO, Fulfillment, PredictionOutcome records so existing data participates without manual migration of each page.

## Transitions

Validated by `validateStageTransition` in `@tradeops/commerce-engine` — invalid edges rejected; missing requirements listed.
