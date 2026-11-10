import Link from "next/link";
import StateScreen from "@/features/shell/state-screen";
import { primaryButton } from "@/features/shell/styles";

export default function NotFound() {
  return (
    <StateScreen
      title="찾는 페이지가 없어요"
      description="주소가 바뀌었거나, 삭제된 프로젝트이거나, 열 수 있는 권한이 없는 페이지예요."
    >
      <Link href="/dashboard" className={primaryButton}>
        내 프로젝트로 가기
      </Link>
    </StateScreen>
  );
}
