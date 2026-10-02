import Image from "next/image";

export function MediaImage({ src, alt = "", className = "uploaded-image", sizes = "64px" }: { src: string; alt?: string; className?: string; sizes?: string }) {
  // The optimizer fetches without the viewer's session and caches responses.
  // Fetch our media directly so private images retain cookie-based access.
  const authenticatedMedia = /^\/api\/v1\/(?:media|attachments)\//.test(src);
  return <Image src={src} alt={alt} width={256} height={256} sizes={sizes} className={className} unoptimized={authenticatedMedia} />;
}
