import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createWorkspace } from "../src/features/workspace/create-workspace";
import type { WorkspaceDocument } from "../src/features/workspace/types";
import { workspaceDocumentSchema } from "../src/features/workspace/workspace-schema";

type Loose = Record<string, unknown>;
const ok = (document: unknown) =>
  workspaceDocumentSchema.safeParse(document).success;

const textNode = (x: number, y: number, extra: Loose = {}) => ({
  id: randomUUID(),
  type: "text_node",
  position: { x, y },
  width: 200,
  height: 100,
  title: "",
  text: "",
  ...extra,
});

function docWith(nodes: Loose[], groups?: Loose[]): WorkspaceDocument {
  const document = createWorkspace() as WorkspaceDocument & Loose;
  document.nodes = nodes as never;
  if (groups) document.groups = groups as never;
  return document;
}

test("schema accepts groups and member groupId", () => {
  const g = randomUUID();
  assert.equal(
    ok(
      docWith(
        [textNode(0, 0, { groupId: g }), textNode(300, 0, { groupId: g })],
        [{ id: g, title: "그룹" }],
      ),
    ),
    true,
  );
});

test("schema allows empty groups", () => {
  assert.equal(
    ok(docWith([textNode(0, 0)], [{ id: randomUUID(), title: "빈 그룹" }])),
    true,
  );
});

test("schema rejects unknown groupId", () => {
  assert.equal(ok(docWith([textNode(0, 0, { groupId: randomUUID() })])), false);
});

test("schema rejects duplicate group ids", () => {
  const g = randomUUID();
  assert.equal(
    ok(
      docWith(
        [textNode(0, 0)],
        [
          { id: g, title: "가" },
          { id: g, title: "나" },
        ],
      ),
    ),
    false,
  );
});

test("schema rejects title over 40 or blank", () => {
  const group = (title: string) => [{ id: randomUUID(), title }];
  assert.equal(ok(docWith([textNode(0, 0)], group("   "))), false);
  assert.equal(ok(docWith([textNode(0, 0)], group("가".repeat(41)))), false);
  assert.equal(ok(docWith([textNode(0, 0)], group("가".repeat(40)))), true);
});

test("schema rejects groupId from another canvas", () => {
  const g = randomUUID();
  const inner = docWith([textNode(0, 0, { groupId: g })]);
  const root = docWith(
    [
      textNode(0, 0, { groupId: g }),
      {
        id: randomUUID(),
        type: "canvas_node",
        position: { x: 400, y: 0 },
        width: 260,
        height: 140,
        title: "하위",
        document: inner,
      },
    ],
    [{ id: g, title: "그룹" }],
  );
  assert.equal(ok(root), false);
});

test("schema rejects 201 groups", () => {
  assert.equal(
    ok(
      docWith(
        [textNode(0, 0)],
        Array.from({ length: 201 }, (_, index) => ({
          id: randomUUID(),
          title: `그룹 ${index}`,
        })),
      ),
    ),
    false,
  );
});

test("old documents still parse", () => {
  assert.equal(ok(docWith([textNode(0, 0)])), true);
});
