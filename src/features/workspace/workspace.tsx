"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createNodeId } from "./create-node-id";
import type { PointerEvent as ReactPointerEvent } from "react";
import TextNodeView from "./text-node-view";
import { z } from "zod";
import {
  writeWorkspaceDraft,
  readWorkspaceDrafts,
  removeWorkspaceDraft,
  type WorkspaceDraft,
} from "./workspace-draft";


import type {
  Camera,
  Point,
  TextNode,
  TextNodeContentPatch,
  WorkspaceDocument,
} from "./types";

type WorkspaceProps = {
  projectId: string;
  projectTitle: string;
  initialDocument: WorkspaceDocument;
  initialVersion: number;
  ownerId: string;
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

export default function Workspace({
  ownerId,
  projectId,
  projectTitle,
  initialDocument,
  initialVersion,
}: WorkspaceProps) {
  const [workspace, setWorkspace] =
    useState<WorkspaceDocument>(initialDocument);

  const [savedDocument, setSavedDocument] =
    useState<WorkspaceDocument>(initialDocument);
  const [documentVersion, setDocumentVersion] =
    useState(initialVersion);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const savingRef = useRef(false);
  const draftIdRef = useRef<string | null>(null);
  const [draftError, setDraftError] = useState("");

  const [recoveryDrafts, setRecoveryDrafts] =
    useState<WorkspaceDraft[]>([]);
  const [recoveryError, setRecoveryError] = useState("");


  const hasUnsavedChanges = workspace !== savedDocument;  // 둘이 다른지 비교함. 저장 후 또 수정이 되서 현재 작업 상태와 저장된 작업 상태를 비교
  const persistDraft = useCallback(() => {
    try {
      if (!hasUnsavedChanges) {
        // 서버에 저장된 상태라면 현재 세션의 임시본만 삭제
        if (draftIdRef.current) {
          removeWorkspaceDraft(
            ownerId,
            projectId,
            draftIdRef.current,
          );
        }

        setDraftError("");
        return;
      }

      if (!draftIdRef.current) {
        draftIdRef.current = createNodeId();
      }

      writeWorkspaceDraft({
        formatVersion: 1,
        draftId: draftIdRef.current,
        ownerId,
        projectId,
        baseVersion: documentVersion,
        savedAt: Date.now(),
        document: workspace,
      });

      setDraftError("");
    } catch {
      setDraftError(
        "브라우저 임시 저장에 실패했습니다. 저장 공간이나 브라우저 설정을 확인해주세요. 서버 저장은 별도로 시도할 수 있습니다.",
      );
    }
  }, [
    ownerId,
    projectId,
    documentVersion,
    workspace,
    hasUnsavedChanges,
  ]);

  // 기존 camera, viewportRef, gestureRef 등은 여기 아래에 그대로 유지

  const [camera, setCamera] = useState<Camera>({
    x: 32,
    y: 32,
    zoom: 0.5,
  });

  const viewportRef = useRef<HTMLDivElement>(null); // DOM관련 크기 측정, 이벤트 연결할 때 
  const gestureRef = useRef<Gesture | null>(null); //드래그 시작 시 위치와 어떤거 이동할지 

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null); //선택된 노드가 뭔지
  const [isPanning, setIsPanning] = useState(false); //드래그 상태따라 커서 변경

  const fitCanvas = useCallback(() => { //화면 맞춤
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

  // 드래그 정리
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

  useEffect(() => { //viewportRef의 크기가 바뀌면 fitCanvas
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

  useEffect(() => { // 새로 고침 할 때 변경 사항이 있으면 진짜 새로고침 할건지 물어보게 하는 이벤트 리스너설정
    if (!hasUnsavedChanges) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = true;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const timer = window.setTimeout(persistDraft, 500);

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        persistDraft();
      }
    }

    window.addEventListener("beforeunload", persistDraft);
    window.addEventListener("pagehide", persistDraft);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      window.clearTimeout(timer);

      window.removeEventListener(
        "beforeunload",
        persistDraft,
      );
      window.removeEventListener("pagehide", persistDraft);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [persistDraft]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setRecoveryDrafts(
          readWorkspaceDrafts(ownerId, projectId),
        );
        setRecoveryError("");
      } catch {
        setRecoveryError(
          "브라우저에 보관된 임시 작업을 조회하지 못했습니다.",
        );
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [ownerId, projectId]);

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

    // 현재 화면 중앙 캔버스 좌표 구하기
    const centerX = (rect.width / 2 - camera.x) / camera.zoom;
    const centerY = (rect.height / 2 - camera.y) / camera.zoom;

    // 여러개 생성할때 오프셋 주기
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
  async function saveWorkspace() { // 작업공간 저장하기
    if (savingRef.current || gestureRef.current) return;  //저장 도중이나 드래그 도중에 저장 막음.

    savingRef.current = true;
    setIsSaving(true);
    setSaveError("");

    // 저장을 시작한 시점의 작업공간과 버전이 저장이 됨
    const documentToSave = workspace;  
    const versionToSave = documentVersion;  

    try {
      const response = await fetch(  //projectId를 통해 작업공간의 json 데이터를 저장함
        `/api/projects/${projectId}/document`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            document: documentToSave,
            expectedVersion: versionToSave,
          }),
        },
      );

      if (!response.ok) {
        setSaveError(
          response.status === 409
            ? "다른 화면에서 먼저 저장했습니다. 현재 작업은 유지되지만 저장되지 않았습니다. 새로고침하면 현재 변경 사항이 사라질 수 있습니다."
            : response.status === 401
              ? "로그인이 만료되었습니다."
              : response.status === 400
                ? "문서가 저장 조건에 맞지 않습니다. 제목·본문 길이와 노드 수를 확인해주세요."
                : "저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
        );
        return;
      }

      const result = z.object({
        documentVersion: z.number().int().nonnegative(),
      }).safeParse(await response.json());

      if (
        !result.success ||
        result.data.documentVersion !== versionToSave + 1
      ) {
        setSaveError(
          "저장 결과를 확인하지 못했습니다. 현재 작업을 유지한 채 서버 상태를 확인해주세요.",
        );
        return;
      }

      setDocumentVersion(result.data.documentVersion);  //
      setSavedDocument(documentToSave); // 현재 작업 중인 문서와 저장 버튼을 눌렀을 때의 문서는 다름.
    } catch {
      setSaveError(
        "저장 결과를 확인하지 못했습니다. 연결이 끊겼거나 응답을 받지 못했을 수 있습니다. 현재 작업은 유지됩니다.",
      );
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  function restoreDraft(draftId: string) {
    if (savingRef.current) return;

    try {
      // 목록을 띄운 뒤 다른 탭에서 바뀌었을 수 있어 다시 읽는다.
      const draft = readWorkspaceDrafts(
        ownerId,
        projectId,
      ).find((item) => item.draftId === draftId);

      if (!draft) {
        setRecoveryError(
          "해당 임시 작업이 없어졌습니다. 다시 접속해서 목록을 확인해주세요.",
        );
        return;
      }

      if (
        hasUnsavedChanges &&
        !window.confirm(
          "현재 화면의 미저장 편집 내용을 선택한 임시 작업으로 교체할까요?",
        )
      ) {
        return;
      }

      clearGesture();

      setWorkspace(draft.document);
      setDocumentVersion(draft.baseVersion);
      setSelectedNodeId(null);
      setSaveError("");
      setRecoveryError("");

      // savedDocument는 변경하지 않는다.
      // 복구한 내용은 아직 서버에 저장된 것이 아니다.
    } catch {
      setRecoveryError(
        "임시 작업을 불러오지 못했습니다.",
      );
    }
  }

  function deleteRecoveryDraft(draftId: string) {
    if (savingRef.current) return;

    if (
      !window.confirm(
        "이 임시본을 브라우저에서 삭제할까요? 되돌릴 수 없습니다. 다른 탭에서 편집 중인 작업이라면 그 탭의 복구용 임시본일 수도 있습니다.",
      )
    ) {
      return;
    }

    try {
      removeWorkspaceDraft(
        ownerId,
        projectId,
        draftId,
      );

      setRecoveryDrafts((current) =>
        current.filter((draft) => draft.draftId !== draftId),
      );

      setRecoveryError("");
    } catch {
      setRecoveryError(
        "임시 작업을 삭제하지 못했습니다.",
      );
    }
  }

  return (
    <main className="fixed inset-0 flex flex-col bg-neutral-200 text-neutral-900">
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

            persistDraft();
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
        <button
          type="button"
          onClick={saveWorkspace}
          disabled={isSaving}
          className="shrink-0 rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-50"
        >
          {isSaving ? "저장 중…" : "저장"}
        </button>

        <span
          role="status"
          className="text-xs text-neutral-500"
        >
          {isSaving
            ? "문서를 저장하고 있습니다."
            : hasUnsavedChanges
              ? "저장하지 않은 변경 사항"
              : "변경 사항 없음"}
        </span>

        {saveError && (
          <p role="alert" className="w-full text-xs text-red-600">
            {saveError}
          </p>
        )}
        {draftError && (
          <p role="alert" className="w-full text-xs text-amber-700">
            {draftError}
          </p>
        )}
      </header>
      {recoveryError && (
        <p
          role="alert"
          className="shrink-0 bg-amber-50 px-4 py-2 text-xs text-amber-800"
        >
          {recoveryError}
        </p>
      )}

      {recoveryDrafts.length > 0 && (
        <section
          aria-label="임시 작업 복구"
          className="max-h-48 shrink-0 overflow-y-auto border-b border-amber-200 bg-amber-50 px-4 py-3"
        >
          <h2 className="text-sm font-medium">
            브라우저에 보관된 임시 작업이 있습니다.
          </h2>

          <p className="mt-1 text-xs text-neutral-600">
            복구는 현재 화면에만 적용됩니다. 서버 저장은 별도로
            진행해주세요. 다른 탭에서 작업 중인 임시본도 표시될 수 있습니다.
          </p>

          <ul className="mt-2 space-y-2">
            {recoveryDrafts.map((draft) => (
              <li
                key={draft.draftId}
                className="flex flex-wrap items-center gap-2 text-xs"
              >
                <span className="flex-1">
                  {new Date(draft.savedAt).toLocaleString("ko-KR")}
                  {" · "}
                  노드 {draft.document.nodes.length}개
                  {" · "}
                  기준 버전 {draft.baseVersion}
                </span>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => restoreDraft(draft.draftId)}
                  className="rounded border border-neutral-300 bg-white px-3 py-1 disabled:opacity-50"
                >
                  복구
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => deleteRecoveryDraft(draft.draftId)}
                  className="rounded border border-neutral-300 bg-white px-3 py-1 text-red-700 disabled:opacity-50"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
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
