import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createWorkspace } from "../src/features/workspace/create-workspace";
import {
  addChecklistItem,
  buildChecklist,
  editChecklistItem,
  MAX_CHECKLIST_ITEM_LENGTH,
  MAX_CHECKLIST_ITEMS,
  removeChecklistItem,
} from "../src/features/workspace/checklist";
import { duplicateNodes } from "../src/features/workspace/node-clone";
import {
  canHaveRole,
  roleForConnectedNode,
  setRole,
  setTodoDone,
} from "../src/features/workspace/roles";
import type {
  ChecklistNode,
  TextNode,
  WorkspaceDocument,
} from "../src/features/workspace/types";
import { workspaceDocumentSchema } from "../src/features/workspace/workspace-schema";

const base = (title: string, y = 0) => ({
  id: randomUUID(),
  position: { x: 0, y },
  width: 300,
  height: 200,
  title,
});

function schemaDoc(extra: Record<string, unknown> = {}, items: unknown[] = []) {
  const document = createWorkspace() as WorkspaceDocument & {
    nodes: unknown[];
  };
  document.nodes = [
    {
      ...base("할 일"),
      type: "text_node",
      text: "",
      role: { kind: "todo", done: true },
    },
    {
      ...base("체크리스트"),
      type: "checklist_node",
      items: items as never,
      ...extra,
    },
  ];
  return document;
}

const ok = (document: unknown) =>
  workspaceDocumentSchema.safeParse(document).success;

test("schema accepts todo role and checklist with items", () => {
  assert.equal(
    ok(schemaDoc({}, [{ id: randomUUID(), text: "우유 사기", done: false }])),
    true,
  );
});

test("schema rejects role on checklist", () => {
  assert.equal(ok(schemaDoc({ role: { kind: "todo", done: false } })), false);
});

test("schema rejects bad items", () => {
  const item = (text: string, id = randomUUID()) => ({ id, text, done: false });
  assert.equal(
    ok(
      schemaDoc(
        {},
        Array.from({ length: 201 }, (_, index) => item(`항목 ${index}`)),
      ),
    ),
    false,
  );
  assert.equal(ok(schemaDoc({}, [item("")])), false);
  assert.equal(ok(schemaDoc({}, [item("  ")])), false);
  assert.equal(ok(schemaDoc({}, [item("가".repeat(201))])), false);
  const id = randomUUID();
  assert.equal(ok(schemaDoc({}, [item("하나", id), item("둘", id)])), false);
  assert.equal(ok(schemaDoc({}, [item("가".repeat(200))])), true);
});

test("schema rejects unknown role kind", () => {
  const document = schemaDoc();
  (document.nodes[0] as { role: unknown }).role = {
    kind: "question",
    done: false,
  };
  assert.equal(ok(document), false);
});

test("old documents still parse", () => {
  const document = createWorkspace();
  document.nodes = [{ ...base("메모"), type: "text_node", text: "" }];
  assert.equal(ok(document), true);
});

// ── Task 2: 역할·체크리스트 순수 함수 ──
function fixture() {
  const node = (
    title: string,
    y: number,
    extra: Record<string, unknown> = {},
  ) =>
    ({ ...base(title, y), type: "text_node", text: "", ...extra }) as TextNode;
  const checklist = {
    ...base("이번 주", 0),
    type: "checklist_node",
    items: [
      { id: randomUUID(), text: "우유 사기", done: false },
      { id: randomUUID(), text: "택배 찾기", done: true },
    ],
  } as ChecklistNode;
  const a = node("A", 300, { role: { kind: "todo", done: true } });
  const b = node("B", 100, { role: { kind: "todo", done: false } });
  const d = node("D", 200);
  const e = {
    ...base("E", 50),
    type: "checklist_node",
    items: [],
  } as ChecklistNode;
  const line = (
    from: string,
    fromSide: string,
    to: string,
    toSide: string,
  ) => ({
    id: randomUUID(),
    source: { nodeId: from, side: fromSide },
    target: { nodeId: to, side: toSide },
  });
  const document = createWorkspace();
  document.nodes = [checklist, a, b, d, e];
  document.connections = [
    line(checklist.id, "right", a.id, "left"),
    line(a.id, "top", checklist.id, "bottom"),
    line(checklist.id, "right", b.id, "left"),
    line(d.id, "right", checklist.id, "left"),
    line(checklist.id, "top", e.id, "bottom"),
  ] as WorkspaceDocument["connections"];
  return { document, checklist, a, b, d, e };
}

const entryNames = (view: ReturnType<typeof buildChecklist>) =>
  view.entries.map((entry) =>
    entry.kind === "node" ? entry.node.title : entry.item.text,
  );
const find = (document: WorkspaceDocument, id: string) =>
  document.nodes.find((node) => node.id === id)!;
const valid = (document: WorkspaceDocument) =>
  assert.equal(workspaceDocumentSchema.safeParse(document).success, true);

test("buildChecklist lists connected todos by position then items", () => {
  const { document, checklist } = fixture();
  assert.deepEqual(entryNames(buildChecklist(document, checklist.id)), [
    "B",
    "A",
    "우유 사기",
    "택배 찾기",
  ]);
});

test("buildChecklist counts a node once", () => {
  const { document, checklist } = fixture();
  const view = buildChecklist(document, checklist.id);
  assert.equal(view.total, 4);
  assert.equal(view.done, 2);
});

