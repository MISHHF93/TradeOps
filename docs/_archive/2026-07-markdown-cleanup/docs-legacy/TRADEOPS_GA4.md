# Google Analytics 4

## Policy

Optional. Env-gated. Never send:

- credentials · customer PII · shipping addresses · raw orders · payment data · private AI prompts with personal data

## Suggested public events

`view_homepage` · `view_pricing` · `start_registration` · `complete_registration` · `generate_opportunity_score` (public tools only)

## Configuration

```env
NEXT_PUBLIC_GA4_MEASUREMENT_ID=
NEXT_PUBLIC_GA4_ENABLED=false
```

## Implementation status

| Item | Status |
|------|--------|
| `Ga4Analytics` component | **DONE** — `apps/web/src/components/ga4.tsx` mounted in root layout |
| Loads only when enabled + measurement ID set | **DONE** |
| Default off | **DONE** |
| Consent UI / CMP | **NOT BUILT** (operator should enable only after their own consent stack) |
| Private terminal events | **OUT OF SCOPE** for marketing GA4 |

Internal product analytics stay separate from marketing GA4.
