"use client"; // 오류 경계는 클라이언트 컴포넌트여야 한다.

import Link from "next/link";
import { useEffect } from "react";
import StateScreen from "@/features/shell/state-screen";
import { primaryButton, quietButton } from "@/features/shell/styles";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StateScreen
      title="화면을 불러오지 못했어요"
      description="잠시 후 다시 시도해주세요. 저장된 프로젝트 내용은 서버에 그대로 남아 있어요."
    >
      <button type="button" onClick={() => retry()} className={primaryButton}>
        다시 시도
      </button>
      <Link href="/dashboard" className={quietButton}>
        내 프로젝트로 가기
      </Link>
    </StateScreen>
  );
}
