import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import crypto from "crypto";

function verifyPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (!password || !verifyPassword(password)) {
    return NextResponse.json({ error: "비밀번호가 틀렸습니다." }, { status: 401 });
  }

  const admin = getAdminClient();
  const weekStart = req.nextUrl.searchParams.get("week_start");

  let query = admin
    .from("reservations")
    .select("id, student_name, grade_class, slot_date, slot_time, concern, created_at")
    .order("slot_date")
    .order("slot_time");

  if (weekStart) {
    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + 4);
    query = query
      .gte("slot_date", weekStart)
      .lte("slot_date", endDate.toISOString().split("T")[0]);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 500 });
  }

  return NextResponse.json({ reservations: data });
}
