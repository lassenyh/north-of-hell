export type ImageCrop = { scale: number; x: number; y: number };

export function normalizeImageCrop(value?: Partial<ImageCrop> | null): ImageCrop {
  const finite = (n: unknown, fallback: number) => typeof n === "number" && Number.isFinite(n) ? n : fallback;
  const scale = Math.min(4, Math.max(1, finite(value?.scale, 1)));
  if (scale === 1) return { scale: 1, x: 0, y: 0 };
  const limit = (scale - 1) * 50;
  return { scale, x: Math.min(limit, Math.max(-limit, finite(value?.x, 0))), y: Math.min(limit, Math.max(-limit, finite(value?.y, 0))) };
}

export function imageCropStyle(value?: ImageCrop) {
  const crop = normalizeImageCrop(value);
  return { transform: `translate(${crop.x}%, ${crop.y}%) scale(${crop.scale})`, transformOrigin: "center" };
}
