import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import * as XLSX from "xlsx";
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
    .select("student_name, grade_class, slot_date, slot_time, concern, created_at")
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

  const rows = (data || []).map((r) => ({
    이름: r.student_name,
    "학년·반": r.grade_class,
    날짜: r.slot_date,
    시간: r.slot_time,
    "상담 내용": r.concern,
    신청일시: r.created_at,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "예약목록");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const filename = `reservations_${weekStart || "all"}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
