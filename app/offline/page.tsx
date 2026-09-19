import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

export default function OfflinePage() {
  return <main className="offline-page"><section><span className="offline-logo brand-symbol-wrap"><BrandMark /></span><div className="offline-icon"><WifiOff size={30} /></div><p className="offline-kicker">НЕТ СОЕДИНЕНИЯ</p><h1>FlipZero временно офлайн</h1><p>Проверьте интернет и попробуйте снова. Ваши сообщения и личные данные не сохраняются в публичном offline-кеше.</p><Link href="/"><RefreshCw size={17} /> Проверить соединение</Link></section></main>;
}
