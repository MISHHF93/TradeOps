# TradeOps Marketplace Payments (Platform Connect)

## Purpose

Enable platform-style payment accounts for merchants/suppliers (fees, splits, payouts) **without** treating them as investors.

## Abstraction

| Model | Role |
|-------|------|
| `PlatformConnectedAccount` | Provider-agnostic connected account |
| `PlatformTransfer` | Fee/split transfer instruction (idempotent) |

Provider default key: `stripe_connect`. Domain models are not permanently coupled to Stripe field names beyond `provider` + `providerAccountId`.

## Gates

- `MARKETPLACE_CONNECT_ENABLED` (default **false**)
- Sandbox account records allowed when `CAPITAL_SANDBOX_ENABLED` (architecture dry-run)

## API

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/marketplace/status` | Gate honesty |
| GET | `/api/v1/marketplace/accounts` | List accounts |
| POST | `/api/v1/marketplace/accounts/onboard` | Sandbox record or live (when configured) |
| POST | `/api/v1/marketplace/transfers` | Propose only unless Connect live |

## Not included

- Selling investments
- Holding investor capital
- Shopify Payments Partner card processing for third-party stores (separate constraint)

## KYC note

Live Connect responsibility for identity verification depends on Connect account type (Standard/Express/Custom). Platform must complete Stripe Connect setup before enabling the gate.
