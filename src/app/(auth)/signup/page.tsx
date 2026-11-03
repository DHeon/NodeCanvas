import Link from "next/link";
import SignupForm from "@/features/auth/signup-form";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f8f9f4] px-6 py-12 text-neutral-900 [color-scheme:light]">
      <div className="flex w-full max-w-80 flex-col items-start">
        <Link
          href="/"
          className="mb-3 flex h-6 w-16 items-center justify-center rounded-full border border-neutral-300 bg-white text-xs text-neutral-600 hover:bg-neutral-100"
        >
          이전
        </Link>

        <h1 className="pb-4 text-2xl font-semibold">회원가입</h1>

        <SignupForm />
      </div>
    </main>
  );
}
