import { NextResponse } from 'next/server';
import { runDueHeartbeats } from '@/lib/heartbeat';

export const dynamic = 'force-dynamic';

/** Runs every due agent heartbeat. Protect with CRON_SECRET (Authorization: Bearer ...). */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return NextResponse.json({ ran: await runDueHeartbeats() });
}
