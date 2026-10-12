import { z } from "zod";

import { workspaceDocumentSchema } from "./workspace-schema";


const workspaceDraftSchema = z.strictObject({
    formatVersion: z.literal(1),
    draftId: z.uuid(),
    ownerId: z.uuid(),
    projectId: z.uuid(),
    baseVersion: z.number().int().nonnegative(),
    savedAt: z.number().int().nonnegative(),
    document: workspaceDocumentSchema,
});

export type WorkspaceDraft = z.infer<
    typeof workspaceDraftSchema
>;

function getDraftPrefix(
    ownerId: string,
    projectId: string,
) {
    return `nono:workspace-draft:${ownerId}:${projectId}:`;
}

function getDraftKey(
    ownerId: string,
    projectId: string,
    draftId: string,
) {
    return getDraftPrefix(ownerId, projectId) + draftId;
}

export function writeWorkspaceDraft(
    draft: WorkspaceDraft,
) {
    const validated = workspaceDraftSchema.parse(draft);

    const key = getDraftKey(
        validated.ownerId,
        validated.projectId,
        validated.draftId,
    );

    window.localStorage.setItem(
        key,
        JSON.stringify(validated),
    );
}

export function readWorkspaceDrafts(
    ownerId: string,
    projectId: string,
): WorkspaceDraft[] {
    const storage = window.localStorage;
    const prefix = getDraftPrefix(ownerId, projectId);
    const drafts: WorkspaceDraft[] = [];

    for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);

        if (!key || !key.startsWith(prefix)) continue;

        const raw = storage.getItem(key);

        if (raw === null) continue;

        let value: unknown;

        try {
            value = JSON.parse(raw);
        } catch {
            // 손상된 데이터는 복구 대상으로 사용하지 않는다.
            continue;
        }

        const result = workspaceDraftSchema.safeParse(value);

        if (!result.success) continue;

        const draft = result.data;

        if (
            draft.ownerId !== ownerId ||
            draft.projectId !== projectId ||
            key !== getDraftKey(ownerId, projectId, draft.draftId)
        ) {
            continue;
        }

        drafts.push(draft);
    }

    return drafts.sort(
        (a, b) => b.savedAt - a.savedAt,
    );
}

export function removeWorkspaceDraft(
    ownerId: string,
    projectId: string,
    draftId: string,
) {
    window.localStorage.removeItem(
        getDraftKey(ownerId, projectId, draftId),
    );
}

export function removeProjectDrafts(
    ownerId: string,
    projectId: string,
) {
    // 잘못된 ID로 넓은 범위가 삭제되는 것을 방지
    z.uuid().parse(ownerId);
    z.uuid().parse(projectId);

    const storage = window.localStorage;
    const prefix = getDraftPrefix(ownerId, projectId);
    const keys: string[] = [];

    for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);

        if (key?.startsWith(prefix)) {
            keys.push(key);
        }
    }

    // 순회 중 삭제하면 인덱스가 바뀌므로 먼저 목록을 모은다.
    for (const key of keys) {
        storage.removeItem(key);
    }
}