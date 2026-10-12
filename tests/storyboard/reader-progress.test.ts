import assert from "node:assert/strict";
import { test } from "node:test";
import { parseReaderProgress, readerProgressKey, resolveReaderSection } from "../../src/lib/storyboard/reader-progress";

test("published and live share one reading position while fixed links stay separate", () => {
  assert.equal(readerProgressKey("live"), readerProgressKey("live"));
  assert.notEqual(readerProgressKey("live"), readerProgressKey("snapshot:550e8400-e29b-41d4-a716-446655440000"));
});

test("the older manual bookmark becomes the single saved place and a removed section falls back to its chapter", () => {
  const location = { sectionId: "removed", chapterId: "chapter-2", fraction: 0.65, savedAt: 123 };
  const progress = parseReaderProgress(JSON.stringify({ lastRead: { ...location, sectionId: "auto" }, bookmark: location }));
  assert.deepEqual(progress.lastRead, location);
  assert.deepEqual(resolveReaderSection(progress.lastRead, [
    { id: "first", chapterId: "chapter-1", chapterNumber: 1, title: "001" },
    { id: "replacement", chapterId: "chapter-2", chapterNumber: 2, title: "002" },
  ])?.id, "replacement");
  assert.equal(parseReaderProgress("{bad json").lastRead, null);
  assert.equal(parseReaderProgress(JSON.stringify({ lastRead: { ...location, fraction: "bad" } })).lastRead, null);
});
