import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createWorkspace } from "../src/features/workspace/create-workspace";
import {
  applyPatch,
  buildDocument,
  composePatches,
  diffEntries,
  estimatedSteps,
  flattenDocument,
  isEmptyPatch,
  pathChanges,
  buildTimelapseFrames,
  frameDuration,
} from "../src/features/workspace/timelapse";
import type {
  CanvasNode,
  WorkspaceDocument,
  WorkspaceNode,
} from "../src/features/workspace/types";

const text = (title: string, x = 0, y = 0, extra = {}): WorkspaceNode => ({
  id: randomUUID(),
  type: "text_node",
  position: { x, y },
  width: 100,
  height: 100,
  title,
  text: "",
  ...extra,
});
const stroke = () => ({
  id: randomUUID(),
  color: "moss" as const,
  width: 4 as const,
  points: [0, 0, 10, 10],
});

/** 루트: A(0,0) B(200,0) 연결 A-B, 그룹, 태그, 획 2개, [하위 캔버스(0,300): C] */
function fixture() {
  const a = text("A", 0, 0);
  const b = text("B", 200, 0);
  const c = text("C");
  const subDoc = createWorkspace();
  subDoc.nodes = [c];
  const sub: CanvasNode = {
    id: randomUUID(),
    type: "canvas_node",
    position: { x: 0, y: 300 },
    width: 100,
    height: 100,
    title: "하위",
    document: subDoc,
  };
  const groupId = randomUUID();
  a.groupId = groupId;
  const root: WorkspaceDocument = createWorkspace();
  root.nodes = [b, a, sub];
  root.connections = [
    {
      id: randomUUID(),
      source: { nodeId: a.id, side: "right" },
      target: { nodeId: b.id, side: "left" },
    },
  ];
  root.groups = [{ id: groupId, title: "묶음" }];
  root.tags = [{ id: randomUUID(), name: "태그", color: "moss" }];
  root.drawing = { strokes: [stroke(), stroke()] };
  return { root, a, b, c, sub };
}

const replay = (patches: ReturnType<typeof diffEntries>[]) => {
  const state = new Map<string, unknown>();
  for (const patch of patches) applyPatch(state, patch);
  return buildDocument(state);
};

test("flatten then build returns the same document", () => {
  const { root } = fixture();
  assert.deepEqual(buildDocument(flattenDocument(root)), root);
  const plain = createWorkspace();
  assert.deepEqual(buildDocument(flattenDocument(plain)), plain);
});

test("diff from empty then applied rebuilds the document", () => {
  const { root } = fixture();
  const patch = diffEntries(new Map(), flattenDocument(root));
  assert.deepEqual(replay([patch]), root);
});

test("diff records only what changed and deletions by key", () => {
  const { root, a } = fixture();
  const next = structuredClone(root);
  (next.nodes.find((n) => n.id === a.id) as { text: string }).text = "바뀜";
  next.drawing!.strokes.shift();
  const patch = diffEntries(flattenDocument(root), flattenDocument(next));
  assert.deepEqual(
    patch.set.map(([key]) => key),
    [`node||${a.id}`],
  );
  assert.equal(patch.del.length, 1);
  assert.match(patch.del[0], /^stroke\|\|/);
  assert.deepEqual(
    replay([diffEntries(new Map(), flattenDocument(root)), patch]),
    next,
  );
});

test("an unchanged document gives an empty patch", () => {
  const { root } = fixture();
  const patch = diffEntries(
    flattenDocument(root),
    flattenDocument(structuredClone(root)),
  );
  assert.equal(isEmptyPatch(patch), true);
});

test("composePatches gives the same result as applying both", () => {
  const { root, a } = fixture();
  const first = diffEntries(new Map(), flattenDocument(root));
  const next = structuredClone(root);
  next.nodes = next.nodes.filter((n) => n.id !== a.id);
  next.drawing!.strokes.push(stroke());
  const second = diffEntries(flattenDocument(root), flattenDocument(next));
  assert.deepEqual(replay([composePatches(first, second)]), next);
});

