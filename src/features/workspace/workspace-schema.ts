import { z } from "zod";

import type { WorkspaceDocument } from "./types";
import { getConnectionKey, MAX_CONNECTIONS } from "./connections";
import {
  MAX_CANVAS_DEPTH,
  MAX_WORKSPACE_NODES,
  walkWorkspaceNodes,
} from "./workspace-tree";

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

function documentSchemaAtDepth(depth: number): z.ZodType<WorkspaceDocument> {
  // 무제한 재귀 파싱을 피하고, 생성 화면과 같은 깊이 제한을 적용한다.
  const nodeSchema =
    depth < MAX_CANVAS_DEPTH
      ? z.discriminatedUnion("type", [
          textNodeSchema,
          imageNodeSchema,
          nodeBaseSchema.extend({
            type: z.literal("canvas_node"),
            document: documentSchemaAtDepth(depth + 1),
          }),
        ])
      : z.discriminatedUnion("type", [textNodeSchema, imageNodeSchema]);
  return z
    .strictObject({
      canvas: z.strictObject({
        width: z.number().positive().max(10000),
        height: z.number().positive().max(10000),
        infinite: z.boolean().optional(),
      }),
      nodes: z.array(nodeSchema).max(MAX_WORKSPACE_NODES),
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
        new Set(document.connections.map((connection) => connection.id))
          .size === document.connections.length &&
        new Set(document.connections.map(getConnectionKey)).size ===
          document.connections.length,
      { message: "연결선이 중복되었습니다.", path: ["connections"] },
    );
}

export const workspaceDocumentSchema = documentSchemaAtDepth(0).superRefine(
  (document, context) => {
    const ids = new Set<string>();
    for (const node of walkWorkspaceNodes(document)) {
      if (ids.has(node.id)) {
        context.addIssue({
          code: "custom",
          message: "작업 공간 사이에 노드 ID가 중복되었습니다.",
        });
        return;
      }
      ids.add(node.id);
      if (ids.size > MAX_WORKSPACE_NODES) {
        context.addIssue({
          code: "custom",
          message: "프로젝트의 전체 노드 수가 제한을 초과했습니다.",
        });
        return;
      }
    }
  },
);
