import test from "node:test";
import assert from "node:assert/strict";
import { duplicateChapter, importLegacyFrames, moveImageToSlot, parseDocument, putImageInSlot, safeImageSource, type StoryboardDocument } from "../../src/lib/storyboard/model";
import { nextBlockAfterEnter, nextBlockAfterTab } from "../../src/components/screenplay/ScreenplayExtensions";
import { SCREENPLAY_ELEMENT_OPTIONS } from "../../src/components/screenplay/ScreenplayExtensions";
import { SCREENPLAY_BLOCK_TYPES, parseScreenplayBlocks, stringifyScreenplayBlocks } from "../../src/lib/screenplay-json";
import { collectSmartTypeLists, matchSmartType, sceneHeadingTabInsertion } from "../../src/lib/screenplay-smarttype";
import { lineToEditorInnerHtml } from "../../src/lib/manuscript-html";
import { sanitizeHtml } from "../../src/lib/safe-html";
import { createAdminSession, getAdminSessionId } from "../../src/lib/supabase/admin-session";
import { parsePlainTextScreenplay, parseScreenplayPaste } from "../../src/lib/screenplay-paste";

test("legacy frames become ordered chapters and independent image/manus sections", () => {
  const frames = [
    { id: "1", project_slug: "north-of-hell", frame_order: 1, image_src: "/storyboard/01 OPENING/a.png", text: "INT. HUT - NIGHT", updated_at: "" },
    { id: "2", project_slug: "north-of-hell", frame_order: 2, image_src: "/storyboard/01 OPENING/b.png", text: "", updated_at: "" },
    { id: "3", project_slug: "north-of-hell", frame_order: 3, image_src: "/storyboard/02 ROAD/a.png", text: "", updated_at: "" },
  ];
  const document = importLegacyFrames(frames);
  assert.deepEqual(document.chapters.map(c => c.title), ["OPENING", "ROAD"]);
  assert.deepEqual(document.chapters[0].sections.map(s => s.kind), ["images", "screenplay", "images"]);
  assert.equal(document.chapters[0].sections[0].kind, "images");
  if (document.chapters[0].sections[0].kind === "images") assert.equal(document.chapters[0].sections[0].images[0].src, frames[0].image_src);
  assert.deepEqual(importLegacyFrames(frames), document, "IDs remain stable across imports");
});

test("duplicated chapters receive unique chapter, section and image IDs", () => {
  const original = importLegacyFrames([{ id: "x", project_slug: "north-of-hell", frame_order: 1, image_src: "/storyboard/01 TEST/a.png", text: "", updated_at: "" }]).chapters[0];
  const copy = duplicateChapter(original);
  assert.notEqual(copy.id, original.id);
  assert.notEqual(copy.sections[0].id, original.sections[0].id);
  if (copy.sections[0].kind === "images" && original.sections[0].kind === "images") assert.notEqual(copy.sections[0].images[0].id, original.sections[0].images[0].id);
});

test("document parsing rejects duplicate IDs and unsafe image URLs", () => {
  const document: StoryboardDocument = { schemaVersion: 1, title: "Test", chapters: [{ id: "ch", title: "One", sections: [{ id: "section", kind: "images", title: "Images", layout: "single", images: [{ id: "image", src: "/storyboard/a.png", description: "", slot: 0 }] }] }] };
  assert.deepEqual(parseDocument(document), document);
  assert.equal(safeImageSource("javascript:alert(1)"), false);
  assert.equal(safeImageSource("//evil.example/a.png"), false);
  assert.equal(safeImageSource("/storyboard/../secret"), false);
  const duplicate = structuredClone(document); duplicate.chapters[0].sections[0].id = "ch";
  assert.throws(() => parseDocument(duplicate), /duplicate ID/);
});

test("older default section labels display in English without changing authored text", () => {
  const document: StoryboardDocument = { schemaVersion: 1, title: "Test", chapters: [{ id: "chapter", title: "Nytt kapittel", sections: [
    { id: "old-default", kind: "text", title: "Ny tekstseksjon", html: "<p></p>", align: "left", size: 16 },
    { id: "authored", kind: "text", title: "Ut på tur", html: "<p>Text</p>", align: "left", size: 16 },
  ] }] };
  const parsed = parseDocument(document);
  assert.equal(parsed.chapters[0].title, "New chapter");
  assert.equal(parsed.chapters[0].sections[0].title, "New text section");
  assert.equal(parsed.chapters[0].sections[1].title, "Ut på tur");
});

