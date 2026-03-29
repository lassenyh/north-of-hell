import { Suspense } from "react";
import { LoginPageClient } from "./LoginPageClient";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-black" aria-hidden />}
    >
      <LoginPageClient />
    </Suspense>
  );
}
