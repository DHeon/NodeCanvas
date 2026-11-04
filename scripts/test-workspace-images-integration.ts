import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import sharp from "sharp";
import { createWorkspace } from "../src/features/workspace/create-workspace";
import type { ImageNode } from "../src/features/workspace/types";

// 로컬 DB/서버에서만 실행. 이 실행에서 생성한 사용자와 프로젝트만 finally에서 삭제한다.
async function main() {
  const base = new URL(
    process.env.NONO_TEST_BASE_URL ?? "http://localhost:3000",
  );
  const db = new URL(process.env.DATABASE_URL!);
  assert(["localhost", "127.0.0.1"].includes(base.hostname));
  assert(["localhost", "127.0.0.1"].includes(db.hostname));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const users: { id: string; cookie: string; projectId: string }[] = [];
  const request = (path: string, cookie = "", init: RequestInit = {}) =>
    fetch(new URL(path, base), {
      ...init,
      headers: { Origin: base.origin, Cookie: cookie, ...init.headers },
      redirect: "manual",
    });
  const png = await sharp({
    create: { width: 300, height: 900, channels: 3, background: "#9478dd" },
  })
    .png()
    .toBuffer();
  try {
    for (let i = 0; i < 2; i++) {
      const credentials = {
        email: `image-test-${randomUUID()}@example.com`,
        password: `${randomUUID()}Aa1!`,
      };
      const response = await request("/api/auth/sign-up/email", "", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Temporary image test", ...credentials }),
      });
      assert.equal(response.status, 200, "temporary signup");
      const data = await response.json();
      const user = {
        id: data.user.id as string,
        cookie: "",
        projectId: randomUUID(),
      };
      users.push(user);
      const login = await request("/api/auth/sign-in/email", "", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      assert.equal(login.status, 200);
      user.cookie = login.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      assert.ok(user.cookie);
      await pool.query(
        'INSERT INTO project (id,title,"ownerId","updatedAt") VALUES ($1,$2,$3,NOW())',
        [user.projectId, "Temporary image test", user.id],
      );
    }
    const [a, b] = users;
    const images = `/api/projects/${a.projectId}/images`;
    const upload = (
      cookie: string,
      body: Buffer,
      type = "image/png",
      origin = base.origin,
    ) =>
      request(images, cookie, {
        method: "POST",
        headers: { "Content-Type": type, Origin: origin },
        body: new Uint8Array(body),
      });
    assert.equal((await upload("", png)).status, 401);
    assert.equal((await upload(b.cookie, png)).status, 404);
    assert.equal(
      (await upload(a.cookie, png, "image/png", "http://not-allowed.example"))
        .status,
      403,
    );
    assert.equal(
      (await upload(a.cookie, Buffer.from("<svg/>"), "image/svg+xml")).status,
      415,
    );
    assert.equal(
      (await upload(a.cookie, Buffer.from("not an image"))).status,
      415,
    );
    assert.equal(
      (await upload(a.cookie, Buffer.alloc(10 * 1024 * 1024 + 1))).status,
      413,
    );
    const uploaded = await upload(a.cookie, png);
    assert.equal(uploaded.status, 201);
    const image = await uploaded.json();
    assert.equal(image.width, 300);
    assert.equal(image.height, 900);
    const assetPath = `${images}/${image.id}`;
    assert.equal((await request(assetPath)).status, 401);
    assert.equal((await request(assetPath, b.cookie)).status, 404);
    const blob = await request(assetPath, a.cookie);
    assert.equal(blob.status, 200);
    assert.equal(blob.headers.get("content-type"), "image/webp");
    assert.equal(blob.headers.get("cache-control"), "private, no-store");
    assert.equal(
      (await sharp(Buffer.from(await blob.arrayBuffer())).metadata()).height,
      900,
    );
    const document = createWorkspace();
    document.nodes = [
      {
        id: randomUUID(),
        type: "image_node",
        title: "세로 이미지",
        position: { x: 100, y: 100 },
        width: 240,
        height: 768,
        image,
      },
    ];
    const save = (
      projectId: string,
      cookie: string,
      doc: object,
      expectedVersion: number,
    ) =>
      request(`/api/projects/${projectId}/document`, cookie, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: doc, expectedVersion }),
      });
    assert.equal((await save(a.projectId, a.cookie, document, 0)).status, 200);
    const loaded = await (
      await request(`/api/projects/${a.projectId}/document`, a.cookie)
    ).json();
    assert.deepEqual(loaded.document, document);
    assert.equal(
      (await save(b.projectId, b.cookie, document, 0)).status,
      400,
      "cross-project image reference",
    );
    const tampered = structuredClone(document);
    (tampered.nodes[0] as ImageNode).image!.width++;
    assert.equal((await save(a.projectId, a.cookie, tampered, 1)).status, 400);
    const removed = structuredClone(document);
    (removed.nodes[0] as ImageNode).image = null;
    assert.equal((await save(a.projectId, a.cookie, removed, 1)).status, 200);
    assert.equal(
      (await request(assetPath, a.cookie)).status,
      200,
      "undo references must remain available",
    );
    assert.equal((await save(a.projectId, a.cookie, document, 2)).status, 200);
    const infiniteDocument = structuredClone(document);
    infiniteDocument.canvas.infinite = true;
    infiniteDocument.nodes[0].position = { x: -450, y: -900 };
    const textId = randomUUID();
    infiniteDocument.nodes.push({
      id: textId,
      type: "text_node",
      title: "무한 영역",
      text: "저장·재조회",
      position: { x: 22000, y: 16000 },
      width: 320,
      height: 220,
    });
    infiniteDocument.connections.push({
      id: randomUUID(),
      source: { nodeId: infiniteDocument.nodes[0].id, side: "right" },
      target: { nodeId: textId, side: "left" },
    });
    assert.equal(
      (await save(a.projectId, a.cookie, infiniteDocument, 3)).status,
      200,
    );
    const infiniteLoaded = await (
      await request(`/api/projects/${a.projectId}/document`, a.cookie)
    ).json();
    assert.equal(infiniteLoaded.documentVersion, 4);
    assert.deepEqual(infiniteLoaded.document, infiniteDocument);
    assert.equal(
      (
        await save(
          a.projectId,
          a.cookie,
          {
            ...infiniteDocument,
            canvas: { ...infiniteDocument.canvas, infinite: false },
          },
          4,
        )
      ).status,
      400,
      "finite document rejects out-of-bounds positions",
    );
    await pool.query('DELETE FROM project WHERE id=$1 AND "ownerId"=$2', [
      a.projectId,
      a.id,
    ]);
    const count = await pool.query(
      'SELECT COUNT(*) FROM image_asset WHERE "projectId"=$1',
      [a.projectId],
    );
    assert.equal(count.rows[0].count, "0");
    console.log(
      "PASS: image upload, authentication, owner/origin/size/type checks, DB storage, document reload, image undo retention and project cascade",
    );
  } finally {
    if (users.length)
      await pool.query('DELETE FROM "user" WHERE id = ANY($1::uuid[])', [
        users.map((user) => user.id),
      ]);
    await pool.end();
    console.log("Removed only this run's temporary users/projects/images.");
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
