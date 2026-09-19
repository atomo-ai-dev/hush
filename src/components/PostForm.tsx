'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { LIMITS } from '@/lib/limits';

export function PostForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { post } = await apiFetch<{ post: { id: number } }>('/api/posts', {
        body: { title, body },
      });
      router.push(`/posts/${post.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1 flex justify-between text-sm font-medium text-stone-700">
          제목
          <span className="font-normal text-stone-400">
            {[...title].length}/{LIMITS.postTitle}
          </span>
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={LIMITS.postTitle}
          required
          className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-emerald-600 focus:outline-none"
          placeholder="제목을 입력하세요"
        />
      </label>
      <label className="block">
        <span className="mb-1 flex justify-between text-sm font-medium text-stone-700">
          본문
          <span className="font-normal text-stone-400">
            {[...body].length}/{LIMITS.postBody}
          </span>
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={LIMITS.postBody}
          required
          rows={10}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-emerald-600 focus:outline-none"
          placeholder="익명으로 자유롭게 이야기해 보세요"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {pending ? '등록 중…' : '등록'}
        </button>
      </div>
    </form>
  );
}
