import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Nono | 3주차 개발 발표",
  description:
    "이메일 회원가입과 인증 데이터 저장, 캔버스 작업 공간 프로토타입 구현",
};

const sectionClass = "scroll-mt-6 border-t border-neutral-800 py-14 sm:py-20";
const titleClass =
  "mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl";
const numberClass = "font-mono text-sm tracking-widest text-violet-300";
const cardClass = "rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6";
const linkClass =
  "inline-flex items-center justify-center rounded-lg border border-neutral-600 px-4 py-2.5 text-sm font-medium hover:border-violet-300 hover:text-violet-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400";

const sections = [
  ["progress", "이번 주 목표"],
  ["signup", "회원가입"],
  ["database", "인증 데이터"],
  ["demo", "작업 공간 데모"],
  ["structure", "구현 원리"],
  ["next", "다음 계획"],
];

const authTables = [
  {
    name: "User",
    state: "기존 모델 활용",
    fields: "id · name · email",
    description:
      "사용자의 기본 정보를 저장합니다. 이메일에 unique 제약을 두고 UUID로 사용자를 구분합니다.",
  },
  {
    name: "Account",
    state: "추가 · 가입 시 저장",
    fields: "userId · providerId · password",
    description:
      "사용자와 인증 수단을 연결합니다. 이메일 가입은 credential로 구분하고 password에는 해시를 저장합니다.",
  },
  {
    name: "Session",
    state: "추가 · 다음 주 사용",
    fields: "userId · token · expiresAt",
    description:
      "로그인 상태와 만료 시간을 관리하기 위한 테이블입니다. 이번 주에는 구조만 준비했습니다.",
  },
  {
    name: "Verification",
    state: "추가 · 추후 사용",
    fields: "identifier · value · expiresAt",
    description:
      "이메일 인증과 비밀번호 재설정 등에 사용할 일회성 확인 데이터를 위한 테이블입니다.",
  },
];

const verifyQuery = `SELECT
  u.email,
  a."providerId",
  a.password IS NOT NULL AS has_password
FROM public."user" AS u
JOIN public.account AS a ON a."userId" = u.id;`;

const cameraCode = `// 캔버스 전체의 표시 위치와 배율
transform: \`translate(\${camera.x}px, \${camera.y}px)
            scale(\${camera.zoom})\`

// 확대 배율을 고려한 노드 드래그
const dx = event.clientX - gesture.startX;
const nextX = gesture.x + dx / gesture.zoom;`;

