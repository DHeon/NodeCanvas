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
