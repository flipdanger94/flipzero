import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { userPrivacySettings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const defaults={directMessages:true,friendRequests:true,profileDiscovery:true};
export async function GET(){
 const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 const [row]=await getDatabase().select().from(userPrivacySettings).where(eq(userPrivacySettings.userId,user.id)).limit(1);
 return NextResponse.json({privacy:row?{directMessages:row.directMessages,friendRequests:row.friendRequests,profileDiscovery:row.profileDiscovery}:defaults});
}
export async function PATCH(request:Request){
 const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 const body=await request.json().catch(()=>null);if(!body||typeof body!=="object")return NextResponse.json({message:"Некорректные данные."},{status:400});
 const keys=["directMessages","friendRequests","profileDiscovery"] as const;
 const supplied=keys.filter(key=>Object.prototype.hasOwnProperty.call(body,key));
 if(!supplied.length||supplied.some(key=>typeof body[key]!=="boolean"))return NextResponse.json({message:"Передайте хотя бы одну настройку типа boolean."},{status:400});
 const db=getDatabase(); const [current]=await db.select().from(userPrivacySettings).where(eq(userPrivacySettings.userId,user.id)).limit(1);
 const base=current?{directMessages:current.directMessages,friendRequests:current.friendRequests,profileDiscovery:current.profileDiscovery}:defaults;
 const privacy={...base,...Object.fromEntries(supplied.map(key=>[key,body[key]]))} as typeof defaults;
 const values={...privacy,updatedAt:new Date()};
 await db.insert(userPrivacySettings).values({userId:user.id,...values}).onConflictDoUpdate({target:userPrivacySettings.userId,set:values});
 return NextResponse.json({privacy});
}
