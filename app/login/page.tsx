"use client";
import { type FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";

function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const next = useSearchParams().get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
    const result = await response.json();
    if (!response.ok) { setError(result.message ?? "Не удалось войти."); setLoading(false); return; }
    router.push(safeNext ?? "/app");
    router.refresh();
  }

  return <AuthShell title="С возвращением" description="Войдите, чтобы продолжить общение." alternateText="Нет аккаунта?" alternateHref={safeNext ? `/register?next=${encodeURIComponent(safeNext)}` : "/register"} alternateLabel="Создать">
    <form className="auth-form" onSubmit={submit}>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <label><span>Email</span><div className="auth-input"><Mail size={17} /><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div></label>
      <label><span>Пароль</span><div className="auth-input"><LockKeyhole size={17} /><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Ваш пароль" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
      <button className="auth-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Входим...</> : "Войти в FlipZero"}</button>
    </form>
  </AuthShell>;
}

export default function LoginPage() {
  return <Suspense fallback={<AuthShell title="С возвращением" description="Войдите, чтобы продолжить общение." alternateText="Нет аккаунта?" alternateHref="/register" alternateLabel="Создать"><div className="auth-form"><LoaderCircle className="spin" size={22} /></div></AuthShell>}><LoginForm /></Suspense>;
}
