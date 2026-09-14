import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Nono | 2주차 개발 발표",
  description:
    "Docker와 PostgreSQL 환경 구성부터 Prisma를 통한 대시보드 데이터 조회까지",
};

const sections = [
  { id: "goal", title: "이번 주 목표" },
  { id: "database", title: "DB 환경 구성" },
  { id: "schema", title: "테이블 설계" },
  { id: "seed", title: "개발용 데이터" },
  { id: "dashboard", title: "대시보드 연결" },
  { id: "demo", title: "시연과 다음 계획" },
];

const userFields = [
  ["id", "UUID · 기본키"],
  ["name", "사용자 이름"],
  ["email", "이메일 · 중복 불가"],
  ["emailVerified", "이메일 인증 여부"],
  ["image", "프로필 이미지 · 선택"],
  ["createdAt / updatedAt", "생성·수정 시각"],
];

const projectFields = [
  ["id", "UUID · 기본키"],
  ["title", "프로젝트 제목 · 최대 120자"],
  ["ownerId", "소유 사용자 ID · 외래키"],
  ["createdAt / updatedAt", "생성·수정 시각"],
];

const query = `const projects = await prisma.project.findMany({
  where: { owner: { email: "demo@nono.local" } },
  orderBy: { updatedAt: "desc" },
  select: { id: true, title: true },
});`;

const sectionClass = "scroll-mt-8 border-t border-neutral-800 py-16 sm:py-20";
const titleClass = "mt-3 text-3xl font-semibold tracking-tight sm:text-4xl";
const numberClass = "font-mono text-sm tracking-widest text-violet-300";
const cardClass = "rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6";
const linkClass =
  "rounded-xl px-5 py-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400";

