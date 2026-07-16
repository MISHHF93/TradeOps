# Google Merchant Connector

## Boundary

`packages/connectors/google-merchant` + weekend service.

| Mode | Behavior |
|------|----------|
| No credentials | Shadow prepare only |
| Credentials present | Still no fabricated live success until Content API client wired |
| Policy blocked SKUs | Skipped fail-closed |

## Env

```env
GOOGLE_MERCHANT_ACCESS_TOKEN=
GOOGLE_MERCHANT_ID=
GOOGLE_MERCHANT_DATA_SOURCE_ID=
```

## Distinction preserved

TradeOps product / ProductInput-style feed items vs Google processed product / issues (planned dashboard).

User must approve live data source before any live submit.
