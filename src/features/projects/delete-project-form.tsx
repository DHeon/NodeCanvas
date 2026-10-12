"use client";

import { useActionState } from "react";

import { deleteProject } from "./actions";
import { removeProjectDrafts } from "../workspace/workspace-draft";

type DeleteProjectFormProps = {
  ownerId: string;
  projectId: string;
  projectTitle: string;
};

type DeleteState = {
  error: string;
  success: boolean;
};

export default function DeleteProjectForm({
  ownerId,
  projectId,
  projectTitle,
}: DeleteProjectFormProps) {
  const [state, formAction, pending] = useActionState(
    async (previous: DeleteState, formData: FormData): Promise<DeleteState> => {
      let result: DeleteState;

      try {
        result = await deleteProject(previous, formData);
      } catch {
        return {
          error:
            "삭제 결과를 확인하지 못했습니다. 목록을 새로고침해서 확인해주세요.",
          success: false,
        };
      }

      // 서버 삭제 실패 시 복구용 임시본을 보존
      if (!result.success) return result;

      try {
        removeProjectDrafts(ownerId, projectId);
      } catch {
        window.alert(
          "서버의 프로젝트는 삭제됐지만 브라우저 임시본 정리에 실패했습니다.",
        );
      }

      return result;
    },
    {
      error: "",
      success: false,
    },
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        if (
          !window.confirm(
            `"${projectTitle}" 프로젝트를 삭제할까요?\n저장된 캔버스 내용과 이 브라우저의 임시본이 삭제됩니다. 되돌릴 수 없습니다.`,
          )
        ) {
          event.preventDefault();
        }
      }}
      className="contents"
    >
      <input type="hidden" name="projectId" value={projectId} />

      <button
        type="submit"
        disabled={pending}
        aria-label={`${projectTitle} 삭제`}
        title={pending ? "삭제 중…" : "프로젝트 삭제"}
        aria-busy={pending}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500 disabled:cursor-wait disabled:opacity-50"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
        </svg>
        {pending && (
          <span role="status" className="sr-only">
            삭제 중…
          </span>
        )}
      </button>

      {state.error && (
        <p role="alert" className="basis-full text-xs text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
