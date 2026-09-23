import { test, expect, type Page } from "@playwright/test";
test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:54329/__test/reset");
});
async function login(page: Page, email = "editor@example.test") {
  await page.goto("/admin/keynote/login");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Passord").fill("local-test-only-password");
  await page.getByRole("button", { name: "Logg inn", exact: true }).click();
}
const saved = (p: Page) =>
  expect(p.getByRole("status").filter({ hasText: /^Lagret$/ })).toBeVisible();

test("unauthed and legacy guest/admin cookies cannot open editor; outsider rejected", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "noh_auth", value: "test-guest", url: "http://127.0.0.1:3100" },
    {
      name: "noh_admin_auth",
      value: "forged-admin",
      url: "http://127.0.0.1:3100",
    },
  ]);
  await page.goto("/admin/keynote");
  await expect(page).toHaveURL(/keynote\/login/);
  await login(page, "outsider@example.test");
  await expect(page.locator("main [role=alert]")).toContainText(
    "ikke redaktørtilgang",
  );
});

test("edit → autosave → refresh → preview → publish → frozen live snapshot → restore", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await expect(page).toHaveURL(/\/admin\/keynote$/);
  await expect(page.getByRole("button", { name: /2\. Logline/ })).toBeVisible();
  const live = await context.newPage();
  await context.addCookies([
    {
      name: "noh_auth",
      value: "local-fixture-guest",
      url: "http://127.0.0.1:3100",
    },
  ]);
  await live.goto("/main");
  await expect(live.locator('[aria-roledescription="slide"]')).toContainText(
    "Along the arctic coast",
  );
  const text = page.getByRole("textbox", { name: "Slidetekst" });
  await text.fill("A new keynote draft.");
  await saved(page);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Slidetekst" })).toHaveText(
    "A new keynote draft.",
  );
  await live.reload();
  await expect(live.locator('[aria-roledescription="slide"]')).toContainText(
    "Along the arctic coast",
  );
  await page.getByRole("button", { name: "Kort tekst", exact: true }).click();
  await page.getByLabel("Navn", { exact: true }).fill("New slide");
  await page.getByRole("textbox", { name: "Slidetekst" }).fill("Paragraph one");
  await page.getByRole("button", { name: "Dupliser", exact: true }).click();
  await expect(page.getByLabel("Navn", { exact: true })).toHaveValue(
    "New slide (kopi)",
  );
  await page.getByRole("button", { name: "Flytt opp", exact: true }).click();
  await page.getByRole("button", { name: "Start her", exact: true }).click();
  await page
    .getByRole("button", { name: "Fjern fra kladd", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Publiser", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Angre", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Publiser", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /New slide \(kopi\).*Start/ }).click();
  await page.getByRole("textbox", { name: "Slidetekst" }).press("ArrowLeft");
  await expect(page.getByLabel("Navn", { exact: true })).toHaveValue(
    "New slide (kopi)",
  );
  await saved(page);
  await page.screenshot({
    path: "test-results/keynote-editor.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Forhåndsvis", exact: true }).click();
  await expect(page.locator('[aria-roledescription="slide"]')).toContainText(
    "Paragraph one",
  );
  await page.getByRole("button", { name: "Tilbake til redigering" }).click();
  await page.getByRole("button", { name: "Publiser", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Publisert\./ }),
  ).toBeVisible();
  await expect(live.locator('[aria-roledescription="slide"]')).toContainText(
    "Along the arctic coast",
  );
  await live.reload();
  await expect(live.locator('[aria-roledescription="slide"]')).toContainText(
    "Paragraph one",
  );
  await page.getByRole("button", { name: "Historikk", exact: true }).click();
  await page
    .getByRole("button", { name: "Gjenopprett som kladd" })
    .last()
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /gjenopprettet som kladd/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Publiser", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Publisert\./ }),
  ).toBeVisible();
  await live.reload();
  await expect(live.locator('[aria-roledescription="slide"]')).toContainText(
    "Along the arctic coast",
  );
  expect(errors).toEqual([]);
});

