import Link from "next/link";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto flex min-h-screen max-w-[1200px] items-center justify-center px-6 sm:px-8 md:px-12 lg:px-16">
        <div className="w-full max-w-md space-y-8 rounded-3xl border border-zinc-800/70 bg-zinc-950/70 px-8 py-10 shadow-[0_18px_60px_rgba(0,0,0,0.7)]">
          <header className="text-center">
            <p className="mb-3 text-xs lowercase tracking-[0.25em] text-zinc-500 sm:text-sm [font-family:var(--font-im-fell-english),serif]">
              a film by niels windfeldt
            </p>
            <h1 className="text-3xl font-medium uppercase tracking-tight text-[#eaa631] sm:text-[2.35rem] [font-family:var(--font-im-fell-english),serif]">
              North of Hell
            </h1>
          </header>

          <form action={login} className="space-y-5">
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
          </form>
        </div>
      </div>
    </div>
  );
}

