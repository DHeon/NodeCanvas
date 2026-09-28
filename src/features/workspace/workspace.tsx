"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createWorkspace } from "./create-workspace";
import { createNodeId } from "./create-node-id";
import type { PointerEvent as ReactPointerEvent } from "react";
import TextNodeView from "./text-node-view";

import type { Camera, Point, TextNode, TextNodeContentPatch } from "./types";

type WorkspaceProps = {
  projectId: string;
};

type Gesture =
  | {
    kind: "pan";
    pointerId: number;
    startPointer: Point;
    startCamera: Point;
  }
  | {
    kind: "node";
    pointerId: number;
    startPointer: Point;
    nodeId: string;
    startPosition: Point;
    zoom: number;
  };

export default function Workspace({ projectId }: WorkspaceProps) {
  const [workspace, setWorkspace] = useState(createWorkspace);

  const [camera, setCamera] = useState<Camera>({
    x: 32,
    y: 32,
    zoom: 0.5,
  });

  const viewportRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const fitCanvas = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport || gestureRef.current) return;

    const { width, height } = viewport.getBoundingClientRect();

    if (width <= 0 || height <= 0) return;

    const padding = 32;

    const availableWidth = Math.max(width - padding * 2, 1);
    const availableHeight = Math.max(height - padding * 2, 1);

    const zoom = Math.min(
      availableWidth / workspace.canvas.width,
      availableHeight / workspace.canvas.height,
      1,
    );

    setCamera({
      x: (width - workspace.canvas.width * zoom) / 2,
      y: (height - workspace.canvas.height * zoom) / 2,
      zoom,
    });
  }, [workspace.canvas.width, workspace.canvas.height]);

  // 창 전환이나 포인터 취소로 드래그가 계속 남아 있지 않도록 정리한다.
  const clearGesture = useCallback(() => {
    const gesture = gestureRef.current;
    const viewport = viewportRef.current;

    gestureRef.current = null;
    setIsPanning(false);

    if (gesture && viewport?.hasPointerCapture(gesture.pointerId)) {
      viewport.releasePointerCapture(gesture.pointerId);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("blur", clearGesture);
    return () => window.removeEventListener("blur", clearGesture);
  }, [clearGesture]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) return;

    const observer = new ResizeObserver(() => {
      fitCanvas();
    });

    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, [fitCanvas]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) return;

    function handleWheel(event: WheelEvent) {
      if (!viewport) return;

      // 입력 영역에서는 텍스트 스크롤을 그대로 사용한다.
      if (
        event.target instanceof Element &&
        event.target.closest("textarea, input, [contenteditable='true']")
      ) {
        return;
      }

      event.preventDefault();

      // 화면이나 노드를 드래그하는 중에는 확대·축소하지 않는다.
      if (gestureRef.current) return;

      const rect = viewport.getBoundingClientRect();

      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      // 브라우저가 전달하는 휠 이동량을 픽셀 기준으로 환산한다.
      let delta = event.deltaY;

      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        delta *= 16;
      } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        delta *= rect.height;
      }

      const limitedDelta = Math.max(-200, Math.min(delta, 200));
      const factor = Math.exp(-limitedDelta * 0.002);

      setCamera((current) => {
        const zoom = Math.max(0.1, Math.min(current.zoom * factor, 2));

        if (zoom === current.zoom) return current;

        const canvasX = (pointerX - current.x) / current.zoom;
        const canvasY = (pointerY - current.y) / current.zoom;

        return {
          x: pointerX - canvasX * zoom,
          y: pointerY - canvasY * zoom,
          zoom,
        };
      });
    }

    viewport.addEventListener("wheel", handleWheel, {
      passive: false,
    });

    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, []);

  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 1 || gestureRef.current) return;

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);

    gestureRef.current = {
      kind: "pan",
      pointerId: event.pointerId,
      startPointer: {
        x: event.clientX,
        y: event.clientY,
      },
      startCamera: {
        x: camera.x,
        y: camera.y,
      },
    };

    setIsPanning(true);
  }

  function startNodeDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    node: TextNode,
  ) {
    const viewport = viewportRef.current;

    if (event.button !== 0 || gestureRef.current || !viewport) return;

    event.preventDefault();
    event.stopPropagation();

    viewport.focus({ preventScroll: true });
    viewport.setPointerCapture(event.pointerId);

    gestureRef.current = {
      kind: "node",
      pointerId: event.pointerId,
      startPointer: {
        x: event.clientX,
        y: event.clientY,
      },
      nodeId: node.id,
      startPosition: { ...node.position },
      zoom: camera.zoom,
    };

    setSelectedNodeId(node.id);
  }

  function moveGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const buttonMask = gesture.kind === "pan" ? 4 : 1;

    if ((event.buttons & buttonMask) === 0) {
      endGesture(event);
      return;
    }

    const deltaX = event.clientX - gesture.startPointer.x;
    const deltaY = event.clientY - gesture.startPointer.y;

    if (gesture.kind === "pan") {
      setCamera((current) => ({
        ...current,
        x: gesture.startCamera.x + deltaX,
        y: gesture.startCamera.y + deltaY,
      }));

      return;
    }

    const nextX = gesture.startPosition.x + deltaX / gesture.zoom;
    const nextY = gesture.startPosition.y + deltaY / gesture.zoom;

    setWorkspace((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        if (node.id !== gesture.nodeId) return node;

        return {
          ...node,
          position: {
            x: Math.max(0, Math.min(nextX, current.canvas.width - node.width)),
            y: Math.max(
              0,
              Math.min(nextY, current.canvas.height - node.height),
            ),
          },
        };
      }),
    }));
  }

  function endGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId) return;

    clearGesture();
  }
  function addTextNode() {
    const viewport = viewportRef.current;

    if (!viewport || gestureRef.current) return;

    const rect = viewport.getBoundingClientRect();

    const width = 320;
    const height = 220;

    // 현재 화면 중앙을 캔버스 좌표로 변환한다.
    const centerX = (rect.width / 2 - camera.x) / camera.zoom;
    const centerY = (rect.height / 2 - camera.y) / camera.zoom;

    // 연속 생성 시 완전히 같은 위치에 겹치지 않도록 한다.
    const offset = (workspace.nodes.length % 6) * 24;

    const x = Math.max(
      0,
      Math.min(centerX - width / 2 + offset, workspace.canvas.width - width),
    );

    const y = Math.max(
      0,
      Math.min(centerY - height / 2 + offset, workspace.canvas.height - height),
    );

    const node: TextNode = {
      id: createNodeId(),
      type: "text_node",
      position: { x, y },
      width,
      height,
      title: "",
      text: "",
    };

    setWorkspace((current) => ({
      ...current,
      nodes: [...current.nodes, node],
    }));
    setSelectedNodeId(node.id);
    // 캔버스 밖을 보고 있었더라도 새 노드를 볼 수 있게 한다.
    setCamera((current) => ({
      ...current,
      x: rect.width / 2 - (x + width / 2) * current.zoom,
      y: rect.height / 2 - (y + height / 2) * current.zoom,
    }));
  }

  function updateTextNode(nodeId: string, patch: TextNodeContentPatch) {
    setWorkspace((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === nodeId ? { ...node, ...patch } : node,
      ),
    }));
  }
  function deleteSelectedNode() {
    if (!selectedNodeId || gestureRef.current) return;

    setWorkspace((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => node.id !== selectedNodeId),
    }));

    setSelectedNodeId(null);
  }
  return (
    <main className="fixed inset-0 flex flex-col bg-neutral-200 text-neutral-900">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-neutral-300 bg-white px-4 py-2">
        <Link
          href="/dashboard"
          className="shrink-0 text-sm text-neutral-600 hover:text-neutral-900"
        >
          ← 프로젝트 목록
        </Link>

        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">
          작업 공간 · {projectId}
        </h1>

        <span className="ml-auto shrink-0 text-sm text-neutral-500">
          {Math.round(camera.zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={addTextNode}
          className="shrink-0 rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          + 텍스트
        </button>
        <button
          type="button"
          onClick={deleteSelectedNode}
          disabled={!selectedNodeId}
          className="shrink-0 rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          선택 삭제
        </button>
        <button
          type="button"
          onClick={fitCanvas}
          className="shrink-0 rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          화면 맞춤
        </button>
      </header>

      {/* 뷰포트  */}
      <div
        ref={viewportRef}
        tabIndex={-1}
        className="relative min-h-0 flex-1 overflow-hidden outline-none"
        style={{
          cursor: isPanning ? "grabbing" : "default",
        }}
        aria-label="작업 공간 뷰포트"
        onPointerDownCapture={startPan}
        onPointerDown={(event) => {
          if (
            event.button === 0 &&
            !gestureRef.current &&
            event.target instanceof Element &&
            !event.target.closest("[data-node-id]")
          ) {
            setSelectedNodeId(null);
            event.currentTarget.focus({ preventScroll: true });
          }
        }}
        onPointerMove={moveGesture}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onLostPointerCapture={endGesture}
        onAuxClick={(event) => {
          if (event.button === 1) event.preventDefault();
        }}
      >

        {/* 캔버스 */}
        <div
          className="absolute top-0 left-0 origin-top-left bg-white shadow-sm"
          style={{
            width: workspace.canvas.width,
            height: workspace.canvas.height,
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          }}
        >
          {workspace.nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-neutral-400">
              빈 작업 공간
            </div>
          )}

          {workspace.nodes.map((node) => (
            <TextNodeView
              key={node.id}
              node={node}
              selected={selectedNodeId === node.id}
              onSelect={setSelectedNodeId}
              onDragStart={startNodeDrag}
              onChange={updateTextNode}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
