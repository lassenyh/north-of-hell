import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SEED_DECK,
  insertSlide,
  moveSlide,
  parseDeck,
  plainTextDoc,
} from "../../src/lib/keynote/model";
import { SaveQueue, type SaveResult } from "../../src/lib/keynote/save-queue";
import { database, asRole, EDITOR, OUTSIDER, migration } from "./database";

test("six slides preserve IDs, content, emphasis, independent intro and start", () => {
  const d = parseDeck(SEED_DECK, true);
  assert.deepEqual(
    d.slides.map((s) => s.name),
    ["Title", "Logline", "Film", "Genre & Tone", "Synopsis 1", "Synopsis 2"],
  );
  const moved = moveSlide(d, "logline", 5);
  assert.equal(moved.startSlideId, "logline");
  assert.equal(moved.slides[5].id, "logline");
  assert.deepEqual(moved.intro, { type: "title", durationMs: 2000 });
  const inserted = insertSlide(moved, "logline", {
    id: "copy",
    name: "Copy",
    type: "title",
  });
  assert.equal(inserted.slides[6].id, "copy");
  assert.throws(() => parseDeck({ ...d, slides: [] }, true));
  assert.throws(() =>
    parseDeck(
      { ...d, slides: d.slides.filter((s) => s.id !== "logline") },
      true,
    ),
  );
  assert.doesNotThrow(() => parseDeck({ ...d, slides: [] }));
});

test("validation rejects executable content, unknown attributes, marks, duplicate IDs", () => {
  for (const body of [
    { type: "doc", content: [{ type: "html", text: "<script/>" }] },
    {
      type: "doc",
      content: [{ type: "paragraph", attrs: { style: "color:red" } }],
    },
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "link",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    },
  ]) {
    assert.throws(() =>
      parseDeck({
        ...SEED_DECK,
        slides: [{ id: "x", name: "x", type: "text", layout: "short", body }],
      }),
    );
  }
  assert.throws(() =>
    parseDeck({
      ...SEED_DECK,
      slides: [SEED_DECK.slides[0], SEED_DECK.slides[0]],
    }),
  );
  assert.equal(plainTextDoc("a\r\nb").content.length, 2);
});

test("serialized saves retain edits made during a slow response and use acknowledged version", async () => {
  let resolve!: (result: SaveResult) => void;
  const calls: number[] = [];
  const q = new SaveQueue(
    SEED_DECK,
    1,
    (_d, v) => {
      calls.push(v);
      return new Promise((r) => {
        resolve = r;
      });
    },
    () => {},
  );
  q.edit({ ...SEED_DECK, startSlideId: "title" });
  const saving = q.flush();
  await new Promise((r) => setTimeout(r, 0));
  q.edit({ ...SEED_DECK, startSlideId: "film" });
  assert.equal(q.flush(), saving);
  resolve({ ok: true, version: 2 });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(calls, [1, 2]);
  assert.equal(q.document.startSlideId, "film");
  resolve({ ok: true, version: 3 });
  assert.equal(await saving, true);
  assert.equal(q.dirty, false);
  assert.equal(q.version, 3);
});

test("failed saves retain draft; conflicts never retry blindly", async () => {
  let attempts = 0;
  const q = new SaveQueue(
    SEED_DECK,
    1,
    async () => {
      attempts++;
      return attempts === 1
        ? { ok: false, error: "offline" }
        : { ok: false, conflict: true, error: "conflict" };
    },
    () => {},
  );
  q.edit({ ...SEED_DECK, startSlideId: "film" });
  assert.equal(await q.flush(), false);
  assert.equal(q.dirty, true);
  await q.flush();
  assert.equal(attempts, 1);
  await q.flush(true);
  assert.equal(q.status, "conflict");
  await q.flush(true);
  assert.equal(attempts, 2);
  assert.equal(q.document.startSlideId, "film");
});

