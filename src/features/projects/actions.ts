"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

const titleSchema = z
  .string()
  .trim()
  .min(1, "프로젝트 이름을 입력해주세요.")
  .max(120, "이름은 120자 이하로 입력해주세요.");
type CreateProjectState = { error: string };

export async function createProject(
  _previous: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  // 클라이언트에서 ownerId를 받지 않고 검증된 세션에서 결정한다.
  const session = await requireSession();
  const result = titleSchema.safeParse(formData.get("title"));
  if (!result.success) return { error: result.error.issues[0].message };

  let project;
  try {
    project = await prisma.project.create({
      data: { title: result.data, ownerId: session.user.id },
      select: { id: true },
    });
  } catch {
    return {
      error: "프로젝트를 만들지 못했습니다. 잠시 후 다시 시도해주세요.",
    };
  }
  revalidatePath("/dashboard");
  redirect("/projects/" + project.id);
}

type RenameProjectState = {
  error: string;
  message: string;
};

export async function renameProject(
  _previous: RenameProjectState,
  formData: FormData,
): Promise<RenameProjectState> {
  const session = await requireSession();

  const idResult = z.uuid().safeParse(
    formData.get("projectId"),
  );

  if (!idResult.success) {
    return {
      error: "프로젝트 ID가 올바르지 않습니다.",
      message: "",
    };
  }

  const titleResult = titleSchema.safeParse(
    formData.get("title"),
  );

  if (!titleResult.success) {
    return {
      error: titleResult.error.issues[0].message,
      message: "",
    };
  }

  try {
    const updated = await prisma.project.updateMany({
      where: {
        id: idResult.data,
        ownerId: session.user.id,
      },
      data: {
        title: titleResult.data,
      },
    });

    if (updated.count === 0) {
      return {
        error: "프로젝트를 찾을 수 없습니다.",
        message: "",
      };
    }
  } catch {
    return {
      error: "이름을 변경하지 못했습니다. 다시 시도해주세요.",
      message: "",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/projects/${idResult.data}`);

  return {
    error: "",
    message: "이름을 변경했습니다.",
  };
}

type DeleteProjectState = {
  error: string;
  success: boolean;
};

export async function deleteProject(
  _previous: DeleteProjectState,
  formData: FormData,
): Promise<DeleteProjectState> {
  const session = await requireSession();

  const idResult = z.uuid().safeParse(
    formData.get("projectId"),
  );

  if (!idResult.success) {
    return {
      error: "프로젝트 ID가 올바르지 않습니다.",
      success: false,
    };
  }

  try {
    const deleted = await prisma.project.deleteMany({
      where: {
        id: idResult.data,
        ownerId: session.user.id,
      },
    });

    if (deleted.count === 0) {
      return {
        error: "프로젝트를 찾을 수 없습니다.",
        success: false,
      };
    }
  } catch {
    return {
      error: "프로젝트를 삭제하지 못했습니다. 다시 시도해주세요.",
      success: false,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/projects/${idResult.data}`);

  return {
    error: "",
    success: true,
  };
}