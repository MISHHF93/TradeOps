# Security Review (Controlled Launch)

| Control | Status |
|---------|--------|
| Password hashing | Pass (`@tradeops/auth`) |
| HttpOnly session cookies | Pass |
| Secure cookies in production | Pass |
| Access mode central switch | Pass (`TRADEOPS_ACCESS_MODE`) |
| Direct Founder Access perimeter | **Caution** — intentional single-operator identity; protect network (not public multi-user SaaS) |
| Legacy AUTH_BYPASS alone in production | Pass (off unless `founder_direct`) |
| Login/register rate limit | Pass (in-process) |
| RBAC permissions | Pass (still evaluated under founder_direct as owner) |
| Org scoping on commerce APIs | Pass |
| Public tools no private data | Pass |
| Capability honesty (no fake live) | Pass |
| Connector tokens never in browser | Pass |
| Email verification | Fail / not built |
| CSRF tokens | Partial (SameSite=Lax cookies) |
| Redis multi-instance rate limit | Not built |
| Credential vault UI | Not built |
| Legal review of privacy/terms | Required before commercial launch |

**Recommendation (founder-operated private):** keep `TRADEOPS_ACCESS_MODE=founder_direct` only on localhost / VPN / IP-restricted hosts; rotate `APP_SECRET`; never put founder_direct on an open public multi-user URL.

**Recommendation (public multi-user SaaS later):** `TRADEOPS_ACCESS_MODE=authenticated`, managed Postgres, email verify, Redis rate limits, no public crawlers on staging.

See [TRADEOPS_DIRECT_FOUNDER_ACCESS.md](./TRADEOPS_DIRECT_FOUNDER_ACCESS.md) and [TRADEOPS_SECURITY_MODEL.md](./TRADEOPS_SECURITY_MODEL.md).
