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

Implementation should load gtag only after consent and only when enabled. Internal product analytics stay separate from marketing GA4.
