/**
 * Export ProductArtifact rows to repo-root artifacts-corpus.csv via API.
 * Requires API running (founder_direct). Usage: node scripts/export-artifact-corpus.mjs
 */
const API = process.env.API_PUBLIC_URL || 'http://127.0.0.1:4000';

async function main() {
  const res = await fetch(`${API}/api/v1/ai/rag/export-csv`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('export failed', res.status, text.slice(0, 400));
    process.exit(1);
  }
  console.log(text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