test("fixed image slots preserve placement and descriptions through swaps", () => {
  const section: Extract<StoryboardDocument["chapters"][number]["sections"][number], { kind: "images" }> = { id: "images", kind: "images", title: "Images", layout: "2x2", images: [] };
  putImageInSlot(section, 3, "/storyboard/four.png");
  putImageInSlot(section, 0, "/storyboard/one.png");
  assert.deepEqual(section.images.map(image => image.slot), [0, 3]);
  section.images[1].description = "Fourth slot";
  const fourthId = section.images[1].id;
  moveImageToSlot(section, fourthId, 0);
  assert.deepEqual(section.images.map(image => [image.slot, image.src]), [[0, "/storyboard/four.png"], [3, "/storyboard/one.png"]]);
  assert.equal(section.images[0].description, "Fourth slot");
  putImageInSlot(section, 0, "/storyboard/replacement.png");
  assert.equal(section.images[0].id, fourthId);
  assert.equal(section.images[0].description, "Fourth slot");

  const legacy = { schemaVersion: 1, title: "Old", chapters: [{ id: "chapter", title: "Old", sections: [{ id: "section", kind: "images", title: "Old", layout: "2x2", images: [{ id: "old-image", src: "/storyboard/old.png", description: "" }] }] }] };
  const migrated = parseDocument(legacy);
  const oldSection = migrated.chapters[0].sections[0];
  if (oldSection.kind === "images") assert.equal(oldSection.images[0].slot, 0);
});

test("one-row two-image layout keeps both slots when saved", () => {
  const document: StoryboardDocument = { schemaVersion: 1, title: "Two images", chapters: [{ id: "chapter", title: "One", sections: [{
    id: "images", kind: "images", title: "Pair", layout: "1x2", images: [
      { id: "left", src: "/storyboard/left.png", description: "Left", slot: 0 },
      { id: "right", src: "/storyboard/right.png", description: "Right", slot: 1 },
    ],
  }] }] };
  assert.deepEqual(parseDocument(document), document);
  const invalid = structuredClone(document);
  if (invalid.chapters[0].sections[0].kind === "images") invalid.chapters[0].sections[0].images[1].slot = 2;
  assert.throws(() => parseDocument(invalid), /image slot/);
});

test("screenplay transitions match six documented elements", () => {
  assert.equal(nextBlockAfterEnter("scene_heading"), "action");
  assert.equal(nextBlockAfterEnter("character"), "dialogue");
  assert.equal(nextBlockAfterEnter("parenthetical"), "dialogue");
  assert.equal(nextBlockAfterEnter("transition"), "scene_heading");
  assert.equal(nextBlockAfterTab("action", false), "character");
  assert.equal(nextBlockAfterTab("character", false), "parenthetical");
  assert.equal(nextBlockAfterTab("character", true), "transition");
  assert.equal(nextBlockAfterTab("dialogue", false), "parenthetical");
});

test("all Elements choices have unique keys and survive storage and document validation", () => {
  assert.deepEqual(SCREENPLAY_ELEMENT_OPTIONS.map(({ key, label }) => `[${key}] ${label}`), [
    "[G] General", "[S] Scene Heading", "[A] Action", "[C] Character",
    "[P] Parenthetical", "[D] Dialogue", "[T] Transition", "[H] Shot",
    "[L] Cast List", "[N] New Act", "[Q] Sequence", "[E] End of Act",
    "[O] Summary", "[1] Outline 1", "[2] Outline 2", "[3] Outline 3", "[4] Note",
  ]);
  assert.equal(new Set(SCREENPLAY_ELEMENT_OPTIONS.map(item => item.key)).size, 17);
  assert.deepEqual(SCREENPLAY_ELEMENT_OPTIONS.map(item => item.type), [...SCREENPLAY_BLOCK_TYPES]);
  const blocks = SCREENPLAY_ELEMENT_OPTIONS.map(item => ({ type: item.type, text: "Sample" }));
  const document: StoryboardDocument = { schemaVersion: 1, title: "All Elements", chapters: [{ id: "ch", title: "Chapter", sections: [{ id: "sec", kind: "screenplay", title: "Scene", blocks }] }] };
  assert.deepEqual(parseDocument(document), document);
  assert.deepEqual(parseScreenplayBlocks(stringifyScreenplayBlocks(blocks)).map(block => block.type), blocks.map(block => block.type));
  assert.equal(nextBlockAfterEnter("general"), "general");
  assert.equal(nextBlockAfterEnter("shot"), "action");
  assert.equal(nextBlockAfterEnter("end_of_act"), "new_act");
  assert.equal(nextBlockAfterEnter("outline_1"), "summary");
  assert.equal(nextBlockAfterTab("outline_1", false), "outline_2");
  assert.equal(nextBlockAfterTab("outline_2", false), "outline_3");
});

