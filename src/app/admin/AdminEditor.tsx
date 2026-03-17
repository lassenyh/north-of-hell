"use client";

import { useEffect, useState } from "react";
import { updateFrameText, createLogin, getLogins, deleteLogin } from "./actions";
import type { StoryboardFrame } from "@/lib/supabase/storyboard";
import type { ProjectLogin } from "@/lib/supabase/auth";

type Props = { frames: StoryboardFrame[] };

export function AdminEditor({ frames: initialFrames }: Props) {
  const [frames, setFrames] = useState(initialFrames);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [seedStatus, setSeedStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [creatingUser, setCreatingUser] = useState(false);
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [logins, setLogins] = useState<ProjectLogin[] | null>(null);
  const [loadingLogins, setLoadingLogins] = useState(false);
  const chapters = groupFramesByChapter(frames);
  const [activeChapterId, setActiveChapterId] = useState(
    chapters[0]?.id ?? null
  );
  const [hasScrolled, setHasScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState<"storyboard" | "login">("storyboard");

  useEffect(() => {
    const onScroll = () => {
      // Fader logoen inn så snart man har scrollet litt ned fra toppen.
      setHasScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSave = async (frame: StoryboardFrame, text: string) => {
    setSavingId(frame.id);
    const result = await updateFrameText(frame.id, text);
    setSavingId(null);
    if (result.ok) {
      setFrames((prev) =>
        prev.map((f) => (f.id === frame.id ? { ...f, text } : f))
      );
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
      // Silent success – just refresh list and clear inputs.
      if (usernameInput) usernameInput.value = "";
      if (passwordInput) passwordInput.value = "";
      if (fullNameInput) fullNameInput.value = "";
      if (companyInput) companyInput.value = "";
      // Refresh list
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

  if (frames.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-8 text-center">
        <p className="mb-4 text-zinc-400">No frames in the database yet.</p>
        <p className="mb-6 text-sm text-zinc-500">
          Click below to load all images from <code className="rounded bg-zinc-800 px-1">public/storyboard</code> into Supabase.
        </p>
        <button
          type="button"
          onClick={handleSeed}
          disabled={seedStatus === "loading"}
          className="rounded bg-[#eaa631] px-4 py-2 text-black font-medium disabled:opacity-50"
        >
          {seedStatus === "loading" ? "Seeding…" : "Seed database from current images"}
        </button>
        {seedStatus === "error" && (
          <p className="mt-4 text-sm text-red-400">Seed failed. Check env vars and Supabase table.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top bar: tabs + lenker */}
      <div className="flex flex-wrap items-center justify-between gap-4">
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
              if (logins === null && !loadingLogins) {
                await loadLogins();
              }
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

        <div className="flex flex-wrap items-center gap-4">
          <a
            href="/storyboard"
            className="text-sm text-zinc-400 underline hover:text-zinc-200"
          >
            View public storyboard →
          </a>
          <button
            type="button"
            onClick={handleSeed}
            disabled={seedStatus === "loading"}
            className="text-sm text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
          >
            {seedStatus === "loading" ? "Seeding…" : "Re-seed from disk"}
          </button>
        </div>
      </div>

      {/* Login access-tabinnhold (skjult som default) */}
      {activeTab === "login" && (
        <>
          <section className="w-full max-w-[720px] rounded-3xl border border-zinc-800/70 bg-zinc-950/70 p-5 sm:p-6 shadow-[0_18px_60px_rgba(0,0,0,0.7)]">
            <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
              Login access
            </h2>
            <form
              onSubmit={handleCreateUser}
              className="space-y-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                <div className="flex-1">
                <label className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
                  Name
                  </label>
                  <input
                    name="new-full-name"
                    type="text"
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-3.5 py-2 text-sm text-white placeholder-zinc-500 outline-none ring-0 transition focus:border-[#eaa631] focus:ring-2 focus:ring-[#eaa631]/40"
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
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-3.5 py-2 text-sm text-white placeholder-zinc-500 outline-none ring-0 transition focus:border-[#eaa631] focus:ring-2 focus:ring-[#eaa631]/40"
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
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-3.5 py-2 text-sm text-white placeholder-zinc-500 outline-none ring-0 transition focus:border-[#eaa631] focus:ring-2 focus:ring-[#eaa631]/40"
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
                    className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-3.5 py-2 text-sm text-white placeholder-zinc-500 outline-none ring-0 transition focus:border-[#eaa631] focus:ring-2 focus:ring-[#eaa631]/40"
                  placeholder=""
                  />
                </div>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="mt-2 inline-flex items-center justify-center rounded-2xl bg-[#eaa631] px-4 py-2 text-sm font-medium text-black transition hover:bg-[#f1b64f] active:bg-[#dda124] disabled:opacity-60 sm:mt-0"
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
            {loadingLogins && (
              <p className="text-xs text-zinc-500">Loading…</p>
            )}
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

        </>
      )}

      {activeTab === "storyboard" && (
        <>
          {/* Sticky kapittelmeny som følger scrollen + logo som fader inn ved scroll */} 
          {chapters.length > 0 && (
            <div className="sticky top-0 z-20 mb-4 border-b border-zinc-800/70 bg-black/85 py-3 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Chapters
                  </span>
                  <div className="relative inline-block min-w-[220px]">
                    <select
                      value={activeChapterId ?? undefined}
                      onChange={(e) => {
                        const id = e.target.value;
                        setActiveChapterId(id);
                        const el = document.getElementById(id);
                        if (el) {
                          el.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }
                      }}
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-[#eaa631] focus:outline-none focus:ring-1 focus:ring-[#eaa631]"
                    >
                      {chapters.map((chapter) => (
                        <option key={chapter.id} value={chapter.id}>
                          {chapter.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div
                  className={`mr-1 text-right text-xs font-medium uppercase tracking-tight text-[#eaa631] opacity-0 transition-opacity duration-300 ease-out [font-family:var(--font-im-fell-english),serif] ${
                    hasScrolled ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <span className="block text-sm sm:text-base">North of Hell</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-12 sm:gap-16">
            {chapters.map((chapter) => (
              <section
                key={chapter.id}
                id={chapter.id}
                className="space-y-6 scroll-mt-24"
              >
                <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
                  {chapter.label}
                </h2>
                <div className="flex flex-col gap-10">
                  {chapter.frames.map((frame, index) => (
                    <FrameRow
                      key={frame.id}
                      frame={frame}
                      index={index + chapter.offset}
                      saving={savingId === frame.id}
                      onSave={handleSave}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function groupFramesByChapter(frames: StoryboardFrame[]) {
  type Chapter = {
    id: string;
    label: string;
    frames: StoryboardFrame[];
    offset: number;
  };
  const chapters: Chapter[] = [];

  let current: Chapter | null = null;
  frames.forEach((frame, index) => {
    const parts = frame.image_src.split("/");
    const label = parts.length > 2 ? parts[2] : "Unsorted";

    if (!current || current.label !== label) {
      const id =
        "admin-chapter-" +
        label
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9\-]/g, "");
      current = { id, label, frames: [], offset: index };
      chapters.push(current);
    }
    current.frames.push(frame);
  });

  return chapters;
}

function FrameRow({
  frame,
  index,
  saving,
  onSave,
}: {
  frame: StoryboardFrame;
  index: number;
  saving: boolean;
  onSave: (frame: StoryboardFrame, text: string) => void;
}) {
  const [text, setText] = useState(frame.text);
  const fileName = frame.image_src.split("/").pop() ?? frame.image_src;

  return (
    <article className="flex w-full flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="overflow-hidden rounded">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frame.image_src}
          alt={`Frame ${index + 1}`}
          className="block w-full h-auto object-contain"
        />
      </div>
      <p className="text-xs text-zinc-500">{fileName}</p>
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
          Manuscript text (frame {index + 1})
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-[#eaa631] focus:outline-none focus:ring-1 focus:ring-[#eaa631]"
          placeholder="Enter manuscript text…"
        />
        <button
          type="button"
          onClick={() => onSave(frame, text)}
          disabled={saving || text === frame.text}
          className="mt-2 rounded bg-[#eaa631] px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </article>
  );
}
