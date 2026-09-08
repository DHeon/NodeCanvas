import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-white">
      <section className="w-full max-w-3xl">
        <h1 className="text-5xl leading-tight font-semibold sm:text-7xl">
          메인
        </h1>

        <div className="mt-10 flex gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-violet-500 px-5 py-3 font-medium transition hover:bg-violet-400"
          >
            로그인
          </Link>

          <Link
            href="/signup"
            className="rounded-xl border border-neutral-700 px-5 py-3 font-medium transition hover:bg-neutral-900"
          >
            회원가입
          </Link>
        </div>
      </section>
    </main>
  );
}