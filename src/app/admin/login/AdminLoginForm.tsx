"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { adminLogin, type AdminLoginState } from "./actions";

const initialState: AdminLoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="login-schneider mt-6 h-11 w-full rounded-xl bg-black px-4 text-[18px] text-white transition hover:bg-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-[#e74b32] disabled:cursor-wait disabled:opacity-65"
    >
      {pending ? "…" : "Enter"}
    </button>
  );
}

export function AdminLoginForm() {
  const [state, formAction] = useActionState(adminLogin, initialState);

  return (
    <form action={formAction} className="mt-5 space-y-3 sm:mt-6">
      <div>
        <label htmlFor="admin-username" className="mb-1.5 block text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-black/75">
          Email or username
        </label>
        <input
          id="admin-username"
          name="username"
          type="text"
          autoComplete="username"
          aria-invalid={Boolean(state.error)}
          className="h-11 w-full rounded-xl border border-black/10 bg-[#eef1f8] px-4 text-center text-[15px] text-black outline-none transition focus:border-black/45 focus:ring-2 focus:ring-black/15"
          required
        />
      </div>
      <div>
        <label htmlFor="admin-password" className="mb-1.5 block text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-black/75">
          Password
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "admin-login-error" : undefined}
          className="h-11 w-full rounded-xl border border-black/10 bg-[#eef1f8] px-4 text-center text-[15px] text-black outline-none transition focus:border-black/45 focus:ring-2 focus:ring-black/15"
          required
        />
      </div>
      <SubmitButton />
      <p id="admin-login-error" aria-live="polite" className="min-h-4 text-center text-[11px] font-medium text-black/75">
        {state.error ?? ""}
      </p>
    </form>
  );
}
