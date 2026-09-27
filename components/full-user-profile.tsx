"use client";

import { type CSSProperties, type RefObject } from "react";
import { AppIcon } from "./app-icon";
import { MediaImage } from "./media-image";
import { ClanTag, type ClanTagData } from "./clan-tag";
import { ProfileVisitCard } from "./profile-visit-card";

type CommonFriend = { id:string; username:string; displayName:string; avatarUrl:string|null };
type CommonServer = { id:string; name:string; iconUrl:string|null };

export type FullProfileData = {
  id:string; username:string; displayName:string; avatarUrl:string|null; bannerUrl:string|null; bio:string|null;
  presence:string; globalLevel:number; globalXp:number; createdAt:string; profileLocation:string|null;
  profileStatus:string|null; currentLevelXp:number; nextLevelXp:number; xpToNextLevel:number; isOwnProfile:boolean;
  friendshipStatus:"friends"|"outgoing"|"incoming"|"none"; stats:{messages:number;friends:number;servers:number};
  commonFriends:CommonFriend[]; commonServers:CommonServer[];
  clan:ClanTagData|null; cosmetics?:Record<string,string>;
  badges?:Array<{id:string;name:string;icon:string;rarity:string}>;
  profileGames?:string[]; profileMusic?:{title?:string;artist?:string;url?:string};
  profileWidgets?:string[]; customStatusEmoji?:string|null; customStatusExpiresAt?:string|null; profileLinks?:string[];
};

type Tab = "activity"|"friends"|"servers";

