import Link from "next/link";
import Image from "next/image";

export function MainSiteHeaderLogo() {
  return (
    <Link
      href="/main/legacy"
      aria-label="North of Hell"
      className="inline-block shrink-0 rounded-md transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      <Image
        src="/Login-assets/NOH_TITLE_C72B1F.png"
        alt=""
        width={7373}
        height={1562}
        className="h-auto w-[150px] brightness-0 invert sm:w-[170px]"
      />
    </Link>
  );
}
