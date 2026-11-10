"use client";

import { useRef, useState, type SubmitEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { primaryButton } from "@/features/shell/styles";
import AuthField, { fieldErrors } from "./auth-field";
import { loginSchema } from "./login-schema";
import { getLoginDestination } from "./login-destination";

export default function LoginForm({ destination }: { destination: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const submitting = useRef(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setErrorMessage("");
    const formData = new FormData(event.currentTarget);
    const result = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!result.success) {
      setErrors(fieldErrors(result.error.issues));
      return;
    }
    setErrors({});

    submitting.current = true;
    setIsSubmitting(true);
    try {
      const { error } = await authClient.signIn.email(result.data); // 이메일로 로그인 요청
      if (error) {
        setErrorMessage(
          error.status === 429
            ? "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
            : error.status >= 500
              ? "로그인을 처리하지 못했습니다. 잠시 후 다시 시도해주세요."
              : "이메일 또는 비밀번호를 확인해주세요.",
        );
        return;
      }
      // 계정 전환 시 이전 사용자의 클라이언트 라우터 캐시도 비운다.
      window.location.replace(getLoginDestination(destination));
    } catch {
      setErrorMessage("서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <fieldset disabled={isSubmitting} className="space-y-5">
        <AuthField
          id="email"
          label="이메일"
          type="email"
          placeholder="you@example.com"
          autoComplete="username"
          required
          error={errors.email}
        />
        <AuthField
          id="password"
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          required
          error={errors.password}
        />
        {errorMessage && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            {errorMessage}
          </p>
        )}
        <button
          type="submit"
          aria-busy={isSubmitting}
          className={`${primaryButton} w-full ${isSubmitting ? "cursor-wait" : ""}`}
        >
          {isSubmitting ? "로그인 중…" : "로그인"}
        </button>
      </fieldset>
    </form>
  );
}
