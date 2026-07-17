# Normalization Architecture

## Goal

Map Shopify, Amazon, eBay, Alibaba, logistics, payments, and marketing payloads into shared internal models while preserving raw evidence.

## Canonical models

* Product  
* Supplier / SupplierOffer  
* Listing  
* Inventory (product quantity + offers)  
* CustomerOrder / lines  
* CommercePayment / Refund / Payout  
* Shipment (Fulfillment)  
* Workflow / OperatorRun  
* CommerceCase  

## Pipeline

```text
External API / webhook
→ signature verify + raw store (ExternalPayload / WebhookReceipt)
→ normalize mapper (per provider adapter)
→ identity resolution (IdentityLink / identifiers)
→ upsert canonical rows (organization scoped)
→ update CommerceCase stage inference
→ audit + optional AI notify
```

## Rules

* Idempotent upserts on external IDs  
* Never delete raw payloads on normalize failure  
* Fail closed on policy-blocked categories  
* Fixtures always labeled `isFixture` / sourcePlatform  

## Status

* Fixture supplier/marketplace path: operational  
* Productized multi-provider normalizer package: roadmap  
* Stripe SaaS webhooks: operational  
* Channel webhooks: architecture + receipts; per-provider processors pending  
