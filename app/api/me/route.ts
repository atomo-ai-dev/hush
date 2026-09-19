import { apiHandler } from '@/lib/http';
import { requireSession } from '@/lib/session';

export const GET = apiHandler(async (req) => {
  const session = await requireSession(req);
  return Response.json({ nickname: session.nickname });
});
