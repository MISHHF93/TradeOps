# Process Architecture

## Problem

Feature-first sidebar + isolated dashboards made TradeOps feel like a stack of pages around an AI panel.

## Solution

1. **CommerceCase** spine per product opportunity  
2. **Lifecycle engines** (infer, transition, next action) in commerce-engine  
3. **Process board** + **Journey** UI  
4. **Process-first nav**  
5. **Terminal** summarizes urgent process work  

## Data flow

```text
Product / Opportunity / Listing / Approval / Order / PO / Fulfillment
        ↓ syncOrganization (infer stage)
   CommerceCase
        ↓
Process board · Journey · Terminal · Next actions
```

## Next-action engine

`computeNextAction` — single primary action per case, shown on board, journey, terminal.

## Not yet complete

- Full task queue table  
- Drag-and-drop stage moves with full SOP workflows  
- AI Operator forced case context parameter (partial — use journey + AI page together)  
- Physical removal of `/terminal/pipeline` and `/terminal/control-tower` routes (nav deprioritized)  
