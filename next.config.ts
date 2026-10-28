import type { NextConfig } from "next";
import { appOrigins } from "./src/lib/app-origins";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: [
    ...new Set(appOrigins.map((origin) => new URL(origin).hostname)),
  ],
};

export default nextConfig;
