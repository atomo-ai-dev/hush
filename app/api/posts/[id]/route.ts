import { getPost, listComments } from '@/lib/board';
import { apiHandler, parseInput } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { idParam } from '@/lib/validation';

export const GET = apiHandler<{ id: string }>(async (req, { params }) => {
  const id = parseInput(idParam, (await params).id);
  const session = await requireSession(req);
  const [post, comments] = await Promise.all([getPost(id, session.id), listComments(id)]);
  return Response.json({ post, comments });
});
