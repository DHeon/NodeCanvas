import type { WorkspaceDocument, WorkspaceNode } from "./types";
import { canvasNodeTitle } from "./workspace-tree";

export const MAX_SEARCH_RESULTS = 100;

export type SearchQuery = { words: string[]; tagPrefixes: string[] };

export type SearchResult = {
  node: WorkspaceNode;
  /** 노드를 담은 캔버스 경로(캔버스 노드 ID 목록). 루트면 빈 배열. */
  path: string[];
  /** path의 캔버스 제목들(목록에 위치를 보여줄 때). */
  trail: string[];
  /**
   * 지금 캔버스에서 이 결과를 대표하는 노드: 지금 캔버스에 있으면 그 노드,
   * 아래 하위 캔버스에 있으면 그것을 품은 지금 캔버스의 캔버스 노드, 그 밖이면 null.
   */
  anchorId: string | null;
};

/** 띄어쓰기로 나눈 낱말(소문자). '#'으로 시작하면 태그 이름 접두. */
export function parseSearchQuery(input: string): SearchQuery {
  const words: string[] = [];
  const tagPrefixes: string[] = [];
  for (const raw of input.toLowerCase().split(/\s+/)) {
    if (!raw) continue;
    if (raw.startsWith("#")) {
      const prefix = raw.replace(/^#+/, "");
      if (prefix) tagPrefixes.push(prefix);
    } else words.push(raw);
  }
  return { words, tagPrefixes };
}

function searchableText(node: WorkspaceNode, tagNames: string[]) {
  const fields = [node.title, ...tagNames];
  if (node.type === "text_node") fields.push(node.text);
  if (node.type === "link_node")
    fields.push(node.url, node.preview?.title ?? "");
  // 필드 경계를 넘는 우연한 일치를 막으려고 줄바꿈으로 잇는다.
  return fields.join("\n").toLowerCase();
}

function anchorFor(
  node: WorkspaceNode,
  path: readonly string[],
  currentPath: readonly string[],
) {
  if (!currentPath.every((id, index) => path[index] === id)) return null;
  return path.length === currentPath.length
    ? node.id
    : path[currentPath.length];
}

/** 프로젝트 전체(하위 캔버스 포함)에서 검색어에 맞는 노드를 찾는다. */
export function searchWorkspace(
  root: WorkspaceDocument,
  input: string,
  currentPath: readonly string[],
): { results: SearchResult[]; total: number; truncated: boolean } {
  const query = parseSearchQuery(input);
  if (!query.words.length && !query.tagPrefixes.length)
    return { results: [], total: 0, truncated: false };

  const tagNames = new Map(
    (root.tags ?? []).map((tag) => [tag.id, tag.name.toLowerCase()]),
  );
  const found: SearchResult[] = [];
  const visit = (
    document: WorkspaceDocument,
    path: string[],
    trail: string[],
  ) => {
    for (const node of document.nodes) {
      const names = (node.tags ?? []).flatMap((id) => {
        const name = tagNames.get(id);
        return name ? [name] : [];
      });
      const haystack = searchableText(node, names);
      const matches =
        query.words.every((word) => haystack.includes(word)) &&
        query.tagPrefixes.every((prefix) =>
          names.some((name) => name.startsWith(prefix)),
        );
      if (matches)
        found.push({
          node,
          path,
          trail,
          anchorId: anchorFor(node, path, currentPath),
        });
      if (node.type === "canvas_node")
        visit(
          node.document,
          [...path, node.id],
          [...trail, canvasNodeTitle(node)],
        );
    }
  };
  visit(root, [], []);

  // 지금 캔버스 결과 먼저, 그다음 얕은 순(같으면 문서 순서 유지).
  const inCurrent = (result: SearchResult) =>
    result.anchorId === result.node.id ? 0 : 1;
  found.sort(
    (a, b) => inCurrent(a) - inCurrent(b) || a.path.length - b.path.length,
  );
  return {
    results: found.slice(0, MAX_SEARCH_RESULTS),
    total: found.length,
    truncated: found.length > MAX_SEARCH_RESULTS,
  };
}

/** 지금 캔버스의 캔버스 노드 ID → 그 안(모든 깊이)에 있는 결과 수. 자기 자신은 세지 않는다. */
export function countNestedMatches(
  results: readonly SearchResult[],
  currentPath: readonly string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const result of results) {
    if (result.path.length <= currentPath.length) continue;
    if (!currentPath.every((id, index) => result.path[index] === id)) continue;
    const key = result.path[currentPath.length];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
