import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { getLoginDestination } from "@/features/auth/login-destination";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession(destination = "/dashboard") {
  const session = await getSession();
  if (!session) {
    redirect(
      "/login?next=" + encodeURIComponent(getLoginDestination(destination)),
    );
  }
  return session;
}
