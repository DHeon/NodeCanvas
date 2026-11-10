import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthShell from "@/features/auth/auth-shell";
import LoginForm from "@/features/auth/login-form";
import { getLoginDestination } from "@/features/auth/login-destination";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "로그인 · nono" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const destination = getLoginDestination((await searchParams).next);
  if (await getSession()) redirect(destination);

  return (
    <AuthShell
      title="로그인"
      description="이어서 생각을 정리할 작업 공간으로 돌아가요."
      alternate={{
        prompt: "아직 계정이 없나요?",
        href: "/signup",
        label: "회원가입",
      }}
    >
      <LoginForm destination={destination} />
    </AuthShell>
  );
}
