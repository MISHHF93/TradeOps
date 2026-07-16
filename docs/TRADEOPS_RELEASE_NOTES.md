# Release Notes — 0.1.0 (controlled local / private beta)

## Added

- Public website (marketing, solutions, legal, SEO robots/sitemap)
- Merchant register/sign-in with session cookies + rate limits
- Capability honesty board `/status`
- AI operator workspace with critic/auditor
- Workflow templates engine + API
- Harmonization identity matching
- Weekend Google shadow automation
- Production audit + release documentation set

## Known limitations

- Live marketplace connectors credential-blocked  
- Email verification not built  
- Billing not built  
- Redis optional; worker degraded without it  
- Legal pages are drafts pending counsel  

## Upgrade

```bash
pnpm install
pnpm db:generate
pnpm db:migrate:deploy
pnpm build
npm start
```
