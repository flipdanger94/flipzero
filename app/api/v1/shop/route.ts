import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { cosmeticEquipped, cosmeticInventory, cosmeticItems, userWallets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { debitCoins } from "@/lib/economy";
import { getSuperFlipCapabilities } from "@/lib/superflip";
import { isTrustedMutationRequest } from "@/lib/security-controls";
export async function GET(){
  const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
  const db=getDatabase();const [items,inventory,equipped,[wallet]]=await Promise.all([
    db.select().from(cosmeticItems).where(or(isNull(cosmeticItems.availableUntil),gt(cosmeticItems.availableUntil,new Date()))),
    db.select().from(cosmeticInventory).where(eq(cosmeticInventory.userId,user.id)),
    db.select().from(cosmeticEquipped).where(eq(cosmeticEquipped.userId,user.id)),
    db.select({balance:userWallets.balance}).from(userWallets).where(eq(userWallets.userId,user.id)).limit(1),
  ]);return NextResponse.json({items,inventory,equipped,balance:wallet?.balance??0,superflipActive:(await getSuperFlipCapabilities(user.id)).active});
}
export async function POST(request:Request){
  if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
  const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
  const body=await request.json().catch(()=>null);const itemId=typeof body?.itemId==="string"?body.itemId:"";
  if(!itemId||!["purchase","equip"].includes(body?.action))return NextResponse.json({message:"Некорректный запрос."},{status:400});
  const db=getDatabase();const [item]=await db.select().from(cosmeticItems).where(eq(cosmeticItems.id,itemId)).limit(1);
  if(!item||item.availableUntil&&item.availableUntil<=new Date())return NextResponse.json({message:"Предмет недоступен."},{status:404});
  if(body.action==="purchase"){
    if(!Number.isSafeInteger(item.price)||item.price<70)return NextResponse.json({message:"Некорректная цена предмета."},{status:409});
    if(item.superflipOnly&&!(await getSuperFlipCapabilities(user.id)).active)return NextResponse.json({message:"Предмет доступен только с SuperFlip."},{status:403});
    try{
      const status=await db.transaction(async tx=>{
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`);
        const [owned]=await tx.select({itemId:cosmeticInventory.itemId}).from(cosmeticInventory).where(and(eq(cosmeticInventory.userId,user.id),eq(cosmeticInventory.itemId,itemId))).limit(1);
        if(owned)return "owned";
        const charged=await debitCoins(tx,user.id,item.price,`Покупка: ${item.title}`,`shop:${itemId}`);
        if(!charged)return "funds";
        await tx.insert(cosmeticInventory).values({userId:user.id,itemId});return "purchased";
      });
      if(status!=="purchased")return NextResponse.json({message:status==="owned"?"Предмет уже куплен.":"Недостаточно монет."},{status:409});
      return NextResponse.json({ok:true});
    }catch{return NextResponse.json({message:"Покупка не выполнена."},{status:409})}
  }
  const [owned]=await db.select({itemId:cosmeticInventory.itemId}).from(cosmeticInventory).where(and(eq(cosmeticInventory.userId,user.id),eq(cosmeticInventory.itemId,itemId))).limit(1);
  if(!owned)return NextResponse.json({message:"Сначала купите предмет."},{status:403});
  await db.insert(cosmeticEquipped).values({userId:user.id,category:item.category,itemId}).onConflictDoUpdate({target:[cosmeticEquipped.userId,cosmeticEquipped.category],set:{itemId}});
  return NextResponse.json({ok:true,category:item.category,itemId});
}
