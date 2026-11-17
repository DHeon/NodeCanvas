import assert from "node:assert/strict";
import test from "node:test";
import {
  focusAfterRemoval,
  spaceBelongsToControl,
  startsTitleEdit,
  wheelStaysInRegion,
} from "../src/features/workspace/keyboard-targets";

/** closest(selector)만 흉내 낸 요소. matches는 이 요소와 조상이 맞는 선택자 조각들. */
class FakeElement {
  constructor(
    private matches: Record<string, FakeElement | true> = {},
    public scrollHeight = 0,
    public clientHeight = 0,
  ) {}
  closest(selector: string) {
    for (const part of selector.split(",").map((value) => value.trim())) {
      const hit = this.matches[part];
      if (hit) return hit === true ? this : hit;
    }
    return null;
  }
}
const el = (...parts: string[]) =>
  new FakeElement(Object.fromEntries(parts.map((part) => [part, true])));

test("Space: 노드 안의 키보드 컨트롤(체크 버튼·체크 상자)은 스페이스를 받는다", () => {
  assert.equal(
    spaceBelongsToControl(
      el("button", "[data-node-id]", "[data-keyboard-control]") as never,
    ),
    true,
  );
  assert.equal(
    spaceBelongsToControl(
      el(
        "[role='checkbox']",
        "[data-node-id]",
        "[data-keyboard-control]",
      ) as never,
    ),
    true,
  );
});

test("Space: 노드 안의 포인터 전용 버튼은 화면 이동을 시작한다", () => {
  assert.equal(
    spaceBelongsToControl(el("button", "[data-node-id]") as never),
    false,
  );
});

test("Space: 노드 밖 버튼과 입력칸은 그대로 스페이스를 받는다", () => {
  assert.equal(spaceBelongsToControl(el("button") as never), true);
  assert.equal(spaceBelongsToControl(el("textarea") as never), true);
  assert.equal(spaceBelongsToControl(el() as never), false);
  assert.equal(spaceBelongsToControl(null), false);
});

test("제목 편집 단축키는 머리 자신에서 눌렀을 때만", () => {
  const header = {};
  assert.equal(
    startsTitleEdit(
      { key: "Enter", target: header, currentTarget: header },
      false,
    ),
    true,
  );
  assert.equal(
    startsTitleEdit(
      { key: "F2", target: header, currentTarget: header },
      false,
    ),
    true,
  );
  // 머리 안의 체크 버튼에서 누른 Enter는 버튼이 받는다.
  assert.equal(
    startsTitleEdit({ key: "Enter", target: {}, currentTarget: header }, false),
    false,
  );
  assert.equal(
    startsTitleEdit(
      { key: "Enter", target: header, currentTarget: header },
      true,
    ),
    false,
  );
});

test("휠: 스크롤할 게 있는 목록에서만 목록이 받는다", () => {
  const region = new FakeElement({}, 500, 200);
  const inList = new FakeElement({ "[data-scroll-region]": region });
  assert.equal(wheelStaysInRegion(inList as never), true);
  const shortRegion = new FakeElement({}, 200, 200);
  const inShort = new FakeElement({ "[data-scroll-region]": shortRegion });
  assert.equal(wheelStaysInRegion(inShort as never), false);
  assert.equal(wheelStaysInRegion(el("textarea") as never), true);
  assert.equal(wheelStaysInRegion(el("[data-search-panel]") as never), true);
  assert.equal(wheelStaysInRegion(el() as never), false);
});

test("항목을 지운 뒤 포커스는 다음 항목, 없으면 앞 항목, 없으면 추가 입력칸", () => {
  assert.equal(focusAfterRemoval(["a", "b", "c"], "b"), "c");
  assert.equal(focusAfterRemoval(["a", "b", "c"], "c"), "b");
  assert.equal(focusAfterRemoval(["a"], "a"), null);
  assert.equal(focusAfterRemoval(["a", "b"], "x"), null);
});
