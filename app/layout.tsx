import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { FeedbackButton } from '@/components/FeedbackButton';
import { getCurrentSession } from '@/lib/current-session';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hush — 익명 채팅 게시판',
  description: '가입 없이 익명으로 이야기하는 게시판과 채팅방',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();

  return (
    <html lang="ko">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight text-emerald-700">
              Hush
            </Link>
            <nav className="flex gap-3 text-sm text-stone-600">
              <Link href="/" className="hover:text-stone-900">
                게시판
              </Link>
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm">
              {session && (
                <span className="truncate text-stone-500" title="나의 익명 닉네임">
                  <span className="hidden sm:inline">나는 </span>
                  <strong className="font-medium text-stone-800">{session.nickname}</strong>
                </span>
              )}
              <FeedbackButton />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
