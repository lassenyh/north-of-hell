"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IntroFilmExperience } from "@/components/intro/IntroFilmExperience";
import { INTRO_FILM_SRC } from "@/lib/intro-film";
import { LoginForm } from "./LoginForm";

export function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exiting, setExiting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    const p = searchParams.get("preview");
    if (p === "1" || p === "true") {
      setPreviewOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!previewOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [previewOpen]);

  function handleLoginSuccess() {
    setExiting(true);
    window.setTimeout(() => {
      router.push("/intro");
    }, 500);
  }

  return (
    <>
      <div
        className={`transition-opacity duration-500 ease-out ${
          exiting ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
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

              <LoginForm onSuccess={handleLoginSuccess} />

              <p className="text-center">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="text-xs text-zinc-500 underline decoration-zinc-600 underline-offset-4 transition hover:text-zinc-400"
                >
                  Preview intro film
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>

      {previewOpen && (
        <IntroFilmExperience
          filmSrc={INTRO_FILM_SRC}
          onFilmEnd={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}
