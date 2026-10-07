import { MainSiteHeaderLogo } from "@/components/MainSiteHeaderLogo";
import { MainSiteMenu } from "@/components/MainSiteMenu";
import { MAIN_SITE_HEADER_INNER } from "@/lib/main-site-layout";

export function MainSiteHeader() {
  return (
    <header className="main-site-header sticky top-0 z-40 shrink-0 border-b border-zinc-800/80 bg-black/90 backdrop-blur">
      <div className={`${MAIN_SITE_HEADER_INNER} flex flex-wrap items-center justify-between gap-y-3 py-3`}>
        <MainSiteHeaderLogo />
        <div className="flex w-full min-w-0 items-center sm:w-auto">
          <MainSiteMenu
            className="w-full min-w-0 sm:w-auto"
            storyboardHref="/storyboard"
            exploreLocationHref="/main/explore-location"
            screenplayHref="/main/screenplay"
          />
        </div>
      </div>
    </header>
  );
}
