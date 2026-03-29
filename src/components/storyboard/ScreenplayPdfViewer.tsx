"use client";

import { useEffect, useRef, useState } from "react";

type ScreenplayPdfViewerProps = {
  matchedPage: number;
  matchedPageAnchor: number;
  noConfidentMatch: boolean;
};

type PdfModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

export function ScreenplayPdfViewer({
  matchedPage,
  matchedPageAnchor,
  noConfidentMatch,
}: ScreenplayPdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    const renderPdf = async () => {
      const container = containerRef.current;
      if (!container) return;

      setIsRendering(true);
      setError(null);

      try {
        const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as PdfModule;
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url
          ).toString();
        }
        const loadingTask = pdfjs.getDocument({
          url: "/screenplay/screenplaytest.pdf",
        });
        const pdfDocument = await loadingTask.promise;
        if (isCancelled) return;

        container.innerHTML = "";
        const containerWidth = Math.max(container.clientWidth - 24, 320);
        const safePage = Math.max(1, matchedPage);

        // Keep physical page order identical to the original PDF.
        // We create all shells first, then render matched page first into its own slot.
        for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum += 1) {
          container.appendChild(createPageShell(pageNum));
        }

        await renderPageIntoShell(pdfDocument, safePage, container, containerWidth);
        if (isCancelled) return;
        setIsRendering(false);

        // Instant jump (no visible autoscroll animation).
        jumpToAnchor(container, safePage, matchedPageAnchor);

        // Background-render remaining pages for manual reading after open.
        for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum += 1) {
          if (isCancelled) return;
          if (pageNum === safePage) continue;
          await idle();
          await renderPageIntoShell(pdfDocument, pageNum, container, containerWidth);
        }

        await pdfDocument.destroy();
      } catch (renderError) {
        if (isCancelled) return;
        setError(
          renderError instanceof Error
            ? renderError.message
            : "Could not render screenplay PDF."
        );
      } finally {
        if (!isCancelled) setIsRendering(false);
      }
    };

    void renderPdf();

    return () => {
      isCancelled = true;
    };
  }, [matchedPage, matchedPageAnchor]);

  return (
    <div className="h-full w-full">
      {noConfidentMatch ? (
        <p className="mb-2 rounded-md border border-amber-200/25 bg-amber-100/10 px-3 py-2 text-xs text-amber-100/90">
          Could not confidently match this frame to an exact screenplay position.
        </p>
      ) : null}

      {error ? (
        <div className="flex h-full items-center justify-center rounded-xl border border-white/20 bg-zinc-950 text-sm text-red-300">
          {error}
        </div>
      ) : (
        <div className="relative h-full overflow-hidden rounded-xl border border-white/15 bg-zinc-900/65">
          {isRendering ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 text-sm text-zinc-200">
              Loading screenplay...
            </div>
          ) : null}

          <div
            ref={containerRef}
            className="h-full overflow-y-auto px-3 py-3 sm:px-4 sm:py-4"
          />
        </div>
      )}
    </div>
  );
}

type PdfDocument = Awaited<
  ReturnType<(typeof import("pdfjs-dist/legacy/build/pdf.mjs"))["getDocument"]>["promise"]
>;

async function renderPage(
  pdfDocument: PdfDocument,
  pageNum: number,
  container: HTMLDivElement,
  containerWidth: number
) {
  const pageShell = container.querySelector<HTMLElement>(`[data-page-number="${pageNum}"]`);
  if (!pageShell) return;
  if (pageShell.getAttribute("data-rendered") === "true") return;

  const page = await pdfDocument.getPage(pageNum);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = containerWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context for PDF rendering.");

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.className = "block h-auto w-full";

  pageShell.style.width = `${Math.ceil(viewport.width)}px`;
  pageShell.innerHTML = "";
  pageShell.appendChild(canvas);

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  pageShell.setAttribute("data-rendered", "true");
}

function createPageShell(pageNum: number): HTMLDivElement {
  const pageShell = document.createElement("div");
  pageShell.dataset.pageNumber = String(pageNum);
  pageShell.setAttribute("data-rendered", "false");
  pageShell.className =
    "mx-auto mb-5 w-fit rounded-sm bg-white shadow-[0_12px_36px_rgba(0,0,0,0.32)]";

  const skeleton = document.createElement("div");
  skeleton.className = "h-[260px] w-[min(820px,92vw)] bg-zinc-100";
  pageShell.appendChild(skeleton);

  return pageShell;
}

async function renderPageIntoShell(
  pdfDocument: PdfDocument,
  pageNum: number,
  container: HTMLDivElement,
  containerWidth: number
) {
  await renderPage(pdfDocument, pageNum, container, containerWidth);
}

function jumpToAnchor(container: HTMLDivElement, pageNum: number, anchor: number) {
  const targetPage = container.querySelector<HTMLElement>(`[data-page-number="${pageNum}"]`);
  if (!targetPage) {
    container.scrollTop = 0;
    return;
  }

  const safeAnchor = Math.max(0, Math.min(0.95, anchor));
  const targetTop = targetPage.offsetTop + Math.round(targetPage.clientHeight * safeAnchor) - 12;
  container.scrollTop = Math.max(0, targetTop);
}

function idle(): Promise<void> {
  return new Promise((resolve) => {
    const win = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number }
      ) => number;
    };
    if (typeof win.requestIdleCallback === "function") {
      win.requestIdleCallback(() => resolve(), { timeout: 120 });
      return;
    }
    globalThis.setTimeout(resolve, 0);
  });
}
