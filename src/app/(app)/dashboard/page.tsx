import Link from "next/link";
import { connection } from "next/server";

import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  await connection();

  const projects = await prisma.project.findMany({
    where: {
      owner: {
        email: "demo@nono.local",
      },
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
        <header>
          <h1 className="text-3xl font-semibold text-white">내 프로젝트</h1>
        </header>

        <section className="mt-10">
          {projects.length === 0 ? (
            <p className="text-neutral-400">아직 생성된 프로젝트가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,220px))] gap-5">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group block rounded-2xl"
                >
                  <article className="grid aspect-square grid-rows-[1fr_auto] overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                    <div className="flex items-center justify-center bg-neutral-200 text-sm text-neutral-400">
                      이미지
                    </div>

                    <div className="border-t border-neutral-200 px-4 py-3 text-neutral-600">
                      <h3 className="truncate font-medium">{project.title}</h3>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
