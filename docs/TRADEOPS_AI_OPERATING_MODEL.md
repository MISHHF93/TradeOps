# AI Operating Model

## Role

The AI is the **operational manager** of TradeOps:

* discover opportunities  
* evaluate suppliers and margins  
* identify risks  
* prepare listings  
* explain recommendations  
* propose workflows  
* monitor exceptions  
* learn from outcomes  

## Human approval required for

* publication to live channels  
* supplier purchasing  
* refunds / financial commitments  
* pricing changes that are consequential  
* plan changes for other organizations  

## How the AI plans

1. Read Commerce Case stage + blockers  
2. Request **business capabilities** needed  
3. Select connectors via capability advertisements (health, fixture vs live, permissions)  
4. Invoke **typed tools** only  
5. Critic / auditor gates  
6. Persist OperatorRun + recommendations  
7. Never invent live API success  

## Loop modes

`fixture` → `development` → `shadow` → `controlled_live` → `automated_live`

## Memory

Short-term: case context, tool traces.  
Long-term (expanding): prediction outcomes, supplier reliability, case history, preference signals.

## Non-goals

* Unfiltered marketplace payload reasoning  
* Autonomous fund movement  
* Guaranteed return language  
