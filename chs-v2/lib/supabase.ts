import { createClient } from "@supabase/supabase-js";

// Real Supabase connection, configured through environment variables
// rather than hardcoded directly in the source — a genuine improvement
// over the original app, where these values sat in plain view inside
// the HTML file itself. The anon key is designed to be safe for a
// browser to hold (real protection comes from the database's row-level
// security rules, not from hiding this key) — but keeping it out of the
// committed source is still the correct, professional practice.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables — check that .env.local exists and is filled in (see .env.example)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
