#!/usr/bin/env node
/**
 * Manually trigger weekend Google Merchant feed preparation (shadow by default).
 * Requires API running with AUTH_BYPASS or a session.
 */
const base = (process.env.API_PUBLIC_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');

async function main() {
  const forceShadow = process.argv.includes('--shadow');
  const q = forceShadow ? '?forceShadow=true' : '';
  const res = await fetch(`${base}/api/v1/automation/google/weekend/prepare${q}`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    console.error('Failed', res.status, data);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
  console.log(
    `\nmode=${data.mode} prepared=${data.preparedCount} livePostSucceeded=${data.livePostSucceeded}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
