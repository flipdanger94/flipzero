"use client";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const data = new FormData(event.currentTarget);
    if (data.get("password") !== data.get("confirmPassword")) { setError("Пароли не совпадают."); return; }
    setLoading(true);
    const response = await fetch("/api/v1/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: data.get("email"), username: data.get("username"), displayName: data.get("displayName"), password: data.get("password") }) });
    const result = await response.json();
    if (!response.ok) { setError(result.message ?? "Не удалось создать аккаунт."); setLoading(false); return; }
    router.push("/app");
    router.refresh();
  }

  return <AuthShell title="Создайте аккаунт" description="Ваше новое пространство начинается здесь." alternateText="Уже есть аккаунт?" alternateHref="/login" alternateLabel="Войти">
    <form className="auth-form" onSubmit={submit}>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="auth-row"><label><span>Имя</span><div className="auth-input"><UserRound size={17} /><input name="displayName" autoComplete="name" placeholder="Александр" minLength={2} maxLength={40} required /></div></label><label><span>Никнейм</span><div className="auth-input"><AtSign size={17} /><input name="username" autoComplete="username" placeholder="alex_push" pattern="[A-Za-z0-9_]+" minLength={3} maxLength={24} required /></div></label></div>
      <label><span>Email</span><div className="auth-input"><Mail size={17} /><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div></label>
      <label><span>Пароль</span><div className="auth-input"><LockKeyhole size={17} /><input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Минимум 10 символов" minLength={10} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
      <label><span>Повторите пароль</span><div className="auth-input"><LockKeyhole size={17} /><input name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Повторите пароль" minLength={10} required /></div></label>
      <button className="auth-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Создаём...</> : "Создать аккаунт"}</button>
    </form>
  </AuthShell>;
}
