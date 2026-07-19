# Connector Readiness

Readiness for live examples is computed by `evaluateExampleReadiness` in `live-examples.ts`:

- **ready** — required capabilities on non-fixture connectors  
- **partially_ready** — fixture product store / fixture connectors only  
- **credentials_required** — missing capabilities and empty store  
- **not_implemented** — example `runnable: false`  

UI labels:

- `TEST FIXTURE — NOT LIVE DATA` for fixture providers  
- Live connector count vs fixture count shown on Live Examples page  

Credential-blocked live publish (Google Merchant) remains documented in `TRADEOPS_GOOGLE_MERCHANT.md`.
