"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, LoaderCircle, Sparkles, UserRound, Users } from "lucide-react";
import { ImageUpload } from "./image-upload";
import { MediaImage } from "./media-image";

type OnboardingResult = { step: number; completed: boolean; spaceId?: string; message?: string };

export function OnboardingWizard({ initialStep = 0, onComplete }: { initialStep?: number; onComplete: (spaceId?: string) => void | Promise<void> }) {
  const [step, setStep] = useState(Math.min(3, initialStep) + 1);
  const stepRef = useRef(step);
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => {
    const stateKey = "flipzeroOnboardingStep";
    window.history.pushState({ ...window.history.state, [stateKey]: stepRef.current }, "");
    const onPopState = (event: PopStateEvent) => {
      const historyStep = Number(event.state?.[stateKey]);
      if (Number.isInteger(historyStep) && historyStep >= 1 && historyStep <= 4) {
        setStep(historyStep);
        setError("");
        return;
      }
      const previous = Math.max(1, stepRef.current - 1);
      setStep(previous);
      setError("");
      window.history.pushState({ ...window.history.state, [stateKey]: previous }, "");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const goToStep = useCallback((next: number) => {
    setStep(next);
    setError("");
    setNotice("");
    window.history.pushState({ ...window.history.state, flipzeroOnboardingStep: next }, "");
  }, []);

  async function saveStep(extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ step, ...extra }) });
      const result = await response.json().catch(() => null) as OnboardingResult | null;
      if (!response.ok) throw new Error(result?.message ?? "Не удалось сохранить этот шаг. Попробуйте ещё раз.");
      return result;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Нет соединения. Проверьте интернет и попробуйте снова.");
      return null;
    } finally { setBusy(false); }
  }

  async function advance() {
    const result = await saveStep(step === 2 ? { bio } : {});
    if (!result) return;
    if (step === 4) await onComplete();
    else goToStep(step + 1);
  }

  async function joinDemo() {
    const result = await saveStep({ joinDemo: true, complete: true });
    if (!result?.spaceId) { setError("Пространство FlipZero HQ пока недоступно. Попробуйте ещё раз позже."); return; }
    await onComplete(result.spaceId);
  }

  function goBack() { if (!busy && step > 1) window.history.back(); }

  async function share() {
    const url = `${location.origin}/register`;
    if (navigator.share) {
      try { await navigator.share({ title: "FlipZero", text: "Присоединяйся ко мне в FlipZero", url }); return; }
      catch (reason) { if (reason instanceof Error && reason.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); setNotice("Ссылка скопирована"); }
    catch { setError("Не удалось скопировать ссылку. Скопируйте адрес страницы вручную."); }
  }

  return <div className="dialog-backdrop onboarding-backdrop"><section className="onboarding-wizard" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" aria-describedby="onboarding-description">
    <div className="onboarding-progress"><span style={{ width: `${step * 25}%` }} /></div><small>ШАГ {step} ИЗ 4 · +50 XP</small>
    <div className="onboarding-step-content">
      {step === 1 ? <><div className={`onboarding-avatar-preview ${avatarUrl ? "has-image" : ""}`}>{avatarUrl ? <MediaImage src={avatarUrl} alt="Предпросмотр аватара" sizes="96px" /> : <UserRound size={48} />}</div><h2 id="onboarding-title">Добавьте аватар</h2><p id="onboarding-description">Обрежьте своё фото или продолжите с текущей иконкой.</p><ImageUpload kind="avatar" label="Выбрать фото" currentUrl={avatarUrl} onUploaded={(result) => { const next = result.user?.avatarUrl; if (typeof next === "string") { setAvatarUrl(next); setNotice("Аватар загружен и сохранён."); setError(""); } }} /></>
        : step === 2 ? <><Sparkles size={42} /><h2 id="onboarding-title">Расскажите о себе</h2><p id="onboarding-description">Короткое описание поможет найти единомышленников.</p><textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={190} placeholder="Например: люблю дизайн, игры и музыку" aria-label="Обо мне" /><span className="onboarding-counter">{bio.length}/190</span></>
        : step === 3 ? <><Users size={42} /><h2 id="onboarding-title">FlipZero HQ</h2><p id="onboarding-description">Вступите в демонстрационное сообщество и познакомьтесь с возможностями платформы.</p><button type="button" className="onboarding-secondary" onClick={() => void joinDemo()} disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18} /> Вступаем…</> : "Вступить в пространство"}</button></>
        : <><Copy size={42} /><h2 id="onboarding-title">Пригласите друга</h2><p id="onboarding-description">FlipZero интереснее вместе. Поделитесь персональной ссылкой или завершите знакомство.</p><button type="button" className="onboarding-secondary" onClick={() => void share()}>Скопировать ссылку</button></>}
      {notice ? <p className="onboarding-feedback success" role="status">{notice}</p> : null}{error ? <p className="onboarding-feedback error" role="alert">{error}</p> : null}
    </div>
    <footer><button type="button" className="onboarding-back" onClick={goBack} disabled={step <= 1 || busy}><ArrowLeft size={18} /> Назад</button><button type="button" onClick={() => void advance()} disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18} /> Сохраняем…</> : step === 4 ? <><Check size={18} /> Завершить</> : <>Пропустить <ArrowRight size={18} /></>}</button></footer>
  </section></div>;
}
