import { test, expect } from "@playwright/test";

// Real login flow test, using the real Round 2 Owner demo account.
// NOT YET EXECUTED OR VERIFIED — written correctly against the real,
// current UI, but this sandbox has no network access to run it.
test("owner can log in with real credentials and reach the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByText("Owner", { exact: true }).click();
  await page.getByPlaceholder("08XXXXXXXXX").fill("08120000001");
  await page.getByLabel("PIN (6 digits)").fill("123456");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/owner/, { timeout: 10000 });
  await expect(page.getByText("My Listed Properties")).toBeVisible();
});

test("wrong PIN shows a real, clear error, not a silent failure", async ({ page }) => {
  await page.goto("/login");
  await page.getByText("Owner", { exact: true }).click();
  await page.getByPlaceholder("08XXXXXXXXX").fill("08120000001");
  await page.getByLabel("PIN (6 digits)").fill("000000");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByText(/incorrect/i)).toBeVisible({ timeout: 5000 });
});
