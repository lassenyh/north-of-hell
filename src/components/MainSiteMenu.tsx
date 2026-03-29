"use client";

import Link from "next/link";
import { usePathname, useSelectedLayoutSegments } from "next/navigation";

const linkBase =
  "rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] no-underline transition [font-family:var(--font-im-fell-english),serif] sm:px-3.5 sm:py-1.5";

const inactive = "text-zinc-400 hover:text-zinc-100";
const active = "bg-[#eaa631] font-medium text-black";

export type MainSiteMenuProps = {
  className?: string;
  /** Lenke til landingside (`/main`). Skjul med `false`. */
  homeHref?: string | false;
  storyboardHref: string;
  storyboardLabel?: string;
  exploreLocationHref?: string;
  exploreLocationLabel?: string;
  screenplayHref?: string;
  screenplayLabel?: string;
};

/**
 * Toppnivå-navigasjon: Storyboard, Screenplay, Explore location, Characters, Folklore.
 * Markerer aktiv rute basert på pathname.
 */
function HomeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MainSiteMenu({
  className = "",
  homeHref: homeHrefProp = "/main",
  storyboardHref,
  storyboardLabel = "Storyboard",
  exploreLocationHref,
  exploreLocationLabel = "Explore location",
  screenplayHref,
  screenplayLabel = "Screenplay",
}: MainSiteMenuProps) {
  const pathname = usePathname() ?? "";
  const layoutSegments = useSelectedLayoutSegments();
  const pathNorm = pathname.replace(/\/$/, "") || "/";
  const storyNorm = storyboardHref.replace(/\/$/, "") || "/";
  const homeHref = homeHrefProp === false ? null : homeHrefProp;
  const homeNorm = homeHref ? homeHref.replace(/\/$/, "") || "/" : "";

  const isHome = Boolean(homeHref && pathNorm === homeNorm);
  /** Segment-match (varierer med/uten `main/layout.tsx`) + path-match som fallback. */
  const isStoryboard =
    (Array.isArray(layoutSegments) &&
      ((layoutSegments[0] === "main" && layoutSegments[1] === "storyboard") ||
        (layoutSegments.length === 1 &&
          layoutSegments[0] === "storyboard" &&
          pathNorm.startsWith("/main/storyboard")))) ||
    pathNorm === storyNorm ||
    (storyNorm !== "/" && pathNorm.startsWith(`${storyNorm}/`));

  const isExplore =
    exploreLocationHref != null && pathname.startsWith(exploreLocationHref);
  const isScreenplay =
    screenplayHref != null && pathname.startsWith(screenplayHref);

  const homeButtonClass = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition [font-family:var(--font-im-fell-english),serif] sm:h-8 sm:w-8 ${
    isHome
      ? "border-[#eaa631] bg-[#eaa631]/15 text-[#eaa631]"
      : "border-zinc-700 bg-zinc-900/70 text-zinc-400 hover:border-zinc-500 hover:text-zinc-100"
  }`;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {homeHref ? (
        <Link
          href={homeHref}
          className={homeButtonClass}
          aria-label="Home"
          aria-current={isHome ? "page" : undefined}
          title="Home"
        >
          <HomeIcon className="h-4 w-4" />
        </Link>
      ) : null}
      <div
        className="inline-flex flex-wrap items-center gap-0.5 rounded-full border border-zinc-700 bg-zinc-900/70 p-0.5"
        role="navigation"
        aria-label="Main site"
      >
        <Link
          href={storyboardHref}
          className={`${linkBase} ${isStoryboard ? active : inactive}`}
        >
          {storyboardLabel}
        </Link>
        {screenplayHref ? (
          <Link
            href={screenplayHref}
            className={`${linkBase} ${isScreenplay ? active : inactive}`}
          >
            {screenplayLabel}
          </Link>
        ) : null}
        {exploreLocationHref ? (
          <Link
            href={exploreLocationHref}
            className={`${linkBase} ${isExplore ? active : inactive}`}
          >
            {exploreLocationLabel}
          </Link>
        ) : null}
        <button
          type="button"
          className={`${linkBase} ${inactive} cursor-default`}
          aria-disabled="true"
          title="Coming soon"
        >
          Characters
        </button>
        <button
          type="button"
          className={`${linkBase} ${inactive} cursor-default`}
          aria-disabled="true"
          title="Coming soon"
        >
          Folklore
        </button>
      </div>
    </div>
  );
}
