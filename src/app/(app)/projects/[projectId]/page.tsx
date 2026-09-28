import Workspace from "@/features/workspace/workspace";

type ProjectPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return <Workspace key={projectId} projectId={projectId} />;
}