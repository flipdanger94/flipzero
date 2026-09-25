"use client";
import { useEffect, useRef, useState } from "react";
type Pref={theme:string;accentColor:string;dndEnabled:boolean;dndDays:number[];dndStart:string;dndEnd:string;dndTimezone:string;dndFavoriteIds:string[];dndClanException:boolean};
type Theme={id:string;label:string;access:string;surface:string;panel?:string;deep?:string;raised?:string;accent:string;text?:string;muted?:string;appBackground?:string};

function applyPreview(value:Pref,themes:Theme[]){
 const theme=themes.find(item=>item.id===value.theme);if(!theme)return;
 const root=document.documentElement;
 root.dataset.theme=value.theme;
 root.style.setProperty("--accent",value.accentColor);
 root.style.setProperty("--pink",value.accentColor);
 root.style.setProperty("--theme-surface",theme.surface);
 root.style.setProperty("--bg",theme.surface);
 root.style.setProperty("--panel",theme.panel??theme.surface);
 root.style.setProperty("--deep",theme.deep??theme.surface);
 root.style.setProperty("--raised",theme.raised??theme.panel??theme.surface);
 root.style.setProperty("--text",theme.text??"#f7f4fb");
 root.style.setProperty("--muted",theme.muted??"#9aa1b6");
 const fallbackBackground=`radial-gradient(circle at 74% -16%, color-mix(in srgb, ${theme.accent} 20%, transparent), transparent 34%), linear-gradient(145deg, ${theme.deep??theme.surface}, ${theme.surface})`;
 root.style.setProperty("--app-background",theme.appBackground??fallbackBackground);
 const runtimeThemeVars=["--theme-app","--theme-panel","--theme-deep","--theme-raised","--theme-text","--theme-muted","--theme-input","--theme-border","--theme-overlay"];
 if(theme.appBackground){
  runtimeThemeVars.forEach(name=>root.style.removeProperty(name));
 }else{
  root.style.setProperty("--theme-app",theme.surface);
  root.style.setProperty("--theme-panel",theme.panel??theme.surface);
  root.style.setProperty("--theme-deep",theme.deep??theme.surface);
  root.style.setProperty("--theme-raised",theme.raised??theme.panel??theme.surface);
  root.style.setProperty("--theme-text",theme.text??"#f7f4fb");
  root.style.setProperty("--theme-muted",theme.muted??"#9aa1b6");
  root.style.setProperty("--theme-input",theme.deep??theme.surface);
  root.style.setProperty("--theme-border",`color-mix(in srgb, ${value.accentColor} 22%, transparent)`);
  root.style.setProperty("--theme-overlay",`color-mix(in srgb, ${theme.deep??theme.surface} 84%, transparent)`);
 }
}

