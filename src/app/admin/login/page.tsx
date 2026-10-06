import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminLoginById } from "@/lib/supabase/admin-auth";
import { AdminLoginForm } from "./AdminLoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const session = (await cookies()).get("noh_admin_auth")?.value;
  if (session && (await getAdminLoginById(session))) redirect("/storyboard-studio");

  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-black px-5 py-8 text-white">
      <video
        className="absolute inset-0 h-full w-full scale-[1.04] object-cover blur-[12px]"
        src="/Login-assets/NOH_LOGIN_BG.mov"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/35" aria-hidden />

      <section
        aria-label="Admin sign in"
        className="relative w-full max-w-[460px] overflow-hidden rounded-[28px] shadow-[0_28px_90px_rgba(0,0,0,0.55)] sm:max-w-[500px]"
      >
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
          <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-black/70">
            Admin access
          </p>
          <AdminLoginForm />
        </div>
      </section>
    </main>
  );
}
