// 외부 URL이나 임의 경로로 이동하지 않고 보호된 페이지로만 돌아간다.
export function getLoginDestination(value: unknown): string {
  if (typeof value !== "string") return "/dashboard";
  if (value === "/dashboard") return value;
  if (
    /^\/projects\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return value;
  }
  return "/dashboard";
}
