"use client";

import { useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { textLink } from "@/features/shell/styles";

export default function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const submitting = useRef(false);
  async function logout() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setErrorMessage("");
    try {
      const { error } = await authClient.signOut();
      if (error) {
        setErrorMessage("로그아웃하지 못했습니다. 다시 시도해주세요.");
        return;
      }
      window.location.replace("/login");
    } catch {
      setErrorMessage("서버에 연결하지 못했습니다.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return (
    <div className="flex items-center gap-3">
      {errorMessage && (
        <p role="alert" className="text-xs text-red-600">
          {errorMessage}
        </p>
      )}
      <button
        onClick={logout}
        type="button"
        disabled={pending}
        className={`${textLink} disabled:opacity-50`}
      >
        {pending ? "로그아웃 중…" : "로그아웃"}
      </button>
    </div>
  );
}
