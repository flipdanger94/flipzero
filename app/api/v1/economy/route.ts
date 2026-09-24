import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/db/client";
import { coinTransactions, userWallets } from "@/db/schema";

export async function GET(){
  const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
  const db=getDatabase();const [[wallet],transactions]=await Promise.all([
    db.select({balance:userWallets.balance}).from(userWallets).where(eq(userWallets.userId,user.id)).limit(1),
    db.select({id:coinTransactions.id,amount:coinTransactions.amount,reason:coinTransactions.reason,createdAt:coinTransactions.createdAt}).from(coinTransactions).where(eq(coinTransactions.userId,user.id)).orderBy(desc(coinTransactions.createdAt)).limit(50),
  ]);
  return NextResponse.json({balance:wallet?.balance??0,transactions});
}
