"use client";

import Link from "next/link";
import { useRef, useState, type SubmitEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { primaryButton } from "@/features/shell/styles";
import AuthField, { fieldErrors } from "./auth-field";
import { signupSchema } from "./signup-schema";

export default function SignupForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const submitting = useRef(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setErrorMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const result = signupSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!result.success) {
      setErrors(fieldErrors(result.error.issues));
      return;
    }
    setErrors({});

    submitting.current = true;
    setIsSubmitting(true);
    try {
      const { error } = await authClient.signUp.email({
        name: result.data.name,
        email: result.data.email,
        password: result.data.password,
      });
      if (error) {
        setErrorMessage(
          error.status === 429
            ? "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
            : "회원가입을 처리하지 못했습니다. 이미 가입한 이메일인지 확인하거나 다른 이메일로 시도해주세요.",
        );
        return;
      }

      // 서버는 가입 시 자동 로그인을 하지 않는다(auth.ts). 같은 입력으로 바로 로그인해
      // 정보를 다시 입력하지 않고 대시보드로 이어지게 한다.
      try {
        const signIn = await authClient.signIn.email({
          email: result.data.email,
          password: result.data.password,
        });
        if (!signIn.error) {
          window.location.replace("/dashboard");
          return;
        }
      } catch {
        // 아래 완료 안내로 대신한다.
      }
      form.reset();
      setIsComplete(true);
    } catch {
      setErrorMessage("서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  if (isComplete) {
    return (
      <div role="status" className="space-y-4">
        <p className="text-sm leading-6 text-bark-soft">
          가입이 완료되었습니다. 로그인하면 바로 첫 프로젝트를 만들 수 있어요.
        </p>
        <Link href="/login" className={`${primaryButton} w-full`}>
          로그인하기
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <fieldset disabled={isSubmitting} className="space-y-5">
        <AuthField
          id="name"
          label="이름"
          type="text"
          autoComplete="name"
          required
          error={errors.name}
        />
        <AuthField
          id="email"
          label="이메일"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
          error={errors.email}
        />
        <AuthField
          id="password"
          label="비밀번호"
          type="password"
          autoComplete="new-password"
          hint="8자 이상"
          required
          error={errors.password}
        />
        <AuthField
          id="confirmPassword"
          label="비밀번호 확인"
          type="password"
          autoComplete="new-password"
          required
          error={errors.confirmPassword}
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
          {isSubmitting ? "가입하는 중…" : "가입하고 시작하기"}
        </button>
      </fieldset>
    </form>
  );
}
