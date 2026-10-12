import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().pipe(z.email("올바른 이메일 주소를 입력해주세요.")),
  password: z
    .string()
    .min(1, "비밀번호를 입력해주세요.")
    .max(128, "비밀번호가 너무 깁니다."),
});
