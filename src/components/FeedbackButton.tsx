'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { LIMITS } from '@/lib/limits';

export function FeedbackButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const el = dialog.current;
    const onClose = () => setStatus(null);
    el?.addEventListener('close', onClose);
    return () => el?.removeEventListener('close', onClose);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      await apiFetch('/api/feedback', { body: { message, pageUrl: window.location.href } });
      setMessage('');
      setStatus({ ok: true, text: '고마워요! 버그 신고가 접수됐어요.' });
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded-md border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
      >
        버그 신고
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="feedback-title"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl p-0 shadow-xl backdrop:bg-black/30"
      >
        <form onSubmit={onSubmit} className="space-y-3 p-5">
          <h2 id="feedback-title" className="text-lg font-semibold">
            버그 신고
          </h2>
          <p className="text-sm text-stone-500">
            어떤 문제가 있었는지 알려 주세요. 지금 보고 있는 페이지 주소가 함께 전송돼요.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={LIMITS.feedback}
            required
            rows={5}
            aria-label="버그 내용"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-emerald-600 focus:outline-none"
          />
          {status && (
            <p
              role="status"
              className={`rounded-lg px-3 py-2 text-sm ${
                status.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
              }`}
            >
              {status.text}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100"
            >
              닫기
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {pending ? '보내는 중…' : '보내기'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
