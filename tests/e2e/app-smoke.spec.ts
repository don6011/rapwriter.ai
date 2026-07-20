import { expect, test, type Page } from "@playwright/test";

const publicRoutes = ["/", "/?view=locker", "/?view=market", "/?view=profile", "/producer"];

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

test("foreign-origin API mutation is rejected", async ({ request }) => {
  const response = await request.post("/api/marketplace/events", {
    headers: { Origin: "https://example.com" },
    data: { event_type: "beat_play", beat_id: "00000000-0000-4000-8000-000000000000" },
  });
  expect(response.status()).toBe(403);
});
