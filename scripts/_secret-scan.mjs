import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
const skip = new Set(["node_modules","dist",".next",".git",".tradeops-storage",".stack-logs",".pnpm-store"]);
const findings = [];
function walk(d, depth=0) {
  if (depth > 5) return;
  let entries; try { entries = readdirSync(d); } catch { return; }
  for (const n of entries) {
    if (skip.has(n)) continue;
    if (n === ".env" || n.startsWith(".env.") && !n.includes("example")) continue;
    const p = join(d, n);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, depth+1);
    else if (/\.(ts|tsx|js|mjs|md|example|yml|yaml)$/i.test(n)) {
      let t; try { t = readFileSync(p, "utf8"); } catch { continue; }
      if (/NEXT_PUBLIC_[A-Z0-9_]*COHERE/.test(t)) findings.push({file:p, kind:"next_public_cohere"});
      if (/COHERE_API_KEY\s*=\s*["']?[A-Za-z0-9_\-]{16,}/.test(t) && !/example|\.md$/i.test(p)) findings.push({file:p, kind:"hardcoded_key"});
    }
  }
}
walk("apps/web/src");
walk("packages");
walk("apps/api/src");
walk("docs");
let tracked = "";
try { tracked = execSync("git ls-files .env .env.local apps/api/.env apps/web/.env", {encoding:"utf8"}); } catch {}
console.log(JSON.stringify({findingCount: findings.length, findings: findings.slice(0,20), trackedEnv: tracked.trim().split(/\n/).filter(Boolean)}, null, 2));
