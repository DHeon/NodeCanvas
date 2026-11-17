import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { isQuickPress } from "../src/features/workspace/tag-peek";
import NodeFrame, {
  type NodeFrameProps,
} from "../src/features/workspace/node-frame";

for (const type of ["text_node", "image_node"] as const) {
  test(`${type}: 제목 바가 이동 영역이고 평상시 입력창·이동 손잡이는 없다`, () => {
    const base = {
      id: "node",
      title: "노드 제목",
      position: { x: 100, y: 100 },
      width: 320,
      height: 220,
    };
    const node =
      type === "text_node"
        ? { ...base, type, text: "내용" }
        : { ...base, type, image: null };
    const noop = () => {};
    const props: NodeFrameProps = {
      node,
      selected: false,
      zoom: 1,
      showPorts: false,
      activePort: null,
      onSelect: noop,
      onDragStart: noop,
      onResizeStart: noop,
      onConnectStart: noop,
      onChange: noop,
      onEditStart: noop,
      onEditEnd: noop,
      children: null,
    };
    const html = renderToStaticMarkup(createElement(NodeFrame, props));
    assert.match(html, /data-node-title-bar/);
    assert.match(html, /더블클릭으로 제목 편집/);
    assert.match(html, /노드 제목<\/span>/);
    assert.doesNotMatch(
      html,
      /<input|⠿|aria-label="(?:텍스트|이미지) 노드 이동"/,
    );
    assert.equal((html.match(/data-connection-side=/g) ?? []).length, 4);
    assert.match(html, /노드 크기 조절/);
  });
}

// ---- 태그 점과 검색 표시 상태 ----
function renderFrame(extra: Partial<NodeFrameProps>) {
  const noop = () => {};
  const props: NodeFrameProps = {
    node: {
      id: "node",
      title: "회의 메모",
      position: { x: 0, y: 0 },
      width: 320,
      height: 220,
      type: "text_node",
      text: "",
    },
    selected: false,
    zoom: 1,
    showPorts: false,
    activePort: null,
    onSelect: noop,
    onDragStart: noop,
    onResizeStart: noop,
    onConnectStart: noop,
    onChange: noop,
    onEditStart: noop,
    onEditEnd: noop,
    children: null,
    ...extra,
  };
  return renderToStaticMarkup(createElement(NodeFrame, props));
}

const fourTags = (["UI", "회의", "자료", "버튼"] as const).map(
  (name, index) => ({
    id: `tag-${index}`,
    name,
    color: "moss" as const,
  }),
);

test("태그 4개면 색 점 3개와 +1, 점 묶음은 태그 미리보기를 여는 버튼이다", () => {
  const html = renderFrame({ tags: fourTags });
  assert.equal((html.match(/data-tag-dot/g) ?? []).length, 3);
  assert.match(html, />\+1</);
  // 브라우저 기본 툴팁 대신 미리보기 카드를 쓴다. 머리의 툴팁도 물려받지 않는다.
  assert.doesNotMatch(html, /title="UI, 회의, 자료, 버튼"/);
  assert.match(html, /<button[^>]*data-tag-peek=""[^>]*>/);
  const trigger = html.match(/<button[^>]*data-tag-peek=""[^>]*>/)![0];
  assert.match(trigger, /aria-label="태그 4개: UI, 회의, 자료, 버튼"/);
  assert.match(trigger, /aria-expanded="false"/);
  assert.match(trigger, /title=""/);
  assert.match(
    html,
    /aria-label="텍스트 노드: 회의 메모, 태그: UI, 회의, 자료, 버튼"/,
  );
});

test("태그가 없으면 점이 없다", () => {
  assert.doesNotMatch(renderFrame({}), /data-tag-dot/);
  assert.doesNotMatch(renderFrame({ tags: [] }), /data-tag-dot/);
});

test("검색에 맞지 않는 노드만 흐려진다", () => {
  assert.match(renderFrame({ searchState: "dimmed" }), /opacity-25/);
  assert.doesNotMatch(renderFrame({ searchState: "match" }), /opacity-25/);
  assert.doesNotMatch(renderFrame({}), /opacity-25/);
});

test("강조된 노드는 두 겹 링을 가진다", () => {
  assert.match(renderFrame({ highlighted: true }), /data-search-highlight/);
  assert.doesNotMatch(renderFrame({}), /data-search-highlight/);
});

test("태그 점 묶음은 짧게 누를 때만 미리보기를 연다(꾹 누르기는 열지 않는다)", () => {
  assert.equal(isQuickPress(120), true);
  assert.equal(isQuickPress(349), true);
  assert.equal(isQuickPress(350), false);
  assert.equal(isQuickPress(900), false);
  // 키보드로 누른 클릭은 누른 시간이 없으므로 연다.
  assert.equal(isQuickPress(null), true);
});

const todoNode = (done: boolean): NodeFrameProps["node"] => ({
  id: "node",
  title: "회의 메모",
  position: { x: 0, y: 0 },
  width: 320,
  height: 220,
  type: "text_node",
  text: "",
  role: { kind: "todo", done },
});

test("todo node shows a check button", () => {
  const html = renderFrame({ node: todoNode(false) });
  const button = html.match(/<button[^>]*data-todo-check=""[^>]*>/)?.[0] ?? "";
  assert.match(button, /aria-pressed="false"/);
  assert.match(button, /aria-label="할 일 완료로 표시"/);
  assert.match(html, /aria-label="텍스트 노드: 회의 메모, 할 일"/);
  assert.doesNotMatch(html, /line-through/);
});

test("done todo is struck through", () => {
  const html = renderFrame({ node: todoNode(true) });
  const button = html.match(/<button[^>]*data-todo-check=""[^>]*>/)?.[0] ?? "";
  assert.match(button, /aria-pressed="true"/);
  assert.match(button, /aria-label="할 일 완료 취소"/);
  assert.match(html, /aria-label="텍스트 노드: 회의 메모, 할 일 완료"/);
  assert.match(html, /line-through/);
});

test("no role, no check button", () => {
  assert.doesNotMatch(renderFrame({}), /data-todo-check/);
});
