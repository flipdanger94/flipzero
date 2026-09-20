import Image from "next/image";

export function MediaImage({ src, alt = "", className = "uploaded-image", sizes = "64px" }: { src: string; alt?: string; className?: string; sizes?: string }) {
  return <Image src={src} alt={alt} width={256} height={256} sizes={sizes} className={className} />;
}
