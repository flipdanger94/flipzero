"use client";
import { useEffect } from "react";

type RuntimeTheme={
  id:string;surface:string;panel?:string;deep?:string;raised?:string;accent:string;text?:string;muted?:string;appBackground?:string;
};

function applyTheme(root:HTMLElement,theme:RuntimeTheme|undefined,themeId:string){
  root.dataset.theme=themeId;
  if(!theme)return;
  const accentColor=theme.accent;
  root.style.setProperty("--accent",accentColor);
  root.style.setProperty("--pink",accentColor);
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
    root.style.setProperty("--theme-border",`color-mix(in srgb, ${accentColor} 22%, transparent)`);
    root.style.setProperty("--theme-overlay",`color-mix(in srgb, ${theme.deep??theme.surface} 84%, transparent)`);
  }
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
        applyTheme(document.documentElement,theme,preferences.theme);
      }catch{}
    }
    void refresh();
    const handler=()=>void refresh();
    window.addEventListener("flipzero:preferences-updated",handler);
    return()=>{active=false;window.removeEventListener("flipzero:preferences-updated",handler)};
  },[userId]);
  return null;
}
