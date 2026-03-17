"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function IntroPage() {
  const router = useRouter();
  const [filmVisible, setFilmVisible] = useState(false);
  const [titleVisible, setTitleVisible] = useState(false);
  const [taglineVisible, setTaglineVisible] = useState(false);

  useEffect(() => {
    const timeouts: number[] = [];

    // Litt svart skjerm først
    timeouts.push(
      window.setTimeout(() => {
        setFilmVisible(true);
      }, 600)
    );

    // Fade ut "a film by ..." etter en liten stund
    timeouts.push(
      window.setTimeout(() => {
        setFilmVisible(false);
      }, 2600)
    );

    // Tittel fader inn og blir stående
    timeouts.push(
      window.setTimeout(() => {
        setTitleVisible(true);
      }, 3200)
    );

    // Undertittel under tittel fader inn og blir stående
    timeouts.push(
      window.setTimeout(() => {
        setTaglineVisible(true);
      }, 5000)
    );

    // Fade sakte ut tittel + undertittel før vi går videre
    timeouts.push(
      window.setTimeout(() => {
        setTaglineVisible(false);
        setTitleVisible(false);
      }, 9500)
    );

    // Etter alt, gå videre til hovedsiden (kort pause på svart)
    timeouts.push(
      window.setTimeout(() => {
        router.replace("/main");
      }, 10500)
    );

    return () => {
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-black">
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="relative h-[220px] sm:h-[260px] w-full max-w-3xl">
          {/* Første tekst – samme sentrerte posisjon som hovedtittel */}
          <p
            className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-base lowercase tracking-[0.25em] text-zinc-400 sm:text-lg [font-family:var(--font-im-fell-english),serif] transition-opacity duration-800 ease-out ${
              filmVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            a film by niels windfeldt
          </p>

          {/* Hovedtittel + undertittel, også sentrert på samme posisjon */}
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center space-y-3">
            <p
              className={`whitespace-nowrap text-4xl font-medium uppercase tracking-tight text-[#eaa631] sm:text-6xl [font-family:var(--font-im-fell-english),serif] transition-opacity duration-[2500ms] ease-out ${
                titleVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              NORTH OF HELL
            </p>
            <p
              className={`text-base text-zinc-300 sm:text-lg [font-family:var(--font-im-fell-english),serif] transition-opacity duration-[2500ms] ease-out ${
                taglineVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              a storm is never an accident
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

