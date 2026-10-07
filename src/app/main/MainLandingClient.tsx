"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { MainSiteHeader } from "@/components/MainSiteHeader";

const MAIN_POSTER_SRC =
  "/images/fieldofwind_A_poster_for_a_film_in_the_style_of_Robert_Eggers_f_145f8d35-a6bc-4c1e-9d4c-22c92a4b2193.png";
const LEGACY_BACKGROUNDS = [
  { src: "/images/noh-legacy-mountain.webp", label: "Mountain", position: "center bottom" },
  { src: "/images/noh-cover-bg2.jpg", label: "Original", position: "center center" },
] as const;

export function MainLandingClient({ arrivalFromAltThree = false, animateFromLogin = false }: { arrivalFromAltThree?: boolean; animateFromLogin?: boolean }) {
  const [coverLoaded, setCoverLoaded] = useState(false);
  const [backgroundIndex, setBackgroundIndex] = useState(0);

  useEffect(() => {
    if (animateFromLogin) {
      window.history.replaceState(window.history.state, "", "/main/legacy");
    }
  }, [animateFromLogin]);

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-black text-zinc-100">
      <MainSiteHeader />

      <main className={arrivalFromAltThree
        ? "absolute inset-0 flex flex-col items-center justify-center px-6 sm:px-8"
        : "flex flex-1 flex-col items-center justify-center px-6 py-16 sm:px-8"}>
        {arrivalFromAltThree ? (
          <>
            {LEGACY_BACKGROUNDS.map((background, index) => <Image
              key={background.src}
              src={background.src}
              alt=""
              fill
              priority
              sizes="100vw"
              style={{ objectPosition: background.position }}
              onLoad={index === 0 ? () => setCoverLoaded(true) : undefined}
              className={`pointer-events-none object-cover transition-opacity ease-in-out ${animateFromLogin ? "duration-[1300ms]" : "duration-700"} ${backgroundIndex === index && (!animateFromLogin || coverLoaded) ? "opacity-100" : "opacity-0"}`}
            />)}
            {animateFromLogin && <div className={`pointer-events-none relative z-10 w-[min(82vw,920px)] text-center transition-opacity duration-[1300ms] ease-in-out ${coverLoaded ? "opacity-0" : "opacity-100"}`}>
              <h1>
                <Image src="/Login-assets/NOH_TITLE_C72B1F.png" alt="North of Hell" width={7373} height={1562} priority className="h-auto w-full" />
              </h1>
              <Image src="/Login-assets/NOH_FILM_BY_C72B1F.png" alt="A film by Niels Windfeldt" width={2793} height={134} priority className="mx-auto mt-[7.07%] h-auto w-[37.88%]" />
            </div>}
            <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/25 bg-black/65 px-2 py-1.5 backdrop-blur-sm" role="group" aria-label="Choose legacy background">
              {LEGACY_BACKGROUNDS.map((background, index) => <button
                key={background.src}
                type="button"
                aria-label={`Show ${background.label} background`}
                aria-pressed={backgroundIndex === index}
                onClick={() => setBackgroundIndex(index)}
                className={`group flex h-9 w-9 touch-manipulation items-center justify-center rounded-full transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white ${backgroundIndex === index ? "bg-white/15" : ""}`}
              >
                <span className={`h-4 w-4 rounded-full border border-white/90 transition-colors ${backgroundIndex === index ? "bg-white" : "bg-transparent group-hover:bg-white/55"}`} />
              </button>)}
            </div>
          </>
        ) : (
          <div className="relative mx-auto w-full max-w-3xl overflow-x-hidden">
            <div className="relative z-0 mx-auto w-full max-w-md translate-x-2 sm:translate-x-4 aspect-[2/3] overflow-hidden rounded-lg">
              <Image
                src={MAIN_POSTER_SRC}
                alt="North of Hell poster"
                fill
                className="object-cover"
                sizes="(max-width: 448px) 100vw, 448px"
                priority
              />
              <div
                className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_72px_56px_rgba(0,0,0,0.88)]"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(ellipse_75%_75%_at_50%_50%,transparent_20%,rgba(0,0,0,0.35)_55%,rgba(0,0,0,0.92)_100%)]"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/25"
                aria-hidden
              />
            </div>
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-4 text-center sm:px-8">
              <p className="mb-4 text-xs lowercase tracking-[0.25em] text-zinc-200/95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] sm:text-sm [font-family:var(--font-im-fell-english),serif]">
                a film by niels windfeldt
              </p>
              <h1 className="whitespace-nowrap text-4xl font-medium uppercase tracking-tight text-[#eaa631] drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] sm:text-6xl [font-family:var(--font-im-fell-english),serif]">
                North of Hell
              </h1>
              <p className="mt-4 max-w-xl text-lg text-zinc-100/95 drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)] sm:text-xl [font-family:var(--font-im-fell-english),serif]">
                the storm is never an accident
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
