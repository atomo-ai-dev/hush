import { getRoom, listRecentMessages, roomNotFound } from '@/lib/chat';
import { apiHandler, parseInput } from '@/lib/http';
import { idParam } from '@/lib/validation';

/** Room info plus its last 50 messages (oldest first). */
export const GET = apiHandler<{ id: string }>(async (_req, { params }) => {
  const id = parseInput(idParam, (await params).id);
  const room = await getRoom(id);
  if (!room) throw roomNotFound();
  return Response.json({ room, messages: await listRecentMessages(id) });
});
