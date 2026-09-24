import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { coinTransactions, userWallets } from "@/db/schema";

type EconomyTransaction=Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

/** The unique ledger key and balance change commit together. */
export async function creditCoins(tx:EconomyTransaction,userId:string,amount:number,reason:string,key:string){
  if(!Number.isSafeInteger(amount)||amount<=0||amount>10000)throw new Error("Invalid coin reward");
  const [entry]=await tx.insert(coinTransactions).values({id:randomUUID(),userId,amount,reason,idempotencyKey:`${userId}:${key}`}).onConflictDoNothing().returning({id:coinTransactions.id});
  if(!entry)return false;
  await tx.insert(userWallets).values({userId,balance:amount}).onConflictDoUpdate({target:userWallets.userId,set:{balance:sql`${userWallets.balance}+${amount}`,updatedAt:new Date()}});
  return true;
}

export async function debitCoins(tx:EconomyTransaction,userId:string,amount:number,reason:string,key:string){
  if(!Number.isSafeInteger(amount)||amount<=0)throw new Error("Invalid purchase price");
  const [wallet]=await tx.update(userWallets).set({balance:sql`${userWallets.balance}-${amount}`,updatedAt:new Date()}).where(sql`${userWallets.userId}=${userId} AND ${userWallets.balance}>=${amount}`).returning({balance:userWallets.balance});
  if(!wallet)return false;
  await tx.insert(coinTransactions).values({id:randomUUID(),userId,amount:-amount,reason,idempotencyKey:`${userId}:${key}`});
  return true;
}
