import { redirect } from "next/navigation";

// Avoid static prerender at build time (needs Supabase at request time)
export const dynamic = "force-dynamic";

export default async function Home() {
  redirect("/login");
}
