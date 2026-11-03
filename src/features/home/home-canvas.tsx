"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import styles from "./home.module.css";

type Point = { x: number; y: number };
type Camera = Point & { zoom: number };
type NodeId = "idea" | "image" | "next";
type Layout = {
  width: number;
  height: number;
  nodes: Record<NodeId, Point & { width: number; height: number }>;
};
const desktop: Layout = {
  width: 1000,
  height: 560,
  nodes: {
    idea: { x: 105, y: 105, width: 310, height: 222 },
    image: { x: 615, y: 42, width: 248, height: 290 },
    next: { x: 552, y: 385, width: 300, height: 130 },
  },
};
const mobile: Layout = {
  width: 360,
  height: 620,
  nodes: {
    idea: { x: 28, y: 38, width: 302, height: 220 },
    image: { x: 22, y: 312, width: 200, height: 254 },
    next: { x: 194, y: 412, width: 148, height: 155 },
  },
};
const emptyOffsets: Record<NodeId, Point> = {
  idea: { x: 0, y: 0 },
  image: { x: 0, y: 0 },
  next: { x: 0, y: 0 },
};
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

function fit(width: number, height: number, layout: Layout): Camera {
  const zoom = Math.min(
    (width - 28) / layout.width,
    (height - 26) / layout.height,
    1.15,
  );
  return {
    x: (width - layout.width * zoom) / 2,
    y: (height - layout.height * zoom) / 2,
    zoom,
  };
}

