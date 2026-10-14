"use client";

import Link from "next/link";
import { useRef, useState, type SubmitEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { loginSchema } from "./login-schema";
import { getLoginDestination } from "./login-destination";

export default function LoginForm({ destination }: { destination: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      setErrorMessage(result.error.issues[0].message);
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);
    try {
      const { error } = await authClient.signIn.email(result.data);  //이메일을 통해 로그인 요청을 보냄
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

  const inputClass =
    "mb-5 block w-full rounded-xl border border-neutral-700 px-3 py-2";
  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <fieldset disabled={isSubmitting} className="disabled:opacity-60">
        <label htmlFor="email" className="sr-only">
          이메일
        </label>
        <input
          className={inputClass}
          type="email"
          id="email"
          name="email"
          placeholder="이메일 입력"
          autoComplete="username"
          required
        />
        <label htmlFor="password" className="sr-only">
          비밀번호
        </label>
        <input
          className={inputClass}
          type="password"
          id="password"
          name="password"
          placeholder="비밀번호 입력"
          autoComplete="current-password"
          required
        />
        {errorMessage && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {errorMessage}
          </p>
        )}
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-white hover:bg-neutral-800 disabled:cursor-wait"
        >
          {isSubmitting ? "로그인 중…" : "로그인"}
        </button>
        <Link
          href="/signup"
          className="ml-4 text-sm underline underline-offset-4"
        >
          회원가입
        </Link>
      </fieldset>
    </form>
  );
}
