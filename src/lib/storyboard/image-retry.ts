// Two automatic retries per image, then wait for an explicit user action.
export const IMAGE_RETRY_DELAYS = [1000, 3000] as const;

export function imageRetrySource(src: string, token: string) {
  if (!token || /^(data:|blob:)/i.test(src)) return src;
  const hashIndex = src.indexOf("#");
  const path = hashIndex < 0 ? src : src.slice(0, hashIndex);
  const hash = hashIndex < 0 ? "" : src.slice(hashIndex);
  return `${path}${path.includes("?") ? "&" : "?"}sb_image_retry=${encodeURIComponent(token)}${hash}`;
}
