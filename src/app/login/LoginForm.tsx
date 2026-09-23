"use client";

import { useState } from "react";

type Props = {
  disabled?: boolean;
  onSuccess?: () => void;
  variant?: "card" | "open";
};

export function LoginForm({
  disabled = false,
  onSuccess,
  variant = "card",
}: Props) {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const form = event.currentTarget;
    const code = String(new FormData(form).get("code") ?? "").trim();
    if (!code) {
      setError("Enter the access code.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Incorrect code.");
        return;
      }

      onSuccess?.();
    } finally {
      setPending(false);
    }
  }

  const isDisabled = disabled || pending;
  const isOpen = variant === "open";

  return (
    <form
      onSubmit={handleSubmit}
      className={isOpen ? "w-full" : "mt-5 sm:mt-6"}
    >
      <label
        htmlFor="login-code"
        className={`mb-1.5 block text-center text-[9px] font-semibold uppercase tracking-[0.16em] sm:text-[10px] ${
          isOpen ? "text-white/65" : "text-black/75"
        }`}
      >
        Passcode
      </label>
      <input
        id="login-code"
        name="code"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        disabled={isDisabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "login-error" : undefined}
        className={`h-10 w-full rounded-xl border px-4 text-center text-[24px] leading-none tracking-[0.14em] text-black shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)] outline-none transition placeholder:text-black/30 disabled:opacity-60 sm:h-11 sm:text-[26px] ${
          isOpen
            ? "border-white/40 bg-[#eef1f8]/55 focus:border-white/40 focus:ring-0"
            : "border-black/10 bg-[#eef1f8] focus:border-black/45 focus:ring-2 focus:ring-black/15"
        }`}
      />

      <button
        type="submit"
        disabled={isDisabled}
        className={`login-schneider h-10 w-full rounded-xl px-4 text-[17px] transition focus:outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-65 sm:h-11 sm:text-[18px] ${
          isOpen
            ? "mt-4 bg-[#c72b1f] text-white hover:bg-[#ae241a] focus-visible:ring-[#c72b1f] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            : "mt-7 bg-black text-white hover:bg-zinc-900 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-[#e74b32]"
        }`}
      >
        {pending ? "…" : "Enter"}
      </button>

      <p
        id="login-error"
        aria-live="polite"
        className={`mt-3 min-h-4 text-center text-[11px] font-medium transition-opacity ${
          isOpen ? "text-[#f3c65f]" : "text-black/75"
        } ${
          error ? "opacity-100" : "opacity-0"
        }`}
      >
        {error ?? "Incorrect code."}
      </p>
    </form>
  );
}
