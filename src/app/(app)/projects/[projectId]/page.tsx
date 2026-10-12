import { notFound } from "next/navigation";
import { z } from "zod";

import Workspace from "@/features/workspace/workspace";
import { createWorkspace } from "@/features/workspace/create-workspace";
import { workspaceDocumentSchema } from "@/features/workspace/workspace-schema";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const session = await requireSession("/projects/" + projectId);  //세션 확인

  if (!z.uuid().safeParse(projectId).success) notFound();

  const project = await prisma.project.findFirst({  //프로젝트 id로 db에 있나 찾아보고 불러옴
    where: {
      id: projectId,
      ownerId: session.user.id,
    },
    select: {
      id: true,
      title: true,
      document: true,
      documentVersion: true,
    },
  });

  if (!project) notFound();

  const result = workspaceDocumentSchema.safeParse(
    project.document === null
      ? createWorkspace()
      : project.document,
  );

  if (!result.success) {
    throw new Error("저장된 작업 공간 문서의 형식이 올바르지 않습니다.");
  }

  return (
    <Workspace
      key={project.id}
      projectId={project.id}
      projectTitle={project.title}
      initialDocument={result.data}
      initialVersion={project.documentVersion}
      ownerId={session.user.id}
    />
  );
}