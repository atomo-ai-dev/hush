'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';

interface ReportResult {
  created: boolean;
  reportCount: number;
  hidden: boolean;
}

export function ReportButton({
  targetType,
  targetId,
  readOnly = false,
}: {
  targetType: 'post' | 'comment';
  targetId: number;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function report() {
    const label = targetType === 'post' ? '이 글' : '이 댓글';
    if (!window.confirm(`${label}을 신고할까요? 신고가 누적되면 숨겨집니다.`)) return;
    setPending(true);
    try {
      const res = await apiFetch<ReportResult>('/api/reports', { body: { targetType, targetId } });
      if (res.hidden) {
        setStatus('신고가 누적되어 숨겨졌어요.');
        if (targetType === 'post') router.push('/');
        router.refresh();
      } else {
        setStatus(res.created ? '신고했어요.' : '이미 신고했어요.');
      }
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={report}
        disabled={pending || readOnly}
        className="text-stone-400 hover:text-red-600 disabled:opacity-50"
      >
        신고
      </button>
      {status && <span className="text-stone-500">{status}</span>}
    </span>
  );
}
