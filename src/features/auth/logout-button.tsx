"use client";

import { useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

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
    <div>
      <button
        onClick={logout}
        type="button"
        disabled={pending}
        className="rounded-lg border border-neutral-600 px-4 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50"
      >
        {pending ? "로그아웃 중…" : "로그아웃"}
      </button>
      {errorMessage && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
