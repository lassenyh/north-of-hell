"use client";
export default function KeynoteError({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen bg-neutral-950 p-12 text-white">
      <h1 className="text-2xl">Could not load the Keynote draft</h1>
      <p className="my-4">
        Try again. If the problem persists, contact the project administrator
        to check database access and migrations.
      </p>
      <button className="rounded border px-4 py-2" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
