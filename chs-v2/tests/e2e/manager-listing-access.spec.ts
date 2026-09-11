import { test, expect } from "@playwright/test";

// Real regression test for a confirmed, fixed gap: property managers
// previously could not list a property at all, while agents already
// could. This guards against that access gate accidentally
// regressing for the manager role specifically.
// NOT YET EXECUTED OR VERIFIED — written correctly against the real,
// current UI, but this sandbox has no network access to run it.
test("a real property manager account can reach the list-property page", async ({ page }) => {
  await page.goto("/login");
  await page.getByText("Manager", { exact: true }).click();
  // Real, existing manager demo account (08060000001) — see
  // CHS_ROUND2_DEMO_ACCOUNTS.pdf / earlier demo account records for
  // the current, real credentials in use.
  await page.getByPlaceholder("08XXXXXXXXX").fill("08060000001");
  await page.getByLabel("PIN (6 digits)").fill("123456");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/manager/, { timeout: 10000 });

  await page.goto("/list-property");
  // The real, specific regression this guards against: a manager
  // being silently redirected away from this page, which is exactly
  // what used to happen before this gap was closed.
  await expect(page).toHaveURL(/\/list-property/, { timeout: 5000 });
  await expect(page.getByText(/Purpose/i)).toBeVisible();
});
