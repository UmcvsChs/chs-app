import { defineConfig, devices } from "@playwright/test";

// Real Playwright configuration. IMPORTANT, honest note for whoever
// runs this: these tests were written correctly based on the real,
// current UI, but have not been executed or verified by the AI agent
// that wrote them — the sandbox this was built in has no network
// access to the live site or Supabase's API. Run `npx playwright
// install` once, then `npm run test:e2e`, and verify these pass for
// real before trusting them.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 1,
  reporter: "html",
  use: {
    baseURL: process.env.CHS_BASE_URL || "https://harmonious-shortbread-ed5619.netlify.app",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
});
