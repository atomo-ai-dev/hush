import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-10 text-center">
      <h1 className="text-lg font-semibold">페이지를 찾을 수 없어요</h1>
      <p className="mt-2 text-stone-500">삭제되었거나 숨겨진 글일 수 있어요.</p>
      <Link href="/" className="mt-4 inline-block text-emerald-700 hover:underline">
        게시판으로 돌아가기
      </Link>
    </section>
  );
}
