import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Required for the server-side session fix to actually work — this runs
// on every request, refreshing the real session cookie so it never goes
// stale between the browser and the server. Without this, a Server
// Component could start seeing an expired or missing session even
// though the person is still genuinely logged in.
//
// Named proxy.ts, not middleware.ts — Next.js 16 renamed this file
// convention. A leftover middleware.ts is silently ignored at build
// time with no error or warning, meaning this would quietly stop
// running at all if left under the old name.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Genuinely refreshes the session — this call matters even though its
  // result isn't used directly here.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
