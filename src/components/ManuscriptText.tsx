"use client";

import {
  lineHasInlineMarkup,
  sanitizeManuscriptLine,
  sanitizeScreenplayBlockHtml,
} from "@/lib/manuscript-html";
import {
  isScreenplayJsonString,
  parseScreenplayBlocks,
} from "@/lib/screenplay-json";
import { screenplayReadClass } from "@/lib/screenplay-read-classes";

/**
 * Storyboard manuscript: Courier Prime 12pt.
 * JSON screenplay blocks (from admin) or legacy lines / `>` center / inline HTML.
 */
export function ManuscriptText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  if (isScreenplayJsonString(text)) {
    const blocks = parseScreenplayBlocks(text);
    const base =
      "w-full min-w-0 text-white [font-family:var(--font-courier-prime),Courier,monospace]";
    const inlineRich =
      "[&_b]:font-bold [&_strong]:font-bold [&_em]:italic [&_i]:italic";
    return (
      <div className={`screenplay-manuscript-flow ${base} ${className}`}>
        {blocks.map((b, i) => {
          const cls = screenplayReadClass(b.type);
          const hasRich =
            lineHasInlineMarkup(b.text) || /<\s*br\s*\/?>/i.test(b.text);
          if (hasRich) {
            const html = sanitizeScreenplayBlockHtml(b.text) || "\u00a0";
            return (
              <div
                key={i}
                data-block-type={b.type}
                className={`${cls} ${inlineRich}`}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          }
          return (
            <div key={i} data-block-type={b.type} className={cls}>
              {b.text || "\u00a0"}
            </div>
          );
        })}
      </div>
    );
  }

  const lines = text.split(/\r?\n/);
  const base =
    "w-full min-w-0 text-[12pt] leading-[1.05] text-white [font-family:var(--font-courier-prime),Courier,monospace]";

  function renderLine(content: string, center: boolean) {
    const align = center ? "text-center" : "text-left";
    if (!content) {
      return (
        <div className={`whitespace-pre-wrap ${align}`} aria-hidden>
          {"\u00a0"}
        </div>
      );
    }
    if (lineHasInlineMarkup(content)) {
      const html = sanitizeManuscriptLine(content) || "\u00a0";
      return (
        <div
          className={`whitespace-pre-wrap ${align} [&_b]:font-bold [&_strong]:font-bold [&_em]:italic [&_i]:italic`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    return (
      <div className={`whitespace-pre-wrap ${align}`}>{content}</div>
    );
  }

  return (
    <div className={`${base} ${className}`}>
      {lines.map((line, i) => {
        const m = /^\s*(?:>|&gt;)\s?(.*)$/.exec(line);
        const content = m ? (m[1] ?? "").trimEnd() : line;
        return (
          <div key={i}>{renderLine(content, Boolean(m))}</div>
        );
      })}
    </div>
  );
}
