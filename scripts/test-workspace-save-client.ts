import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
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

test("자동 저장은 서버에만 하고 브라우저 보관·복구는 하지 않는다", () => {
  const read = (file: string) =>
    readFileSync(
      new URL(`../src/features/workspace/${file}`, import.meta.url),
      "utf8",
    );
  const source = read("workspace.tsx");
  const autosave = read("use-autosave.ts");
  // 저장 버튼·Ctrl+S·편집 멈춤 뒤 자동 저장이 모두 같은 saveWorkspace를 쓴다.
  assert.ok(source.includes("onClick={() => void saveWorkspace()}"));
  assert.ok(source.includes("save: saveWorkspace"));
  assert.ok(source.includes('addEventListener("beforeunload"'));
  assert.ok(autosave.includes("AUTOSAVE_DELAY"));
  for (const file of [source, autosave])
    for (const removed of [
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "persistDraft",
      "WorkspaceRecoveryNotice",
      "recoveryDrafts",
    ])
      assert.ok(!file.includes(removed), removed);
});

test("자동 저장은 편집이 멈춘 뒤 한 번만, 바쁠 때는 미뤘다가 저장한다", async () => {
  const { AUTOSAVE_DELAY } =
    await import("../src/features/workspace/use-autosave");
  assert.ok(AUTOSAVE_DELAY >= 1000 && AUTOSAVE_DELAY <= 3000);
});

test("연결 생성·삭제 문서는 기존 저장 요청과 조회 형식으로 왕복한다", async () => {
  const document = createWorkspace();
  document.nodes = [0, 1].map((i) => ({
    id: randomUUID(),
    type: "text_node",
    position: { x: 100 + i * 500, y: 100 },
    width: 320,
    height: 220,
    title: `노드 ${i + 1}`,
    text: "",
  }));
  document.connections = [
    {
      id: randomUUID(),
      source: { nodeId: document.nodes[0].id, side: "right" },
      target: { nodeId: document.nodes[1].id, side: "left" },
    },
  ];
  let serverDocument = createWorkspace();
  let version = 0;
  await withFetch(
    async (_url, init) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        assert.equal(body.expectedVersion, version);
        serverDocument = body.document;
        version++;
        return Response.json({ documentVersion: version });
      }
      return Response.json({
        document: serverDocument,
        documentVersion: version,
      });
    },
    async () => {
      assert.equal(await saveWorkspaceDocument("test", document, 0), 1);
      assert.deepEqual(
        (await loadWorkspaceDocument("test")).document,
        document,
      );
      const deleted = { ...document, connections: [] };
      assert.equal(await saveWorkspaceDocument("test", deleted, 1), 2);
      assert.deepEqual((await loadWorkspaceDocument("test")).document, deleted);
    },
  );
});
