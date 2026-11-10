"use client";

import { useEffect, useRef } from "react";

/** 편집이 멈춘 뒤 서버 저장까지 기다리는 시간. */
export const AUTOSAVE_DELAY = 1500;
/** 다시 시도할 수 있는 실패(통신·서버 오류) 뒤 재시도 간격. */
export const AUTOSAVE_RETRY_DELAY = 10000;
const BUSY_POLL = 500;

type AutosaveOptions = {
  /** 편집마다 바뀌는 값(루트 문서). 바뀔 때마다 대기 시간을 다시 잰다. */
  document: unknown;
  /** 저장할 변경이 있고 자동 저장이 허용된 상태인지. */
  pending: boolean;
  /** 직전 저장이 다시 시도할 수 있는 이유로 실패했는지. */
  failed: boolean;
  save: () => unknown;
  /** 드래그·업로드·저장 중이면 잠시 뒤 다시 확인한다. */
  isBusy: () => boolean;
};

/**
 * 서버 자동 저장. 브라우저 저장소에는 문서를 남기지 않는다.
 * 저장 자체(버전 확인·409 처리)는 호출한 쪽의 save가 맡는다.
 */
export function useAutosave({
  document,
  pending,
  failed,
  save,
  isBusy,
}: AutosaveOptions) {
  const saveRef = useRef(save);
  const busyRef = useRef(isBusy);
  useEffect(() => {
    saveRef.current = save;
    busyRef.current = isBusy;
  });

  useEffect(() => {
    if (!pending) return;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = () => {
      if (busyRef.current()) {
        timer = setTimeout(attempt, BUSY_POLL);
        return;
      }
      void saveRef.current();
    };
    timer = setTimeout(attempt, failed ? AUTOSAVE_RETRY_DELAY : AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [document, pending, failed]);
}
