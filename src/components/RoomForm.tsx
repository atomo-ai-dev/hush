'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { LIMITS } from '@/lib/limits';

export function RoomForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { room } = await apiFetch<{ room: { id: number } }>('/api/rooms', { body: { name } });
      router.push(`/chat/${room.id}`);
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={LIMITS.roomName}
          required
          aria-label="새 채팅방 이름"
          placeholder="새 채팅방 이름 (40자 이내)"
          className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 focus:border-emerald-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          방 만들기
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
