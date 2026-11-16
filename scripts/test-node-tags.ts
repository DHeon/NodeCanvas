import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createWorkspace } from "../src/features/workspace/create-workspace";
import type {
  TagDefinition,
  TextNode,
  WorkspaceDocument,
} from "../src/features/workspace/types";
import { workspaceDocumentSchema } from "../src/features/workspace/workspace-schema";

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
