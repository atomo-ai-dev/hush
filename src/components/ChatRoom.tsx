'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/lib/chat';
import { formatClock } from '@/lib/format';
import { LIMITS } from '@/lib/limits';
import type { ServerEvent } from '@/server/chat-server';

type Status = 'connecting' | 'open' | 'closed';

const STATUS_LABEL: Record<Status, string> = {
  connecting: '연결 중…',
  open: '연결됨',
  closed: '연결 끊김 — 다시 연결하는 중',
};

/** Merges messages by id, keeping them in id order (history and live events may overlap). */
function merge(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/**
 * Live chat over WebSocket. Given a `transcript`, renders it statically instead
 * (demo mode has no WebSocket server): no connection, input disabled.
 */
export function ChatRoom({
  roomId,
  myNickname,
  transcript,
}: {
  roomId: number;
  myNickname: string | null;
  transcript?: ChatMessage[];
}) {
  const readOnly = transcript !== undefined;
  const [messages, setMessages] = useState<ChatMessage[]>(transcript ?? []);
  const [status, setStatus] = useState<Status>('connecting');
  const [presence, setPresence] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const socket = useRef<WebSocket | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (readOnly) return;
    let closedByUs = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      setStatus('connecting');
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/chat?roomId=${roomId}`);
      socket.current = ws;

      ws.onopen = () => {
        retry = 0;
        setStatus('open');
      };
      ws.onmessage = (e) => {
        const event = JSON.parse(e.data) as ServerEvent;
        if (event.type === 'history') setMessages((cur) => merge(cur, event.messages));
        else if (event.type === 'message') setMessages((cur) => merge(cur, [event.message]));
        else if (event.type === 'presence') setPresence(event.count);
        else if (event.type === 'error') setError(event.message);
      };
      ws.onclose = () => {
        socket.current = null;
        if (closedByUs) return;
        setStatus('closed');
        retry += 1;
        timer = setTimeout(connect, Math.min(10_000, 500 * 2 ** retry));
      };
    }

    connect();
    return () => {
      closedByUs = true;
      clearTimeout(timer);
      socket.current?.close();
    };
  }, [roomId, readOnly]);

  useEffect(() => {
    if (messages.length > 0) bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) {
      setError('메시지를 입력해 주세요.');
      return;
    }
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('아직 연결되지 않았어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    ws.send(JSON.stringify({ type: 'message', body }));
    setDraft('');
    setError(null);
  }

  return (
    <div className="flex h-[calc(100dvh-11rem)] min-h-80 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2 text-xs text-stone-500">
        {readOnly ? (
          <span>저장된 대화 기록 (실시간 채팅 꺼짐)</span>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  status === 'open' ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
              />
              {STATUS_LABEL[status]}
            </span>
            <span>{presence}명 접속 중</span>
          </>
        )}
      </div>

      <ol className="flex-1 space-y-2 overflow-y-auto px-4 py-3" aria-live="polite">
        {messages.length === 0 && (
          <li className="py-10 text-center text-sm text-stone-400">
            아직 메시지가 없어요. 먼저 인사해 보세요!
          </li>
        )}
        {messages.map((m) => {
          const mine = m.nickname === myNickname;
          return (
            <li key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <span className="text-xs text-stone-500">
                {mine ? '나' : m.nickname} · {formatClock(m.createdAt)}
              </span>
              <span
                className={`mt-0.5 max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-1.5 ${
                  mine ? 'bg-emerald-700 text-white' : 'bg-stone-100'
                }`}
              >
                {m.body}
              </span>
            </li>
          );
        })}
        <div ref={bottom} />
      </ol>

      <form onSubmit={onSubmit} className="border-t border-stone-100 p-3">
        {error && (
          <p role="alert" className="mb-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={LIMITS.chatMessage}
            disabled={readOnly}
            aria-label="메시지"
            placeholder={
              readOnly ? '시연 화면에서는 메시지를 보낼 수 없어요' : '메시지를 입력하세요'
            }
            className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 focus:border-emerald-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={readOnly || status !== 'open'}
            className="shrink-0 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            보내기
          </button>
        </div>
      </form>
    </div>
  );
}
