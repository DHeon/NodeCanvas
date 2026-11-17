import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createWorkspace } from "../src/features/workspace/create-workspace";
import {
  countNestedMatches,
  hasSearchTerms,
  MAX_SEARCH_RESULTS,
  parseSearchQuery,
  searchWorkspace,
} from "../src/features/workspace/search";
import type {
  CanvasNode,
  TagDefinition,
  WorkspaceDocument,
  WorkspaceNode,
} from "../src/features/workspace/types";

const base = (title: string, tags?: string[]) => ({
  id: randomUUID(),
  position: { x: 0, y: 0 },
  width: 100,
  height: 100,
  title,
  ...(tags ? { tags } : {}),
});
const text = (title: string, body = "", tags?: string[]): WorkspaceNode => ({
  ...base(title, tags),
  type: "text_node",
  text: body,
});
const canvas = (title: string, nodes: WorkspaceNode[]): CanvasNode => {
  const document = createWorkspace();
  document.nodes = nodes;
  return { ...base(title), type: "canvas_node", document };
};

/*
 루트: 회의 메모(#디자인) / 링크(위키) / [기획] 캔버스
   기획: 버튼 정리(본문 "UI 버튼") / [깊은] 캔버스
     깊은: 버튼 색 (#내디자인)
*/
function fixture() {
  const design: TagDefinition = {
    id: randomUUID(),
    name: "디자인",
    color: "moss",
  };
  const myDesign: TagDefinition = {
    id: randomUUID(),
    name: "내디자인",
    color: "rose",
  };
  const deepButton = text("버튼 색", "", [myDesign.id]);
  const deep = canvas("깊은", [deepButton]);
  const buttonNote = text("버튼 정리", "UI 버튼 크기");
  const plan = canvas("기획", [buttonNote, deep]);
  const meeting = text("회의 메모", "다음 주까지", [design.id]);
  const link: WorkspaceNode = {
    ...base(""),
    type: "link_node",
    url: "https://ko.wikipedia.org/wiki/x",
    preview: { embeddable: true, title: "마인드맵 버튼" },
  };
  const root: WorkspaceDocument = createWorkspace();
  root.tags = [design, myDesign];
  root.nodes = [meeting, link, plan];
  return { root, meeting, link, plan, buttonNote, deep, deepButton };
}

test("parseSearchQuery splits words and tag prefixes", () => {
  assert.deepEqual(parseSearchQuery("UI #디자인 버튼"), {
    words: ["ui", "버튼"],
    tagPrefixes: ["디자인"],
  });
  assert.deepEqual(parseSearchQuery("  #  "), { words: [], tagPrefixes: [] });
});

test("empty query returns no results", () => {
  const { root } = fixture();
  assert.deepEqual(searchWorkspace(root, "   ", []), {
    results: [],
    matches: [],
    total: 0,
    truncated: false,
  });
});

test("matches all words (AND) ignoring case", () => {
  const { root, buttonNote } = fixture();
  const { results } = searchWorkspace(root, "ui 버튼", []);
  assert.deepEqual(
    results.map((result) => result.node.id),
    [buttonNote.id],
  );
});

test("matches text body, link title and tag name", () => {
  const { root, meeting, link } = fixture();
  assert.deepEqual(
    searchWorkspace(root, "다음", []).results.map((r) => r.node.id),
    [meeting.id],
  );
  assert.ok(
    searchWorkspace(root, "마인드맵", []).results.some(
      (r) => r.node.id === link.id,
    ),
  );
  assert.ok(
    searchWorkspace(root, "wikipedia", []).results.some(
      (r) => r.node.id === link.id,
    ),
  );
});

test("plain words also match tag names as substrings", () => {
  const { root, meeting, deepButton } = fixture();
  assert.deepEqual(
    searchWorkspace(root, "디자인", []).results.map((r) => r.node.id),
    [meeting.id, deepButton.id],
  );
});

test("#prefix matches tags starting with prefix only", () => {
  const { root, meeting, deepButton } = fixture();
  assert.deepEqual(
    searchWorkspace(root, "#디", []).results.map((r) => r.node.id),
    [meeting.id],
  );
  assert.deepEqual(
    searchWorkspace(root, "#내", []).results.map((r) => r.node.id),
    [deepButton.id],
  );
  assert.deepEqual(searchWorkspace(root, "#자인", []).results, []);
});

