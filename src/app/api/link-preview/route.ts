import { z } from "zod";
import { appOrigins } from "@/lib/app-origins";
import { getSession } from "@/lib/session";
import { normalizeLinkUrl } from "@/features/workspace/link-embed";
import {
  fetchLinkPreview,
  LinkPreviewError,
} from "@/features/workspace/link-preview-server";

const bodySchema = z.strictObject({ url: z.string().max(2048) });

// 링크 노드 미리보기: 로그인한 사용자만, 앱 화면에서 보낸 요청만 받는다.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session)
    return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const origin = request.headers.get("origin");
  if (!origin || !appOrigins.includes(origin))
    return Response.json(
      { message: "허용되지 않은 요청입니다." },
      { status: 403 },
    );

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { message: "JSON 형식으로 요청해주세요." },
      { status: 400 },
    );
  }
  const parsed = bodySchema.safeParse(body);
  const url = parsed.success ? normalizeLinkUrl(parsed.data.url) : null;
  if (!url)
    return Response.json(
      { message: "올바른 웹 주소가 아닙니다." },
      { status: 400 },
    );

  try {
    const preview = await fetchLinkPreview(url);
    return Response.json(
      { preview },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof LinkPreviewError)
      return Response.json({ message: error.message }, { status: 422 });
    // 시간 초과·연결 실패: 노드는 미리보기 카드로 대신 보여준다.
    return Response.json(
      { message: "페이지를 열지 못했습니다." },
      { status: 502 },
    );
  }
}
