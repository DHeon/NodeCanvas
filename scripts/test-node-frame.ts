import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

test("태그 4개면 색 점 3개와 +1, 이름은 툴팁과 aria-label에", () => {
  const html = renderFrame({ tags: fourTags });
  assert.equal((html.match(/data-tag-dot/g) ?? []).length, 3);
  assert.match(html, />\+1</);
  assert.match(html, /title="UI, 회의, 자료, 버튼"/);
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
