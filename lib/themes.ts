import "server-only";
import { asc } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { appThemes } from "@/db/schema";
import builtinThemes from "@/config/themes.json";

export type AppTheme = {
  id:string;
  label:string;
  access:string;
  surface:string;
  panel:string;
  deep:string;
  raised:string;
  accent:string;
  text:string;
  muted:string;
  appBackground?:string;
  custom?:boolean;
};

const builtins = builtinThemes as AppTheme[];

export async function getAppThemes(): Promise<AppTheme[]> {
  try {
    const custom = await getDatabase().select().from(appThemes).orderBy(asc(appThemes.label));
    return [
      ...builtins,
      ...custom.map((theme)=>({
        id:theme.id,
        label:theme.label,
        access:theme.access,
        surface:theme.surface,
        panel:theme.panel,
        deep:theme.deep,
        raised:theme.raised,
        accent:theme.accent,
        text:theme.textColor,
        muted:theme.muted,
        custom:true,
      })),
    ];
  } catch {
    return builtins;
  }
}

export function isBuiltinTheme(id:string){
  return builtins.some((theme)=>theme.id===id);
}
