import { z } from "zod";

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "이름은 2자 이상 입력해주세요.")
      .max(50, "이름은 50자 이하로 입력해주세요."),

    email: z.email("올바른 이메일 주소를 입력해주세요.").trim(),

    password: z
      .string()
      .min(8, "비밀번호는 8자 이상 입력해주세요.")
      .max(128, "비밀번호는 128자 이하로 입력해주세요."),

    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  });