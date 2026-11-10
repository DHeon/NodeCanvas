import Link from "next/link";
import type { Metadata } from "next";
import HomeCanvas from "@/features/home/home-canvas";
import styles from "@/features/home/home.module.css";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "nono · 생각을 펼쳐두는 캔버스",
  description:
    "메모와 이미지를 캔버스에 자유롭게 놓고 선으로 이어 생각을 정리하는 노드 기반 작업 공간.",
};

export default async function HomePage() {
  const signedIn = Boolean(await getSession());
  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main-content">
        본문으로 건너뛰기
      </a>
      <header className={styles.header}>
        <div className={styles.navigation}>
          <Link href="/" className={styles.brand} aria-label="nono 홈">
            nono.
          </Link>
          <nav aria-label="메인 메뉴" className={styles.navLinks}>
            {signedIn ? (
              <Link href="/dashboard">내 프로젝트</Link>
            ) : (
              <>
                <Link href="/login">로그인</Link>
                <Link href="/signup">회원가입</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main-content" className={styles.container}>
        <div className={styles.actions}>
          <div>
            <h1>떠오른 생각을 캔버스에 펼쳐두세요</h1>
            <p className={styles.lede}>
              메모와 이미지를 자유롭게 놓고 선으로 이어 보세요. 생각이 커지면
              노드 안에 또 하나의 캔버스를 열어 깊이 정리할 수 있어요.
            </p>
          </div>
          <div className={styles.ctaGroup}>
            {signedIn ? (
              <Link href="/dashboard" className={styles.dashboardLink}>
                내 프로젝트로 가기
              </Link>
            ) : (
              <>
                <Link href="/login" className={styles.secondaryLink}>
                  로그인
                </Link>
                <Link href="/signup" className={styles.dashboardLink}>
                  시작하기
                </Link>
              </>
            )}
          </div>
        </div>
        <section aria-label="체험 캔버스">
          <HomeCanvas />
        </section>
      </main>
    </div>
  );
}
