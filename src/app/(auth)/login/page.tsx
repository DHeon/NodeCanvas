import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "@/features/auth/login-form";
import { getLoginDestination } from "@/features/auth/login-destination";
import { getSession } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const destination = getLoginDestination((await searchParams).next);
  if (await getSession()) redirect(destination);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <div className="flex w-80 flex-col items-start">
        <Link
          href="/"
          className="mb-3 flex h-6 w-16 items-center justify-center rounded-full border border-neutral-300 text-xs hover:bg-neutral-100"
        >
          이전
        </Link>
        <h1 className="pb-4 text-2xl">로그인</h1>
        <LoginForm destination={destination} />
      </div>
    </main>
  );
}
