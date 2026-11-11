import {
  CONNECTION_COLOR_KEYS,
  DEFAULT_CONNECTION_COLOR,
  type ConnectionColor,
} from "./connection-colors";
import { STROKE_WIDTHS, type StrokeWidth } from "./drawing";

// 마지막으로 고른 펜 색·굵기는 이 브라우저에만 기억한다(문서와 무관한 편의 설정).
const PEN_STORAGE_KEY = "nono:pen";

export type PenSettings = { color: ConnectionColor; width: StrokeWidth };

export function readPenSettings(): PenSettings {
  const fallback: PenSettings = { color: DEFAULT_CONNECTION_COLOR, width: 4 };
  if (typeof window === "undefined") return fallback;
  try {
    const saved = JSON.parse(localStorage.getItem(PEN_STORAGE_KEY) ?? "null");
    return {
      color: CONNECTION_COLOR_KEYS.includes(saved?.color)
        ? saved.color
        : fallback.color,
      width: STROKE_WIDTHS.includes(saved?.width)
        ? saved.width
        : fallback.width,
    };
  } catch {
    return fallback;
  }
}

export function writePenSettings(settings: PenSettings) {
  try {
    localStorage.setItem(PEN_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 저장소를 쓸 수 없어도 이번 화면에서는 고른 값으로 그린다.
  }
}