test("actual Postgres migration: RLS, atomic publish, conflicts, immutable history and restore", async () => {
  const db = await database();
  const editor = <T>(fn: Parameters<typeof asRole<T>>[3]) =>
    asRole(db, "authenticated", EDITOR, fn);
  try {
    const original = (
      await db.query<{ document: unknown }>(
        "select document from keynote_revisions",
      )
    ).rows[0].document;
    assert.deepEqual(original, SEED_DECK);
    for (const role of ["anon", "authenticated"] as const) {
      const user = role === "anon" ? null : OUTSIDER;
      if (role === "anon")
        await assert.rejects(
          asRole(db, role, user, (tx) =>
            tx.query("select draft from keynote_decks"),
          ),
        );
      else
        assert.equal(
          (
            await asRole(db, role, user, (tx) =>
              tx.query("select draft from keynote_decks"),
            )
          ).rows.length,
          0,
        );
      await assert.rejects(
        asRole(db, role, user, (tx) =>
          tx.query("select keynote_save('north-of-hell',1,$1)", [SEED_DECK]),
        ),
      );
      await assert.rejects(
        asRole(db, role, user, (tx) =>
          tx.query("select keynote_publish('north-of-hell',1)"),
        ),
      );
      await assert.rejects(
        asRole(db, role, user, (tx) =>
          tx.query("insert into keynote_editors values('north-of-hell',$1)", [
            OUTSIDER,
          ]),
        ),
      );
    }
    await assert.rejects(
      asRole(
        db,
        "authenticated",
        EDITOR,
        (tx) => tx.query("select keynote_publish('north-of-hell',1)"),
        true,
      ),
    );
    await assert.rejects(
      editor((tx) => tx.query("update keynote_revisions set document = '{}'")),
    );
    await assert.rejects(
      editor((tx) => tx.query("update keynote_decks set draft = '{}'")),
    );
    const draft = moveSlide({ ...SEED_DECK, startSlideId: "film" }, "film", 0);
    const saved = await editor((tx) =>
      tx.query<{ keynote_save: number }>(
        "select keynote_save('north-of-hell',1,$1)",
        [draft],
      ),
    );
    assert.equal(Number(saved.rows[0].keynote_save), 2);
    assert.deepEqual(
      (
        await db.query<{ document: unknown }>(
          "select document from keynote_revisions",
        )
      ).rows[0].document,
      original,
    );
    await assert.rejects(
      editor((tx) =>
        tx.query("select keynote_save('north-of-hell',1,$1)", [SEED_DECK]),
      ),
      /conflict/,
    );
    await assert.rejects(
      editor((tx) => tx.query("select keynote_publish('north-of-hell',1)")),
      /conflict/,
    );
    assert.equal(
      (await db.query("select * from keynote_revisions")).rows.length,
      1,
    );
    await editor((tx) => tx.query("select keynote_publish('north-of-hell',2)"));
    assert.deepEqual(
      (
        await db.query<{ document: unknown }>(
          "select r.document from keynote_revisions r join keynote_decks d on r.id=d.published_revision_id",
        )
      ).rows[0].document,
      draft,
    );
    await editor((tx) =>
      tx.query("select keynote_save('north-of-hell',2,$1)", [
        { ...draft, slides: [] },
      ]),
    );
    await assert.rejects(
      editor((tx) => tx.query("select keynote_publish('north-of-hell',3)")),
      /start slide/,
    );
    assert.equal(
      (await db.query("select * from keynote_revisions")).rows.length,
      2,
    );
    await editor((tx) =>
      tx.query("select keynote_save('north-of-hell',3,$1)", [original]),
    );
    await editor((tx) => tx.query("select keynote_publish('north-of-hell',4)"));
    assert.equal(
      (await db.query("select * from keynote_revisions")).rows.length,
      3,
    );
    await assert.rejects(
      editor((tx) =>
        tx.query("select keynote_save('other-project',4,$1)", [SEED_DECK]),
      ),
      /membership/,
    );
    // Running the seed again must not overwrite drafts or add revisions.
    await db.exec(migration.slice(migration.indexOf("do $seed$")));
    assert.equal(
      (await db.query("select * from keynote_revisions")).rows.length,
      3,
    );
    assert.equal(
      Number(
        (
          await db.query<{ draft_version: number }>(
            "select draft_version from keynote_decks",
          )
        ).rows[0].draft_version,
      ),
      4,
    );
    await db.query("delete from keynote_editors where user_id=$1", [EDITOR]);
    await assert.rejects(
      editor((tx) => tx.query("select keynote_publish('north-of-hell',4)")),
      /membership/,
    );
  } finally {
    await db.close();
  }
});

test("database validates direct RPC payloads and rolls back every publish write on failure", async () => {
  const db = await database();
  try {
    const payloads = [
      {
        ...SEED_DECK,
        slides: [
          {
            id: "x",
            name: "x",
            type: "video",
            source: "https://evil.test/video",
          },
        ],
      },
      {
        ...SEED_DECK,
        slides: [
          {
            id: "x",
            name: "x",
            type: "text",
            layout: "short",
            body: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "bad", marks: [{ type: "link" }] },
                  ],
                },
              ],
            },
          },
        ],
      },
      { ...SEED_DECK, slides: [SEED_DECK.slides[0], SEED_DECK.slides[0]] },
    ];
    for (const payload of payloads)
      await assert.rejects(
        asRole(db, "authenticated", EDITOR, (tx) =>
          tx.query("select keynote_save('north-of-hell',1,$1)", [payload]),
        ),
      );
    await db.exec(`create function public.test_fail_publish() returns trigger language plpgsql as $$ begin raise exception 'Test pointer update failure'; end; $$;
      create trigger test_fail_publish before update of published_revision_id on keynote_decks for each row execute function test_fail_publish();`);
    await assert.rejects(
      asRole(db, "authenticated", EDITOR, (tx) =>
        tx.query("select keynote_publish('north-of-hell',1)"),
      ),
      /Test pointer/,
    );
    assert.equal(
      (await db.query("select * from keynote_revisions")).rows.length,
      1,
    );
    await db.exec(
      "drop trigger test_fail_publish on keynote_decks; drop function public.test_fail_publish();",
    );
    const racing = await Promise.allSettled(
      ["title", "film"].map((startSlideId) =>
        asRole(db, "authenticated", EDITOR, (tx) =>
          tx.query("select keynote_save('north-of-hell',1,$1)", [
            { ...SEED_DECK, startSlideId },
          ]),
        ),
      ),
    );
    assert.equal(racing.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(racing.filter((r) => r.status === "rejected").length, 1);
    const audit = await db.query<{
      proname: string;
      prosecdef: boolean;
      proconfig: string[];
    }>(
      "select proname,prosecdef,proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('keynote_private','public') and (n.nspname='keynote_private' or p.proname like 'keynote_%')",
    );
    for (const fn of audit.rows) {
      assert.ok(fn.proconfig.some((s) => s.startsWith("search_path=")));
      if (fn.proname.startsWith("keynote_")) assert.equal(fn.prosecdef, false);
    }
    const rls = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where relname in ('keynote_editors','keynote_decks','keynote_revisions')",
    );
    assert.equal(rls.rows.length, 3);
    assert.ok(rls.rows.every((r) => r.relrowsecurity));
  } finally {
    await db.close();
  }
});
