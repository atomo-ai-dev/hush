import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChatRoom } from '@/components/ChatRoom';
import { getRoom, listRecentMessages } from '@/lib/chat';
import { getCurrentSession } from '@/lib/current-session';
import { isDemoMode } from '@/lib/demo';
import { idParam } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export default async function ChatRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const parsed = idParam.safeParse((await params).id);
  if (!parsed.success) notFound();
  const [room, session] = await Promise.all([getRoom(parsed.data), getCurrentSession()]);
  if (!room) notFound();
  // Demo mode has no WebSocket server: show the saved transcript instead.
  const transcript = isDemoMode() ? await listRecentMessages(room.id) : undefined;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <Link href="/chat" className="text-sm text-stone-500 hover:text-stone-800">
          ← 채팅방 목록
        </Link>
        <h1 className="truncate text-lg font-semibold">{room.name}</h1>
      </div>
      <ChatRoom roomId={room.id} myNickname={session?.nickname ?? null} transcript={transcript} />
    </section>
  );
}
