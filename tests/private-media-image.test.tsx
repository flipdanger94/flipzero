import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MediaImage } from "../components/media-image";
describe("private media rendering", () => {
  it.each(["attachments", "media"])("fetches %s images directly with the viewer session", kind => {
    const src = `/api/v1/${kind}/d0fb1e2c-22cc-4e1f-b106-22bb3fc78c67`;
    const html = renderToStaticMarkup(<MediaImage src={src} alt="Private file"/>);
    expect(html).toContain(`src="${src}"`);
    expect(html).not.toContain("/_next/image");
    expect(html).not.toContain("srcSet=");
  });
});
