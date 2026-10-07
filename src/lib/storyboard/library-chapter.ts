export function libraryChapter(src: string) {
  const marker = "/library/";
  const index = src.indexOf(marker);
  if (index >= 0) {
    const key = src.slice(index + marker.length).split("/")[0];
    try { return new TextDecoder().decode(Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), character => character.charCodeAt(0))) || "Other"; }
    catch { return "Other"; }
  }
  try { return decodeURIComponent(src.split("/")[2] || "Other"); }
  catch { return "Other"; }
}