export function FullUserProfile({
  profile:p,
  rootRef,
  tab,
  busy,
  onTab,
  onClose,
  onMessage,
  onVoice,
  onVideo,
  onFriendAction,
  onSaved,
}:{
  profile:FullProfileData;
  rootRef:RefObject<HTMLElement|null>;
  tab:Tab;
  busy:boolean;
  onTab:(tab:Tab)=>void;
  onClose:()=>void;
  onMessage:()=>void;
  onVoice:()=>void;
  onVideo:()=>void;
  onFriendAction:()=>void;
  onSaved:(updates:Partial<FullProfileData>)=>void;
}) {
  const initials=p.displayName.slice(0,2).toLocaleUpperCase("ru");
  const progress=p.globalLevel>=100?100:Math.max(0,Math.min(100,((p.globalXp-p.currentLevelXp)/Math.max(1,p.nextLevelXp-p.currentLevelXp))*100));
  const joined=new Date(p.createdAt).toLocaleDateString("ru-RU",{month:"long",year:"numeric"});
  const location=p.profileLocation||"Местоположение не указано";

  return <section ref={rootRef} tabIndex={-1} className={`fz-profile-v2 effect-${p.cosmetics?.profile_effect??"none"}`} role="dialog" aria-modal="true" aria-label={`Полный профиль ${p.displayName}`} style={{"--profile-accent":"var(--accent,#8f70ff)"} as CSSProperties}>
    <button className="fz-profile-v2-close" type="button" onClick={onClose} aria-label="Закрыть профиль"><AppIcon name="close" size={20}/></button>

    <header className="fz-profile-v2-hero">
      <div className={`fz-profile-v2-banner cosmetic-${p.cosmetics?.banner??"none"}`} style={p.bannerUrl?{backgroundImage:`linear-gradient(180deg,rgba(4,8,23,.06),rgba(4,8,23,.48)),url("${p.bannerUrl}")`}:undefined}/>
      <div className="fz-profile-v2-identity">
        <div className={`fz-profile-v2-avatar frame-${p.cosmetics?.avatar_frame??"none"}`}>
          {p.avatarUrl?<MediaImage src={p.avatarUrl} sizes="116px"/>:initials}
          <i className={p.presence==="online"?"online":""}/>
        </div>
        <div className="fz-profile-v2-name">
          <div className="fz-profile-v2-title-row">
            <h1 className={p.cosmetics?.nickname?`nick-${p.cosmetics.nickname}`:""}>{p.displayName}</h1>
            {p.cosmetics?.badge?<span className={`store-profile-badge badge-${p.cosmetics.badge}`} title="Косметический значок">✦</span>:null}
            {p.clan?<ClanTag clan={p.clan} variant="full"/>:null}
          </div>
          <p>@{p.username}</p>
          <div className="fz-profile-v2-meta">
            <span className={`fz-profile-v2-presence ${p.presence==="online"?"online":""}`}>{p.presence==="online"?"В сети":"Не в сети"}</span>
            <span>Уровень {p.globalLevel}</span>
            <span>{location}</span>
          </div>
        </div>
        <div className="fz-profile-v2-actions">
          {!p.isOwnProfile?<><button className="primary" onClick={onMessage}><AppIcon name="messages" size={17}/>Написать</button>
          <button onClick={onVoice} aria-label="Позвонить"><AppIcon name="call" size={18}/></button>
          <button onClick={onVideo} aria-label="Видеозвонок"><AppIcon name="video" size={18}/></button>
          <button onClick={onFriendAction} disabled={busy||p.friendshipStatus==="outgoing"} aria-label="Действие с дружбой"><AppIcon name={p.friendshipStatus==="friends"?"user-remove":p.friendshipStatus==="outgoing"?"check":"friends"} size={18}/></button></>:<span className="fz-profile-v2-own">Ваш профиль</span>}
          <button aria-label="Ещё"><AppIcon name="more" size={18}/></button>
        </div>
      </div>
    </header>

    <nav className="fz-profile-v2-tabs" aria-label="Разделы профиля">
      <button className={tab==="activity"?"active":""} onClick={()=>onTab("activity")}>Обо мне</button>
      <button className={tab==="friends"?"active":""} onClick={()=>onTab("friends")}>Друзья <b>{p.commonFriends.length}</b></button>
      <button className={tab==="servers"?"active":""} onClick={()=>onTab("servers")}>Серверы <b>{p.commonServers.length}</b></button>
    </nav>

    {tab==="activity"?<div className="fz-profile-v2-grid">
      <section className="fz-profile-v2-card fz-profile-v2-about">
        <div className="fz-profile-v2-card-head"><h2>Обо мне</h2>{p.isOwnProfile?<span><AppIcon name="edit" size={14}/>Редактируется в настройках</span>:null}</div>
        <p>{p.bio||"Пользователь пока ничего о себе не рассказал."}</p>
        {p.profileStatus?<div className="fz-profile-v2-status"><span>{p.customStatusEmoji||"✦"}</span>{p.profileStatus}</div>:null}
        <dl>
          <div><dt>Локация</dt><dd>{location}</dd></div>
          <div><dt>В FlipZero с</dt><dd>{joined}</dd></div>
        </dl>
        {p.profileGames?.length?<div className="fz-profile-v2-tags">{p.profileGames.slice(0,6).map(game=><span key={game}>{game}</span>)}</div>:null}
        {p.profileLinks?.length?<div className="fz-profile-v2-links">{p.profileLinks.slice(0,5).map(link=><a key={link} href={link} target="_blank" rel="noreferrer">{link.replace(/^https?:\/\//,"")}</a>)}</div>:null}
      </section>

      <section className="fz-profile-v2-card fz-profile-v2-progress">
        <div className="fz-profile-v2-card-head"><h2>Достижения</h2><span>{p.badges?.length??0} получено</span></div>
        <div className="fz-profile-v2-level">
          <strong>LVL {p.globalLevel}</strong>
          <span>{p.globalXp.toLocaleString("ru-RU")} XP</span>
        </div>
        <div className="fz-profile-v2-progressbar"><i style={{width:`${progress}%`}}/></div>
        <small>{p.globalLevel>=100?"Максимальный уровень":`${p.xpToNextLevel.toLocaleString("ru-RU")} XP до следующего уровня`}</small>
        <div className="fz-profile-v2-badges">
          {p.badges?.length?p.badges.slice(0,6).map(badge=><span key={badge.id} title={badge.name}>{badge.icon||"✦"}</span>):<span className="empty">Пока без достижений</span>}
        </div>
      </section>

      <aside className="fz-profile-v2-side">
        <section className="fz-profile-v2-card">
          <div className="fz-profile-v2-card-head"><h2>Статистика</h2></div>
          <div className="fz-profile-v2-stats">
            <span><b>{p.stats.friends}</b><small>Друзья</small></span>
            <span><b>{p.stats.servers}</b><small>Серверы</small></span>
            <span><b>{p.stats.messages}</b><small>Сообщения</small></span>
            <span><b>{p.globalLevel}</b><small>Уровень</small></span>
          </div>
        </section>
        {p.clan?<section className="fz-profile-v2-card"><div className="fz-profile-v2-card-head"><h2>Клан</h2></div><ClanTag clan={p.clan} variant="full"/></section>:null}
      </aside>

      <section className="fz-profile-v2-card fz-profile-v2-visit">
        <ProfileVisitCard key={p.id} profile={p} onSaved={onSaved}/>
      </section>
    </div>:null}

    {tab==="friends"?<div className="fz-profile-v2-list">
      {p.commonFriends.length?p.commonFriends.map(friend=><article key={friend.id}><i>{friend.avatarUrl?<MediaImage src={friend.avatarUrl}/>:friend.displayName.slice(0,2)}</i><span><strong>{friend.displayName}</strong><small>@{friend.username}</small></span></article>):<div className="fz-profile-v2-empty"><strong>Нет общих друзей</strong><p>Когда появятся общие контакты, они будут показаны здесь.</p></div>}
    </div>:null}

    {tab==="servers"?<div className="fz-profile-v2-list">
      {p.commonServers.length?p.commonServers.map(server=><article key={server.id}><i>{server.iconUrl?<MediaImage src={server.iconUrl}/>:server.name.slice(0,2)}</i><span><strong>{server.name}</strong><small>Общее пространство</small></span></article>):<div className="fz-profile-v2-empty"><strong>Нет общих серверов</strong><p>Общие пространства появятся здесь.</p></div>}
    </div>:null}
  </section>;
}
