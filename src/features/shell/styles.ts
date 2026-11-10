// 화면 공통 컨트롤 스타일 (DESIGN.md "The Quiet Desk").
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep";

/** 한 화면에 하나뿐인 주요 행동 (The One Ink Rule). */
export const primaryButton = `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink-hover ${focusRing} disabled:cursor-not-allowed disabled:opacity-50`;

/** 두 번째 행동: 흰 바탕 + Sage Rule 테두리. */
export const quietButton = `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-rule bg-white px-4 py-2 text-sm text-bark transition-colors hover:bg-mist active:bg-mist-deep ${focusRing} disabled:cursor-not-allowed disabled:opacity-50`;

/** 아이콘만 있는 작은 버튼. */
export const iconButton = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-lichen transition-colors hover:bg-mist hover:text-bark ${focusRing} disabled:cursor-not-allowed disabled:opacity-50`;

export const textInput =
  "block w-full rounded-lg border border-rule bg-white px-3 py-2.5 text-sm text-bark outline-none transition-[border-color,box-shadow] placeholder:text-lichen focus:border-moss-deep focus:ring-2 focus:ring-moss/30 disabled:bg-mist disabled:text-lichen aria-invalid:border-red-600 aria-invalid:focus:ring-red-600/20";

export const textLink = `rounded-sm text-sm text-lichen underline underline-offset-4 hover:text-bark ${focusRing}`;
