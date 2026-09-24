"use client";
import { useEffect, useRef, useState } from "react";
import { Crown, Flame, Shield, Skull, Star, Swords, Zap } from "lucide-react";
import { ClanTag } from "./clan-tag";

const icons={shield:Shield,crown:Crown,swords:Swords,flame:Flame,zap:Zap,skull:Skull,star:Star};
const palette=["#8B77FF","#57B6FF","#48CD9A","#FFC76E","#FF708B","#F294F0"];
export function ClanTagPicker({tag,initialColor="#8B77FF",initialIcon="shield"}:{tag:string;initialColor?:string;initialIcon?:string}){
  const [color,setColor]=useState(initialColor);
  const [icon,setIcon]=useState(initialIcon);
  const [previewTag,setPreviewTag]=useState(tag);
  const root=useRef<HTMLFieldSetElement>(null);
  useEffect(()=>{const input=root.current?.closest("form")?.querySelector<HTMLInputElement>('input[name="tag"]');if(!input)return;const update=()=>setPreviewTag(input.value.toUpperCase());input.addEventListener("input",update);return()=>input.removeEventListener("input",update)},[]);
  const valid=/^#[0-9a-fA-F]{6}$/.test(color);
  return <fieldset ref={root} className="clan-tag-picker"><legend>Оформление тега</legend>
    <input type="hidden" name="tagColor" value={color}/><input type="hidden" name="tagIcon" value={icon}/>
    <div className="clan-tag-colors">{palette.map(option=><button type="button" key={option} className={color===option?"selected":""} style={{backgroundColor:option}} onClick={()=>setColor(option)} aria-label={`Цвет ${option}`} aria-pressed={color===option}/>)}<label title="Свой цвет"><input type="color" aria-label="Выбрать произвольный цвет" value={valid?color:"#8B77FF"} onChange={event=>setColor(event.target.value)}/></label><input className="clan-tag-hex" aria-label="Цвет тега в HEX" value={color} maxLength={7} onChange={event=>setColor(event.target.value)} pattern="#[0-9a-fA-F]{6}" required/></div>
    <div className="clan-tag-icons">{Object.entries(icons).map(([value,Icon])=><button type="button" key={value} className={icon===value?"selected":""} onClick={()=>setIcon(value)} aria-label={`Значок ${value}`} aria-pressed={icon===value}><Icon size={19}/></button>)}</div>
    <div className="clan-tag-preview"><span>После ника:</span><strong>Ваш ник</strong><ClanTag preview clan={{id:"preview",name:"Ваш клан",tag:previewTag||tag||"TAG",tagColor:valid?color:"#8B77FF",tagIcon:icon}}/></div>
    {!valid?<small role="alert">Введите цвет в формате #RRGGBB.</small>:null}
  </fieldset>;
}
