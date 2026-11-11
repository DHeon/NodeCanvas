import { connectionColor } from "./connection-colors";
import { strokePath, type DrawingStroke } from "./drawing";

function StrokeShape({ stroke }: { stroke: DrawingStroke }) {
  return (
    <path
      d={strokePath(stroke.points)}
      stroke={connectionColor(stroke.color).value}
      strokeWidth={stroke.width}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** 노드와 연결선 아래에 깔리는 손그림 층. 입력은 받지 않는다. */
export default function DrawingLayer({
  strokes,
  draft,
}: {
  strokes: readonly DrawingStroke[];
  draft: DrawingStroke | null;
}) {
  if (!strokes.length && !draft) return null;
  return (
    <svg
      aria-hidden="true"
      width={1}
      height={1}
      className="pointer-events-none absolute top-0 left-0 overflow-visible"
    >
      {strokes.map((stroke) => (
        <StrokeShape key={stroke.id} stroke={stroke} />
      ))}
      {draft && <StrokeShape stroke={draft} />}
    </svg>
  );
}
