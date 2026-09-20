import Link from "next/link";
import { Download, MonitorCheck } from "lucide-react";

const releaseUrl = "https://github.com/flipdanger94/flipzero/releases/latest/download/FlipZero_0.1.0_x64-setup.exe";

export default function DownloadPage() {
  return <main className="download-page"><section className="download-card"><span className="download-badge"><MonitorCheck size={15} /> &nbsp;Десктопное приложение</span><h1>FlipZero для Windows</h1><p>Общайтесь, управляйте сообществами и оставайтесь на связи в отдельном компактном приложении на базе Tauri.</p><a className="download-action" href={releaseUrl}><Download size={19} /> &nbsp;Скачать для Windows</a><div className="download-requirements">Windows 10/11 · 64-bit · WebView2 (обычно уже установлен) · обновления публикуются через GitHub Releases</div><Link className="download-home" href="/app">Вернуться в FlipZero</Link></section></main>;
}
