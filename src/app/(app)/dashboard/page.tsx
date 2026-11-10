import type { Metadata } from "next";
import LogoutButton from "@/features/auth/logout-button";
import CreateProjectForm from "@/features/projects/create-project-form";
import RenameProjectForm from "@/features/projects/rename-project-form";
import DeleteProjectForm from "@/features/projects/delete-project-form";
import ProjectPreview, {
  formatUpdatedAt,
  readPreview,
} from "@/features/projects/project-preview";
import SiteHeader, { SkipLink } from "@/features/shell/site-header";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "내 프로젝트 · nono" };

const GRID_DOTS =
  "bg-field bg-[radial-gradient(circle,var(--color-sage-dot)_1px,transparent_1px)] bg-size-[16px_16px]";

export default async function DashboardPage() {
  const session = await requireSession(); // 세션을 통해 사용자 정보 획득

  const projects = await prisma.project.findMany({
    where: { ownerId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true, document: true },
  });

  return (
    <div className="min-h-dvh bg-paper text-bark [color-scheme:light]">
      <SkipLink />
      <SiteHeader>
        <div className="flex min-w-0 items-center gap-4">
          <span
            className="hidden truncate text-sm text-lichen sm:inline"
            title={session.user.email}
          >
            {session.user.name}
          </span>
          <LogoutButton />
        </div>
      </SiteHeader>

      <main
        id="main-content"
        className="mx-auto w-[min(1184px,calc(100%-32px))] py-10 sm:w-[min(1184px,calc(100%-64px))] sm:py-12"
      >
        {projects.length === 0 ? (
          <section className="mx-auto max-w-xl rounded-2xl border border-rule bg-white p-6 shadow-card sm:p-10">
            <div
              aria-hidden="true"
              className={`mb-8 grid h-36 place-items-center rounded-xl ${GRID_DOTS}`}
            >
              <div className="flex items-center gap-3">
                <span className="h-12 w-20 rounded-lg border border-rule bg-white shadow-card" />
                <span className="h-px w-8 bg-lichen" />
                <span className="h-12 w-16 rounded-lg border border-rule bg-moss-wash shadow-card" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] break-keep">
              환영해요, {session.user.name}님
            </h1>
            <p className="mt-2 mb-7 text-sm leading-6 break-keep text-lichen">
              첫 프로젝트에 이름을 붙이면 바로 빈 캔버스가 열려요. 떠오르는
              생각을 메모로 놓고, 선으로 이어보세요.
            </p>
            <CreateProjectForm autoFocus />
          </section>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <h1 className="text-3xl font-semibold tracking-[-0.02em]">
                  내 프로젝트
                </h1>
                <p className="mt-2 text-sm text-lichen tabular-nums">
                  {projects.length}개 · 최근 수정 순
                </p>
              </div>
              <CreateProjectForm />
            </div>

            <ul className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
              {projects.map((project) => {
                const preview = readPreview(project.document);
                return (
                  <li
                    key={project.id}
                    className="group relative overflow-hidden rounded-2xl border border-rule bg-white shadow-card transition-[box-shadow,border-color] duration-150 focus-within:border-moss-deep hover:border-sage-hover hover:shadow-card-lift"
                  >
                    {/* 카드 전체가 제목 링크(늘린 클릭 영역)로 열린다. 탭 정지점은 제목 하나. */}
                    <div
                      className={`grid aspect-[4/3] place-items-center p-5 ${GRID_DOTS}`}
                    >
                      <ProjectPreview nodes={preview.nodes} />
                    </div>
                    <RenameProjectForm
                      projectId={project.id}
                      projectTitle={project.title}
                      meta={`${preview.total > 0 ? `노드 ${preview.total}개 · ` : ""}${formatUpdatedAt(project.updatedAt)} 수정`}
                    >
                      <DeleteProjectForm
                        projectId={project.id}
                        projectTitle={project.title}
                      />
                    </RenameProjectForm>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
