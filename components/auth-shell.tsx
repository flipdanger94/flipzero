import Link from "next/link";
import { MessageCircleMore, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { BrandMark } from "./brand-mark";

export function AuthShell({ title, description, alternateText, alternateHref, alternateLabel, children }: { title: string; description: string; alternateText: string; alternateHref: string; alternateLabel: string; children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link href="/" className="auth-brand" aria-label="FlipZero"><span className="brand-symbol-wrap"><BrandMark /></span><strong>FlipZero</strong></Link>
        <div className="auth-story-copy"><span className="auth-kicker"><Sparkles size={15} /> Пространство для своих</span><h1>Общайтесь.<br />Создавайте.<br /><em>Прокачивайтесь.</em></h1><p>Сообщества, живой голос и профиль, который растёт вместе с вами.</p></div>
        <div className="auth-benefits"><span><MessageCircleMore size={18} /> Живые сообщества</span><span><Trophy size={18} /> Уровни и достижения</span><span><ShieldCheck size={18} /> Безопасное общение</span></div>
      </section>
      <section className="auth-form-side">
        <div className="auth-card"><div className="auth-mobile-brand"><span className="brand-symbol-wrap"><BrandMark /></span><strong>FlipZero</strong></div><h2>{title}</h2><p className="auth-description">{description}</p>{children}<p className="auth-alternate">{alternateText} <Link href={alternateHref}>{alternateLabel}</Link></p><small className="auth-legal">Продолжая, вы соглашаетесь с правилами сообщества и политикой конфиденциальности.</small></div>
      </section>
    </main>
  );
}
