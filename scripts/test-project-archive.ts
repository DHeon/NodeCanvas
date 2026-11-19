import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { createWorkspace } from "../src/features/workspace/create-workspace";
import {
  ArchiveError,
  archiveFileName,
  buildArchive,
  readArchive,
  referencedImageIds,
  replaceImages,
} from "../src/features/workspace/project-archive";
import type {
  CanvasNode,
  ImageReference,
  WorkspaceDocument,
  WorkspaceNode,
} from "../src/features/workspace/types";

const imageRef = (id = randomUUID()): ImageReference => ({
  id,
  width: 10,
  height: 20,
  byteLength: 3,
});
const base = () => ({
  id: randomUUID(),
  position: { x: 0, y: 0 },
  width: 100,
  height: 100,
  title: "",
});
const imageNode = (image: ImageReference | null): WorkspaceNode => ({
  ...base(),
  type: "image_node",
  image,
});
const canvas = (nodes: WorkspaceNode[]): CanvasNode => {
  const document = createWorkspace();
  document.nodes = nodes;
  return { ...base(), type: "canvas_node", document };
};

/** 루트: 이미지 A, 이미지 A(중복), 빈 이미지, [하위: 이미지 B] */
function fixture() {
  const a = imageRef();
  const b = imageRef();
  const root: WorkspaceDocument = createWorkspace();
  root.nodes = [
    imageNode(a),
    imageNode({ ...a }),
    imageNode(null),
    canvas([imageNode(b)]),
  ];
  return { root, a, b };
}

const manifest = (extra: Record<string, unknown> = {}) =>
  strToU8(
    JSON.stringify({
      format: "nono",
      version: 1,
      title: "t",
      exportedAt: "2026-11-19T00:00:00.000Z",
      ...extra,
    }),
  );

test("referencedImageIds lists each image once at every depth", () => {
  const { root, a, b } = fixture();
  assert.deepEqual(referencedImageIds(root).sort(), [a.id, b.id].sort());
});

test("buildArchive and readArchive round-trip the title, document and images", () => {
  const { root, a, b } = fixture();
  const images = new Map([
    [a.id, new Uint8Array([1, 2, 3])],
    [b.id, new Uint8Array([4, 5, 6])],
  ]);
  const bytes = buildArchive({
    title: "내 프로젝트",
    document: root,
    images,
    exportedAt: "2026-11-19T00:00:00.000Z",
  });
  const read = readArchive(bytes);
  assert.equal(read.title, "내 프로젝트");
  assert.deepEqual(read.document, root);
  assert.deepEqual([...read.images.get(a.id)!], [1, 2, 3]);
  assert.deepEqual([...read.images.get(b.id)!], [4, 5, 6]);
});

test("readArchive rejects a newer version, a missing manifest or document, and non-zip bytes", () => {
  const doc = strToU8(JSON.stringify(createWorkspace()));
  assert.throws(
    () =>
      readArchive(
        zipSync({
          "manifest.json": manifest({ version: 2 }),
          "document.json": doc,
        }),
      ),
    ArchiveError,
  );
  assert.throws(
    () => readArchive(zipSync({ "document.json": doc })),
    ArchiveError,
  );
  assert.throws(
    () => readArchive(zipSync({ "manifest.json": manifest() })),
    ArchiveError,
  );
  assert.throws(() => readArchive(new Uint8Array([1, 2, 3, 4])), ArchiveError);
});

test("readArchive rejects archives that unpack beyond the limit or hold too many entries", () => {
  const doc = strToU8(JSON.stringify(createWorkspace()));
  const big = zipSync({
    "manifest.json": manifest(),
    "document.json": doc,
    "images/x.webp": new Uint8Array(5000),
  });
  assert.throws(
    () => readArchive(big, { unpackedBytes: 4000, entries: 10 }),
    ArchiveError,
  );
  assert.throws(
    () => readArchive(big, { unpackedBytes: 1_000_000, entries: 2 }),
    ArchiveError,
  );
});

test("readArchive ignores files outside images/ and nested paths", () => {
  const read = readArchive(
    zipSync({
      "manifest.json": manifest(),
      "document.json": strToU8(JSON.stringify(createWorkspace())),
      "images/ok.webp": new Uint8Array([1]),
      "images/sub/no.webp": new Uint8Array([2]),
      "../evil.webp": new Uint8Array([3]),
      "other.txt": new Uint8Array([4]),
    }),
  );
  assert.deepEqual([...read.images.keys()], ["ok"]);
});

test("readArchive falls back to an empty title when the manifest has none", () => {
  const read = readArchive(
    zipSync({
      "manifest.json": manifest({ title: undefined }),
      "document.json": strToU8(JSON.stringify(createWorkspace())),
    }),
  );
  assert.equal(read.title, "");
});

test("replaceImages swaps every reference, clears missing ones and keeps the original", () => {
  const { root, a, b } = fixture();
  const newA = imageRef();
  const result = replaceImages(root, new Map([[a.id, newA]]));
  const [first, second, empty, sub] = result.document.nodes;
  assert.deepEqual((first as { image: ImageReference }).image, newA);
  assert.deepEqual((second as { image: ImageReference }).image, newA);
  assert.equal((empty as { image: null }).image, null);
  const inner = (sub as CanvasNode).document.nodes[0] as {
    image: ImageReference | null;
  };
  assert.equal(inner.image, null);
  assert.equal(result.missing, 1);
  // 원본은 그대로.
  assert.equal(
    (
      (root.nodes[3] as CanvasNode).document.nodes[0] as {
        image: ImageReference;
      }
    ).image.id,
    b.id,
  );
});

test("archiveFileName strips forbidden characters and adds .nono", () => {
  assert.equal(archiveFileName("기획: 1/2"), "기획_ 1_2.nono");
  assert.equal(archiveFileName("  "), "nono.nono");
});
