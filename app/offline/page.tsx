import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return <main className="offline-page"><section><span className="offline-logo">FZ</span><div className="offline-icon"><WifiOff size={30} /></div><p className="offline-kicker">НЕТ СОЕДИНЕНИЯ</p><h1>FlipZero временно офлайн</h1><p>Проверьте интернет и попробуйте снова. Ваши сообщения и личные данные не сохраняются в публичном offline-кеше.</p><Link href="/"><RefreshCw size={17} /> Проверить соединение</Link></section></main>;
}