export default function Week2Page() {
  return (
    <main className="min-h-screen bg-neutral-950 px-6 text-neutral-100 selection:bg-violet-500/40">
      <div className="mx-auto max-w-5xl">
        <header className="pt-12 pb-16 sm:pt-20 sm:pb-24">
          <p className="mt-16 text-sm font-medium text-violet-300">
            2주차 · 데이터베이스 기반 구축
          </p>
          <h1 className="mt-5 text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
            DB
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-300">
            PostgreSQL에 사용자와 프로젝트를 저장하고,
            <br className="hidden sm:block" />
            Prisma로 조회한 데이터를 대시보드 카드에 연결했습니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-2 text-xs text-neutral-300">
            {[
              "Docker Compose",
              "PostgreSQL 18.6",
              "Prisma 7",
              "Next.js 16",
            ].map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-neutral-700 px-3 py-1.5"
              >
                {tech}
              </span>
            ))}
          </div>
          <nav
            aria-label="발표 목차"
            className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {sections.map((section, index) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-lg border border-neutral-800 px-4 py-3 text-sm text-neutral-300 transition hover:border-violet-400 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400"
              >
                <span className="mr-3 font-mono text-violet-300">
                  0{index + 1}
                </span>
                {section.title}
              </a>
            ))}
          </nav>
        </header>

        <section
          id="goal"
          aria-labelledby="goal-title"
          className={sectionClass}
        >
          <p className={numberClass}>01 / GOAL</p>
          <h2 id="goal-title" className={titleClass}>
            임시 목록을 실제 데이터로 전환
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <article className={cardClass}>
              <h3 className="text-sm font-medium text-neutral-400">1주차</h3>
              <p className="mt-4 text-xl font-medium">
                페이지와 프로젝트 카드 UI
              </p>
              <p className="mt-3 leading-7 text-neutral-300">
                코드에 작성한 임시 배열을 화면에 표시했습니다.
              </p>
            </article>
            <article className="rounded-2xl border border-violet-400/40 bg-violet-400/5 p-6">
              <h3 className="text-sm font-medium text-violet-300">2주차</h3>
              <p className="mt-4 text-xl font-medium">
                DB에 저장된 프로젝트 조회
              </p>
              <p className="mt-3 leading-7 text-neutral-300">
                사용자와 프로젝트의 관계를 만들고, 서버에서 조회한 결과로 카드를
                표시합니다.
              </p>
            </article>
          </div>
        </section>

        <section
          id="schema"
          aria-labelledby="schema-title"
          className={sectionClass}
        >
          <p className={numberClass}>02 / DATA MODEL</p>
          <h2 id="schema-title" className={titleClass}>
            사용자 1명, 프로젝트 여러 개
          </h2>
          <p className="mt-5 text-lg leading-8 text-neutral-300">
            Project의 ownerId가 User의 id를 참조하는 1:N 관계를 구성했습니다.
          </p>
          <div className="mt-8 grid items-start gap-5 md:grid-cols-[1fr_auto_1fr]">
            {[
              { name: "User", table: "user", fields: userFields },
              { name: "Project", table: "project", fields: projectFields },
            ].map((model, index) => (
              <div key={model.name} className="contents">
                {index === 1 && (
                  <p
                    className="self-center text-center font-mono text-violet-300"
                    aria-label="한 명의 사용자가 여러 프로젝트를 소유"
                  >
                    1 → N
                  </p>
                )}
                <article className="min-w-0 overflow-hidden rounded-2xl border border-neutral-700">
                  <h3 className="border-b border-neutral-700 bg-neutral-900 px-5 py-4 text-xl font-semibold">
                    {model.name}{" "}
                    <span className="ml-2 text-sm font-normal text-neutral-400">
                      {model.table}
                    </span>
                  </h3>
                  <dl className="divide-y divide-neutral-800 px-5">
                    {model.fields.map(([field, description]) => (
                      <div key={field} className="py-3">
                        <dt className="font-mono text-sm text-violet-200">
                          {field}
                        </dt>
                        <dd className="mt-1 text-sm text-neutral-300">
                          {description}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </article>
              </div>
            ))}
          </div>
          <p className="mt-6 leading-7 text-neutral-300">
            이메일 중복을 막는 unique 제약과 소유자별 조회를 위한 인덱스를
            추가했습니다. Prisma migration으로 SQL을 생성해 DB에 적용하고, 구조
            변경 이력을 파일로 남겼습니다.
          </p>
        </section>

        <section
          id="dashboard"
          aria-labelledby="dashboard-title"
          className={sectionClass}
        >
          <p className={numberClass}>03 / INTEGRATION</p>
          <h2 id="dashboard-title" className={titleClass}>
            DB 조회 결과를 프로젝트 카드로
          </h2>
          <ol className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              "대시보드 요청",
              "서버에서 Prisma로 DB 조회",
              "조회 결과를 카드로 표시",
            ].map((step, index) => (
              <li key={step} className={cardClass}>
                <span className="font-mono text-violet-300">0{index + 1}</span>
                <p className="mt-3 font-medium">{step}</p>
              </li>
            ))}
          </ol>
          <pre className="mt-6 overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-900 p-5 text-sm leading-7 text-neutral-200">
            <code>{query}</code>
          </pre>
          <ul className="mt-6 list-disc space-y-3 pl-5 leading-7 text-neutral-300">
            <li>
              Server Component에서 직접 조회하고, connection()으로 요청 시
              렌더링합니다.
            </li>
            <li>
              카드에 필요한 id와 title만 가져오며 최근 수정 순서로 정렬합니다.
            </li>
            <li>
              공용 Prisma Client를 만들고 개발 중 연결을 재사용하도록
              구성했습니다.
            </li>
          </ul>
          <p className="mt-6 border-l-2 border-violet-400 pl-4 leading-7 text-neutral-300">
            현재는 seed 사용자의 프로젝트를 조회합니다. 로그인 사용자에 따른
            조회와 접근 권한 검사는 인증 개발 단계에서 연결할 예정입니다.
          </p>
        </section>

        <footer className="flex flex-wrap justify-between gap-3 border-t border-neutral-800 py-8 text-sm text-neutral-400">
          <a
            href="#"
            className="hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400"
          >
            맨 위로 ↑
          </a>
        </footer>
      </div>
    </main>
  );
}
