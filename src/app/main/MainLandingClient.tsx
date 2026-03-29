"use client";

import Image from "next/image";
import { MainSiteHeaderLogo } from "@/components/MainSiteHeaderLogo";
import { MainSiteMenu } from "@/components/MainSiteMenu";
import { MAIN_SITE_HEADER_INNER } from "@/lib/main-site-layout";

const MAIN_POSTER_SRC =
  "/images/fieldofwind_A_poster_for_a_film_in_the_style_of_Robert_Eggers_f_145f8d35-a6bc-4c1e-9d4c-22c92a4b2193.png";

export function MainLandingClient() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-black text-zinc-100">
      <header className="sticky top-0 z-20 shrink-0 border-b border-zinc-800/80 bg-black/90 backdrop-blur">
        <div
          className={`${MAIN_SITE_HEADER_INNER} flex flex-wrap items-center justify-between gap-y-3 py-3`}
        >
          <MainSiteHeaderLogo />
          <div className="flex shrink-0 items-center">
            <MainSiteMenu
              storyboardHref="/main/storyboard"
              exploreLocationHref="/main/explore-location"
              screenplayHref="/main/screenplay"
            />
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 sm:px-8">
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
      </main>
    </div>
  );
}
