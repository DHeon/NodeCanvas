import { z } from "zod";

import type { WorkspaceDocument } from "./types";
import { getConnectionKey } from "./connections";

const pointSchema = z.strictObject({
  x: z.number().min(0),
  y: z.number().min(0),
});

const textNodeSchema = z.strictObject({
  id: z.uuid(),
  type: z.literal("text_node"),
  position: pointSchema,
  width: z.number().positive().max(10000),
  height: z.number().positive().max(10000),
  title: z.string().max(200),
  text: z.string().max(50000),
});

const endpointSchema = z.strictObject({
  nodeId: z.uuid(),
  side: z.enum(["top", "right", "bottom", "left"]),
});

const connectionSchema = z.strictObject({
  id: z.uuid(),
  source: endpointSchema,
  target: endpointSchema,
});

export const workspaceDocumentSchema = z
  .strictObject({
    canvas: z.strictObject({
      width: z.number().positive().max(10000),
      height: z.number().positive().max(10000),
    }),
    nodes: z.array(textNodeSchema).max(1000),
    // 이전에 저장한 문서에는 연결선 항목이 없어도 열린다.
    connections: z.array(connectionSchema).max(3000).default([]),
  })
  .refine(
    (document) => {
      const ids = document.nodes.map((node) => node.id);

      return new Set(ids).size === ids.length;
    },
    {
      message: "노드 ID가 중복되었습니다.",
      path: ["nodes"],
    },
  )
  .refine(
    (document) =>
      document.nodes.every(
        (node) =>
          node.position.x + node.width <= document.canvas.width &&
          node.position.y + node.height <= document.canvas.height,
      ),
    {
      message: "노드가 캔버스 영역을 벗어났습니다.",
      path: ["nodes"],
    },
  )
  .refine(
    (document) => {
      const nodeIds = new Set(document.nodes.map((node) => node.id));
      return document.connections.every(
        (connection) =>
          connection.source.nodeId !== connection.target.nodeId &&
          nodeIds.has(connection.source.nodeId) &&
          nodeIds.has(connection.target.nodeId),
      );
    },
    { message: "연결 대상 노드가 올바르지 않습니다.", path: ["connections"] },
  )
  .refine(
    (document) =>
      new Set(document.connections.map((connection) => connection.id)).size ===
        document.connections.length &&
      new Set(document.connections.map(getConnectionKey)).size ===
        document.connections.length,
    { message: "연결선이 중복되었습니다.", path: ["connections"] },
  ) satisfies z.ZodType<WorkspaceDocument>;
