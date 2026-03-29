import type { ScreenplayBlockType } from "@/lib/screenplay-json";

/** Public storyboard: same visual language as admin blocks (read-only). */
export function screenplayReadClass(t: ScreenplayBlockType): string {
  const base =
    "mb-1 text-[12pt] leading-[1.15] whitespace-pre-wrap [font-family:var(--font-courier-prime),Courier,monospace]";
  const by: Record<ScreenplayBlockType, string> = {
    scene_heading: `${base} font-bold uppercase tracking-[0.12em] text-zinc-100 text-center`,
    action: `${base} text-zinc-100 text-center`,
    character: `${base} uppercase text-center text-zinc-100`,
    dialogue: `${base} italic text-center text-zinc-100 max-w-[42ch] mx-auto w-full`,
    parenthetical: `${base} italic text-center text-zinc-300 max-w-[36ch] mx-auto w-full`,
    transition: `${base} uppercase text-right text-zinc-200`,
  };
  return by[t];
}