test("estimatedSteps reveals nodes top-left first, then strokes, sub-canvas after its parent", () => {
  const { root, a, b, c, sub } = fixture();
  const steps = estimatedSteps(flattenDocument(root));
  const firstStepWith = (key: string) =>
    steps.findIndex((step) => step.set.some(([k]) => k === key));
  const nodeStep = (id: string, path = "") =>
    firstStepWith(`node|${path}|${id}`);
  assert.ok(nodeStep(a.id) < nodeStep(b.id));
  assert.ok(nodeStep(b.id) < nodeStep(sub.id));
  assert.ok(nodeStep(sub.id) < nodeStep(c.id, sub.id));
  // 연결선은 양 끝 노드가 다 나온 단계에서, 그룹은 첫 멤버와 함께.
  const conn = `conn||${root.connections[0].id}`;
  assert.equal(firstStepWith(conn), nodeStep(b.id));
  assert.equal(firstStepWith(`group||${root.groups![0].id}`), nodeStep(a.id));
  // 획은 노드 다음.
  const strokeStep = firstStepWith(`stroke||${root.drawing!.strokes[0].id}`);
  assert.ok(strokeStep > nodeStep(sub.id));
  // 끝까지 적용하면 원래 문서.
  assert.deepEqual(replay(steps), root);
});

test("estimatedSteps puts strokes in chunks of 20", () => {
  const doc = createWorkspace();
  doc.drawing = { strokes: Array.from({ length: 45 }, stroke) };
  const steps = estimatedSteps(flattenDocument(doc));
  const strokeCounts = steps
    .map((step) => step.set.filter(([k]) => k.startsWith("stroke|")).length)
    .filter(Boolean);
  assert.deepEqual(strokeCounts, [20, 20, 5]);
});

test("pathChanges lists new nodes, changed nodes, new strokes for one canvas only", () => {
  const { root, a, c, sub } = fixture();
  const before = flattenDocument(root);
  const next = structuredClone(root);
  const added = text("새것");
  next.nodes.push(added);
  (next.nodes.find((n) => n.id === a.id) as { title: string }).title = "A2";
  const newStroke = stroke();
  next.drawing!.strokes.push(newStroke);
  const inner = next.nodes.find((n) => n.id === sub.id) as CanvasNode;
  (inner.document.nodes[0] as { title: string }).title = "C2";
  const patch = diffEntries(before, flattenDocument(next));
  const atRoot = pathChanges(before, patch, "");
  assert.deepEqual(atRoot.entered, [added.id]);
  assert.deepEqual(atRoot.changed, [a.id]);
  assert.deepEqual(atRoot.strokes, [newStroke.id]);
  assert.equal(atRoot.touched, true);
  const subChanges = pathChanges(before, patch, sub.id);
  assert.deepEqual(subChanges.changed, [c.id]);
  const other = pathChanges(before, diffEntries(before, before), "");
  assert.equal(other.touched, false);
});

test("stroke order survives a store that sorts object keys (Postgres JSONB)", () => {
  const doc = createWorkspace();
  doc.drawing = { strokes: Array.from({ length: 12 }, stroke) };
  const sortKeys = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(sortKeys)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [
                key,
                sortKeys((value as Record<string, unknown>)[key]),
              ]),
          )
        : value;
  const stored = sortKeys(
    JSON.parse(JSON.stringify(diffEntries(new Map(), flattenDocument(doc)))),
  ) as ReturnType<typeof diffEntries>;
  const rebuilt = replay([stored]);
  assert.deepEqual(
    rebuilt.drawing!.strokes.map((s) => s.id),
    doc.drawing.strokes.map((s) => s.id),
  );
});

