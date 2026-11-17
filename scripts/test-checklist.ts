import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createWorkspace } from "../src/features/workspace/create-workspace";
import type { WorkspaceDocument } from "../src/features/workspace/types";
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
