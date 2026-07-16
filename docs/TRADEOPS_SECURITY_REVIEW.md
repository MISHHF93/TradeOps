# Security Review (Controlled Launch)

| Control | Status |
|---------|--------|
| Password hashing | Pass (`@tradeops/auth`) |
| HttpOnly session cookies | Pass |
| Secure cookies in production | Pass |
| AUTH_BYPASS forced off in production | Pass |
| Login/register rate limit | Pass (in-process) |
| RBAC permissions | Pass |
| Org scoping on commerce APIs | Pass |
| Public tools no private data | Pass |
| Capability honesty (no fake live) | Pass |
| Email verification | Fail / not built |
| CSRF tokens | Partial (SameSite=Lax cookies) |
| Redis multi-instance rate limit | Not built |
| Credential vault UI | Not built |
| Legal review of privacy/terms | Required before commercial launch |

**Recommendation:** private beta with AUTH_BYPASS=false, managed Postgres, rotated APP_SECRET, no public crawlers on staging.
