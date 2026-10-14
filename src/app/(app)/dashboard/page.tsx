import Link from "next/link";
import LogoutButton from "@/features/auth/logout-button";
import CreateProjectForm from "@/features/projects/create-project-form";
import { requireSession } from "@/lib/session";
import RenameProjectForm from "@/features/projects/rename-project-form";
import DeleteProjectForm from "@/features/projects/delete-project-form";

import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await requireSession(); // 세션을 통해 사용자 정보 획득

  const projects = await prisma.project.findMany({  // 사용자 정보를 통해 프로젝트를 가져옴
    where: {
      ownerId: session.user.id,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      title: true,
    },
  });
  return (
    <main className="min-h-screen bg-neutral-950 p-10">
      <div className="mx-auto w-full max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-white">내 프로젝트</h1>
            <p className="mt-2 text-sm text-neutral-400">
              {session.user.name} · {session.user.email}
            </p>
          </div>
          <div className="text-white">
            <LogoutButton />
          </div>
        </header>
        <CreateProjectForm />

        <section className="mt-10">
          {projects.length === 0 ? (
            <p className="text-neutral-400">아직 생성된 프로젝트가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,220px))] gap-5">
              {projects.map((project) => (
                <article
                  key={project.id}
                  className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                >
                  <div className="grid aspect-square grid-rows-[1fr_auto]">
                    <Link
                      href={`/projects/${project.id}`}
                      aria-label={`${project.title} 열기`}
                      className="flex items-center justify-center bg-neutral-200 text-sm text-neutral-400"
                    >
                      이미지
                    </Link>
                    <RenameProjectForm
                      projectId={project.id}
                      projectTitle={project.title}
                    >
                      <DeleteProjectForm
                        ownerId={session.user.id}
                        projectId={project.id}
                        projectTitle={project.title}
                      />
                    </RenameProjectForm>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
