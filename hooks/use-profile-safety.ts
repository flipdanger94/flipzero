"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { parseIgnoredUsers, postProfileSafety } from "@/lib/profile-safety";
const KEY = "flipzero:ignored-users:v1";
export function useProfileSafety(
  userId: string,
  notice: (value: string) => void,
  closeMenu: () => void,
) {
  const [reporting, setReporting] = useState(false);
  const [ignored, setIgnored] = useState(false);
  const [safetyBusy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    const sync = () => {
      try {
        setIgnored(
          parseIgnoredUsers(localStorage.getItem(KEY)).includes(userId),
        );
      } catch {
        setIgnored(false);
      }
    };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [userId]);
  function toggleIgnore() {
    try {
      const ids = new Set(parseIgnoredUsers(localStorage.getItem(KEY)));
      if (ids.has(userId)) ids.delete(userId);
      else ids.add(userId);
      localStorage.setItem(KEY, JSON.stringify([...ids]));
      setIgnored(ids.has(userId));
      notice(
        ids.has(userId)
          ? "Пользователь скрыт локально."
          : "Игнорирование отключено.",
      );
    } catch {
      notice("Не удалось изменить настройку.");
    }
    closeMenu();
  }
  async function perform(
    path: "/api/blocks" | "/api/reports",
    body: object,
    success: string,
  ) {
    if (pending.current) return;
    notice("");
    pending.current = true;
    setBusy(true);
    try {
      await postProfileSafety(path, body);
      setReporting(false);
      closeMenu();
      notice(success);
    } catch (error) {
      notice(
        error instanceof Error
          ? error.message
          : "Не удалось выполнить действие.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function block() {
    return perform("/api/blocks", { userId }, "Пользователь заблокирован.");
  }
  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void perform(
      "/api/reports",
      {
        targetType: "profile",
        targetId: userId,
        reason: String(data.get("reason") ?? "other"),
        description: String(data.get("description") ?? ""),
      },
      "Жалоба отправлена модерации.",
    );
  }
  return {
    reporting,
    setReporting,
    ignored,
    toggleIgnore,
    block,
    submitReport,
    safetyBusy,
  };
}
