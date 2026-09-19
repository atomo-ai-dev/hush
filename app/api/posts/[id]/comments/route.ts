import { assertNoBannedWords } from '@/lib/banned-words';
import { createComment } from '@/lib/board';
import { apiHandler, parseInput, readJson } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { commentInput, idParam } from '@/lib/validation';

export const POST = apiHandler<{ id: string }>(async (req, { params }) => {
  const postId = parseInput(idParam, (await params).id);
  const session = await requireSession(req);
  const input = parseInput(commentInput, await readJson(req));
  assertNoBannedWords(input.body);
  const comment = await createComment(session, postId, input);
  return Response.json({ comment }, { status: 201 });
});
