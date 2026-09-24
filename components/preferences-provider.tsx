"use client";
import { useEffect } from "react";

type RuntimeTheme={
  id:string;surface:string;panel?:string;deep?:string;raised?:string;accent:string;text?:string;muted?:string;
};

function applyTheme(root:HTMLElement,theme:RuntimeTheme|undefined,accentColor:string,themeId:string){
  root.dataset.theme=themeId;
  root.style.setProperty("--accent",accentColor);
  root.style.setProperty("--pink",accentColor);
  if(!theme)return;
  root.style.setProperty("--theme-surface",theme.surface);
  root.style.setProperty("--bg",theme.surface);
  root.style.setProperty("--panel",theme.panel??theme.surface);
  root.style.setProperty("--deep",theme.deep??theme.surface);
  root.style.setProperty("--raised",theme.raised??theme.panel??theme.surface);
  root.style.setProperty("--text",theme.text??"#f7f4fb");
  root.style.setProperty("--muted",theme.muted??"#9aa1b6");
}

export function PreferencesProvider({userId}:{userId:string}){
  useEffect(()=>{
    let active=true;
    async function refresh(){
      try{
        const response=await fetch("/api/v1/preferences",{cache:"no-store"});
        if(!response.ok||!active)return;
        const {preferences,themes}=await response.json();
        const theme=(themes as RuntimeTheme[]).find((item)=>item.id===preferences.theme);
        applyTheme(document.documentElement,theme,preferences.accentColor,preferences.theme);
      }catch{}
    }
    void refresh();
    const handler=()=>void refresh();
    window.addEventListener("flipzero:preferences-updated",handler);
    return()=>{active=false;window.removeEventListener("flipzero:preferences-updated",handler)};
  },[userId]);
  return null;
}
