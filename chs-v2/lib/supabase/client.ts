import { createBrowserClient } from "@supabase/ssr";

// The browser-side client — used in Client Components ("use client").
// Critically, this stores the session in cookies (not just localStorage,
// which the original basic client used), so a Server Component rendered
// on the server can genuinely read who's logged in too. This is the
// real fix for the disclosed gap: previously, the server had no way to
// know who was asking.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
