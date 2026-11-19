import type { WorkspaceDocument, WorkspaceNode } from "./types";
import { resolveWorkspacePath } from "./workspace-tree";

/**
 * 타임랩스 기록: 문서를 "항목"(키 → 값)으로 펼쳐 저장마다 바뀐 항목만 남긴다.
 * 키: shell|경로 · order|경로 · node|경로|ID · conn|경로|ID · stroke|경로|ID · group|경로|ID · tag|ID
 * 경로는 캔버스 노드 ID를 '/'로 이은 것(루트는 빈 문자열). 서버·브라우저 공용 순수 함수.
 */
export type Entries = Map<string, unknown>;
/**
 * 한 단계. set은 [키, 값] 목록(순서가 곧 그린·만든 순서). DB의 JSONB는 객체 키를 정렬하므로
 * 순서를 지키려고 객체가 아닌 목록으로 둔다.
 */
export type Patch = { set: [string, unknown][]; del: string[] };

type Shell = {
  canvas: WorkspaceDocument["canvas"];
  drawing: boolean;
  groups: boolean;
  tags: boolean;
};

/** B(순서 추정)에서 획을 한 단계에 몇 개씩 보일지. */
export const ESTIMATED_STROKES_PER_STEP = 20;
/** 같은 줄로 볼 노드 위쪽 좌표 차이(B 순서). */
const ROW_TOLERANCE = 60;

const childPath = (path: string, id: string) => (path ? `${path}/${id}` : id);

/** 문서를 항목으로 펼친다(모든 하위 캔버스 포함). 같은 문서는 늘 같은 순서로 나온다. */
export function flattenDocument(document: WorkspaceDocument): Entries {
  const entries: Entries = new Map();
  const visit = (doc: WorkspaceDocument, path: string) => {
    entries.set(`shell|${path}`, {
      canvas: doc.canvas,
      drawing: doc.drawing !== undefined,
      groups: doc.groups !== undefined,
      tags: doc.tags !== undefined,
    } satisfies Shell);
    entries.set(
      `order|${path}`,
      doc.nodes.map((node) => node.id),
    );
    for (const tag of doc.tags ?? []) entries.set(`tag|${tag.id}`, tag);
    for (const node of doc.nodes) {
      if (node.type === "canvas_node") {
        const { document: inner, ...rest } = node;
        entries.set(`node|${path}|${node.id}`, rest);
        visit(inner, childPath(path, node.id));
      } else entries.set(`node|${path}|${node.id}`, node);
    }
    for (const connection of doc.connections)
      entries.set(`conn|${path}|${connection.id}`, connection);
    for (const stroke of doc.drawing?.strokes ?? [])
      entries.set(`stroke|${path}|${stroke.id}`, stroke);
    for (const group of doc.groups ?? [])
      entries.set(`group|${path}|${group.id}`, group);
  };
  visit(document, "");
  return entries;
}

type Bucket = {
  shell?: Shell;
  order: string[];
  nodes: Map<string, WorkspaceNode>;
  connections: unknown[];
  strokes: unknown[];
  groups: unknown[];
};

function parseKey(key: string) {
  const [kind, path = "", id = ""] = key.split("|");
  return kind === "tag" ? { kind, path: "", id: path } : { kind, path, id };
}

/** 항목으로 문서를 다시 만든다. 아직 없는 캔버스는 빈 캔버스로 만든다. */
export function buildDocument(entries: Entries): WorkspaceDocument {
  const buckets = new Map<string, Bucket>();
  const bucket = (path: string) => {
    let found = buckets.get(path);
    if (!found) {
      found = {
        order: [],
        nodes: new Map(),
        connections: [],
        strokes: [],
        groups: [],
      };
      buckets.set(path, found);
    }
    return found;
  };
  const tags: unknown[] = [];
  for (const [key, value] of entries) {
    const { kind, path, id } = parseKey(key);
    if (kind === "tag") tags.push(value);
    else if (kind === "shell") bucket(path).shell = value as Shell;
    else if (kind === "order") bucket(path).order = value as string[];
    else if (kind === "node")
      bucket(path).nodes.set(id, value as WorkspaceNode);
    else if (kind === "conn") bucket(path).connections.push(value);
    else if (kind === "stroke") bucket(path).strokes.push(value);
    else if (kind === "group") bucket(path).groups.push(value);
  }

  const build = (path: string): WorkspaceDocument => {
    const found = bucket(path);
    const shell = found.shell ?? {
      canvas: { width: 1600, height: 900 },
      drawing: false,
      groups: false,
      tags: false,
    };
    const ordered = [
      ...found.order.filter((id) => found.nodes.has(id)),
      ...[...found.nodes.keys()].filter((id) => !found.order.includes(id)),
    ];
    const document: WorkspaceDocument = {
      canvas: shell.canvas,
      nodes: ordered.map((id) => {
        const node = found.nodes.get(id)!;
        return node.type === "canvas_node"
          ? ({
              ...node,
              document: build(childPath(path, id)),
            } as WorkspaceNode)
          : node;
      }),
      connections: found.connections as WorkspaceDocument["connections"],
    };
    if (shell.tags) document.tags = tags as WorkspaceDocument["tags"];
    if (shell.drawing)
      document.drawing = {
        strokes: found.strokes as NonNullable<
          WorkspaceDocument["drawing"]
        >["strokes"],
      };
    if (shell.groups)
      document.groups = found.groups as WorkspaceDocument["groups"];
    return document;
  };
  return build("");
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a).filter(
    (key) => (a as Record<string, unknown>)[key] !== undefined,
  );
  const bKeys = Object.keys(b).filter(
    (key) => (b as Record<string, unknown>)[key] !== undefined,
  );
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) =>
    sameValue(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
    ),
  );
}

