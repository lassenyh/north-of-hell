"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { adminLogout } from "@/app/admin/actions";
import { AdminLoginForm } from "@/app/admin/login/AdminLoginForm";

const accountButtonClass = "whitespace-nowrap rounded-full border border-zinc-700 bg-zinc-900/70 px-2 py-1.5 text-[10px] uppercase tracking-[0.12em] text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100 sm:px-3.5 sm:text-[11px]";
const accountFont = { fontFamily: "var(--font-im-fell-english), serif", fontSize: "11px", lineHeight: "1.45" };

export function AdminLoginModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname() ?? "";
  const isStoryboardStudio = pathname === "/storyboard-studio" || pathname.startsWith("/admin/storyboard");
  const [sessionStatus, setSessionStatus] = useState<{ pathname: string; authenticated: boolean } | null>(null);

  useEffect(() => {
    if (isStoryboardStudio) return;
    const controller = new AbortController();
    fetch("/api/admin/session", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : { authenticated: false })
      .then((result) => {
        if (!controller.signal.aborted && result) {
          setSessionStatus({ pathname, authenticated: result.authenticated === true });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setSessionStatus({ pathname, authenticated: false });
      });
    return () => controller.abort();
  }, [isStoryboardStudio, pathname]);

  const authenticated = isStoryboardStudio || (sessionStatus?.pathname === pathname && sessionStatus.authenticated);

  if (authenticated) {
    return (
      <div className="fixed right-2 top-[15px] z-50 flex items-center gap-1.5 sm:right-5 sm:gap-2">
        <Link href="/storyboard-studio" className={`${accountButtonClass} ${isStoryboardStudio ? "border-[#eaa631] text-[#eaa631]" : ""}`} style={accountFont} aria-current={isStoryboardStudio ? "page" : undefined}>
          Studio
        </Link>
        <form action={adminLogout}>
          <button type="submit" className={accountButtonClass} style={accountFont} aria-label="Admin log out">
            Log out
          </button>
        </form>
      </div>
    );
  }

  if (sessionStatus?.pathname !== pathname) return null;

  return (
    <>
      <div className="fixed right-5 top-[15px] z-50">
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className={accountButtonClass}
          style={accountFont}
          aria-label="Admin login"
        >
          Login
        </button>
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby="admin-login-modal-title"
        onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}
        className="admin-login-modal fixed inset-0 m-auto w-[min(500px,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[28px] border-0 bg-transparent p-0 text-white shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop:bg-black/65"
      >
        <section className="relative overflow-hidden rounded-[28px]" aria-label="Admin sign in">
          <Image
            src="/Login-assets/RED%20BG.png"
            alt=""
            fill
            sizes="(max-width: 640px) calc(100vw - 32px), 500px"
            className="object-cover"
          />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/15 text-black transition hover:bg-black/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            aria-label="Close admin login"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="h-4 w-4">
              <path d="M5 5 19 19M19 5 5 19" />
            </svg>
          </button>
          <div className="relative px-[12%] pb-[10%] pt-[11%] sm:px-[13%] sm:pb-[11%] sm:pt-[12%]">
            <div className="relative mx-auto aspect-[7419/2500] w-full overflow-hidden">
              <Image
                src="/Login-assets/NOH_SMALLTITLE.png"
                alt="North of Hell — A film by Niels Windfeldt"
                width={7419}
                height={3560}
                className="absolute inset-x-0 top-0 h-auto w-full brightness-0"
              />
            </div>
            <p id="admin-login-modal-title" className="mt-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-black/70">
              Admin access
            </p>
            <AdminLoginForm />
          </div>
        </section>
      </dialog>
    </>
  );
}
