import Link from "next/link";
import type { Metadata } from "next";
import HomeCanvas from "@/features/home/home-canvas";
import styles from "@/features/home/home.module.css";

export const metadata: Metadata = {
  title: "nono",
  description: "노드 기반 작업 공간.",
};

export default function HomePage() {
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
            <Link href="/login">로그인</Link>
            <Link href="/signup">회원가입</Link>
          </nav>
        </div>
      </header>
      <main id="main-content" className={styles.container}>
        <div className={styles.actions}>
          <h1>작업 공간 체험</h1>
          <Link href="/dashboard" className={styles.dashboardLink}>
            대시보드로 이동 <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <section aria-label="작업 공간 체험 캔버스">
          <HomeCanvas />
        </section>
      </main>
    </div>
  );
}
