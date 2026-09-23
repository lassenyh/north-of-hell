/** Video files under `public/` (served at site root). */

export const PUBLIC_LOCATION_VIDEO =
  process.env.NEXT_PUBLIC_LOCATION_VIDEO_URL ??
  "https://x0dukux6lgcczd6v.public.blob.vercel-storage.com/location/NOH_LOCATION_WEB_2.mp4";

/** Under `public/storyboard/10 CAMP FIRE STORY/` (URL-encoded path). */
export const PUBLIC_FISHING_STORM_ANIMATIC =
  "/storyboard/10%20CAMP%20FIRE%20STORY/NOH_FISHINGSTORM_ANIMATICS.mp4";

/** Keynote moodfilm, streamed from Vercel Blob. */
export const PUBLIC_KEYNOTE_FILM =
  "https://x0dukux6lgcczd6v.public.blob.vercel-storage.com/introfilm/NOH_MOODFILM_WIP_230926_WEB.mp4";
