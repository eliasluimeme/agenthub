import { createHash, randomBytes } from 'node:crypto';
import { get, run } from '@/lib/db';

/**
 * Test hooks for scripts/smoke.mjs: create and remove a temporary agent, and read a check result.
 * Disabled (404) unless AGENTHUB_TEST_HOOKS=1. Never enable this on a public deployment.
 */
const enabled = () => process.env.AGENTHUB_TEST_HOOKS === '1';
const notFound = () => new Response('Not found', { status: 404 });

export async function POST(_req: Request, ctx: { params: Promise<{ action: string }> }) {
  if (!enabled() || (await ctx.params).action !== 'agent') return notFound();
  const owner = await get<{ id: number }>('SELECT id FROM users ORDER BY id LIMIT 1');
  if (!owner) return Response.json({ skip: 'no users' });
  const token = `ah_smoke_${randomBytes(12).toString('hex')}`;
  const handle = `smoke-${randomBytes(3).toString('hex')}`;
  const now = Date.now();
  await run(
    'INSERT INTO agents (handle, owner_id, bio, provider, model, instructions, tier, token_hash, created_at, next_heartbeat_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    handle, owner.id, 'smoke', 'Anthropic', 'x', 'smoke test agent', 1, createHash('sha256').update(token).digest('hex'), now, now + 3_600_000,
  );
  return Response.json({ handle, token });
}

export async function GET(req: Request, ctx: { params: Promise<{ action: string }> }) {
  if (!enabled() || (await ctx.params).action !== 'check') return notFound();
  const u = new URL(req.url);
  const row = await get<{ state: string }>(
    `SELECT c.state FROM checks c JOIN pulls p ON p.id = c.pull_id JOIN repos r ON r.id = p.repo_id JOIN agents a ON a.id = r.owner_agent_id
     WHERE a.handle = ? AND r.name = ? AND p.number = ? AND c.name = ? ORDER BY c.id DESC LIMIT 1`,
    u.searchParams.get('owner'), u.searchParams.get('repo'), Number(u.searchParams.get('number')), u.searchParams.get('name'),
  );
  return Response.json(row ?? {});
}

export async function DELETE(req: Request, ctx: { params: Promise<{ action: string }> }) {
  if (!enabled() || (await ctx.params).action !== 'agent') return notFound();
  const handle = new URL(req.url).searchParams.get('handle') ?? '';
  if (!handle.startsWith('smoke-')) return new Response('Only smoke agents can be removed', { status: 400 });
  await run('DELETE FROM pulls WHERE author_agent_id = (SELECT id FROM agents WHERE handle = ?)', handle);
  await run('DELETE FROM agents WHERE handle = ?', handle);
  await run('DELETE FROM approvals WHERE pull_id IS NOT NULL AND pull_id NOT IN (SELECT id FROM pulls)');
  return new Response(null, { status: 204 });
}
