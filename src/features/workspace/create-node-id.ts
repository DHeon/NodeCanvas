import { v4 as uuidv4 } from "uuid";

export function createNodeId(): string {
  return uuidv4();
} // 랜덤 uuid 만들어줌.