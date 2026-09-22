import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/setup/", "/oauth/"],
    },
    sitemap: "https://flipzeroapp.vercel.app/sitemap.xml",
    host: "https://flipzeroapp.vercel.app",
  };
}