/** 두 항목 묶음의 차이: 새로 생기거나 바뀐 항목은 set, 사라진 항목은 del(키만). */
export function diffEntries(before: Entries, after: Entries): Patch {
  const set: [string, unknown][] = [];
  for (const [key, value] of after)
    if (!before.has(key) || !sameValue(before.get(key), value))
      set.push([key, value]);
  const del = [...before.keys()].filter((key) => !after.has(key));
  return { set, del };
}

export function isEmptyPatch(patch: Patch) {
  return patch.set.length === 0 && patch.del.length === 0;
}

/** 항목 묶음에 한 단계를 적용한다(제자리에서 바꾼다). */
export function applyPatch(entries: Entries, patch: Patch) {
  for (const key of patch.del) entries.delete(key);
  for (const [key, value] of patch.set) entries.set(key, value);
}

/** 두 단계를 하나로 합친다(오래된 기록 묶기). 차례로 적용한 것과 결과가 같다. */
export function composePatches(first: Patch, second: Patch): Patch {
  const set = new Map(first.set);
  for (const key of second.del) set.delete(key);
  for (const [key, value] of second.set) set.set(key, value);
  const added = new Set(second.set.map(([key]) => key));
  const del = new Set(first.del.filter((key) => !added.has(key)));
  for (const key of second.del) del.add(key);
  return { set: [...set], del: [...del] };
}

/**
 * B(순서 추정): 기록이 시작되기 전에 이미 있던 내용을 그럴듯한 순서의 여러 단계로 쪼갠다.
 * 캔버스마다 노드를 위→아래·왼쪽→오른쪽으로 하나씩(양 끝이 다 나온 연결선·첫 멤버의 그룹과 함께),
 * 그다음 펜 획을 20개씩. 하위 캔버스는 부모 캔버스가 끝난 뒤.
 */
export function estimatedSteps(entries: Entries): Patch[] {
  const steps: Patch[] = [];
  const used = new Set<string>();
  const byPath = new Map<string, string[]>();
  for (const key of entries.keys()) {
    const { kind, path } = parseKey(key);
    if (kind === "tag") continue;
    const list = byPath.get(path) ?? [];
    list.push(key);
    byPath.set(path, list);
  }
  const take = (key: string, into: Record<string, unknown>) => {
    if (used.has(key) || !entries.has(key)) return;
    used.add(key);
    into[key] = entries.get(key);
  };

  const reveal = (path: string) => {
    const keys = byPath.get(path) ?? [];
    let pending: Record<string, unknown> = {};
    take(`shell|${path}`, pending);
    take(`order|${path}`, pending);
    if (!path)
      for (const key of entries.keys())
        if (key.startsWith("tag|")) take(key, pending);

    const nodeKeys = keys.filter((key) => key.startsWith("node|"));
    const position = (key: string) =>
      (entries.get(key) as WorkspaceNode).position;
    nodeKeys.sort((a, b) => position(a).y - position(b).y);
    const rows: string[][] = [];
    for (const key of nodeKeys) {
      const row = rows.at(-1);
      if (row && position(key).y - position(row[0]).y <= ROW_TOLERANCE)
        row.push(key);
      else rows.push([key]);
    }
    const ordered = rows.flatMap((row) =>
      row.sort((a, b) => position(a).x - position(b).x),
    );

    const shown = new Set<string>();
    const connections = keys.filter((key) => key.startsWith("conn|"));
    const canvases: string[] = [];
    for (const key of ordered) {
      const set = pending;
      pending = {};
      take(key, set);
      const node = entries.get(key) as WorkspaceNode;
      shown.add(node.id);
      if (node.type === "canvas_node") canvases.push(node.id);
      if (node.groupId) take(`group|${path}|${node.groupId}`, set);
      for (const conn of connections) {
        const value = entries.get(conn) as {
          source: { nodeId: string };
          target: { nodeId: string };
        };
        if (shown.has(value.source.nodeId) && shown.has(value.target.nodeId))
          take(conn, set);
      }
      steps.push({ set: Object.entries(set), del: [] });
    }

    const strokes = keys.filter((key) => key.startsWith("stroke|"));
    for (let i = 0; i < strokes.length; i += ESTIMATED_STROKES_PER_STEP) {
      const set = pending;
      pending = {};
      for (const key of strokes.slice(i, i + ESTIMATED_STROKES_PER_STEP))
        take(key, set);
      steps.push({ set: Object.entries(set), del: [] });
    }
    // 남은 것(멤버 없는 그룹, 끝이 없는 연결선 등)은 이 캔버스 마지막 단계에.
    const rest = pending;
    for (const key of keys) take(key, rest);
    if (Object.keys(rest).length) {
      if (steps.length && Object.keys(pending).length === 0)
        steps.at(-1)!.set.push(...Object.entries(rest));
      else steps.push({ set: Object.entries(rest), del: [] });
    }
    for (const id of canvases) reveal(childPath(path, id));
  };
  reveal("");
  // 어느 캔버스에도 닿지 않는 항목(깨진 경로)도 빠뜨리지 않는다.
  const leftovers: Record<string, unknown> = {};
  for (const key of entries.keys()) take(key, leftovers);
  if (Object.keys(leftovers).length)
    steps.push({ set: Object.entries(leftovers), del: [] });
  return steps;
}

