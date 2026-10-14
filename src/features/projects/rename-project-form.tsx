"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { renameProject } from "./actions";

type RenameProjectFormProps = {
  projectId: string;
  projectTitle: string;
  children?: ReactNode;
};

export default function RenameProjectForm({
  projectId,
  projectTitle,
  children,
}: RenameProjectFormProps) {
  const [editing, setEditing] = useState(false);      //제목 편집창으로 바꿀지 true, false
  const [title, setTitle] = useState(projectTitle);  //사용자가 입력중인 title
  const [error, setError] = useState("");           // 빈 이름, 서버 오류 등 
  const [pending, startTransition] = useTransition(); //저장 처리 중인가
  const inputRef = useRef<HTMLInputElement>(null);  // 입력창 부분 DOM 
  const editingRef = useRef(false); // 편집 가능 상태인지 확인
  const savingRef = useRef(false); // 이미 저장 요청 중인지 확인
  const composingRef = useRef(false);  // 한글 입력시 조합완료 이벤트와 엔터 이벤트 중복 관련
  const blurredDuringCompositionRef = useRef(false); //입력 중 다른 곳 클릭 하면 자동 저장
  const errorId = useId();

  useEffect(() => {  // 편집 시작시 포커스 
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEditing() {
    if (savingRef.current) return;
    editingRef.current = true;
    composingRef.current = false;
    blurredDuringCompositionRef.current = false;
    setTitle(projectTitle);
    setError("");
    setEditing(true);
  }

  function cancelEditing() {
    if (savingRef.current) return;
    // Esc로 사라지는 입력창의 blur가 저장을 시작하지 않게 한다.
    editingRef.current = false;
    blurredDuringCompositionRef.current = false;
    setTitle(projectTitle);
    setError("");
    setEditing(false);
  }

  function saveTitle(rawTitle: string) {
    // Enter와 blur가 연이어 발생해도 중복 저장하지 않는다.
    if (!editingRef.current || savingRef.current) return;
    const nextTitle = rawTitle.trim();
    if (!nextTitle) {
      setError("프로젝트 이름을 입력해주세요.");
      return;
    }
    if (nextTitle === projectTitle) {
      editingRef.current = false;
      setError("");
      setEditing(false);
      return;
    }
    savingRef.current = true;
    setError("");
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("title", nextTitle);

    startTransition(async () => {
      try {
        const result = await renameProject(
          { error: "", message: "" },
          formData,
        );
        if (result.error) {
          setError(result.error);
          return;
        }
        editingRef.current = false;
        setTitle(nextTitle);
        setEditing(false);
      } catch {
        // 실패해도 입력값을 유지해서 다시 시도할 수 있다.
        setError("이름 변경 결과를 확인하지 못했습니다. 다시 시도해주세요.");
      } finally {
        savingRef.current = false;
      }
    });
  }

  return (
    <div className="border-t border-neutral-200 px-4 py-3 text-neutral-600">
      <div className="flex min-h-7 flex-wrap items-center gap-2">
        {editing ? (
          <input
            ref={inputRef}
            aria-label="프로젝트 이름"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            value={title}
            maxLength={120}
            readOnly={pending}
            onChange={(event) => {
              setTitle(event.target.value);
              setError("");
            }}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={(event) => {
              composingRef.current = false;
              if (blurredDuringCompositionRef.current) {
                blurredDuringCompositionRef.current = false;
                saveTitle(event.currentTarget.value);
              }
            }}
            onBlur={(event) => {
              if (composingRef.current) {
                blurredDuringCompositionRef.current = true;
                return;
              }
              saveTitle(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              // 한글 조합 확정용 Enter는 저장 명령이 아니다.
              if (
                event.nativeEvent.isComposing ||
                composingRef.current ||
                event.keyCode === 229
              )
                return;
              if (event.key === "Enter") {
                event.preventDefault();
                saveTitle(event.currentTarget.value);
              } else if (event.key === "Escape") {
                event.preventDefault();
                cancelEditing();
              }
            }}
            className="h-7 min-w-0 flex-1 rounded border border-violet-400 bg-white px-1.5 font-medium text-neutral-900 outline-none read-only:opacity-60 focus:ring-2 focus:ring-violet-200"
          />
        ) : (
          <>
            <h3 className="min-w-0 flex-1 truncate font-medium">
              <Link
                href={`/projects/${projectId}`}
                title={projectTitle}
                className="hover:text-neutral-900"
              >
                {projectTitle}
              </Link>
            </h3>
            <button
              type="button"
              onClick={startEditing}
              aria-label={`${projectTitle} 이름 수정`}
              title="이름 수정"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-violet-500"
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
                <path d="m16 4 4 4M4 20l4-1 12-12a2.83 2.83 0 0 0-4-4L4 15z" />
              </svg>
            </button>
            {children}
          </>
        )}
      </div>
      {pending && (
        <p role="status" className="mt-1 text-xs text-neutral-400">
          저장 중…
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
