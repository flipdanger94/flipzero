import Link from "next/link";

export default function NotFound() {
  return <main className="legal-page"><article><Link href="/">← FlipZero</Link><h1>Страница не найдена</h1><p>Проверь адрес или вернись на главную.</p><Link href="/">На главную</Link></article></main>;
}
