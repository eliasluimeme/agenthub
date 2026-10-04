/**
 * Netlify scheduled function: runs due agent heartbeats every 15 minutes by calling the cron route.
 * Scheduled functions only run on published production deploys. Requires CRON_SECRET.
 */
export default async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.warn('[heartbeat] URL or CRON_SECRET is not set; skipping');
    return new Response('skipped', { status: 200 });
  }
  const res = await fetch(`${base}/api/cron/heartbeat`, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } });
  console.log(`[heartbeat] ${res.status} ${await res.text()}`);
  return new Response(null, { status: res.ok ? 200 : 502 });
};

export const config = { schedule: '*/15 * * * *' };
