export type ReaderSection = { id: string; chapterId: string; chapterNumber: number; title: string };
export type ReaderLocation = { sectionId: string; chapterId: string; fraction: number; savedAt: number };
export type ReaderProgress = { lastRead: ReaderLocation | null };

export const emptyReaderProgress = (): ReaderProgress => ({ lastRead: null });

export function readerProgressKey(scope: string) {
  return `noh-storyboard-progress:v1:${scope}`;
}

function parseLocation(value: unknown): ReaderLocation | null {
  if (!value || typeof value !== "object") return null;
  const location = value as Record<string, unknown>;
  if (typeof location.sectionId !== "string" || typeof location.chapterId !== "string" ||
      typeof location.fraction !== "number" || !Number.isFinite(location.fraction) ||
      typeof location.savedAt !== "number" || !Number.isFinite(location.savedAt)) return null;
  return {
    sectionId: location.sectionId,
    chapterId: location.chapterId,
    fraction: Math.max(0, Math.min(1, Number(location.fraction))),
    savedAt: Number(location.savedAt),
  };
}

export function parseReaderProgress(raw: string | null): ReaderProgress {
  if (!raw) return emptyReaderProgress();
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    // Keep the deliberately saved place when reading older two-position data.
    return { lastRead: parseLocation(value?.bookmark) ?? parseLocation(value?.lastRead) };
  } catch {
    return emptyReaderProgress();
  }
}

export function resolveReaderSection(location: ReaderLocation | null, sections: ReaderSection[]) {
  if (!location) return null;
  return sections.find(section => section.id === location.sectionId)
    ?? sections.find(section => section.chapterId === location.chapterId)
    ?? null;
}