export function PersonalizationSettings({kind}:{kind:"appearance"|"notifications"}){
 const [value,setValue]=useState<Pref|null>(null),[themes,setThemes]=useState<Theme[]>([]),[error,setError]=useState(""),[saved,setSaved]=useState(""),[busy,setBusy]=useState(false),[favorites,setFavorites]=useState<Array<{id:string;displayName:string}>>([]);
 const committed=useRef<Pref|null>(null);
 useEffect(()=>{void fetch("/api/v1/preferences",{cache:"no-store"}).then(r=>r.json()).then(data=>{setValue(data.preferences);committed.current=data.preferences;setThemes(data.themes??[])}).catch(()=>setError("Не удалось загрузить настройки."));if(kind==="notifications")void fetch("/api/friends").then(r=>r.json()).then(data=>setFavorites(data.friends??[])).catch(()=>undefined)},[kind]);
 useEffect(()=>{if(kind!=="appearance"||!value||!themes.length)return;applyPreview(value,themes)},[kind,value,themes]);
 useEffect(()=>()=>{if(kind==="appearance"&&committed.current&&themes.length)applyPreview(committed.current,themes)},[kind,themes]);
 async function save(){if(!value)return;setBusy(true);setError("");setSaved("");try{const response=await fetch("/api/v1/preferences",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(value)}),data=await response.json();if(!response.ok)throw Error(data.message);setValue(data.preferences);committed.current=data.preferences;setSaved("Сохранено в аккаунте.");window.dispatchEvent(new Event("flipzero:preferences-updated"))}catch(reason){setError(reason instanceof Error?reason.message:"Ошибка сохранения.")}finally{setBusy(false)}}
 if(!value)return <p>Загружаем настройки…</p>;
 return <section className="personalization-settings">{kind==="appearance"?<><h3>Тема и акцент</h3><p className="theme-preview-note">Изменения применяются сразу как предпросмотр. Нажмите «Сохранить настройки», чтобы закрепить их в аккаунте.</p><div className="theme-choices">{themes.map(theme=><button key={theme.id} className={value.theme===theme.id?"active":""} onClick={()=>setValue({...value,theme:theme.id,accentColor:theme.accent})}><span className="theme-preview" style={{background:theme.appBackground??theme.surface,borderColor:theme.accent}}><i style={{background:theme.deep??theme.surface}}/><i style={{background:theme.panel??theme.surface}}/><i style={{background:theme.raised??theme.surface}}/></span><strong>{theme.label}</strong><small>{theme.access==="free"?"Доступна всем":theme.access==="superflip"?"SuperFlip":theme.access.startsWith("shop:")?"Магазин":"Тема FlipZero"}</small></button>)}</div><label>Акцентный цвет <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value.accentColor)?value.accentColor:"#8f70ff"} onChange={event=>setValue({...value,accentColor:event.target.value})}/><input aria-label="HEX цвета" value={value.accentColor} onChange={event=>setValue({...value,accentColor:event.target.value})}/></label></>:<><h3>Тихие часы</h3><label><input type="checkbox" checked={value.dndEnabled} onChange={event=>setValue({...value,dndEnabled:event.target.checked})}/> Не беспокоить по расписанию</label><div className="personalization-days">{["Вс","Пн","Вт","Ср","Чт","Пт","Сб"].map((label,index)=><button key={label} className={value.dndDays.includes(index)?"active":""} aria-pressed={value.dndDays.includes(index)} onClick={()=>setValue({...value,dndDays:value.dndDays.includes(index)?value.dndDays.filter(day=>day!==index):[...value.dndDays,index]})}>{label}</button>)}</div><div className="personalization-times"><label>С <input type="time" value={value.dndStart} onChange={event=>setValue({...value,dndStart:event.target.value})}/></label><label>До <input type="time" value={value.dndEnd} onChange={event=>setValue({...value,dndEnd:event.target.value})}/></label><label>Часовой пояс <input value={value.dndTimezone} onChange={event=>setValue({...value,dndTimezone:event.target.value})} placeholder="Europe/Moscow"/></label></div><label><input type="checkbox" checked={value.dndClanException} onChange={event=>setValue({...value,dndClanException:event.target.checked})}/> Разрешить уведомления клана</label><strong>Избранные друзья</strong><div className="personalization-favorites">{favorites.length?favorites.map(friend=><label key={friend.id}><input type="checkbox" checked={value.dndFavoriteIds.includes(friend.id)} onChange={event=>setValue({...value,dndFavoriteIds:event.target.checked?[...value.dndFavoriteIds,friend.id]:value.dndFavoriteIds.filter(id=>id!==friend.id)})}/>{friend.displayName}</label>):<small>Добавьте друзей, чтобы выбрать исключения.</small>}</div></>}{error?<p role="alert">{error}</p>:null}{saved?<p role="status">{saved}</p>:null}<button className="account-primary" disabled={busy} onClick={()=>void save()}>{busy?"Сохраняем…":"Сохранить настройки"}</button></section>
}
