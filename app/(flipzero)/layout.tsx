import type { ReactNode } from "react";
import FlipZeroApp from "@/components/flipzero-app";

export default function FlipZeroLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <FlipZeroApp />
      {children}
    </>
  );
}
