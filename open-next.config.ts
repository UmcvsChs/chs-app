// Real configuration for the official OpenNext Cloudflare adapter —
// this is what actually translates our genuine Next.js server-side
// rendering (Server Components, dynamic routes, our proxy/middleware)
// into something Cloudflare Workers can run, since Cloudflare's own
// current guidance is clear that real SSR needs Workers, not the
// simpler static-only Pages product.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
