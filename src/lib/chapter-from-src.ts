/**
 * Plukker ut kapittelmappenavn fra bildesti, både lokale (/storyboard/…) og full URL.
 */
export function getChapterFolderFromImageSrc(src: string): string {
  if (!src || typeof src !== "string") return "";

  let path = src.trim();
  try {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      path = new URL(path).pathname;
    }
  } catch {
    /* bruk src som den er */
  }

  const normalized = decodeURIComponent(path).replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const i = parts.findIndex((p) => p.toLowerCase() === "storyboard");
  if (i >= 0 && parts[i + 1]) {
    return parts[i + 1].trim();
  }

  return "";
}