/** 한 단계가 path 캔버스에서 바꾸는 것: 새 노드·내용이 바뀐 노드·새 획, 그리고 이 캔버스에 닿는지. */
export function pathChanges(
  before: Entries,
  patch: Patch,
  path: string,
): {
  entered: string[];
  changed: string[];
  strokes: string[];
  touched: boolean;
} {
  const entered: string[] = [];
  const changed: string[] = [];
  const strokes: string[] = [];
  let touched = false;
  const consider = (key: string, removed: boolean) => {
    const parsed = parseKey(key);
    if (parsed.kind === "tag") {
      if (!path) touched = true;
      return;
    }
    if (parsed.path !== path) return;
    touched = true;
    if (removed) return;
    if (parsed.kind === "node")
      (before.has(key) ? changed : entered).push(parsed.id);
    else if (parsed.kind === "stroke" && !before.has(key))
      strokes.push(parsed.id);
  };
  for (const [key] of patch.set) consider(key, false);
  for (const key of patch.del) consider(key, true);
  return { entered, changed, strokes, touched };
}

/** 재생할 한 장면: 그 시점의 캔버스와 이번에 새로 나온·바뀐 것. */
export type TimelapseFrame = {
  document: WorkspaceDocument;
  entered: string[];
  changed: string[];
  strokes: string[];
  /** 기록 전 내용을 순서 추정(B)으로 펼친 장면. */
  estimated: boolean;
};

/**
 * 기록(오래된 순)과 지금 문서로 한 캔버스의 장면 목록을 만든다.
 * 기준 기록은 B로 쪼개고, 끝에 아직 저장 안 된 편집(지금 문서와의 차이)을 붙인다.
 * 그 캔버스를 건드리지 않는 단계는 건너뛴다. 맨 앞은 빈 화면이다.
 * estimatedCount: 앞에서부터 추정 장면 수(기준 기록이 없으면 0).
 */
