import { expect, test, type Page } from "@playwright/test";

const publicRoutes = ["/", "/?view=locker", "/?view=market", "/?view=profile", "/mobile-preview", "/producer"];

async function expectHealthyPage(page: Page) {
  await expect(page.locator("body")).not.toContainText("Application error");
  await expect(page.locator("body")).not.toContainText("This page could not be found");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const brokenLocalImages = await page.locator("img").evaluateAll((images) =>
    (images as HTMLImageElement[])
      .filter((image) => {
        const source = image.currentSrc || image.src;
        return source.startsWith(window.location.origin) && image.complete && image.naturalWidth === 0;
      })
      .map((image) => image.getAttribute("src")),
  );
  expect(brokenLocalImages).toEqual([]);
}

test.describe("public app shell", () => {
  for (const route of publicRoutes) {
    test(`${route} renders without viewport overflow`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toBeVisible();
      await expectHealthyPage(page);
      expect(pageErrors).toEqual([]);
    });
  }
});

test("admin data stays behind authentication", async ({ page, request }) => {
  test.setTimeout(60_000);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Sign in required" })).toBeVisible();
  await expect(page.getByText("database-backed admin role")).toBeVisible();

  const response = await request.get("/api/admin/review");
  expect(response.status()).toBe(401);
});

test("writer draft and active section survive refresh", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Open Writer Flow" }).click();
  const startSession = page.getByRole("button", { name: "Start Session" });
  if (await startSession.isVisible().catch(() => false)) await startSession.click();

  const hook = ["Gold in the window", "Rain on the glass", "Pocket keeps moving", "I am built to last"].join("\n");
  await page.getByRole("textbox", { name: "Hook lyrics" }).fill(hook);
  await page.getByRole("tab", { name: /^Verse 1/ }).click();

  const verse = Array.from({ length: 16 }, (_, index) => `Verse line ${index + 1} lands in the pocket`).join("\n");
  await page.getByRole("textbox", { name: "Verse 1 lyrics" }).fill(verse);
  await expect(page.getByRole("textbox", { name: "Verse 1 lyrics" })).toHaveValue(verse);

  await page.waitForTimeout(250);
  const resumedPage = await page.context().newPage();
  await resumedPage.goto("/", { waitUntil: "domcontentloaded" });
  await resumedPage.getByRole("button", { name: "Open Writer Flow" }).click();
  const resumedStartSession = resumedPage.getByRole("button", { name: "Start Session" });
  if (await resumedStartSession.isVisible().catch(() => false)) await resumedStartSession.click();

  await expect(resumedPage.getByRole("textbox", { name: "Verse 1 lyrics" })).toHaveValue(verse);
  await resumedPage.getByRole("tab", { name: /^Hook/ }).click();
  await expect(resumedPage.getByRole("textbox", { name: "Hook lyrics" })).toHaveValue(hook);
  await expectHealthyPage(resumedPage);
});

test("writer glass pad stays focused and mobile safe", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.route("**/api/starter-beats", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        beats: [{
          id: "fb699cd4-66f4-46d2-bb99-c454c00689ed",
          slug: "city-shadows",
          title: "City Shadows",
          producer: "N0izepack Ent",
          producerProfileId: null,
          sourceType: "suno_licensed",
          rightsHolder: "N0izepack Ent",
          licenseScope: "rapwriter_starter_nonexclusive",
          duration: 155,
          bpm: null,
          key: null,
          genre: "Jazz R&B",
          mood: "Laid Back",
          tags: ["Jazz", "R&B", "Laid Back"],
          attribution: "Created by N0izepack Ent for the RapWriter Starter catalog.",
          previewUrl: "/api/starter-beats/fb699cd4-66f4-46d2-bb99-c454c00689ed/media?kind=audio",
          artworkUrl: null,
        }],
      }),
    });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Open Writer Flow" }).click();
  const startSession = page.getByRole("button", { name: "Start Session" });
  if (await startSession.isVisible().catch(() => false)) await startSession.click();

  const editor = page.getByRole("textbox", { name: "Hook lyrics" });
  await editor.fill("Glass roof, still I see the sky though\nEvery ceiling that they built, I broke the light through");

  const editorStyle = await editor.evaluate((element) => {
    const style = getComputedStyle(element);
    const surfaceStyle = getComputedStyle(element.parentElement as HTMLElement);
    return {
      color: style.color,
      backgroundImage: style.backgroundImage,
      surfaceBackground: surfaceStyle.backgroundColor,
      surfaceBackdrop: surfaceStyle.backdropFilter,
    };
  });
  const hookTabRadius = await page.getByRole("tab", { name: /^Hook/ }).evaluate((element) => parseFloat(getComputedStyle(element).borderRadius));

  expect(editorStyle.color).toMatch(/255,\s*255,\s*255|0\.999/);
  expect(editorStyle.backgroundImage).toContain("linear-gradient");
  expect(editorStyle.surfaceBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(editorStyle.surfaceBackdrop).not.toBe("none");
  expect(hookTabRadius).toBeGreaterThanOrEqual(20);
  await expect(page.locator("nav")).toHaveCount(0);
  await expectHealthyPage(page);
  await page.screenshot({ path: testInfo.outputPath("writer-glass.png"), fullPage: false });

  await page.getByRole("button", { name: "Change beat" }).click();
  await expect(page.getByRole("dialog", { name: "Change the beat." })).toBeVisible();
  await expect(page.getByRole("button", { name: "My Beats" })).toBeVisible();
  await expect(page.getByRole("button", { name: "30-sec Previews" })).toBeVisible();
  await page.getByRole("button", { name: /City Shadows N0izepack Ent/ }).click();
  await expect(page.getByText("City Shadows", { exact: true })).toBeVisible();
  await expect(editor).toHaveValue("Glass roof, still I see the sky though\nEvery ceiling that they built, I broke the light through");

  await expect(page.getByRole("button", { name: "Pen Pro" })).toBeVisible();
  await expectHealthyPage(page);
  await page.screenshot({ path: testInfo.outputPath("writer-membership-boundary.png"), fullPage: false });
});

test("device preview embeds the live app and switches shells", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/mobile-preview", { waitUntil: "domcontentloaded" });

  await expect(page.locator("main")).toHaveAttribute("data-preview-ready", "true", { timeout: 20_000 });
  const phoneShell = page.getByTestId("phone-shell");
  const deviceFrame = page.frameLocator('iframe[title="RapWriter device preview"]');
  await expect(phoneShell).toHaveAttribute("data-device", "iphone");
  await expect(deviceFrame.locator("body")).toContainText(/Restoring Studio|Studio is ready\./, { timeout: 20_000 });
  await deviceFrame.locator("body").evaluate((body) => body.dataset.previewSession = "preserved");
  await page.getByRole("tab", { name: "Samsung" }).click();
  await expect(phoneShell).toHaveAttribute("data-device", "samsung");
  await expect(deviceFrame.locator("body")).toHaveAttribute("data-preview-session", "preserved");
  await expectHealthyPage(page);
});

test("foreign-origin API mutation is rejected", async ({ request }) => {
  const response = await request.post("/api/marketplace/events", {
    headers: { Origin: "https://example.com" },
    data: { event_type: "beat_play", beat_id: "00000000-0000-4000-8000-000000000000" },
  });
  expect(response.status()).toBe(403);
});