test("includes sub-canvas results with path and trail, current canvas first", () => {
  const { root, plan, deep, link, buttonNote, deepButton } = fixture();
  const { results } = searchWorkspace(root, "버튼", []);
  assert.deepEqual(
    results.map((r) => r.node.id),
    [link.id, buttonNote.id, deepButton.id],
  );
  assert.deepEqual(results[1].path, [plan.id]);
  assert.deepEqual(results[1].trail, ["기획"]);
  assert.deepEqual(results[2].path, [plan.id, deep.id]);
  assert.deepEqual(results[2].trail, ["기획", "깊은"]);
});

test("anchorId points at the node, its ancestor in the current canvas, or null", () => {
  const { root, plan, deep, buttonNote, deepButton, link } = fixture();
  const fromRoot = searchWorkspace(root, "버튼", []).results;
  assert.equal(fromRoot.find((r) => r.node.id === link.id)!.anchorId, link.id);
  assert.equal(
    fromRoot.find((r) => r.node.id === deepButton.id)!.anchorId,
    plan.id,
  );

  const fromPlan = searchWorkspace(root, "버튼", [plan.id]).results;
  assert.equal(fromPlan[0].node.id, buttonNote.id);
  assert.equal(
    fromPlan.find((r) => r.node.id === deepButton.id)!.anchorId,
    deep.id,
  );
  assert.equal(fromPlan.find((r) => r.node.id === link.id)!.anchorId, null);
});

test("countNestedMatches counts every depth and excludes the canvas node itself", () => {
  const { root, plan } = fixture();
  const results = searchWorkspace(root, "버튼", []).results;
  assert.equal(countNestedMatches(results, []).get(plan.id), 2);

  // 캔버스 노드 자신이 맞아도 배지에 자기 자신은 세지 않는다.
  const titled = searchWorkspace(root, "기획", []).results;
  assert.equal(titled[0].node.id, plan.id);
  assert.equal(countNestedMatches(titled, []).get(plan.id), undefined);
});

test("caps at 100 with truncated", () => {
  const root = createWorkspace();
  root.nodes = Array.from({ length: 120 }, (_, index) => text(`노트 ${index}`));
  const found = searchWorkspace(root, "노트", []);
  assert.equal(MAX_SEARCH_RESULTS, 100);
  assert.equal(found.results.length, 100);
  assert.equal(found.total, 120);
  assert.equal(found.truncated, true);
});

test("hasSearchTerms is false for blank or bare '#' queries", () => {
  assert.equal(hasSearchTerms(""), false);
  assert.equal(hasSearchTerms("  # ## "), false);
  assert.equal(hasSearchTerms("#디"), true);
  assert.equal(hasSearchTerms("버튼"), true);
});

test("matches keeps every hit beyond the 100 cap for dimming and badges", () => {
  const sub = canvas(
    "하위",
    Array.from({ length: 50 }, (_, index) => text(`노트 하위 ${index}`)),
  );
  const root = createWorkspace();
  root.nodes = [
    ...Array.from({ length: 120 }, (_, index) => text(`노트 ${index}`)),
    sub,
  ];
  const found = searchWorkspace(root, "노트", []);
  assert.equal(found.results.length, 100);
  assert.equal(found.matches.length, 170);
  assert.equal(countNestedMatches(found.matches, []).get(sub.id), 50);
  assert.equal(
    new Set(found.matches.map((result) => result.anchorId)).size,
    121,
  );
});

test("results recompute after node removal", () => {
  const { root, meeting } = fixture();
  const removed = { ...root, nodes: root.nodes.filter((n) => n !== meeting) };
  assert.equal(searchWorkspace(removed, "회의", []).results.length, 0);
});

test("checklist item text is searchable", () => {
  const checklist: WorkspaceNode = {
    ...base("이번 주"),
    type: "checklist_node",
    items: [{ id: randomUUID(), text: "우유 사기", done: false }],
  };
  const root = createWorkspace();
  root.nodes = [checklist];
  assert.deepEqual(
    searchWorkspace(root, "우유", []).results.map((result) => result.node.id),
    [checklist.id],
  );
});
