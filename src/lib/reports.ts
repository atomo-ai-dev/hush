import { withTransaction } from './db';
import { ApiError } from './http';
import type { Session } from './session';

/** Distinct-session reports needed to hide a post or comment. */
export const HIDE_THRESHOLD = 3;

export type ReportTarget = 'post' | 'comment';

export interface ReportResult {
  /** False when this session had already reported the target. */
  created: boolean;
  reportCount: number;
  hidden: boolean;
}

const TABLE: Record<ReportTarget, 'posts' | 'comments'> = { post: 'posts', comment: 'comments' };

/**
 * Records a report (once per session per target). When the number of distinct
 * reporting sessions reaches HIDE_THRESHOLD the target is hidden.
 */
export async function reportContent(
  session: Session,
  targetType: ReportTarget,
  targetId: number,
  reason: string | null,
): Promise<ReportResult> {
  const table = TABLE[targetType];
  return withTransaction(async (client) => {
    // Lock the target row so concurrent reports agree on when it gets hidden.
    const target = await client.query<{ hidden_at: Date | null }>(
      `SELECT hidden_at FROM ${table} WHERE id = $1 FOR UPDATE`,
      [targetId],
    );
    if (!target.rowCount) {
      throw new ApiError(404, 'NOT_FOUND', '신고할 대상을 찾을 수 없습니다.');
    }
    const inserted = await client.query(
      `INSERT INTO reports (target_type, target_id, session_id, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (target_type, target_id, session_id) DO NOTHING`,
      [targetType, targetId, session.id, reason],
    );
    const { rows } = await client.query<{ n: number }>(
      `SELECT count(DISTINCT session_id)::int AS n FROM reports
        WHERE target_type = $1 AND target_id = $2`,
      [targetType, targetId],
    );
    const reportCount = rows[0].n;
    let hidden = target.rows[0].hidden_at !== null;
    if (!hidden && reportCount >= HIDE_THRESHOLD) {
      await client.query(`UPDATE ${table} SET hidden_at = now() WHERE id = $1`, [targetId]);
      hidden = true;
    }
    return { created: Boolean(inserted.rowCount), reportCount, hidden };
  });
}
