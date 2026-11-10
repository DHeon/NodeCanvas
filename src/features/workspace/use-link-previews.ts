"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LinkPreview } from "./link-embed";

type PreviewState = { loading: boolean; error: string };

/**
 * 링크 노드의 미리보기를 서버에 요청한다. 같은 노드에 새 요청이 오면 이전 요청을 취소하고,
 * 결과는 요청할 때의 공간 경로·주소와 함께 넘겨 다른 공간으로 옮겨도 원래 노드에만 적용되게 한다.
 */
export default function useLinkPreviews(
  onLoaded: (
    nodeId: string,
    url: string,
    preview: LinkPreview,
    path: readonly string[],
  ) => void,
) {
  const [states, setStates] = useState<Record<string, PreviewState>>({});
  const controllers = useRef(new Map<string, AbortController>());
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  });
  useEffect(() => {
    const active = controllers.current;
    return () => {
      for (const controller of active.values()) controller.abort();
    };
  }, []);

  const load = useCallback(
    async (nodeId: string, url: string, path: readonly string[]) => {
      controllers.current.get(nodeId)?.abort();
      const controller = new AbortController();
      controllers.current.set(nodeId, controller);
      setStates((current) => ({
        ...current,
        [nodeId]: { loading: true, error: "" },
      }));
      let error = "";
      try {
        const response = await fetch("/api/link-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
          signal: controller.signal,
        });
        const body = await response.json().catch(() => ({}));
        if (response.ok && body?.preview)
          onLoadedRef.current(nodeId, url, body.preview as LinkPreview, path);
        else {
          error =
            typeof body?.message === "string"
              ? body.message
              : "페이지 정보를 가져오지 못했습니다.";
          // 열 수 없는 페이지도 카드로는 보여줄 수 있게 빈 미리보기를 남긴다.
          onLoadedRef.current(nodeId, url, { embeddable: false }, path);
        }
      } catch {
        if (controller.signal.aborted) return;
        error = "페이지 정보를 가져오지 못했습니다.";
        onLoadedRef.current(nodeId, url, { embeddable: false }, path);
      }
      if (controllers.current.get(nodeId) !== controller) return;
      controllers.current.delete(nodeId);
      setStates((current) => ({
        ...current,
        [nodeId]: { loading: false, error },
      }));
    },
    [],
  );

  return { states, load };
}
