import { query, withTransaction } from './db';
import { ApiError } from './http';
import type { Session } from './session';
import { type CommentInput, PAGE_SIZE, type PostInput } from './validation';

export interface PostSummary {
  id: number;
  title: string;
  nickname: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
}

export interface PostDetail extends PostSummary {
  body: string;
  likedByMe: boolean;
}

export interface Comment {
  id: number;
  postId: number;
  body: string;
  nickname: string;
  createdAt: string;
}

export interface PostPage {
  posts: PostSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface PostRow {
  id: string;
  title: string;
  body?: string;
  nickname: string;
  created_at: Date;
  like_count: number;
  comment_count: number;
  liked_by_me?: boolean;
}

interface CommentRow {
  id: string;
  post_id: string;
  body: string;
  nickname: string;
  created_at: Date;
}

function toSummary(r: PostRow): PostSummary {
  return {
    id: Number(r.id),
    title: r.title,
    nickname: r.nickname,
    createdAt: r.created_at.toISOString(),
    likeCount: r.like_count,
    commentCount: r.comment_count,
  };
}

function toComment(r: CommentRow): Comment {
  return {
    id: Number(r.id),
    postId: Number(r.post_id),
    body: r.body,
    nickname: r.nickname,
    createdAt: r.created_at.toISOString(),
  };
}

const LIKE_COUNT_SQL = '(SELECT count(*) FROM post_likes l WHERE l.post_id = p.id)::int';
const COMMENT_COUNT_SQL = '(SELECT count(*) FROM comments c WHERE c.post_id = p.id)::int';

export const notFound = () => new ApiError(404, 'NOT_FOUND', '글을 찾을 수 없습니다.');

/** Newest-first page of posts (page is 1-based). */
export async function listPosts(page: number): Promise<PostPage> {
  const offset = (page - 1) * PAGE_SIZE;
  const [{ rows }, totalResult] = await Promise.all([
    query<PostRow>(
      `SELECT p.id, p.title, s.nickname, p.created_at,
              ${LIKE_COUNT_SQL} AS like_count, ${COMMENT_COUNT_SQL} AS comment_count
         FROM posts p JOIN sessions s ON s.id = p.session_id
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT $1 OFFSET $2`,
      [PAGE_SIZE, offset],
    ),
    query<{ total: number }>('SELECT count(*)::int AS total FROM posts p'),
  ]);
  const total = totalResult.rows[0].total;
  return {
    posts: rows.map(toSummary),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getPost(id: number, viewerSessionId: number | null): Promise<PostDetail> {
  const { rows } = await query<PostRow>(
    `SELECT p.id, p.title, p.body, s.nickname, p.created_at,
            ${LIKE_COUNT_SQL} AS like_count, ${COMMENT_COUNT_SQL} AS comment_count,
            EXISTS (SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.session_id = $2)
              AS liked_by_me
       FROM posts p JOIN sessions s ON s.id = p.session_id
      WHERE p.id = $1`,
    [id, viewerSessionId],
  );
  const row = rows[0];
  if (!row) throw notFound();
  return { ...toSummary(row), body: row.body ?? '', likedByMe: Boolean(row.liked_by_me) };
}

export async function listComments(postId: number): Promise<Comment[]> {
  const { rows } = await query<CommentRow>(
    `SELECT c.id, c.post_id, c.body, s.nickname, c.created_at
       FROM comments c JOIN sessions s ON s.id = c.session_id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC, c.id ASC`,
    [postId],
  );
  return rows.map(toComment);
}

export async function createPost(session: Session, input: PostInput): Promise<PostDetail> {
  const { rows } = await query<{ id: string }>(
    'INSERT INTO posts (session_id, title, body) VALUES ($1, $2, $3) RETURNING id',
    [session.id, input.title, input.body],
  );
  return getPost(Number(rows[0].id), session.id);
}

async function assertPostExists(postId: number): Promise<void> {
  const { rowCount } = await query('SELECT 1 FROM posts WHERE id = $1', [postId]);
  if (!rowCount) throw notFound();
}

export async function createComment(
  session: Session,
  postId: number,
  input: CommentInput,
): Promise<Comment> {
  await assertPostExists(postId);
  const { rows } = await query<CommentRow>(
    `WITH c AS (
       INSERT INTO comments (post_id, session_id, body) VALUES ($1, $2, $3)
       RETURNING id, post_id, body, created_at
     )
     SELECT c.*, $4::text AS nickname FROM c`,
    [postId, session.id, input.body, session.nickname],
  );
  return toComment(rows[0]);
}

/** Toggles the caller's like on a post. One like per session per post. */
export async function toggleLike(
  session: Session,
  postId: number,
): Promise<{ liked: boolean; likeCount: number }> {
  await assertPostExists(postId);
  return withTransaction(async (client) => {
    const removed = await client.query(
      'DELETE FROM post_likes WHERE post_id = $1 AND session_id = $2',
      [postId, session.id],
    );
    let liked = false;
    if (!removed.rowCount) {
      await client.query(
        'INSERT INTO post_likes (post_id, session_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [postId, session.id],
      );
      liked = true;
    }
    const { rows } = await client.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM post_likes WHERE post_id = $1',
      [postId],
    );
    return { liked, likeCount: rows[0].n };
  });
}
