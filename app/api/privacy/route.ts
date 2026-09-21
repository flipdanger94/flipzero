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
 const body=await request.json().catch(()=>null);if(!body)return NextResponse.json({message:"Некорректные данные."},{status:400});
 const values={directMessages:body.directMessages!==false,friendRequests:body.friendRequests!==false,profileDiscovery:body.profileDiscovery!==false,updatedAt:new Date()};
 await getDatabase().insert(userPrivacySettings).values({userId:user.id,...values}).onConflictDoUpdate({target:userPrivacySettings.userId,set:values});
 return NextResponse.json({privacy:values});
}
