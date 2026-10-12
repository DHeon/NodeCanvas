import { z } from "zod";

import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createWorkspace } from "@/features/workspace/create-workspace";
import { workspaceDocumentSchema } from "@/features/workspace/workspace-schema";

export const runtime = "nodejs";

const saveDocumentSchema = z.strictObject({
  document: workspaceDocumentSchema,
  expectedVersion: z.number().int().min(0).max(2147483646),
});

type DocumentRouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: DocumentRouteContext,
) {
  try {
    const session = await getSession();

    if (!session) {
      return Response.json(
        { message: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    const { projectId } = await params;
    const idResult = z.uuid().safeParse(projectId);

    if (!idResult.success) {
      return Response.json(
        { message: "프로젝트 ID 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const project = await prisma.project.findFirst({
      where: {
        id: idResult.data,
        ownerId: session.user.id,
      },
      select: {
        id: true,
        title: true,
        document: true,
        updatedAt: true,
        documentVersion: true,
      },
    });

    if (!project) {
      return Response.json(
        { message: "프로젝트를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const result = workspaceDocumentSchema.safeParse(
      project.document === null
        ? createWorkspace()
        : project.document,
    );

    if (!result.success) {
      return Response.json(
        { message: "저장된 문서의 형식이 올바르지 않습니다." },
        { status: 500 },
      );
    }

    return Response.json(
      {
        projectId: project.id,
        title: project.title,
        document: result.data,
        updatedAt: project.updatedAt.toISOString(),
        documentVersion: project.documentVersion,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("작업 공간 조회 실패:", error);

    return Response.json(
      { message: "작업 공간을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: DocumentRouteContext,
) {
  try {
    const session = await getSession();  // 세션 확인

    if (!session) {
      return Response.json(
        { message: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    // 사이트에서 보낸 저장 요청만 허용
    const expectedOrigin = new URL(
      process.env.BETTER_AUTH_URL!,
    ).origin;

    if (request.headers.get("origin") !== expectedOrigin) {
      return Response.json(
        { message: "허용되지 않은 요청입니다." },
        { status: 403 },
      );
    }

    const { projectId } = await params;
    const idResult = z.uuid().safeParse(projectId);

    if (!idResult.success) { //uuid 형식인가 확인
      return Response.json(
        { message: "프로젝트 ID 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const contentType = request.headers  //json 형식인가 확인
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();

    if (contentType !== "application/json") {
      return Response.json(
        { message: "JSON 형식으로 요청해주세요." },
        { status: 415 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        { message: "JSON을 해석할 수 없습니다." },
        { status: 400 },
      );
    }

    const result = saveDocumentSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        {
          message: "작업 공간 데이터가 올바르지 않습니다.",
          issues: result.error.issues,
        },
        { status: 400 },
      );
    }

    const { document, expectedVersion } = result.data;

    const saved = await prisma.project.updateMany({
      where: {
        id: idResult.data,
        ownerId: session.user.id,
        documentVersion: expectedVersion,
      },
      data: {
        document,
        documentVersion: {
          increment: 1,
        },
      },
    });

    if (saved.count === 0) {
      const project = await prisma.project.findFirst({
        where: {
          id: idResult.data,
          ownerId: session.user.id,
        },
        select: {
          id: true,
        },
      });

      if (!project) {
        return Response.json(
          { message: "프로젝트를 찾을 수 없습니다." },
          { status: 404 },
        );
      }

      return Response.json(
        {
          message:
            "다른 화면에서 저장된 변경 사항이 있습니다. 현재 작업은 저장되지 않았습니다.",
        },
        { status: 409 },
      );
    }

    return Response.json(
      {
        message: "저장했습니다.",
        documentVersion: expectedVersion + 1,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("작업 공간 저장 실패:", error);

    return Response.json(
      { message: "작업 공간을 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}