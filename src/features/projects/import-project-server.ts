import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  ImageUploadError,
  normalizeImage,
} from "@/features/workspace/image-upload-server";
import {
  ArchiveError,
  MAX_ARCHIVE_BYTES,
  readArchive,
  referencedImageIds,
  replaceImages,
} from "@/features/workspace/project-archive";
import type { ImageReference } from "@/features/workspace/types";
import { workspaceDocumentSchema } from "@/features/workspace/workspace-schema";

const MAX_TITLE_LENGTH = 120;

/** 본문을 스트림으로 읽되 .nono 크기 한도를 넘으면 멈춘다(Content-Length만 믿지 않는다). */
export async function readArchiveBody(request: Request): Promise<Uint8Array> {
  const tooBig = () => new ArchiveError("파일은 60MB 이하만 불러올 수 있어요.");
  if (Number(request.headers.get("content-length")) > MAX_ARCHIVE_BYTES)
    throw tooBig();
  if (!request.body) throw new ArchiveError("파일이 비어 있어요.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_ARCHIVE_BYTES) {
      await reader.cancel();
      throw tooBig();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** 제목: 파일 속 제목, 없으면 파일 이름(확장자 뺀 것), 그것도 없으면 기본 이름. */
function importTitle(fromArchive: string, fileName: string) {
  const fallback = fileName.replace(/\.nono$/i, "");
  const title = (fromArchive.trim() || fallback.trim() || "불러온 프로젝트")
    .slice(0, MAX_TITLE_LENGTH)
    .trim();
  return title || "불러온 프로젝트";
}

/**
 * .nono 파일로 새 프로젝트를 만든다. 문서는 저장 때와 같은 스키마로 검사하고, 이미지는
 * 업로드와 같은 처리(형식 확인·webp 재인코딩)를 거쳐 새 ID로 저장한다.
 * 읽을 수 없는 이미지는 그 노드를 빈 이미지로 두고 missingImages로 센다.
 */
export async function importProject(
  ownerId: string,
  bytes: Uint8Array,
  fileName: string,
): Promise<{ projectId: string; missingImages: number }> {
  const archive = readArchive(bytes);
  const parsed = workspaceDocumentSchema.safeParse(archive.document);
  if (!parsed.success)
    throw new ArchiveError("파일 안의 문서 형식이 올바르지 않아요.");

  const assets: {
    id: string;
    data: Uint8Array<ArrayBuffer>;
    width: number;
    height: number;
    byteLength: number;
  }[] = [];
  const replacements = new Map<string, ImageReference>();
  for (const oldId of referencedImageIds(parsed.data)) {
    const source = archive.images.get(oldId);
    if (!source) continue;
    try {
      const image = await normalizeImage(Buffer.from(source));
      const id = randomUUID();
      assets.push({
        id,
        data: new Uint8Array(image.data),
        width: image.width,
        height: image.height,
        byteLength: image.byteLength,
      });
      replacements.set(oldId, {
        id,
        width: image.width,
        height: image.height,
        byteLength: image.byteLength,
      });
    } catch (error) {
      // 깨진 이미지 하나 때문에 프로젝트 전체를 버리지 않는다.
      if (!(error instanceof ImageUploadError)) throw error;
    }
  }
  const { document, missing } = replaceImages(parsed.data, replacements);

  const projectId = randomUUID();
  await prisma.$transaction(
    async (tx) => {
      await tx.project.create({
        data: {
          id: projectId,
          title: importTitle(archive.title, fileName),
          ownerId,
          document,
        },
      });
      for (const asset of assets)
        await tx.imageAsset.create({ data: { ...asset, projectId } });
    },
    { timeout: 60_000 },
  );
  return { projectId, missingImages: missing };
}
