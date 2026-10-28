// 인증과 문서 저장이 같은 허용 주소 목록을 사용한다.
export function getAppOrigins(
  baseURL: string,
  additionalOrigins = "",
): string[] {
  if (!baseURL.trim()) {
    throw new Error("BETTER_AUTH_URL을 설정해주세요.");
  }

  const values = [baseURL, ...additionalOrigins.split(",")]
    .map((value) => value.trim())
    .filter(Boolean);

  return [
    ...new Set(
      values.map((value) => {
        const url = new URL(value);
        if (
          (url.protocol !== "http:" && url.protocol !== "https:") ||
          url.username ||
          url.password ||
          url.hostname.includes("*") ||
          url.pathname !== "/" ||
          url.search ||
          url.hash
        ) {
          throw new Error(
            "허용 주소는 경로 없는 정확한 HTTP/HTTPS 주소여야 합니다.",
          );
        }
        return url.origin;
      }),
    ),
  ];
}

export const appOrigins = getAppOrigins(
  process.env.BETTER_AUTH_URL ?? "",
  process.env.APP_TRUSTED_ORIGINS,
);
