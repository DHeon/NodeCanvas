import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createWorkspace } from "./create-workspace";
import {
  composePatches,
  diffEntries,
  flattenDocument,
  isEmptyPatch,
  type Entries,
  type Patch,
} from "./timelapse";
import type { WorkspaceDocument } from "./types";
import { workspaceDocumentSchema } from "./workspace-schema";

/** 한 프로젝트에 남기는 기록 수. 넘으면 가장 오래된 두 단계를 하나로 합친다. */
export const MAX_HISTORY_ROWS = 2000;

const CONTENT_KEY = /^(node|stroke|conn|tag)\|/;

function entriesOf(stored: unknown): Entries | null {
  const parsed = workspaceDocumentSchema.safeParse(stored ?? createWorkspace());
  return parsed.success ? flattenDocument(parsed.data) : null;
}

/**
 * 저장이 끝난 뒤 타임랩스 기록을 남긴다. 기록이 없던 프로젝트면 이전 내용을 기준 기록으로 먼저 남긴다.
 * 기록은 부가 기능이라, 실패해도 저장은 그대로 두고 다음 저장의 차이에 합쳐진다.
 */
export async function recordHistory(
  projectId: string,
  previous: unknown,
  next: WorkspaceDocument,
) {
  const before = entriesOf(previous);
  if (!before) return;
  const after = flattenDocument(next);
  const rows: { baseline: boolean; patch: Patch }[] = [];
  const count = await prisma.projectHistory.count({ where: { projectId } });
  if (count === 0 && [...before.keys()].some((key) => CONTENT_KEY.test(key)))
    rows.push({ baseline: true, patch: diffEntries(new Map(), before) });
  const patch = diffEntries(before, after);
  if (!isEmptyPatch(patch)) rows.push({ baseline: false, patch });
  // 순서를 지키려고 하나씩 넣는다(seq가 넣은 순서).
  for (const row of rows)
    await prisma.projectHistory.create({
      data: {
        projectId,
        baseline: row.baseline,
        patch: row.patch as unknown as Prisma.InputJsonValue,
      },
    });
  let total = count + rows.length;
  while (total > MAX_HISTORY_ROWS) {
    await mergeOldest(projectId);
    total--;
  }
}

async function mergeOldest(projectId: string) {
  const [first, second] = await prisma.projectHistory.findMany({
    where: { projectId },
    orderBy: { seq: "asc" },
    take: 2,
  });
  if (!first || !second) return;
  const merged = composePatches(
    first.patch as unknown as Patch,
    second.patch as unknown as Patch,
  );
  await prisma.$transaction([
    prisma.projectHistory.update({
      where: { id: first.id },
      data: { patch: merged as unknown as Prisma.InputJsonValue },
    }),
    prisma.projectHistory.delete({ where: { id: second.id } }),
  ]);
}
