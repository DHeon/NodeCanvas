"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { quietButton } from "@/features/shell/styles";

/** 불러온 뒤 새 프로젝트 화면에서 한 번 띄울 알림. */
const IMPORT_NOTICE_KEY = "nono:import-notice";

/** 불러오기가 남긴 알림이 있으면 돌려준다(지우지 않는다. 띄운 뒤 clearImportNotice). */
export function peekImportNotice(): string | null {
  try {
    return sessionStorage.getItem(IMPORT_NOTICE_KEY);
  } catch {
    return null;
  }
}

export function clearImportNotice() {
  try {
    sessionStorage.removeItem(IMPORT_NOTICE_KEY);
  } catch {}
}

/**
 * .nono 파일을 골라 새 프로젝트로 불러오고 그 프로젝트로 이동한다.
 * variant="menu"는 작업 공간 파일 메뉴 안의 항목 모양.
 */
export default function ImportProjectButton({
  variant = "button",
  onDone,
}: {
  variant?: "button" | "menu";
  onDone?: () => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/projects/import?name=${encodeURIComponent(file.name)}`,
        {
          method: "POST",
          headers: { "content-type": "application/octet-stream" },
          body: file,
        },
      );
      const body = (await response.json().catch(() => null)) as {
        projectId?: string;
        missingImages?: number;
        message?: string;
      } | null;
      if (!response.ok || !body?.projectId) {
        setError(body?.message ?? "프로젝트를 불러오지 못했어요.");
        return;
      }
      if (body.missingImages)
        try {
          sessionStorage.setItem(
            IMPORT_NOTICE_KEY,
            `불러왔어요. 이미지 ${body.missingImages}개는 파일에서 찾지 못해 빈 이미지로 두었어요.`,
          );
        } catch {}
      onDone?.();
      router.push(`/projects/${body.projectId}`);
    } catch {
      setError("프로젝트를 불러오지 못했어요. 연결을 확인해 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={variant === "menu" ? "" : "shrink-0"}>
      <input
        ref={input}
        type="file"
        accept=".nono"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() => input.current?.click()}
        className={
          variant === "menu"
            ? "w-full rounded-lg px-3 py-2 text-left text-bark hover:bg-mist focus-visible:outline-2 focus-visible:outline-moss-deep disabled:opacity-50"
            : quietButton
        }
      >
        {pending ? "불러오는 중…" : "불러오기"}
      </button>
      {error && (
        <p
          role="alert"
          className={`mt-2 text-xs break-keep text-red-600 ${variant === "menu" ? "px-3" : ""}`}
        >
          {error}
        </p>
      )}
    </div>
  );
}
