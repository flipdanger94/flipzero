import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
export async function GET() { const user = await getCurrentUser(); return user ? NextResponse.json({ user }) : NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }); }
