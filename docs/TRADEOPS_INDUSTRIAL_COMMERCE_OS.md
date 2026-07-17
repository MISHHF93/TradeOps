# TradeOps Industrial AI Commerce Operating System

**Status:** Operational foundations (2026-07-17)  
**Principle:** One codebase for retail + industrial — industrial is a **profile + workflows + personas** layer on the same Product / Supplier / PO / Artifact / AI OS.

## What generalizes from retail

| Retail capability | Industrial generalization |
|-------------------|---------------------------|
| Product digital twin | + OEM/MPN, specs, hazmat, MOQ, lead time (`attributesJson.industrial`) |
| Artifacts / media | SDS, CAD, manuals, install guides (purpose taxonomy) |
| Opportunity scoring | Procurement evaluation + substitute ranking |
| Approvals / POs | RFQ draft → quote compare → award (approval-gated) |
| Connectors | ERP, PIM, PLM, WMS, CAD registry entries |
| Personas | Procurement, engineering, maintenance, warehouse, logistics surfaces |
| RAG + xAI | Technical requirements & catalog knowledge retrieval |

## Industrial product model

Canonical type: `IndustrialProductProfile` (`packages/commerce-engine/src/industrial-product.ts`)

Stored on `Product.attributesJson.industrial` plus existing columns (`manufacturer`, `brand`, `countryOfOrigin`, inventory, money fields).

## AI Procurement Engine

`packages/commerce-engine/src/procurement-engine.ts`

- Match technical requirements  
- Compare supplier quotes / landed cost  
- Rank substitutes  
- Draft RFQ  
- Procurement risk + recommended action (award still requires human approval)

API: `POST /api/v1/industrial/procurement/evaluate`

## Digital twin

`buildDigitalTwin` projects products, suppliers, offers, inventory, POs, orders, artifacts into a graph for AI neighborhood reasoning.

API: `GET /api/v1/industrial/twin`

## Verticals & roles

- 21 industrial verticals (auto, heavy equipment, oil & gas, medical, …)  
- 10 role surfaces mapped into core operating personas  

## Connectors (registry-ready)

SAP S/4HANA, NetSuite, Infor CSI, Salsify, Akeneo, Windchill, Autodesk APS, Manhattan WMS — **credential-gated registry**; live HTTP not claimed without adapters.

## UI

| Path | Surface |
|------|---------|
| `/terminal/industrial` | Industrial OS home |
| `/terminal/industrial/products` | Catalog / completeness |
| `/terminal/industrial/procurement` | Procurement evaluate |
| `/terminal/industrial/twin` | Digital twin graph |

## Honesty

- Not a separate industrial ERP rewrite  
- Live ERP/PIM sync requires credentials + adapters  
- RFQ award / PO submit remains approval-controlled  
- Fixture data labeled  

## Deepening (this iteration)

- Free-text technical requirement parser (`parseTechnicalRequirementsFromText`)  
- Compatibility / substitute search API  
- Demo industrial profile bootstrap for local catalogs  
- Industrial fields in RAG corpus  
- AI tools: `evaluateIndustrialProcurement`, `searchIndustrialCompatibility`  
- Persona More-nav links to Industrial OS  
- Role workspace pages `/terminal/industrial/roles/[role]`  

## Residual

- Full live SAP/NetSuite HTTP clients  
- Multi-level BOM explosion UI  
- CAD binary streaming  
- IoT telemetry streams  
