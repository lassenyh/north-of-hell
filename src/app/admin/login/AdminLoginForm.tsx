"use client";

import { useActionState } from "react";
import { adminLogin, type AdminLoginState } from "./actions";

const initialState: AdminLoginState = {};

export function AdminLoginForm() {
  const [state, formAction] = useActionState(adminLogin, initialState);

  return (
    <form action={formAction} className="space-y-5">
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
        />
      </div>
      <button
        type="submit"
        className="mt-4 w-full rounded-2xl bg-[#eaa631] px-4 py-2.5 text-sm font-medium text-black transition hover:bg-[#f1b64f] active:bg-[#dda124]"
      >
        Enter
      </button>
      {state.error && (
        <p className="pt-2 text-xs text-red-400">{state.error}</p>
      )}
    </form>
  );
}
