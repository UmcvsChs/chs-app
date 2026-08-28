import { MetadataRoute } from "next";

// Real crawl permissions — explicitly allows every public listing and
// marketing page, while keeping genuinely private areas (wallet,
// profile, admin, and every dashboard) out of search results
// entirely, since none of that should ever be indexable.
export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://extraordinary-conkies-312c3d.netlify.app";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/property/", "/marketplace", "/blog", "/about"],
      disallow: [
        "/admin", "/admin/", "/wallet", "/profile", "/owner", "/tenant", "/agent",
        "/manager", "/artisan", "/vendor", "/login", "/register", "/link-account",
        "/edit-listing/", "/list-property", "/promote/", "/engage-chs",
        "/construction-roadmap", "/urgent-sale/", "/condition-report/",
        "/accept-terms", "/admin-approval-pending", "/analytics/",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
