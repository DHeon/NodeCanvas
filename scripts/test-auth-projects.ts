import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { loginSchema } from "../src/features/auth/login-schema";
import { getLoginDestination } from "../src/features/auth/login-destination";

// Local integration test: starts no server, creates only isolated temporary users,
// and removes those exact users (with their cascading projects/sessions) in finally.
async function main() {
  const base = new URL(process.env.BETTER_AUTH_URL!);
  const db = new URL(process.env.DATABASE_URL!);
  assert(
    ["localhost", "127.0.0.1"].includes(base.hostname),
    "Local auth server required",
  );
  assert(
    ["localhost", "127.0.0.1"].includes(db.hostname),
    "Local test database required",
  );
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const run = randomUUID();
  const emails = [0, 1].map((index) => `auth-test-${run}-${index}@example.com`);
  const users: { id: string; cookie: string }[] = [];
  const password = randomUUID() + "Aa1!";
  const request = (path: string, init: RequestInit = {}) =>
    fetch(new URL(path, base), { ...init, redirect: "manual" });
  const authPost = (path: string, body: object, cookie = "") =>
    request("/api/auth/" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: base.origin,
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    });
  const cookies = (response: Response) =>
    response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
  const decode = (value: string) =>
    value
      .replace(/&quot;/g, '"')
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

  try {
    assert(
      loginSchema.safeParse({
        email: "  a@example.com  ",
        password: "12345678",
      }).success,
    );
    assert(!loginSchema.safeParse({ email: "bad", password: "" }).success);
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/projects/bad",
      ["/dashboard"],
    ]) {
      assert.equal(getLoginDestination(value), "/dashboard");
    }
    console.log("PASS: login validation and safe return URLs");

    const anonymous = await request("/dashboard");
    assert.equal(anonymous.status, 307);
    assert(anonymous.headers.get("location")?.startsWith("/login?next="));
    assert.equal((await request("/projects/" + randomUUID())).status, 307);
    console.log("PASS: anonymous dashboard/project redirects");

    for (const email of emails) {
      const signup = await authPost("sign-up/email", {
        email,
        password,
        name: "Temporary auth test",
      });
      assert.equal(signup.status, 200, "signup should succeed");
      const data = await signup.json();
      const signedIn = await authPost("sign-in/email", { email, password });
      assert.equal(signedIn.status, 200, "signin should succeed");
      const cookie = cookies(signedIn);
      assert(cookie, "signin must set a cookie");
      users.push({ id: data.user.id, cookie });
    }
    const badLogin = await authPost("sign-in/email", {
      email: emails[0],
      password: "wrong-password",
    });
    assert.equal(badLogin.status, 401);
    console.log("PASS: sign-up, sign-in cookies and wrong password rejection");

    const a = users[0];
    const b = users[1];
    const titleA = "Auth test A " + run;
    const titleB = "Auth test B " + run;

    const createFor = async (cookie: string, title: string) => {
      const page = await request("/dashboard", { headers: { Cookie: cookie } });
      assert.equal(page.status, 200);
      const html = await page.text();
      const form = new FormData();
      for (const match of html.matchAll(/<input\b[^>]*>/g)) {
        const name = /\bname="([^"]*)"/.exec(match[0])?.[1];
        const value = /\bvalue="([^"]*)"/.exec(match[0])?.[1] ?? "";
        if (name?.startsWith("$ACTION_"))
          form.append(decode(name), decode(value));
      }
      assert(
        [...form.keys()].length > 0,
        "server action fields must be rendered",
      );
      if (cookie === a.cookie) {
        assert(html.includes("아직 생성된 프로젝트가 없습니다."));
        form.set("title", "   ");
        const invalid = await request("/dashboard", {
          method: "POST",
          headers: { Cookie: cookie, Origin: base.origin },
          body: form,
        });
        assert.equal(invalid.status, 200);
        assert(
          (await invalid.text()).includes("프로젝트 이름을 입력해주세요."),
        );
        form.set("title", "Unauthorized project");
        const anonymousCreate = await request("/dashboard", {
          method: "POST",
          headers: { Origin: base.origin },
          body: form,
        });
        assert.equal(anonymousCreate.status, 303);
        assert(anonymousCreate.headers.get("location")?.startsWith("/login"));
        const count = await pool.query(
          'SELECT count(*) FROM project WHERE "ownerId" = $1',
          [a.id],
        );
        assert.equal(count.rows[0].count, "0");
        console.log(
          "PASS: empty state, invalid title and anonymous creation rejection",
        );
      }
      form.set("title", title);
      // This forged field must never determine the owner.
      form.set("ownerId", cookie === a.cookie ? b.id : a.id);
      const created = await request("/dashboard", {
        method: "POST",
        headers: { Cookie: cookie, Origin: base.origin },
        body: form,
      });
      assert.equal(created.status, 303, "project creation should redirect");
      const location = created.headers.get("location")!;
      assert(location.startsWith("/projects/"));
      return location.slice("/projects/".length);
    };
    const projectA = await createFor(a.cookie, titleA);
    const projectB = await createFor(b.cookie, titleB);
    const rows = await pool.query(
      'SELECT id, "ownerId" FROM project WHERE id = ANY($1::uuid[])',
      [[projectA, projectB]],
    );
    assert.equal(rows.rows.find((r) => r.id === projectA).ownerId, a.id);
    assert.equal(rows.rows.find((r) => r.id === projectB).ownerId, b.id);
    console.log(
      "PASS: project creation binds ownership to session, not submitted ownerId",
    );

    for (const [user, ownTitle, otherTitle, ownId, otherId] of [
      [a, titleA, titleB, projectA, projectB],
      [b, titleB, titleA, projectB, projectA],
    ] as const) {
      const page = await request("/dashboard", {
        headers: { Cookie: user.cookie },
      });
      const html = await page.text();
      assert(html.includes(ownTitle));
      assert(!html.includes(otherTitle));
      const own = await request("/projects/" + ownId, {
        headers: { Cookie: user.cookie },
      });
      assert.equal(own.status, 200);
      assert((await own.text()).includes("작업 공간"));
      const other = await request("/projects/" + otherId, {
        headers: { Cookie: user.cookie },
      });
      assert.equal(other.status, 404);
      const malformed = await request("/projects/not-a-uuid", {
        headers: { Cookie: user.cookie },
      });
      assert.equal(malformed.status, 404);
      const missing = await request("/projects/" + randomUUID(), {
        headers: { Cookie: user.cookie },
      });
      assert.equal(missing.status, 404);
    }
    console.log(
      "PASS: per-user lists, own access, foreign/missing/invalid project denial",
    );

    const login = await request("/login?next=https://evil.example", {
      headers: { Cookie: a.cookie },
    });
    assert.equal(login.status, 307);
    assert.equal(login.headers.get("location"), "/dashboard");

    const signedOut = await authPost("sign-out", {}, a.cookie);
    assert.equal(signedOut.status, 200);
    const revoked = await request("/dashboard", {
      headers: { Cookie: a.cookie },
    });
    assert.equal(revoked.status, 307);
    console.log(
      "PASS: safe redirect and revoked-session rejection after logout",
    );
  } finally {
    // Generated emails are unique to this run; never touch existing users.
    const result = await pool.query(
      'DELETE FROM "user" WHERE email = ANY($1::text[])',
      [emails],
    );
    console.log(
      `Cleanup: removed ${result.rowCount} temporary users and their test projects/sessions`,
    );
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
