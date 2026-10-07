import Link from "next/link";

type Props = {
  active?: 1 | 2 | 3 | "keynote" | "landing";
  className?: string;
};

const items = [
  { label: "Login – Alt 1", href: "/login?alt=1", value: 1 as const },
  { label: "Login – Alt 2", href: "/login?alt=2", value: 2 as const },
  { label: "Login – Alt 3", href: "/login?alt=3", value: 3 as const },
  { label: "Keynote", href: "/main", value: "keynote" as const },
  { label: "Landing page", href: "/main/legacy", value: "landing" as const },
];

export function LoginDemoSwitcher({ active, className = "" }: Props) {
  return (
    <nav
      aria-label="Demo navigation"
      className={`flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-end gap-1 rounded-full border border-white/20 bg-black/55 p-1 shadow-lg backdrop-blur-md sm:flex-nowrap ${className}`}
    >
      {items.map((item) => (
        <Link
          key={item.value}
          href={item.href}
          aria-current={active === item.value ? "page" : undefined}
          className={`rounded-full whitespace-nowrap px-2.5 py-2 text-[10px] sm:px-4 font-semibold uppercase tracking-[0.08em] transition sm:text-xs ${
            active === item.value
              ? "bg-white/10 text-white"
              : "text-white/75 hover:bg-white/10 hover:text-white"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
