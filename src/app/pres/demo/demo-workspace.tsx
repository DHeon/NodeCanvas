"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import styles from "./demo.module.css";

type TextNode = {
  id: number;
  x: number;
  y: number;
  title: string;
  text: string;
};
type Camera = { x: number; y: number; zoom: number };
type Gesture = {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  zoom: number;
  nodeId?: number;
};

const BOARD = { width: 1600, height: 1000 };
const NODE = { width: 320, height: 250 };
const INITIAL_NODES: TextNode[] = [
  {
    id: 1,
    x: 230,
    y: 240,
    title: "텍스트 노드",
    text: "안녕하세요.",
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function DemoWorkspace() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const nextIdRef = useRef(4);
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [selected, setSelected] = useState<number | null>(null);
  const [tool, setTool] = useState<"select" | "hand">("select");
  const [dragging, setDragging] = useState(false);

  const fitCanvas = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { width, height } = viewport.getBoundingClientRect();
    const zoom = Math.max(
      0.15,
      Math.min((width - 64) / BOARD.width, (height - 64) / BOARD.height, 1),
    );
    setCamera({
      x: (width - BOARD.width * zoom) / 2,
      y: (height - BOARD.height * zoom) / 2,
      zoom,
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(fitCanvas);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitCanvas]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      // Keep text scrolling inside a node independent from canvas zoom.
      if (
        event.target instanceof Element &&
        event.target.closest("[data-node]")
      )
        return;
      event.preventDefault();
      if (gestureRef.current) return;
      const rect = viewport.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      setCamera((previous) => {
        const zoom = clamp(
          previous.zoom * Math.exp(-clamp(delta, -200, 200) * 0.002),
          0.15,
          2,
        );
        return {
          x: px - ((px - previous.x) / previous.zoom) * zoom,
          y: py - ((py - previous.y) / previous.zoom) * zoom,
          zoom,
        };
      });
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  function updateNode(id: number, update: Partial<TextNode>) {
    setNodes((previous) =>
      previous.map((node) => (node.id === id ? { ...node, ...update } : node)),
    );
  }

  function removeNode(id: number) {
    setNodes((previous) => previous.filter((node) => node.id !== id));
    setSelected((previous) => (previous === id ? null : previous));
  }

  function addNode() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const id = nextIdRef.current++;
    const offset = ((id - 4) % 6) * 24;
    const x = clamp(
      (viewport.clientWidth / 2 - camera.x) / camera.zoom -
        NODE.width / 2 +
        offset,
      0,
      BOARD.width - NODE.width,
    );
    const y = clamp(
      (viewport.clientHeight / 2 - camera.y) / camera.zoom -
        NODE.height / 2 +
        offset,
      0,
      BOARD.height - NODE.height,
    );
    setNodes((previous) => [...previous, { id, x, y, title: "", text: "" }]);
    setSelected(id);
    setTool("select");
    // Bring a new node into view even after panning outside the sheet.
    setCamera({
      ...camera,
      x: viewport.clientWidth / 2 - (x + NODE.width / 2) * camera.zoom,
      y: viewport.clientHeight / 2 - (y + NODE.height / 2) * camera.zoom,
    });
  }

  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (gestureRef.current || (event.button !== 0 && event.button !== 1))
      return;
    const overNode =
      event.target instanceof Element && event.target.closest("[data-node]");
    if (event.button === 0 && tool === "select" && overNode) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    if (!overNode) setSelected(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: camera.x,
      y: camera.y,
      zoom: camera.zoom,
    };
    setDragging(true);
  }

  function startNodeDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    node: TextNode,
  ) {
    if (event.button !== 0 || gestureRef.current) return;
    event.preventDefault();
    event.currentTarget.focus();
    setSelected(node.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: node.x,
      y: node.y,
      zoom: camera.zoom,
      nodeId: node.id,
    };
    setDragging(true);
  }

  function movePointer(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (gesture.nodeId !== undefined) {
      updateNode(gesture.nodeId, {
        x: clamp(gesture.x + dx / gesture.zoom, 0, BOARD.width - NODE.width),
        y: clamp(gesture.y + dy / gesture.zoom, 0, BOARD.height - NODE.height),
      });
    } else {
      setCamera({ x: gesture.x + dx, y: gesture.y + dy, zoom: gesture.zoom });
    }
  }

  function endGesture(event: ReactPointerEvent<HTMLDivElement>) {
    if (gestureRef.current?.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    setDragging(false);
    if (
      event.target instanceof Element &&
      event.target.hasPointerCapture(event.pointerId)
    )
      event.target.releasePointerCapture(event.pointerId);
  }

  return (
    <main className={styles.workspace}>
      <header className={styles.titlebar}>
        <h1>nono / 작업 공간</h1>
        <span className={styles.badge}>데모</span>
      </header>
      <nav className={styles.toolbar} aria-label="작업 공간 도구">
        <div className={styles.tools}>
          <button
            type="button"
            aria-pressed={tool === "select"}
            onClick={() => setTool("select")}
          >
            선택
          </button>
          <button
            type="button"
            aria-pressed={tool === "hand"}
            onClick={() => setTool("hand")}
          >
            이동
          </button>
          <span className={styles.divider} />
          <button type="button" onClick={addNode}>
            + 텍스트
          </button>
        </div>
        <div className={styles.tools}>
          <span className={styles.zoom}>{Math.round(camera.zoom * 100)}%</span>
          <button type="button" onClick={fitCanvas}>
            화면 맞춤
          </button>
        </div>
      </nav>

      <div
        ref={viewportRef}
        className={`${styles.viewport} ${tool === "hand" ? styles.hand : ""} ${dragging ? styles.dragging : ""}`}
        tabIndex={0}
        role="region"
        aria-label="데모 캔버스"
        onPointerDownCapture={startPan}
        onPointerMove={movePointer}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onLostPointerCapture={endGesture}
        onAuxClick={(event) => {
          if (event.button === 1) event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest("input, textarea")
          )
            return;
          if (event.key === "Escape") {
            setSelected(null);
            setTool("select");
          }
          if (
            (event.key === "Delete" || event.key === "Backspace") &&
            selected !== null
          ) {
            event.preventDefault();
            removeNode(selected);
          }
        }}
      >
        <div
          className={styles.board}
          style={{
            width: BOARD.width,
            height: BOARD.height,
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          }}
        >
          <div className={styles.boardLabel}>
            나의 첫 작업 공간 <span>1600 × 1000</span>
          </div>
          {nodes.map((node) => (
            <article
              key={node.id}
              data-node
              className={`${styles.node} ${selected === node.id ? styles.selected : ""}`}
              style={{
                left: node.x,
                top: node.y,
                width: NODE.width,
                height: NODE.height,
                zIndex: selected === node.id ? 2 : 1,
              }}
              aria-label={node.title || "새 텍스트"}
              onPointerDown={() => setSelected(node.id)}
              onFocus={() => setSelected(node.id)}
            >
              <div className={styles.nodeBar}>
                <button
                  type="button"
                  className={styles.handle}
                  aria-label={`${node.title || "새 텍스트"} 이동`}
                  title="드래그하여 이동 · 방향키로 미세 이동"
                  onPointerDown={(event) => startNodeDrag(event, node)}
                  onKeyDown={(event) => {
                    const steps: Record<string, [number, number]> = {
                      ArrowLeft: [-1, 0],
                      ArrowRight: [1, 0],
                      ArrowUp: [0, -1],
                      ArrowDown: [0, 1],
                    };
                    const step = steps[event.key];
                    if (!step) return;
                    event.preventDefault();
                    const distance = event.shiftKey ? 20 : 5;
                    updateNode(node.id, {
                      x: clamp(
                        node.x + step[0] * distance,
                        0,
                        BOARD.width - NODE.width,
                      ),
                      y: clamp(
                        node.y + step[1] * distance,
                        0,
                        BOARD.height - NODE.height,
                      ),
                    });
                  }}
                >
                  텍스트 {node.id}
                </button>
                <button
                  type="button"
                  className={styles.close}
                  aria-label={`${node.title || "새 텍스트"} 삭제`}
                  onClick={() => removeNode(node.id)}
                >
                  ×
                </button>
              </div>
              <input
                className={styles.nodeTitle}
                aria-label={`텍스트 ${node.id} 제목`}
                placeholder="제목 없는 메모"
                value={node.title}
                onChange={(event) =>
                  updateNode(node.id, { title: event.target.value })
                }
              />
              <textarea
                className={styles.nodeText}
                aria-label={`텍스트 ${node.id} 내용`}
                placeholder="여기에 생각을 적어보세요…"
                value={node.text}
                onChange={(event) =>
                  updateNode(node.id, { text: event.target.value })
                }
                spellCheck={false}
              />
            </article>
          ))}
          {nodes.length === 0 && (
            <p className={styles.empty}>
              상단의 + 텍스트로 첫 메모를 놓아보세요.
            </p>
          )}
        </div>
      </div>

      <footer className={styles.statusbar}>
        <span>텍스트 {nodes.length}개</span>
        <span className={styles.hint}>
          빈 공간 / 휠 버튼 드래그: 이동 · 휠: 확대·축소
        </span>
        <span>데모 · 새로고침 시 초기화</span>
      </footer>
    </main>
  );
}
