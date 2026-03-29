"use client";

import { ChromeVideoPlayer } from "@/components/ChromeVideoPlayer";
import { MainSiteHeaderLogo } from "@/components/MainSiteHeaderLogo";
import { MainSiteMenu } from "@/components/MainSiteMenu";
import { MAIN_SITE_HEADER_INNER } from "@/lib/main-site-layout";

const VIDEO_SRC = "/location/NOH_LOCATION_WEB_1.mp4";

export function ExploreLocationClient() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-black text-zinc-100">
      <header className="sticky top-0 z-20 shrink-0 border-b border-zinc-800/80 bg-black/90 backdrop-blur">
        <div
          className={`${MAIN_SITE_HEADER_INNER} flex flex-wrap items-center justify-between gap-y-3 py-3`}
        >
          <MainSiteHeaderLogo />
          <div className="flex shrink-0 items-center">
            <MainSiteMenu
              homeHref="/main"
              storyboardHref="/main/storyboard"
              exploreLocationHref="/main/explore-location"
              screenplayHref="/main/screenplay"
            />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 py-4 sm:px-4">
        <div className="w-full max-w-[min(100%,2200px)]">
          <ChromeVideoPlayer
            src={VIDEO_SRC}
            showFullscreen
            videoClassName="block h-auto max-h-[calc(100dvh-4rem)] w-full cursor-pointer object-contain"
          />
        </div>
      </div>
    </div>
  );
}
