import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    await query('SELECT 1');
    return Response.json({ ok: true, db: 'up' });
  } catch {
    return Response.json({ ok: false, db: 'down' }, { status: 503 });
  }
}
