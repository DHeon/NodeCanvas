// 9주차 발표 정리본: 하위 작업 공간(week9) + 보기 설정 + 링크 노드.
// 앞 발표와 내용이 어긋나지 않도록 같은 섹션은 원본 데이터를 그대로 가져온다.
import {
  storage as nestedStorage,
  workflows as nestedFlows,
} from "../week9/content";
import { workflows as extraFlows } from "../week9-1/content";

type Workflow = {
  id: string;
  title: string;
  action: string;
  result: string;
  steps: readonly { fn: string; detail: string }[];
  file: string;
  code: string;
};

const viewFlow = extraFlows.find((flow) => flow.id === "view")!;

const linkFlows: Workflow[] = [
  {
    id: "link-add",
    title: "링크 노드 추가와 유튜브",
    action:
      "도구 막대의 링크 버튼(또는 L)으로 노드를 만들고 주소를 넣은 뒤 ▶를 누른다. 캔버스에 https:// 주소를 붙여넣어도 된다.",
    result:
      "유튜브 주소면 노드 본문에 플레이어만 꽉 차게 보이고, 노드 제목이 영상 제목으로 채워진다.",
    steps: [
      {
        fn: 'addNode("link_node")',
        detail:
          "16:9 영상(480×270)에 제목 바 48px를 더한 480×318 크기로, url이 빈 링크 노드를 만든다.",
      },
      {
        fn: "UrlForm → normalizeLinkUrl",
        detail:
          "https://가 없으면 붙이고, http·https가 아니거나 점 없는 주소(localhost 등)는 거절한다. 브라우저 기본 URL 검사는 끄고 직접 다듬는다.",
      },
      {
        fn: "setLinkUrl → linkPreviews.load",
        detail:
          "Undo 이력을 확정하고 url을 바꾼 뒤, 현재 공간 경로와 함께 서버에 미리보기를 요청한다.",
      },
      {
        fn: "parseYouTube → youtubeEmbedUrl",
        detail:
          "watch·youtu.be·shorts·embed 주소에서 11자리 영상 ID와 t= 시작 시각을 찾아 youtube-nocookie 플레이어로 띄운다.",
      },
      {
        fn: "fetchYouTubePreview (oEmbed)",
        detail:
          "유튜브 공식 oEmbed로 영상 제목·채널·썸네일을 받는다. 노드 제목이 비어 있으면 영상 제목으로 채운다.",
      },
    ],
    file: "src/features/workspace/link-embed.ts · link-node-view.tsx",
    code: `export function parseYouTube(href: string) {
  const url = new URL(href);
  const host = url.hostname.replace(/^(www|m|music)\\./, "");
  let id = null;
  if (host === "youtu.be") id = url.pathname.slice(1);
  else if (host === "youtube.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const [, kind, value] = url.pathname.split("/");
      if (["embed", "shorts", "live"].includes(kind)) id = value;
    }
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  return { id, start: parseStart(url.searchParams.get("t")) };
}

// link-node-view.tsx
if (video) body = (
  <iframe src={youtubeEmbedUrl(video)} allowFullScreen … />
);`,
  },
  {
    id: "link-page",
    title: "웹페이지: 노드 안에 띄우기 또는 카드",
    action: "위키백과 주소와 네이버 주소를 각각 넣는다.",
    result:
      "위키백과는 노드 안에 페이지가 그대로 뜨고, 네이버는 대표 이미지·제목·설명·‘새 탭에서 열기’가 있는 카드로 보인다.",
    steps: [
      {
        fn: "POST /api/link-preview",
        detail:
          "로그인 세션과 Origin을 확인한 뒤 주소를 다시 다듬는다. 브라우저는 다른 사이트 응답 헤더를 읽을 수 없어서 서버가 대신 연다.",
      },
      {
        fn: "fetchLinkPreview → assertPublicUrl",
        detail:
          "DNS로 찾은 모든 주소가 공용 IP인지 확인한다(사설망·localhost·169.254 메타데이터 차단). 리다이렉트는 3번까지, 단계마다 다시 검사한다. 6초·512KB 제한.",
      },
      {
        fn: "canEmbed(headers, url)",
        detail:
          "X-Frame-Options가 있거나 CSP frame-ancestors가 *를 허용하지 않으면, 또는 http 페이지면 노드 안에 띄울 수 없다고 판단한다.",
      },
      {
        fn: "parsePreviewHtml",
        detail:
          "HTML 머리의 og:title·og:description·og:image·og:site_name(없으면 <title>)을 읽어 카드에 쓸 정보를 만든다.",
      },
      {
        fn: "LinkNodeView",
        detail:
          "preview.embeddable이면 sandbox iframe으로 페이지를 띄우고, 아니면 미리보기 카드를 그린다. 결과는 문서에 저장돼 다시 열 때 바로 그린다.",
      },
    ],
    file: "src/features/workspace/link-preview-parse.ts · link-preview-server.ts",
    code: `export function canEmbed(headers: Headers, url: URL) {
  // https 앱 안에서 http 페이지는 브라우저가 막는다.
  if (url.protocol !== "https:") return false;
  if (headers.get("x-frame-options")) return false;
  const frameAncestors = (headers.get("content-security-policy") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("frame-ancestors"));
  if (frameAncestors && !frameAncestors.split(/\\s+/).includes("*"))
    return false;
  return true;
}

// 내부망 주소로는 절대 나가지 않는다 (SSRF 방지)
if (!addresses.every(isPublicAddress))
  throw new LinkPreviewError("내부 네트워크 주소는 열 수 없습니다.");`,
  },
];

