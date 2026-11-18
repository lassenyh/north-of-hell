import test from "node:test";
import assert from "node:assert/strict";
import { IMAGE_RETRY_DELAYS, imageRetrySource } from "../../src/lib/storyboard/image-retry";

test("image retries are bounded and use a different public URL without dropping existing parameters or fragments", () => {
  assert.deepEqual([...IMAGE_RETRY_DELAYS], [1000, 3000]);
  const src = "https://project.supabase.co/storage/v1/object/public/storyboard-images/comic.webp?download=frame.webp#image";
  assert.equal(imageRetrySource(src, ""), src);
  const first = new URL(imageRetrySource(src, "first"));
  const second = new URL(imageRetrySource(src, "second"));
  assert.equal(first.searchParams.get("download"), "frame.webp");
  assert.equal(first.hash, "#image");
  assert.notEqual(first.href, second.href);
  assert.equal(first.pathname, second.pathname);
  assert.equal(imageRetrySource("/storyboard/frame.png", "1"), "/storyboard/frame.png?sb_image_retry=1");
});

test("inline and blob images are remounted without corrupting their URLs", () => {
  assert.equal(imageRetrySource("data:image/png;base64,abc", "1"), "data:image/png;base64,abc");
  assert.equal(imageRetrySource("blob:https://example.com/image", "1"), "blob:https://example.com/image");
});