// 실제 프로젝트·DB와 연결되지 않는, 홈 화면 전용 작은 체험 캔버스.
export default function HomeCanvas() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<{
    pointerId: number;
    start: Point;
    camera: Camera;
    nodeId: NodeId | null;
    offset: Point;
  } | null>(null);
  const compactRef = useRef(false);
  const [size, setSize] = useState({ width: 1000, height: 500 });
  const [camera, setCamera] = useState<Camera>(() => fit(1000, 500, desktop));
  const [offsets, setOffsets] = useState(emptyOffsets);
  const [selected, setSelected] = useState<NodeId>("idea");
  const [dragging, setDragging] = useState(false);
  const [note, setNote] = useState(
    "회의 내용 정리\n\n화면 구성 확인\n필요한 자료 모으기",
  );
  const layout = size.width < 640 ? mobile : desktop;

  const endGesture = useCallback(() => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    setDragging(false);
    if (gesture && viewportRef.current?.hasPointerCapture(gesture.pointerId))
      viewportRef.current.releasePointerCapture(gesture.pointerId);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      const { width, height } = viewport.getBoundingClientRect();
      if (!width || !height) return;
      endGesture();
      const compact = width < 640;
      if (compact !== compactRef.current) setOffsets(emptyOffsets);
      compactRef.current = compact;
      setSize({ width, height });
      setCamera(fit(width, height, compact ? mobile : desktop));
    });
    observer.observe(viewport);
    window.addEventListener("blur", endGesture);
    return () => {
      observer.disconnect();
      window.removeEventListener("blur", endGesture);
    };
  }, [endGesture]);

  function zoomBy(factor: number) {
    if (gestureRef.current) return;
    setCamera((current) => {
      const zoom = clamp(current.zoom * factor, 0.35, 1.8);
      return {
        x:
          size.width / 2 - ((size.width / 2 - current.x) * zoom) / current.zoom,
        y:
          size.height / 2 -
          ((size.height / 2 - current.y) * zoom) / current.zoom,
        zoom,
      };
    });
  }

  function startGesture(event: PointerEvent<HTMLDivElement>) {
    if (gestureRef.current || (event.button !== 0 && event.button !== 1))
      return;
    if (
      !(event.target instanceof Element) ||
      event.target.closest("textarea, input")
    )
      return;
    const nodeId =
      event.button === 1
        ? null
        : (event.target.closest<HTMLElement>("[data-demo-node]")?.dataset
            .demoNode as NodeId | undefined);
    event.preventDefault();
    // 키보드로도 노드를 이동할 수 있게 이동 손잡이의 포커스는 유지한다.
    if (event.target.closest("button"))
      event.target
        .closest<HTMLElement>("button")
        ?.focus({ preventScroll: true });
    else event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (nodeId) setSelected(nodeId);
    gestureRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      camera,
      nodeId: nodeId ?? null,
      offset: nodeId ? offsets[nodeId] : { x: 0, y: 0 },
    };
    setDragging(true);
  }

  function moveGesture(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (!event.buttons) {
      endGesture();
      return;
    }
    const dx = event.clientX - gesture.start.x;
    const dy = event.clientY - gesture.start.y;
    if (!gesture.nodeId) {
      setCamera({
        ...gesture.camera,
        x: gesture.camera.x + dx,
        y: gesture.camera.y + dy,
      });
      return;
    }
    const id = gesture.nodeId;
    const node = layout.nodes[id];
    setOffsets((current) => ({
      ...current,
      [id]: {
        x: clamp(
          gesture.offset.x + dx / gesture.camera.zoom,
          12 - node.x,
          layout.width - node.width - node.x - 12,
        ),
        y: clamp(
          gesture.offset.y + dy / gesture.camera.zoom,
          12 - node.y,
          layout.height - node.height - node.y - 12,
        ),
      },
    }));
  }

  function moveWithKeyboard(
    event: KeyboardEvent<HTMLButtonElement>,
    id: NodeId,
  ) {
    const directions: Record<string, Point> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    setSelected(id);
    const node = layout.nodes[id];
    const step = event.shiftKey ? 20 : 8;
    setOffsets((current) => ({
      ...current,
      [id]: {
        x: clamp(
          current[id].x + direction.x * step,
          12 - node.x,
          layout.width - node.width - node.x - 12,
        ),
        y: clamp(
          current[id].y + direction.y * step,
          12 - node.y,
          layout.height - node.height - node.y - 12,
        ),
      },
    }));
  }

  const positioned = (id: NodeId) => ({
    ...layout.nodes[id],
    x: layout.nodes[id].x + offsets[id].x,
    y: layout.nodes[id].y + offsets[id].y,
  });
  const idea = positioned("idea"),
    image = positioned("image"),
    next = positioned("next");
  const path = (from: Point, to: Point) =>
    `M${from.x},${from.y} C${from.x + 90},${from.y} ${to.x - 90},${to.y} ${to.x},${to.y}`;
  const frame = (id: NodeId) => {
    const node = positioned(id);
    return {
      left: node.x,
      top: node.y,
      width: node.width,
      height: node.height,
      zIndex: selected === id ? 2 : 1,
    };
  };
  function ports(id: NodeId) {
    return selected === id ? (
      <>
        {["Top", "Right", "Bottom", "Left"].map((side) => (
          <span
            key={side}
            aria-hidden="true"
            className={`${styles.port} ${styles[`port${side}`]}`}
          />
        ))}
      </>
    ) : null;
  }

  return (
    <div className={styles.demoShell}>
      <div className={styles.demoHeader}>
        <div className={styles.demoBreadcrumb}>
          <span className={styles.miniBrand}>n.</span>
          <span>나의 작업 공간</span>
          <span aria-hidden="true">/</span>
          <strong>체험용 캔버스</strong>
        </div>
        <span className={styles.demoBadge}>
          <span /> LIVE PREVIEW
        </span>
      </div>
      <div
        className={styles.demoViewport}
        ref={viewportRef}
        tabIndex={-1}
        aria-label="체험용 캔버스"
        style={{ cursor: dragging ? "grabbing" : "grab" }}
        onPointerDown={startGesture}
        onPointerMove={moveGesture}
        onPointerUp={(event) => {
          if (gestureRef.current?.pointerId === event.pointerId) endGesture();
        }}
        onPointerCancel={endGesture}
        onLostPointerCapture={endGesture}
        onKeyDown={(event) => {
          if (event.key === "Escape") endGesture();
        }}
        onAuxClick={(event) => {
          if (event.button === 1) event.preventDefault();
        }}
      >
        <div
          className={styles.demoBoard}
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          }}
        >
          <svg
            width={layout.width}
            height={layout.height}
            className={styles.demoConnections}
            fill="none"
            stroke="#9AA58A"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path
              data-demo-connection="image"
              d={path(
                { x: idea.x + idea.width, y: idea.y + idea.height / 2 },
                { x: image.x, y: image.y + image.height / 2 },
              )}
            />
            <path
              data-demo-connection="next"
              d={path(
                { x: idea.x + idea.width, y: idea.y + idea.height / 2 },
                { x: next.x, y: next.y + next.height / 2 },
              )}
            />
          </svg>
          <article
            data-demo-node="idea"
            className={`${styles.demoNode} ${styles.ideaNode} ${selected === "idea" ? styles.nodeSelected : ""}`}
            style={frame("idea")}
          >
            <button
              className={styles.nodeHeading}
              type="button"
              onKeyDown={(event) => moveWithKeyboard(event, "idea")}
              aria-label="프로젝트 메모 이동"
              title="드래그 또는 방향키로 이동"
            >
              <span className={styles.noteIcon}>Aa</span>
              <span>프로젝트 메모</span>
              <span className={styles.dragDots} aria-hidden="true">
                ⠿
              </span>
            </button>
            <textarea
              aria-label="체험 메모 편집"
              value={note}
              maxLength={300}
              onFocus={() => setSelected("idea")}
              onChange={(event) => setNote(event.target.value)}
              spellCheck={false}
            />
            <span className={styles.editHint}>
              클릭해서 내용 수정 <span aria-hidden="true">↗</span>
            </span>
            {ports("idea")}
          </article>
          <article
            data-demo-node="image"
            className={`${styles.demoNode} ${styles.imageNode} ${selected === "image" ? styles.nodeSelected : ""}`}
            style={frame("image")}
          >
            <button
              className={styles.nodeHeading}
              type="button"
              onKeyDown={(event) => moveWithKeyboard(event, "image")}
              aria-label="이미지 노트 이동"
              title="드래그 또는 방향키로 이동"
            >
              <span className={styles.imageIcon}>▧</span>
              <span>참고 이미지</span>
              <span className={styles.dragDots} aria-hidden="true">
                ⠿
              </span>
            </button>
            <div className={styles.landscape}>
              <svg
                viewBox="0 0 300 270"
                role="img"
                aria-label="연두색 들판과 해를 표현한 예시 일러스트"
              >
                <rect width="300" height="270" fill="#E8E9DC" />
                <circle cx="224" cy="67" r="31" fill="#DB9A73" />
                <path
                  d="M0 165c80-40 120 30 190-10s90-10 110 0v115H0Z"
                  fill="#ACB99A"
                />
                <path
                  d="M0 202c83 35 115-43 180-18s77 21 120 2v84H0Z"
                  fill="#62775A"
                />
                <path d="M0 240c110-22 160 22 300-7v37H0Z" fill="#354F3E" />
                <path
                  d="M89 270c18-18 48-26 46-47s45-24 44-45"
                  stroke="#DADEBD"
                  strokeWidth="12"
                  fill="none"
                />
              </svg>
              <span>REFERENCE IMAGE</span>
            </div>
            {ports("image")}
          </article>
          <article
            data-demo-node="next"
            className={`${styles.demoNode} ${styles.nextNode} ${selected === "next" ? styles.nodeSelected : ""}`}
            style={frame("next")}
          >
            <button
              className={styles.nodeHeading}
              type="button"
              onKeyDown={(event) => moveWithKeyboard(event, "next")}
              aria-label="작업 목록 이동"
              title="드래그 또는 방향키로 이동"
            >
              <span className={styles.nextIcon}>↗</span>
              <span>작업 목록</span>
              <span className={styles.dragDots} aria-hidden="true">
                ⠿
              </span>
            </button>
            <p>
              자료 확인하기
              <br />
              메모 정리하기
            </p>
            {ports("next")}
          </article>
        </div>
        <div className={styles.demoTip} aria-hidden="true">
          <svg width="13" height="17" viewBox="0 0 13 17" fill="none">
            <path
              d="m1 1 10 8-5 .5L4 15 1 1Z"
              fill="#4A5640"
              stroke="#F7F8F1"
              strokeLinejoin="round"
            />
          </svg>
          <span>노드를 잡고 움직여보세요</span>
        </div>
      </div>
      <div className={styles.demoFooter}>
        <p>
          체험용 예시 <span>· 변경 내용은 저장되지 않아요</span>
        </p>
        <div
          className={styles.zoomTools}
          role="group"
          aria-label="체험 캔버스 조작"
        >
          <button
            type="button"
            aria-label="체험 캔버스 축소"
            onClick={() => zoomBy(1 / 1.2)}
            disabled={camera.zoom <= 0.35}
          >
            −
          </button>
          <span aria-live="polite">{Math.round(camera.zoom * 100)}%</span>
          <button
            type="button"
            aria-label="체험 캔버스 확대"
            onClick={() => zoomBy(1.2)}
            disabled={camera.zoom >= 1.8}
          >
            +
          </button>
          <span className={styles.toolDivider} />
          <button
            type="button"
            aria-label="체험 캔버스 배치 초기화"
            title="배치 초기화"
            onClick={() => {
              endGesture();
              setOffsets(emptyOffsets);
              setCamera(fit(size.width, size.height, layout));
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M4 11a8 8 0 1 1 2.2 6M4 4v7h7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
