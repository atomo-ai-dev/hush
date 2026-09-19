import { toggleLike } from '@/lib/board';
import { apiHandler, parseInput } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { idParam } from '@/lib/validation';

export const POST = apiHandler<{ id: string }>(async (req, { params }) => {
  const postId = parseInput(idParam, (await params).id);
  const session = await requireSession(req);
  return Response.json(await toggleLike(session, postId));
});
