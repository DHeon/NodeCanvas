import Link from "next/link";

const testProjects = [
  {
    id: "test-project",
    title: "테스트 프로젝트",
  },
];

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-neutral-100 p-10">
      <div className="mx-auto w-full max-w-7xl">
        <header>
          <h1 className="text-3xl font-semibold text-black">내 프로젝트</h1>
        </header>

        <section className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(180px,220px))] gap-5">
            {testProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group block rounded-2xl"
              >
                <article className="grid aspect-square grid-rows-[1fr_auto] overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                  <div className="flex items-center justify-center bg-neutral-200 text-sm text-neutral-400">
                    미리보기
                  </div>

                  <div className="border-t border-neutral-200 px-4 py-3 text-neutral-400">
                    <h3 className="truncate font-medium">{project.title}</h3>
                  </div>
                </article>
              </Link>
            ))}
        </section>
        
      </div>
    </main>
  );
}