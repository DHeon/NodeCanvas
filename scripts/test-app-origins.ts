import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { getAppOrigins } from "../src/lib/app-origins";

const baseURL = "http://192.0.2.10:3000";
const allowed = getAppOrigins(baseURL, "http://localhost:3000");

test("기준 주소와 추가 주소를 정규화하고 중복·빈 항목을 제거한다", () => {
  assert.deepEqual(
    getAppOrigins(baseURL, ` http://localhost:3000/ , ${baseURL}, ,`),
    [baseURL, "http://localhost:3000"],
  );
  assert.deepEqual(getAppOrigins(baseURL), [baseURL]);
});

test("잘못된 설정과 와일드카드 허용은 거절한다", () => {
  for (const value of [
    "",
    "*",
    "http://*.example.com",
    "ftp://example.com",
    "http://user:password@example.com",
    "https://example.com/path",
    "https://example.com?query=1",
    "https://example.com#fragment",
  ]) {
    assert.throws(() => getAppOrigins(value));
  }
});

test("인증과 문서 저장은 공통 허용 목록을 사용하고 Origin 검사를 유지한다", () => {
  const authSource = readFileSync(
    new URL("../src/lib/auth.ts", import.meta.url),
    "utf8",
  );
  const routeSource = readFileSync(
    new URL(
      "../src/app/api/projects/[projectId]/document/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(authSource.includes("trustedOrigins: appOrigins"));
  assert.ok(routeSource.includes("!origin || !appOrigins.includes(origin)"));
  assert.ok(!authSource.includes("disableOriginCheck"));
  assert.ok(!authSource.includes("disableCSRFCheck"));
});

test("Better Auth가 두 주소의 회원가입·로그인·로그아웃을 허용한다", async () => {
  // 메모리 어댑터만 사용한다. 실제 사용자나 DB 데이터를 만들지 않는다.
  const auth = betterAuth({
    baseURL,
    secret: randomUUID() + randomUUID(),
    trustedOrigins: allowed,
    database: memoryAdapter({
      user: [],
      session: [],
      account: [],
      verification: [],
    }),
    emailAndPassword: { enabled: true, autoSignIn: false },
    logger: { disabled: true },
  });
  const post = (
    origin: string,
    endpoint: string,
    body: object,
    cookie?: string,
  ) =>
    auth.handler(
      new Request(`${origin}/api/auth/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify(body),
      }),
    );

  for (const origin of allowed) {
    const email = `origin-test-${randomUUID()}@example.invalid`;
    const password = randomUUID() + "Aa1!";
    const signup = await post(origin, "sign-up/email", {
      name: "Origin test",
      email,
      password,
    });
    assert.equal(signup.status, 200, `회원가입: ${origin}`);
    const login = await post(origin, "sign-in/email", { email, password });
    assert.equal(login.status, 200, `로그인: ${origin}`);
    const cookie = login.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    assert.ok(cookie);

    for (const untrusted of [
      "https://untrusted.example",
      "http://localhost:3001",
      "http://localhost.attacker.example:3000",
    ]) {
      const blocked = await post(untrusted, "sign-out", {}, cookie);
      assert.equal(blocked.status, 403, `미등록 주소 차단: ${untrusted}`);
    }
    const logout = await post(origin, "sign-out", {}, cookie);
    assert.equal(logout.status, 200, `로그아웃: ${origin}`);
  }
});
