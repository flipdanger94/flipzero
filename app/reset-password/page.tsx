"use client";

import { type FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, KeyRound, LoaderCircle, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token] = useState(() => searchParams.get("token"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => { if (token) window.history.replaceState(window.history.state, "", "/reset-password"); }, [token]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    const form = new FormData(event.currentTarget);
    if (token && form.get("password") !== form.get("confirmPassword")) { setError("Пароли не совпадают."); setLoading(false); return; }
    try {
      const response = await fetch("/api/v1/auth/password-reset", { method: token ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(token ? { token, password: form.get("password") } : { email: form.get("email") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Не удалось выполнить запрос.");
      if (token) router.replace("/login?reset=success"); else setSent(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось выполнить запрос."); }
    finally { setLoading(false); }
  }
  return <AuthShell title={token ? "Новый пароль" : "Восстановление доступа"} description={token ? "Придумайте новый пароль для входа в FlipZero." : "Отправим ссылку на почту, указанную при регистрации."} alternateText="Вспомнили пароль?" alternateHref="/login" alternateLabel="Войти">
    {sent ? <div className="auth-form"><div className="auth-success" role="status">Если аккаунт с этой почтой существует, письмо со ссылкой придёт в ближайшее время. Проверьте также папку «Спам».</div><Link href="/login">Вернуться ко входу</Link></div> : <form className="auth-form" onSubmit={submit}>
      {error ? <div className="auth-error" role="alert">{error}</div> : null}
      {token ? <><label><span>Новый пароль</span><div className="auth-input"><KeyRound size={17} /><input name="password" type={showPassword ? "text" : "password"} minLength={10} maxLength={128} autoComplete="new-password" required /><button type="button" aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label><label><span>Повторите пароль</span><div className="auth-input"><KeyRound size={17} /><input name="confirmPassword" type={showPassword ? "text" : "password"} minLength={10} maxLength={128} autoComplete="new-password" required /></div></label></> : <label><span>Email</span><div className="auth-input"><Mail size={17} /><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div></label>}
      <button className="auth-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Подождите…</> : token ? "Сохранить новый пароль" : "Отправить ссылку"}</button>
    </form>}
  </AuthShell>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<AuthShell title="Восстановление доступа" description="Загружаем форму…" alternateText="Вспомнили пароль?" alternateHref="/login" alternateLabel="Войти"><LoaderCircle className="spin" /></AuthShell>}><ResetForm /></Suspense>;
}
