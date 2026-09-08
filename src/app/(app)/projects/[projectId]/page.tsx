type ProjectPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-900 text-neutral-300">
      <div className="text-center">
        <p className="text-sm text-neutral-500">PROJECT {projectId}</p>
        <h1 className="mt-2 text-2xl font-semibold">빈 작업공간</h1>
      </div>
    </main>
  );
}