test("frames replay baseline as estimated steps, then history, then unsaved edits", () => {
  const { root, a, sub } = fixture();
  const saved = structuredClone(root);
  const added = text("새것", 600, 0);
  saved.nodes.push(added);
  const current = structuredClone(saved);
  current.nodes.find((node) => node.id === a.id)!.title = "고침";
  const rows = [
    { baseline: true, patch: diffEntries(new Map(), flattenDocument(root)) },
    {
      baseline: false,
      patch: diffEntries(flattenDocument(root), flattenDocument(saved)),
    },
  ];
  const { frames, estimatedCount } = buildTimelapseFrames(rows, current, []);

  assert.equal(frames[0].document.nodes.length, 0);
  assert.ok(estimatedCount >= 3);
  assert.ok(frames.slice(1, estimatedCount).every((frame) => frame.estimated));
  const recorded = frames[estimatedCount];
  assert.equal(recorded.estimated, false);
  assert.deepEqual(recorded.entered, [added.id]);
  const last = frames.at(-1)!;
  assert.deepEqual(last.changed, [a.id]);
  assert.deepEqual(
    last.document.nodes.map((node) => node.id),
    current.nodes.map((node) => node.id),
  );
  // 하위 캔버스로 재생하면 그 안의 노드만 보인다.
  const inner = buildTimelapseFrames(rows, current, [sub.id]);
  assert.deepEqual(
    inner.frames.at(-1)!.document.nodes.map((node) => node.title),
    ["C"],
  );
});

test("frames skip steps that only touch another canvas", () => {
  const { root, sub } = fixture();
  const next = structuredClone(root);
  (
    next.nodes.find((node) => node.id === sub.id) as CanvasNode
  ).document.nodes[0].title = "안쪽만";
  const rows = [
    { baseline: false, patch: diffEntries(new Map(), flattenDocument(root)) },
    {
      baseline: false,
      patch: diffEntries(flattenDocument(root), flattenDocument(next)),
    },
  ];
  const { frames, estimatedCount } = buildTimelapseFrames(rows, next, []);
  assert.equal(estimatedCount, 0);
  // 안쪽만 바뀐 둘째 기록은 루트 재생에 장면을 더하지 않는다.
  const firstOnly = buildTimelapseFrames(rows.slice(0, 1), root, []);
  assert.equal(frames.length, firstOnly.frames.length);
  const inner = buildTimelapseFrames(rows, next, [sub.id]).frames;
  assert.equal(inner.length, 3); // 빈 화면 + C 놓기 + C 고침
  assert.deepEqual(inner.at(-1)!.changed, [inner[1].entered[0]]);
});

test("frame duration grows with new strokes", () => {
  const plain = { strokes: [] as string[] };
  const busy = { strokes: Array.from({ length: 10 }, () => "s") };
  assert.equal(frameDuration(plain), 700);
  assert.ok(frameDuration(busy) > 700);
  assert.ok(
    frameDuration({ strokes: Array.from({ length: 500 }, () => "s") }) <= 2000,
  );
});

test("one save that adds several nodes and lines shows each one as its own frame", () => {
  const empty = createWorkspace();
  const next = createWorkspace();
  const [a, b, c] = [text("A", 0, 0), text("B", 300, 0), text("C", 600, 0)];
  next.nodes = [a, b, c];
  const line = (from: WorkspaceNode, to: WorkspaceNode) => ({
    id: randomUUID(),
    source: { nodeId: from.id, side: "right" as const },
    target: { nodeId: to.id, side: "left" as const },
  });
  next.connections = [line(a, b), line(b, c)];
  next.drawing = { strokes: [stroke(), stroke()] };
  const rows = [
    {
      baseline: false,
      patch: diffEntries(flattenDocument(empty), flattenDocument(next)),
    },
  ];
  const { frames } = buildTimelapseFrames(rows, next, []);
  // 빈 화면, A, B, A-B 선, C, B-C 선, 획 묶음
  assert.deepEqual(
    frames.map((frame) => [
      frame.document.nodes.length,
      frame.document.connections.length,
      frame.strokes.length,
    ]),
    [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [2, 1, 0],
      [3, 1, 0],
      [3, 2, 0],
      [3, 2, 2],
    ],
  );
  assert.deepEqual(frames[1].entered, [a.id]);
});

test("every frame uses the final canvas size so nodes never sit outside it", () => {
  const small = createWorkspace();
  const node = text("멀리", 3000, 2000);
  const grown = structuredClone(small);
  grown.nodes = [node];
  grown.canvas = { ...grown.canvas, width: 4000, height: 3000 };
  const rows = [
    {
      baseline: false,
      patch: diffEntries(flattenDocument(small), flattenDocument(grown)),
    },
  ];
  const { frames } = buildTimelapseFrames(rows, grown, []);
  for (const frame of frames)
    assert.deepEqual(frame.document.canvas, grown.canvas);
});
