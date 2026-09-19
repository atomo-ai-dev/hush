import Link from 'next/link';
import { PostForm } from '@/components/PostForm';

export const metadata = { title: '글쓰기 — Hush' };

export default function NewPostPage() {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">새 글 쓰기</h1>
        <Link href="/" className="text-sm text-stone-500 hover:text-stone-800">
          목록으로
        </Link>
      </div>
      <PostForm />
    </section>
  );
}
