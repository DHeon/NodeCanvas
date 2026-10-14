import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createWorkspace } from "../src/features/workspace/create-workspace";
import {
  loadWorkspaceDocument,
  saveWorkspaceDocument,
  WorkspaceSaveError,
} from "../src/features/workspace/workspace-save-client";

async function withFetch(mock: typeof fetch, check: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    await check();
  } finally {
    globalThis.fetch = original;
  }
}

test("저장은 명시적으로 호출될 때만 PUT 요청을 보냄", async () => {
  const document = createWorkspace();
  let calls = 0;
  await withFetch(
    async (url, init) => {
      calls++;
      assert.equal(String(url), "/api/projects/project-test/document");
      assert.equal(init?.method, "PUT");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        document,
        expectedVersion: 3,
      });
      assert.ok(init?.signal);
      return Response.json({ documentVersion: 4 });
    },
    async () => {
      await Promise.resolve();
      assert.equal(calls, 0);
      assert.equal(await saveWorkspaceDocument("project-test", document, 3), 4);
      assert.equal(calls, 1);
    },
  );
});

test("충돌·로그인 만료·유효성 오류는 구분하고 자동 재시도하지 않음", async () => {
  for (const status of [400, 401, 403, 404, 409, 500]) {
    let calls = 0;
    await withFetch(
      async () => {
        calls++;
        return Response.json({}, { status });
      },
      async () => {
        await assert.rejects(
          saveWorkspaceDocument("test", createWorkspace(), 0),
          (error: unknown) =>
            error instanceof WorkspaceSaveError &&
            error.status === status &&
            !error.message.includes("자동 저장"),
        );
        assert.equal(calls, 1);
      },
    );
  }
});

test("잘못된 성공 버전은 저장 성공으로 처리하지 않음", async () => {
  for (const documentVersion of [-1, 0, 3, "1"]) {
    await withFetch(
      async () => Response.json({ documentVersion }),
      async () => {
        await assert.rejects(
          saveWorkspaceDocument("test", createWorkspace(), 0),
        );
      },
    );
  }
});

test("통신 실패와 잘못된 JSON은 호출자에게 전달", async () => {
  await withFetch(
    async () => {
      throw new Error("offline");
    },
    async () => {
      await assert.rejects(
        saveWorkspaceDocument("test", createWorkspace(), 0),
        /offline/,
      );
    },
  );
  await withFetch(
    async () => new Response("not JSON"),
    async () => {
      await assert.rejects(saveWorkspaceDocument("test", createWorkspace(), 0));
    },
  );
});

test("사용자 재시도용 서버 조회에서 문서와 버전을 검증", async () => {
  const document = createWorkspace();
  await withFetch(
    async (_url, init) => {
      assert.equal(init?.cache, "no-store");
      return Response.json({ document, documentVersion: 2 });
    },
    async () => {
      assert.deepEqual(await loadWorkspaceDocument("test"), {
        document,
        documentVersion: 2,
      });
    },
  );
  await withFetch(
    async () => Response.json({ document: {}, documentVersion: 2 }),
    async () => {
      await assert.rejects(loadWorkspaceDocument("test"));
    },
  );
});

test("작업 공간에 자동 저장·브라우저 보관·복구 연결이 남지 않음", () => {
  const source = readFileSync(
    new URL("../src/features/workspace/workspace.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(source.includes("onClick={saveWorkspace}"));
  assert.ok(source.includes('addEventListener("beforeunload"'));
  for (const removed of [
    "localStorage",
    "persistDraft",
    "useWorkspacePersistence",
    "WorkspaceRecoveryNotice",
    "recoveryDrafts",
    "setTimeout",
    'addEventListener("online"',
  ])
    assert.ok(!source.includes(removed), removed);
});
