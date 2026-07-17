/**
 * Full intelligence rebuild: artifact CSV + RAG train + prediction train/run.
 * Requires API running. Usage: node scripts/rebuild-intelligence.mjs
 */
const API = process.env.API_PUBLIC_URL || 'http://127.0.0.1:4000';

async function main() {
  const res = await fetch(`${API}/api/v1/ai/intelligence/rebuild`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('rebuild failed', res.status, text.slice(0, 600));
    process.exit(1);
  }
  console.log(text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
