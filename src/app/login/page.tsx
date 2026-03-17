import { LoginForm } from "./LoginForm";

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

          <LoginForm />
        </div>
      </div>
    </div>
  );
}

