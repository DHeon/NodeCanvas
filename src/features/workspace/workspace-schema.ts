import { z } from "zod";

import type { WorkspaceDocument } from "./types";
import { getConnectionKey, MAX_CONNECTIONS } from "./connections";

const pointSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
});

const nodeBaseSchema = z.strictObject({
  id: z.uuid(),
  position: pointSchema,
  width: z.number().positive().max(10000),
  height: z.number().positive().max(10000),
  title: z.string().max(200),
});

const textNodeSchema = nodeBaseSchema.extend({
  type: z.literal("text_node"),
  text: z.string().max(50000),
});

export const imageReferenceSchema = z.strictObject({
  id: z.uuid(),
  width: z.number().int().positive().max(2560),
  height: z.number().int().positive().max(2560),
  byteLength: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
});

const imageNodeSchema = nodeBaseSchema.extend({
  type: z.literal("image_node"),
  image: imageReferenceSchema.nullable(),
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
      infinite: z.boolean().optional(),
    }),
    nodes: z
      .array(z.discriminatedUnion("type", [textNodeSchema, imageNodeSchema]))
      .max(1000),
    // 이전에 저장한 문서에는 연결선 항목이 없어도 열린다.
    connections: z.array(connectionSchema).max(MAX_CONNECTIONS).default([]),
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
      document.canvas.infinite ||
      document.nodes.every(
        (node) =>
          node.position.x >= 0 &&
          node.position.y >= 0 &&
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
