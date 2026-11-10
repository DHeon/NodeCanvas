import type { InputHTMLAttributes } from "react";
import { textInput } from "@/features/shell/styles";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

/** 눈에 보이는 라벨 + 안내 + 필드별 오류를 가진 입력칸. name은 id와 같다. */
export default function AuthField({
  id,
  label,
  hint,
  error,
  ...input
}: AuthFieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-bark-soft">
        {label}
      </label>
      <input
        {...input}
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={textInput}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-lichen">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** zod 오류를 필드별 첫 메시지로 모은다. */
export function fieldErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
