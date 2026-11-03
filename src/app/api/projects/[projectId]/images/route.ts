import { z } from "zod";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { appOrigins } from "@/lib/app-origins";
import {
  IMAGE_CONTENT_TYPES,
  ImageUploadError,
  normalizeImage,
  readImageBody,
} from "@/features/workspace/image-upload-server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const session = await getSession();
    if (!session)
      return Response.json(
        { message: "로그인이 필요합니다." },
        { status: 401 },
      );
    const origin = request.headers.get("origin");
    if (!origin || !appOrigins.includes(origin))
      return Response.json(
        { message: "허용되지 않은 요청입니다." },
        { status: 403 },
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
    if (
      !IMAGE_CONTENT_TYPES.includes(
        request.headers
          .get("content-type")
          ?.split(";")[0]
          .trim()
          .toLowerCase() ?? "",
      )
    )
      return Response.json(
        { message: "PNG, JPEG, WebP, GIF 이미지만 사용할 수 있습니다." },
        { status: 415 },
      );
    const image = await normalizeImage(await readImageBody(request));
    const asset = await prisma.imageAsset.create({
      data: { projectId, ...image, data: new Uint8Array(image.data) },
      select: { id: true, width: true, height: true, byteLength: true },
    });
    return Response.json(asset, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ImageUploadError)
      return Response.json(
        { message: error.message },
        { status: error.status },
      );
    console.error("이미지 저장 실패:", error);
    return Response.json(
      { message: "이미지를 저장하지 못했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
