import { join } from "node:path";

export const storyboardLocalMode = process.env.NODE_ENV !== "production" && process.env.STORYBOARD_REVIEW_MODE === "local";

export function localStoryboardUpload(filename: string) {
  const subdir = storyboardLocalMode && /^[a-z0-9-]{1,50}$/i.test(process.env.STORYBOARD_LOCAL_UPLOAD_SUBDIR || "")
    ? process.env.STORYBOARD_LOCAL_UPLOAD_SUBDIR! : "";
  return {
    directory: join(process.cwd(), "public", "storyboard-uploads", subdir),
    src: `/storyboard-uploads/${subdir ? `${subdir}/` : ""}${filename}`,
  };
}
