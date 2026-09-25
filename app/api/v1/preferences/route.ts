import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { cosmeticInventory, userPreferences } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasActiveSuperFlip } from "@/lib/superflip";
import { isTrustedMutationRequest } from "@/lib/security-controls";
import { getAppThemes } from "@/lib/themes";

const defaults={theme:"midnight",dndEnabled:false,dndDays:[] as number[],dndStart:"22:00",dndEnd:"08:00",dndTimezone:"UTC",dndFavoriteIds:[] as string[],dndClanException:false};
function publicPreferences<T extends {accentColor?:string}>(value:T){const {accentColor:_deprecated,...preferences}=value;return preferences}

export async function GET(){
 const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 const [preferences,themes]=await Promise.all([
  getDatabase().select().from(userPreferences).where(eq(userPreferences.userId,user.id)).limit(1),
  getAppThemes(),
 ]);
 const current=preferences[0]?publicPreferences(preferences[0]):defaults;
 return NextResponse.json({preferences:current,themes});
}

export async function PATCH(request:Request){
 if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
 const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 const body=await request.json().catch(()=>null);if(!body||typeof body!=="object")return NextResponse.json({message:"Некорректные настройки."},{status:400});
 const db=getDatabase(),[[current],themes]=await Promise.all([
  db.select().from(userPreferences).where(eq(userPreferences.userId,user.id)).limit(1),
  getAppThemes(),
 ]);
 const raw=body as Record<string,unknown>;
 const next={
  theme:typeof raw.theme==="string"?raw.theme:(current?.theme??defaults.theme),
  dndEnabled:typeof raw.dndEnabled==="boolean"?raw.dndEnabled:(current?.dndEnabled??defaults.dndEnabled),
  dndDays:Array.isArray(raw.dndDays)?raw.dndDays:(current?.dndDays??defaults.dndDays),
  dndStart:typeof raw.dndStart==="string"?raw.dndStart:(current?.dndStart??defaults.dndStart),
  dndEnd:typeof raw.dndEnd==="string"?raw.dndEnd:(current?.dndEnd??defaults.dndEnd),
  dndTimezone:typeof raw.dndTimezone==="string"?raw.dndTimezone:(current?.dndTimezone??defaults.dndTimezone),
  dndFavoriteIds:Array.isArray(raw.dndFavoriteIds)?raw.dndFavoriteIds:(current?.dndFavoriteIds??defaults.dndFavoriteIds),
  dndClanException:typeof raw.dndClanException==="boolean"?raw.dndClanException:(current?.dndClanException??defaults.dndClanException),
 };
 const theme=themes.find(item=>item.id===next.theme);if(!theme)return NextResponse.json({message:"Неизвестная тема."},{status:400});
 if(theme.access==="superflip"&&!await hasActiveSuperFlip(user.id))return NextResponse.json({message:"Тема доступна с SuperFlip."},{status:403});
 if(theme.access.startsWith("shop:")){
  const all=await db.select({id:cosmeticInventory.itemId}).from(cosmeticInventory).where(eq(cosmeticInventory.userId,user.id));
  if(!all.some(item=>item.id===theme.access.slice(5)))return NextResponse.json({message:"Приобретите тему в магазине."},{status:403});
 }
 const time=/^([01]\d|2[0-3]):[0-5]\d$/;if(!time.test(next.dndStart)||!time.test(next.dndEnd)||!Array.isArray(next.dndDays)||next.dndDays.some((day:unknown)=>!Number.isInteger(day)||Number(day)<0||Number(day)>6)||next.dndDays.length>7||!Array.isArray(next.dndFavoriteIds)||next.dndFavoriteIds.length>30||next.dndFavoriteIds.some((id:unknown)=>typeof id!=="string"||id.length>100)||typeof next.dndEnabled!=="boolean"||typeof next.dndClanException!=="boolean")return NextResponse.json({message:"Неверное расписание."},{status:400});
 try{new Intl.DateTimeFormat("en-US",{timeZone:next.dndTimezone})}catch{return NextResponse.json({message:"Неизвестный часовой пояс."},{status:400})}
 const values={userId:user.id,theme:next.theme,accentColor:theme.accent,dndEnabled:next.dndEnabled,dndDays:[...new Set(next.dndDays as number[])],dndStart:next.dndStart,dndEnd:next.dndEnd,dndTimezone:next.dndTimezone,dndFavoriteIds:next.dndFavoriteIds,dndClanException:next.dndClanException,updatedAt:new Date()};
 const [saved]=await db.insert(userPreferences).values(values).onConflictDoUpdate({target:userPreferences.userId,set:values}).returning();
 return NextResponse.json({preferences:publicPreferences(saved)});
}
