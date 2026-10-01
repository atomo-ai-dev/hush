import Link from 'next/link';
import { RoomForm } from '@/components/RoomForm';
import { listRooms } from '@/lib/chat';
import { isDemoMode } from '@/lib/demo';
import { formatRelativeTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: '채팅방 — Hush' };

export default async function ChatRoomsPage() {
  const rooms = await listRooms();

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">채팅방</h1>
      <RoomForm readOnly={isDemoMode()} />
      {rooms.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
          아직 채팅방이 없어요. 첫 방을 만들어 보세요!
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link
                href={`/chat/${room.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50"
              >
                <span className="truncate font-medium">{room.name}</span>
                <span className="shrink-0 text-xs text-stone-500">
                  메시지 {room.messageCount}
                  {room.lastMessageAt && ` · ${formatRelativeTime(room.lastMessageAt)}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
