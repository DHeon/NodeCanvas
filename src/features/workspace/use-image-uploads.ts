import { useEffect, useRef, useState } from "react";
import { imageReferenceSchema } from "./workspace-schema";
import type { ImageReference } from "./types";

export async function uploadWorkspaceImage(
  projectId: string,
  file: File,
  signal?: AbortSignal,
): Promise<ImageReference> {
  if (
    !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)
  )
    throw new Error("PNG, JPEG, WebP, GIF 이미지만 사용할 수 있습니다.");
  if (!file.size || file.size > 10 * 1024 * 1024)
    throw new Error("이미지는 10MB 이하로 선택해주세요.");
  const response = await fetch(`/api/projects/${projectId}/images`, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
    signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(body?.message ?? "이미지 업로드에 실패했습니다.");
  return imageReferenceSchema.parse(body);
}

export default function useImageUploads(
  projectId: string,
  onUploaded: (
    nodeId: string,
    image: ImageReference,
    path: readonly string[],
  ) => void,
) {
  const controllers = useRef(new Map<string, AbortController>());
  const [states, setStates] = useState<
    Record<string, { uploading: boolean; error: string }>
  >({});
  useEffect(() => {
    const pending = controllers.current;
    return () => {
      for (const controller of pending.values()) controller.abort();
      pending.clear();
    };
  }, []);
  async function upload(nodeId: string, file: File, path: readonly string[]) {
    controllers.current.get(nodeId)?.abort();
    const controller = new AbortController();
    controllers.current.set(nodeId, controller);
    setStates((current) => ({
      ...current,
      [nodeId]: { uploading: true, error: "" },
    }));
    const timer = setTimeout(
      () => controller.abort(new Error("timeout")),
      30_000,
    );
    try {
      const image = await uploadWorkspaceImage(
        projectId,
        file,
        controller.signal,
      );
      if (controllers.current.get(nodeId) === controller)
        onUploaded(nodeId, image, path);
    } catch (error) {
      if (controllers.current.get(nodeId) !== controller) return;
      setStates((current) => ({
        ...current,
        [nodeId]: {
          uploading: false,
          error: controller.signal.aborted
            ? "업로드 시간이 초과되었습니다. 다시 시도해주세요."
            : error instanceof Error
              ? error.message
              : "이미지 업로드에 실패했습니다.",
        },
      }));
      return;
    } finally {
      clearTimeout(timer);
      if (controllers.current.get(nodeId) === controller)
        controllers.current.delete(nodeId);
    }
    setStates((current) => ({
      ...current,
      [nodeId]: { uploading: false, error: "" },
    }));
  }
  return {
    upload,
    states,
    isUploading: Object.values(states).some((state) => state.uploading),
  };
}
