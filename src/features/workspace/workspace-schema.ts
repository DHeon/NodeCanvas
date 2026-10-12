import { z } from "zod";

import type { WorkspaceDocument } from "./types";

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

export const workspaceDocumentSchema = 
    z.strictObject({
        canvas: z.strictObject({
            width: z.number().positive().max(10000),
            height: z.number().positive().max(10000),
        }),
        nodes: z.array(textNodeSchema).max(1000),
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
        ) satisfies z.ZodType<WorkspaceDocument>;