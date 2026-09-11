import { test, expect } from "@playwright/test";

// Real regression test for the single most-reported, most-fixed bug
// of this entire engagement: a notification that's clickable but
// doesn't actually navigate anywhere. This exists specifically so
// this exact bug can never silently come back unnoticed.
// NOT YET EXECUTED OR VERIFIED — written correctly against the real,
// current UI, but this sandbox has no network access to run it.
test("clicking a real notification actually navigates, not just closes the panel", async ({ page }) => {
  await page.goto("/login");
  await page.getByText("Owner", { exact: true }).click();
  await page.getByPlaceholder("08XXXXXXXXX").fill("08120000001");
  await page.getByLabel("PIN (6 digits)").fill("123456");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/owner/, { timeout: 10000 });

  const bell = page.getByLabel("Notifications");
  await bell.click();

  const firstNotificationWithLink = page.locator("text=Tap to view").first();
  if (await firstNotificationWithLink.count() === 0) {
    test.skip(true, "No real notification with a link exists on this account right now — re-run once one does.");
  }

  const urlBefore = page.url();
  await firstNotificationWithLink.click();

  // The real, specific regression: this used to just close the
  // dropdown with no navigation at all. Assert the URL genuinely
  // changed, not just that the panel closed.
  await expect(page).not.toHaveURL(urlBefore, { timeout: 5000 });
});
