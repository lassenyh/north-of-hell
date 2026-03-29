"use client";

type FrameScriptTriggerProps = {
  onClick: () => void;
};

export function FrameScriptTrigger({ onClick }: FrameScriptTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open screenplay preview"
      className="frame-script-trigger absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 group-hover:opacity-100 group-focus-within:opacity-100 hover:scale-105 hover:bg-black/60 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        className="h-5 w-5"
        aria-hidden
      >
        <path d="M6 4.5h9.6a2.4 2.4 0 0 1 2.4 2.4v12.6a.5.5 0 0 1-.74.43L14 18.2l-3.26 1.73A.5.5 0 0 1 10 19.5V6.9A2.4 2.4 0 0 0 7.6 4.5H6Z" />
        <path d="M7.2 7.6h7.8M7.2 10.9h7.8M7.2 14.2h5.2" />
      </svg>
    </button>
  );
}
