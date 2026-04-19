import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// YYYY-MM 형식의 month 파라미터를 받아 해당 월 범위의 예약 슬롯만
// 반환한다 (학생 이름/학년반/고민 등 개인정보는 절대 포함하지 않는다).
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month 파라미터는 YYYY-MM 형식이어야 합니다." },
      { status: 400 }
    );
  }

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const m = Number(monthStr);

  const start = `${month}-01`;
  const lastDay = new Date(year, m, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await getSupabase()
    .from("reservations")
    .select("slot_date, slot_time")
    .gte("slot_date", start)
    .lte("slot_date", end)
    .order("slot_date")
    .order("slot_time");

  if (error) {
    return NextResponse.json(
      { error: "잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }

  return NextResponse.json({ bookings: data ?? [] });
}
