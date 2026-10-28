import test from "node:test";
import assert from "node:assert/strict";
import { createComicSection, insertComicImages } from "../../src/lib/storyboard/comic-insert";
import { parseDocument, type StoryboardDocument } from "../../src/lib/storyboard/model";

const document = (): StoryboardDocument => ({ schemaVersion: 1, title: "Batch", chapters: [{ id: "chapter", title: "Chapter", sections: [] }, { id: "next", title: "Next", sections: [] }] });

test("single and batch comic sections use the same defaults with independent content", () => {
  const single = createComicSection();
  const doc = document();
  const sections = insertComicImages(doc, "chapter", ["/storyboard/01.png", "/storyboard/02.png"]);
  for (const section of [single, ...sections]) {
    assert.equal(section.topSpace, 200);
    assert.equal(section.bottomSpace, 0);
    assert.equal(section.aspect, "16:9");
    assert.equal(section.background, "#000000");
    assert.deepEqual(section.bubbles, []);
    assert.deepEqual(section.sounds, []);
  }
  assert.notEqual(sections[0].id, sections[1].id);
  assert.notEqual(sections[0].bubbles, sections[1].bubbles);
  assert.deepEqual(parseDocument(JSON.parse(JSON.stringify(doc))), doc);
});

test("batch preserves image order, inserts after a chosen section and shifts following numbers", () => {
  const doc = document();
  const first = createComicSection(); first.title = "0001";
  const following = createComicSection(); following.title = "0002";
  const nextChapter = createComicSection(); nextChapter.title = "0003";
  doc.chapters[0].sections = [first, following]; doc.chapters[1].sections = [nextChapter];
  const added = insertComicImages(doc, "chapter", ["/storyboard/10.png", "/storyboard/02.png"], first.id);
  assert.deepEqual(doc.chapters[0].sections.map(section => section.id), [first.id, ...added.map(section => section.id), following.id]);
  assert.deepEqual(added.map(section => section.src), ["/storyboard/10.png", "/storyboard/02.png"]);
  assert.deepEqual(doc.chapters.flatMap(chapter => chapter.sections.map(section => section.title)), ["0001", "0002", "0003", "0004", "0005"]);
});

test("batch validates all sources and insertion limits before changing the draft", () => {
  const doc = document();
  const original = JSON.stringify(doc);
  assert.throws(() => insertComicImages(doc, "chapter", ["/storyboard/01.png", "javascript:alert(1)"]));
  assert.throws(() => insertComicImages(doc, "missing", ["/storyboard/01.png"]));
  assert.throws(() => insertComicImages(doc, "chapter", ["/storyboard/01.png"], "removed"));
  assert.throws(() => insertComicImages(doc, "chapter", []));
  assert.equal(JSON.stringify(doc), original);
  doc.chapters[0].sections = Array.from({ length: 499 }, () => createComicSection());
  assert.throws(() => insertComicImages(doc, "chapter", ["/storyboard/01.png", "/storyboard/02.png"]), /room for 1/);
  assert.equal(doc.chapters[0].sections.length, 499);
});
