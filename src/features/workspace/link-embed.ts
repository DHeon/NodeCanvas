// 링크 노드에서 화면·서버가 함께 쓰는 순수 함수. 네트워크에 접근하지 않는다.

export const MAX_LINK_URL_LENGTH = 2048;

/** 서버가 확인한 링크 정보. 문서에 함께 저장해 다시 열 때 바로 그린다. */
export type LinkPreview = {
  /** 이 페이지를 노드 안(iframe)에 띄워도 되는지. 사이트가 막아두면 false. */
  embeddable: boolean;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

/** 사용자가 적은 주소를 http(s) URL로 다듬는다. 주소가 아니면 null. */
export function normalizeLinkUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_LINK_URL_LENGTH || /\s/.test(trimmed))
    return null;
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  // "abc"처럼 점 없는 단어는 주소로 보지 않는다(localhost 같은 내부 주소도 여기서 걸러진다).
  if (!url.hostname.includes(".")) return null;
  return url.href;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function parseStart(value: string | null): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match || !match[0]) return undefined;
  const [, h = "0", m = "0", s = "0"] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/** 유튜브 영상 주소면 영상 ID(와 시작 시각)를, 아니면 null. */
export function parseYouTube(
  href: string,
): { id: string; start?: number } | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const [, kind, value] = url.pathname.split("/");
      if (["embed", "shorts", "live", "v"].includes(kind)) id = value;
    }
  }
  if (!id || !YOUTUBE_ID.test(id)) return null;
  const start = parseStart(
    url.searchParams.get("t") ?? url.searchParams.get("start"),
  );
  return start ? { id, start } : { id };
}

/** 개인정보 보호 모드(youtube-nocookie) 플레이어 주소. */
export function youtubeEmbedUrl(video: { id: string; start?: number }) {
  const params = new URLSearchParams({ rel: "0" });
  if (video.start) params.set("start", String(video.start));
  return `https://www.youtube-nocookie.com/embed/${video.id}?${params}`;
}

/** 노드 제목이 비어 있을 때 쓸 짧은 이름. */
export function linkHostLabel(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}
