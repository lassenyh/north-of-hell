import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { comicHeight, comicImageHeight, fitComicContent, layoutBubbleText, minimumComicSpace, renderComicSvg, updateComicSpace } from "../../src/lib/storyboard/comic-svg";
import { duplicateChapter, parseDocument, type ComicSection, type StoryboardDocument } from "../../src/lib/storyboard/model";

const section = (): ComicSection => ({
  id: "comic-1", kind: "comic", title: "Sample", src: "/storyboard/sample.png",
  description: "A rider at dawn", imageWidth: 1600, imageHeight: 900,
  topSpace: 240, bottomSpace: 260, background: "#888888",
  bubbles: [{ id: "bubble-1", text: "Hello, world!", x: 100, y: 45,
    width: 380, height: 165, tailSide: "bottom", tailX: 320, tailY: 285, fontSize: 36 }],
  sounds: [],
});

test("comic document retains editable source and bubbles, and duplicates get unique IDs", () => {
  const doc: StoryboardDocument = { schemaVersion: 1, title: "Story", chapters: [{ id: "chapter-1", title: "Opening", sections: [section()] }] };
  assert.deepEqual(parseDocument(doc), doc);
  const copy = duplicateChapter(doc.chapters[0]);
  const copiedSection = copy.sections[0];
  assert.equal(copiedSection.kind, "comic");
  if (copiedSection.kind !== "comic") return;
  assert.notEqual(copiedSection.id, doc.chapters[0].sections[0].id);
  assert.notEqual(copiedSection.bubbles[0].id, section().bubbles[0].id);
  assert.equal(copiedSection.src, section().src);
  assert.equal(copiedSection.bubbles[0].text, "Hello, world!");
});

test("comic dimensions keep original image aspect ratio inside the composed strip", () => {
  const sample = section();
  assert.equal(comicImageHeight(sample), 450);
  assert.equal(comicHeight(sample), 950);
  const svg = renderComicSvg(sample);
  assert.match(svg, /width="800" height="950"/);
  assert.match(svg, /<image[^>]+y="240"[^>]+width="800" height="450"/);
});

test("comic image frame can switch between wide and tall without stretching the source or clipping dialogue", () => {
  const sample = section();
  sample.aspect = "9:16";
  assert.equal(comicImageHeight(sample), 1422);
  assert.match(renderComicSvg(sample), /<image[^>]+height="1422" preserveAspectRatio="xMidYMid slice"/);
  sample.bubbles[0].y = 1450;
  const originalBubble = structuredClone(sample.bubbles[0]);
  sample.aspect = "16:9";
  fitComicContent(sample);
  assert.equal(comicImageHeight(sample), 450);
  assert.deepEqual(sample.bubbles[0], originalBubble);
  assert.ok(comicHeight(sample) >= originalBubble.y + originalBubble.height);
  const doc: StoryboardDocument = { schemaVersion: 1, title: "Story", chapters: [{ id: "chapter-1", title: "Opening", sections: [sample] }] };
  assert.deepEqual(parseDocument(doc), doc);
});

test("changing comic spacing never shifts a bubble, its tail, or a sound effect", () => {
  const sample = section();
  sample.sounds.push({ id: "sound-1", text: "PAT", x: 250, y: 300, fontSize: 72, rotation: 0, color: "#222222" });
  sample.renderedSrc = "/storyboard/rendered.png";
  const bubble = structuredClone(sample.bubbles[0]);
  const sound = structuredClone(sample.sounds[0]);
  updateComicSpace(sample, "above", 180);
  assert.equal(sample.topSpace, 180, "image edge can pass the bubble without moving it");
  assert.deepEqual(sample.bubbles[0], bubble);
  assert.deepEqual(sample.sounds[0], sound);
  assert.equal(sample.renderedSrc, undefined);

  sample.bubbles[0].y = 640;
  sample.bubbles[0].tailY = 850;
  const lowerBubble = structuredClone(sample.bubbles[0]);
  const minimum = minimumComicSpace(sample, "below");
  updateComicSpace(sample, "below", 0);
  assert.equal(sample.bottomSpace, minimum, "canvas stops shrinking before clipping the tail");
  assert.deepEqual(sample.bubbles[0], lowerBubble);
  assert.deepEqual(sample.sounds[0], sound);
});

test("comic dialogue is escaped, text layout reports overflow, and rasterization succeeds", async () => {
  const sample = section();
  sample.bubbles[0].text = "A <B> & C";
  assert.match(renderComicSvg(sample), /A &lt;B&gt; &amp; C/);
  assert.equal(layoutBubbleText(sample.bubbles[0]).fits, true);
  sample.bubbles[0].text = "A very long line of dialogue ".repeat(80);
  assert.equal(layoutBubbleText(sample.bubbles[0]).fits, false);
  sample.bubbles[0].text = "Hello, world!";
  const pixel = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#cc5533" } }).png().toBuffer();
  const svg = renderComicSvg(sample, `data:image/png;base64,${pixel.toString("base64")}`);
  const output = await sharp(Buffer.from(svg)).webp().toBuffer();
  const info = await sharp(output).metadata();
  assert.equal(info.format, "webp");
  assert.equal(info.width, 800);
  assert.equal(info.height, 950);
});

