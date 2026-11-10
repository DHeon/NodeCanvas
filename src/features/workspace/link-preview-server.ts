import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { parseYouTube, type LinkPreview } from "./link-embed";
import {
  canEmbed,
  isPublicAddress,
  parsePreviewHtml,
} from "./link-preview-parse";

export class LinkPreviewError extends Error {}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new LinkPreviewError("http·https 주소만 열 수 있습니다.");
  if (url.username || url.password)
    throw new LinkPreviewError("계정 정보가 들어 있는 주소는 열 수 없습니다.");
  if (url.port && url.port !== "80" && url.port !== "443")
    throw new LinkPreviewError("기본 포트가 아닌 주소는 열 수 없습니다.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true, verbatim: true })).map(
        (entry) => entry.address,
      );
  if (!addresses.length || !addresses.every(isPublicAddress))
    throw new LinkPreviewError("내부 네트워크 주소는 열 수 없습니다.");
}

const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 512 * 1024;

async function readLimited(response: Response, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  const bytes = new Uint8Array(Math.min(size, limit));
  let offset = 0;
  for (const chunk of chunks) {
    const part = chunk.subarray(0, bytes.length - offset);
    bytes.set(part, offset);
    offset += part.length;
    if (offset >= bytes.length) break;
  }
  return bytes;
}

function decodeHtml(bytes: Uint8Array, contentType: string) {
  const fromHeader = contentType.match(/charset=([\w-]+)/i)?.[1];
  const sniff = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  const fromMeta = sniff.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  try {
    return new TextDecoder(fromHeader ?? fromMeta ?? "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** 유튜브는 페이지 대신 공식 oEmbed로 제목·채널·썸네일을 받는다(봇에게 동의 화면을 주는 경우가 있어서). */
async function fetchYouTubePreview(href: string): Promise<LinkPreview> {
  const endpoint = new URL("https://www.youtube.com/oembed");
  endpoint.searchParams.set("url", href);
  endpoint.searchParams.set("format", "json");
  const response = await fetch(endpoint, {
    redirect: "error",
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) return { embeddable: false, siteName: "YouTube" };
  const data = (await response.json()) as {
    title?: unknown;
    author_name?: unknown;
    thumbnail_url?: unknown;
  };
  const text = (value: unknown, max: number) =>
    typeof value === "string" && value.trim()
      ? value.trim().slice(0, max)
      : undefined;
  const image = text(data.thumbnail_url, 2048);
  return {
    // 유튜브는 화면에서 전용 플레이어로 띄우므로 iframe 가능 여부는 쓰지 않는다.
    embeddable: false,
    title: text(data.title, 200),
    description: text(data.author_name, 300),
    image: image?.startsWith("https://") ? image : undefined,
    siteName: "YouTube",
  };
}

/** 주소를 열어 노드에 쓸 미리보기를 만든다. 리다이렉트도 한 단계씩 다시 검사한다. */
export async function fetchLinkPreview(href: string): Promise<LinkPreview> {
  if (parseYouTube(href)) return fetchYouTubePreview(href);
  let url = new URL(href);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; nono-link-preview/1.0)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "Accept-Language": "ko,en;q=0.8",
      },
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel().catch(() => {});
      url = new URL(location, url);
      continue;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return { embeddable: false };
    }
    if (contentType.startsWith("image/")) {
      await response.body?.cancel().catch(() => {});
      return { embeddable: false, image: url.href };
    }
    const embeddable = canEmbed(response.headers, url);
    if (!/html/i.test(contentType)) {
      await response.body?.cancel().catch(() => {});
      return { embeddable };
    }
    const html = decodeHtml(
      await readLimited(response, MAX_HTML_BYTES),
      contentType,
    );
    return { embeddable, ...parsePreviewHtml(html, url) };
  }
  throw new LinkPreviewError("리다이렉트가 너무 많습니다.");
}
