import { parseFragment } from "parse5";
import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { normalizeImageCrop } from "../../src/lib/storyboard/image-crop";
import { parseDocument, putImageInSlot, type ComicSection, type StoryboardDocument } from "../../src/lib/storyboard/model";
import { renderComicSvg, COMIC_RENDER_VERSION } from "../../src/lib/storyboard/comic-svg";
import { prepareComicPublication } from "../../src/lib/storyboard/comic-publication";

const comic = (): ComicSection => ({ id: "comic", kind: "comic", title: "Frame", src: "/storyboard/sample.png", description: "", imageWidth: 800, imageHeight: 450, topSpace: 240, bottomSpace: 240, background: "#888888", bubbles: [], sounds: [], crop: { scale: 2, x: 50, y: 0 } });
const document = (): StoryboardDocument => ({ schemaVersion: 1, title: "Crop", chapters: [{ id: "chapter", title: "Chapter", sections: [comic(), { id: "images", kind: "images", title: "Images", layout: "single", images: [{ id: "image", src: "/storyboard/sample.png", description: "", slot: 0, crop: { scale: 3, x: -45, y: 60 } }] }] }] });

test("image crops survive serialization for comics and galleries and reset on source replacement", () => {
  const parsed = parseDocument(JSON.parse(JSON.stringify(document())));
  assert.deepEqual(parsed.chapters[0].sections[0], comic());
  const gallery = parsed.chapters[0].sections[1];
  assert.equal(gallery.kind, "images");
  if (gallery.kind !== "images") return;
  assert.deepEqual(gallery.images[0].crop, { scale: 3, x: -45, y: 60 });
  putImageInSlot(gallery, 0, "/storyboard/replacement.png");
  assert.equal(gallery.images[0].crop, undefined);
});

test("zooming out clamps pan to the visible frame and rejects non-finite input", () => {
  assert.deepEqual(normalizeImageCrop({ scale: 1, x: 50, y: -50 }), { scale: 1, x: 0, y: 0 });
  assert.deepEqual(normalizeImageCrop({ scale: 2, x: 1000, y: -1000 }), { scale: 2, x: 50, y: -50 });
  assert.deepEqual(normalizeImageCrop({ scale: Infinity, x: NaN, y: Infinity }), { scale: 1, x: 0, y: 0 });
});

test("published raster crops pan the image while keeping it clipped out of the text spaces", async () => {
  const png = await sharp(Buffer.from('<svg width="800" height="450"><rect width="400" height="450" fill="red"/><rect x="400" width="400" height="450" fill="blue"/></svg>')).png().toBuffer();
  const sample = comic();
  for (const [x, expected] of [[50, [255, 0, 0]], [-50, [0, 0, 255]]] as const) {
    sample.crop = { scale: 2, x, y: 0 };
    const { data, info } = await sharp(Buffer.from(renderComicSvg(sample, `data:image/png;base64,${png.toString("base64")}`))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixel = (px: number, py: number) => [...data.subarray((py * info.width + px) * 3, (py * info.width + px) * 3 + 3)];
    assert.deepEqual(pixel(400, 450), [...expected]);
    assert.deepEqual(pixel(400, 200), [136, 136, 136]);
    assert.deepEqual(pixel(400, 720), [136, 136, 136]);
    assert.equal(info.height, 930);
  }
});

test("a changed comic crop invalidates the cached published raster", () => {
  const previous = document();
  const old = previous.chapters[0].sections[0] as ComicSection;
  old.renderedSrc = "/storyboard-uploads/old.webp";
  old.renderVersion = COMIC_RENDER_VERSION;
  const draft = document();
  assert.equal(prepareComicPublication(draft, previous).renderJobs.length, 0);
  (draft.chapters[0].sections[0] as ComicSection).crop = { scale: 2, x: 0, y: 0 };
  assert.equal(prepareComicPublication(draft, previous).renderJobs.length, 1);
});


test("editor transform handles stay in the root coordinate system outside the cropped image SVG", () => {
  const sample = comic();
  sample.crop = { scale: 3, x: 40, y: -30 };
  const overlay = '<g data-editor-overlay="true"><rect data-handle="resize" x="400" y="40" width="24" height="24"/></g>';
  const fragment = parseFragment(renderComicSvg(sample, sample.src, undefined, undefined, overlay));
  const root = fragment.childNodes[0];
  assert.ok("childNodes" in root);
  const handles = root.childNodes.find(node => "attrs" in node && node.attrs.some(attr => attr.name === "data-editor-overlay"));
  assert.ok(handles, "controls must be a direct child of the composition SVG");
  const image = root.childNodes.find(node => "attrs" in node && node.attrs.some(attr => attr.name === "data-comic-image"));
  assert.ok(image && "childNodes" in image);
  assert.equal(image.childNodes.includes(handles), false);
});