test("comic parser rejects unsafe sources and duplicate bubble IDs", () => {
  const doc = { schemaVersion: 1, title: "Story", chapters: [{ id: "chapter-1", title: "Opening", sections: [section()] }] };
  doc.chapters[0].sections[0].src = "https://evil.example/test.png";
  assert.throws(() => parseDocument(doc), /Invalid comic image URL/);
  doc.chapters[0].sections[0].src = "/storyboard/sample.png";
  doc.chapters[0].sections[0].bubbles.push({ ...section().bubbles[0] });
  assert.throws(() => parseDocument(doc), /duplicate ID/);
});

test("speech balloon and tail share one outline; sound lettering is editable and escapes markup", () => {
  const sample = section();
  sample.sounds.push({ id: "sound-1", text: "NEIGH <LOUD>", x: 250, y: 245, fontSize: 84, rotation: -18, color: "#222222" });
  const svg = renderComicSvg(sample);
  const balloon = svg.match(/<g data-bubble-id="bubble-1">(.*?)<\/g>/)?.[1] ?? "";
  assert.equal((balloon.match(/<path [^>]*fill="#fff"/g) ?? []).length, 1);
  assert.match(balloon, /L 320 285 L/);
  assert.doesNotMatch(balloon, / Q /);
  assert.match(svg, /font-family="Jack Armstrong, sans-serif"/);
  assert.match(svg, /data-sound-id="sound-1" transform="translate\(250 245\) rotate\(-18\)"/);
  assert.match(svg, /NEIGH &lt;LOUD&gt;/);
  const doc: StoryboardDocument = { schemaVersion: 1, title: "Story", chapters: [{ id: "chapter-1", title: "Opening", sections: [sample] }] };
  assert.deepEqual(parseDocument(doc), doc);
  const duplicate = duplicateChapter(doc.chapters[0]).sections[0];
  assert.equal(duplicate.kind, "comic");
  if (duplicate.kind === "comic") assert.notEqual(duplicate.sounds[0].id, sample.sounds[0].id);
});

test("sound outline can be enabled, colored and turned off without changing text color", async () => {
  const sample = section();
  sample.sounds.push({ id: "sound-outline", text: "PAT", x: 250, y: 245, fontSize: 72, rotation: 0, color: "#121212", outlineEnabled: true, outlineColor: "#eeeeee", outlineWidth: 6 });
  const outlined = renderComicSvg(sample);
  assert.match(outlined, /fill="#121212" stroke="#eeeeee" stroke-width="6" stroke-linejoin="round" paint-order="stroke fill"/);
  const image = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#888888" } }).png().toBuffer();
  const raster = await sharp(Buffer.from(renderComicSvg(sample, `data:image/png;base64,${image.toString("base64")}`))).png().toBuffer();
  assert.equal((await sharp(raster).metadata()).width, 800);
  const doc: StoryboardDocument = { schemaVersion: 1, title: "Story", chapters: [{ id: "chapter-1", title: "Opening", sections: [sample] }] };
  assert.deepEqual(parseDocument(doc), doc);
  sample.sounds[0].outlineEnabled = false;
  const plain = renderComicSvg(sample);
  assert.doesNotMatch(plain, /stroke="#eeeeee"/);
  assert.match(plain, /fill="#121212"/);
});

test("each tail joins the balloon perimeter without a returning hook", () => {
  const tips = { top: [320, 5], right: [550, 140], bottom: [320, 285], left: [20, 140] } as const;
  for (const [side, [tailX, tailY]] of Object.entries(tips)) {
    const sample = section();
    Object.assign(sample.bubbles[0], { tailSide: side, tailX, tailY });
    const svg = renderComicSvg(sample);
    const outline = svg.match(/<g data-bubble-id="bubble-1"><path d="([^"]+)" fill="#fff"/)?.[1] ?? "";
    assert.equal((outline.match(/ L /g) ?? []).length, 2, `${side} tail has exactly two straight edges`);
    assert.match(outline, new RegExp(`L ${tailX} ${tailY} L`));
    assert.doesNotMatch(outline, / Q /);
  }
});

test("older comic sections without sound effects still load", () => {
  const oldSection: Record<string, unknown> = { ...section() };
  delete oldSection.sounds;
  const loaded = parseDocument({ schemaVersion: 1, title: "Story", chapters: [{ id: "chapter-1", title: "Opening", sections: [oldSection] }] });
  const comic = loaded.chapters[0].sections[0];
  assert.equal(comic.kind, "comic");
  if (comic.kind === "comic") assert.deepEqual(comic.sounds, []);
});
