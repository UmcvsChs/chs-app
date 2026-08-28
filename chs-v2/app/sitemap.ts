import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

// A real, live sitemap — regenerates from the actual database every
// time it's requested, rather than a static file that goes stale the
// moment a new listing is verified or an old one is taken down. This
// is what tells Google "here's everything real and current," instead
// of waiting to discover listings one at a time.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const baseUrl = "https://extraordinary-conkies-312c3d.netlify.app";

  const { data: properties } = await supabase
    .from("properties")
    .select("id, created_at")
    .eq("verification_status", "verified")
    .eq("status", "active")
    .limit(5000);

  const propertyEntries: MetadataRoute.Sitemap = (properties || []).map((p) => ({
    url: `${baseUrl}/property/${p.id}`,
    lastModified: p.created_at || new Date().toISOString(),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const staticEntries: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/marketplace`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/blog`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${baseUrl}/about`, changeFrequency: "monthly", priority: 0.4 },
  ];

  return [...staticEntries, ...propertyEntries];
}
