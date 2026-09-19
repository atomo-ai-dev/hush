import { createFeedback } from '@/lib/feedback';
import { apiHandler, parseInput, readJson } from '@/lib/http';
import { enforceFeedbackLimit } from '@/lib/rate-limit';
import { requireSession } from '@/lib/session';
import { feedbackInput } from '@/lib/validation';

export const POST = apiHandler(async (req) => {
  const session = await requireSession(req);
  const input = parseInput(feedbackInput, await readJson(req));
  enforceFeedbackLimit(session.id);
  const { id } = await createFeedback(session, input, req.headers.get('user-agent'));
  return Response.json({ id }, { status: 201 });
});
