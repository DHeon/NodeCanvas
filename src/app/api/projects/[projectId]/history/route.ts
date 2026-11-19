import { z } from "zod";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** 타임랩스 기록(오래된 순). 각 항목은 { baseline, patch, createdAt }. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const session = await getSession();
    if (!session)
      return Response.json(
        { message: "로그인이 필요합니다." },
        { status: 401 },
      );
    const { projectId } = await params;
    if (!z.uuid().safeParse(projectId).success)
      return Response.json(
        { message: "프로젝트 ID가 올바르지 않습니다." },
        { status: 400 },
      );
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: session.user.id },
      select: { id: true },
    });
    if (!project)
      return Response.json(
        { message: "프로젝트를 찾을 수 없습니다." },
        { status: 404 },
      );
    const rows = await prisma.projectHistory.findMany({
      where: { projectId },
      orderBy: { seq: "asc" },
      select: { baseline: true, patch: true, createdAt: true },
    });
    return Response.json(
      { history: rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("타임랩스 기록 조회 실패:", error);
    return Response.json(
      { message: "타임랩스 기록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
