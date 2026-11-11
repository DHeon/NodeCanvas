"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ClipboardEvent as ReactClipboardEvent,
} from "react";
import TextNodeView from "./text-node-view";
import ImageNodeView from "./image-node-view";
import CanvasNodeView from "./canvas-node-view";
import { ArrowLeftIcon, MinusIcon, PlusIcon } from "./icons";
import ConflictPanel from "./conflict-panel";
import ImageViewer from "./image-viewer";
import LinkNodeView from "./link-node-view";
import useLinkPreviews from "./use-link-previews";
import { normalizeLinkUrl } from "./link-embed";
import { mergeTextStyle, type TextStyle } from "./text-style";
import ShortcutHelp from "./shortcut-help";
import { useAutosave } from "./use-autosave";
import { countNodes, duplicateNodes } from "./node-clone";
import {
  DEFAULT_CONNECTION_COLOR,
  type ConnectionColor,
} from "./connection-colors";
import WorkspaceProperties from "./workspace-properties";
import useImageUploads from "./use-image-uploads";
import { fitNodeSize, replaceNodeImage, transformNode } from "./node-transform";
import WorkspaceToolbar, { type WorkspaceTool } from "./workspace-toolbar";
import DrawingLayer from "./drawing-layer";
import DrawOptions from "./draw-options";
import {
  readPenSettings,
  writePenSettings,
  type PenSettings,
} from "./pen-settings";
import {
  appendPoint,
  countDocumentDrawingPoints,
  eraseStrokes,
  MAX_DRAWING_POINTS,
  MAX_STROKES_PER_CANVAS,
  simplifyPoints,
  type DrawingStroke,
  type StrokeWidth,
} from "./drawing";
import WorkspaceMenu from "./workspace-menu";
import { applyCanvasSettings, getFitCamera } from "./canvas-settings";
import ConnectionLayer from "./connection-layer";
import { createWorkspace, expandLegacyCanvas } from "./create-workspace";
import {
  canvasNodeTitle,
  MAX_CANVAS_DEPTH,
  MAX_WORKSPACE_NODES,
  resolveWorkspacePath,
  updateWorkspaceAtPath,
  walkWorkspaceNodes,
} from "./workspace-tree";
import {
  findConnectionTarget,
  getConnectionKey,
  getConnectionPoint,
  MAX_CONNECTIONS,
} from "./connections";
import {
  createWorkspaceHistory,
  workspaceHistoryReducer,
} from "./workspace-history";
import {
  loadWorkspaceDocument,
  saveWorkspaceDocument,
  WorkspaceSaveError,
} from "./workspace-save-client";

import type {
  Camera,
  ConnectionEndpoint,
  ConnectionDraft,
  ConnectionSide,
  NodeConnection,
  Point,
  WorkspaceNode,
  ImageNode,
  ImageReference,
  NodeTransformPatch,
  TextNodeContentPatch,
  WorkspaceDocument,
} from "./types";

type WorkspaceProps = {
  projectId: string;
  projectTitle: string;
  initialDocument: WorkspaceDocument;
  initialVersion: number;
};

type Gesture =
  | {
      kind: "pan";
      pointerId: number;
      // 휠 클릭(1) 또는 Space + 왼쪽 버튼(0).
      button: number;
      startPointer: Point;
      startCamera: Point;
    }
  | {
      kind: "node";
      moved: boolean;
      pointerId: number;
      startPointer: Point;
      startPositions: Map<string, Point>;
      bounds: { left: number; top: number; right: number; bottom: number };
      zoom: number;
    }
  | {
      kind: "resize";
      pointerId: number;
      startPointer: Point;
      nodeId: string;
      startWidth: number;
      startHeight: number;
      zoom: number;
    }
  | {
      kind: "marquee";
      pointerId: number;
      startPointer: Point;
      startCanvas: Point;
      zoom: number;
      initialSelection: string[];
      additive: boolean;
      moved: boolean;
    }
  | {
      kind: "connect";
      pointerId: number;
      startPointer: Point;
      source: ConnectionEndpoint;
    }
  | {
      // 펜: 손을 뗄 때 시작한 공간(path)에 한 번에 붙인다.
      kind: "draw";
      pointerId: number;
      startPointer: Point;
      path: string[];
      points: number[];
      color: ConnectionColor;
      width: StrokeWidth;
      zoom: number;
    }
  | {
      // 지우개: begin~commit 사이에 문지른 것 전체가 Undo 한 단계.
      kind: "erase";
      pointerId: number;
      startPointer: Point;
      path: string[];
      last: Point;
      zoom: number;
      limitHit: boolean;
    };

// 화면 기준 거리. 캔버스 단위로는 zoom으로 나눈다.
const DRAW_MIN_DISTANCE = 1.5;
const ERASER_RADIUS = 10;
const DRAWING_LIMIT_NOTICE = `그림은 한 공간에 선 ${MAX_STROKES_PER_CANVAS.toLocaleString()}개, 프로젝트 전체에 점 ${(MAX_DRAWING_POINTS / 10000).toLocaleString()}만 개까지 그릴 수 있어요.`;

function appendStroke(
  document: WorkspaceDocument,
  stroke: DrawingStroke,
): WorkspaceDocument {
  return {
    ...document,
    drawing: { strokes: [...(document.drawing?.strokes ?? []), stroke] },
  };
}

type SelectionRect = Point & { width: number; height: number };

function inheritViewSettings(
  document: WorkspaceDocument,
  parent: WorkspaceDocument["canvas"],
): WorkspaceDocument {
  const canvas = { ...document.canvas };
  if (parent.lineStyle) canvas.lineStyle = parent.lineStyle;
  if (parent.grid !== undefined) canvas.grid = parent.grid;
  return { ...document, canvas };
}

