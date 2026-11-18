import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createWorkspace } from "../src/features/workspace/create-workspace";
import {
  makeClip,
  pasteClip,
  selectedGroupIds,
} from "../src/features/workspace/node-clipboard";
import type {
  WorkspaceDocument,
  WorkspaceNode,
} from "../src/features/workspace/types";
import { resolveWorkspacePath } from "../src/features/workspace/workspace-tree";
import { workspaceDocumentSchema } from "../src/features/workspace/workspace-schema";

type Loose = Record<string, unknown>;

const textNode = (x: number, y: number, extra: Loose = {}) =>
  ({
    id: randomUUID(),
    type: "text_node",
    position: { x, y },
    width: 200,
    height: 100,
    title: "",
    text: "",
    ...extra,
  }) as unknown as WorkspaceNode;

function docWith(
  nodes: WorkspaceNode[],
  groups?: Loose[],
  extra: Loose = {},
): WorkspaceDocument {
  const document = createWorkspace() as WorkspaceDocument & Loose;
  document.nodes = nodes;
  if (groups) document.groups = groups as never;
  return { ...document, ...extra } as WorkspaceDocument;
}

const canvasNode = (x: number, y: number, inner: WorkspaceDocument) =>
  ({
    id: randomUUID(),
    type: "canvas_node",
    position: { x, y },
    width: 260,
    height: 140,
    title: "하위",
    document: inner,
  }) as unknown as WorkspaceNode;

function fixture() {
  const g = randomUUID();
  const h = randomUUID();
  const a = textNode(100, 100, { groupId: g, title: "가나" });
  const b = textNode(400, 300, { groupId: g, text: "본문" });
  const c = textNode(900, 100);
  const d = textNode(900, 600, { groupId: h });
  const document = docWith(
    [a, b, c, d],
    [
      { id: g, title: "가" },
      { id: h, title: "나" },
    ],
  );
  document.connections = [
    {
      id: randomUUID(),
      source: { nodeId: a.id, side: "right" },
      target: { nodeId: b.id, side: "left" },
    },
    {
      id: randomUUID(),
      source: { nodeId: b.id, side: "right" },
      target: { nodeId: c.id, side: "left" },
    },
  ];
  return { document, g, h, a, b, c, d };
}

const valid = (document: WorkspaceDocument) => {
  const result = workspaceDocumentSchema.safeParse(document);
  assert.equal(result.success, true, JSON.stringify(result.error?.issues[0]));
};
const byId = (document: WorkspaceDocument, id: string) =>
  document.nodes.find((node) => node.id === id)!;

test("selectedGroupIds needs every member, single-member groups count", () => {
  const { document, g, h, a, b, c, d } = fixture();
  assert.deepEqual(selectedGroupIds(document, [a.id]), []);
  assert.deepEqual(selectedGroupIds(document, [a.id, b.id]), [g]);
  assert.deepEqual(selectedGroupIds(document, [d.id]), [h]);
  assert.deepEqual(selectedGroupIds(document, [a.id, b.id, d.id, c.id]), [
    g,
    h,
  ]);
});

test("makeClip keeps whole groups and drops partial group ids", () => {
  const { document, g, a, b, c } = fixture();
  const whole = makeClip(document, [a.id, b.id, c.id])!;
  assert.deepEqual(whole.groups, [{ id: g, title: "가" }]);
  assert.equal(whole.nodes.find((node) => node.id === a.id)!.groupId, g);
  assert.equal(
    "groupId" in whole.nodes.find((node) => node.id === c.id)!,
    false,
  );
  const partial = makeClip(document, [a.id])!;
  assert.deepEqual(partial.groups, []);
  assert.equal("groupId" in partial.nodes[0], false);
  // 원본 문서는 그대로
  assert.equal(byId(document, a.id).groupId, g);
});

test("makeClip copies only connections inside the selection", () => {
  const { document, a, b } = fixture();
  const clip = makeClip(document, [a.id, b.id])!;
  assert.equal(clip.connections.length, 1);
  assert.equal(clip.connections[0].source.nodeId, a.id);
});

test("makeClip text joins titles and texts top-to-bottom, falls back to 노드 N개", () => {
  const { document, a, b, c } = fixture();
  assert.equal(makeClip(document, [b.id, a.id])!.text, "가나\n\n본문");
  assert.equal(makeClip(document, [c.id])!.text, "노드 1개");
  assert.equal(makeClip(document, [a.id])!.systemSynced, true);
});

test("makeClip returns null when nothing matches", () => {
  const { document } = fixture();
  assert.equal(makeClip(document, []), null);
  assert.equal(makeClip(document, ["없음"]), null);
});

test("pasteClip centers the clip on the point and selects new ids", () => {
  const { document, a, b } = fixture();
  const infinite = {
    ...document,
    canvas: { ...document.canvas, infinite: true },
  };
  const clip = makeClip(infinite, [a.id, b.id])!;
  const result = pasteClip(infinite, [], clip, { x: 1000, y: 1000 });
  assert.ok("document" in result);
  assert.equal(result.nodeIds.length, 2);
  assert.ok(!result.nodeIds.includes(a.id) && !result.nodeIds.includes(b.id));
  // 경계 (100,100)-(600,400), 가운데 (350,250) → +650,+750
  assert.deepEqual(byId(result.document, result.nodeIds[0]).position, {
    x: 750,
    y: 850,
  });
  assert.equal(result.document.nodes.length, document.nodes.length + 2);
  assert.equal(result.document.connections.length, 3);
  valid(result.document);
});

