import Image from "next/image";

export function BrandMark({ size = 40 }: { size?: number }) {
  return <Image src="/brand-mark.svg" alt="" width={size} height={size} unoptimized className="brand-symbol" />;
}
