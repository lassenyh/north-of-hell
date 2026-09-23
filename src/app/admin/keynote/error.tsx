"use client";
export default function KeynoteError({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen bg-neutral-950 p-12 text-white">
      <h1 className="text-2xl">Kunne ikke hente keynote-kladden</h1>
      <p className="my-4">
        Prøv igjen. Hvis problemet fortsetter, kontakt prosjektansvarlig for å
        kontrollere databasetilgang og migrasjon.
      </p>
      <button className="rounded border px-4 py-2" onClick={reset}>
        Prøv igjen
      </button>
    </main>
  );
}
