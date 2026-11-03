import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import sharp from "sharp";
import { createWorkspace } from "../src/features/workspace/create-workspace";
import { workspaceDocumentSchema } from "../src/features/workspace/workspace-schema";
import {
  fitNodeSize,
  replaceNodeImage,
  transformNode,
  NODE_HEADER_HEIGHT,
} from "../src/features/workspace/node-transform";
import {
  ImageUploadError,
  MAX_IMAGE_UPLOAD_BYTES,
  normalizeImage,
  readImageBody,
} from "../src/features/workspace/image-upload-server";
import {
  getConnectionPoint,
  findConnectionTarget,
} from "../src/features/workspace/connections";
import {
  createWorkspaceHistory,
  workspaceHistoryReducer,
} from "../src/features/workspace/workspace-history";
import type { ImageNode } from "../src/features/workspace/types";
import { uploadWorkspaceImage } from "../src/features/workspace/use-image-uploads";

function fixture() {
  const document = createWorkspace();
  const image: ImageNode = {
    id: randomUUID(),
    type: "image_node",
    title: "사진",
    position: { x: 100, y: 100 },
    width: 360,
    height: 280,
    image: null,
  };
  document.nodes = [image];
  return document;
}
const reference = () => ({
  id: randomUUID(),
  width: 600,
  height: 1200,
  byteLength: 5000,
});

test("텍스트·빈 이미지·채워진 이미지는 기존 문서 형식과 함께 저장한다", () => {
  const document = fixture();
  assert.ok(workspaceDocumentSchema.safeParse(document).success);
  const filled = replaceNodeImage(document, document.nodes[0].id, reference());
  assert.deepEqual(
    workspaceDocumentSchema.parse(JSON.parse(JSON.stringify(filled))),
    filled,
  );
  const bad = {
    ...filled,
    nodes: [
      {
        ...filled.nodes[0],
        image: { ...reference(), id: "https://external.example/image" },
      },
    ],
  };
  assert.ok(!workspaceDocumentSchema.safeParse(bad).success);
  assert.ok(
    !workspaceDocumentSchema.safeParse({
      ...document,
      nodes: [{ ...document.nodes[0], type: "unknown" }],
    }).success,
  );
});

test("Inspector 좌표·크기는 범위를 제한하고 잘못된 숫자·무변경은 무시한다", () => {
  const document = fixture();
  const id = document.nodes[0].id;
  const moved = transformNode(document, id, { x: -100, y: 99999 });
  assert.deepEqual(moved.nodes[0].position, {
    x: 0,
    y: document.canvas.height - 280,
  });
  const resized = transformNode(document, id, { width: 99999, height: 10 });
  assert.equal(resized.nodes[0].width, document.canvas.width - 100);
  assert.equal(resized.nodes[0].height, 140);
  assert.equal(transformNode(document, id, { x: NaN }), document);
  assert.equal(transformNode(document, id, { width: Infinity }), document);
  assert.equal(transformNode(document, id, { x: 100 }), document);
  assert.equal(transformNode(document, "missing", { x: 500 }), document);
});

test("가로·세로 이미지의 크기 조절은 헤더를 제외한 이미지 비율과 경계를 유지한다", () => {
  for (const ratio of [0.1, 0.5, 1, 2, 10]) {
    const document = fixture();
    const node = {
      ...document.nodes[0],
      type: "image_node" as const,
      image: { ...reference(), width: 1000, height: 1000 / ratio },
    };
    for (const axis of ["width", "height"] as const) {
      for (const size of [1, 200, 600, 10000]) {
        const result = fitNodeSize(node, document.canvas, size, size, axis);
        assert.ok(
          Math.abs(
            result.width / (result.height - NODE_HEADER_HEIGHT) - ratio,
          ) < 0.000001,
        );
        assert.ok(
          node.position.x + result.width <= document.canvas.width + 0.000001,
        );
        assert.ok(
          node.position.y + result.height <= document.canvas.height + 0.000001,
        );
      }
    }
  }
});

