'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export function LikeButton({
  postId,
  initialLiked,
  initialCount,
}: {
  postId: number;
  initialLiked: boolean;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      const res = await apiFetch<{ liked: boolean; likeCount: number }>(
        `/api/posts/${postId}/like`,
        { method: 'POST' },
      );
      setLiked(res.liked);
      setCount(res.likeCount);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={liked}
        className={`rounded-full border px-3 py-1 text-sm transition ${
          liked
            ? 'border-rose-300 bg-rose-50 text-rose-700'
            : 'border-stone-300 bg-white text-stone-600 hover:border-rose-300'
        }`}
      >
        {liked ? '♥' : '♡'} 추천 {count}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