const dashboardFlow: Workflow = {
  id: "dashboard-preview",
  title: "대시보드 캔버스 미리보기",
  action: "대시보드(내 프로젝트)를 연다.",
  result:
    "프로젝트 카드마다 캔버스의 노드 배치가 축소된 미니 캔버스로 보이고, ‘노드 N개 · 3분 전 수정’이 함께 나온다.",
  steps: [
    {
      fn: "DashboardPage → prisma.project.findMany",
      detail:
        "로그인한 사용자의 프로젝트를 최근 수정 순으로 가져온다. 제목·수정 시각과 함께 저장된 문서(JSON)도 읽는다.",
    },
    {
      fn: "readPreview(project.document)",
      detail:
        "문서의 최상위 노드에서 종류·위치·크기만 꺼낸다(최대 60개). 형식이 이상한 노드는 건너뛰어 카드가 깨지지 않게 한다.",
    },
    {
      fn: "ProjectPreview",
      detail:
        "모든 노드를 감싸는 영역에 여백을 더해 SVG viewBox로 잡고 노드를 둥근 사각형으로 그린다. 텍스트는 흰색, 이미지는 황토, 캔버스는 이끼, 링크는 안개색이다.",
    },
    {
      fn: "formatUpdatedAt(updatedAt)",
      detail:
        "Intl.RelativeTimeFormat으로 ‘방금 전’, ‘3분 전’, ‘2일 전’ 같은 상대 시각을 만든다.",
    },
  ],
  file: "src/features/projects/project-preview.tsx · app/(app)/dashboard/page.tsx",
  code: [
    "// 노드가 모두 들어오도록 SVG 보는 영역을 잡는다",
    "const minX = Math.min(...nodes.map((node) => node.x));",
    "const minY = Math.min(...nodes.map((node) => node.y));",
    "const maxX = Math.max(...nodes.map((node) => node.x + node.width));",
    "const maxY = Math.max(...nodes.map((node) => node.y + node.height));",
    "const pad = Math.max(maxX - minX, maxY - minY) * 0.08 + 24;",
    "",
    "<svg viewBox={`${minX - pad} ${minY - pad} …`}>",
    "  {nodes.map((node) => (",
    "    <rect x={node.x} y={node.y}",
    "      width={node.width} height={node.height}",
    "      fill={fill[node.type]} />",
    "  ))}",
    "</svg>",
    "",
    "// 카드 아래 정보",
    "meta={`노드 ${preview.total}개 · ${formatUpdatedAt(project.updatedAt)} 수정`}",
  ].join("\n"),
};

export const workflows: Workflow[] = [
  ...nestedFlows,
  viewFlow,
  ...linkFlows,
  dashboardFlow,
];

export const storage = [
  ...nestedStorage,
  {
    label: "대시보드 미리보기",
    location: "따로 저장하지 않음 (project.document에서 계산)",
    detail:
      "대시보드를 열 때마다 저장된 문서의 노드 위치·크기로 다시 그린다. 미리보기 이미지를 만들거나 보관하지 않는다.",
  },
  {
    label: "선 모양·점 배경",
    location: "project.document → canvas.lineStyle, canvas.grid",
    detail:
      "공간(하위 캔버스)마다 따로 저장한다. 새 하위 캔버스는 부모 설정을 물려받고, 값이 없는 이전 문서는 곡선·점 배경 표시로 열린다.",
  },
  {
    label: "링크 노드",
    location: "project.document → nodes[].url, nodes[].preview",
    detail:
      "주소와 서버가 확인한 결과(띄울 수 있는지·제목·설명·이미지 주소)를 함께 저장한다. 스키마가 http(s) 주소와 길이를 검사한다.",
  },
];
