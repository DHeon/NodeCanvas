import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <div className="flex w-80 flex-col items-start">
        <Link
          href="/"
          className="mb-3 flex h-6 w-16 items-center justify-center rounded-full border border-neutral-300 text-xs hover:bg-neutral-100"
        >
          이전
        </Link>
        <h1 className="pb-4 text-2xl">회원가입</h1>
        <form>
          <input
            className="mb-5 block rounded-xl border border-neutral-700 py-2 pl-3"
            type="text"
            placeholder="아이디 입력"
            id="username"
            name="username"
            autoComplete="username"
          />

          <input
            className="mb-5 block rounded-xl border border-neutral-700 py-2 pl-3"
            type="password"
            placeholder="비밀번호 입력"
            id="password"
            name="password"
            autoComplete="new-password"
          />

          <button
            className="rounded-md bg-black px-4 py-2 text-white hover:bg-neutral-800"
            type="submit"
          >
            등록
          </button>
        </form>
      </div>
    </main>
  );
}
