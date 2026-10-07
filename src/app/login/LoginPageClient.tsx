"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MainSiteHeader } from "@/components/MainSiteHeader";
import { LoginForm } from "./LoginForm";

function BackgroundFilm({ blurred = false }: { blurred?: boolean }) {
  return (
    <video
      className={`absolute inset-0 h-full w-full object-cover transition-[filter,transform] duration-[1800ms] ease-out ${
        blurred ? "scale-[1.04] blur-[12px]" : "scale-100 blur-0"
      }`}
      src="/Login-assets/NOH_LOGIN_BG.mov"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden
    />
  );
}

function LoginAltOne() {
  const router = useRouter();
  const timersRef = useRef(new Set<number>());
  const [revealing, setRevealing] = useState(false);
  const [takingOver, setTakingOver] = useState(false);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function handleSuccess() {
    setRevealing(true);
    timersRef.current.add(
      window.setTimeout(() => setTakingOver(true), 3000),
    );
    timersRef.current.add(
      window.setTimeout(() => router.push("/main"), 4800),
    );
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-black text-white">
      <BackgroundFilm blurred={!revealing} />
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-[1600ms] ease-out ${
          revealing ? "opacity-20" : "opacity-35"
        }`}
        aria-hidden
      />
      <Image
        src="/Login-assets/RED%20BG.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className={`z-[5] object-cover transition-opacity duration-[1800ms] ease-in-out ${
          takingOver ? "opacity-100" : "opacity-0"
        }`}
      />

      <section
        aria-label="Project login"
        className={`absolute inset-0 z-10 flex items-center justify-center px-5 py-8 transition-[opacity,transform,filter] duration-700 ease-in-out ${
          revealing
            ? "pointer-events-none scale-[0.98] blur-sm opacity-0"
            : "scale-100 opacity-100"
        }`}
      >
        <div className="relative w-full max-w-[460px] overflow-hidden rounded-[28px] shadow-[0_28px_90px_rgba(0,0,0,0.55)] sm:max-w-[500px]">
          <Image
            src="/Login-assets/RED%20BG.png"
            alt=""
            fill
            priority
            sizes="(max-width: 640px) calc(100vw - 40px), 500px"
            className="scale-[1.012] object-cover"
          />
          <div className="relative px-[12%] pb-[10%] pt-[11%] sm:px-[13%] sm:pb-[11%] sm:pt-[12%]">
            <div className="relative mx-auto aspect-[7419/2500] w-full overflow-hidden">
              <Image
                src="/Login-assets/NOH_SMALLTITLE.png"
                alt="North of Hell — A film by Niels Windfeldt"
                width={7419}
                height={3560}
                priority
                className="absolute inset-x-0 top-0 h-auto w-full brightness-0"
              />
            </div>
            <LoginForm disabled={revealing} onSuccess={handleSuccess} />
          </div>
        </div>
      </section>

      <div
        className={`pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-8 transition-opacity duration-1000 ${
          revealing ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden={!revealing}
      >
        <div
          className={`w-[min(82vw,920px)] transition-[opacity,transform,filter] duration-500 ease-out ${
            revealing ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          } ${takingOver ? "brightness-0 !duration-[1800ms]" : ""}`}
        >
          <Image
            src="/Login-assets/NOH_TITLE_C72B1F.png"
            alt="North of Hell"
            width={7373}
            height={1562}
            className="h-auto w-full drop-shadow-[0_4px_20px_rgba(0,0,0,0.45)]"
          />
          <Image
            src="/Login-assets/NOH_FILM_BY_C72B1F.png"
            alt="A film by Niels Windfeldt"
            width={2793}
            height={134}
            className={`mx-auto mt-[7.07%] h-auto w-[37.88%] drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)] transition-[opacity,transform] delay-300 duration-500 ease-out ${
              revealing ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            }`}
          />
        </div>
      </div>
    </main>
  );
}

function LoginAltTwo({ legacyVariant = false }: { legacyVariant?: boolean }) {
  const router = useRouter();
  const timersRef = useRef(new Set<number>());
  const [formHidden, setFormHidden] = useState(false);
  const [takingOver, setTakingOver] = useState(false);
  const [showHeader, setShowHeader] = useState(false);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function handleSuccess() {
    setFormHidden(true);
    timersRef.current.add(
      window.setTimeout(() => setTakingOver(true), legacyVariant ? 600 : 2000),
    );
    if (legacyVariant) timersRef.current.add(
      window.setTimeout(() => setShowHeader(true), 1200),
    );
    timersRef.current.add(
      window.setTimeout(() => router.push(legacyVariant ? "/main/legacy?from=login-alt-3" : "/main"), legacyVariant ? 2400 : 3800),
    );
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-black text-white">
      <BackgroundFilm />
      <div className="absolute inset-0 bg-black/25" aria-hidden />
      {legacyVariant ? (
        <div className={`absolute inset-0 z-[5] bg-black transition-opacity duration-[1200ms] ease-in-out ${takingOver ? "opacity-100" : "opacity-0"}`} aria-hidden />
      ) : (
        <Image
          src="/Login-assets/RED%20BG.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className={`z-[5] object-cover transition-opacity duration-[1800ms] ease-in-out ${
            takingOver ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {legacyVariant && <div className={`absolute inset-x-0 top-0 z-40 transition-transform duration-700 ease-out ${showHeader ? "translate-y-0" : "-translate-y-full"}`}><MainSiteHeader /></div>}

      <div
        className={`login-alt-two-title absolute left-1/2 z-10 transition-[top,width,transform] duration-700 ease-in-out ${
          formHidden
            ? "top-[calc(50%-min(12.33vw,138.4px))] w-[min(82vw,920px)] -translate-x-1/2"
            : "top-[29%] w-[min(72vw,760px)] -translate-x-1/2"
        }`}
      >
        <div
          className={`transition-[filter] duration-[1800ms] ease-in-out ${
            takingOver && !legacyVariant ? "brightness-0" : ""
          }`}
        >
          <Image
            src="/Login-assets/NOH_TITLE_C72B1F.png"
            alt="North of Hell"
            width={7373}
            height={1562}
            priority
            className="h-auto w-full drop-shadow-[0_4px_18px_rgba(0,0,0,0.35)]"
          />
          <Image
            src="/Login-assets/NOH_FILM_BY_C72B1F.png"
            alt="A film by Niels Windfeldt"
            width={2793}
            height={134}
            priority
            className="mx-auto mt-[7.07%] h-auto w-[37.88%] drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
          />
        </div>
      </div>

      <section
        aria-label={legacyVariant ? "Project login" : "Project login alternative 2"}
        className={`absolute left-1/2 top-[68%] z-10 w-[min(calc(100vw-3rem),320px)] -translate-x-1/2 transition-[opacity,transform,filter] duration-700 ease-in-out ${
          formHidden
            ? "pointer-events-none translate-y-16 blur-sm opacity-0"
            : "translate-y-0 opacity-100"
        }`}
      >
        <LoginForm
          variant="open"
          disabled={formHidden}
          onSuccess={handleSuccess}
        />
      </section>
    </main>
  );
}

export function LoginPageClient() {
  const searchParams = useSearchParams();
  const alternative = searchParams.get("alt") === "1" ? 1 : searchParams.get("alt") === "2" ? 2 : 3;

  return alternative === 1 ? <LoginAltOne /> : <LoginAltTwo legacyVariant={alternative === 3} />;
}
