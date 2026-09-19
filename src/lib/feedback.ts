import { query } from './db';
import type { Session } from './session';
import type { FeedbackInput } from './validation';

export async function createFeedback(
  session: Session,
  input: FeedbackInput,
  userAgent: string | null,
): Promise<{ id: number }> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO feedback (session_id, message, page_url, user_agent)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [session.id, input.message, input.pageUrl, userAgent?.slice(0, 500) ?? null],
  );
  return { id: Number(rows[0].id) };
}
