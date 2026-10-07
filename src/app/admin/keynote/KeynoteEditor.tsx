"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  insertSlide,
  moveSlide,
  parseDeck,
  plainTextDoc,
  type Deck,
  type Slide,
} from "@/lib/keynote/model";
import { SaveQueue } from "@/lib/keynote/save-queue";
import { EditorDialog } from "@/components/keynote/EditorDialog";
import { SlideCanvas } from "@/components/keynote/SlideCanvas";
import RichTextEditor from "@/components/keynote/RichTextEditor";
import KeynoteClient from "@/app/main/KeynoteClient";
import {
  saveDraft,
  publishDraft,
  listRevisions,
  readRevision,
} from "./actions";
import { logoutEditor } from "./login/actions";
import styles from "./editor.module.css";

export default function KeynoteEditor({
  initial,
  localReview = false,
}: {
  localReview?: boolean;
  initial: { document: Deck; version: number };
}) {
  const [, render] = useState(0);
  const [queue] = useState(
    () =>
      new SaveQueue(initial.document, initial.version, saveDraft, () =>
        render((n) => n + 1),
      ),
  );
  const deck = queue.document;
  const [selected, select] = useState(
    deck.slides.some((s) => s.id === deck.startSlideId)
      ? deck.startSlideId
      : (deck.slides[0]?.id ?? ""),
  );
  const [history, setHistory] = useState<Deck[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Deck | null>(null);
  const [focusToken, focusBody] = useState(0);
  const [revisions, setRevisions] = useState<
    { id: string; published_at: string }[] | null
  >(null);
  const [overflow, setOverflow] = useState(false);
  const [aspect, setAspect] = useState("16 / 9");
  const previewRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLInputElement>(null);
  const slide = deck.slides.find((s) => s.id === selected);
  const index = deck.slides.findIndex((s) => s.id === selected);
  let publishError = "";
  try {
    parseDeck(deck, true);
  } catch (e) {
    publishError = (e as Error).message;
  }

  const change = useCallback(
    (next: Deck) => {
      const previous = queue.document;
      if (JSON.stringify(previous) === JSON.stringify(next)) return;
      setHistory((old) => [...old.slice(-99), previous]);
      queue.edit(next);
      setMessage("");
    },
    [queue],
  );
  function updateSlide(next: Slide) {
    change({
      ...deck,
      slides: deck.slides.map((s) => (s.id === next.id ? next : s)),
    });
  }
  useEffect(() => {
    if (!queue.dirty || queue.status === "error" || queue.status === "conflict")
      return;
    const timer = setTimeout(() => void queue.flush(), 700);
    return () => clearTimeout(timer);
  }, [deck, queue]);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (queue.dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [queue]);
  useEffect(() => {
    if (preview) return;
    const canvas = previewRef.current;
    if (!canvas) return;
    const check = () => {
      const text = canvas.querySelector<HTMLElement>("[data-slide-text]");
      const area = text?.parentElement;
      setOverflow(
        !!text &&
          !!area &&
          (text.scrollHeight > text.clientHeight + 2 ||
            text.scrollWidth > text.clientWidth + 2 ||
            text.offsetHeight >
              area.clientHeight -
                parseFloat(getComputedStyle(area).paddingTop) -
                parseFloat(getComputedStyle(area).paddingBottom) +
                2),
      );
    };
    const observer = new ResizeObserver(check);
    observer.observe(canvas);
    void document.fonts.ready.then(check);
    check();
    return () => observer.disconnect();
  }, [slide, aspect, preview]);

  function add(layout: "short" | "headed") {
    const newSlide: Slide = {
      id: crypto.randomUUID(),
      name: layout === "short" ? "Short text" : "Heading and text",
      type: "text",
      layout,
      density: "short",
      ...(layout === "headed" ? { heading: "Heading" } : {}),
      body: plainTextDoc("Write your text here."),
    };
    change(insertSlide(deck, selected, newSlide));
    select(newSlide.id);
  }
  function duplicate() {
    if (!slide) return;
    const copy = {
      ...structuredClone(slide),
      id: crypto.randomUUID(),
      name: `${slide.name.slice(0, 110)} (copy)`,
    };
    change(insertSlide(deck, selected, copy));
    select(copy.id);
  }
  function remove() {
    const slides = deck.slides.filter((s) => s.id !== selected);
    change({ ...deck, slides });
    select(slides[Math.min(index, slides.length - 1)]?.id ?? "");
  }
  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory(history.slice(0, -1));
    queue.edit(previous);
    if (!previous.slides.some((s) => s.id === selected))
      select(previous.slides[0]?.id ?? "");
  }
  async function publish() {
    setBusy(true);
    setMessage("");
    try {
      if (!(await queue.flush(true))) return;
      const result = await publishDraft(queue.version);
      if (!result.ok && "conflict" in result && result.conflict) {
        queue.status = "conflict";
        queue.error = result.error;
      }
      setMessage(
        result.ok
          ? "Published. New sessions show this revision; presentations already open keep their current content."
          : result.error,
      );
    } catch {
      setMessage(
        "Publication was not confirmed. Check the history before trying again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function historyPanel() {
    setBusy(true);
    try {
      setRevisions(await listRevisions());
    } catch {
      setMessage("Could not load history. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function restore(id: string) {
    setBusy(true);
    try {
      if (!(await queue.flush(true))) return;
      const restored = await readRevision(id);
      change(restored);
      select(restored.startSlideId);
      setRevisions(null);
      if (await queue.flush())
        setMessage(
          "Revision restored as a draft. Preview it before publishing.",
        );
    } catch {
      setMessage("Could not restore the revision. The draft was kept.");
    } finally {
      setBusy(false);
    }
  }
  function exportDraft() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(deck, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "north-of-hell-draft.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const status = {
    saved: "Saved",
    dirty: "Unsaved changes",
    saving: "Saving …",
    error: "Not saved",
    conflict: "Version conflict",
  }[queue.status];
  return (
    <main className={styles.editor}>
      {localReview && (
        <p className={styles.notice}>
          Local review with sample data. Publishing applies only to this
          test session.
        </p>
      )}
      <header className={styles.topbar}>
        <div>
          <p>North of Hell</p>
          <h1>Keynote</h1>
        </div>
        <span role="status">{status}</span>
        <button disabled={!history.length || busy} onClick={undo}>
          Undo
        </button>
        <button
          disabled={!!publishError || busy}
          onClick={() => setPreview(structuredClone(deck))}
        >
          Preview
        </button>
        <button disabled={busy} onClick={historyPanel}>
          History
        </button>
        <button
          className={styles.primary}
          disabled={busy || !!publishError || queue.status === "conflict"}
          onClick={publish}
        >
          {busy ? "Working …" : "Publish"}
        </button>
        <form
          action={logoutEditor}
          onSubmit={(e) => {
            if (queue.dirty || busy) {
              e.preventDefault();
              setMessage("Save or export your changes before signing out.");
            }
          }}
        >
          <button>Sign out</button>
        </form>
      </header>
      {(queue.error || message || publishError) && (
        <div className={styles.notice} role="status">
          <p>{queue.error || message || publishError}</p>
          {queue.status === "error" && (
            <button onClick={() => void queue.flush(true)}>
              Retry saving
            </button>
          )}
          {(queue.status === "conflict" || queue.status === "error") && (
            <>
              <button onClick={exportDraft}>Export local draft</button>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Local changes will be lost. Have you exported them?",
                    )
                  )
                    window.location.reload();
                }}
              >
                Load latest draft
              </button>
            </>
          )}
        </div>
      )}
      <fieldset className={styles.workspace} disabled={busy}>
        <aside className={styles.sidebar} aria-label="Slides">
          <p className={styles.sectionLabel}>Slides · {deck.slides.length}</p>
          <ol>
            {deck.slides.map((s, i) => (
              <li
                key={s.id}
                draggable={!busy}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", s.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!busy)
                    change(
                      moveSlide(deck, e.dataTransfer.getData("text/plain"), i),
                    );
                }}
              >
                <button
                  className={styles.slideButton}
                  aria-pressed={s.id === selected}
                  onClick={() => select(s.id)}
                >
                  <span className={styles.thumb} aria-hidden="true">
                    <SlideCanvas slide={s} thumbnail />
                  </span>
                  <span>
                    {i + 1}. {s.name}
                    {s.id === deck.startSlideId ? " · Start" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className={styles.add}>
            <p>New slide</p>
            <button
              disabled={deck.slides.length >= 60}
              onClick={() => add("short")}
            >
              Short text
            </button>
            <button
              disabled={deck.slides.length >= 60}
              onClick={() => add("headed")}
            >
              Heading and text
            </button>
          </div>
        </aside>
        <section className={styles.center} aria-label="Slide preview">
          <div className={styles.previewToolbar}>
            <p>{slide?.name ?? "No slides"}</p>
            <label>
              Format{" "}
              <select
                value={aspect}
                onChange={(e) => setAspect(e.target.value)}
              >
                <option value="16 / 9">16:9</option>
                <option value="4 / 3">4:3</option>
                <option value="9 / 19.5">Mobile</option>
              </select>
            </label>
          </div>
          <div
            ref={previewRef}
            className={styles.canvas}
            style={{
              aspectRatio: aspect,
              maxWidth: aspect === "9 / 19.5" ? 320 : undefined,
            }}
          >
            {slide && (
              <SlideCanvas
                slide={slide}
                width={aspect === "9 / 19.5" ? 390 : 1440}
                height={
                  aspect === "9 / 19.5" ? 845 : aspect === "4 / 3" ? 1080 : 810
                }
                onField={(field) =>
                  field === "heading"
                    ? headingRef.current?.focus()
                    : focusBody((n) => n + 1)
                }
              />
            )}
          </div>
          {overflow && (
            <p className={styles.warning} role="alert">
              The text does not fit this format. Shorten it or split it across
              several slides. The presentation may require scrolling.
            </p>
          )}
          <p className={styles.help}>
            Click text to edit it. Preview starts the presentation
            with its intro and navigation.
          </p>
        </section>
        <aside className={styles.inspector} aria-label="Edit slide">
          {slide ? (
            <>
              <p className={styles.sectionLabel}>Edit slide</p>
              <label>
                Name
                <input
                  value={slide.name}
                  maxLength={120}
                  onChange={(e) =>
                    updateSlide({ ...slide, name: e.target.value })
                  }
                />
              </label>
              {slide.type === "text" ? (
                <>
                  {slide.layout === "headed" && (
                    <label>
                      Heading
                      <input
                        ref={headingRef}
                        value={slide.heading ?? ""}
                        maxLength={300}
                        onChange={(e) =>
                          updateSlide({ ...slide, heading: e.target.value })
                        }
                      />
                    </label>
                  )}
                  <label>Text</label>
                  <RichTextEditor
                    disabled={busy}
                    key={slide.id}
                    value={slide.body}
                    focusToken={focusToken}
                    onChange={(body) => updateSlide({ ...slide, body })}
                  />
                </>
              ) : (
                <p>
                  {slide.type === "title"
                    ? "The title graphic follows the presentation design."
                    : "The film uses the existing video file."}
                </p>
              )}
              <div className={styles.slideActions}>
                <button
                  onClick={() => change({ ...deck, startSlideId: slide.id })}
                  disabled={deck.startSlideId === slide.id}
                >
                  Start here
                </button>
                <button
                  onClick={() => change(moveSlide(deck, slide.id, index - 1))}
                  disabled={index === 0}
                >
                  Move up
                </button>
                <button
                  onClick={() => change(moveSlide(deck, slide.id, index + 1))}
                  disabled={index === deck.slides.length - 1}
                >
                  Move down
                </button>
                <button disabled={deck.slides.length >= 60} onClick={duplicate}>
                  Duplicate
                </button>
                <button onClick={remove}>Remove from draft</button>
              </div>
            </>
          ) : (
            <p>Add a slide to get started.</p>
          )}
        </aside>
      </fieldset>
      {revisions && (
        <EditorDialog
          className={styles.history}
          label="Publication history"
          onClose={() => setRevisions(null)}
        >
          <h2>Publication history</h2>
          <p>
            A restored revision becomes a new draft. Published content changes
            only when you publish.
          </p>
          <button onClick={() => setRevisions(null)}>Close history</button>
          <ul>
            {revisions.map((r, i) => (
              <li key={r.id}>
                {new Date(r.published_at).toLocaleString("en-US")}
                {i === 0 ? " · Latest" : ""}
                <button disabled={busy} onClick={() => restore(r.id)}>
                  Restore as draft
                </button>
              </li>
            ))}
          </ul>
        </EditorDialog>
      )}
      {preview && (
        <EditorDialog
          className={styles.presentation}
          label="Preview presentation"
          onClose={() => setPreview(null)}
        >
          <KeynoteClient deck={preview} preview />
          <button
            className={styles.closePreview}
            onClick={() => setPreview(null)}
          >
            Back to editing
          </button>
        </EditorDialog>
      )}
    </main>
  );
}
