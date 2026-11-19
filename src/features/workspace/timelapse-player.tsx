import { useEffect, useRef, useState } from "react";
import { CloseIcon, PauseIcon, PlayIcon } from "./icons";
import { frameDuration, type TimelapseFrame } from "./timelapse";

export type TimelapseState =
  | { status: "loading" }
  | { status: "ready"; frames: TimelapseFrame[]; estimatedCount: number };

const SPEEDS = [1, 2, 4] as const;
/** 빈 화면(첫 장면)에서 머무는 시간(ms, 1×). */
const OPENING_PAUSE = 400;
const NO_FRAMES: TimelapseFrame[] = [];

/**
 * 타임랩스 재생 막대. 장면 번호는 작업 공간이 들고 있고, 이 막대는 재생·배속·이동만 맡는다.
 * 재생 중에는 키보드 입력을 가로채 편집 단축키가 캔버스에 닿지 않게 한다(Esc 닫기, Space 재생, ←→ 한 장면).
 */
export default function TimelapsePlayer({
  state,
  index,
  onIndex,
  onClose,
}: {
  state: TimelapseState;
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const bar = useRef<HTMLDivElement>(null);
  const frames = state.status === "ready" ? state.frames : NO_FRAMES;
  const last = Math.max(frames.length - 1, 0);
  const ended = index >= last;
  const running = playing && !ended && state.status === "ready";

  useEffect(() => {
    if (!running) return;
    const wait =
      index === 0
        ? OPENING_PAUSE
        : frameDuration(frames[index] ?? { strokes: [] });
    const timer = window.setTimeout(() => onIndex(index + 1), wait / speed);
    return () => window.clearTimeout(timer);
  }, [running, index, speed, frames, onIndex]);

  function togglePlay() {
    if (ended) {
      onIndex(0);
      setPlaying(true);
    } else setPlaying((value) => !value);
  }
  function step(delta: number) {
    setPlaying(false);
    onIndex(Math.min(Math.max(index + delta, 0), last));
  }

  // 재생 중에는 키 입력을 모두 여기서 받는다. 막대 안의 버튼·진행 막대는 기본 동작(Enter·Space·화살표)을 그대로 쓴다.
  const keys = useRef({ togglePlay, step, onClose });
  useEffect(() => {
    keys.current = { togglePlay, step, onClose };
  });
  useEffect(() => {
    function capture(event: KeyboardEvent) {
      event.stopPropagation();
      const inBar =
        event.target instanceof Node && !!bar.current?.contains(event.target);
      const control =
        inBar &&
        event.target instanceof Element &&
        !!event.target.closest("button, input");
      if (event.key === "Escape") {
        event.preventDefault();
        keys.current.onClose();
      } else if (event.key === " " && !control) {
        event.preventDefault();
        keys.current.togglePlay();
      } else if (
        (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
        !(inBar && event.target instanceof HTMLInputElement)
      ) {
        event.preventDefault();
        keys.current.step(event.key === "ArrowLeft" ? -1 : 1);
      } else if (event.ctrlKey || event.metaKey) {
        // 저장·실행 취소 같은 편집 단축키가 브라우저 기본 동작으로 새지 않게 막는다(복사는 둔다).
        if (event.key.toLowerCase() !== "c") event.preventDefault();
      }
    }
    document.addEventListener("keydown", capture, true);
    return () => document.removeEventListener("keydown", capture, true);
  }, []);

  const frame = frames[index];
  const estimated = state.status === "ready" ? state.estimatedCount : 0;
  const progress = last ? index / last : 0;
  const estimatedEnd = last ? Math.min(estimated / last, 1) : 0;
  const buttonClass =
    "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-bark-soft hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep";

  return (
    <div
      ref={bar}
      role="group"
      aria-label="타임랩스"
      onPointerDown={(event) => event.stopPropagation()}
      className="absolute bottom-5 left-1/2 z-40 w-[min(34rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-rule bg-white/95 px-3 py-2.5 shadow-float backdrop-blur"
    >
      {style(frame, index, speed)}
      <div className="flex items-center gap-2">
        {state.status === "loading" ? (
          <p role="status" className="flex-1 px-1 text-sm text-lichen">
            타임랩스를 불러오는 중…
          </p>
        ) : last === 0 ? (
          <p role="status" className="flex-1 px-1 text-sm text-lichen">
            아직 보여 줄 과정이 없어요.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={running ? "일시정지" : "재생"}
              title={running ? "일시정지 (Space)" : "재생 (Space)"}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-white hover:bg-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep"
            >
              {running ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
            </button>
            <div className="relative mx-1 flex h-6 min-w-0 flex-1 items-center rounded has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-moss-deep">
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-mist-deep">
                {estimated > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 bg-ochre/25"
                    style={{ width: `${estimatedEnd * 100}%` }}
                  />
                )}
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${progress * 100}%`,
                    background:
                      estimated > 0 && progress > 0
                        ? `linear-gradient(to right, var(--color-ochre) 0 ${(estimatedEnd / progress) * 100}%, var(--color-moss-deep) 0)`
                        : "var(--color-moss-deep)",
                  }}
                />
              </div>
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-white shadow-card ${frame?.estimated ? "bg-ochre" : "bg-moss-deep"}`}
                style={{ left: `${progress * 100}%` }}
              />
              <input
                type="range"
                min={0}
                max={last}
                value={index}
                aria-label="재생 위치"
                aria-valuetext={`${index + 1} / ${last + 1}`}
                onChange={(event) => {
                  setPlaying(false);
                  onIndex(Number(event.target.value));
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>
            <span className="shrink-0 text-xs text-lichen tabular-nums">
              {index + 1}/{last + 1}
            </span>
            <div
              role="radiogroup"
              aria-label="배속"
              className="flex shrink-0 rounded-lg border border-rule p-0.5"
            >
              {SPEEDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={speed === value}
                  onClick={() => setSpeed(value)}
                  className={`rounded-md px-1.5 py-0.5 text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-moss-deep ${speed === value ? "bg-ink text-white" : "text-bark-soft hover:bg-mist"}`}
                >
                  {value}×
                </button>
              ))}
            </div>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="타임랩스 닫기"
          title="닫기 (Esc)"
          className={buttonClass}
        >
          <CloseIcon />
        </button>
      </div>
      {frame?.estimated && (
        <p className="mt-1.5 px-1 text-xs text-lichen">
          기록 전 내용은 순서를 추정했어요
        </p>
      )}
    </div>
  );
}

/**
 * 이번 장면의 연출: 새 노드는 커지며 나타나고, 바뀐 노드는 잠깐 빛나고, 새 획은 그은 순서대로 그어진다.
 * 노드·획 요소를 ID로 골라 애니메이션만 얹는다(움직임 줄이기 설정이면 바로 보인다).
 */
function style(
  frame: TimelapseFrame | undefined,
  index: number,
  speed: number,
) {
  if (!frame) return null;
  const rules: string[] = [];
  const ms = (value: number) => `${Math.round(value / speed)}ms`;
  for (const id of frame.entered)
    rules.push(
      `[data-node-id="${id}"]{animation:timelapse-enter ${ms(380)} cubic-bezier(.2,.8,.2,1) both}`,
    );
  // 연달아 바뀐 노드도 다시 빛나도록 장면마다 애니메이션 이름을 번갈아 쓴다.
  for (const id of frame.changed)
    rules.push(
      `[data-node-id="${id}"]{animation:timelapse-pulse-${index % 2} ${ms(900)} ease-out}`,
    );
  const count = frame.strokes.length;
  if (count) {
    const span = frameDuration(frame) - 200;
    const draw = Math.min(450, span);
    const gap = count > 1 ? (span - draw) / (count - 1) : 0;
    frame.strokes.forEach((id, order) =>
      rules.push(
        `[data-stroke-id="${id}"]{stroke-dasharray:1;stroke-dashoffset:1;animation:timelapse-draw ${ms(draw)} ease-out ${ms(order * gap)} forwards}`,
      ),
    );
  }
  if (!rules.length) return null;
  return (
    <style>{`@media (prefers-reduced-motion: no-preference){${rules.join("")}}`}</style>
  );
}