function writeCanvasPath(path: readonly string[], mode: "push" | "replace") {
  const params = new URLSearchParams(window.location.search);
  if (path.length) params.set("canvas", path.join("."));
  else params.delete("canvas");
  const query = params.toString();
  const url = query ? `?${query}` : window.location.pathname;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

const NUDGE_STEP = 8;
const NUDGE_STEP_LARGE = 40;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 2;
const timeFormat = new Intl.DateTimeFormat("ko", {
  hour: "2-digit",
  minute: "2-digit",
});
const iconButtonClassName =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rule bg-white text-bark-soft hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep active:bg-mist-deep disabled:cursor-not-allowed disabled:opacity-40";
const zoomButtonClassName =
  "inline-flex h-8 w-8 items-center justify-center text-bark-soft first:rounded-l-lg last:rounded-r-lg hover:bg-mist focus-visible:outline-2 focus-visible:outline-moss-deep";
const quietButtonClassName =
  "shrink-0 rounded-lg border border-rule bg-white px-3 py-1.5 text-sm hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep active:bg-mist-deep";
// 캔버스 점 격자 색: 세이지 바탕(field) 위에서 보일 만큼만.
const GRID_DOT_COLOR = "var(--color-sage-dot)";

export default function Workspace({
  projectId,
  projectTitle,
  initialDocument,
  initialVersion,
}: WorkspaceProps) {
  const [history, dispatchHistory] = useReducer(
    workspaceHistoryReducer,
    initialDocument,
    (document) => createWorkspaceHistory(expandLegacyCanvas(document)),
  );
  const rootDocument = history.present;
  // 현재 하위 캔버스 경로는 URL(?canvas=a.b)에 둔다. 브라우저 뒤로 가기가 한 단계 위로
  // 올라가고, 새로고침·링크 공유에도 같은 공간이 열린다.
  const searchParams = useSearchParams();
  const canvasParam = searchParams.get("canvas") ?? "";
  const canvasPath = useMemo(
    () => (canvasParam ? canvasParam.split(".") : []),
    [canvasParam],
  );
  const { document: workspace, trail } = resolveWorkspacePath(
    rootDocument,
    canvasPath,
  );
  const activeDepth = trail.length;
  const canvasKey = canvasPath.slice(0, activeDepth).join("/");
  const currentCanvas = trail.at(-1);
  // Undo나 잘못된 주소로 경로의 캔버스가 없으면 남아 있는 가장 가까운 상위 공간으로 주소를 고친다.
  useEffect(() => {
    if (canvasPath.length !== activeDepth)
      writeCanvasPath(canvasPath.slice(0, activeDepth), "replace");
  }, [canvasPath, activeDepth]);

  const workspaceRef = useRef(workspace);
  const rootDocumentRef = useRef(rootDocument);
  useLayoutEffect(() => {
    workspaceRef.current = workspace;
    rootDocumentRef.current = rootDocument;
  }, [workspace, rootDocument]);
  const setWorkspace = useCallback(
    (update: (document: WorkspaceDocument) => WorkspaceDocument) => {
      dispatchHistory({
        type: "change",
        update: (root) =>
          updateWorkspaceAtPath(root, canvasPath.slice(0, activeDepth), update),
      });
    },
    [canvasPath, activeDepth],
  );

  const [camera, setCamera] = useState<Camera>({
    x: 32,
    y: 32,
    zoom: 0.5,
  });
  const latestCameraRef = useRef(camera);
  const previousCanvasKeyRef = useRef<string | null>(null);
  const canvasCamerasRef = useRef(new Map<string, Camera>());
  useLayoutEffect(() => {
    latestCameraRef.current = camera;
  }, [camera]);

  const viewportRef = useRef<HTMLDivElement>(null); // DOM관련 크기 측정, 이벤트 연결할 때
  const focusAfterRenderRef = useRef<string | null>(null);
  useEffect(() => {
    const nodeId = focusAfterRenderRef.current;
    if (!nodeId) return;
    focusAfterRenderRef.current = null;
    viewportRef.current
      ?.querySelector<HTMLTextAreaElement>(
        `[data-node-id="${nodeId}"] textarea`,
      )
      ?.focus({ preventScroll: true });
  });
  const gestureRef = useRef<Gesture | null>(null); //드래그 시작 시 위치와 어떤거 이동할지
  const [tool, setTool] = useState<WorkspaceTool>("select");
  const [pen, setPen] = useState(readPenSettings);
  const [drawDraft, setDrawDraft] = useState<DrawingStroke | null>(null);
  const [eraserPointer, setEraserPointer] = useState<Point | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageTargetRef = useRef<{ nodeId: string; path: string[] } | null>(
    null,
  );
  const pendingImagesRef = useRef<
    { nodeId: string; image: ImageReference; path: readonly string[] }[]
  >([]);
  const [propertiesOpen, setPropertiesOpen] = useState(true);

  const [savedDocument, setSavedDocument] = useState(initialDocument);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  // 통신·서버 오류처럼 다시 시도하면 될 수 있는 실패인지. 400·401·403·404는 아니다.
  const [saveRetryable, setSaveRetryable] = useState(true);
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [notice, setNotice] = useState("");
  // 크게 보기 중인 이미지 노드. 다른 공간으로 가거나 노드가 사라지면 자동으로 닫힌다.
  const [viewerNodeId, setViewerNodeId] = useState<string | null>(null);
  const savingRef = useRef(false);
  const documentVersionRef = useRef(initialVersion);
  const unconfirmedSaveRef = useRef<{
    document: WorkspaceDocument;
    version: number;
  } | null>(null);
  const hasUnsavedChanges = rootDocument !== savedDocument;

  // 자동 저장이 끝나기 전에 닫으면 경고한다. 브라우저에 문서를 저장하지는 않는다.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = true;
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // 앱 안 이동(뒤로 가기 포함)으로 편집기를 벗어날 때 남은 변경을 마지막으로 보낸다.
  const exitSaveRef = useRef({
    pending: false,
    document: rootDocument,
  });
  useEffect(() => {
    exitSaveRef.current = {
      pending: hasUnsavedChanges && !hasConflict && !isSaving,
      document: rootDocument,
    };
  });
  useEffect(() => {
    return () => {
      const { pending, document } = exitSaveRef.current;
      if (!pending || unconfirmedSaveRef.current) return;
      void saveWorkspaceDocument(
        projectId,
        document,
        documentVersionRef.current,
        { keepalive: true },
      ).catch(() => {
        // 화면이 이미 사라졌으므로 알릴 곳이 없다. 다음에 열 때 서버 버전이 기준이 된다.
      });
    };
  }, [projectId]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(null);
  const [connectionDraft, setConnectionDraft] =
    useState<ConnectionDraft | null>(null);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(
    null,
  );
  // 다른 공간으로 옮기면(뒤로 가기 포함) 이전 공간의 선택은 의미가 없으므로 비운다.
  const [selectionCanvasKey, setSelectionCanvasKey] = useState(canvasKey);
  if (selectionCanvasKey !== canvasKey) {
    setSelectionCanvasKey(canvasKey);
    setSelectedNodeIds([]);
    setSelectedConnectionId(null);
  }
  const [isPanning, setIsPanning] = useState(false); //드래그 상태따라 커서 변경
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceHeldRef = useRef(false);
  const hasPendingEdit =
    history.transactionStart !== null &&
    history.transactionStart !== rootDocument;
  const canUndo = history.past.length > 0 || hasPendingEdit;
  const canRedo = history.future.length > 0 && !hasPendingEdit;

  const fitCanvas = useCallback(() => {
    //화면 맞춤
    const viewport = viewportRef.current;

    if (!viewport || gestureRef.current) return;

    const { width, height } = viewport.getBoundingClientRect();

    if (width <= 0 || height <= 0) return;

    setCamera(getFitCamera(workspaceRef.current, width, height));
  }, []);

  // 드래그 정리
  const clearGesture = useCallback(() => {
    const gesture = gestureRef.current;
    const viewport = viewportRef.current;

    gestureRef.current = null;
    setIsPanning(false);
    setSelectionRect(null);
    setConnectionDraft(null);
    setDrawDraft(null);

    if (
      gesture?.kind === "node" ||
      gesture?.kind === "resize" ||
      gesture?.kind === "erase"
    ) {
      dispatchHistory({ type: "commit" });
    }
    if (gesture?.kind === "erase" && gesture.limitHit) {
      setNotice(DRAWING_LIMIT_NOTICE);
    }
    if (gesture?.kind === "draw" && gesture.points.length) {
      const points = simplifyPoints(gesture.points, 0.5 / gesture.zoom);
      const root = rootDocumentRef.current;
      const strokes =
        resolveWorkspacePath(root, gesture.path).document.drawing?.strokes ??
        [];
      if (
        strokes.length >= MAX_STROKES_PER_CANVAS ||
        countDocumentDrawingPoints(root) + points.length / 2 >
          MAX_DRAWING_POINTS
      ) {
        setNotice(DRAWING_LIMIT_NOTICE);
      } else {
        const stroke: DrawingStroke = {
          id: uuidv4(),
          color: gesture.color,
          width: gesture.width,
          points,
        };
        dispatchHistory({
          type: "change",
          update: (current) =>
            updateWorkspaceAtPath(current, gesture.path, (document) =>
              appendStroke(document, stroke),
            ),
        });
      }
    }

    for (const { nodeId, image, path } of pendingImagesRef.current) {
      dispatchHistory({
        type: "change",
        update: (root) =>
          updateWorkspaceAtPath(root, path, (document) =>
            replaceNodeImage(document, nodeId, image),
          ),
      });
    }
    pendingImagesRef.current = [];

    if (gesture && viewport?.hasPointerCapture(gesture.pointerId)) {
      viewport.releasePointerCapture(gesture.pointerId);
    }
  }, []);

  // 미리보기는 요청한 공간·주소의 노드에만 적용한다. 제목이 비어 있으면 페이지 제목으로 채운다.
  const linkPreviews = useLinkPreviews((nodeId, url, preview, path) => {
    dispatchHistory({
      type: "change",
      update: (root) =>
        updateWorkspaceAtPath(root, path, (document) => {
          let changed = false;
          const nodes = document.nodes.map((node) => {
            if (
              node.id !== nodeId ||
              node.type !== "link_node" ||
              node.url !== url
            )
              return node;
            changed = true;
            return {
              ...node,
              preview,
              title: node.title || (preview.title ?? "").slice(0, 200),
            };
          });
          return changed ? { ...document, nodes } : document;
        }),
    });
  });

  const imageUploads = useImageUploads(projectId, (nodeId, image, path) => {
    if (gestureRef.current) {
      pendingImagesRef.current.push({ nodeId, image, path });
      return;
    }
    dispatchHistory({ type: "commit" });
    dispatchHistory({
      type: "change",
      update: (root) =>
        updateWorkspaceAtPath(root, path, (current) =>
          replaceNodeImage(current, nodeId, image),
        ),
    });
    if (document.activeElement?.matches("input, textarea"))
      dispatchHistory({ type: "begin" });
  });

  useEffect(() => {
    // 아직 움직이지 않아 캡처하지 않은 클릭도 뷰포트 밖에서 놓으면 정리한다.
    function endPendingNodeDrag(event: PointerEvent) {
      const gesture = gestureRef.current;
      if (
        gesture?.kind === "node" &&
        !gesture.moved &&
        gesture.pointerId === event.pointerId
      )
        clearGesture();
    }
    window.addEventListener("blur", clearGesture);
    window.addEventListener("pointerup", endPendingNodeDrag);
    window.addEventListener("pointercancel", endPendingNodeDrag);
    return () => {
      window.removeEventListener("blur", clearGesture);
      window.removeEventListener("pointerup", endPendingNodeDrag);
      window.removeEventListener("pointercancel", endPendingNodeDrag);
    };
  }, [clearGesture]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) return;

    const previousKey = previousCanvasKeyRef.current;
    const switchedCanvas = previousKey !== canvasKey;
    if (switchedCanvas && previousKey !== null) {
      canvasCamerasRef.current.set(previousKey, latestCameraRef.current);
    }
    previousCanvasKeyRef.current = canvasKey;

    const savedCamera = switchedCanvas
      ? canvasCamerasRef.current.get(canvasKey)
      : undefined;
    if (savedCamera) setCamera(savedCamera);
    else fitCanvas();

    let lastSize = viewport.getBoundingClientRect();
    const observer = new ResizeObserver(() => {
      const size = viewport.getBoundingClientRect();
      // 관찰을 시작할 때 오는 첫 알림으로 복원한 화면을 덮어쓰지 않는다.
      if (size.width === lastSize.width && size.height === lastSize.height)
        return;
      lastSize = size;
      fitCanvas();
    });

    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, [
    canvasKey,
    fitCanvas,
    workspace.canvas.width,
    workspace.canvas.height,
    workspace.canvas.infinite,
  ]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) return;

    function handleWheel(event: WheelEvent) {
      if (!viewport) return;

      // 입력 영역에서는 텍스트 스크롤을 사용
      if (
        event.target instanceof Element &&
        event.target.closest("textarea, input, [contenteditable='true']")
      ) {
        return;
      }

      event.preventDefault();

      // 화면이나 노드를 드래그하는 중에는 확대 축소 안되게
      if (gestureRef.current) return;

      const rect = viewport.getBoundingClientRect();

      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      // 휠 이동량 픽셀로 환산
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? rect.height
            : 1;
      let delta = event.deltaY * unit;

      // 트랙패드 두 손가락 스크롤과 Shift+휠은 화면 이동, Ctrl+휠·핀치와 마우스 휠은 확대.
      // 트랙패드는 픽셀 단위로 가로 성분이나 작은·소수 이동량을 함께 보낸다.
      const trackpadScroll =
        !event.ctrlKey &&
        !event.metaKey &&
        event.deltaMode === WheelEvent.DOM_DELTA_PIXEL &&
        (event.deltaX !== 0 ||
          !Number.isInteger(event.deltaY) ||
          Math.abs(event.deltaY) < 50);
      if (trackpadScroll || event.shiftKey) {
        const dx = (event.shiftKey ? event.deltaY : event.deltaX) * unit;
        const dy = event.shiftKey ? 0 : delta;
        setCamera((current) => ({
          ...current,
          x: current.x - dx,
          y: current.y - dy,
        }));
        return;
      }
      // 핀치(ctrlKey)는 이동량이 작으므로 조금 더 민감하게 반응시킨다.
      if (event.ctrlKey) delta *= 4;

      //부드러운 확대축소
      const limitedDelta = Math.max(-200, Math.min(delta, 200));
      const factor = Math.exp(-limitedDelta * 0.002);

      setCamera((current) => {
        const zoom = Math.max(
          ZOOM_MIN,
          Math.min(current.zoom * factor, ZOOM_MAX),
        );

        if (zoom === current.zoom) return current;

        const canvasX = (pointerX - current.x) / current.zoom;
        const canvasY = (pointerY - current.y) / current.zoom;

        return {
          x: pointerX - canvasX * zoom,
          y: pointerY - canvasY * zoom,
          zoom,
        }; //맞춰서 카메라 위치 변경
      });
    }

    viewport.addEventListener("wheel", handleWheel, {
      passive: false,
    });

    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Space를 누르고 있는 동안 왼쪽 드래그는 화면 이동이 된다(입력 중에는 제외).
  useEffect(() => {
    function isTyping(target: EventTarget | null) {
      return (
        target instanceof Element &&
        !!target.closest("input, textarea, select, [contenteditable='true']")
      );
    }
    function down(event: KeyboardEvent) {
      if (event.code !== "Space" || event.repeat || isTyping(event.target))
        return;
      if (
        event.target instanceof Element &&
        event.target.closest("button, a, [role='button']") &&
        !event.target.closest("[data-node-id]")
      )
        return;
      event.preventDefault();
      spaceHeldRef.current = true;
      setSpaceHeld(true);
    }
    function up(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      spaceHeldRef.current = false;
      setSpaceHeld(false);
    }
    function reset() {
      spaceHeldRef.current = false;
      setSpaceHeld(false);
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
    };
  }, []);

  function zoomBy(factor: number) {
    const viewport = viewportRef.current;
    if (!viewport || gestureRef.current) return;
    const { width, height } = viewport.getBoundingClientRect();
    setCamera((current) => {
      const zoom = Math.max(
        ZOOM_MIN,
        Math.min(current.zoom * factor, ZOOM_MAX),
      );
      const centerX = (width / 2 - current.x) / current.zoom;
      const centerY = (height / 2 - current.y) / current.zoom;
      return {
        x: width / 2 - centerX * zoom,
        y: height / 2 - centerY * zoom,
        zoom,
      };
    });
  }

  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    const spacePan = event.button === 0 && spaceHeldRef.current;
    if ((event.button !== 1 && !spacePan) || gestureRef.current) return;

    event.preventDefault();
    event.stopPropagation();

    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);

    gestureRef.current = {
      kind: "pan",
      pointerId: event.pointerId,
      button: event.button,
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

  function selectNode(nodeId: string, additive = false) {
    if (gestureRef.current) return;
    setSelectedConnectionId(null);

    setSelectedNodeIds((current) => {
      if (!additive) {
        return current.length === 1 && current[0] === nodeId
          ? current
          : [nodeId];
      }

      return current.includes(nodeId)
        ? current.filter((id) => id !== nodeId)
        : [...current, nodeId];
    });
  }

  function selectConnection(connectionId: string) {
    if (gestureRef.current) return;
    if (
      !workspace.connections.some(
        (connection) => connection.id === connectionId,
      )
    )
      return;
    viewportRef.current?.focus({ preventScroll: true });
    setSelectedNodeIds([]);
    setSelectedConnectionId(connectionId);
  }

  function startMarquee(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (
      event.button !== 0 ||
      gestureRef.current ||
      !viewport ||
      !(event.target instanceof Element) ||
      event.target.closest("[data-node-id], [data-connection-hit]")
    ) {
      return;
    }

    event.preventDefault();
    setSelectedConnectionId(null);
    const rect = viewport.getBoundingClientRect();
    viewport.focus({ preventScroll: true });
    viewport.setPointerCapture(event.pointerId);

    gestureRef.current = {
      kind: "marquee",
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startCanvas: {
        x: (event.clientX - rect.left - camera.x) / camera.zoom,
        y: (event.clientY - rect.top - camera.y) / camera.zoom,
      },
      zoom: camera.zoom,
      initialSelection: [...selectedNodeIds],
      additive: event.shiftKey,
      moved: false,
    };
    if (!event.shiftKey) setSelectedNodeIds([]);
  }

  function changeTool(next: WorkspaceTool) {
    if (gestureRef.current) return;
    setTool(next);
    setEraserPointer(null);
    if (next !== "select") {
      setSelectedNodeIds([]);
      setSelectedConnectionId(null);
    }
  }

  function changePen(patch: Partial<PenSettings>) {
    const next = { ...pen, ...patch };
    setPen(next);
    writePenSettings(next);
  }

  function eraseAlong(
    gesture: Extract<Gesture, { kind: "erase" }>,
    eraser: number[],
  ) {
    dispatchHistory({
      type: "change",
      update: (root) =>
        updateWorkspaceAtPath(root, gesture.path, (document) => {
          const strokes = document.drawing?.strokes;
          if (!strokes?.length) return document;
          const next = eraseStrokes(
            strokes,
            eraser,
            ERASER_RADIUS / gesture.zoom,
            uuidv4,
          );
          if (next === strokes) return document;
          // 선이 잘게 나뉘어 한도를 넘으면 이번 문지르기는 반영하지 않는다.
          if (next.length > MAX_STROKES_PER_CANVAS) {
            gesture.limitHit = true;
            return document;
          }
          return { ...document, drawing: { strokes: next } };
        }),
    });
  }

  function startDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (event.button !== 0 || gestureRef.current || !viewport) return;
    const point = getCanvasPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    const path = canvasPath.slice(0, activeDepth);
    const startPointer = { x: event.clientX, y: event.clientY };

    if (tool === "pen") {
      if (
        (workspace.drawing?.strokes.length ?? 0) >= MAX_STROKES_PER_CANVAS ||
        countDocumentDrawingPoints(rootDocument) >= MAX_DRAWING_POINTS
      ) {
        setNotice(DRAWING_LIMIT_NOTICE);
        return;
      }
      viewport.focus({ preventScroll: true });
      viewport.setPointerCapture(event.pointerId);
      const gesture: Gesture = {
        kind: "draw",
        pointerId: event.pointerId,
        startPointer,
        path,
        points: appendPoint([], point.x, point.y, 0),
        color: pen.color,
        width: pen.width,
        zoom: camera.zoom,
      };
      gestureRef.current = gesture;
      setDrawDraft({
        id: "draft",
        color: pen.color,
        width: pen.width,
        points: gesture.points,
      });
      return;
    }

    viewport.focus({ preventScroll: true });
    viewport.setPointerCapture(event.pointerId);
    dispatchHistory({ type: "begin" });
    const gesture: Gesture = {
      kind: "erase",
      pointerId: event.pointerId,
      startPointer,
      path,
      last: point,
      zoom: camera.zoom,
      limitHit: false,
    };
    gestureRef.current = gesture;
    eraseAlong(gesture, [point.x, point.y]);
  }

  function beginTextEdit() {
    if (!gestureRef.current) dispatchHistory({ type: "begin" });
  }

  function endTextEdit() {
    dispatchHistory({ type: "commit" });
  }

  function undo() {
    if (gestureRef.current) return;
    viewportRef.current?.focus({ preventScroll: true });
    dispatchHistory({ type: "undo" });
    setSelectedNodeIds([]);
    setSelectedConnectionId(null);
  }

  function redo() {
    if (gestureRef.current) return;
    viewportRef.current?.focus({ preventScroll: true });
    dispatchHistory({ type: "redo" });
    setSelectedNodeIds([]);
    setSelectedConnectionId(null);
  }

  function handleWorkspaceKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    // 저장은 입력칸 안에서도 동작해야 한다(브라우저의 "페이지 저장" 대신).
    if (
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      event.key.toLowerCase() === "s" &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void saveWorkspace();
      return;
    }
    if (
      event.defaultPrevented ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229 ||
      (event.target instanceof Element &&
        event.target.closest("input, textarea, [contenteditable='true']"))
    ) {
      return;
    }
    if (event.altKey) {
      if (event.key === "ArrowUp" && activeDepth > 0) {
        event.preventDefault();
        navigateCanvas(canvasPath.slice(0, activeDepth - 1));
      }
      return;
    }
    if (handleEditorShortcut(event)) return;

    if (event.key === "Escape") {
      const gesture = gestureRef.current;
      if (gesture) {
        if (gesture.kind === "node" || gesture.kind === "resize") {
          dispatchHistory({ type: "cancel" });
        } else if (gesture.kind === "marquee") {
          setSelectedNodeIds(gesture.initialSelection);
        } else if (gesture.kind === "pan") {
          setCamera((current) => ({ ...current, ...gesture.startCamera }));
        } else if (gesture.kind === "draw") {
          // 그리던 선은 버린다.
          gesture.points = [];
        } else if (gesture.kind === "erase") {
          dispatchHistory({ type: "cancel" });
        }
        clearGesture();
      } else if (tool !== "select") {
        changeTool("select");
      } else {
        setSelectedNodeIds([]);
        setSelectedConnectionId(null);
      }
      event.preventDefault();
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === "y" && !event.shiftKey) {
        event.preventDefault();
        redo();
      }
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelection();
    }
  }

  /** 노드 추가·복제·전체 선택·방향키 이동·확대 단축키. 처리했으면 true. */
  function handleEditorShortcut(event: ReactKeyboardEvent<HTMLElement>) {
    const key = event.key.toLowerCase();
    const command = event.ctrlKey || event.metaKey;
    if (command && !event.shiftKey && key === "a") {
      event.preventDefault();
      setSelectedConnectionId(null);
      setSelectedNodeIds(workspace.nodes.map((node) => node.id));
      return true;
    }
    if (command && !event.shiftKey && key === "d") {
      event.preventDefault();
      duplicateSelection();
      return true;
    }
    if (command) return false;
    if (event.key.startsWith("Arrow") && selectedNodeIds.length) {
      event.preventDefault();
      const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
      const [dx, dy] =
        event.key === "ArrowLeft"
          ? [-step, 0]
          : event.key === "ArrowRight"
            ? [step, 0]
            : event.key === "ArrowUp"
              ? [0, -step]
              : [0, step];
      nudgeSelection(dx, dy);
      return true;
    }
    // "+"는 대부분의 자판에서 Shift가 필요하므로 확대 키는 Shift와 무관하게 받는다.
    const zoomActions: Record<string, () => void> = {
      "+": () => zoomBy(1.25),
      "=": () => zoomBy(1.25),
      "-": () => zoomBy(0.8),
      _: () => zoomBy(0.8),
      "0": fitCanvas,
    };
    const createActions: Record<string, () => void> = {
      t: () => addNode("text_node"),
      i: () => {
        const nodeId = addNode("image_node");
        if (nodeId) chooseImage(nodeId);
      },
      c: () => addNode("canvas_node"),
      l: () => addNode("link_node"),
      p: () => changeTool(tool === "pen" ? "select" : "pen"),
      e: () => changeTool(tool === "eraser" ? "select" : "eraser"),
    };
    const action =
      zoomActions[key] ?? (event.shiftKey ? undefined : createActions[key]);
    if (!action) return false;
    event.preventDefault();
    action();
    return true;
  }

  function nudgeSelection(dx: number, dy: number) {
    if (gestureRef.current) return;
    setWorkspace((current) => {
      const moving = current.nodes.filter((node) =>
        selectedNodeIds.includes(node.id),
      );
      if (!moving.length) return current;
      // 무한 캔버스가 아니면 선택 전체를 한 덩어리로 경계 안에 둔다.
      let moveX = dx;
      let moveY = dy;
      if (!current.canvas.infinite) {
        const left = Math.min(...moving.map((node) => node.position.x));
        const top = Math.min(...moving.map((node) => node.position.y));
        const right = Math.max(
          ...moving.map((node) => node.position.x + node.width),
        );
        const bottom = Math.max(
          ...moving.map((node) => node.position.y + node.height),
        );
        moveX = Math.max(-left, Math.min(dx, current.canvas.width - right));
        moveY = Math.max(-top, Math.min(dy, current.canvas.height - bottom));
      }
      if (!moveX && !moveY) return current;
      return {
        ...current,
        nodes: current.nodes.map((node) =>
          selectedNodeIds.includes(node.id)
            ? {
                ...node,
                position: {
                  x: node.position.x + moveX,
                  y: node.position.y + moveY,
                },
              }
            : node,
        ),
      };
    });
  }

  function duplicateSelection() {
    if (gestureRef.current || !selectedNodeIds.length) return;
    const copies = duplicateNodes(workspace, selectedNodeIds, 24);
    if (
      [...walkWorkspaceNodes(rootDocument)].length + countNodes(copies.nodes) >
      MAX_WORKSPACE_NODES
    ) {
      setNotice(
        `노드는 프로젝트 전체에서 ${MAX_WORKSPACE_NODES}개까지 만들 수 있어요.`,
      );
      return;
    }
    dispatchHistory({ type: "commit" });
    setWorkspace((current) => ({
      ...current,
      nodes: [...current.nodes, ...copies.nodes],
      connections: [...current.connections, ...copies.connections].slice(
        0,
        MAX_CONNECTIONS,
      ),
    }));
    setSelectedConnectionId(null);
    setSelectedNodeIds(copies.nodes.map((node) => node.id));
  }

  function changeView(
    patch: Pick<WorkspaceDocument["canvas"], "lineStyle" | "grid">,
  ) {
    if (gestureRef.current) return;
    dispatchHistory({ type: "commit" });
    setWorkspace((current) => ({
      ...current,
      canvas: { ...current.canvas, ...patch },
    }));
  }

  function setConnectionColor(connectionId: string, color: ConnectionColor) {
    if (gestureRef.current) return;
    dispatchHistory({ type: "commit" });
    setWorkspace((current) => ({
      ...current,
      connections: current.connections.map((connection) => {
        if (connection.id !== connectionId) return connection;
        // 기본색은 저장하지 않아 이전 문서와 같은 모양을 유지한다.
        const next = { ...connection };
        if (color === DEFAULT_CONNECTION_COLOR) delete next.color;
        else next.color = color;
        return next;
      }),
    }));
  }

  function startNodeDrag(
    event: ReactPointerEvent<HTMLElement>,
    node: WorkspaceNode,
  ) {
    const viewport = viewportRef.current;

    if (event.button !== 0 || gestureRef.current || !viewport) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.shiftKey) {
      selectNode(node.id, true);
      return;
    }

    // 선택된 노드를 잡으면 전체 선택을 유지하고, 다른 노드를 잡으면 교체한다.
    const draggedNodes = selectedNodeIds.includes(node.id)
      ? workspace.nodes.filter((item) => selectedNodeIds.includes(item.id))
      : [node];

    viewport.focus({ preventScroll: true });
    dispatchHistory({ type: "begin" });
    gestureRef.current = {
      kind: "node",
      moved: false,
      pointerId: event.pointerId,
      startPointer: {
        x: event.clientX,
        y: event.clientY,
      },
      startPositions: new Map(
        draggedNodes.map((item) => [item.id, { ...item.position }]),
      ),
      bounds: {
        left: Math.min(...draggedNodes.map((item) => item.position.x)),
        top: Math.min(...draggedNodes.map((item) => item.position.y)),
        right: Math.max(
          ...draggedNodes.map((item) => item.position.x + item.width),
        ),
        bottom: Math.max(
          ...draggedNodes.map((item) => item.position.y + item.height),
        ),
      },
      zoom: camera.zoom,
    };

    setSelectedNodeIds(draggedNodes.map((item) => item.id));
    setSelectedConnectionId(null);
  }

  function startNodeResize(
    event: ReactPointerEvent<HTMLButtonElement>,
    node: WorkspaceNode,
  ) {
    const viewport = viewportRef.current;

    if (event.button !== 0 || gestureRef.current || !viewport) return;

    event.preventDefault();
    event.stopPropagation();

    viewport.focus({ preventScroll: true });
    viewport.setPointerCapture(event.pointerId);

    dispatchHistory({ type: "begin" });
    gestureRef.current = {
      kind: "resize",
      pointerId: event.pointerId,
      startPointer: {
        x: event.clientX,
        y: event.clientY,
      },
      nodeId: node.id,
      startWidth: node.width,
      startHeight: node.height,
      zoom: camera.zoom,
    };

    setSelectedNodeIds([node.id]);
    setSelectedConnectionId(null);
  }

  function getCanvasPoint(clientX: number, clientY: number): Point | null {
    const viewport = viewportRef.current;
    if (!viewport) return null;
    const rect = viewport.getBoundingClientRect();
    return {
      x: (clientX - rect.left - camera.x) / camera.zoom,
      y: (clientY - rect.top - camera.y) / camera.zoom,
    };
  }

  function getConnectionHover(
    clientX: number,
    clientY: number,
    source: ConnectionEndpoint,
  ): { hoveredNodeId: string | null; target: ConnectionEndpoint | null } {
    // 포인터를 뷰포트가 캡처하므로 event.target 대신 실제 커서 아래 요소를 확인한다.
    const element = document.elementFromPoint(clientX, clientY);
    const nodeElement = element?.closest<HTMLElement>("[data-node-id]");
    const nodeId = nodeElement?.dataset.nodeId ?? null;
    const pointer = getCanvasPoint(clientX, clientY);
    const target = pointer
      ? findConnectionTarget(
          workspace.nodes,
          workspace.connections,
          source,
          pointer,
          camera.zoom,
          nodeId,
        )
      : null;
    return {
      hoveredNodeId: target?.nodeId ?? nodeId,
      target,
    };
  }

  function startNodeConnection(
    event: ReactPointerEvent<HTMLButtonElement>,
    node: WorkspaceNode,
    side: ConnectionSide,
  ) {
    const viewport = viewportRef.current;
    if (
      event.button !== 0 ||
      gestureRef.current ||
      !viewport ||
      workspace.connections.length >= MAX_CONNECTIONS
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    viewport.focus({ preventScroll: true });
    viewport.setPointerCapture(event.pointerId);

    const source: ConnectionEndpoint = { nodeId: node.id, side };
    gestureRef.current = {
      kind: "connect",
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      source,
    };
    setConnectionDraft({
      source,
      pointer: getConnectionPoint(node, side),
      hoveredNodeId: node.id,
      target: null,
    });
    setSelectedNodeIds([node.id]);
    setSelectedConnectionId(null);
  }

  function moveGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId) return;

    // 휠 클릭 이동만 가운데 버튼을 보고, 나머지는 왼쪽 버튼이 눌려 있는지 본다.
    const buttonMask = gesture.kind === "pan" && gesture.button === 1 ? 4 : 1;

    if ((event.buttons & buttonMask) === 0) {
      endGesture(event);
      return;
    }

    const deltaX = event.clientX - gesture.startPointer.x;
    const deltaY = event.clientY - gesture.startPointer.y;

    // 클릭·더블클릭 때는 원래 제목 바가 이벤트를 받도록 캡처를 미룬다.
    if (gesture.kind === "node" && !gesture.moved) {
      if (Math.hypot(deltaX, deltaY) < 3) return;
      gesture.moved = true;
      viewportRef.current?.setPointerCapture(event.pointerId);
    }

    if (gesture.kind === "pan") {
      setCamera((current) => ({
        ...current,
        x: gesture.startCamera.x + deltaX,
        y: gesture.startCamera.y + deltaY,
      }));

      return;
    }

    if (gesture.kind === "connect") {
      const pointer = getCanvasPoint(event.clientX, event.clientY);
      if (!pointer) return;
      const hover = getConnectionHover(
        event.clientX,
        event.clientY,
        gesture.source,
      );
      const targetNode = hover.target
        ? workspace.nodes.find((node) => node.id === hover.target?.nodeId)
        : undefined;
      setConnectionDraft({
        source: gesture.source,
        pointer:
          targetNode && hover.target
            ? getConnectionPoint(targetNode, hover.target.side)
            : pointer,
        ...hover,
      });
      return;
    }

    if (gesture.kind === "draw") {
      const pointer = getCanvasPoint(event.clientX, event.clientY);
      if (!pointer) return;
      const points = appendPoint(
        gesture.points,
        pointer.x,
        pointer.y,
        DRAW_MIN_DISTANCE / camera.zoom,
      );
      if (points === gesture.points) return;
      gesture.points = points;
      setDrawDraft({
        id: "draft",
        color: gesture.color,
        width: gesture.width,
        points,
      });
      return;
    }

    if (gesture.kind === "erase") {
      const pointer = getCanvasPoint(event.clientX, event.clientY);
      if (!pointer) return;
      setEraserPointer({ x: event.clientX, y: event.clientY });
      eraseAlong(gesture, [
        gesture.last.x,
        gesture.last.y,
        pointer.x,
        pointer.y,
      ]);
      gesture.last = pointer;
      return;
    }

    if (gesture.kind === "marquee") {
      if (!gesture.moved && Math.hypot(deltaX, deltaY) < 3) return;
      gesture.moved = true;

      const endX = gesture.startCanvas.x + deltaX / gesture.zoom;
      const endY = gesture.startCanvas.y + deltaY / gesture.zoom;
      const rect = {
        x: Math.min(gesture.startCanvas.x, endX),
        y: Math.min(gesture.startCanvas.y, endY),
        width: Math.abs(endX - gesture.startCanvas.x),
        height: Math.abs(endY - gesture.startCanvas.y),
      };
      setSelectionRect(rect);

      // 선택 사각형과 일부라도 겹치는 노드를 선택한다.
      const hits = workspace.nodes.filter(
        (node) =>
          node.position.x < rect.x + rect.width &&
          node.position.x + node.width > rect.x &&
          node.position.y < rect.y + rect.height &&
          node.position.y + node.height > rect.y,
      );
      setSelectedNodeIds([
        ...new Set([
          ...(gesture.additive ? gesture.initialSelection : []),
          ...hits.map((node) => node.id),
        ]),
      ]);
      return;
    }

    if (gesture.kind === "resize") {
      const nextWidth = gesture.startWidth + deltaX / gesture.zoom;
      const nextHeight = gesture.startHeight + deltaY / gesture.zoom;

      setWorkspace((current) => {
        let changed = false;

        const nodes = current.nodes.map((node) => {
          if (node.id !== gesture.nodeId) return node;

          const ratio =
            node.type === "image_node" && node.image
              ? node.image.width / node.image.height
              : 1;
          const axis =
            Math.abs(deltaX) >= Math.abs(deltaY) * ratio ? "width" : "height";
          const { width, height } = fitNodeSize(
            node,
            current.canvas,
            nextWidth,
            nextHeight,
            axis,
          );

          if (width === node.width && height === node.height) return node;

          changed = true;

          return {
            ...node,
            width,
            height,
          };
        });

        return changed ? { ...current, nodes } : current;
      });

      return;
    }

    setWorkspace((current) => {
      // 전체 선택의 이동량을 한 번 제한해 경계에서도 노드 사이 간격을 유지한다.
      const moveX = current.canvas.infinite
        ? deltaX / gesture.zoom
        : Math.max(
            -gesture.bounds.left,
            Math.min(
              deltaX / gesture.zoom,
              current.canvas.width - gesture.bounds.right,
            ),
          );
      const moveY = current.canvas.infinite
        ? deltaY / gesture.zoom
        : Math.max(
            -gesture.bounds.top,
            Math.min(
              deltaY / gesture.zoom,
              current.canvas.height - gesture.bounds.bottom,
            ),
          );
      let changed = false;

      const nodes = current.nodes.map((node) => {
        const startPosition = gesture.startPositions.get(node.id);
        if (!startPosition) return node;

        const x = startPosition.x + moveX;
        const y = startPosition.y + moveY;
        if (x === node.position.x && y === node.position.y) return node;

        changed = true;
        return { ...node, position: { x, y } };
      });

      return changed ? { ...current, nodes } : current;
    });
  }

  function endGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId) return;

    // 취소나 포인터 캡처 해제에서는 연결을 만들지 않는다.
    if (gesture.kind === "connect" && event.type === "pointerup") {
      const { target } = getConnectionHover(
        event.clientX,
        event.clientY,
        gesture.source,
      );
      if (target) {
        const connection: NodeConnection = {
          id: uuidv4(),
          source: gesture.source,
          target,
        };
        setWorkspace((current) => {
          const nodeIds = new Set(current.nodes.map((node) => node.id));
          const key = getConnectionKey(connection);
          if (
            !nodeIds.has(connection.source.nodeId) ||
            !nodeIds.has(connection.target.nodeId) ||
            current.connections.length >= MAX_CONNECTIONS ||
            current.connections.some(
              (existing) => getConnectionKey(existing) === key,
            )
          )
            return current;
          return {
            ...current,
            connections: [...current.connections, connection],
          };
        });
      }
    }

    clearGesture();
  }
  function addNode(type: WorkspaceNode["type"]) {
    const viewport = viewportRef.current;
    if (!viewport || gestureRef.current) return null;
    if (type === "canvas_node" && activeDepth >= MAX_CANVAS_DEPTH) {
      setNotice(
        `작업 공간은 ${MAX_CANVAS_DEPTH}단계까지 넣을 수 있어요. 이 공간에는 캔버스 노드를 더 넣을 수 없어요.`,
      );
      return null;
    }
    if ([...walkWorkspaceNodes(rootDocument)].length >= MAX_WORKSPACE_NODES) {
      setNotice(
        `노드는 프로젝트 전체에서 ${MAX_WORKSPACE_NODES}개까지 만들 수 있어요.`,
      );
      return null;
    }
    const rect = viewport.getBoundingClientRect();
    // 링크 노드는 16:9 영상(480×270)에 제목 바 48px를 더한 크기로 시작한다.
    const size = {
      text_node: [320, 220],
      image_node: [360, 280],
      canvas_node: [260, 140],
      link_node: [480, 318],
    }[type];
    const width = Math.min(
      size[0],
      workspace.canvas.infinite ? 10000 : workspace.canvas.width,
    );
    const height = Math.min(
      size[1],
      workspace.canvas.infinite ? 10000 : workspace.canvas.height,
    );
    const centerX = (rect.width / 2 - camera.x) / camera.zoom;
    const centerY = (rect.height / 2 - camera.y) / camera.zoom;
    const offset = (workspace.nodes.length % 6) * 24;
    const x = workspace.canvas.infinite
      ? centerX - width / 2 + offset
      : Math.max(
          0,
          Math.min(
            centerX - width / 2 + offset,
            workspace.canvas.width - width,
          ),
        );
    const y = workspace.canvas.infinite
      ? centerY - height / 2 + offset
      : Math.max(
          0,
          Math.min(
            centerY - height / 2 + offset,
            workspace.canvas.height - height,
          ),
        );
    const base = { id: uuidv4(), position: { x, y }, width, height, title: "" };
    const node: WorkspaceNode =
      type === "link_node"
        ? { ...base, type, url: "" }
        : type === "image_node"
          ? { ...base, type, image: null }
          : type === "canvas_node"
            ? {
                ...base,
                type,
                title: "새 작업 공간",
                // 새 하위 공간은 지금 공간의 보기 설정(선 모양·점 배경)을 물려받는다.
                document: inheritViewSettings(
                  createWorkspace(),
                  workspace.canvas,
                ),
              }
            : { ...base, type, text: "" };
    setWorkspace((current) => ({
      ...current,
      nodes: [...current.nodes, node],
    }));
    setSelectedNodeIds([node.id]);
    setSelectedConnectionId(null);
    setNotice("");
    setCamera((current) => ({
      ...current,
      x: rect.width / 2 - (x + width / 2) * current.zoom,
      y: rect.height / 2 - (y + height / 2) * current.zoom,
    }));
    // 새 텍스트 노드는 바로 받아 적을 수 있게 본문에 커서를 둔다.
    if (type === "text_node") focusAfterRenderRef.current = node.id;
    return node.id;
  }

  function addTextNode() {
    addNode("text_node");
  }

  function navigateCanvas(path: string[]) {
    if (gestureRef.current) return;
    viewportRef.current?.focus({ preventScroll: true });
    dispatchHistory({ type: "commit" });
    setSelectedNodeIds([]);
    setSelectedConnectionId(null);
    writeCanvasPath(path, "push");
  }

  function exportDocument() {
    const blob = new Blob([JSON.stringify(rootDocument, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${projectTitle.replace(/[\\/:*?"<>|]+/g, "_") || "nono"}.nono.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function loadServerVersion() {
    if (
      window.confirm(
        "서버 버전을 불러오면 이 화면에서 저장하지 못한 편집 내용은 사라집니다. 계속할까요?",
      )
    )
      window.location.reload();
  }

  async function overwriteServerVersion() {
    if (
      conflictBusy ||
      !window.confirm(
        "다른 화면에서 저장한 내용을 지우고 지금 화면의 내용으로 덮어쓸까요?",
      )
    )
      return;
    setConflictBusy(true);
    try {
      const server = await loadWorkspaceDocument(projectId);
      documentVersionRef.current = server.documentVersion;
      unconfirmedSaveRef.current = null;
      setHasConflict(false);
      await saveWorkspace({ overwrite: true });
    } catch {
      setSaveError(
        "서버 버전을 확인하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해주세요.",
      );
    } finally {
      setConflictBusy(false);
    }
  }

  function openCanvas(nodeId: string) {
    if (
      workspace.nodes.some(
        (node) => node.id === nodeId && node.type === "canvas_node",
      )
    )
      navigateCanvas([...canvasPath.slice(0, activeDepth), nodeId]);
  }

  function openImageViewer(nodeId: string) {
    if (gestureRef.current) return;
    setViewerNodeId(nodeId);
  }

  function chooseImage(nodeId: string) {
    imageTargetRef.current = { nodeId, path: canvasPath.slice(0, activeDepth) };
    fileInputRef.current?.click();
  }

  function handlePaste(event: ReactClipboardEvent<HTMLElement>) {
    if (
      gestureRef.current ||
      (event.target instanceof Element &&
        event.target.closest("input, textarea, [contenteditable='true']"))
    )
      return;
    const file = Array.from(event.clipboardData.files).find((file) =>
      file.type.startsWith("image/"),
    );
    if (!file) {
      // 웹 주소 하나를 붙여넣으면 링크 노드로 만든다.
      // 일반 글을 붙여넣은 것과 구분하려고 http(s)://로 시작하는 주소만 받는다.
      const text = event.clipboardData.getData("text/plain").trim();
      const url = /^https?:\/\//i.test(text) ? normalizeLinkUrl(text) : null;
      if (!url) return;
      event.preventDefault();
      const nodeId = addNode("link_node");
      if (nodeId) setLinkUrl(nodeId, url, { commit: false });
      return;
    }
    event.preventDefault();
    const selected =
      selectedNodeIds.length === 1
        ? workspace.nodes.find((node) => node.id === selectedNodeIds[0])
        : undefined;
    const nodeId =
      selected?.type === "image_node" ? selected.id : addNode("image_node");
    if (nodeId)
      void imageUploads.upload(nodeId, file, canvasPath.slice(0, activeDepth));
  }

  /** 링크 노드의 주소를 정하고 서버에 미리보기를 요청한다. */
  function setLinkUrl(
    nodeId: string,
    url: string,
    { commit = true }: { commit?: boolean } = {},
  ) {
    if (gestureRef.current) return;
    if (commit) dispatchHistory({ type: "commit" });
    setWorkspace((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        if (node.id !== nodeId || node.type !== "link_node") return node;
        const next = { ...node, url };
        delete next.preview;
        return next;
      }),
    }));
    void linkPreviews.load(nodeId, url, canvasPath.slice(0, activeDepth));
  }

  function updateNodeTransform(nodeId: string, patch: NodeTransformPatch) {
    if (!gestureRef.current)
      setWorkspace((current) => transformNode(current, nodeId, patch));
  }

  function updateTextStyle(nodeId: string, patch: TextStyle) {
    if (gestureRef.current) return;
    dispatchHistory({ type: "commit" });
    setWorkspace((current) => {
      let changed = false;
      const nodes = current.nodes.map((node) => {
        if (node.id !== nodeId || node.type !== "text_node") return node;
        const textStyle = mergeTextStyle(node.textStyle, patch);
        if (JSON.stringify(textStyle) === JSON.stringify(node.textStyle))
          return node;
        changed = true;
        const next = { ...node, textStyle };
        if (!textStyle) delete next.textStyle;
        return next;
      });
      return changed ? { ...current, nodes } : current;
    });
  }

  function removeNodeImage(nodeId: string) {
    if (gestureRef.current) return;
    dispatchHistory({ type: "commit" });
    setWorkspace((current) => replaceNodeImage(current, nodeId, null));
  }

  function updateTextNode(nodeId: string, patch: TextNodeContentPatch) {
    if (gestureRef.current) return;
    setWorkspace((current) => {
      let changed = false;
      const nodes = current.nodes.map((node) => {
        const titleChanged =
          patch.title !== undefined && patch.title !== node.title;
        const textChanged =
          node.type === "text_node" &&
          patch.text !== undefined &&
          patch.text !== node.text;
        if (node.id !== nodeId || (!titleChanged && !textChanged)) return node;
        changed = true;
        return {
          ...node,
          ...(patch.title === undefined ? {} : { title: patch.title }),
          ...(node.type === "text_node" && patch.text !== undefined
            ? { text: patch.text }
            : {}),
        };
      });
      return changed ? { ...current, nodes } : current;
    });
  }

  function deleteSelection() {
    if (
      (!selectedNodeIds.length && !selectedConnectionId) ||
      gestureRef.current
    )
      return;

    if (
      workspace.nodes.some(
        (node) =>
          node.type === "canvas_node" &&
          node.document.nodes.length > 0 &&
          selectedNodeIds.includes(node.id),
      ) &&
      !window.confirm(
        "선택한 캔버스 노드와 그 안의 작업 공간을 함께 삭제할까요? 실행 취소로 되돌릴 수 있습니다.",
      )
    )
      return;

    // 버튼이 삭제 후 비활성화돼도 포커스가 body로 빠지지 않아 Ctrl+Z가 이어진다.
    viewportRef.current?.focus({ preventScroll: true });

    setWorkspace((current) => {
      const nodes = selectedNodeIds.length
        ? current.nodes.filter((node) => !selectedNodeIds.includes(node.id))
        : current.nodes;
      const connections = current.connections.filter(
        (connection) =>
          connection.id !== selectedConnectionId &&
          !selectedNodeIds.includes(connection.source.nodeId) &&
          !selectedNodeIds.includes(connection.target.nodeId),
      );
      if (
        nodes.length === current.nodes.length &&
        connections.length === current.connections.length
      )
        return current;
      return { ...current, nodes, connections };
    });

    setSelectedNodeIds([]);
    setSelectedConnectionId(null);
  }

  async function saveWorkspace({ overwrite = false } = {}) {
    if (
      savingRef.current ||
      gestureRef.current ||
      (hasConflict && !overwrite) ||
      !hasUnsavedChanges
    )
      return;
    if (imageUploads.isUploading) {
      // 자동 저장은 업로드가 끝나면 다시 시도한다.
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    setSaveError("");
    const documentToSave = rootDocument;

    try {
      // 응답을 놓친 저장은 사용자 재시도 시에만 서버 상태를 확인한다.
      const previous = unconfirmedSaveRef.current;
      if (previous) {
        const server = await loadWorkspaceDocument(projectId);
        if (
          server.documentVersion === previous.version + 1 &&
          JSON.stringify(server.document) === JSON.stringify(previous.document)
        ) {
          documentVersionRef.current = server.documentVersion;
          setSavedDocument(previous.document);
          unconfirmedSaveRef.current = null;
          if (documentToSave === previous.document) return;
        } else if (server.documentVersion !== previous.version) {
          throw new WorkspaceSaveError(
            409,
            "다른 화면에서 먼저 저장했습니다. 현재 내용은 저장되지 않았습니다. 서버 문서를 확인해주세요.",
          );
        }
      }

      const versionToSave = documentVersionRef.current;
      unconfirmedSaveRef.current = {
        document: documentToSave,
        version: versionToSave,
      };
      const version = await saveWorkspaceDocument(
        projectId,
        documentToSave,
        versionToSave,
      );
      documentVersionRef.current = version;
      setSavedDocument(documentToSave);
      setLastSavedAt(new Date());
      setSaveRetryable(true);
      unconfirmedSaveRef.current = null;
    } catch (error) {
      if (error instanceof WorkspaceSaveError) {
        if (error.status >= 400 && error.status < 500)
          unconfirmedSaveRef.current = null;
        setHasConflict(error.status === 409);
        setSaveRetryable(error.status >= 500);
        setSaveError(error.message);
      } else {
        setSaveRetryable(true);
        setSaveError(
          "저장하지 못했습니다. 편집 내용은 이 화면에 남아 있고, 잠시 뒤 자동으로 다시 시도합니다.",
        );
      }
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  useAutosave({
    document: rootDocument,
    pending: hasUnsavedChanges && !hasConflict && (!saveError || saveRetryable),
    failed: !!saveError,
    save: saveWorkspace,
    isBusy: () =>
      savingRef.current || !!gestureRef.current || imageUploads.isUploading,
  });
  const saveStatus = isSaving
    ? "저장 중…"
    : hasConflict
      ? "저장 보류 · 충돌"
      : saveError
        ? "저장하지 못함"
        : hasUnsavedChanges
          ? "편집 중…"
          : lastSavedAt
            ? `저장됨 · ${timeFormat.format(lastSavedAt)}`
            : "모든 변경 사항 저장됨";

  const selectedNode =
    selectedNodeIds.length === 1
      ? workspace.nodes.find((node) => node.id === selectedNodeIds[0])
      : undefined;
  const selectionCount =
    selectedNodeIds.length + (selectedConnectionId ? 1 : 0);
  // 축소할 때 중간 점을 단계적으로 생략해 배경이 빽빽해지지 않도록 한다.
  const gridStep =
    24 * 2 ** Math.max(0, Math.ceil(Math.log2(0.5 / camera.zoom)));
  const dotRadius = Math.max(0.8, camera.zoom);
  const showGrid = workspace.canvas.grid !== false;
  const viewerNode = workspace.nodes.find(
    (node): node is ImageNode & { image: ImageReference } =>
      node.id === viewerNodeId && node.type === "image_node" && !!node.image,
  );
  const selectedConnection = selectedConnectionId
    ? workspace.connections.find(
        (connection) => connection.id === selectedConnectionId,
      )
    : undefined;
  const selectionDescription = selectedConnectionId
    ? "선택한 연결선 삭제 (Delete / Backspace)"
    : `선택한 노드 ${selectedNodeIds.length}개 삭제 (Delete / Backspace)`;

  return (
    <main
      className="fixed inset-0 flex flex-col bg-mist-deep text-bark caret-ink [color-scheme:light]"
      onKeyDown={handleWorkspaceKeyDown}
      onPaste={handlePaste}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        aria-label="이미지 파일 선택"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const target = imageTargetRef.current;
          event.target.value = "";
          imageTargetRef.current = null;
          if (target && file)
            void imageUploads.upload(target.nodeId, file, target.path);
        }}
      />
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-rule bg-white px-4 py-2">
        <Link
          href="/dashboard"
          onNavigate={(event) => {
            if (
              hasUnsavedChanges &&
              !window.confirm(
                "저장하지 않은 변경 사항이 있습니다. 프로젝트 목록으로 이동할까요?",
              )
            ) {
              event.preventDefault();
              return;
            }
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md text-sm text-lichen hover:text-bark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-moss-deep"
        >
          <ArrowLeftIcon />
          프로젝트 목록
        </Link>

        <h1
          className="min-w-0 flex-1 truncate text-sm font-medium"
          title={currentCanvas ? canvasNodeTitle(currentCanvas) : projectTitle}
        >
          {currentCanvas ? canvasNodeTitle(currentCanvas) : projectTitle}
        </h1>

        <div role="group" aria-label="편집 기록" className="flex gap-1">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="실행 취소 (Ctrl+Z)"
            aria-label="실행 취소"
            aria-keyshortcuts="Control+Z Meta+Z"
            className={iconButtonClassName}
          >
            <Image
              src="/icons/undo.png"
              alt=""
              aria-hidden="true"
              width={24}
              height={24}
              unoptimized
              draggable={false}
              className="pointer-events-none h-5 w-5 object-contain opacity-80 select-none"
            />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="다시 실행 (Ctrl+Shift+Z / Ctrl+Y)"
            aria-label="다시 실행"
            aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
            className={iconButtonClassName}
          >
            <Image
              src="/icons/redo.png"
              alt=""
              aria-hidden="true"
              width={24}
              height={24}
              unoptimized
              draggable={false}
              className="pointer-events-none h-5 w-5 object-contain opacity-80 select-none"
            />
          </button>
          <button
            type="button"
            onClick={deleteSelection}
            disabled={selectionCount === 0}
            aria-label={
              selectionCount > 0
                ? `선택 삭제 (${selectionCount}개)`
                : "선택 삭제"
            }
            title={
              selectionCount > 0
                ? selectionDescription
                : "선택 삭제 (Delete / Backspace)"
            }
            aria-keyshortcuts="Delete Backspace"
            className={iconButtonClassName}
          >
            <Image
              src="/icons/trash.png"
              alt=""
              aria-hidden="true"
              width={24}
              height={24}
              unoptimized
              draggable={false}
              className="pointer-events-none h-5 w-5 object-contain opacity-80 select-none"
            />
          </button>
        </div>

        <div
          role="group"
          aria-label="확대·축소"
          className="flex items-center rounded-lg border border-rule bg-white"
        >
          <button
            type="button"
            onClick={() => zoomBy(0.8)}
            aria-label="축소"
            title="축소 (−)"
            aria-keyshortcuts="Minus"
            className={zoomButtonClassName}
          >
            <MinusIcon />
          </button>
          <button
            type="button"
            onClick={fitCanvas}
            title="화면 맞춤 (0)"
            aria-keyshortcuts="0"
            className="h-8 min-w-14 px-1 text-xs text-bark-soft tabular-nums hover:bg-mist focus-visible:outline-2 focus-visible:outline-moss-deep"
          >
            <span className="sr-only">화면 맞춤, 현재 </span>
            {Math.round(camera.zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1.25)}
            aria-label="확대"
            title="확대 (+)"
            aria-keyshortcuts="Plus"
            className={zoomButtonClassName}
          >
            <PlusIcon />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span
            role="status"
            className={`hidden text-xs tabular-nums sm:inline ${saveError || hasConflict ? "text-red-600" : "text-lichen"}`}
          >
            {saveStatus}
          </span>
          <button
            type="button"
            onClick={() => void saveWorkspace()}
            disabled={
              isSaving ||
              imageUploads.isUploading ||
              hasConflict ||
              !hasUnsavedChanges
            }
            aria-busy={isSaving}
            title="지금 저장 (Ctrl+S) · 편집을 멈추면 자동으로 저장돼요"
            aria-keyshortcuts="Control+S Meta+S"
            className={`${quietButtonClassName} ${isSaving ? "cursor-wait" : "disabled:cursor-not-allowed"} disabled:text-lichen`}
          >
            저장
          </button>
          <ShortcutHelp buttonClassName={iconButtonClassName} />
        </div>
        {saveError && !hasConflict && (
          <p role="alert" className="w-full text-xs text-red-600">
            {saveError}
          </p>
        )}
      </header>
      {hasConflict && (
        <ConflictPanel
          busy={conflictBusy}
          onDownload={exportDocument}
          onLoadServer={loadServerVersion}
          onOverwrite={() => void overwriteServerVersion()}
        />
      )}
      {currentCanvas && (
        <nav
          aria-label="작업 공간 경로"
          className="flex shrink-0 items-center gap-3 overflow-x-auto border-b border-rule-soft bg-paper px-4 py-2 text-xs"
        >
          <button
            type="button"
            onClick={() => navigateCanvas(canvasPath.slice(0, activeDepth - 1))}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-mist px-2.5 py-1.5 font-medium text-bark-soft hover:bg-mist-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep"
          >
            <ArrowLeftIcon size={14} />
            상위 작업 공간
          </button>
          <ol className="flex shrink-0 items-center gap-2 text-lichen">
            <li>
              <button
                type="button"
                onClick={() => navigateCanvas([])}
                title={projectTitle}
                className="max-w-44 truncate rounded-sm align-middle hover:text-bark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep"
              >
                {projectTitle}
              </button>
            </li>
            {trail.map((node, index) => (
              <li key={node.id} className="flex items-center gap-2">
                <span aria-hidden="true">/</span>
                {index === activeDepth - 1 ? (
                  <span
                    aria-current="location"
                    title={canvasNodeTitle(node)}
                    className="max-w-44 truncate font-medium text-bark"
                  >
                    {canvasNodeTitle(node)}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      navigateCanvas(canvasPath.slice(0, index + 1))
                    }
                    title={canvasNodeTitle(node)}
                    className="max-w-44 truncate rounded-sm hover:text-bark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep"
                  >
                    {canvasNodeTitle(node)}
                  </button>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <WorkspaceMenu
        key={canvasKey}
        canvas={workspace.canvas}
        onExport={exportDocument}
        onViewChange={changeView}
        onApply={(canvas) => {
          if (gestureRef.current) return "드래그를 마친 뒤 다시 시도해주세요.";
          const result = applyCanvasSettings(workspace, canvas);
          if (result.error) return result.error;
          dispatchHistory({ type: "commit" });
          setWorkspace(() => result.document!);
          return null;
        }}
      />
      {/* 뷰포트  */}
      <div className="relative flex min-h-0 flex-1">
        <WorkspaceToolbar
          onAddTextNode={addTextNode}
          onAddImageNode={() => addNode("image_node")}
          onAddCanvasNode={() => addNode("canvas_node")}
          onAddLinkNode={() => addNode("link_node")}
          canvasDepthLimit={activeDepth >= MAX_CANVAS_DEPTH}
          tool={tool}
          onToolChange={changeTool}
        />
        {tool === "pen" && (
          <DrawOptions
            color={pen.color}
            width={pen.width}
            onColor={(color) => changePen({ color })}
            onWidth={(width) => changePen({ width })}
          />
        )}
        <div
          ref={viewportRef}
          tabIndex={-1}
          className="relative min-h-0 flex-1 overflow-clip outline-none"
          style={{
            backgroundColor: workspace.canvas.infinite
              ? "var(--color-field)"
              : undefined,
            backgroundImage:
              workspace.canvas.infinite && showGrid
                ? `radial-gradient(circle, ${GRID_DOT_COLOR} ${dotRadius}px, transparent ${dotRadius}px)`
                : undefined,
            backgroundSize: `${gridStep * camera.zoom}px ${gridStep * camera.zoom}px`,
            backgroundPosition: `${camera.x}px ${camera.y}px`,
            cursor: isPanning
              ? "grabbing"
              : spaceHeld
                ? "grab"
                : connectionDraft || tool === "pen"
                  ? "crosshair"
                  : tool === "eraser"
                    ? "none"
                    : "default",
          }}
          role="region"
          aria-roledescription="캔버스"
          aria-label={`${currentCanvas ? canvasNodeTitle(currentCanvas) : projectTitle} 캔버스, 노드 ${workspace.nodes.length}개`}
          onPointerDownCapture={startPan}
          onPointerDown={tool === "select" ? startMarquee : startDrawing}
          onPointerMove={(event) => {
            if (tool === "eraser")
              setEraserPointer({ x: event.clientX, y: event.clientY });
            moveGesture(event);
          }}
          onPointerLeave={() => setEraserPointer(null)}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          onLostPointerCapture={endGesture}
          onAuxClick={(event) => {
            if (event.button === 1) event.preventDefault();
          }}
        >
          {/* 캔버스 */}
          <div
            className={`absolute top-0 left-0 origin-top-left ${workspace.canvas.infinite ? "" : "bg-field shadow-card"}`}
            style={{
              width: workspace.canvas.infinite ? 0 : workspace.canvas.width,
              height: workspace.canvas.infinite ? 0 : workspace.canvas.height,
              backgroundImage:
                workspace.canvas.infinite || !showGrid
                  ? undefined
                  : `radial-gradient(circle, ${GRID_DOT_COLOR} ${dotRadius / camera.zoom}px, transparent ${dotRadius / camera.zoom}px)`,
              backgroundSize: `${gridStep}px ${gridStep}px`,
              transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
            }}
          >
            <DrawingLayer
              strokes={workspace.drawing?.strokes ?? []}
              draft={drawDraft}
            />
            <ConnectionLayer
              canvas={workspace.canvas}
              nodes={workspace.nodes}
              connections={workspace.connections}
              draft={connectionDraft}
              selectedConnectionId={selectedConnectionId}
              zoom={camera.zoom}
              onSelect={selectConnection}
            />

            {workspace.nodes.map((node) => {
              const frame = {
                selected: selectedNodeIds.includes(node.id),
                zoom: camera.zoom,
                showPorts:
                  connectionDraft?.source.nodeId === node.id ||
                  connectionDraft?.hoveredNodeId === node.id,
                activePort:
                  connectionDraft?.source.nodeId === node.id
                    ? connectionDraft.source.side
                    : connectionDraft?.target?.nodeId === node.id
                      ? connectionDraft.target.side
                      : null,
                onConnectStart: startNodeConnection,
                onSelect: selectNode,
                onDragStart: startNodeDrag,
                onResizeStart: startNodeResize,
                onChange: updateTextNode,
                onEditStart: beginTextEdit,
                onEditEnd: endTextEdit,
              };
              return node.type === "text_node" ? (
                <TextNodeView key={node.id} {...frame} node={node} />
              ) : node.type === "link_node" ? (
                <LinkNodeView
                  key={node.id}
                  {...frame}
                  node={node}
                  loading={linkPreviews.states[node.id]?.loading ?? false}
                  error={linkPreviews.states[node.id]?.error ?? ""}
                  onSetUrl={setLinkUrl}
                />
              ) : node.type === "canvas_node" ? (
                <CanvasNodeView
                  key={node.id}
                  {...frame}
                  node={node}
                  onOpen={openCanvas}
                />
              ) : (
                <ImageNodeView
                  key={node.id}
                  {...frame}
                  node={node}
                  projectId={projectId}
                  uploading={imageUploads.states[node.id]?.uploading ?? false}
                  error={imageUploads.states[node.id]?.error ?? ""}
                  onChooseImage={chooseImage}
                  onOpenImage={openImageViewer}
                />
              );
            })}
            {selectionRect && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-20 border border-moss-deep bg-moss/15"
                style={{
                  left: selectionRect.x,
                  top: selectionRect.y,
                  width: selectionRect.width,
                  height: selectionRect.height,
                  borderWidth: 1 / camera.zoom,
                }}
              />
            )}
          </div>
          {/* 확대 비율과 무관하게 읽히도록 캔버스 변환 바깥에 둔다. */}
          {workspace.nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-content-center px-6 text-center">
              <div className="rounded-xl bg-paper/90 px-6 py-5 shadow-card backdrop-blur-sm">
                <p className="text-sm font-medium text-bark">
                  {currentCanvas ? "빈 하위 작업 공간" : "빈 작업 공간"}
                </p>
                <p className="mt-1 text-sm break-keep text-lichen">
                  왼쪽 도구 막대나{" "}
                  <kbd className="font-mono text-bark-soft">T</kbd> 키로 첫
                  메모를 추가하세요.
                </p>
              </div>
            </div>
          )}
          {notice && (
            <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
              <p
                role="status"
                className="pointer-events-auto rounded-lg bg-bark px-4 py-2.5 text-sm text-white shadow-float"
              >
                {notice}
              </p>
            </div>
          )}
        </div>
        {viewerNode && (
          <ImageViewer
            key={viewerNode.image.id}
            projectId={projectId}
            node={viewerNode}
            onClose={() => setViewerNodeId(null)}
          />
        )}
        <WorkspaceProperties
          infinite={!!workspace.canvas.infinite}
          open={propertiesOpen}
          node={selectedNode}
          selectionCount={selectedNodeIds.length}
          uploading={
            selectedNode
              ? (imageUploads.states[selectedNode.id]?.uploading ?? false)
              : false
          }
          onToggle={() => setPropertiesOpen((open) => !open)}
          onChange={updateTextNode}
          onTransform={updateNodeTransform}
          onEditStart={beginTextEdit}
          onEditEnd={endTextEdit}
          onChooseImage={chooseImage}
          onOpenImage={openImageViewer}
          onRemoveImage={removeNodeImage}
          onTextStyle={updateTextStyle}
          onSetLinkUrl={setLinkUrl}
          linkLoading={
            selectedNode?.type === "link_node"
              ? (linkPreviews.states[selectedNode.id]?.loading ?? false)
              : false
          }
          onDelete={deleteSelection}
          canvasNodes={workspace.nodes}
          selectedConnection={selectedConnection}
          onConnectionColor={setConnectionColor}
          onReturnToCanvas={() =>
            viewportRef.current?.focus({ preventScroll: true })
          }
        />
      </div>
    </main>
  );
}