test("two tabs, save failure and slow responses retain edits; paste stripped; overflow warned", async ({
  page,
  context,
  request,
}) => {
  await login(page);
  await expect(page).toHaveURL(/\/admin\/keynote$/);
  const second = await context.newPage();
  await second.goto("/admin/keynote");
  await page
    .getByRole("textbox", { name: "Slidetekst" })
    .fill("Saved by first tab");
  await saved(page);
  await second
    .getByRole("textbox", { name: "Slidetekst" })
    .fill("My conflicting text");
  await expect(
    second.getByRole("status").filter({ hasText: /^Versjonskonflikt$/ }),
  ).toBeVisible();
  await expect(second.getByRole("textbox", { name: "Slidetekst" })).toHaveText(
    "My conflicting text",
  );
  await expect(
    second.getByRole("button", { name: "Publiser", exact: true }),
  ).toBeDisabled();
  const download = second.waitForEvent("download");
  await second.getByRole("button", { name: "Eksporter lokal kladd" }).click();
  expect((await download).suggestedFilename()).toContain("kladd");
  await request.post("http://127.0.0.1:54329/__test/fault", {
    data: { failSave: true },
  });
  await page
    .getByRole("textbox", { name: "Slidetekst" })
    .fill("Retained through save error");
  await expect(
    page.getByRole("status").filter({ hasText: /^Ikke lagret$/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Prøv lagring igjen" }).click();
  await saved(page);
  await request.post("http://127.0.0.1:54329/__test/fault", {
    data: { delaySave: 1000 },
  });
  await page.getByRole("textbox", { name: "Slidetekst" }).fill("Slow save");
  await expect(
    page.getByRole("status").filter({ hasText: /Lagrer/ }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Slidetekst" })
    .fill("Newest edit during slow save");
  await saved(page);
  await request.post("http://127.0.0.1:54329/__test/fault", { data: {} });
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Slidetekst" })).toHaveText(
    "Newest edit during slow save",
  );
  const text = page.getByRole("textbox", { name: "Slidetekst" });
  await text.fill("");
  await text.evaluate((el) => {
    const data = new DataTransfer();
    data.setData("text/plain", "First paragraph\nSecond paragraph");
    data.setData(
      "text/html",
      '<p style="font-size:100px;color:red"><b>First paragraph</b></p><p>Second paragraph</p>',
    );
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  });
  await expect(text.locator("p")).toHaveCount(2);
  await expect(text.locator("[style],b,strong")).toHaveCount(0);
  await text.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Fremhev", exact: true }).click();
  await expect(text.locator("em")).toHaveCount(2);
  await text.fill("Very long text ".repeat(300));
  await expect(page.locator("main [role=alert]")).toContainText(
    "for liten plass",
  );
  await saved(page);
});

test("presentation navigation, hover suppression, fullscreen, video and matching viewports", async ({
  page,
  context,
}) => {
  await login(page);
  await expect(page).toHaveURL(/\/admin\/keynote$/);
  await context.addCookies([
    {
      name: "noh_auth",
      value: "local-fixture-guest",
      url: "http://127.0.0.1:3100",
    },
  ]);
  const live = await context.newPage();
  await live.setViewportSize({ width: 1440, height: 810 });
  await live.goto("/main");
  await expect(
    live.getByRole("button", { name: "Enter fullscreen" }),
  ).toHaveCount(0);
  const section = live.locator('[aria-roledescription="slide"]');
  await expect(section).toContainText("Along the arctic coast");
  await live.keyboard.press("ArrowLeft");
  await expect(section).toHaveAttribute("aria-label", /Title/);
  await live.keyboard.press("ArrowRight");
  await expect(section).toHaveAttribute("aria-label", /Logline/);
  const logMarker = live.getByRole("button", {
    name: "Go to slide 2: Logline",
  });
  await logMarker.hover();
  await logMarker.click();
  await live.keyboard.press("ArrowRight");
  await expect(section).toHaveAttribute("aria-label", /Film/);
  await expect(logMarker.locator("span[aria-hidden=true]")).toHaveCSS(
    "opacity",
    "0",
  );
  const video = section.locator("video");
  await expect(video).not.toHaveAttribute("controls");
  const ratio = await video.evaluate(
    (v) => v.getBoundingClientRect().width / v.getBoundingClientRect().height,
  );
  expect(ratio).toBeCloseTo(16 / 9, 2);
  await live
    .getByRole("button", { name: "Play North of Hell film", exact: true })
    .click();
  await expect(video).toHaveAttribute("controls", "", { timeout: 30000 });
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0);
  await live
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await expect(
    live.getByRole("button", { name: "Exit fullscreen", exact: true }),
  ).toBeVisible();
  await live
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  for (const target of [
    { name: "16:9", w: 1440, h: 810 },
    { name: "4:3", w: 1440, h: 1080 },
    { name: "Mobil", w: 390, h: 845 },
  ]) {
    await page.getByLabel("Format").selectOption({ label: target.name });
    await live.setViewportSize({ width: target.w, height: target.h });
    for (const [i, label] of [
      [1, "Title"],
      [2, "Logline"],
      [4, "Genre & Tone"],
      [5, "Synopsis 1"],
    ] as const) {
      await page
        .getByRole("button", {
          name: new RegExp(`^${i}\\. ${label.replace("&", "&")}`),
        })
        .click();
      await live
        .getByRole("button", {
          name: `Go to slide ${i}: ${label}`,
          exact: true,
        })
        .click();
      await expect(section).toHaveAttribute("aria-label", new RegExp(label));
      const preview = page.getByRole("region", {
        name: "Slideforhåndsvisning",
      });
      // Compare computed layout at the same virtual viewport before the preview's scale transform.
      const measure = async (root: ReturnType<Page["locator"]>) =>
        root.evaluate((el) => {
          const text = el.querySelector<HTMLElement>("[data-slide-text]");
          const title = el.querySelector<HTMLImageElement>("img");
          return text
            ? {
                font: getComputedStyle(text).fontSize,
                width: text.offsetWidth,
                height: text.offsetHeight,
              }
            : { width: title?.offsetWidth };
        });
      await expect.poll(() => measure(preview)).toEqual(await measure(section));
    }
    await live.mouse.move(0, 0);
    await live.locator("main").focus();
    await expect(section).toHaveCSS("opacity", "1");
    await live.screenshot({
      path: `test-results/keynote-${target.name.replace(":", "-")}.png`,
    });
  }
  await page.getByRole("button", { name: /^2\. Logline/ }).click();
  await page.getByRole("button", { name: "Forhåndsvis", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("drag reorder preserves start identity, publish drains saves, direct unauthenticated action denied", async ({
  page,
  context,
  request,
}) => {
  await login(page);
  await expect(page).toHaveURL(/\/admin\/keynote$/);
  const action = page.waitForRequest(
    (r) => r.method() === "POST" && !!r.headers()["next-action"],
  );
  await page.getByLabel("Navn", { exact: true }).fill("Logline changed");
  const saveRequest = await action;
  await saved(page);
  const denied = await request.post("/admin/keynote", {
    headers: {
      "next-action": saveRequest.headers()["next-action"],
      "content-type": saveRequest.headers()["content-type"],
      origin: "http://127.0.0.1:3100",
    },
    data: saveRequest.postData()!,
  });
  expect(await denied.text()).toMatch(/Logg inn|keynote\/login/);
  await page
    .getByRole("button", { name: /^2\. Logline changed/ })
    .dragTo(page.getByRole("button", { name: /^1\. Title/ }));
  await expect(
    page.getByRole("button", { name: /^1\. Logline changed.*Start/ }),
  ).toBeVisible();
  await request.post("http://127.0.0.1:54329/__test/fault", {
    data: { delaySave: 1000 },
  });
  await page
    .getByRole("textbox", { name: "Slidetekst" })
    .fill("Publish the latest pending edit");
  await page.getByRole("button", { name: "Publiser", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Slidetekst" }),
  ).toHaveAttribute("contenteditable", "false");
  await expect(
    page.getByRole("status").filter({ hasText: /^Publisert\./ }),
  ).toBeVisible();
  await context.addCookies([
    {
      name: "noh_auth",
      value: "local-fixture-guest",
      url: "http://127.0.0.1:3100",
    },
  ]);
  const live = await context.newPage();
  await live.goto("/main");
  await expect(live.locator('[aria-roledescription="slide"]')).toContainText(
    "Publish the latest pending edit",
  );
  await request.post("http://127.0.0.1:54329/__test/fault", { data: {} });
});
