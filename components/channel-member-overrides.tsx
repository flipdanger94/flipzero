"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Save, UserRound } from "lucide-react";
import { Permission } from "@/lib/permissions";

type State = "inherit" | "allow" | "deny";
type Member = { userId: string; displayName: string; username: string | null; nickname?: string | null };
type MemberOverride = { targetId: string; targetType: string; allow: number; deny: number };

const permissionOptions = [
  ["Просмотр канала", Permission.ViewChannels],
  ["Отправка сообщений", Permission.SendMessages],
  ["Управление сообщениями", Permission.ManageMessages],
  ["Подключение к голосу", Permission.ConnectVoice],
  ["Использование микрофона", Permission.SpeakVoice],
  ["Запуск трансляций", Permission.Stream],
] as const;

export function ChannelMemberOverrides({ spaceId, channelId }: { spaceId: string; channelId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [overrides, setOverrides] = useState<MemberOverride[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState({ allow: 0, deny: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/v1/spaces/${spaceId}/members`, { signal: controller.signal }).then(async (response) => ({ response, data: await response.json() })),
      fetch(`/api/v1/channels/${channelId}/overrides`, { signal: controller.signal }).then(async (response) => ({ response, data: await response.json() })),
    ]).then(([memberResult, overrideResult]) => {
      if (!memberResult.response.ok) throw new Error(memberResult.data?.message ?? "Не удалось загрузить участников.");
      if (!overrideResult.response.ok) throw new Error(overrideResult.data?.message ?? "Не удалось загрузить исключения.");
      const loadedMembers = (memberResult.data.members ?? []) as Member[];
      const loadedOverrides = ((overrideResult.data.overrides ?? []) as MemberOverride[]).filter((item) => item.targetType === "member");
      setMembers(loadedMembers);
      setOverrides(loadedOverrides);
      setSelectedId(loadedMembers[0]?.userId ?? "");
    }).catch((reason) => {
      if (reason?.name !== "AbortError") setError(reason?.message ?? "Не удалось загрузить персональные права.");
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [spaceId, channelId]);

  const selected = useMemo(() => members.find((member) => member.userId === selectedId) ?? null, [members, selectedId]);

  useEffect(() => {
    const current = overrides.find((item) => item.targetId === selectedId);
    setDraft({ allow: current?.allow ?? 0, deny: current?.deny ?? 0 });
    setSaved(false);
  }, [overrides, selectedId]);

  function stateFor(flag: number): State {
    if ((draft.allow & flag) === flag) return "allow";
    if ((draft.deny & flag) === flag) return "deny";
    return "inherit";
  }

  function change(flag: number, state: State) {
    setSaved(false);
    setDraft((current) => {
      let allow = current.allow & ~flag;
      let deny = current.deny & ~flag;
      if (state === "allow") allow |= flag;
      if (state === "deny") deny |= flag;
      return { allow, deny };
    });
  }

  async function save() {
    if (!selectedId) return;
    setSaving(true);
    setError("");
    setSaved(false);
    const empty = draft.allow === 0 && draft.deny === 0;
    const response = await fetch(
      `/api/v1/channels/${channelId}/overrides${empty ? `?targetId=${encodeURIComponent(selectedId)}` : ""}`,
      empty
        ? { method: "DELETE" }
        : {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ targetId: selectedId, targetType: "member", allow: draft.allow, deny: draft.deny }),
          },
    );
    const data = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setError(data?.message ?? "Не удалось сохранить персональные права.");
      return;
    }
    setOverrides((current) => [
      ...current.filter((item) => item.targetId !== selectedId),
      ...(empty ? [] : [{ targetId: selectedId, targetType: "member", allow: draft.allow, deny: draft.deny }]),
    ]);
    setSaved(true);
  }

  return <section className="member-override-section">
    <div className="override-heading">
      <UserRound size={20} />
      <div><strong>Персональные права</strong><span>Исключение участника применяется после прав его ролей.</span></div>
    </div>
    {error ? <div className="auth-error" role="alert">{error}</div> : null}
    {loading ? <div className="role-loading"><LoaderCircle className="spin" size={20} /> Загружаем участников...</div> : members.length ? <>
      <label className="member-override-picker"><span>Участник</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{members.map((member) => <option key={member.userId} value={member.userId}>{member.nickname || member.displayName} · @{member.username || "user"}</option>)}</select></label>
      {selected ? <div className="override-grid">{permissionOptions.map(([label, flag]) => <label key={flag}><span>{label}</span><select value={stateFor(flag)} onChange={(event) => change(flag, event.target.value as State)}><option value="inherit">Наследовать</option><option value="allow">Разрешить</option><option value="deny">Запретить</option></select></label>)}</div> : null}
      <button className="auth-submit override-save" onClick={save} disabled={saving || !selectedId}>{saving ? <LoaderCircle className="spin" size={17} /> : <><Save size={16} /> {saved ? "Сохранено" : "Сохранить участника"}</>}</button>
    </> : <div className="role-protected"><UserRound size={28} /><strong>Участники не найдены</strong></div>}
  </section>;
}
