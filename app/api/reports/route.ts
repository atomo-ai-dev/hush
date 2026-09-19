import { apiHandler, parseInput, readJson } from '@/lib/http';
import { reportContent } from '@/lib/reports';
import { requireSession } from '@/lib/session';
import { reportInput } from '@/lib/validation';

export const POST = apiHandler(async (req) => {
  const session = await requireSession(req);
  const input = parseInput(reportInput, await readJson(req));
  const result = await reportContent(session, input.targetType, input.targetId, input.reason);
  return Response.json(result, { status: result.created ? 201 : 200 });
});
