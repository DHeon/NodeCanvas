import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { chooseTagToSubmit } from "../src/features/workspace/tag-input";
import { createWorkspace } from "../src/features/workspace/create-workspace";
import type {
  TagDefinition,
  TextNode,
  WorkspaceDocument,
} from "../src/features/workspace/types";
import { workspaceDocumentSchema } from "../src/features/workspace/workspace-schema";
import {
  attachTag,
  countTagUsage,
  createOrFindTag,
  deleteTag,
  detachTag,
  normalizeTagName,
  pickTagColor,
  recolorTag,
  renameTag,
} from "../src/features/workspace/tags";

function tag(
  name: string,
  color: TagDefinition["color"] = "moss",
): TagDefinition {
  return { id: randomUUID(), name, color };
}

function textNode(tags?: string[]): TextNode {
  return {
    id: randomUUID(),
    type: "text_node",
    position: { x: 10, y: 10 },
    width: 320,
    height: 220,
    title: "",
    text: "",
    ...(tags ? { tags } : {}),
  };
}

/** 루트 노드 하나와 하위 캔버스 안 노드 하나에 태그가 붙은 문서. */
function taggedDocument(): WorkspaceDocument {
  const ui = tag("UI");
  const meeting = tag("회의", "rose");
  const child = createWorkspace();
  child.nodes = [textNode([meeting.id])];
  const root = createWorkspace();
  root.tags = [ui, meeting];
  root.nodes = [
    textNode([ui.id, meeting.id]),
    {
      id: randomUUID(),
      type: "canvas_node",
      position: { x: 400, y: 10 },
      width: 260,
      height: 140,
      title: "하위",
      document: child,
    },
  ];
  return root;
}

const valid = (document: WorkspaceDocument) =>
  workspaceDocumentSchema.safeParse(document).success;

test("round-trips tags registry and node tags", () => {
  const document = taggedDocument();
  assert.deepEqual(workspaceDocumentSchema.parse(document), document);
});

test("opens documents without tags", () => {
  const document = createWorkspace();
  document.nodes = [textNode()];
  assert.deepEqual(workspaceDocumentSchema.parse(document), document);
});

test("rejects tags registry inside sub-canvas", () => {
  const document = taggedDocument();
  const canvas = document.nodes[1];
  assert.equal(canvas.type, "canvas_node");
  if (canvas.type === "canvas_node") canvas.document.tags = [tag("하위태그")];
  assert.equal(valid(document), false);
});

test("rejects node tag id missing from registry", () => {
  const atRoot = taggedDocument();
  atRoot.nodes[0].tags = [randomUUID()];
  assert.equal(valid(atRoot), false);

  const nested = taggedDocument();
  const canvas = nested.nodes[1];
  if (canvas.type === "canvas_node")
    canvas.document.nodes[0].tags = [randomUUID()];
  assert.equal(valid(nested), false);
});

test("rejects duplicate tag names ignoring case", () => {
  const byName = taggedDocument();
  byName.tags!.push(tag("ui"));
  assert.equal(valid(byName), false);

  const byId = taggedDocument();
  byId.tags!.push({ ...byId.tags![0], name: "다른이름" });
  assert.equal(valid(byId), false);
});

test("rejects tag name rules", () => {
  for (const name of ["", "a".repeat(31), "두 단어", "a#b", "#UI"]) {
    const document = taggedDocument();
    document.tags![0] = { ...document.tags![0], name };
    assert.equal(valid(document), false, JSON.stringify(name));
  }
  const ok = taggedDocument();
  ok.tags![0] = { ...ok.tags![0], name: "a".repeat(30) };
  assert.equal(valid(ok), true);
});

test("rejects limits", () => {
  const manyTags = createWorkspace();
  manyTags.tags = Array.from({ length: 201 }, (_, index) => tag(`t${index}`));
  assert.equal(valid(manyTags), false);

  const twenty = Array.from({ length: 21 }, (_, index) => tag(`t${index}`));
  const fullNode = createWorkspace();
  fullNode.tags = twenty;
  fullNode.nodes = [textNode(twenty.map((item) => item.id))];
  assert.equal(valid(fullNode), false);
  fullNode.nodes = [textNode(twenty.slice(0, 20).map((item) => item.id))];
  assert.equal(valid(fullNode), true);

  const repeated = taggedDocument();
  repeated.nodes[0].tags = [repeated.tags![0].id, repeated.tags![0].id];
  assert.equal(valid(repeated), false);
});

function childOf(document: WorkspaceDocument) {
  const canvas = document.nodes[1];
  assert.equal(canvas.type, "canvas_node");
  return canvas.type === "canvas_node" ? canvas : null!;
}

test("normalizeTagName trims and strips leading #", () => {
  assert.equal(normalizeTagName(" #UI "), "UI");
  assert.equal(normalizeTagName("회의"), "회의");
  for (const bad of ["", "   ", "#", "a b", "a#b", "a".repeat(31)])
    assert.equal(normalizeTagName(bad), null, JSON.stringify(bad));
});

test("createOrFindTag reuses case-insensitive match", () => {
  const document = taggedDocument();
  const result = createOrFindTag(document, "ui");
  assert.ok(!("error" in result));
  if ("error" in result) return;
  assert.equal(result.document, document);
  assert.equal(result.tag.id, document.tags![0].id);
});

