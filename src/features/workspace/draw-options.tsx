import { CONNECTION_COLORS, type ConnectionColor } from "./connection-colors";
import { STROKE_WIDTHS, type StrokeWidth } from "./drawing";

const WIDTH_LABELS: Record<StrokeWidth, string> = {
  2: "가늘게",
  4: "보통",
  8: "굵게",
};

const optionClass =
  "grid h-8 w-8 cursor-pointer place-items-center rounded-full has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-moss-deep";

/** 펜이 켜졌을 때 도구 막대 옆에 뜨는 색·굵기 선택 칸. */
export default function DrawOptions({
  color,
  width,
  onColor,
  onWidth,
  onReturnToCanvas,
}: {
  color: ConnectionColor;
  width: StrokeWidth;
  onColor: (color: ConnectionColor) => void;
  onWidth: (width: StrokeWidth) => void;
  onReturnToCanvas: () => void;
}) {
  return (
    <div
      // 마우스로 고른 뒤에는 캔버스로 초점을 돌려 Esc·P·E·Ctrl+Z가 바로 듣게 한다.
      // 방향키로 고를 때(detail 0)는 라디오에 초점을 남긴다.
      onClick={(event) => {
        if (event.detail > 0) onReturnToCanvas();
      }}
      className="absolute top-1/2 left-[76px] z-35 flex -translate-y-1/2 flex-col gap-3 rounded-2xl border border-bark/10 bg-white/95 p-3 shadow-float backdrop-blur-[18px]"
    >
      <fieldset>
        <legend className="sr-only">펜 색</legend>
        <div className="grid grid-cols-2 gap-1">
          {CONNECTION_COLORS.map((option) => (
            <label
              key={option.key}
              title={option.label}
              className={optionClass}
            >
              <input
                type="radio"
                name="pen-color"
                value={option.key}
                checked={color === option.key}
                onChange={() => onColor(option.key)}
                aria-label={option.label}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`h-5 w-5 rounded-full ${color === option.key ? "ring-2 ring-bark ring-offset-2 ring-offset-white" : ""}`}
                style={{ backgroundColor: option.value }}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="h-px bg-rule" />
      <fieldset>
        <legend className="sr-only">펜 굵기</legend>
        <div className="flex flex-col items-center gap-1">
          {STROKE_WIDTHS.map((option) => (
            <label
              key={option}
              title={WIDTH_LABELS[option]}
              className={`${optionClass} ${width === option ? "bg-moss-wash" : "hover:bg-bark/6"}`}
            >
              <input
                type="radio"
                name="pen-width"
                value={option}
                checked={width === option}
                onChange={() => onWidth(option)}
                aria-label={WIDTH_LABELS[option]}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="rounded-full bg-bark"
                style={{ width: option + 2, height: option + 2 }}
              />
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
