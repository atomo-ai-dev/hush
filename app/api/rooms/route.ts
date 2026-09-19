import { assertNoBannedWords } from '@/lib/banned-words';
import { createRoom, listRooms } from '@/lib/chat';
import { apiHandler, parseInput, readJson } from '@/lib/http';
import { enforceRoomLimit } from '@/lib/rate-limit';
import { requireSession } from '@/lib/session';
import { roomInput } from '@/lib/validation';

export const GET = apiHandler(async () => {
  return Response.json({ rooms: await listRooms() });
});

export const POST = apiHandler(async (req) => {
  const session = await requireSession(req);
  const { name } = parseInput(roomInput, await readJson(req));
  assertNoBannedWords(name);
  enforceRoomLimit(session.id);
  const room = await createRoom(session, name);
  return Response.json({ room }, { status: 201 });
});
