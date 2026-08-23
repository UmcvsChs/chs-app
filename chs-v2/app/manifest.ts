import type { MetadataRoute } from "next";

// Next.js's own, built-in manifest support — no extra library needed.
// This is what lets a phone's browser genuinely offer "Add to Home
// Screen," turning the real, live website into something that opens
// full-screen with its own icon, feeling like an installed app, without
// ever needing an app store.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CHS — Complete Housing Solutions",
    short_name: "CHS",
    description: "Complete Housing Solutions — Nigeria's trusted property platform, connecting owners, tenants, buyers, agents, and property managers nationwide",
    start_url: "/",
    display: "standalone",
    background_color: "#4B627A",
    theme_color: "#4B627A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
