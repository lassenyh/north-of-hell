import test from "node:test";
import assert from "node:assert/strict";
import { prepareComicPublication, renderComicJobs } from "../../src/lib/storyboard/comic-publication";
import type { ComicSection, StoryboardDocument } from "../../src/lib/storyboard/model";

function comic(id: string): ComicSection {
  return {
    id, kind: "comic", title: id, src: `/storyboard/${id}.png`, description: "",
    imageWidth: 800, imageHeight: 450, topSpace: 240, bottomSpace: 240,
    background: "#000000", bubbles: [{ id: `${id}-bubble`, text: "HELLO", x: 100, y: 40,
      width: 400, height: 170, tailSide: "bottom", tailX: 300, tailY: 275, fontSize: 36 }], sounds: [],
  };
}
function document(...sections: ComicSection[]): StoryboardDocument {
  return { schemaVersion: 1, title: "Storyboard", chapters: [{ id: "chapter", title: "Chapter", sections }] };
}

test("publication reuses finished comics after metadata edits but renders changed dialogue", () => {
  const old = comic("first");
  old.renderedSrc = "/storyboard-uploads/first.webp";
  old.renderVersion = 5;
  old.imageWidth = 1600;
  old.imageHeight = 900;
  const changed = comic("second");
  changed.renderedSrc = "/storyboard-uploads/second.webp";
  changed.renderVersion = 5;
  const draftFirst = comic("first");
  draftFirst.title = "Renamed";
  draftFirst.description = "New alt text";
  const draftSecond = comic("second");
  draftSecond.bubbles[0].text = "NEW DIALOGUE";
  const draft = document(draftFirst, draftSecond);

  const { published, renderJobs } = prepareComicPublication(draft, document(old, changed));
  assert.deepEqual(renderJobs.map(section => section.id), ["second"]);
  const reused = published.chapters[0].sections[0];
  assert.equal(reused.kind, "comic");
  if (reused.kind !== "comic") return;
  assert.equal(reused.title, "Renamed");
  assert.equal(reused.description, "New alt text");
  assert.equal(reused.renderedSrc, old.renderedSrc);
  assert.equal(reused.imageWidth, 1600);
  assert.equal(draftFirst.renderedSrc, undefined, "planning does not modify the saved draft");
});

test("comic publication limits parallel renders and keeps each result with its section", async () => {
  const jobs = Array.from({ length: 5 }, (_, index) => comic(`comic-${index}`));
  let active = 0;
  let maximum = 0;
  await renderComicJobs(jobs, async section => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return { src: `/rendered/${section.id}.webp`, imageWidth: 1200, imageHeight: 675 };
  });
  assert.equal(maximum, 2);
  assert.deepEqual(jobs.map(section => section.renderedSrc), jobs.map(section => `/rendered/${section.id}.webp`));
  assert.ok(jobs.every(section => section.renderVersion === 5 && section.imageWidth === 1200));
});

test("publication finds text overflow before scheduling any image rendering", () => {
  const invalid = comic("later-section");
  invalid.bubbles[0].text = "VERY LONG DIALOGUE ".repeat(50);
  assert.throws(() => prepareComicPublication(document(comic("first"), invalid), null), /later-section/);
});