export function buildTimelapseFrames(
  rows: readonly { baseline: boolean; patch: Patch }[],
  current: WorkspaceDocument,
  path: readonly string[],
): { frames: TimelapseFrame[]; estimatedCount: number } {
  const key = path.join("/");
  // 캔버스 크기는 지금 모습으로 고정한다. 노드를 놓은 저장과 캔버스가 커진 저장이 따로면
  // 재생 중에 노드가 캔버스 밖에 있다가 캔버스가 뒤늦게 따라 커지는 것처럼 보인다.
  const finalCanvas = resolveWorkspacePath(current, path).document.canvas;
  const canvasAt = (entries: Entries): WorkspaceDocument => {
    const root = buildDocument(entries);
    const { document, trail } = resolveWorkspacePath(root, path);
    return trail.length === path.length
      ? { ...document, canvas: finalCanvas }
      : { canvas: finalCanvas, nodes: [], connections: [] };
  };
  const steps: { patch: Patch; estimated: boolean }[] = [];
  const replayed: Entries = new Map();
  for (const row of rows) {
    if (row.baseline) {
      const base: Entries = new Map(replayed);
      applyPatch(base, row.patch);
      for (const patch of estimatedSteps(diffAsEntries(replayed, base)))
        steps.push({ patch, estimated: true });
    } else steps.push({ patch: row.patch, estimated: false });
    applyPatch(replayed, row.patch);
  }
  const unsaved = diffEntries(replayed, flattenDocument(current));
  if (!isEmptyPatch(unsaved)) steps.push({ patch: unsaved, estimated: false });

  const startsEstimated = steps[0]?.estimated ?? false;
  const entries: Entries = new Map();
  const frames: TimelapseFrame[] = [
    {
      document: canvasAt(entries),
      entered: [],
      changed: [],
      strokes: [],
      estimated: startsEstimated,
    },
  ];
  for (const step of steps) {
    const parts = step.estimated
      ? [step.patch]
      : splitPatch(entries, step.patch, key);
    for (const part of parts) {
      const changes = pathChanges(entries, part, key);
      applyPatch(entries, part);
      if (!changes.touched) continue;
      frames.push({
        document: canvasAt(entries),
        entered: changes.entered,
        changed: changes.changed,
        strokes: changes.strokes,
        estimated: step.estimated,
      });
    }
  }
  let estimatedCount = 0;
  while (frames[estimatedCount]?.estimated) estimatedCount++;
  return { frames, estimatedCount };
}

/**
 * 한 번의 저장을 장면 여러 개로 나눈다. 이 캔버스에 새로 놓인 노드와 새 연결선은 하나씩
 * (선은 양 끝 노드가 다 나온 뒤), 새 획은 마지막에 한 장면으로 모은다.
 * 내용 고침·이동·삭제 같은 나머지는 맨 앞 한 장면으로 압축한다.
 */
function splitPatch(before: Entries, patch: Patch, path: string): Patch[] {
  const rest: Patch = { set: [], del: [...patch.del] };
  const nodes: [string, unknown][] = [];
  const lines: [string, unknown][] = [];
  const strokes: [string, unknown][] = [];
  for (const pair of patch.set) {
    const parsed = parseKey(pair[0]);
    const fresh = parsed.path === path && !before.has(pair[0]);
    if (fresh && parsed.kind === "node") nodes.push(pair);
    else if (fresh && parsed.kind === "conn") lines.push(pair);
    else if (fresh && parsed.kind === "stroke") strokes.push(pair);
    else rest.set.push(pair);
  }
  const shown = new Set<string>();
  for (const key of before.keys()) {
    const parsed = parseKey(key);
    if (parsed.kind === "node" && parsed.path === path) shown.add(parsed.id);
  }
  for (const key of patch.del) shown.delete(parseKey(key).id);
  const ends = (value: unknown) => {
    const line = value as {
      source?: { nodeId?: string };
      target?: { nodeId?: string };
    };
    return [line.source?.nodeId ?? "", line.target?.nodeId ?? ""];
  };
  const parts: Patch[] = [];
  let waiting = lines;
  const releaseLines = () => {
    const ready = waiting.filter(([, value]) =>
      ends(value).every((id) => shown.has(id)),
    );
    waiting = waiting.filter((pair) => !ready.includes(pair));
    for (const pair of ready) parts.push({ set: [pair], del: [] });
  };
  releaseLines();
  for (const pair of nodes) {
    parts.push({ set: [pair], del: [] });
    shown.add(parseKey(pair[0]).id);
    releaseLines();
  }
  for (const pair of waiting) parts.push({ set: [pair], del: [] });
  if (strokes.length) parts.push({ set: strokes, del: [] });
  // 나머지에 이 캔버스에서 눈에 보이는 변화가 없으면(순서·설정만) 첫 장면에 얹어 빈 장면을 만들지 않는다.
  const visible =
    rest.del.some((key) => parseKey(key).path === path) ||
    rest.set.some(([key]) => {
      const parsed = parseKey(key);
      return (
        (parsed.kind === "tag" && !path) ||
        (parsed.path === path &&
          parsed.kind !== "shell" &&
          parsed.kind !== "order")
      );
    });
  if (visible || !parts.length) return [rest, ...parts];
  parts[0] = { set: [...rest.set, ...parts[0].set], del: [] };
  return parts;
}

/** 기준 기록 앞에 이미 재생된 항목이 있으면(묶인 기록) 그 위에 더해진 것만 추정 순서로 펼친다. */
function diffAsEntries(before: Entries, after: Entries): Entries {
  return new Map(diffEntries(before, after).set);
}

/** 장면 하나를 보여 주는 시간(ms, 1×). 새 획이 많으면 조금 더 길다. */
export function frameDuration(frame: { strokes: readonly string[] }) {
  return 700 + Math.min(frame.strokes.length, 26) * 50;
}
