import { v4 as uuidv4 } from "uuid";
import { CONNECTION_COLORS, type ConnectionColor } from "./connection-colors";
import type { TagDefinition, WorkspaceDocument, WorkspaceNode } from "./types";
import { updateWorkspaceAtPath, walkWorkspaceNodes } from "./workspace-tree";

// 노드 태그: 프로젝트 공용 목록(루트 문서 tags)과 노드별 태그 ID.

export const MAX_PROJECT_TAGS = 200;
export const MAX_NODE_TAGS = 20;
export const MAX_TAG_NAME_LENGTH = 30;

/** 태그 이름 규칙: 1~30자, 공백·'#' 없음. */
export const TAG_NAME_PATTERN = /^[^\s#]{1,30}$/u;

/** 입력을 태그 이름으로 다듬는다. 앞뒤 공백과 앞의 '#'을 떼고, 규칙에 맞지 않으면 null. */
export function normalizeTagName(input: string): string | null {
  const name = input.trim().replace(/^#+/, "").trim();
  return TAG_NAME_PATTERN.test(name) ? name : null;
}

export function findTagByName(root: WorkspaceDocument, name: string) {
  const key = name.toLowerCase();
  return root.tags?.find((tag) => tag.name.toLowerCase() === key);
}

/** 프로젝트에서 가장 적게 쓴 팔레트 색. 같으면 팔레트 순서상 앞. */
export function pickTagColor(root: WorkspaceDocument): ConnectionColor {
  const used = new Map<string, number>();
  for (const tag of root.tags ?? [])
    used.set(tag.color, (used.get(tag.color) ?? 0) + 1);
  let best: ConnectionColor = CONNECTION_COLORS[0].key;
  let bestCount = Infinity;
  for (const color of CONNECTION_COLORS) {
    const count = used.get(color.key) ?? 0;
    if (count < bestCount) {
      best = color.key;
      bestCount = count;
    }
  }
  return best;
}

const NAME_RULE_ERROR = "태그 이름은 공백과 # 없이 30자까지 쓸 수 있어요.";

/** 같은 이름(대소문자 무시)이 있으면 그 태그를, 없으면 새 태그를 목록에 더한다. */
export function createOrFindTag(
  root: WorkspaceDocument,
  input: string,
): { document: WorkspaceDocument; tag: TagDefinition } | { error: string } {
  const name = normalizeTagName(input);
  if (!name) return { error: NAME_RULE_ERROR };
  const existing = findTagByName(root, name);
  if (existing) return { document: root, tag: existing };
  if ((root.tags?.length ?? 0) >= MAX_PROJECT_TAGS)
    return {
      error: `태그는 프로젝트에 ${MAX_PROJECT_TAGS}개까지 만들 수 있어요.`,
    };
  const tag: TagDefinition = { id: uuidv4(), name, color: pickTagColor(root) };
  return { document: { ...root, tags: [...(root.tags ?? []), tag] }, tag };
}

function withTags<T extends WorkspaceNode>(node: T, tags: string[]): T {
  const next = { ...node };
  if (tags.length) next.tags = tags;
  else delete next.tags;
  return next;
}

/** path 공간의 nodeIds 노드에 태그를 붙인다. 이미 20개인 노드는 건너뛰고 skipped로 센다. */
export function attachTag(
  root: WorkspaceDocument,
  path: readonly string[],
  nodeIds: readonly string[],
  tagId: string,
): { document: WorkspaceDocument; skipped: number } {
  let skipped = 0;
  const document = updateWorkspaceAtPath(root, path, (current) => {
    let changed = false;
    const nodes = current.nodes.map((node) => {
      if (!nodeIds.includes(node.id)) return node;
      const tags = node.tags ?? [];
      if (tags.includes(tagId)) return node;
      if (tags.length >= MAX_NODE_TAGS) {
        skipped++;
        return node;
      }
      changed = true;
      return withTags(node, [...tags, tagId]);
    });
    return changed ? { ...current, nodes } : current;
  });
  return { document, skipped };
}

/** path 공간의 nodeIds 노드에서 태그를 뗀다. 비면 tags 필드를 지운다. */
export function detachTag(
  root: WorkspaceDocument,
  path: readonly string[],
  nodeIds: readonly string[],
  tagId: string,
): WorkspaceDocument {
  return updateWorkspaceAtPath(root, path, (current) => {
    let changed = false;
    const nodes = current.nodes.map((node) => {
      if (!nodeIds.includes(node.id) || !node.tags?.includes(tagId))
        return node;
      changed = true;
      return withTags(
        node,
        node.tags.filter((id) => id !== tagId),
      );
    });
    return changed ? { ...current, nodes } : current;
  });
}

export function renameTag(
  root: WorkspaceDocument,
  tagId: string,
  input: string,
): { document: WorkspaceDocument } | { error: string } {
  const name = normalizeTagName(input);
  if (!name) return { error: NAME_RULE_ERROR };
  const same = findTagByName(root, name);
  if (same && same.id !== tagId)
    return { error: `"${same.name}" 태그가 이미 있어요.` };
  const tags = root.tags?.map((tag) =>
    tag.id === tagId && tag.name !== name ? { ...tag, name } : tag,
  );
  return {
    document:
      tags && tags.some((tag, index) => tag !== root.tags![index])
        ? { ...root, tags }
        : root,
  };
}

export function recolorTag(
  root: WorkspaceDocument,
  tagId: string,
  color: ConnectionColor,
): WorkspaceDocument {
  const target = root.tags?.find((tag) => tag.id === tagId);
  if (!target || target.color === color) return root;
  return {
    ...root,
    tags: root.tags!.map((tag) => (tag.id === tagId ? { ...tag, color } : tag)),
  };
}

function stripTag(
  document: WorkspaceDocument,
  tagId: string,
): WorkspaceDocument {
  let changed = false;
  const nodes = document.nodes.map((node) => {
    let next = node;
    if (node.tags?.includes(tagId))
      next = withTags(
        node,
        node.tags.filter((id) => id !== tagId),
      );
    if (next.type === "canvas_node") {
      const inner = stripTag(next.document, tagId);
      if (inner !== next.document) next = { ...next, document: inner };
    }
    if (next !== node) changed = true;
    return next;
  });
  return changed ? { ...document, nodes } : document;
}

/** 목록과 모든 깊이의 노드에서 태그를 지운다. 목록이 비면 tags 필드를 지운다. */
export function deleteTag(
  root: WorkspaceDocument,
  tagId: string,
): WorkspaceDocument {
  if (!root.tags?.some((tag) => tag.id === tagId)) return root;
  const next = { ...stripTag(root, tagId) };
  const tags = root.tags.filter((tag) => tag.id !== tagId);
  if (tags.length) next.tags = tags;
  else delete next.tags;
  return next;
}

/** 태그 ID → 그 태그를 단 노드 수(하위 캔버스 포함). */
export function countTagUsage(root: WorkspaceDocument): Map<string, number> {
  const usage = new Map<string, number>();
  for (const node of walkWorkspaceNodes(root))
    for (const id of node.tags ?? []) usage.set(id, (usage.get(id) ?? 0) + 1);
  return usage;
}
