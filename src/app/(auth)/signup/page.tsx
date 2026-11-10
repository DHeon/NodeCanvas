import type { Metadata } from "next";
import AuthShell from "@/features/auth/auth-shell";
import SignupForm from "@/features/auth/signup-form";

export const metadata: Metadata = { title: "회원가입 · nono" };

export default function SignupPage() {
  return (
    <AuthShell
      title="회원가입"
      description="가입하면 바로 나만의 캔버스에 메모와 이미지를 펼쳐둘 수 있어요."
      alternate={{
        prompt: "이미 계정이 있나요?",
        href: "/login",
        label: "로그인",
      }}
    >
      <SignupForm />
    </AuthShell>
  );
}
