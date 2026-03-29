"use client";

import { useState } from "react";

type Props = {
  onSuccess?: () => void;
};

export function LoginForm({ onSuccess }: Props) {
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const form = e.currentTarget;
    const username = String(new FormData(form).get("username") ?? "").trim();
    const password = String(new FormData(form).get("password") ?? "").trim();

    if (!username || !password) {
      setError("Incorrect username or password.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Incorrect username or password."
        );
        return;
      }
      onSuccess?.();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-300">
          Username
        </label>
        <input
          name="username"
          type="text"
          autoComplete="username"
          className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none ring-0 transition focus:border-[#eaa631] focus:ring-2 focus:ring-[#eaa631]/40"
          placeholder="username"
          required
          disabled={pending}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-300">
          Password
        </label>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none ring-0 transition focus:border-[#eaa631] focus:ring-2 focus:ring-[#eaa631]/40"
          placeholder="••••••••"
          required
          disabled={pending}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full rounded-2xl bg-[#eaa631] px-4 py-2.5 text-sm font-medium text-black transition hover:bg-[#f1b64f] active:bg-[#dda124] disabled:opacity-60"
      >
        {pending ? "…" : "Enter"}
      </button>
      {error && (
        <p className="pt-2 text-xs text-red-400">{error}</p>
      )}
    </form>
  );
}
