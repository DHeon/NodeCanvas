// 텍스트 노드 하나의 글 전체에 적용하는 스타일. 값은 이름으로 저장하고,
// 기본값은 저장하지 않아 이전 문서와 같은 모양을 유지한다.
export const TEXT_FONTS = [
  { key: "sans", label: "기본", className: "font-sans" },
  { key: "serif", label: "명조", className: "font-serif" },
  { key: "hand", label: "손글씨", className: "font-hand" },
  { key: "mono", label: "고정폭", className: "font-code" },
] as const;

export const TEXT_SIZES = [
  { key: "sm", label: "작게", className: "text-[13px] leading-5" },
  { key: "md", label: "보통", className: "text-sm leading-6" },
  { key: "lg", label: "크게", className: "text-lg leading-7" },
  { key: "xl", label: "아주 크게", className: "text-2xl leading-8" },
] as const;

export const TEXT_ALIGNS = [
  { key: "left", label: "왼쪽 정렬", className: "text-left" },
  { key: "center", label: "가운데 정렬", className: "text-center" },
  { key: "right", label: "오른쪽 정렬", className: "text-right" },
] as const;

// 흰 노드 위 본문 대비 4.5:1 이상이 되도록 연결선 팔레트보다 한 단계 어둡다.
export const TEXT_COLORS = [
  { key: "bark", label: "기본", value: "#252c26" },
  { key: "moss", label: "이끼색", value: "#4f6234" },
  { key: "teal", label: "청록", value: "#2e6270" },
  { key: "indigo", label: "남색", value: "#44559a" },
  { key: "violet", label: "보라", value: "#6f4b8c" },
  { key: "rose", label: "장미", value: "#a23d63" },
  { key: "rust", label: "주황", value: "#9e522f" },
  { key: "ochre", label: "황토", value: "#7a5d1c" },
] as const;

type Keys<T extends readonly { key: string }[]> = T[number]["key"];
export type TextFont = Keys<typeof TEXT_FONTS>;
export type TextSize = Keys<typeof TEXT_SIZES>;
export type TextAlign = Keys<typeof TEXT_ALIGNS>;
export type TextColor = Keys<typeof TEXT_COLORS>;

export type TextStyle = {
  font?: TextFont;
  size?: TextSize;
  bold?: boolean;
  align?: TextAlign;
  color?: TextColor;
};

export const DEFAULT_TEXT_STYLE = {
  font: "sans",
  size: "md",
  bold: false,
  align: "left",
  color: "bark",
} as const satisfies Required<TextStyle>;

const keysOf = <T extends readonly { key: string }[]>(items: T) =>
  items.map((item) => item.key) as [Keys<T>, ...Keys<T>[]];
export const TEXT_FONT_KEYS = keysOf(TEXT_FONTS);
export const TEXT_SIZE_KEYS = keysOf(TEXT_SIZES);
export const TEXT_ALIGN_KEYS = keysOf(TEXT_ALIGNS);
export const TEXT_COLOR_KEYS = keysOf(TEXT_COLORS);

function find<T extends readonly { key: string }[]>(
  items: T,
  key: string | undefined,
  fallback: string,
): T[number] {
  return (
    items.find((item) => item.key === key) ??
    items.find((item) => item.key === fallback)!
  );
}

/** 저장된 스타일(일부만 있을 수 있음)을 화면에 쓸 클래스·색으로 바꾼다. */
export function resolveTextStyle(style: TextStyle | undefined) {
  return {
    font: find(TEXT_FONTS, style?.font, DEFAULT_TEXT_STYLE.font),
    size: find(TEXT_SIZES, style?.size, DEFAULT_TEXT_STYLE.size),
    align: find(TEXT_ALIGNS, style?.align, DEFAULT_TEXT_STYLE.align),
    color: find(TEXT_COLORS, style?.color, DEFAULT_TEXT_STYLE.color),
    bold: style?.bold ?? DEFAULT_TEXT_STYLE.bold,
  };
}

/** 패치를 적용하고 기본값과 같은 항목은 지운다. 모두 기본이면 undefined. */
export function mergeTextStyle(
  current: TextStyle | undefined,
  patch: TextStyle,
): TextStyle | undefined {
  const next: TextStyle = { ...current, ...patch };
  for (const key of Object.keys(next) as (keyof TextStyle)[])
    if (next[key] === undefined || next[key] === DEFAULT_TEXT_STYLE[key])
      delete next[key];
  return Object.keys(next).length ? next : undefined;
}
