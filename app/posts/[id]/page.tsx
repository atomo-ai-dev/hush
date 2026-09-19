import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CommentForm } from '@/components/CommentForm';
import { LikeButton } from '@/components/LikeButton';
import { getPost, listComments } from '@/lib/board';
import { getCurrentSession } from '@/lib/current-session';
import { formatRelativeTime } from '@/lib/format';
import { ApiError } from '@/lib/http';
import { idParam } from '@/lib/validation';

export const dynamic = 'force-dynamic';

async function load(rawId: string) {
  const parsed = idParam.safeParse(rawId);
  if (!parsed.success) notFound();
  const session = await getCurrentSession();
  try {
    const [post, comments] = await Promise.all([
      getPost(parsed.data, session?.id ?? null),
      listComments(parsed.data),
    ]);
    return { post, comments };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { post, comments } = await load((await params).id);

  return (
    <div className="space-y-6">
      <article className="rounded-xl border border-stone-200 bg-white p-5">
        <Link href="/" className="text-sm text-stone-500 hover:text-stone-800">
          ← 목록
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{post.title}</h1>
        <p className="mt-1 flex gap-3 text-xs text-stone-500">
          <span>{post.nickname}</span>
          <span>{formatRelativeTime(post.createdAt)}</span>
        </p>
        <div className="mt-4 whitespace-pre-wrap leading-relaxed">{post.body}</div>
        <div className="mt-6 flex items-center gap-3">
          <LikeButton
            postId={post.id}
            initialLiked={post.likedByMe}
            initialCount={post.likeCount}
          />
        </div>
      </article>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">댓글 {comments.length}</h2>
        {comments.length > 0 && (
          <ul className="mb-4 divide-y divide-stone-100">
            {comments.map((c) => (
              <li key={c.id} className="py-3">
                <p className="flex gap-3 text-xs text-stone-500">
                  <span className="font-medium text-stone-700">{c.nickname}</span>
                  <span>{formatRelativeTime(c.createdAt)}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
        <CommentForm postId={post.id} />
      </section>
    </div>
  );
}
