import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  ApiError,
  apiHandler,
  MAX_JSON_BODY_BYTES,
  parseInput,
  readJson,
  setUnhandledErrorReporter,
} from '@/lib/http';

const ctx = { params: Promise.resolve({}) };
const req = (body?: string, headers: Record<string, string> = {}) =>
  new Request('http://test.local/api/x', { method: 'POST', body, headers });

describe('readJson', () => {
  it('parses a JSON body', async () => {
    expect(await readJson(req('{"a":1}'))).toEqual({ a: 1 });
  });

  it('rejects malformed JSON with 400', async () => {
    await expect(readJson(req('{nope'))).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_JSON',
    });
  });

  it('rejects bodies over the size limit with 413', async () => {
    const big = JSON.stringify({ s: 'x'.repeat(MAX_JSON_BODY_BYTES) });
    await expect(readJson(req(big))).rejects.toMatchObject({ status: 413 });
    await expect(
      readJson(req('{}', { 'content-length': String(MAX_JSON_BODY_BYTES + 1) })),
    ).rejects.toMatchObject({ status: 413 });
  });
});

describe('parseInput', () => {
  it('returns parsed data or throws a 400 with the first issue message', () => {
    const schema = z.object({ n: z.number({ error: '숫자를 주세요' }) });
    expect(parseInput(schema, { n: 1 })).toEqual({ n: 1 });
    expect(() => parseInput(schema, { n: 'x' })).toThrow('숫자를 주세요');
    try {
      parseInput(schema, {});
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(400);
    }
  });
});

describe('apiHandler', () => {
  afterEach(() => {
    setUnhandledErrorReporter(() => {});
  });

  it('passes successful responses through', async () => {
    const res = await apiHandler(async () => Response.json({ ok: true }))(req(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('maps ApiError to its status, code, message and headers', async () => {
    const res = await apiHandler(async () => {
      throw new ApiError(429, 'RATE_LIMITED', '천천히', { 'Retry-After': '30' });
    })(req(), ctx);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('30');
    expect(await res.json()).toEqual({ error: { code: 'RATE_LIMITED', message: '천천히' } });
  });

  it('maps a thrown ZodError to 400', async () => {
    const res = await apiHandler(async () => {
      z.string({ error: '문자열' }).parse(1);
      return new Response();
    })(req(), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe('문자열');
  });

  it('reports unexpected errors and hides their details', async () => {
    const reporter = vi.fn();
    setUnhandledErrorReporter(reporter);
    const boom = new Error('db password is hunter2');
    const request = req();
    const res = await apiHandler(async () => {
      throw boom;
    })(request, ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL');
    expect(JSON.stringify(body)).not.toContain('hunter2');
    expect(reporter).toHaveBeenCalledWith(boom, request);
  });

  it('still answers 500 when the reporter itself fails', async () => {
    setUnhandledErrorReporter(() => {
      throw new Error('reporter down');
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await apiHandler(async () => {
      throw new Error('x');
    })(req(), ctx);
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});