test("buildChecklist reports unassigned nodes but not checklists", () => {
  const { document, checklist, d } = fixture();
  assert.deepEqual(buildChecklist(document, checklist.id).unassignedNodeIds, [
    d.id,
  ]);
});

test("buildChecklist on empty checklist", () => {
  const { document, e } = fixture();
  const view = buildChecklist(document, e.id);
  assert.deepEqual(view.entries, []);
  assert.equal(view.total, 0);
  assert.equal(view.done, 0);
});

test("setRole skips checklist nodes and keeps done", () => {
  const { document, a, checklist, d } = fixture();
  const next = setRole(document, [], [a.id, checklist.id, d.id], "todo");
  assert.equal("role" in find(next, checklist.id), false);
  assert.deepEqual(find(next, d.id).role, { kind: "todo", done: false });
  assert.deepEqual(find(next, a.id).role, { kind: "todo", done: true });
  valid(next);
});

test("setRole null removes role field and no-op returns same document", () => {
  const { document, a, d } = fixture();
  const next = setRole(document, [], [a.id], null);
  assert.equal("role" in find(next, a.id), false);
  assert.equal(setRole(document, [], [d.id], null), document);
});

test("setTodoDone toggles and ignores non-todo", () => {
  const { document, b, d } = fixture();
  const next = setTodoDone(document, [], b.id, true);
  assert.deepEqual(find(next, b.id).role, { kind: "todo", done: true });
  assert.equal(setTodoDone(document, [], d.id, true), document);
});

test("roleForConnectedNode gives todo only when leaving a checklist", () => {
  const { checklist, a } = fixture();
  assert.deepEqual(roleForConnectedNode([checklist], "text_node"), {
    kind: "todo",
    done: false,
  });
  assert.equal(roleForConnectedNode([checklist], "checklist_node"), undefined);
  assert.equal(roleForConnectedNode([a], "text_node"), undefined);
  assert.equal(canHaveRole(checklist), false);
  assert.equal(canHaveRole(a), true);
});

test("addChecklistItem adds trimmed item", () => {
  const { document, e } = fixture();
  const result = addChecklistItem(document, [], e.id, "  빨래  ", () => "id-1");
  assert.ok("document" in result);
  const items = (find(result.document, e.id) as ChecklistNode).items;
  assert.deepEqual(items, [{ id: "id-1", text: "빨래", done: false }]);
});

test("addChecklistItem truncates to 200 chars", () => {
  const { document, e } = fixture();
  const result = addChecklistItem(
    document,
    [],
    e.id,
    "가".repeat(250),
    randomUUID,
  );
  assert.ok("document" in result);
  assert.equal(
    (find(result.document, e.id) as ChecklistNode).items[0].text.length,
    MAX_CHECKLIST_ITEM_LENGTH,
  );
  valid(result.document);
});

test("addChecklistItem ignores blank", () => {
  const { document, e } = fixture();
  const result = addChecklistItem(document, [], e.id, "   ", randomUUID);
  assert.ok("document" in result);
  assert.equal(result.document, document);
});

test("addChecklistItem refuses the 201st", () => {
  const { document, e } = fixture();
  let current = document;
  for (let index = 0; index < MAX_CHECKLIST_ITEMS; index++) {
    const step = addChecklistItem(
      current,
      [],
      e.id,
      `항목 ${index}`,
      randomUUID,
    );
    assert.ok("document" in step);
    current = step.document;
  }
  assert.deepEqual(addChecklistItem(current, [], e.id, "하나 더", randomUUID), {
    error: "항목은 체크리스트마다 200개까지 넣을 수 있어요.",
  });
});

test("editChecklistItem with blank text removes the item", () => {
  const { document, checklist } = fixture();
  const [first] = checklist.items;
  const next = editChecklistItem(document, [], checklist.id, first.id, {
    text: "   ",
  });
  assert.deepEqual(
    (find(next, checklist.id) as ChecklistNode).items.map((item) => item.text),
    ["택배 찾기"],
  );
  valid(next);
});

test("editChecklistItem changes text and toggles done", () => {
  const { document, checklist } = fixture();
  const [first] = checklist.items;
  const next = editChecklistItem(document, [], checklist.id, first.id, {
    text: " 두유 사기 ",
    done: true,
  });
  assert.deepEqual((find(next, checklist.id) as ChecklistNode).items[0], {
    id: first.id,
    text: "두유 사기",
    done: true,
  });
});

test("removeChecklistItem removes by id", () => {
  const { document, checklist } = fixture();
  const next = removeChecklistItem(
    document,
    [],
    checklist.id,
    checklist.items[1].id,
  );
  assert.deepEqual(
    (find(next, checklist.id) as ChecklistNode).items.map((item) => item.text),
    ["우유 사기"],
  );
});

test("duplicateNodes copies the checklist link when todos are copied together", () => {
  const { document, checklist, a } = fixture();
  const copies = duplicateNodes(document, [checklist.id, a.id], 24);
  const next = {
    ...document,
    nodes: [...document.nodes, ...copies.nodes],
    connections: [...document.connections, ...copies.connections],
  };
  const newChecklist = copies.nodes.find(
    (node) => node.type === "checklist_node",
  )!;
  const newA = copies.nodes.find((node) => node.title === "A")!;
  const view = buildChecklist(next, newChecklist.id);
  assert.deepEqual(
    view.entries.flatMap((entry) =>
      entry.kind === "node" ? [entry.node.id] : [],
    ),
    [newA.id],
  );
});