test("SmartType learns screenplay entries and offers the correct scene-heading field", () => {
  const lists = collectSmartTypeLists([
    { type: "scene_heading", text: "INT. HOME OFFICE - NIGHT" },
    { type: "scene_heading", text: "EXT. BEACH - MAGIC HOUR" },
    { type: "character", text: "MARA (V.O.)" },
    { type: "transition", text: "SMASH CUT TO:" },
  ]);
  assert.ok(lists.location.includes("HOME OFFICE"));
  assert.ok(lists.time.includes("MAGIC HOUR"));
  assert.deepEqual(matchSmartType("scene_heading", "INT. HO", lists)?.items, ["HOME OFFICE"]);
  assert.equal(matchSmartType("scene_heading", "INT. HOME OFFICE - ", lists)?.kind, "time");
  assert.deepEqual(matchSmartType("scene_heading", "INT. HOME OFFICE - N", lists)?.items, ["NIGHT"]);
  assert.deepEqual(matchSmartType("character", "MA", lists)?.items, ["MARA"]);
  assert.deepEqual(matchSmartType("character", "MARA (V", lists)?.items, ["(V.O.)"]);
  assert.deepEqual(matchSmartType("transition", "SMA", lists)?.items, ["SMASH CUT TO:"]);
});

test("Tab builds scene intro and time separator without duplicating punctuation", () => {
  assert.equal(sceneHeadingTabInsertion("INT"), ". ");
  assert.equal(sceneHeadingTabInsertion("INT."), " ");
  assert.equal(sceneHeadingTabInsertion("INT. "), "");
  assert.equal(sceneHeadingTabInsertion("INT. HOME OFFICE"), " - ");
  assert.equal(sceneHeadingTabInsertion("INT. HOME OFFICE - "), "");
  assert.equal(sceneHeadingTabInsertion("INT. HOME OFFICE - NIGHT"), null);
});

test("inline manuscript emphasis remains safe and visible in read view", () => {
  assert.equal(lineToEditorInnerHtml("<strong>LOUD</strong> <u>now</u>"), "<strong>LOUD</strong> <u>now</u>");
  assert.equal(lineToEditorInnerHtml("<u>now</u><script>alert(1)</script>"), "<u>now</u>");
});

test("published rich text keeps formatting while discarding executable markup", () => {
  const html = '<p onclick="alert(1)">Hello <strong>world</strong><img src="x" onerror="alert(2)"><script>alert(3)</script><svg><a href="javascript:alert(4)">bad</a></svg></p>';
  assert.equal(sanitizeHtml(html, { tags: ["p", "strong"] }), "<p>Hello <strong>world</strong></p>");
  assert.equal(sanitizeHtml('<span style="font-weight:bold;background:url(https://example.com/x)" class="scene-heading" onclick="bad()">SCENE</span>', {
    tags: ["span"], attributes: ["style", "class"],
  }), '<span style="font-weight:bold" class="scene-heading">SCENE</span>');
});

test("admin sessions reject forged and expired cookies", () => {
  const id = "a17443bd-e677-4ff4-9b1b-3dbbe538718d";
  const session = createAdminSession(id);
  assert.equal(getAdminSessionId(session), id);
  assert.equal(getAdminSessionId(id), null);
  assert.equal(getAdminSessionId(session.replace(id, "b17443bd-e677-4ff4-9b1b-3dbbe538718d")), null);
  assert.equal(getAdminSessionId(session, Date.now() + 8 * 24 * 60 * 60 * 1000), null);
});

test("Final Draft-style copied text becomes ordered screenplay elements", () => {
  const copied = [
    "INT. HOME OFFICE - DAY", "", "BOOM UP TO REVEAL the room.",
    "Mossy enters and sits down.", "",
    "                         MOSSY", "                Alone at last",
    "                  (Sees tangle)", "                What are you?",
    "                NO!", "",
    "                         TANGLE", "                Nothing", "",
    "CUT TO:", "EXT. BEACH - NIGHT",
  ].join("\r\n");
  const blocks = parsePlainTextScreenplay(copied);
  assert.deepEqual(blocks.map(block => block.type), [
    "scene_heading", "action", "character", "dialogue", "parenthetical",
    "dialogue", "character", "dialogue", "transition", "scene_heading",
  ]);
  assert.equal(blocks[1].text, "BOOM UP TO REVEAL the room.\nMossy enters and sits down.");
  assert.equal(blocks[5].text, "What are you?\nNO!");
  assert.deepEqual(parseScreenplayPaste(copied, null), blocks);
});
