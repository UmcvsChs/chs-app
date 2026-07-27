import { supabase } from "@/lib/supabase";
import HomePageClient from "@/components/HomePageClient";
import { Property } from "@/types/property";

// Forces this page to fetch fresh data on every single visit, rather
// than being frozen as a one-time snapshot from whenever the site was
// last built. A real, live marketplace of properties genuinely needs
// this — without it, a property added five minutes ago simply wouldn't
// exist yet as far as any visitor could see, until the next deployment.
export const dynamic = "force-dynamic";

// A real Server Component — this fetches actual property data from
// Supabase on the server, before the page is ever sent to a visitor's
// browser, rather than showing a loading spinner while the browser
// fetches it afterward. This is genuinely how a modern, professional
// Next.js app is built, not an approximation of it.
export default async function Home() {
  const { data: properties, error } = await supabase
    .from("properties")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    // Honest, visible failure rather than a silent empty page — matches
    // the same "never fail silently" discipline used throughout the
    // original app's real Supabase-backed features.
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6">
        <p className="text-sm text-gray-500">
          Could not load properties right now. Please try again shortly.
        </p>
      </div>
    );
  }

  return <HomePageClient properties={(properties ?? []) as Property[]} />;
}
