import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createWorkspace } from "../src/features/workspace/create-workspace";
import {
  canJoinByDrag,
  groupAtPoint,
  groupBounds,
  groupNodes,
  joinGroup,
  renameGroup,
  ungroupNodes,
  visibleGroups,
} from "../src/features/workspace/groups";
import type {
  WorkspaceDocument,
  WorkspaceNode,
} from "../src/features/workspace/types";
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

// ── Task 2: 그룹 순수 함수 ──
function fixture() {
  const g = randomUUID();
  const h = randomUUID();
  const a = textNode(100, 100, { groupId: g }) as unknown as WorkspaceNode;
  const b = textNode(400, 300, { groupId: g }) as unknown as WorkspaceNode;
  const c = textNode(900, 100) as unknown as WorkspaceNode;
  const d = textNode(900, 600, { groupId: h }) as unknown as WorkspaceNode;
  const document = docWith([a, b, c, d] as unknown as Loose[], [
    { id: g, title: "가" },
    { id: h, title: "나" },
  ]);
  return { document, g, h, a, b, c, d };
}
const node = (document: WorkspaceDocument, id: string) =>
  document.nodes.find((candidate) => candidate.id === id)!;
const valid = (document: WorkspaceDocument) => assert.equal(ok(document), true);

test("groupBounds adds 32 padding around members", () => {
  const { document, g } = fixture();
  // a(100,100,200x100) ∪ b(400,300,200x100) = (100,100)-(600,400)
  assert.deepEqual(groupBounds(document, g), {
    x: 68,
    y: 68,
    width: 564,
    height: 364,
  });
});

test("groupBounds is null without members", () => {
  const document = docWith(
    [textNode(0, 0)],
    [{ id: randomUUID(), title: "빈" }],
  );
  assert.equal(groupBounds(document, document.groups![0].id), null);
});

test("visibleGroups skips empty", () => {
  const { document, g, h } = fixture();
  const withEmpty = {
    ...document,
    groups: [...document.groups!, { id: randomUUID(), title: "빈" }],
  };
  assert.deepEqual(
    visibleGroups(withEmpty).map((entry) => entry.group.id),
    [g, h],
  );
});

test("groupAtPoint prefers the later group", () => {
  const { document, g, h, d } = fixture();
  // d를 g 영역 안으로 옮겨 두 그룹을 겹치게 한다.
  const overlapped = {
    ...document,
    nodes: document.nodes.map((candidate) =>
      candidate.id === d.id
        ? { ...candidate, position: { x: 300, y: 150 } }
        : candidate,
    ),
  };
  assert.equal(groupAtPoint(overlapped, { x: 350, y: 200 }), h);
  assert.equal(groupAtPoint(overlapped, { x: 120, y: 380 }), g);
});

test("groupAtPoint ignores points outside", () => {
  const { document } = fixture();
  assert.equal(groupAtPoint(document, { x: 1500, y: 1500 }), null);
});

test("canJoinByDrag false when any dragged node is grouped", () => {
  const { a, c } = fixture();
  assert.equal(canJoinByDrag([c]), true);
  assert.equal(canJoinByDrag([a, c]), false);
  assert.equal(canJoinByDrag([a]), false);
  assert.equal(canJoinByDrag([]), false);
});

test("groupNodes moves nodes from other group and prunes the emptied one", () => {
  const { document, h, c, d } = fixture();
  const result = groupNodes(document, [], [c.id, d.id], () => "new-group");
  assert.ok("document" in result);
  assert.equal(result.groupId, "new-group");
  // h는 d만 멤버였으므로 사라진다. 새 그룹은 nodes가 uuid가 아니어서 스키마 대신 직접 확인.
  assert.deepEqual(
    result.document.groups!.map((group) => group.id),
    [document.groups![0].id, "new-group"],
  );
  assert.equal(result.document.groups!.at(-1)!.title, "그룹");
  assert.equal(node(result.document, c.id).groupId, "new-group");
  assert.equal(node(result.document, d.id).groupId, "new-group");
  assert.ok(!result.document.groups!.some((group) => group.id === h));
});

test("groupNodes result passes the schema", () => {
  const { document, c } = fixture();
  const result = groupNodes(document, [], [c.id], randomUUID);
  assert.ok("document" in result);
  valid(result.document);
});

test("groupNodes refuses the 201st group", () => {
  // 멤버가 있는 그룹 200개(빈 그룹은 정리되므로 한도에 들지 않는다).
  const groups = Array.from({ length: 200 }, (_, index) => ({
    id: randomUUID(),
    title: `그룹 ${index}`,
  }));
  const members = groups.map((group, index) =>
    textNode(index * 10, 0, { groupId: group.id }),
  );
  const loose = textNode(0, 500);
  const document = docWith([...members, loose], groups);
  assert.deepEqual(groupNodes(document, [], [loose.id], randomUUID), {
    error: "그룹은 공간마다 200개까지 만들 수 있어요.",
  });
});

test("ungroupNodes removes field and prunes", () => {
  const { document, d, h } = fixture();
  const next = ungroupNodes(document, [], [d.id]);
  assert.equal("groupId" in node(next, d.id), false);
  assert.ok(!next.groups!.some((group) => group.id === h));
  valid(next);
  assert.equal(ungroupNodes(next, [], [d.id]), next);
});

test("ungrouping the last member removes the groups field", () => {
  const document = docWith([textNode(0, 0)]);
  const made = groupNodes(document, [], [document.nodes[0].id], randomUUID);
  assert.ok("document" in made);
  const next = ungroupNodes(made.document, [], [document.nodes[0].id]);
  assert.equal("groups" in next, false);
  valid(next);
});

test("joinGroup only takes ungrouped nodes", () => {
  const { document, g, h, c, d } = fixture();
  const next = joinGroup(document, [], [c.id, d.id], g);
  assert.equal(node(next, c.id).groupId, g);
  assert.equal(node(next, d.id).groupId, h);
  valid(next);
  assert.equal(joinGroup(document, [], [c.id], randomUUID()), document);
});

test("renameGroup trims and falls back to 그룹", () => {
  const { document, g } = fixture();
  const renamed = renameGroup(document, [], g, "  회의 메모  ");
  assert.equal(renamed.groups![0].title, "회의 메모");
  assert.equal(renameGroup(document, [], g, "   ").groups![0].title, "그룹");
  assert.equal(
    renameGroup(document, [], g, "가".repeat(50)).groups![0].title.length,
    40,
  );
  valid(renamed);
});
