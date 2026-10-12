import test from "node:test";
import assert from "node:assert/strict";
import { storyboardAssetSources, validStoryboardShareId } from "../../src/lib/storyboard/share";
import type { StoryboardDocument } from "../../src/lib/storyboard/model";

test("fixed share snapshots retain every referenced media asset", () => {
  const document: StoryboardDocument = { schemaVersion: 1, title: "Storyboard", chapters: [{ id: "chapter", title: "One", sections: [
    { id: "images", kind: "images", title: "Images", layout: "1x2", images: [{ id: "one", src: "/one.png", description: "", slot: 0 }, { id: "two", src: "/two.png", description: "", slot: 1 }] },
    { id: "comic", kind: "comic", title: "Comic", src: "/one.png", renderedSrc: "/rendered.webp", renderVersion: 5, description: "", imageWidth: 800, imageHeight: 450, topSpace: 240, bottomSpace: 240, background: "#000000", bubbles: [], sounds: [] },
    { id: "video", kind: "video", title: "Video", src: "/scene.mp4" },
  ] }] };
  assert.deepEqual(storyboardAssetSources(document), ["/one.png", "/two.png", "/rendered.webp", "/scene.mp4"]);
});

test("share snapshot IDs accept only generated UUIDs", () => {
  assert.equal(validStoryboardShareId("a6076901-51eb-4a93-b830-96ca48ae34c9"), true);
  assert.equal(validStoryboardShareId("../../storyboard-state.json"), false);
});
