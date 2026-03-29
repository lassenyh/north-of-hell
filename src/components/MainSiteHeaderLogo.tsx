import Link from "next/link";

const logoClass =
  "shrink-0 text-sm font-medium uppercase leading-tight tracking-[0.08em] text-[#eaa631] sm:text-base [font-family:var(--font-im-fell-english),serif]";

export function MainSiteHeaderLogo() {
  return (
    <Link
      href="/main"
      className={`${logoClass} inline-block rounded-md transition hover:text-[#f1b64f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#eaa631]/50`}
    >
      North of Hell
    </Link>
  );
}
