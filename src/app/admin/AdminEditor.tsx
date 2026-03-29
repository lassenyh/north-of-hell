"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const ScreenplayEditor = dynamic(
  () =>
    import("@/components/screenplay/ScreenplayEditor").then((m) => ({
      default: m.ScreenplayEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-[78px] w-full animate-pulse rounded-2xl border border-zinc-700 bg-zinc-900/70"
        aria-hidden
      />
    ),
  }
);
import { ManuscriptRichEditor } from "@/components/ManuscriptRichEditor";
import { ChapterNav } from "@/components/ChapterNav";
import { StoryboardFloatingActions } from "@/components/StoryboardFloatingActions";
import { getChapterFolderFromImageSrc } from "@/lib/chapter-from-src";
import {
  isScreenplayJsonString,
  legacyTextToScreenplayBlocks,
  parseScreenplayBlocks,
  stringifyScreenplayBlocks,
} from "@/lib/screenplay-json";
import {
  updateFrameText,
  createLogin,
  getLogins,
  deleteLogin,
  createAdminLogin,
  getAdminLogins,
  deleteAdminLogin,
} from "./actions";
import type { StoryboardFrame } from "@/lib/supabase/storyboard";
import type { ProjectLogin } from "@/lib/supabase/auth";
import type { ProjectAdminLogin } from "@/lib/supabase/admin-auth";

type Props = { frames: StoryboardFrame[] };

const GRID_MARKER_RESERVE = "min-h-[2.75rem]";

function buildNavChapters(frames: StoryboardFrame[]) {
  const out: { id: string; label: string; firstFrameIndex: number }[] = [];
  let prevKey: string | null = null;
  frames.forEach((frame, index) => {
    const parsed = getChapterFolderFromImageSrc(frame.image_src);
    const key = parsed || "__default__";
    if (key !== prevKey) {
      prevKey = key;
      out.push({
        id: `admin-ch-${index}`,
        label: parsed || "Storyboard",
        firstFrameIndex: index,
      });
    }
  });
  return out;
}

