"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ClipboardEvent as ReactClipboardEvent,
} from "react";
import TextNodeView from "./text-node-view";
import ImageNodeView from "./image-node-view";
import WorkspaceInspector from "./workspace-inspector";
import useImageUploads from "./use-image-uploads";
import { fitNodeSize, replaceNodeImage, transformNode } from "./node-transform";
import WorkspaceToolbar from "./workspace-toolbar";
import WorkspaceMenu from "./workspace-menu";
import { applyCanvasSettings, getFitCamera } from "./canvas-settings";
import ConnectionLayer from "./connection-layer";
import { expandLegacyCanvas } from "./create-workspace";
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
      startPointer: Point;
      startCamera: Point;
    }
  | {
      kind: "node";
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
    };

type SelectionRect = Point & { width: number; height: number };
const iconButtonClassName =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-neutral-300 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-40";

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
  const workspace = history.present;
  const workspaceRef = useRef(workspace);
  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);
  const setWorkspace = useCallback(
    (update: (document: WorkspaceDocument) => WorkspaceDocument) => {
      dispatchHistory({ type: "change", update });
    },
    [],
  );

  const [camera, setCamera] = useState<Camera>({
    x: 32,
    y: 32,
    zoom: 0.5,
  });

  const viewportRef = useRef<HTMLDivElement>(null); // DOM관련 크기 측정, 이벤트 연결할 때
  const gestureRef = useRef<Gesture | null>(null); //드래그 시작 시 위치와 어떤거 이동할지

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageTargetRef = useRef<string | null>(null);
  const pendingImagesRef = useRef<{ nodeId: string; image: ImageReference }[]>(
    [],
  );
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const [savedDocument, setSavedDocument] = useState(initialDocument);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [hasConflict, setHasConflict] = useState(false);
  const savingRef = useRef(false);
  const documentVersionRef = useRef(initialVersion);
  const unconfirmedSaveRef = useRef<{
    document: WorkspaceDocument;
    version: number;
  } | null>(null);
  const hasUnsavedChanges = workspace !== savedDocument;

  // 미저장 이탈 경고만 유지한다. 브라우저에 문서를 저장하지는 않는다.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = true;
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(null);
  const [connectionDraft, setConnectionDraft] =
    useState<ConnectionDraft | null>(null);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(
    null,
  );
  const [isPanning, setIsPanning] = useState(false); //드래그 상태따라 커서 변경
  const hasPendingEdit =
    history.transactionStart !== null && history.transactionStart !== workspace;
  const canUndo = history.past.length > 0 || hasPendingEdit;
  const canRedo = history.future.length > 0 && !hasPendingEdit;

  const fitCanvas = useCallback(() => {
    //화면 맞춤
    const viewport = viewportRef.current;

    if (!viewport || gestureRef.current) return;

    const { width, height } = viewport.getBoundingClientRect();

    if (width <= 0 || height <= 0) return;

    setCamera(getFitCamera(workspaceRef.current, width, height));
  }, [
    workspace.canvas.width,
    workspace.canvas.height,
    workspace.canvas.infinite,
  ]);

  // 드래그 정리
  const clearGesture = useCallback(() => {
    const gesture = gestureRef.current;
    const viewport = viewportRef.current;

    gestureRef.current = null;
    setIsPanning(false);
    setSelectionRect(null);
    setConnectionDraft(null);

    if (gesture?.kind === "node" || gesture?.kind === "resize") {
      dispatchHistory({ type: "commit" });
    }

    for (const { nodeId, image } of pendingImagesRef.current) {
      dispatchHistory({
        type: "change",
        update: (document) => replaceNodeImage(document, nodeId, image),
      });
    }
    pendingImagesRef.current = [];

    if (gesture && viewport?.hasPointerCapture(gesture.pointerId)) {
      viewport.releasePointerCapture(gesture.pointerId);
    }
  }, []);

  const imageUploads = useImageUploads(projectId, (nodeId, image) => {
    if (gestureRef.current) {
      pendingImagesRef.current.push({ nodeId, image });
      return;
    }
    dispatchHistory({ type: "commit" });
    setWorkspace((current) => replaceNodeImage(current, nodeId, image));
    if (document.activeElement?.matches("input, textarea"))
      dispatchHistory({ type: "begin" });
  });

  useEffect(() => {
    window.addEventListener("blur", clearGesture);
    return () => window.removeEventListener("blur", clearGesture);
  }, [clearGesture]);

  useEffect(() => {
    //viewportRef의 크기가 바뀌면 fitCanvas
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
      let delta = event.deltaY;

      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        delta *= 16;
      } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        delta *= rect.height;
      }

      //부드러운 확대축소
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
    if (
      event.defaultPrevented ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229 ||
      event.altKey ||
      (event.target instanceof Element &&
        event.target.closest("input, textarea, [contenteditable='true']"))
    ) {
      return;
    }

    if (event.key === "Escape") {
      const gesture = gestureRef.current;
      if (gesture) {
        if (gesture.kind === "node" || gesture.kind === "resize") {
          dispatchHistory({ type: "cancel" });
        } else if (gesture.kind === "marquee") {
          setSelectedNodeIds(gesture.initialSelection);
        } else if (gesture.kind === "pan") {
          setCamera((current) => ({ ...current, ...gesture.startCamera }));
        }
        clearGesture();
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

  function startNodeDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
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
    viewport.setPointerCapture(event.pointerId);

    dispatchHistory({ type: "begin" });
    gestureRef.current = {
      kind: "node",
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
    if (!viewport || gestureRef.current || workspace.nodes.length >= 1000)
      return null;
    const rect = viewport.getBoundingClientRect();
    const width = Math.min(
      type === "image_node" ? 360 : 320,
      workspace.canvas.infinite ? 10000 : workspace.canvas.width,
    );
    const height = Math.min(
      type === "image_node" ? 280 : 220,
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
      type === "image_node"
        ? { ...base, type, image: null }
        : { ...base, type, text: "" };
    setWorkspace((current) => ({
      ...current,
      nodes: [...current.nodes, node],
    }));
    setSelectedNodeIds([node.id]);
    setSelectedConnectionId(null);
    setCamera((current) => ({
      ...current,
      x: rect.width / 2 - (x + width / 2) * current.zoom,
      y: rect.height / 2 - (y + height / 2) * current.zoom,
    }));
    return node.id;
  }

  function addTextNode() {
    addNode("text_node");
  }

  function chooseImage(nodeId: string) {
    imageTargetRef.current = nodeId;
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
    if (!file) return;
    event.preventDefault();
    const selected =
      selectedNodeIds.length === 1
        ? workspace.nodes.find((node) => node.id === selectedNodeIds[0])
        : undefined;
    const nodeId =
      selected?.type === "image_node" ? selected.id : addNode("image_node");
    if (nodeId) void imageUploads.upload(nodeId, file);
  }

  function updateNodeTransform(nodeId: string, patch: NodeTransformPatch) {
    if (!gestureRef.current)
      setWorkspace((current) => transformNode(current, nodeId, patch));
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

  async function saveWorkspace() {
    if (
      savingRef.current ||
      gestureRef.current ||
      hasConflict ||
      !hasUnsavedChanges
    )
      return;
    if (imageUploads.isUploading) {
      setSaveError("이미지 업로드가 끝난 뒤 저장해주세요.");
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    setSaveError("");
    const documentToSave = workspace;

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
      unconfirmedSaveRef.current = null;
    } catch (error) {
      if (error instanceof WorkspaceSaveError) {
        if (error.status >= 400 && error.status < 500)
          unconfirmedSaveRef.current = null;
        setHasConflict(error.status === 409);
        setSaveError(error.message);
      } else {
        setSaveError(
          "저장 결과를 확인하지 못했습니다. 현재 화면의 편집 내용은 유지됩니다. 연결 상태를 확인한 뒤 다시 저장해주세요.",
        );
      }
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

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
  const selectionDescription = selectedConnectionId
    ? "선택한 연결선 삭제 (Delete / Backspace)"
    : `선택한 노드 ${selectedNodeIds.length}개 삭제 (Delete / Backspace)`;

  return (
    <main
      className="fixed inset-0 flex flex-col bg-neutral-200 text-neutral-900"
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
          const nodeId = imageTargetRef.current;
          event.target.value = "";
          imageTargetRef.current = null;
          if (nodeId && file) void imageUploads.upload(nodeId, file);
        }}
      />
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-neutral-300 bg-white px-4 py-2">
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
          className="shrink-0 text-sm text-neutral-600 hover:text-neutral-900"
        >
          ← 프로젝트 목록
        </Link>

        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">
          작업 공간 · {projectTitle}
        </h1>

        <span className="ml-auto shrink-0 text-sm text-neutral-500">
          {Math.round(camera.zoom * 100)}%
        </span>
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
            className="pointer-events-none h-6 w-6 object-contain select-none"
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
            className="pointer-events-none h-6 w-6 object-contain select-none"
          />
        </button>
        <button
          type="button"
          onClick={deleteSelection}
          disabled={selectionCount === 0}
          aria-label={
            selectionCount > 0 ? `선택 삭제 (${selectionCount}개)` : "선택 삭제"
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
            className="pointer-events-none h-6 w-6 object-contain select-none"
          />
        </button>
        <button
          type="button"
          onClick={fitCanvas}
          className="shrink-0 rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          화면 맞춤
        </button>
        <button
          type="button"
          onClick={saveWorkspace}
          disabled={
            isSaving ||
            imageUploads.isUploading ||
            hasConflict ||
            !hasUnsavedChanges
          }
          className="shrink-0 rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-50"
        >
          {isSaving ? "저장 중…" : "저장"}
        </button>

        <span role="status" className="text-xs text-neutral-500">
          {isSaving
            ? "저장 중…"
            : saveError
              ? "저장 실패 · 편집 내용은 현재 화면에만 유지됨"
              : hasUnsavedChanges
                ? "저장하지 않은 변경 사항"
                : "변경 사항 없음"}
        </span>
        {saveError && (
          <p role="alert" className="w-full text-xs text-red-600">
            {saveError}
            {hasConflict && (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "새로고침하면 현재 미저장 편집 내용을 잃게 됩니다. 최신 서버 문서를 불러올까요?",
                    )
                  )
                    window.location.reload();
                }}
                className="ml-2 underline"
              >
                서버 문서 확인
              </button>
            )}
          </p>
        )}
      </header>
      <WorkspaceMenu
        canvas={workspace.canvas}
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
        />
        <div
          ref={viewportRef}
          tabIndex={-1}
          className="relative min-h-0 flex-1 overflow-clip outline-none"
          style={{
            backgroundColor: workspace.canvas.infinite ? "#fff" : undefined,
            backgroundImage: workspace.canvas.infinite
              ? `radial-gradient(circle, #b8bcc4 ${dotRadius}px, transparent ${dotRadius}px)`
              : undefined,
            backgroundSize: `${gridStep * camera.zoom}px ${gridStep * camera.zoom}px`,
            backgroundPosition: `${camera.x}px ${camera.y}px`,
            cursor: isPanning
              ? "grabbing"
              : connectionDraft
                ? "crosshair"
                : "default",
          }}
          aria-label="작업 공간 뷰포트"
          onPointerDownCapture={startPan}
          onPointerDown={startMarquee}
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
            className={`absolute top-0 left-0 origin-top-left ${workspace.canvas.infinite ? "" : "bg-white shadow-sm"}`}
            style={{
              width: workspace.canvas.infinite ? 0 : workspace.canvas.width,
              height: workspace.canvas.infinite ? 0 : workspace.canvas.height,
              backgroundImage: workspace.canvas.infinite
                ? undefined
                : `radial-gradient(circle, #b8bcc4 ${dotRadius / camera.zoom}px, transparent ${dotRadius / camera.zoom}px)`,
              backgroundSize: `${gridStep}px ${gridStep}px`,
              transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
            }}
          >
            <ConnectionLayer
              canvas={workspace.canvas}
              nodes={workspace.nodes}
              connections={workspace.connections}
              draft={connectionDraft}
              selectedConnectionId={selectedConnectionId}
              zoom={camera.zoom}
              onSelect={selectConnection}
            />
            {workspace.nodes.length === 0 && !workspace.canvas.infinite && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-neutral-400">
                빈 작업 공간
              </div>
            )}

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
              ) : (
                <ImageNodeView
                  key={node.id}
                  {...frame}
                  node={node}
                  projectId={projectId}
                  uploading={imageUploads.states[node.id]?.uploading ?? false}
                  error={imageUploads.states[node.id]?.error ?? ""}
                  onChooseImage={chooseImage}
                />
              );
            })}
            {selectionRect && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-20 border border-blue-500 bg-blue-500/10"
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
        </div>
        <WorkspaceInspector
          infinite={!!workspace.canvas.infinite}
          open={inspectorOpen}
          node={selectedNode}
          selectionCount={selectedNodeIds.length}
          uploading={
            selectedNode
              ? (imageUploads.states[selectedNode.id]?.uploading ?? false)
              : false
          }
          onToggle={() => setInspectorOpen((open) => !open)}
          onChange={updateTextNode}
          onTransform={updateNodeTransform}
          onEditStart={beginTextEdit}
          onEditEnd={endTextEdit}
          onChooseImage={chooseImage}
          onRemoveImage={removeNodeImage}
          onDelete={deleteSelection}
          onReturnToCanvas={() =>
            viewportRef.current?.focus({ preventScroll: true })
          }
        />
      </div>
    </main>
  );
}
