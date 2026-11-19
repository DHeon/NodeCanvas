import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { appOrigins } from "@/lib/app-origins";
import { ArchiveError } from "@/features/workspace/project-archive";
import {
  importProject,
  readArchiveBody,
} from "@/features/projects/import-project-server";

export const runtime = "nodejs";

/** .nono 파일(본문 그대로)을 새 프로젝트로 불러온다. ?name= 은 제목이 없을 때 쓸 파일 이름. */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session)
      return Response.json(
        { message: "로그인이 필요합니다." },
        { status: 401 },
      );
    const origin = request.headers.get("origin");
    if (!origin || !appOrigins.includes(origin))
      return Response.json(
        { message: "허용되지 않은 요청입니다." },
        { status: 403 },
      );
    const fileName = (
      new URL(request.url).searchParams.get("name") ?? ""
    ).slice(0, 200);
    const bytes = await readArchiveBody(request);
    const result = await importProject(session.user.id, bytes, fileName);
    revalidatePath("/dashboard");
    return Response.json(result, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ArchiveError)
      return Response.json({ message: error.message }, { status: 400 });
    console.error("프로젝트 불러오기 실패:", error);
    return Response.json(
      {
        message: "프로젝트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
      },
      { status: 500 },
    );
  }
}
