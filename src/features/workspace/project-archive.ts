import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import type { ImageReference, WorkspaceDocument } from "./types";
import { walkWorkspaceNodes } from "./workspace-tree";

/**
 * .nono 프로젝트 파일(zip): manifest.json · document.json · images/<이미지ID>.webp.
 * 브라우저(내보내기)와 서버(불러오기)가 함께 쓰는 순수 함수만 둔다.
 */
export const ARCHIVE_FORMAT = "nono";
export const ARCHIVE_VERSION = 1;
export const MAX_ARCHIVE_BYTES = 60 * 1024 * 1024;
export const MAX_UNPACKED_BYTES = 200 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 1100;

const IMAGE_ENTRY = /^images\/([^/]+)\.webp$/;

/** 파일이 .nono 형식에 맞지 않을 때. message는 사용자에게 그대로 보여 준다. */
export class ArchiveError extends Error {}

/** 문서(모든 깊이)가 참조하는 이미지 ID들. 중복 없이. */
export function referencedImageIds(document: WorkspaceDocument): string[] {
  const ids = new Set<string>();
  for (const node of walkWorkspaceNodes(document))
    if (node.type === "image_node" && node.image) ids.add(node.image.id);
  return [...ids];
}

/** 프로젝트를 .nono 바이트로 묶는다. 이미지는 이미 압축된 webp라 다시 압축하지 않는다. */
export function buildArchive(input: {
  title: string;
  document: WorkspaceDocument;
  images: Map<string, Uint8Array>;
  exportedAt: string;
}): Uint8Array {
  const files: Zippable = {
    "manifest.json": [
      strToU8(
        JSON.stringify({
          format: ARCHIVE_FORMAT,
          version: ARCHIVE_VERSION,
          title: input.title,
          exportedAt: input.exportedAt,
        }),
      ),
      { level: 6 },
    ],
    "document.json": [strToU8(JSON.stringify(input.document)), { level: 6 }],
  };
  for (const [id, bytes] of input.images)
    files[`images/${id}.webp`] = [bytes, { level: 0 }];
  return zipSync(files);
}

/**
 * .nono 바이트를 푼다. 문서는 검사하지 않은 값(unknown)으로 돌려주니 스키마로 검사해야 한다.
 * 풀기 전 선언 크기와 푼 뒤 실제 크기를 모두 한도와 비교한다(압축 폭탄 방지).
 */
export function readArchive(
  bytes: Uint8Array,
  limits: { unpackedBytes: number; entries: number } = {
    unpackedBytes: MAX_UNPACKED_BYTES,
    entries: MAX_ARCHIVE_ENTRIES,
  },
): { title: string; document: unknown; images: Map<string, Uint8Array> } {
  let entries = 0;
  let declared = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter(file) {
        entries++;
        declared += file.originalSize;
        if (entries > limits.entries)
          throw new ArchiveError("파일 안에 항목이 너무 많아요.");
        if (declared > limits.unpackedBytes)
          throw new ArchiveError("파일을 풀면 너무 커요.");
        return (
          file.name === "manifest.json" ||
          file.name === "document.json" ||
          IMAGE_ENTRY.test(file.name)
        );
      },
    });
  } catch (error) {
    if (error instanceof ArchiveError) throw error;
    throw new ArchiveError("nono 프로젝트 파일이 아니거나 손상됐어요.");
  }
  const actual = Object.values(files).reduce(
    (sum, file) => sum + file.byteLength,
    0,
  );
  if (actual > limits.unpackedBytes)
    throw new ArchiveError("파일을 풀면 너무 커요.");

  const manifest = parseJson(files["manifest.json"]);
  if (
    !manifest ||
    typeof manifest !== "object" ||
    (manifest as { format?: unknown }).format !== ARCHIVE_FORMAT
  )
    throw new ArchiveError("nono 프로젝트 파일이 아니에요.");
  const version = (manifest as { version?: unknown }).version;
  if (version !== ARCHIVE_VERSION)
    throw new ArchiveError(
      typeof version === "number" && version > ARCHIVE_VERSION
        ? "이 앱보다 새 버전에서 만든 파일이에요."
        : "파일 형식 버전을 알 수 없어요.",
    );
  if (!files["document.json"])
    throw new ArchiveError("파일 안에 문서가 없어요.");
  const document = parseJson(files["document.json"]);
  if (document === undefined)
    throw new ArchiveError("파일 안의 문서를 읽을 수 없어요.");

  const images = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(files)) {
    const match = IMAGE_ENTRY.exec(name);
    if (match) images.set(match[1], data);
  }
  const title = (manifest as { title?: unknown }).title;
  return { title: typeof title === "string" ? title : "", document, images };
}

function parseJson(bytes: Uint8Array | undefined): unknown {
  if (!bytes) return undefined;
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    return undefined;
  }
}

/**
 * 이미지 노드의 참조를 새 값으로 바꾼 사본을 돌려준다(모든 깊이).
 * 맵에 없는 이미지는 빈 이미지 노드(image: null)로 두고 missing에 센다.
 */
export function replaceImages(
  document: WorkspaceDocument,
  replacements: Map<string, ImageReference>,
): { document: WorkspaceDocument; missing: number } {
  const copy = structuredClone(document);
  let missing = 0;
  for (const node of walkWorkspaceNodes(copy)) {
    if (node.type !== "image_node" || !node.image) continue;
    const next = replacements.get(node.image.id);
    if (!next) missing++;
    node.image = next ? { ...next } : null;
  }
  return { document: copy, missing };
}

/** 프로젝트 제목으로 내려받을 파일 이름을 만든다. */
export function archiveFileName(title: string): string {
  const safe = title.trim().replace(/[\\/:*?"<>|]+/g, "_");
  return `${safe || "nono"}.nono`;
}
