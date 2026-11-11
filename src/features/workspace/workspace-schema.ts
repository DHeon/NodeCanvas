import { z } from "zod";

import type { WorkspaceDocument } from "./types";
import { getConnectionKey, MAX_CONNECTIONS } from "./connections";
import { CONNECTION_COLOR_KEYS } from "./connection-colors";
import {
  MAX_DRAWING_POINTS,
  MAX_POINTS_PER_STROKE,
  MAX_STROKES_PER_CANVAS,
  STROKE_WIDTHS,
  countDocumentDrawingPoints,
} from "./drawing";
import { MAX_LINK_URL_LENGTH, normalizeLinkUrl } from "./link-embed";
import {
  TEXT_ALIGN_KEYS,
  TEXT_COLOR_KEYS,
  TEXT_FONT_KEYS,
  TEXT_SIZE_KEYS,
} from "./text-style";
import {
  MAX_CANVAS_DEPTH,
  MAX_WORKSPACE_NODES,
  walkWorkspaceNodes,
} from "./workspace-tree";

const pointSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
});

const strokeSchema = z.strictObject({
  id: z.string().min(1).max(64),
  color: z.enum(CONNECTION_COLOR_KEYS),
  width: z.union(STROKE_WIDTHS.map((width) => z.literal(width))),
  points: z
    .array(z.number().finite())
    .min(2)
    .max(MAX_POINTS_PER_STROKE * 2)
    .refine(
      (points) => points.length % 2 === 0,
      "좌표 개수가 올바르지 않습니다.",
    ),
});

const drawingSchema = z
  .strictObject({
    strokes: z.array(strokeSchema).max(MAX_STROKES_PER_CANVAS),
  })
  .refine(
    (drawing) =>
      new Set(drawing.strokes.map((stroke) => stroke.id)).size ===
      drawing.strokes.length,
    { message: "선 ID가 중복되었습니다.", path: ["strokes"] },
  );

const nodeBaseSchema = z.strictObject({
  id: z.uuid(),
  position: pointSchema,
  width: z.number().positive().max(10000),
  height: z.number().positive().max(10000),
  title: z.string().max(200),
});

const textStyleSchema = z.strictObject({
  font: z.enum(TEXT_FONT_KEYS).optional(),
  size: z.enum(TEXT_SIZE_KEYS).optional(),
  bold: z.boolean().optional(),
  align: z.enum(TEXT_ALIGN_KEYS).optional(),
  color: z.enum(TEXT_COLOR_KEYS).optional(),
});

const textNodeSchema = nodeBaseSchema.extend({
  type: z.literal("text_node"),
  text: z.string().max(50000),
  textStyle: textStyleSchema.optional(),
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

const optionalText = (max: number) => z.string().max(max).optional();
const linkNodeSchema = nodeBaseSchema.extend({
  type: z.literal("link_node"),
  // 빈 문자열은 "아직 주소 없음". 그 밖에는 http(s) 주소만 저장한다.
  url: z
    .string()
    .max(MAX_LINK_URL_LENGTH)
    .refine((value) => value === "" || normalizeLinkUrl(value) === value, {
      message: "링크 주소가 올바르지 않습니다.",
    }),
  preview: z
    .strictObject({
      embeddable: z.boolean(),
      title: optionalText(200),
      description: optionalText(300),
      image: z
        .string()
        .max(MAX_LINK_URL_LENGTH)
        .refine(
          (value) =>
            value.startsWith("https://") || value.startsWith("http://"),
        )
        .optional(),
      siteName: optionalText(100),
    })
    .optional(),
});

const endpointSchema = z.strictObject({
  nodeId: z.uuid(),
  side: z.enum(["top", "right", "bottom", "left"]),
});

const connectionSchema = z.strictObject({
  id: z.uuid(),
  source: endpointSchema,
  target: endpointSchema,
  color: z.enum(CONNECTION_COLOR_KEYS).optional(),
});

function documentSchemaAtDepth(depth: number): z.ZodType<WorkspaceDocument> {
  // 무제한 재귀 파싱을 피하고, 생성 화면과 같은 깊이 제한을 적용한다.
  const nodeSchema =
    depth < MAX_CANVAS_DEPTH
      ? z.discriminatedUnion("type", [
          textNodeSchema,
          imageNodeSchema,
          linkNodeSchema,
          nodeBaseSchema.extend({
            type: z.literal("canvas_node"),
            document: documentSchemaAtDepth(depth + 1),
          }),
        ])
      : z.discriminatedUnion("type", [
          textNodeSchema,
          imageNodeSchema,
          linkNodeSchema,
        ]);
  return z
    .strictObject({
      canvas: z.strictObject({
        width: z.number().positive().max(10000),
        height: z.number().positive().max(10000),
        infinite: z.boolean().optional(),
        lineStyle: z.enum(["curved", "orthogonal"]).optional(),
        grid: z.boolean().optional(),
      }),
      nodes: z.array(nodeSchema).max(MAX_WORKSPACE_NODES),
      // 이전에 저장한 문서에는 연결선 항목이 없어도 열린다.
      connections: z.array(connectionSchema).max(MAX_CONNECTIONS).default([]),
      drawing: drawingSchema.optional(),
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
    const drawingPoints = countDocumentDrawingPoints(document);
    if (drawingPoints > MAX_DRAWING_POINTS) {
      context.addIssue({
        code: "custom",
        message: "프로젝트의 그림이 너무 큽니다.",
      });
      return;
    }

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
