"use client";
import { type FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";

function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requiresOtp, setRequiresOtp] = useState(false);
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const sessionsEnded = searchParams.get("sessions") === "ended";
  const resetComplete = searchParams.get("reset") === "success";
  const safeNext = next?.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password"), otp: data.get("otp") || undefined }) });
    const result = await response.json();
    if (response.status === 428 && result.code === "TWO_FACTOR_REQUIRED") setRequiresOtp(true);
    if (!response.ok) { setError(result.message ?? "Не удалось войти."); setLoading(false); return; }
    router.push(safeNext ?? "/app");
    router.refresh();
  }

  return <AuthShell title="С возвращением" description="Войдите, чтобы продолжить общение." alternateText="Нет аккаунта?" alternateHref={safeNext ? `/register?next=${encodeURIComponent(safeNext)}` : "/register"} alternateLabel="Создать">
    <form className="auth-form" onSubmit={submit}>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {sessionsEnded && !error ? <div className="auth-success" role="status">Все активные сессии завершены. Войдите снова на этом устройстве.</div> : null}
      {resetComplete && !error ? <div className="auth-success" role="status">Пароль обновлён. Войдите с новым паролем.</div> : null}
      <label><span>Email</span><div className="auth-input"><Mail size={17} /><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div></label>
      <label><span>Пароль</span><div className="auth-input"><LockKeyhole size={17} /><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Ваш пароль" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
      <Link className="auth-reset-link" href="/reset-password">Забыли пароль?</Link>
      {requiresOtp ? <label><span>Код 2FA или резервный код</span><div className="auth-input"><KeyRound size={17} /><input name="otp" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required autoFocus /></div></label> : null}
      <button className="auth-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Входим...</> : "Войти в FlipZero"}</button>
    </form>
  </AuthShell>;
}

export default function LoginPage() {
  return <Suspense fallback={<AuthShell title="С возвращением" description="Войдите, чтобы продолжить общение." alternateText="Нет аккаунта?" alternateHref="/register" alternateLabel="Создать"><div className="auth-form"><LoaderCircle className="spin" size={22} /></div></AuthShell>}><LoginForm /></Suspense>;
}