test("이미지 교체·제거·Inspector 수정은 Undo/Redo되며 삭제된 노드를 되살리지 않는다", () => {
  const document = fixture();
  const id = document.nodes[0].id;
  const image = reference();
  let history = createWorkspaceHistory(document);
  history = workspaceHistoryReducer(history, {
    type: "change",
    update: (doc) => replaceNodeImage(doc, id, image),
  });
  const filled = history.present;
  history = workspaceHistoryReducer(history, { type: "undo" });
  assert.equal(history.present, document);
  history = workspaceHistoryReducer(history, { type: "redo" });
  assert.equal(history.present, filled);
  history = workspaceHistoryReducer(history, {
    type: "change",
    update: (doc) => transformNode(doc, id, { x: 300 }),
  });
  history = workspaceHistoryReducer(history, { type: "undo" });
  assert.equal(history.present, filled);
  const removed = replaceNodeImage(filled, id, null);
  assert.equal((removed.nodes[0] as ImageNode).image, null);
  assert.equal(
    replaceNodeImage({ ...document, nodes: [] }, id, image).nodes.length,
    0,
  );
});

test("이미지 노드도 같은 연결점 계산과 스냅을 사용한다", () => {
  const document = fixture();
  const node = document.nodes[0];
  const point = getConnectionPoint(node, "left");
  assert.deepEqual(
    findConnectionTarget(
      document.nodes,
      [],
      { nodeId: "another", side: "right" },
      point,
      0.5,
    ),
    { nodeId: node.id, side: "left" },
  );
});

test("이미지는 WebP로 축소하고 세로 비율을 유지하며 메타데이터를 제외한다", async () => {
  const original = await sharp({
    create: { width: 1200, height: 3600, channels: 4, background: "#aabbcc" },
  })
    .png()
    .toBuffer();
  const image = await normalizeImage(original);
  assert.equal(image.height, 2560);
  assert.ok(Math.abs(image.width / image.height - 1 / 3) < 0.001);
  const metadata = await sharp(image.data).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.exif, undefined);
  assert.equal(image.byteLength, image.data.length);
});

test("SVG·위장 파일·손상된 이미지는 거절한다", async () => {
  await assert.rejects(
    normalizeImage(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    ),
    (e) => e instanceof ImageUploadError && e.status === 415,
  );
  await assert.rejects(
    normalizeImage(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])),
    (e) => e instanceof ImageUploadError && e.status === 400,
  );
});

test("업로드 본문은 선언한 크기와 실제 스트림 양쪽을 제한한다", async () => {
  await assert.rejects(
    readImageBody(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-length": String(MAX_IMAGE_UPLOAD_BYTES + 1) },
        body: "x",
      }),
    ),
    (e) => e instanceof ImageUploadError && e.status === 413,
  );
  await assert.rejects(
    readImageBody(
      new Request("http://localhost", {
        method: "POST",
        body: new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1),
      }),
    ),
    (e) => e instanceof ImageUploadError && e.status === 413,
  );
  await assert.rejects(
    readImageBody(
      new Request("http://localhost", { method: "POST", body: "" }),
    ),
    (e) => e instanceof ImageUploadError && e.status === 400,
  );
  assert.equal(
    (
      await readImageBody(
        new Request("http://localhost", { method: "POST", body: "test" }),
      )
    ).toString(),
    "test",
  );
});

test("이미지 클라이언트는 바이너리 파일만 전송하고 응답 참조를 검증한다", async () => {
  const original = globalThis.fetch;
  const image = reference();
  const file = new File([new Uint8Array([1, 2, 3])], "test.png", {
    type: "image/png",
  });
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), "/api/projects/test/images");
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, file);
      assert.deepEqual(init?.headers, { "Content-Type": "image/png" });
      return Response.json(image, { status: 201 });
    };
    assert.deepEqual(await uploadWorkspaceImage("test", file), image);
    globalThis.fetch = async () => Response.json({ id: "invalid" });
    await assert.rejects(uploadWorkspaceImage("test", file));
    globalThis.fetch = async () =>
      Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
    await assert.rejects(uploadWorkspaceImage("test", file), /로그인이 필요/);
    globalThis.fetch = async () => {
      throw new Error("fetch should not run");
    };
    await assert.rejects(
      uploadWorkspaceImage(
        "test",
        new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }),
      ),
      /PNG/,
    );
    await assert.rejects(
      uploadWorkspaceImage(
        "test",
        new File([], "empty.png", { type: "image/png" }),
      ),
      /10MB/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
