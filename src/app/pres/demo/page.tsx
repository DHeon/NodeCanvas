import type { Metadata } from "next";
import DemoWorkspace from "./demo-workspace";

export const metadata: Metadata = {
  title: "Nono | 작업 공간 데모",
  description: "캔버스 위에서 텍스트를 자유롭게 배치하는 작업 공간 프로토타입",
};

export default function DemoPage() {
  return <DemoWorkspace />;
}
