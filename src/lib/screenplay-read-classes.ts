import type { ScreenplayBlockType } from "@/lib/screenplay-json";

/** Public storyboard: same visual language as admin blocks (read-only). */
export function screenplayReadClass(t: ScreenplayBlockType): string {
  const base =
    "mb-1 text-[12pt] leading-[1.15] whitespace-pre-wrap [font-family:var(--font-courier-prime),Courier,monospace]";
  const by: Record<ScreenplayBlockType, string> = {
    general: `${base} text-zinc-100 text-center`,
    scene_heading: `${base} uppercase text-zinc-100 text-center`,
    action: `${base} text-zinc-100 text-center`,
    character: `${base} uppercase text-center text-zinc-100`,
    dialogue: `${base} text-center text-zinc-100 max-w-[42ch] mx-auto w-full`,
    parenthetical: `${base} text-center text-zinc-300 max-w-[36ch] mx-auto w-full`,
    transition: `${base} uppercase text-right text-zinc-200`,
    shot: `${base} uppercase text-zinc-100 text-center`,
    cast_list: `${base} text-zinc-100 text-center`,
    new_act: `${base} uppercase text-zinc-100 text-center`,
    sequence: `${base} uppercase text-zinc-100 text-center`,
    end_of_act: `${base} uppercase text-zinc-100 text-center`,
    summary: `${base} text-zinc-100 text-center`,
    outline_1: `${base} text-zinc-100 text-center font-bold`,
    outline_2: `${base} text-zinc-100 text-center font-bold`,
    outline_3: `${base} text-zinc-100 text-center font-bold`,
    note: `${base} text-zinc-100 text-center italic`,
  };
  return by[t];
}
