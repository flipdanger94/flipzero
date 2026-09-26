"use client";

import type { CSSProperties, ReactNode } from "react";
import { MediaImage } from "./media-image";
import { ClanTag, type ClanTagData } from "./clan-tag";

export type ProfileAppearanceData = {
  id?: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  profileStatus?: string | null;
  customStatusEmoji?: string | null;
  presence?: string;
  globalLevel?: number;
  globalXp?: number;
  currentLevelXp?: number;
  nextLevelXp?: number;
  xpToNextLevel?: number;
  isFriend?: boolean;
  clan?: ClanTagData | null;
  badges?: Array<{id:string;name:string;icon:string;rarity:string}>;
  cosmetics?: Record<string,string>;
};

export function ProfileAppearanceSurface({
  profile,
  cosmetics = profile.cosmetics ?? {},
  actions,
  footer,
  className = "",
  previewLabel,
}:{
  profile: ProfileAppearanceData;
  cosmetics?: Record<string,string>;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  previewLabel?: string;
}){
  const level=profile.globalLevel??1;
  const xp=profile.globalXp??0;
  const current=profile.currentLevelXp??0;
  const next=profile.nextLevelXp??Math.max(1,current+100);
  const progress=level>=100?100:Math.max(0,Math.min(100,((xp-current)/Math.max(1,next-current))*100));
  const remaining=profile.xpToNextLevel??Math.max(0,next-xp);
  const banner=cosmetics.banner??"none";
  const frame=cosmetics.avatar_frame??"none";
  const nameplate=cosmetics.nickname??"";
  const effect=cosmetics.profile_effect??"none";
  const badge=cosmetics.badge??"";
  const chat=cosmetics.message_effect??"none";

  return <section className={`fz-mini-profile profile-appearance-surface effect-${effect} chat-${chat} ${className}`.trim()} style={{"--profile-accent":"var(--accent,#8f70ff)"} as CSSProperties}>
    <div className={`fz-mini-banner cosmetic-${banner}`} style={profile.bannerUrl?{backgroundImage:`linear-gradient(180deg,transparent,rgba(7,12,25,.5)),url("${profile.bannerUrl}")`}:undefined}>
      {previewLabel?<span className="profile-appearance-preview-label">{previewLabel}</span>:null}
    </div>
    <div className="fz-mini-body">
      <div className={`fz-mini-avatar frame-${frame}`}>
        {profile.avatarUrl?<MediaImage src={profile.avatarUrl}/>:profile.displayName.slice(0,2).toLocaleUpperCase("ru")}
        <i className={profile.presence==="online"?"online":""}/>
      </div>
      <div className="fz-mini-identity">
        <div className="fz-mini-name-row">
          <strong className={nameplate?`nick-${nameplate}`:""}>{profile.displayName}</strong>
          {badge?<span className={`store-profile-badge badge-${badge}`} title="Косметический значок" aria-label="Косметический значок">✦</span>:null}
          <ClanTag clan={profile.clan??null} variant="inline"/>
        </div>
        <span>@{profile.username}</span>
        <small>Уровень {level} · {profile.presence==="online"?"в сети":"не в сети"}</small>
      </div>
      {actions}
      <div className="fz-mini-section">
        <small>ОБО МНЕ</small>
        <p>{profile.bio||"Пользователь пока ничего о себе не рассказал."}</p>
        {profile.profileStatus?<p>{profile.customStatusEmoji} {profile.profileStatus}</p>:null}
      </div>
      <div className="fz-mini-xp">
        <span><b>{xp} XP</b><small>{level>=100?"Максимальный уровень":`До уровня ${level+1}: ${remaining} XP`}</small></span>
        <i><b style={{width:`${progress}%`}}/></i>
      </div>
      <div className="fz-mini-badges">
        <span>LVL {level}</span>
        {profile.badges?.slice(0,3).map(item=><span key={item.id} title={item.name}>{item.icon} {item.name}</span>)}
        {profile.isFriend?<span>ДРУГ</span>:null}
        {profile.presence==="online"?<span>ONLINE</span>:null}
      </div>
      <div className={`profile-appearance-message message-effect-${chat}`}><span>{profile.displayName}</span><p>Так будет выглядеть стиль сообщения в чате.</p></div>
      {footer}
    </div>
  </section>;
}