test("createOrFindTag adds a new tag and stops at the project limit", () => {
  const empty = createWorkspace();
  const created = createOrFindTag(empty, "#아이디어");
  assert.ok(!("error" in created));
  if ("error" in created) return;
  assert.equal(created.tag.name, "아이디어");
  assert.match(created.tag.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(created.document.tags, [created.tag]);
  assert.equal(empty.tags, undefined);

  const full = createWorkspace();
  full.tags = Array.from({ length: 200 }, (_, index) => tag(`t${index}`));
  assert.ok("error" in createOrFindTag(full, "하나더"));
  assert.ok("error" in createOrFindTag(full, "두 단어"));
});

test("pickTagColor picks the least used color in palette order", () => {
  assert.equal(pickTagColor(createWorkspace()), "lichen");
  const one = createWorkspace();
  one.tags = [tag("a", "lichen")];
  assert.equal(pickTagColor(one), "moss");
  const all = createWorkspace();
  all.tags = (
    [
      "lichen",
      "moss",
      "teal",
      "indigo",
      "violet",
      "rose",
      "rust",
      "ochre",
    ] as const
  ).map((color, index) => tag(`c${index}`, color));
  assert.equal(pickTagColor(all), "lichen");
});

test("attachTag skips full nodes and reports them", () => {
  const twenty = Array.from({ length: 21 }, (_, index) => tag(`t${index}`));
  const document = createWorkspace();
  document.tags = twenty;
  const empty = textNode();
  const full = textNode(twenty.slice(0, 20).map((item) => item.id));
  document.nodes = [empty, full];
  const extra = twenty[20].id;

  const partial = attachTag(document, [], [empty.id, full.id], extra);
  assert.equal(partial.skipped, 1);
  assert.deepEqual(partial.document.nodes[0].tags, [extra]);
  assert.equal(partial.document.nodes[1].tags!.length, 20);

  const none = attachTag(document, [], [full.id], extra);
  assert.equal(none.skipped, 1);
  assert.equal(none.document, document);

  // 이미 붙은 노드는 건너뛰지만 가득 찬 것으로 세지 않는다.
  const again = attachTag(partial.document, [], [empty.id], extra);
  assert.equal(again.skipped, 0);
  assert.equal(again.document, partial.document);
});

test("attachTag and detachTag touch only the given canvas path", () => {
  const document = taggedDocument();
  const canvas = childOf(document);
  const inner = canvas.document.nodes[0];
  const ui = document.tags![0].id;

  const attached = attachTag(document, [canvas.id], [inner.id], ui);
  const innerAfter = childOf(attached.document).document.nodes[0];
  assert.deepEqual(innerAfter.tags, [document.tags![1].id, ui]);
  assert.deepEqual(attached.document.nodes[0].tags, document.nodes[0].tags);

  const detached = detachTag(attached.document, [canvas.id], [inner.id], ui);
  const meeting = document.tags![1].id;
  const cleared = detachTag(detached, [canvas.id], [inner.id], meeting);
  const clearedNode = childOf(cleared).document.nodes[0];
  assert.equal("tags" in clearedNode, false);
  assert.ok(workspaceDocumentSchema.safeParse(cleared).success);
});

test("renameTag and recolorTag update the registry only", () => {
  const document = taggedDocument();
  const [ui, meeting] = document.tags!;
  assert.ok("error" in renameTag(document, ui.id, "회의"));
  assert.ok("error" in renameTag(document, ui.id, "두 단어"));
  const renamed = renameTag(document, ui.id, "#화면");
  assert.ok(!("error" in renamed));
  if ("error" in renamed) return;
  assert.equal(renamed.document.tags![0].name, "화면");
  assert.equal(renamed.document.nodes, document.nodes);

  const recolored = recolorTag(document, meeting.id, "teal");
  assert.equal(recolored.tags![1].color, "teal");
  assert.equal(recolorTag(document, meeting.id, "rose"), document);
});

test("deleteTag removes ids at every depth", () => {
  const document = taggedDocument();
  const meeting = document.tags![1].id;
  const deleted = deleteTag(document, meeting);
  assert.deepEqual(
    deleted.tags!.map((item) => item.name),
    ["UI"],
  );
  assert.deepEqual(deleted.nodes[0].tags, [document.tags![0].id]);
  assert.equal("tags" in childOf(deleted).document.nodes[0], false);
  assert.ok(workspaceDocumentSchema.safeParse(deleted).success);

  const last = deleteTag(deleteTag(document, meeting), document.tags![0].id);
  assert.equal("tags" in last, false);
  assert.ok(workspaceDocumentSchema.safeParse(last).success);
});

test("countTagUsage sums nodes at every depth", () => {
  const document = taggedDocument();
  const usage = countTagUsage(document);
  assert.equal(usage.get(document.tags![0].id), 1);
  assert.equal(usage.get(document.tags![1].id), 2);
});

test("tag input Enter submits typed text unless a suggestion was chosen", () => {
  const build = { id: "1", name: "build", color: "moss" as const };
  const gui = { id: "2", name: "GUI", color: "teal" as const };
  // 'ui'를 쳤을 때 'build', 'GUI'가 후보로 떠도 Enter는 입력한 이름을 쓴다.
  assert.equal(chooseTagToSubmit("ui", [build, gui], null), "ui");
  assert.equal(chooseTagToSubmit("ui", [build, gui], 1), "GUI");
  assert.equal(chooseTagToSubmit("ui", [], 3), "ui");
});
