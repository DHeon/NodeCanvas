import { BlockList, isIP } from "node:net";
import type { LinkPreview } from "./link-embed";

// 서버가 사용자를 대신해 임의 주소를 여는 기능이라 내부망·특수 주소로는 절대 나가지 않는다(SSRF 방지).
const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3], // 멀티캐스트·예약(224.0.0.0~255.255.255.255)
] as const)
  blocked.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
] as const)
  blocked.addSubnet(network, prefix, "ipv6");

/** 공용 인터넷 주소인지. IPv4를 담은 IPv6(::ffff:a.b.c.d, 64:ff9b::a.b.c.d)는 안쪽 IPv4로 판단한다. */
export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return !blocked.check(address, "ipv4");
  if (version !== 6) return false;
  const lower = address.toLowerCase();
  const mapped = lower.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPublicAddress(mapped[1]);
  const hexMapped = lower.match(/^::ffff:([\da-f]{1,4}):([\da-f]{1,4})$/);
  if (hexMapped) {
    const [high, low] = [
      parseInt(hexMapped[1], 16),
      parseInt(hexMapped[2], 16),
    ];
    return isPublicAddress(
      [high >> 8, high & 255, low >> 8, low & 255].join("."),
    );
  }
  return !blocked.check(address, "ipv6");
}

/** 응답 헤더로 이 페이지를 다른 사이트의 iframe 안에 띄울 수 있는지 판단한다. */
export function canEmbed(headers: Headers, url: URL): boolean {
  // https 앱 안에서 http 페이지는 브라우저가 막는다(혼합 콘텐츠).
  if (url.protocol !== "https:") return false;
  if (headers.get("x-frame-options")) return false;
  const csp = headers.get("content-security-policy") ?? "";
  const frameAncestors = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith("frame-ancestors"));
  if (frameAncestors) {
    const sources = frameAncestors.split(/\s+/).slice(1);
    if (!sources.includes("*")) return false;
  }
  return true;
}

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};
function decodeEntities(value: string) {
  return value.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (match, code: string) => {
      if (code[0] === "#") {
        const point =
          code[1].toLowerCase() === "x"
            ? parseInt(code.slice(2), 16)
            : parseInt(code.slice(1), 10);
        return Number.isFinite(point) && point > 0 && point < 0x110000
          ? String.fromCodePoint(point)
          : match;
      }
      return entities[code.toLowerCase()] ?? match;
    },
  );
}

function clean(value: string | undefined, max: number) {
  if (!value) return undefined;
  const text = decodeEntities(value).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

/** HTML 머리에서 Open Graph·제목 정보를 꺼낸다. */
export function parsePreviewHtml(
  html: string,
  pageUrl: URL,
): Omit<LinkPreview, "embeddable"> {
  const head = html.slice(0, 200_000);
  const meta = new Map<string, string>();
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const attr = (name: string) =>
      tag.match(
        new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
      );
    const key = (attr("property") ?? attr("name"))?.slice(2).find(Boolean);
    const content = attr("content")
      ?.slice(2)
      .find((part) => part !== undefined);
    if (key && content !== undefined && !meta.has(key.toLowerCase()))
      meta.set(key.toLowerCase(), content);
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  let image: string | undefined;
  const rawImage = meta.get("og:image") ?? meta.get("twitter:image");
  if (rawImage) {
    try {
      const resolved = new URL(decodeEntities(rawImage.trim()), pageUrl);
      if (resolved.protocol === "https:" || resolved.protocol === "http:")
        image = resolved.href.slice(0, 2048);
    } catch {
      // 잘못된 이미지 주소는 버린다.
    }
  }
  return {
    title: clean(
      meta.get("og:title") ?? meta.get("twitter:title") ?? titleTag,
      200,
    ),
    description: clean(
      meta.get("og:description") ?? meta.get("description"),
      300,
    ),
    image,
    siteName: clean(meta.get("og:site_name"), 100),
  };
}
