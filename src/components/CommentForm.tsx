'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { LIMITS } from '@/lib/limits';

export function CommentForm({ postId }: { postId: number }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/posts/${postId}/comments`, { body: { body } });
      setBody('');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={LIMITS.comment}
        required
        rows={3}
        aria-label="댓글"
        placeholder="댓글을 남겨 보세요"
        className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-emerald-600 focus:outline-none"
      />
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between text-sm text-stone-400">
        <span>
          {[...body].length}/{LIMITS.comment}
        </span>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-700 px-4 py-1.5 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {pending ? '등록 중…' : '댓글 등록'}
        </button>
      </div>
    </form>
  );
}
