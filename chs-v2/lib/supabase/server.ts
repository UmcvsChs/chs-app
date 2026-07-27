import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// The server-side client — used in Server Components, reading the real
// session from cookies set by the browser client. This is what actually
// lets a Server Component know who's genuinely logged in, rather than
// always rendering as if nobody is (the real, disclosed gap this fixes).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components can't set cookies directly — this is
            // expected and harmless here, since the middleware below is
            // what actually keeps the session cookie refreshed.
          }
        },
      },
    }
  );
}
