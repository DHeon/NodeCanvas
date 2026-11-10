import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createWorkspace } from "../src/features/workspace/create-workspace";
import {
  mergeTextStyle,
  resolveTextStyle,
} from "../src/features/workspace/text-style";
import type { TextNode } from "../src/features/workspace/types";
import { workspaceDocumentSchema } from "../src/features/workspace/workspace-schema";

function textNode(extra: Partial<TextNode> = {}): TextNode {
  return {
    id: randomUUID(),
    type: "text_node",
    position: { x: 10, y: 10 },
    width: 320,
    height: 220,
    title: "",
    text: "메모",
    ...extra,
  };
}

test("텍스트 스타일은 저장·조회로 왕복하고, 스타일 없는 이전 노드도 열린다", () => {
  const document = createWorkspace();
  document.nodes = [
    textNode(),
    textNode({
      textStyle: {
        font: "serif",
        size: "xl",
        bold: true,
        align: "center",
        color: "rose",
      },
    }),
  ];
  assert.deepEqual(workspaceDocumentSchema.parse(document), document);
});

test("모르는 글꼴·색·추가 항목은 거절한다", () => {
  for (const textStyle of [
    { font: "comic" },
    { color: "#ff0000" },
    { size: "huge" },
    { italic: true },
  ]) {
    const document = createWorkspace();
    document.nodes = [textNode({ textStyle: textStyle as never })];
    assert.equal(
      workspaceDocumentSchema.safeParse(document).success,
      false,
      JSON.stringify(textStyle),
    );
  }
});

test("기본값은 저장하지 않고, 모두 기본이면 스타일 자체를 지운다", () => {
  assert.deepEqual(mergeTextStyle(undefined, { font: "hand" }), {
    font: "hand",
  });
  assert.deepEqual(
    mergeTextStyle({ font: "hand", bold: true }, { bold: false }),
    { font: "hand" },
  );
  assert.equal(mergeTextStyle({ font: "hand" }, { font: "sans" }), undefined);
});

test("저장된 값이 없거나 일부만 있으면 나머지는 기본 모양으로 그린다", () => {
  const plain = resolveTextStyle(undefined);
  assert.equal(plain.font.key, "sans");
  assert.equal(plain.size.className, "text-sm leading-6");
  assert.equal(plain.color.value, "#252c26");
  assert.equal(plain.bold, false);
  const partial = resolveTextStyle({ size: "lg" });
  assert.equal(partial.size.key, "lg");
  assert.equal(partial.align.key, "left");
});
