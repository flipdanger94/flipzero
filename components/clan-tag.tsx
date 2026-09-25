"use client";
import { Crown, Flame, MoonStar, Orbit, Shield, Skull, Star, Swords, Trophy, Zap } from "lucide-react";

export type ClanTagData={id:string;name:string;tag:string;tagColor:string;tagIcon:string;level?:number;rank?:number};
type ClanTagVariant="inline"|"full";
const icons={crown:Crown,flame:Flame,shield:Shield,skull:Skull,star:Star,swords:Swords,zap:Zap,orbit:Orbit,moon:MoonStar,laurel:Trophy};

export function ClanTag({
  clan,
  tag,
  variant="inline",
  preview=false,
  className="",
}:{
  clan?:ClanTagData|null;
  tag?:string|null;
  variant?:ClanTagVariant;
  preview?:boolean;
  className?:string;
}){
  const fallbackTag=tag?.trim();
  if(!clan&&!fallbackTag)return null;
  const Icon=icons[clan?.tagIcon as keyof typeof icons]??Shield;
  const hasHex=Boolean(clan&&/^#[0-9a-fA-F]{6}$/.test(clan.tagColor));
  const color=hasHex?clan!.tagColor:"var(--accent,#8B77FF)";
  const readable=hasHex?(()=>{
    const channels=[1,3,5].map(index=>parseInt(clan!.tagColor.slice(index,index+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
    const luminance=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
    return luminance<.18?"#f5f3ff":clan!.tagColor;
  })():"var(--accent,#b9a8ff)";
  const label=clan?.tag??fallbackTag!;
  const title=clan?`${clan.name} · уровень ${clan.level??1}${clan.rank?` · место #${clan.rank}`:""}`:`Клан [${label}]`;
  const badgeClass=`clan-tag-badge clan-tag-${variant} ${className}`.trim();
  const content=<><Icon size={variant==="inline"?10:12}/><span>[{label}]</span></>;
  const style={color:readable,borderColor:color,backgroundColor:hasHex?`${clan!.tagColor}22`:"color-mix(in srgb,var(--accent) 14%,transparent)"};
  const badge=clan?.id&&!preview
    ? <button type="button" className={badgeClass} style={style} title={title} aria-label={`Открыть клан ${clan.name}`} onClick={()=>window.dispatchEvent(new CustomEvent("flipzero:open-clan",{detail:clan.id}))}>{content}</button>
    : <span className={badgeClass} style={style} title={title}>{content}</span>;

  if(variant==="full"&&clan){
    return <span className="clan-tag-full">{badge}<small>{clan.name} · ур. {clan.level??1}{clan.rank?` · место #${clan.rank}`:""}</small></span>;
  }
  return badge;
}
