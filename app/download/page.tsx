import type { Metadata } from "next";
import Link from "next/link";
import { Download, MonitorCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Скачать FlipZero для Windows",
  description: "Актуальный выпуск FlipZero для Windows: версия, размер и контрольная сумма установщика.",
  alternates: { canonical: "/download" },
  openGraph: { url: "/download", title: "Скачать FlipZero для Windows", images: ["/opengraph-image"] },
};

export const revalidate = 3600;
type ReleaseAsset = { name: string; size: number; digest?: string | null; browser_download_url: string };
type Release = { tag_name: string; assets: ReleaseAsset[] };
const releasesUrl = "https://github.com/flipdanger94/flipzero/releases";

async function latestWindowsRelease() {
  try {
    const response = await fetch("https://api.github.com/repos/flipdanger94/flipzero/releases/latest", {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "FlipZero-download-page" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const release = (await response.json()) as Release;
    const asset = release.assets?.find((item) => /_x64-setup\.exe$/i.test(item.name));
    if (!asset || !asset.browser_download_url.startsWith(`${releasesUrl}/download/`)) return null;
    return { version: release.tag_name, asset };
  } catch {
    return null;
  }
}

export default async function DownloadPage() {
  const release = await latestWindowsRelease();
  const sha256 = release?.asset.digest?.match(/^sha256:([a-f0-9]{64})$/i)?.[1];
  return <main className="download-page"><section className="download-card"><span className="download-badge"><MonitorCheck size={15} /> &nbsp;Десктопное приложение</span><h1>FlipZero для Windows</h1><p>Общайся и управляй сообществами в приложении на базе Tauri.</p>
    {release ? <><a className="download-action" href={release.asset.browser_download_url}><Download size={19} /> &nbsp;Скачать для Windows</a><div className="download-requirements">Версия {release.version} · {(release.asset.size / 1024 / 1024).toFixed(1)} МБ · Windows 10/11, 64 bit · WebView2</div>{sha256 ? <p className="download-checksum">SHA256: <code>{sha256}</code></p> : <p className="download-checksum">Контрольная сумма SHA256 для этого выпуска пока не опубликована.</p>}</> : <div className="download-requirements" role="status">Установщик сейчас недоступен. Проверь выпуски на GitHub или открой веб-версию.</div>}
    <p className="download-help">Если Windows SmartScreen предупреждает о новом издателе, проверь источник файла и его SHA256 перед запуском. Не запускай файл, если источник или контрольная сумма не совпадают.</p>
    <Link className="download-home" href="/app">Открыть FlipZero в браузере</Link><a className="download-home" href={releasesUrl}>Посмотреть выпуски на GitHub</a>
  </section></main>;
}
