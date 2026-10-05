import { MarketingShell } from "@/components/marketing-shell";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Восстановление пароля", referrer: "no-referrer", robots: { index: false, follow: false } };

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) { return <MarketingShell>{children}</MarketingShell>; }
