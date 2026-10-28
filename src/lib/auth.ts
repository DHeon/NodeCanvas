import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { appOrigins } from "@/lib/app-origins";

const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;

if (!secret || !baseURL) {
  throw new Error("Better Auth environment variables are not set");
}

export const auth = betterAuth({
  // auth 설정
  appName: "Nono",
  secret,
  baseURL,
  trustedOrigins: appOrigins,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: false,
  },

  advanced: {
    database: {
      generateId: "uuid",
    },
  },
});
