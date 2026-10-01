import Link from 'next/link';
import { listPosts } from '@/lib/board';
import { isDemoMode } from '@/lib/demo';
import { formatRelativeTime } from '@/lib/format';
import { parsePage } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const page = parsePage((await searchParams).page);
  const { posts, totalPages, total } = await listPosts(page);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          게시판 <span className="text-sm font-normal text-stone-400">{total}개의 글</span>
        </h1>
        {isDemoMode() ? (
          <span
            aria-disabled="true"
            className="cursor-not-allowed rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white opacity-50"
          >
            글쓰기
          </span>
        ) : (
          <Link
            href="/posts/new"
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            글쓰기
          </Link>
        )}
      </div>

      {posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
          {page === 1 ? '아직 글이 없어요. 첫 글을 남겨 보세요!' : '이 페이지에는 글이 없어요.'}
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {posts.map((post) => (
            <li key={post.id}>
              <Link href={`/posts/${post.id}`} className="block px-4 py-3 hover:bg-stone-50">
                <p className="font-medium">
                  {post.title}
                  {post.commentCount > 0 && (
                    <span className="ml-1.5 text-sm text-emerald-700">[{post.commentCount}]</span>
                  )}
                </p>
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-stone-500">
                  <span>{post.nickname}</span>
                  <span>{formatRelativeTime(post.createdAt)}</span>
                  <span>추천 {post.likeCount}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label="페이지" className="mt-6 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link href={`/?page=${page - 1}`} className="text-emerald-700 hover:underline">
              ← 이전
            </Link>
          ) : (
            <span className="text-stone-300">← 이전</span>
          )}
          <span className="text-stone-500">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`/?page=${page + 1}`} className="text-emerald-700 hover:underline">
              다음 →
            </Link>
          ) : (
            <span className="text-stone-300">다음 →</span>
          )}
        </nav>
      )}
    </section>
  );
}
