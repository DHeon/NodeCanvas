import { z } from "zod";
import type { WorkspaceDocument } from "./types";
import { workspaceDocumentSchema } from "./workspace-schema";

export class WorkspaceSaveError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const messages: Record<number, string> = {
  400: "문서가 저장 조건에 맞지 않습니다. 제목·본문 길이와 노드 수를 확인해주세요.",
  401: "로그인이 만료되었습니다. 다시 로그인해주세요.",
  403: "이 주소에서는 저장 요청이 허용되지 않습니다.",
  404: "프로젝트가 삭제됐거나 접근 권한이 없습니다.",
  409: "다른 화면에서 먼저 저장했습니다. 현재 내용은 저장되지 않았습니다. 서버 문서를 확인해주세요.",
};

async function requestDocument(projectId: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`/api/projects/${projectId}/document`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new WorkspaceSaveError(
        response.status,
        messages[response.status] ??
          "서버 저장에 실패했습니다. 다시 시도해주세요.",
      );
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function saveWorkspaceDocument(
  projectId: string,
  document: WorkspaceDocument,
  expectedVersion: number,
): Promise<number> {
  const body = await requestDocument(projectId, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document, expectedVersion }),
  });
  const result = z
    .object({ documentVersion: z.number().int().nonnegative() })
    .parse(body);
  if (result.documentVersion !== expectedVersion + 1)
    throw new Error("저장 응답의 버전을 확인하지 못했습니다.");
  return result.documentVersion;
}

export async function loadWorkspaceDocument(projectId: string) {
  return z
    .object({
      document: workspaceDocumentSchema,
      documentVersion: z.number().int().nonnegative(),
    })
    .parse(await requestDocument(projectId));
}
