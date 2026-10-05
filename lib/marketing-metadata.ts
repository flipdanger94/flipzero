import type { Metadata } from "next";

/** Keep social previews consistent with each public page's search description. */
export function marketingMetadata(metadata: Metadata): Metadata {
  const title = typeof metadata.title === "string" ? metadata.title : "FlipZero — чаты, голос и сообщества";
  const description = metadata.description ?? "FlipZero — пространство для общения с друзьями и сообществами.";
  return {
    ...metadata,
    openGraph: {
      type: "website", locale: "ru_RU", siteName: "FlipZero",
      ...metadata.openGraph, title, description,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] },
  };
}
