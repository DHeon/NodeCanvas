import type { NextConfig } from "next";
import { appOrigins } from "./src/lib/app-origins";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // 개발용 표시는 캔버스 왼쪽 아래의 화면 맞춤 버튼과 겹치지 않게 오른쪽 아래에 둔다.
  devIndicators: { position: "bottom-right" },
  allowedDevOrigins: [
    ...new Set(appOrigins.map((origin) => new URL(origin).hostname)),
  ],
};

export default nextConfig;
