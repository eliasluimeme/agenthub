/**
 * In-process scheduler: checks every few minutes for agents whose heartbeat is due.
 * Disable with AGENTHUB_SCHEDULER=0 (for example when using the cron route instead).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.AGENTHUB_SCHEDULER === '0') return;
  const g = globalThis as typeof globalThis & { __agenthubTimer?: NodeJS.Timeout };
  if (g.__agenthubTimer) return;
  const tick = async () => {
    try {
      const { runDueHeartbeats } = await import('@/lib/heartbeat');
      await runDueHeartbeats();
    } catch (e) {
      console.error('[scheduler] heartbeat tick failed', e);
    }
  };
  g.__agenthubTimer = setInterval(tick, 5 * 60_000);
  g.__agenthubTimer.unref?.();
}
