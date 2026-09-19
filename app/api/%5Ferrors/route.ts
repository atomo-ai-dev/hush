import { z } from 'zod';
import { isInternalRequest, listRecentErrors, recordError } from '@/lib/error-log';
import { ApiError, apiHandler, parseInput, readJson } from '@/lib/http';

/**
 * Internal error-log writer at /api/_errors (the folder is URL-encoded because
 * a leading underscore marks a private folder in the App Router).
 * Requires the x-hush-internal-token header to match HUSH_INTERNAL_TOKEN.
 */
const errorInput = z.object({
  source: z.string().trim().min(1).max(50),
  message: z.string().trim().min(1).max(2000),
  method: z.string().max(10).nullish(),
  path: z.string().max(500).nullish(),
  stack: z.string().max(8000).nullish(),
  context: z.record(z.string(), z.unknown()).nullish(),
});

function assertInternal(req: Request): void {
  if (!isInternalRequest(req)) throw new ApiError(403, 'FORBIDDEN', '접근 권한이 없습니다.');
}

export const POST = apiHandler(async (req) => {
  assertInternal(req);
  const input = parseInput(errorInput, await readJson(req));
  const id = await recordError(input);
  if (id === null) throw new ApiError(503, 'LOG_UNAVAILABLE', '에러 로그를 저장하지 못했습니다.');
  return Response.json({ id }, { status: 201 });
});

export const GET = apiHandler(async (req) => {
  assertInternal(req);
  return Response.json({ errors: await listRecentErrors() });
});
