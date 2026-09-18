import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;

if (!secret || !baseURL) {
  throw new Error("Better Auth environment variables are not set");
}

export const auth = betterAuth({
  appName: "Nono",
  secret,
  baseURL,

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