export default function Week3Page() {
  return (
    <main
      id="top"
      className="min-h-screen bg-neutral-950 px-5 text-neutral-100 selection:bg-violet-500/40 sm:px-8"
    >
      <div className="mx-auto max-w-5xl">
        <header className="py-16 sm:py-24">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <p className="font-medium text-violet-300">
              NONO / 3주차 개발 발표
            </p>
            <Link
              href="/pres/week2"
              className="text-neutral-400 underline-offset-4 hover:text-white hover:underline"
            >
              ← 2주차 발표
            </Link>
          </div>
          <h1 className="mt-10 text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
            회원가입 구현, 작업 공간 데모
          </h1>
          <div className="mt-8 flex flex-wrap gap-2 text-xs text-neutral-300">
            {[
              "Better Auth",
              "Zod",
              "Prisma · PostgreSQL",
              "React · TypeScript",
            ].map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-neutral-700 px-3 py-1.5"
              >
                {tech}
              </span>
            ))}
          </div>
        </header>

        <section
          id="progress"
          aria-labelledby="progress-title"
          className={sectionClass}
        >
          <p className={numberClass}>01 / PROGRESS</p>
          <h2 id="progress-title" className={titleClass}>
            회원가입 DB저장
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <article className={cardClass}>
              <p className="text-sm text-violet-300">인증 기능</p>
              <h3 className="mt-3 text-xl font-medium">
                회원가입 화면 → DB 저장
              </h3>
              <p className="mt-3 leading-7 text-neutral-300">
                입력값 검증, 가입 요청, 처리 중 표시, 오류 안내와 계정 저장을
                연결
              </p>
            </article>
            <article className={cardClass}>
              <p className="text-sm text-violet-300">작업 공간 데모</p>
              <h3 className="mt-3 text-xl font-medium">
                캔버스 데모 버전
              </h3>
              <p className="mt-3 leading-7 text-neutral-300">
                화면 구성과 이동, 노드 배치 구현
              </p>
            </article>
          </div>
        </section>

        <section
          id="signup"
          aria-labelledby="signup-title"
          className={sectionClass}
        >
          <p className={numberClass}>02 / SIGN UP</p>
          <h2 id="signup-title" className={titleClass}>
            회원가입
          </h2>
          <Link
            href="/signup"
            target="_blank"
            rel="noopener noreferrer"
            className={`${linkClass} mt-6`}
          >
            회원가입 화면 ↗
          </Link>
        </section>

        <section
          id="database"
          aria-labelledby="database-title"
          className={sectionClass}
        >
          <p className={numberClass}>03 / AUTH DATA</p>
          <h2 id="database-title" className={titleClass}>
            사용자 정보와 인증 정보
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {authTables.map((table) => (
              <article key={table.name} className={cardClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xl font-semibold">{table.name}</h3>
                  <span className="text-xs text-violet-300">{table.state}</span>
                </div>
                <p className="mt-4 font-mono text-xs text-neutral-400">
                  {table.fields}
                </p>
                <p className="mt-3 leading-7 text-neutral-300">
                  {table.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="demo"
          aria-labelledby="demo-title"
          className={sectionClass}
        >
          <p className={numberClass}>04 / LIVE DEMO</p>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <h2 id="demo-title" className={titleClass}>
              작업 공간 프로토타입
            </h2>
            <Link
              href="/pres/demo"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              데모 열기 ↗
            </Link>
          </div>
          <p className="mt-5 text-lg leading-8 text-neutral-300">
          </p>
          <div className="mt-8 overflow-hidden rounded-xl border border-neutral-700 bg-white">
            <iframe
              src="/pres/demo"
              title="Nono 텍스트 노드 작업 공간 시연"
              loading="lazy"
              className="h-[560px] w-full border-0 sm:h-[680px]"
            />
          </div>
        </section>

        <section
          id="structure"
          aria-labelledby="structure-title"
          className={sectionClass}
        >
          <p className={numberClass}>05 / HOW IT WORKS</p>
          <h2 id="structure-title" className={titleClass}>
            노드 데이터와 화면의 위치를 따로 관리
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className={cardClass}>
              <h3 className="text-lg font-medium">화면 구조</h3>
              <div className="mt-5 border border-neutral-600 p-4">
                <p className="text-sm text-violet-200">
                  viewport · 화면에 보이는 영역
                </p>
                <div className="mt-4 border border-dashed border-neutral-600 p-4">
                  <p className="text-sm">board · 1600 × 1000 캔버스</p>
                  <div className="mt-4 border border-neutral-700 bg-neutral-950 p-3 text-sm text-neutral-300">
                    article · 텍스트 노드
                    <br />
                    <span className="text-xs text-neutral-500">
                      input 제목 / textarea 본문
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-neutral-400">
                HTML 요소를 배치하고 CSS transform으로 이동·확대합니다. viewport
                바깥은 overflow: hidden으로 가립니다.
              </p>
            </div>
            <div>
              <dl className="divide-y divide-neutral-800">
                {[
                  [
                    "nodes · useState",
                    "노드의 제목·본문과 캔버스 안의 좌표를 저장합니다.",
                  ],
                  [
                    "camera · useState",
                    "캔버스 전체를 표시할 이동량 x, y와 확대 배율 zoom을 저장합니다.",
                  ],
                  [
                    "gestureRef · useRef",
                    "드래그 시작 좌표를 재렌더링 사이에도 유지해 이동량을 계산합니다.",
                  ],
                  [
                    "viewportRef · useRef",
                    "실제 DOM 요소의 크기를 읽고 휠 이벤트를 연결합니다.",
                  ],
                ].map(([term, description]) => (
                  <div key={term} className="py-4 first:pt-0">
                    <dt className="font-mono text-sm text-violet-200">
                      {term}
                    </dt>
                    <dd className="mt-2 text-sm leading-7 text-neutral-300">
                      {description}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section
          id="next"
          aria-labelledby="next-title"
          className={sectionClass}
        >
          <p className={numberClass}>06 / NEXT STEP</p>
          <h2 id="next-title" className={titleClass}>
            다음은 로그인한 사용자의 공간으로
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <article className={cardClass}>
              <h3 className="text-xl font-medium">이번 주 완료</h3>
              <ul className="mt-5 list-disc space-y-3 pl-5 leading-7 text-neutral-300">
                <li>이메일 회원가입과 입력 오류 안내</li>
                <li>User·Account 저장 확인</li>
                <li>인증용 테이블과 API 구성</li>
                <li>캔버스·텍스트 노드 데모 구현</li>
              </ul>
            </article>
            <article className="rounded-2xl border border-violet-400/40 bg-violet-400/5 p-6">
              <h3 className="text-xl font-medium text-violet-200">
                4주차 계획
              </h3>
              <ul className="mt-5 list-disc space-y-3 pl-5 leading-7 text-neutral-300">
                <li>이메일 로그인·로그아웃 연결</li>
                <li>세션을 통한 로그인 상태 확인</li>
                <li>비로그인 사용자의 페이지 접근 제한</li>
                <li>로그인 사용자 기준 프로젝트 조회·권한 검사</li>
              </ul>
            </article>
          </div>
          <p className="mt-6 text-sm leading-7 text-neutral-400">
            이메일 인증·비밀번호 재설정, 작업 공간의 서버 저장은 이후 개발
            범위입니다.
          </p>
        </section>

        <footer className="flex flex-wrap justify-between gap-4 border-t border-neutral-800 py-8 text-sm text-neutral-400">
          <p>NONO · 3주차 개발 기록</p>
          <a
            href="#top"
            className="underline-offset-4 hover:text-white hover:underline"
          >
            맨 위로 ↑
          </a>
        </footer>
      </div>
    </main>
  );
}
