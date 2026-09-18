"use client";

import Link from "next/link";
import { useState, type SubmitEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { signupSchema } from "./signup-schema";

export default function SignupForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

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
      setErrorMessage(result.error.issues[0].message);
      return;
    }

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
            : "회원가입을 처리하지 못했습니다. 입력 내용을 확인해주세요.",
        );
        return;
      }

      form.reset();
      setIsComplete(true);
    } catch {
      setErrorMessage(
        "서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isComplete) {
    return (
      <div role="status" className="space-y-4">
        <p className="text-sm">
          가입 요청을 처리했습니다. 로그인 화면에서 진행해주세요.
        </p>

        <Link
          href="/login"
          className="inline-block rounded-md bg-black px-4 py-2 text-white hover:bg-neutral-800"
        >
          로그인으로 이동
        </Link>
      </div>
    );
  }

  const inputClassName =
    "mb-5 block w-full rounded-xl border border-neutral-700 px-3 py-2";

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <fieldset disabled={isSubmitting} className="disabled:opacity-60">
        <label htmlFor="name" className="sr-only">
          이름
        </label>
        <input
          className={inputClassName}
          type="text"
          placeholder="이름 입력"
          id="name"
          name="name"
          autoComplete="name"
          required
        />

        <label htmlFor="email" className="sr-only">
          이메일
        </label>
        <input
          className={inputClassName}
          type="email"
          placeholder="이메일 입력"
          id="email"
          name="email"
          autoComplete="email"
          required
        />

        <label htmlFor="password" className="sr-only">
          비밀번호
        </label>
        <input
          className={inputClassName}
          type="password"
          placeholder="비밀번호 입력"
          id="password"
          name="password"
          autoComplete="new-password"
          required
        />

        <label htmlFor="confirmPassword" className="sr-only">
          비밀번호 확인
        </label>
        <input
          className={inputClassName}
          type="password"
          placeholder="비밀번호 확인"
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
        />

        {errorMessage && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {errorMessage}
          </p>
        )}

        <button
          className="rounded-md bg-black px-4 py-2 text-white hover:bg-neutral-800 disabled:cursor-wait"
          type="submit"
        >
          {isSubmitting ? "등록 중…" : "등록"}
        </button>
      </fieldset>
    </form>
  );
}