export function AdminEditor({ frames: initialFrames }: Props) {
  const [frames, setFrames] = useState(initialFrames);
  const [layout, setLayout] = useState<"list" | "grid">("grid");
  const pendingScrollIndexRef = useRef<number | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedFlashId, setSavedFlashId] = useState<string | null>(null);
  const savedFlashTimerRef = useRef<number | null>(null);
  const [seedStatus, setSeedStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [creatingUser, setCreatingUser] = useState(false);
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [logins, setLogins] = useState<ProjectLogin[] | null>(null);
  const [loadingLogins, setLoadingLogins] = useState(false);
  const [adminLogins, setAdminLogins] = useState<ProjectAdminLogin[] | null>(
    null
  );
  const [loadingAdminLogins, setLoadingAdminLogins] = useState(false);
  const [creatingAdminUser, setCreatingAdminUser] = useState(false);
  const [adminUserMessage, setAdminUserMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"storyboard" | "login">(
    "storyboard"
  );

  const navChapters = buildNavChapters(frames);

  const chapterLabelByIndex: Array<string | undefined> = frames.map(
    (frame, index) => {
      const raw = getChapterFolderFromImageSrc(frame.image_src);
      if (!raw) return undefined;
      if (index === 0) return raw;
      const prev = getChapterFolderFromImageSrc(frames[index - 1].image_src);
      return raw !== prev ? raw : undefined;
    }
  );

  type GridItem =
    | { kind: "frame"; frame: StoryboardFrame; index: number; chapterLabel?: string }
    | { kind: "spacer"; key: string };

  const gridItems: GridItem[] = [];
  if (layout === "grid") {
    let gridIndex = 0;
    for (let i = 0; i < frames.length; i += 1) {
      const label = chapterLabelByIndex[i];
      const isChapterStart = Boolean(label);
      if (isChapterStart && gridIndex % 2 === 1) {
        gridItems.push({ kind: "spacer", key: `spacer-${i}` });
        gridIndex += 1;
      }
      gridItems.push({
        kind: "frame",
        frame: frames[i],
        index: i,
        chapterLabel: label,
      });
      gridIndex += 1;
    }
  }

  const handleLayoutChange = (nextLayout: "list" | "grid") => {
    if (nextLayout === layout) return;
    const frameEls = document.querySelectorAll<HTMLElement>("[data-frame-index]");
    if (!frameEls.length) {
      setLayout(nextLayout);
      return;
    }
    const viewportMiddle = window.scrollY + window.innerHeight / 2;
    let closestIndex: number | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    frameEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const middle = rect.top + window.scrollY + rect.height / 2;
      const distance = Math.abs(middle - viewportMiddle);
      const idx = Number(el.getAttribute("data-frame-index"));
      if (!Number.isFinite(idx)) return;
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = idx;
      }
    });
    if (closestIndex !== null) pendingScrollIndexRef.current = closestIndex;
    setLayout(nextLayout);
  };

  useEffect(() => {
    const index = pendingScrollIndexRef.current;
    if (index == null) return;
    pendingScrollIndexRef.current = null;
    const target =
      document.getElementById(`chapter-title-${index}`) ??
      document.getElementById(`comic-frame-${index}`);
    if (!target) return;
    const nav = document.querySelector<HTMLElement>('[data-chapter-nav="true"]');
    const navHeight = nav ? nav.getBoundingClientRect().height : 0;
    const extraOffset = 20;
    const targetTop = target.getBoundingClientRect().top + window.scrollY;
    const htmlEl = document.documentElement;
    const prev = htmlEl.style.scrollBehavior;
    htmlEl.style.scrollBehavior = "auto";
    window.scrollTo(0, Math.max(0, targetTop - navHeight - extraOffset));
    htmlEl.style.scrollBehavior = prev;
  }, [layout]);

  const handleSave = async (frame: StoryboardFrame, text: string) => {
    setSavingId(frame.id);
    const result = await updateFrameText(frame.id, text);
    setSavingId(null);
    if (result.ok) {
      setFrames((prev) =>
        prev.map((f) => (f.id === frame.id ? { ...f, text } : f))
      );
      if (savedFlashTimerRef.current !== null) {
        window.clearTimeout(savedFlashTimerRef.current);
      }
      setSavedFlashId(frame.id);
      savedFlashTimerRef.current = window.setTimeout(() => {
        setSavedFlashId(null);
        savedFlashTimerRef.current = null;
      }, 2000);
    }
  };

  const handleSeed = async () => {
    setSeedStatus("loading");
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setSeedStatus("done");
        window.location.reload();
      } else {
        setSeedStatus("error");
      }
    } catch {
      setSeedStatus("error");
    }
  };

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUserMessage(null);
    setCreatingUser(true);
    const form = event.currentTarget;
    const usernameInput = form.elements.namedItem("new-username") as HTMLInputElement | null;
    const passwordInput = form.elements.namedItem("new-password") as HTMLInputElement | null;
    const fullNameInput = form.elements.namedItem("new-full-name") as HTMLInputElement | null;
    const companyInput = form.elements.namedItem("new-company") as HTMLInputElement | null;
    const username = usernameInput?.value.trim() ?? "";
    const password = passwordInput?.value.trim() ?? "";
    const fullName = fullNameInput?.value.trim() || undefined;
    const company = companyInput?.value.trim() || undefined;

    if (!username || !password) {
      setUserMessage("Username and password are required.");
      setCreatingUser(false);
      return;
    }

    const result = await createLogin(username, password, fullName, company);
    setCreatingUser(false);
    if (result.ok) {
      if (usernameInput) usernameInput.value = "";
      if (passwordInput) passwordInput.value = "";
      if (fullNameInput) fullNameInput.value = "";
      if (companyInput) companyInput.value = "";
      await loadLogins();
    } else {
      setUserMessage(result.error ?? "Could not create user.");
    }
  };

  const loadLogins = async () => {
    setLoadingLogins(true);
    const data = await getLogins();
    setLogins(data);
    setLoadingLogins(false);
  };

  const handleDeleteLogin = async (id: string) => {
    setUserMessage(null);
    const result = await deleteLogin(id);
    if (!result.ok) {
      setUserMessage(result.error ?? "Could not delete user.");
      return;
    }
    await loadLogins();
  };

  const loadAdminLogins = async () => {
    setLoadingAdminLogins(true);
    const data = await getAdminLogins();
    setAdminLogins(data);
    setLoadingAdminLogins(false);
  };

  const handleCreateAdminUser = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setAdminUserMessage(null);
    setCreatingAdminUser(true);
    const form = event.currentTarget;
    const fullNameInput = form.elements.namedItem(
      "admin-new-full-name"
    ) as HTMLInputElement | null;
    const usernameInput = form.elements.namedItem(
      "admin-new-username"
    ) as HTMLInputElement | null;
    const passwordInput = form.elements.namedItem(
      "admin-new-password"
    ) as HTMLInputElement | null;
    const fullName = fullNameInput?.value.trim() || undefined;
    const username = usernameInput?.value.trim() ?? "";
    const password = passwordInput?.value.trim() ?? "";

    if (!username || !password) {
      setAdminUserMessage("Username and password are required.");
      setCreatingAdminUser(false);
      return;
    }

    const result = await createAdminLogin(username, password, fullName);
    setCreatingAdminUser(false);
    if (result.ok) {
      if (fullNameInput) fullNameInput.value = "";
      if (usernameInput) usernameInput.value = "";
      if (passwordInput) passwordInput.value = "";
      await loadAdminLogins();
    } else {
      setAdminUserMessage(result.error ?? "Could not create admin user.");
    }
  };

  const handleDeleteAdminLogin = async (id: string) => {
    setAdminUserMessage(null);
    const result = await deleteAdminLogin(id);
    if (!result.ok) {
      setAdminUserMessage(result.error ?? "Could not delete admin user.");
      return;
    }
    await loadAdminLogins();
  };

  if (frames.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-end gap-3 border-b border-zinc-800/60 pb-4">
          <Link
            href="/main"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#eaa631] no-underline transition hover:text-[#f1b64f]"
          >
            ← go to page
          </Link>
        </div>
        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/70 p-8 text-center shadow-[0_18px_60px_rgba(0,0,0,0.7)]">
        <p className="mb-4 text-zinc-400">No frames in the database yet.</p>
        <p className="mb-6 text-sm text-zinc-500">
          Seed from{" "}
          <code className="rounded bg-zinc-800 px-1">public/storyboard</code>
        </p>
        <button
          type="button"
          onClick={handleSeed}
          disabled={seedStatus === "loading"}
          className="rounded-2xl bg-[#eaa631] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {seedStatus === "loading" ? "Seeding…" : "Seed database from current images"}
        </button>
        <p className="mt-3 max-w-md text-xs text-zinc-500">
          First-time seed creates rows with empty text. Later re-seeds keep your saved text;
          only image list and order update.
        </p>
        {seedStatus === "error" && (
          <p className="mt-4 text-sm text-red-400">
            Seed failed. Check env vars and Supabase table.
          </p>
        )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/60 pb-4">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="inline-flex rounded-full border border-zinc-700 bg-zinc-900/60 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("storyboard")}
              className={`rounded-full px-3 py-1 transition ${
                activeTab === "storyboard"
                  ? "bg-zinc-100 text-black"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Storyboard
            </button>
            <button
              type="button"
              onClick={async () => {
                setActiveTab("login");
                const tasks: Promise<void>[] = [];
                if (logins === null && !loadingLogins) tasks.push(loadLogins());
                if (adminLogins === null && !loadingAdminLogins) {
                  tasks.push(loadAdminLogins());
                }
                await Promise.all(tasks);
              }}
              className={`rounded-full px-3 py-1 transition ${
                activeTab === "login"
                  ? "bg-zinc-100 text-black"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Login access
            </button>
          </div>
          <Link
            href="/main"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#eaa631] no-underline transition hover:text-[#f1b64f]"
          >
            ← go to page
          </Link>
        </div>

        <button
          type="button"
          onClick={handleSeed}
          disabled={seedStatus === "loading"}
          className="text-sm text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
        >
          {seedStatus === "loading" ? "Seeding…" : "Re-seed from disk"}
        </button>
      </div>

      {activeTab === "login" && (
        <>
          <section className="w-full max-w-[720px] rounded-3xl border border-zinc-800/70 bg-zinc-950/70 p-5 sm:p-6 shadow-[0_18px_60px_rgba(0,0,0,0.7)]">
            <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
              Guest access
            </h2>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
                    Name
                  </label>
                  <input
                    name="new-full-name"
                    type="text"
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-3.5 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-[#eaa631] focus:ring-2 focus:ring-[#eaa631]/40"
                    placeholder="Full name"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
                    Company
                  </label>
                  <input
                    name="new-company"
                    type="text"
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-3.5 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-[#eaa631] focus:ring-2 focus:ring-[#eaa631]/40"
                    placeholder="Company"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
                    Username
                  </label>
                  <input
                    name="new-username"
                    type="text"
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-3.5 py-2 text-sm text-white outline-none transition focus:border-[#eaa631] focus:ring-2 focus:ring-[#eaa631]/40"
                    placeholder=""
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
                    Password
                  </label>
                  <input
                    name="new-password"
                    type="text"
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-3.5 py-2 text-sm text-white outline-none transition focus:border-[#eaa631] focus:ring-2 focus:ring-[#eaa631]/40"
                    placeholder=""
                  />
                </div>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="mt-2 inline-flex items-center justify-center rounded-2xl bg-[#eaa631] px-4 py-2 text-sm font-medium text-black transition hover:bg-[#f1b64f] disabled:opacity-60 sm:mt-0"
                >
                  {creatingUser ? "Adding…" : "Add user"}
                </button>
              </div>
            </form>
          </section>

          <section className="w-full max-w-[720px] rounded-2xl border border-zinc-800 bg-black/40 px-3.5 py-3">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
              Existing users
            </h3>
            {loadingLogins && <p className="text-xs text-zinc-500">Loading…</p>}
            {!loadingLogins && (logins?.length ?? 0) === 0 && (
              <p className="text-xs text-zinc-500">No users yet.</p>
            )}
            {!loadingLogins && logins && logins.length > 0 && (
              <ul className="space-y-1.5 text-sm text-zinc-300">
                {logins.map((login) => (
                  <li
                    key={login.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-zinc-950/70 px-3 py-1.5"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-zinc-100">
                        {login.full_name || login.username}
                      </span>
                      <span className="text-xs font-mono text-zinc-400">
                        {login.username}
                        {login.company ? ` · ${login.company}` : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteLogin(login.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-300 hover:bg-red-500/10 hover:text-red-300"
                      aria-label={`Delete ${login.username}`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        aria-hidden="true"
                      >
                        <path
                          d="M9 4h6m-8 3h10m-8 3v6m4-6v6M10 4.5A1.5 1.5 0 0 1 11.5 3h1A1.5 1.5 0 0 1 14 4.5V7H10V4.5Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <rect
                          x="7"
                          y="7"
                          width="10"
                          height="11"
                          rx="1.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {userMessage && (
            <p className="text-xs text-zinc-400">{userMessage}</p>
          )}

          <div className="my-10 space-y-6 border-t border-zinc-800/60 pt-10">
            <section className="w-full max-w-[720px] rounded-3xl border border-zinc-800/70 bg-zinc-950/70 p-5 sm:p-6 shadow-[0_18px_60px_rgba(0,0,0,0.7)]">
              <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
                Admin access
              </h2>
              <form onSubmit={handleCreateAdminUser} className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
                      Name
                    </label>
                    <input
                      name="admin-new-full-name"
                      type="text"
                      className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-3.5 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-[#eaa631] focus:ring-2 focus:ring-[#eaa631]/40"
                      placeholder="Full name"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
                      Username
                    </label>
                    <input
                      name="admin-new-username"
                      type="text"
                      autoComplete="off"
                      className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-3.5 py-2 text-sm text-white outline-none transition focus:border-[#eaa631] focus:ring-2 focus:ring-[#eaa631]/40"
                      placeholder=""
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
                      Password
                    </label>
                    <input
                      name="admin-new-password"
                      type="text"
                      autoComplete="new-password"
                      className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-3.5 py-2 text-sm text-white outline-none transition focus:border-[#eaa631] focus:ring-2 focus:ring-[#eaa631]/40"
                      placeholder=""
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={creatingAdminUser}
                    className="mt-2 inline-flex items-center justify-center rounded-2xl bg-[#eaa631] px-4 py-2 text-sm font-medium text-black transition hover:bg-[#f1b64f] disabled:opacity-60 sm:mt-0"
                  >
                    {creatingAdminUser ? "Adding…" : "Add admin user"}
                  </button>
                </div>
              </form>
            </section>

          <section className="w-full max-w-[720px] rounded-2xl border border-zinc-800 bg-black/40 px-3.5 py-3">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
              Admin users
            </h3>
            {loadingAdminLogins && (
              <p className="text-xs text-zinc-500">Loading…</p>
            )}
            {!loadingAdminLogins && (adminLogins?.length ?? 0) === 0 && (
              <p className="text-xs text-zinc-500">
                No admin users yet. Insert the first row in Supabase (
                <code className="rounded bg-zinc-900 px-1">
                  project_admin_logins
                </code>
                ).
              </p>
            )}
            {!loadingAdminLogins &&
              adminLogins &&
              adminLogins.length > 0 && (
                <ul className="space-y-1.5 text-sm text-zinc-300">
                  {adminLogins.map((login) => (
                    <li
                      key={login.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-zinc-950/70 px-3 py-1.5"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-zinc-100">
                          {login.full_name || login.username}
                        </span>
                        <span className="text-xs font-mono text-zinc-400">
                          {login.username}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAdminLogin(login.id)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-300 hover:bg-red-500/10 hover:text-red-300"
                        aria-label={`Delete admin ${login.username}`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path
                            d="M9 4h6m-8 3h10m-8 3v6m4-6v6M10 4.5A1.5 1.5 0 0 1 11.5 3h1A1.5 1.5 0 0 1 14 4.5V7H10V4.5Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <rect
                            x="7"
                            y="7"
                            width="10"
                            height="11"
                            rx="1.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.4"
                          />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
          </section>
          {adminUserMessage && (
            <p className="text-xs text-amber-400">{adminUserMessage}</p>
          )}
          </div>
        </>
      )}

      {activeTab === "storyboard" && (
        <>
          {navChapters.length > 0 && (
            <ChapterNav
              chapters={navChapters}
              layout={layout}
              onLayoutChange={handleLayoutChange}
            />
          )}

          {layout === "grid" ? (
            <div className="mt-8 grid w-full grid-cols-1 gap-10 sm:mt-12 sm:grid-cols-2 sm:gap-12 md:mt-16 md:gap-14">
              {gridItems.map((item, idx) =>
                item.kind === "spacer" ? (
                  <div key={item.key} aria-hidden />
                ) : (
                  <AdminFrameRow
                    key={`${item.frame.id}-${idx}`}
                    frame={item.frame}
                    globalIndex={item.index}
                    chapterLabel={item.chapterLabel}
                    layout="grid"
                    saving={savingId === item.frame.id}
                    showSavedFlash={savedFlashId === item.frame.id}
                    onSave={handleSave}
                  />
                )
              )}
            </div>
          ) : (
            <div className="mt-8 flex w-full flex-col gap-12 sm:mt-12 sm:gap-16 md:mt-16 md:gap-20 lg:gap-24">
              {frames.map((frame, index) => (
                <AdminFrameRow
                  key={frame.id}
                  frame={frame}
                  globalIndex={index}
                  chapterLabel={chapterLabelByIndex[index]}
                  layout="list"
                  saving={savingId === frame.id}
                  showSavedFlash={savedFlashId === frame.id}
                  onSave={handleSave}
                />
              ))}
            </div>
          )}

          <div className="h-12 sm:h-16" aria-hidden />
          <StoryboardFloatingActions />
        </>
      )}
    </div>
  );
}

function AdminFrameRow({
  frame,
  globalIndex,
  chapterLabel,
  layout,
  saving,
  showSavedFlash,
  onSave,
}: {
  frame: StoryboardFrame;
  globalIndex: number;
  chapterLabel?: string;
  layout: "list" | "grid";
  saving: boolean;
  showSavedFlash: boolean;
  onSave: (frame: StoryboardFrame, text: string) => void;
}) {
  const [text, setText] = useState(frame.text);
  /**
   * Plain editor er klar med én gang.
   * Screenplay (inkl. tomme felt som default screenplay) venter på Tiptap onReady.
   */
  const [editorReady, setEditorReady] = useState(() => {
    if (isScreenplayJsonString(frame.text)) return false;
    if (!frame.text.trim()) return false;
    return true;
  });
  /** Tomme felt → screenplay som standard; ellers plain kun for lagret plain/legacy-tekst. */
  const [editorMode, setEditorMode] = useState<"screenplay" | "plain">(() =>
    isScreenplayJsonString(frame.text) || !frame.text.trim()
      ? "screenplay"
      : "plain"
  );
  const [screenplaySnapshot, setScreenplaySnapshot] = useState<string | null>(() =>
    isScreenplayJsonString(frame.text) ? frame.text : null
  );
  const [plainDirty, setPlainDirty] = useState(false);
  const plainInitialRef = useRef<string | null>(null);
  /** Ved switch plain→screenplay: gi editoren riktig JSON før setState har oppdatert. */
  const pendingScreenplayContentRef = useRef<string | null>(null);
  const label = chapterLabel?.trim() ?? "";
  const isChapterStart = Boolean(label);
  const isGrid = layout === "grid";
  const fileName = frame.image_src.split("/").pop() ?? frame.image_src;

  const switchToScreenplay = () => {
    setEditorMode("screenplay");
    setEditorReady(false);
    const contentToUse =
      editorMode === "plain" && screenplaySnapshot && !plainDirty
        ? screenplaySnapshot
        : null;
    setText((prev) => {
      if (contentToUse) {
        pendingScreenplayContentRef.current = contentToUse;
        return contentToUse;
      }
      if (isScreenplayJsonString(prev)) {
        pendingScreenplayContentRef.current = prev;
        return prev;
      }
      const blocks = legacyTextToScreenplayBlocks(prev);
      const json = stringifyScreenplayBlocks(blocks);
      pendingScreenplayContentRef.current = json;
      return json;
    });
    setPlainDirty(false);
  };

  const switchToPlain = () => {
    setEditorMode("plain");
    setEditorReady(true);
    setText((prev) => {
      if (!isScreenplayJsonString(prev)) return prev;
      // Ta vare på original screenplay-streng slik at vi kan runde-trip'e uten tap
      setScreenplaySnapshot(prev);
      const blocks = parseScreenplayBlocks(prev);
      const plain = blocks
        .map((b) => {
          const raw = b.text ?? "";
          // Fjern HTML line-breaks når vi viser som "plain"
          return raw.replace(/<br\s*\/?>/gi, "\n");
        })
        .join("\n\n")
        // Unngå at vi bygger opp flere og flere tomlinjer
        .replace(/\n{3,}/g, "\n\n")
        .trimEnd();
      plainInitialRef.current = plain;
      return plain;
    });
    setPlainDirty(false);
  };

  return (
    <article
      className="flex w-full min-w-0 flex-col"
      id={`comic-frame-${globalIndex}`}
      data-frame-index={globalIndex}
    >
      {isChapterStart ? (
        <div
          id={`chapter-title-${globalIndex}`}
          className={`mb-3 w-full shrink-0 ${isGrid ? GRID_MARKER_RESERVE : ""}`}
        >
          <div className="inline-flex max-w-full rounded-lg border border-[#eaa631]/45 bg-zinc-950/95 px-3 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.5)] backdrop-blur-sm sm:px-3.5 sm:py-2">
            <p className="text-left text-[10px] font-medium uppercase leading-snug tracking-[0.14em] text-[#eaa631] [font-family:var(--font-im-fell-english),serif] sm:text-[11px]">
              {label}
            </p>
          </div>
        </div>
      ) : isGrid ? (
        <div
          className={`mb-3 w-full shrink-0 ${GRID_MARKER_RESERVE}`}
          aria-hidden
        />
      ) : null}

      <div
        className={`flex w-full flex-col gap-4 rounded-lg border bg-zinc-900/30 p-4 transition-[box-shadow,border-color] duration-300 ${
          showSavedFlash && !saving
            ? "border-emerald-600/50 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
            : "border-zinc-800"
        }`}
      >
        <div className="overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={frame.image_src}
            alt={`Frame ${globalIndex + 1}`}
            className="block h-auto w-full object-contain"
          />
        </div>
        <p className="text-xs text-zinc-500">{fileName}</p>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className="block text-xs uppercase tracking-wide text-zinc-500">
              Manuscript — frame {globalIndex + 1}
            </label>
            <div className="inline-flex rounded-full bg-zinc-900/80 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={switchToScreenplay}
                className={`px-2.5 py-1 rounded-full ${
                  editorMode === "screenplay"
                    ? "bg-[#eaa631] text-black font-medium"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                Screenplay
              </button>
              <button
                type="button"
                onClick={switchToPlain}
                className={`px-2.5 py-1 rounded-full ${
                  editorMode === "plain"
                    ? "bg-[#eaa631] text-black font-medium"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                Plain text
              </button>
            </div>
          </div>

          {editorMode === "screenplay" ? (
            <>
              <p className="mb-1.5 text-[11px] leading-snug text-zinc-500">
                <kbd className="rounded bg-zinc-800 px-1">⌘1</kbd> scene,{" "}
                <kbd className="rounded bg-zinc-800 px-1">⌘2</kbd> action,{" "}
                <kbd className="rounded bg-zinc-800 px-1">⌘3</kbd> character,{" "}
                <kbd className="rounded bg-zinc-800 px-1">⌘4</kbd> dialogue,{" "}
                <kbd className="rounded bg-zinc-800 px-1">⌘5</kbd> parenthetical,{" "}
                <kbd className="rounded bg-zinc-800 px-1">⌘6</kbd> transition.{" "}
                <kbd className="rounded bg-zinc-800 px-1">Tab</kbd> cycles
                character → dialogue → action. Enter etter character → dialogue;
                etter dialogue → action.{" "}
                <kbd className="rounded bg-zinc-800 px-1">⇧Enter</kbd> linjeskift i
                blokken. <strong>Lim inn:</strong> Fountain-lignende tekst eller
                HTML fra Docs / WriterDuet / tabeller tolkes til blokker (scene,
                action, karakter, replikk …) og fet/kursiv. Lange utdrag eller
                tydelig manusstruktur aktiverer lim-inn; enkelt ord/linje limes som
                vanlig.
              </p>
              <ScreenplayEditor
                key={`${frame.id}-screenplay`}
                initialContent={pendingScreenplayContentRef.current ?? text}
                onChange={(next) => {
                  pendingScreenplayContentRef.current = null;
                  setText(next);
                }}
                onReady={() => {
                  pendingScreenplayContentRef.current = null;
                  setEditorReady(true);
                }}
                layout={layout}
                minRows={layout === "grid" ? 6 : 5}
                className="w-full"
              />
            </>
          ) : (
            <>
              <p className="mb-1.5 text-[11px] leading-snug text-zinc-500">
                Enkel riktekst (fet/kursiv, linjeskift). Ingen screenplay-blokker
                eller spesielle snarveier.
              </p>
              <ManuscriptRichEditor
                key={`${frame.id}-plain`}
                defaultValue={text}
                onChange={(val) => {
                  setText(val);
                  const initial = plainInitialRef.current;
                  if (initial == null) {
                    setPlainDirty(true);
                    return;
                  }
                  setPlainDirty(val !== initial);
                }}
                minRows={layout === "grid" ? 6 : 5}
                className={`w-full rounded-2xl border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 ${
                  layout === "list" ? "text-center" : "text-left"
                }`}
              />
            </>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {saving ? (
              <button
                type="button"
                disabled
                className="rounded-2xl bg-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-300"
              >
                Saving…
              </button>
            ) : showSavedFlash ? (
              <output
                className="admin-saved-feedback inline-flex items-center gap-1.5 rounded-2xl bg-emerald-800/90 px-3 py-1.5 text-sm font-medium text-emerald-100"
                aria-live="polite"
              >
                <svg
                  className="h-4 w-4 shrink-0 text-emerald-300"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Saved
              </output>
            ) : (
              <button
                type="button"
                onClick={() => onSave(frame, text)}
                disabled={!editorReady || text === frame.text}
                className="rounded-2xl bg-[#eaa631] px-3 py-1.5 text-sm font-medium text-black transition hover:bg-[#f1b64f] disabled:opacity-50"
              >
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
