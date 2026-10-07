"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useStoryboardTheme } from "./StoryboardTheme";

export function StoryboardLibraryDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { theme } = useStoryboardTheme();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    dialog.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return createPortal(
    <dialog ref={dialogRef} className={`sb-library-dialog storyboard-theme--${theme}`} aria-label={title}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => {
        event.stopPropagation();
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}>
      <div className="sb-library-dialog-shell">
        <div className="sb-library-dialog-head"><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Close image library">Close</button></div>
        <div className="sb-library-dialog-content">{children}</div>
      </div>
    </dialog>, document.body,
  );
}
