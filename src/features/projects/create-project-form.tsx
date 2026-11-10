"use client";

import { useActionState } from "react";
import { primaryButton, textInput } from "@/features/shell/styles";
import { createProject } from "./actions";

export default function CreateProjectForm({
  autoFocus = false,
}: {
  autoFocus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(createProject, {
    error: "",
  });
  return (
    <form
      action={formAction}
      className={autoFocus ? "w-full" : "w-full sm:w-auto"}
    >
      <label
        htmlFor="project-title"
        className="mb-1.5 block text-xs font-medium text-bark-soft"
      >
        새 프로젝트
      </label>
      <div className="flex gap-2">
        <input
          id="project-title"
          name="title"
          required
          maxLength={120}
          placeholder="예: 졸업 작품 아이디어"
          disabled={pending}
          autoFocus={autoFocus}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "project-title-error" : undefined}
          className={`${textInput} min-w-0 flex-1 ${autoFocus ? "" : "sm:w-64 sm:flex-none"}`}
        />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={`${primaryButton} shrink-0`}
        >
          {pending ? "만드는 중…" : "만들기"}
        </button>
      </div>
      {state.error && (
        <p
          id="project-title-error"
          role="alert"
          className="mt-2 text-xs text-red-600"
        >
          {state.error}
        </p>
      )}
    </form>
  );
}
