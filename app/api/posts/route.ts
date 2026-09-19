import { assertNoBannedWords } from '@/lib/banned-words';
import { createPost, listPosts } from '@/lib/board';
import { apiHandler, parseInput, readJson } from '@/lib/http';
import { requireSession } from '@/lib/session';
import { parsePage, postInput } from '@/lib/validation';

export const GET = apiHandler(async (req) => {
  const page = parsePage(new URL(req.url).searchParams.get('page'));
  return Response.json(await listPosts(page));
});

export const POST = apiHandler(async (req) => {
  const session = await requireSession(req);
  const input = parseInput(postInput, await readJson(req));
  assertNoBannedWords(input.title, input.body);
  const post = await createPost(session, input);
  return Response.json({ post }, { status: 201 });
});
