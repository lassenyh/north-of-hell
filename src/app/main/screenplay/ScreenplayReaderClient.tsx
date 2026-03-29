"use client";

import { useRef, useState } from "react";

import { MainSiteHeaderLogo } from "@/components/MainSiteHeaderLogo";
import { MainSiteMenu } from "@/components/MainSiteMenu";
import { MAIN_SITE_HEADER_INNER } from "@/lib/main-site-layout";

export function ScreenplayReaderClient() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const TOTAL_PDF_PAGES = 164;
  const SCREENPLAY_PAGE_OFFSET = 1;
  const TOTAL_SCREENPLAY_PAGES = TOTAL_PDF_PAGES - SCREENPLAY_PAGE_OFFSET;
  const DISPLAY_ZOOM_BASE = 1.7;
  const ZOOM_STEPS = [50, 60, 70, 80, 90, 100] as const;
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const [goToInput, setGoToInput] = useState("0");
  const [displayZoom, setDisplayZoom] = useState<(typeof ZOOM_STEPS)[number]>(50);
  const canGoTo = TOTAL_SCREENPLAY_PAGES > 0;
  // (No resume state; this page is intentionally stateless on refresh.)

  const handleGoToPage = (targetPage: number) => {
    if (!Number.isFinite(targetPage)) return;
    const screenplayPage = Math.max(
      0,
      Math.min(TOTAL_SCREENPLAY_PAGES, Math.floor(targetPage))
    );
    const pdfPage = screenplayPage + SCREENPLAY_PAGE_OFFSET;
    setCurrentPdfPage(pdfPage);
    setGoToInput(String(screenplayPage));
  };

  const handleGoTo = () => {
    handleGoToPage(Number(goToInput));
  };

  const handleToggleFullscreen = async () => {
    const el = viewerRef.current;
    if (!el) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }

    await el.requestFullscreen().catch(() => {});
  };

  const zoomLabel = `${displayZoom}%`;
  const viewerZoomPercent = Math.round((displayZoom / 100) * DISPLAY_ZOOM_BASE * 100);
  const pdfSrc = `/screenplay/screenplaytest.pdf#page=${currentPdfPage}&zoom=${viewerZoomPercent},0,0&toolbar=0&navpanes=0&statusbar=0&messages=0`;
  const currentScreenplayPage = Math.max(0, currentPdfPage - SCREENPLAY_PAGE_OFFSET);
  const zoomIndex = ZOOM_STEPS.indexOf(displayZoom);
  const canZoomOut = zoomIndex > 0;
  const canZoomIn = zoomIndex < ZOOM_STEPS.length - 1;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-black text-zinc-100">
      <header className="shrink-0 border-b border-zinc-800/80 bg-black/90 backdrop-blur">
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

      <div
        role="toolbar"
        aria-label="PDF reader tools"
        className="sticky top-0 z-20 shrink-0 border-b border-zinc-800/80 bg-black/90 backdrop-blur"
      >
        <div
          className={`${MAIN_SITE_HEADER_INNER} grid grid-cols-1 items-center gap-y-3 py-2.5 sm:grid-cols-3 sm:gap-y-0`}
        >
          <div className="hidden min-h-0 sm:block" aria-hidden />
          <div className="flex flex-wrap items-center justify-center gap-1 justify-self-center sm:w-full">
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-200 transition hover:text-white focus-visible:outline-none"
              aria-label="Toggle fullscreen"
              title="Fullscreen"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
                <path d="M8 4.5H4.5V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M16 4.5H19.5V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M8 19.5H4.5V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M16 19.5H19.5V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canZoomOut) return;
                setDisplayZoom(ZOOM_STEPS[zoomIndex - 1]);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-200 transition hover:text-white focus-visible:outline-none disabled:opacity-40"
              aria-label="Zoom out"
              disabled={!canZoomOut}
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16 16L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M8.5 11H13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canZoomIn) return;
                setDisplayZoom(ZOOM_STEPS[zoomIndex + 1]);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-200 transition hover:text-white focus-visible:outline-none disabled:opacity-40"
              aria-label="Zoom in"
              disabled={!canZoomIn}
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16 16L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M8.5 11H13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M11 8.5V13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <span className="ml-0.5 text-xs text-zinc-300">{zoomLabel}</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-300 sm:justify-end sm:justify-self-end">
            <span>
              Page {currentScreenplayPage} / {TOTAL_SCREENPLAY_PAGES}
            </span>
            <span className="text-zinc-500">Go to</span>
            <input
              value={goToInput}
              onChange={(e) => setGoToInput(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleGoTo();
              }}
              className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right text-xs outline-none focus:border-[#eaa631]"
              inputMode="numeric"
              aria-label="Go to page number"
            />
            <button
              type="button"
              onClick={handleGoTo}
              disabled={!canGoTo}
              className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-200 transition hover:border-zinc-400 disabled:opacity-50"
            >
              Go
            </button>
          </div>
        </div>
      </div>

      <main className="min-h-0 flex-1 p-1 sm:p-2">
        <div
          ref={viewerRef}
          className="relative h-full overflow-hidden rounded-xl border border-white/15 bg-zinc-900/65"
        >
          <iframe
            key={`${currentPdfPage}-${viewerZoomPercent}`}
            src={pdfSrc}
            title="Screenplay PDF"
            className="h-full min-h-[calc(100dvh-8.5rem)] w-full"
          />
        </div>
      </main>
    </div>
  );
}
