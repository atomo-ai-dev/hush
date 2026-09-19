import { ZodError, type z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return Response.json({ error: { code, message } }, { status, headers });
}

export const MAX_JSON_BODY_BYTES = 32 * 1024;

/** Reads and parses a JSON body, rejecting oversize or malformed payloads. */
export async function readJson(req: Request): Promise<unknown> {
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_JSON_BODY_BYTES) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', '요청 본문이 너무 큽니다.');
  }
  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_JSON_BODY_BYTES) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', '요청 본문이 너무 큽니다.');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'INVALID_JSON', '요청 형식이 올바르지 않습니다.');
  }
}

/** Validates `input` against `schema`, turning failures into a 400 ApiError. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

function validationError(error: ZodError): ApiError {
  const message = error.issues[0]?.message ?? '입력값이 올바르지 않습니다.';
  return new ApiError(400, 'VALIDATION_FAILED', message);
}

export type RouteContext<P extends Record<string, string> = Record<string, string>> = {
  params: Promise<P>;
};

type Handler<P extends Record<string, string>> = (
  req: Request,
  ctx: RouteContext<P>,
) => Promise<Response>;

export type UnhandledErrorReporter = (err: unknown, req: Request) => Promise<void> | void;

let reportUnhandled: UnhandledErrorReporter = (err) => {
  console.error('[api] unhandled error', err);
};

export function setUnhandledErrorReporter(reporter: UnhandledErrorReporter): void {
  reportUnhandled = reporter;
}

/**
 * Wraps a route handler: known errors become JSON error responses, anything
 * else is reported and turned into a generic 500 without leaking details.
 */
export function apiHandler<P extends Record<string, string> = Record<string, string>>(
  handler: Handler<P>,
): Handler<P> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return errorResponse(err.status, err.code, err.message, err.headers);
      }
      if (err instanceof ZodError) {
        const e = validationError(err);
        return errorResponse(e.status, e.code, e.message);
      }
      try {
        await reportUnhandled(err, req);
      } catch (reportErr) {
        console.error('[api] failed to report error', reportErr);
      }
      return errorResponse(
        500,
        'INTERNAL',
        '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      );
    }
  };
}
