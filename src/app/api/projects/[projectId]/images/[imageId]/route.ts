import { z } from "zod";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; imageId: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return new Response(null, { status: 401 });
    const { projectId, imageId } = await params;
    if (
      !z.uuid().safeParse(projectId).success ||
      !z.uuid().safeParse(imageId).success
    )
      return new Response(null, { status: 400 });
    const asset = await prisma.imageAsset.findFirst({
      where: { id: imageId, projectId, project: { ownerId: session.user.id } },
      select: { data: true },
    });
    if (!asset) return new Response(null, { status: 404 });
    return new Response(Uint8Array.from(asset.data), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(asset.data.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": 'inline; filename="image.webp"',
      },
    });
  } catch (error) {
    console.error("이미지 조회 실패:", error);
    return new Response(null, { status: 500 });
  }
}
