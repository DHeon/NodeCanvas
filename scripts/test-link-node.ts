import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createWorkspace } from "../src/features/workspace/create-workspace";
import {
  normalizeLinkUrl,
  parseYouTube,
  youtubeEmbedUrl,
} from "../src/features/workspace/link-embed";
import {
  canEmbed,
  isPublicAddress,
  parsePreviewHtml,
} from "../src/features/workspace/link-preview-parse";
import type { LinkNode } from "../src/features/workspace/types";
import { workspaceDocumentSchema } from "../src/features/workspace/workspace-schema";

test("주소 다듬기: 스킴이 없으면 https를 붙이고, 주소가 아니면 거절한다", () => {
  assert.equal(normalizeLinkUrl("example.com/a"), "https://example.com/a");
  assert.equal(
    normalizeLinkUrl("  https://ko.wikipedia.org  "),
    "https://ko.wikipedia.org/",
  );
  for (const bad of [
    "",
    "hello",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://user:pw@example.com",
    "http://localhost:3000",
    "two words.com",
  ])
    assert.equal(normalizeLinkUrl(bad), null, bad);
});

test("유튜브 주소 여러 형태에서 영상 ID와 시작 시각을 찾는다", () => {
  const id = "dQw4w9WgXcQ";
  for (const href of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://m.youtube.com/watch?v=${id}&feature=share`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
  ])
    assert.deepEqual(parseYouTube(href), { id }, href);
  assert.deepEqual(parseYouTube(`https://youtu.be/${id}?t=1m30s`), {
    id,
    start: 90,
  });
  assert.equal(parseYouTube("https://www.youtube.com/@channel"), null);
  assert.equal(parseYouTube("https://example.com/watch?v=" + id), null);
  assert.equal(
    youtubeEmbedUrl({ id, start: 90 }),
    `https://www.youtube-nocookie.com/embed/${id}?rel=0&start=90`,
  );
});

test("내부망·특수 주소는 서버가 열지 않는다", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.1",
    "192.168.0.10",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fe80::1",
    "fd12:3456::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "not-an-ip",
  ])
    assert.equal(isPublicAddress(address), false, address);
  for (const address of ["8.8.8.8", "142.250.196.110", "2606:4700::1111"])
    assert.equal(isPublicAddress(address), true, address);
});

test("응답 헤더가 다른 사이트 안에 띄우기를 막으면 카드로 보여준다", () => {
  const https = new URL("https://example.com/");
  assert.equal(canEmbed(new Headers(), https), true);
  assert.equal(
    canEmbed(new Headers({ "X-Frame-Options": "DENY" }), https),
    false,
  );
  assert.equal(
    canEmbed(new Headers({ "X-Frame-Options": "SAMEORIGIN" }), https),
    false,
  );
  assert.equal(
    canEmbed(
      new Headers({
        "Content-Security-Policy": "default-src 'self'; frame-ancestors 'self'",
      }),
      https,
    ),
    false,
  );
  assert.equal(
    canEmbed(
      new Headers({ "Content-Security-Policy": "frame-ancestors *" }),
      https,
    ),
    true,
  );
  // https 앱 안에서 http 페이지는 브라우저가 막는다.
  assert.equal(canEmbed(new Headers(), new URL("http://example.com/")), false);
});

test("HTML 머리에서 Open Graph 정보와 상대 이미지 주소를 읽는다", () => {
  const html = `<!doctype html><html><head>
    <title>대체 제목</title>
    <meta content="설명 &amp; 요약" name="description">
    <meta property="og:title" content="생각 정리 &quot;노트&quot;">
    <meta property='og:image' content='/cover.png'>
    <meta property="og:site_name" content="노트 사이트">
  </head><body></body></html>`;
  assert.deepEqual(
    parsePreviewHtml(html, new URL("https://notes.example/a/b")),
    {
      title: '생각 정리 "노트"',
      description: "설명 & 요약",
      image: "https://notes.example/cover.png",
      siteName: "노트 사이트",
    },
  );
  assert.deepEqual(
    parsePreviewHtml("<title> 제목만 </title>", new URL("https://x.example")),
    {
      title: "제목만",
      description: undefined,
      image: undefined,
      siteName: undefined,
    },
  );
});

function linkNode(extra: Partial<LinkNode> = {}): LinkNode {
  return {
    id: randomUUID(),
    type: "link_node",
    position: { x: 10, y: 10 },
    width: 480,
    height: 318,
    title: "",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ...extra,
  };
}

test("링크 노드는 저장·조회로 왕복하고, 잘못된 주소·미리보기는 거절한다", () => {
  const document = createWorkspace();
  document.nodes = [
    linkNode(),
    linkNode({ url: "" }),
    linkNode({
      url: "https://ko.wikipedia.org/wiki/%EB%85%B8%ED%8A%B8",
      preview: { embeddable: true, title: "노트", siteName: "위키백과" },
    }),
  ];
  assert.deepEqual(workspaceDocumentSchema.parse(document), document);

  for (const bad of [
    linkNode({ url: "javascript:alert(1)" }),
    linkNode({ url: "example.com" }), // 다듬지 않은 주소는 저장하지 않는다
    linkNode({ preview: { embeddable: true, image: "javascript:x" } }),
    linkNode({ preview: { embeddable: true, extra: 1 } as never }),
  ]) {
    const invalid = createWorkspace();
    invalid.nodes = [bad];
    assert.equal(
      workspaceDocumentSchema.safeParse(invalid).success,
      false,
      JSON.stringify(bad),
    );
  }
});
