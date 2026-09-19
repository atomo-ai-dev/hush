import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db';
import { NICKNAME_PATTERN } from '@/lib/nickname';
import { getOrCreateSession } from '@/lib/session';
import { newSessionToken } from '@/lib/session-token';
import { GET as getMe } from '../../app/api/me/route';
import { dbAvailable, noParams, resetDb, TestClient } from './helpers';

describe.skipIf(!dbAvailable)('sessions (integration)', () => {
  beforeEach(resetDb);
  afterAll(closePool);

  it('creates a session with a nickname on first sight and reuses it afterwards', async () => {
    const token = newSessionToken();
    const first = await getOrCreateSession(token);
    const again = await getOrCreateSession(token);
    expect(first.nickname).toMatch(NICKNAME_PATTERN);
    expect(again).toEqual(first);
  });

  it('stores only a hash of the token', async () => {
    const token = newSessionToken();
    await getOrCreateSession(token);
    const { rows } = await query('SELECT token_hash FROM sessions');
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).not.toBe(token);
  });

  it('GET /api/me returns the nickname for the cookie', async () => {
    const client = new TestClient();
    const res = await getMe(client.request('/api/me'), noParams);
    expect(res.status).toBe(200);
    const { nickname } = await res.json();
    expect(nickname).toMatch(NICKNAME_PATTERN);
    const again = await (await getMe(client.request('/api/me'), noParams)).json();
    expect(again.nickname).toBe(nickname);
  });

  it('GET /api/me without a valid cookie is 401', async () => {
    const res = await getMe(new Request('http://localhost/api/me'), noParams);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('NO_SESSION');
  });
});
