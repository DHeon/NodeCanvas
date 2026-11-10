// 연결선 색은 값이 아니라 이름으로 저장한다. 나중에 테마가 생기면 같은 이름을
// 테마별 실제 색으로 바꿔 보여주면 된다(선마다 고른 색은 그대로 유지된다).
export const CONNECTION_COLORS = [
  { key: "lichen", label: "이끼 회색", value: "#697164" },
  { key: "moss", label: "이끼색", value: "#7a8f52" },
  { key: "teal", label: "청록", value: "#3f7d8c" },
  { key: "indigo", label: "남색", value: "#5b6fb0" },
  { key: "violet", label: "보라", value: "#8a63a8" },
  { key: "rose", label: "장미", value: "#c0567a" },
  { key: "rust", label: "주황", value: "#c4704a" },
  { key: "ochre", label: "황토", value: "#9c7a2e" },
] as const;

export type ConnectionColor = (typeof CONNECTION_COLORS)[number]["key"];

export const DEFAULT_CONNECTION_COLOR: ConnectionColor = "lichen";

export const CONNECTION_COLOR_KEYS = CONNECTION_COLORS.map(
  (color) => color.key,
) as [ConnectionColor, ...ConnectionColor[]];

const byKey = new Map(CONNECTION_COLORS.map((color) => [color.key, color]));

/** 저장된 이름을 화면에 칠할 색으로. 모르는 이름·없는 값은 기본색. */
export function connectionColor(key: string | undefined) {
  return (
    byKey.get(key as ConnectionColor) ?? byKey.get(DEFAULT_CONNECTION_COLOR)!
  );
}