test("pasteClip pushes the clip inside a finite canvas", () => {
  const { document, a, b } = fixture();
  const finite = {
    ...document,
    canvas: { ...document.canvas, width: 2000, height: 1200, infinite: false },
  };
  const clip = makeClip(finite, [a.id, b.id])!;
  const result = pasteClip(finite, [], clip, { x: 1990, y: 1190 });
  assert.ok("document" in result);
  for (const id of result.nodeIds) {
    const node = byId(result.document, id);
    assert.ok(node.position.x >= 0 && node.position.x + node.width <= 2000);
    assert.ok(node.position.y >= 0 && node.position.y + node.height <= 1200);
  }
  // 묶음 안 배치는 유지
  const [first, second] = result.nodeIds.map((id) => byId(result.document, id));
  assert.equal(second.position.x - first.position.x, 300);
});

test("pasteClip makes a new group with the same title for whole groups", () => {
  const { document, g, a, b } = fixture();
  const clip = makeClip(document, [a.id, b.id])!;
  const result = pasteClip(document, [], clip, { x: 1500, y: 900 });
  assert.ok("document" in result);
  const groups = result.document.groups!;
  assert.equal(groups.length, 3);
  const made = groups.at(-1)!;
  assert.notEqual(made.id, g);
  assert.equal(made.title, "가");
  for (const id of result.nodeIds)
    assert.equal(byId(result.document, id).groupId, made.id);
  valid(result.document);
});

test("pasteClip loose nodes join the group under the point, whole groups do not", () => {
  const { document, g, h, a, b, c } = fixture();
  // g 영역 (68,68)-(632,432) 안
  const loose = pasteClip(document, [], makeClip(document, [c.id])!, {
    x: 300,
    y: 250,
  });
  assert.ok("document" in loose);
  assert.equal(byId(loose.document, loose.nodeIds[0]).groupId, g);
  valid(loose.document);
  // h 영역 (868,568)-(1132,732) 안
  const whole = pasteClip(document, [], makeClip(document, [a.id, b.id])!, {
    x: 1000,
    y: 650,
  });
  assert.ok("document" in whole);
  const groupId = byId(whole.document, whole.nodeIds[0]).groupId;
  assert.ok(groupId && groupId !== h && groupId !== g);
});

test("pasteClip twice gives fresh ids everywhere and passes the schema", () => {
  const inner = docWith([textNode(0, 0), textNode(300, 0)]);
  inner.connections = [
    {
      id: randomUUID(),
      source: { nodeId: inner.nodes[0].id, side: "right" },
      target: { nodeId: inner.nodes[1].id, side: "left" },
    },
  ];
  const sub = canvasNode(100, 100, inner);
  const document = docWith([sub]);
  const clip = makeClip(document, [sub.id])!;
  const once = pasteClip(document, [], clip, { x: 800, y: 800 });
  assert.ok("document" in once);
  const twice = pasteClip(once.document, [], clip, { x: 1200, y: 800 });
  assert.ok("document" in twice);
  valid(twice.document);
  assert.equal(twice.document.nodes.length, 3);
});

test("pasteClip refuses past the node, group and depth limits", () => {
  const many = docWith(
    Array.from({ length: 1000 }, (_, index) => textNode(index, 0)),
  );
  const nodeClip = makeClip(many, [many.nodes[0].id])!;
  assert.deepEqual(pasteClip(many, [], nodeClip, { x: 0, y: 0 }), {
    error: "nodes",
  });

  const groups = Array.from({ length: 200 }, (_, index) => ({
    id: randomUUID(),
    title: `그룹 ${index}`,
  }));
  const full = docWith(
    groups.map((group, index) =>
      textNode(index * 10, 0, { groupId: group.id }),
    ),
    groups,
  );
  const groupClip = makeClip(full, [full.nodes[0].id])!;
  assert.equal(groupClip.groups.length, 1);
  assert.deepEqual(pasteClip(full, [], groupClip, { x: 0, y: 3000 }), {
    error: "groups",
  });

  // 깊이 7 공간을 만든다.
  let deepest = docWith([textNode(0, 0)]);
  const path: string[] = [];
  let root = deepest;
  for (let depth = 0; depth < 7; depth++) {
    const node = canvasNode(0, 0, root);
    path.unshift(node.id);
    root = docWith([node]);
  }
  deepest = resolveWorkspacePath(root, path).document;
  assert.equal(path.length, 7);
  const nested = docWith([
    canvasNode(0, 0, docWith([canvasNode(0, 0, docWith([]))])),
  ]);
  assert.deepEqual(
    pasteClip(root, path, makeClip(nested, [nested.nodes[0].id])!, {
      x: 0,
      y: 0,
    }),
    { error: "depth" },
  );
  const single = docWith([canvasNode(0, 0, docWith([]))]);
  const ok = pasteClip(root, path, makeClip(single, [single.nodes[0].id])!, {
    x: 0,
    y: 0,
  });
  assert.ok("document" in ok);
  valid(ok.document);
  assert.ok(deepest);
});

test("pasteClip into a sub canvas", () => {
  const sub = canvasNode(100, 100, docWith([]));
  const loose = textNode(600, 100);
  const document = docWith([sub, loose]);
  const result = pasteClip(
    document,
    [sub.id],
    makeClip(document, [loose.id])!,
    {
      x: 50,
      y: 50,
    },
  );
  assert.ok("document" in result);
  assert.equal(result.document.nodes.length, 2);
  assert.equal(
    resolveWorkspacePath(result.document, [sub.id]).document.nodes.length,
    1,
  );
  valid(result.document);
});
