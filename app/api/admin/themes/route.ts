import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { appThemes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isTrustedMutationRequest } from "@/lib/security-controls";
import { getAppThemes, isBuiltinTheme } from "@/lib/themes";

const hex=z.string().regex(/^#[0-9a-fA-F]{6}$/);
const themeSchema=z.object({
 id:z.string().trim().min(2).max(40).regex(/^[a-z0-9][a-z0-9-]*$/),
 label:z.string().trim().min(2).max(60),
 access:z.string().trim().max(80).refine(value=>value==="free"||value==="superflip"||value.startsWith("shop:")),
 surface:hex,panel:hex,deep:hex,raised:hex,accent:hex,text:hex,muted:hex,
});

async function admin(){
 const user=await getCurrentUser();
 return user?.platformRole==="admin"?user:null;
}

export async function GET(){
 if(!await admin())return NextResponse.json({message:"Недостаточно прав."},{status:403});
 return NextResponse.json({themes:await getAppThemes()});
}

export async function POST(request:Request){
 if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
 const user=await admin();if(!user)return NextResponse.json({message:"Недостаточно прав."},{status:403});
 const parsed=themeSchema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({message:"Проверьте идентификатор, доступ и HEX-цвета темы."},{status:400});
 if(isBuiltinTheme(parsed.data.id))return NextResponse.json({message:"Встроенную тему нельзя перезаписать из админ-панели."},{status:409});
 try{
  const db=getDatabase();
  const [saved]=await db.insert(appThemes).values({
   id:parsed.data.id,label:parsed.data.label,access:parsed.data.access,surface:parsed.data.surface,panel:parsed.data.panel,deep:parsed.data.deep,raised:parsed.data.raised,accent:parsed.data.accent,textColor:parsed.data.text,muted:parsed.data.muted,createdBy:user.id,updatedAt:new Date(),
  }).onConflictDoUpdate({target:appThemes.id,set:{
   label:parsed.data.label,access:parsed.data.access,surface:parsed.data.surface,panel:parsed.data.panel,deep:parsed.data.deep,raised:parsed.data.raised,accent:parsed.data.accent,textColor:parsed.data.text,muted:parsed.data.muted,updatedAt:new Date(),
  }}).returning();
  return NextResponse.json({theme:saved});
 }catch{
  return NextResponse.json({message:"Таблица тем ещё не установлена. Примените drizzle/0031_custom_themes.sql."},{status:503});
 }
}

export async function DELETE(request:Request){
 if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
 if(!await admin())return NextResponse.json({message:"Недостаточно прав."},{status:403});
 const body=await request.json().catch(()=>null);const id=typeof body?.id==="string"?body.id:"";
 if(!id||isBuiltinTheme(id))return NextResponse.json({message:"Эту тему удалить нельзя."},{status:400});
 try{await getDatabase().delete(appThemes).where(eq(appThemes.id,id));return NextResponse.json({ok:true})}
 catch{return NextResponse.json({message:"Не удалось удалить тему."},{status:500})}
}
