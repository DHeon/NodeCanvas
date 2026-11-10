import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createWorkspace } from "../src/features/workspace/create-workspace";
import { replaceNodeImage } from "../src/features/workspace/node-transform";
import {
  createWorkspaceHistory,
  workspaceHistoryReducer,
} from "../src/features/workspace/workspace-history";
import { workspaceDocumentSchema } from "../src/features/workspace/workspace-schema";
import {
  MAX_CANVAS_DEPTH,
  MAX_WORKSPACE_NODES,
  resolveWorkspacePath,
  updateWorkspaceAtPath,
  walkWorkspaceNodes,
} from "../src/features/workspace/workspace-tree";
import type {
  CanvasNode,
  ImageNode,
  TextNode,
  WorkspaceDocument,
} from "../src/features/workspace/types";

function base(title: string, x = 100) {
  return {
    id: randomUUID(),
    title,
    position: { x, y: 100 },
    width: 260,
    height: 140,
  };
}
function canvas(title: string, document = createWorkspace()): CanvasNode {
  return { ...base(title), type: "canvas_node", document };
}
function text(title: string, x?: number): TextNode {
  return { ...base(title, x), type: "text_node", text: title };
}

function fixture() {
  const root = createWorkspace();
  const outer = canvas("자료");
  const inner = canvas("사진");
  const sibling = canvas("다른 공간");
  root.nodes = [outer, sibling];
  outer.document.nodes = [inner, text("하위 메모", 500)];
  return { root, outer, inner, sibling };
}

test("이전 문서와 여러 하위 공간의 독립 설정·노드·연결선을 읽는다", () => {
  const { root, outer, inner, sibling } = fixture();
  const childText = text("첫 노드", -400);
  const childText2 = text("둘째 노드", 22000);
  inner.document.canvas.infinite = true;
  inner.document.nodes = [childText, childText2];
  inner.document.connections = [
    {
      id: randomUUID(),
      source: { nodeId: childText.id, side: "right" },
      target: { nodeId: childText2.id, side: "left" },
    },
  ];
  const parsed = workspaceDocumentSchema.parse(
    JSON.parse(JSON.stringify(root)),
  );
  assert.deepEqual(parsed, root);
  assert.deepEqual(
    resolveWorkspacePath(parsed, [outer.id, inner.id]).document,
    inner.document,
  );
  assert.deepEqual(
    resolveWorkspacePath(parsed, [sibling.id]).document,
    createWorkspace(),
  );
  assert.deepEqual(
    workspaceDocumentSchema.parse({ canvas: root.canvas, nodes: [] }),
    createWorkspace(),
  );
});

test("다른 공간으로 건너가는 연결과 프로젝트 내 중복 노드 ID를 거절한다", () => {
  const { root, outer, inner, sibling } = fixture();
  outer.document.connections = [
    {
      id: randomUUID(),
      source: { nodeId: inner.id, side: "right" },
      target: { nodeId: sibling.id, side: "left" },
    },
  ];
  assert.equal(workspaceDocumentSchema.safeParse(root).success, false);
  outer.document.connections = [];
  inner.document.nodes = [{ ...text("중복"), id: sibling.id }];
  assert.equal(workspaceDocumentSchema.safeParse(root).success, false);
});

test("최대 깊이까지 허용하고 그보다 깊은 입력은 거절한다", () => {
  const root = createWorkspace();
  let current = root;
  for (let i = 0; i < MAX_CANVAS_DEPTH; i++) {
    const next = canvas("단계 " + i);
    current.nodes = [next];
    current = next.document;
  }
  assert.equal(workspaceDocumentSchema.safeParse(root).success, true);
  current.nodes = [canvas("제한 초과")];
  assert.equal(workspaceDocumentSchema.safeParse(root).success, false);
});

test("노드 수 제한은 각 공간이 아닌 프로젝트 전체에 적용한다", () => {
  const root = createWorkspace();
  const child = canvas("하위");
  root.nodes = [child, ...Array.from({ length: 499 }, () => text("상위"))];
  child.document.nodes = Array.from({ length: 500 }, () => text("하위"));
  assert.equal([...walkWorkspaceNodes(root)].length, MAX_WORKSPACE_NODES);
  assert.equal(workspaceDocumentSchema.safeParse(root).success, true);
  child.document.nodes.push(text("한 개 초과"));
  assert.equal(workspaceDocumentSchema.safeParse(root).success, false);
});

test("중첩 편집은 대상과 조상만 바꾸며 없는 경로에는 아무것도 쓰지 않는다", () => {
  const { root, outer, inner, sibling } = fixture();
  const path = [outer.id, inner.id];
  const newNode = text("새 메모");
  const edited = updateWorkspaceAtPath(root, path, (document) => ({
    ...document,
    nodes: [newNode],
  }));
  assert.equal(edited.nodes[1], sibling);
  assert.deepEqual(resolveWorkspacePath(edited, path).document.nodes, [
    newNode,
  ]);
  assert.deepEqual(inner.document.nodes, []);
  const unknown = [outer.id, randomUUID()];
  assert.equal(resolveWorkspacePath(root, unknown).document, outer.document);
  assert.equal(
    updateWorkspaceAtPath(root, unknown, () => edited),
    root,
  );
  assert.equal(
    updateWorkspaceAtPath(root, path, (document) => document),
    root,
  );
});

test("캔버스 노드 삭제 후 Undo로 하위 문서 전체를 복구한다", () => {
  const { root, outer, inner, sibling } = fixture();
  inner.document.nodes = [text("복구할 내용")];
  const history = workspaceHistoryReducer(createWorkspaceHistory(root), {
    type: "change",
    update: (document) => ({ ...document, nodes: [sibling] }),
  });
  assert.deepEqual(
    resolveWorkspacePath(history.present, [outer.id, inner.id]).trail,
    [],
  );
  const restored = workspaceHistoryReducer(history, { type: "undo" });
  assert.equal(
    resolveWorkspacePath(restored.present, [outer.id, inner.id]).document,
    inner.document,
  );
});

test("이미지 업로드 결과는 이동 여부와 무관하게 원래 경로에만 적용한다", () => {
  const { root, outer, inner, sibling } = fixture();
  const node: ImageNode = {
    ...base("이미지"),
    type: "image_node",
    image: null,
  };
  inner.document.nodes = [node];
  const image = { id: randomUUID(), width: 160, height: 90, byteLength: 200 };
  const apply = (document: WorkspaceDocument) =>
    replaceNodeImage(document, node.id, image);
  const updated = updateWorkspaceAtPath(root, [outer.id, inner.id], apply);
  const updatedNode = resolveWorkspacePath(updated, [outer.id, inner.id])
    .document.nodes[0];
  assert.equal(updatedNode.type, "image_node");
  assert.deepEqual(updatedNode.image, image);
  assert.equal(updated.nodes[1], sibling);
  const removed = { ...root, nodes: [sibling] };
  assert.equal(
    updateWorkspaceAtPath(removed, [outer.id, inner.id], apply),
    removed,
  );
});
