"use client";
import { Crown, Flame, Shield, Skull, Star, Swords, Zap } from "lucide-react";

export type ClanTagData={id:string;name:string;tag:string;tagColor:string;tagIcon:string;level?:number;rank?:number};
const icons={crown:Crown,flame:Flame,shield:Shield,skull:Skull,star:Star,swords:Swords,zap:Zap};
export function ClanTag({clan,details=false,preview=false}:{clan:ClanTagData|null|undefined;details?:boolean;preview?:boolean}){
  if(!clan)return null;
  const Icon=icons[clan.tagIcon as keyof typeof icons]??Shield;
  const color=/^#[0-9a-fA-F]{6}$/.test(clan.tagColor)?clan.tagColor:"#8B77FF";
  const channels=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  const luminance=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
  const readable=luminance<.18?"#f5f3ff":color;
  return <button type="button" disabled={preview} className="clan-tag-badge" style={{color:readable,borderColor:`${color}af`,backgroundColor:`${color}30`}} title={`${clan.name} · уровень ${clan.level??1}${clan.rank?` · #${clan.rank}`:""}`} aria-label={`Открыть клан ${clan.name}`} onClick={()=>window.dispatchEvent(new CustomEvent("flipzero:open-clan",{detail:clan.id}))}><Icon size={12}/><span>[{clan.tag}]</span>{details?<small>{clan.name} · ур. {clan.level??1}{clan.rank?` · #${clan.rank}`:""}</small>:null}</button>;
}
