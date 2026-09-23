import Link from "next/link";
import { redirect } from "next/navigation";
import { DeveloperDialog } from "@/components/developer-dialog";
import { getCurrentUser } from "@/lib/auth";

export default async function DeveloperConsolePage() {
  if (!await getCurrentUser()) redirect("/login?next=%2Fdevelopers%2Fconsole");
  return <main className="developer-console-page"><header><Link href="/developers">← Для разработчиков</Link><strong>FlipZero · платформа разработчиков</strong><nav><Link href="/developers/docs">Документация API</Link><Link href="/app">Открыть FlipZero</Link></nav></header><DeveloperDialog embedded onClose={() => {}} /></main>;
}
