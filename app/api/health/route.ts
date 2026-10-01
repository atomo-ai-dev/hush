import { query } from '@/lib/db';
import { isDemoMode } from '@/lib/demo';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  if (isDemoMode()) return Response.json({ ok: true, db: 'demo' });
  try {
    await query('SELECT 1');
    return Response.json({ ok: true, db: 'up' });
  } catch {
    return Response.json({ ok: false, db: 'down' }, { status: 503 });
  }
}
