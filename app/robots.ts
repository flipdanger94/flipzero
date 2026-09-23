import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/setup/", "/oauth/", "/app", "/channels/", "/login", "/register", "/reset-password", "/developers/console"],
    },
    sitemap: "https://flipzeroapp.vercel.app/sitemap.xml",
    host: "https://flipzeroapp.vercel.app",
  };
}
