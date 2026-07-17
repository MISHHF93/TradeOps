# TradeOps Media Security

**Status:** Operational foundations  

## Trust model

Every remote file and upload is **untrusted** until validated.

## Controls implemented

| Control | Implementation |
|---------|----------------|
| SSRF host blocklist | localhost, 127.0.0.1, metadata endpoints, `.local` / `.internal` |
| Private network block | 10/8, 172.16–31, 192.168/16, 127/8 |
| Protocol allowlist | http(s) only |
| MIME allowlist | image/*, video/*, application/pdf, text/plain, glTF |
| Sync size cap | 8MB |
| Request timeout | 12s abort |
| Unsafe SVG | Reject scriptable SVG (`isUnsafeSvgPayload`) |
| Filename sanitization | Strip path segments / traversal |
| Tenant isolation | Storage keys under `organizations/{orgId}/products/{productId}/…` |
| Content access | Authenticated proxy stream — **no public bucket URLs** |
| Rights gate | Unknown rights do not auto-become listing-eligible |

## Explicitly not done yet

- Full AV malware scanning appliance
- DNS rebinding double-resolve on connect
- Multipart resumable upload
- Archive bomb limits (zip/tar)
- Signed URL issuance (proxy today)

## Never do

- Fetch cloud metadata (`169.254.169.254`)
- Hotlink unvalidated third-party assets as merchant-owned
- Expose `.tradeops-storage` as a static web root
