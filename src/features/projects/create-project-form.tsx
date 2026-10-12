"use client";

import { useActionState } from "react";
import { createProject } from "./actions";

export default function CreateProjectForm() {
  const [state, formAction, pending] = useActionState(createProject, {
    error: "",
  });
  return (
    <form action={formAction} className="mt-8">
      <label
        htmlFor="project-title"
        className="mb-2 block text-sm text-neutral-300"
      >
        새 프로젝트
      </label>
      <div className="flex flex-wrap gap-3">
        <input
          id="project-title"
          name="title"
          required
          maxLength={120}
          placeholder="프로젝트 이름"
          disabled={pending}
          className="w-full max-w-xs rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-violet-500 px-4 py-2 text-white hover:bg-violet-400 disabled:opacity-50"
        >
          {pending ? "생성 중…" : "만들기"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
