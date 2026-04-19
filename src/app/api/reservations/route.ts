import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { VALID_TIMES, isValidSlot, isPastSlot, getWeekInfo, formatConfirmation } from "@/lib/slots";

export async function GET(req: NextRequest) {
  const weekStart = req.nextUrl.searchParams.get("week_start");
  if (!weekStart) {
    return NextResponse.json({ error: "week_start 파라미터가 필요합니다." }, { status: 400 });
  }

  const startDate = new Date(weekStart);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 4);

  const { data, error } = await getSupabase()
    .from("reservations")
    .select("id, student_name, grade_class, slot_date, slot_time")
    .gte("slot_date", weekStart)
    .lte("slot_date", endDate.toISOString().split("T")[0])
    .order("slot_date")
    .order("slot_time");

  if (error) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 500 });
  }

  return NextResponse.json({ reservations: data });
}

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { student_name, grade_class, slot_date, slot_time, concern } = body;

  if (!student_name?.trim() || !grade_class?.trim() || !slot_date || !slot_time || !concern?.trim()) {
    return NextResponse.json({ error: "모든 항목을 입력해주세요." }, { status: 400 });
  }

  if (!VALID_TIMES.includes(slot_time as typeof VALID_TIMES[number])) {
    return NextResponse.json({ error: "예약할 수 없는 시간대입니다." }, { status: 400 });
  }

  const date = new Date(slot_date + "T00:00:00");

  if (!isValidSlot(date, slot_time as typeof VALID_TIMES[number])) {
    return NextResponse.json({ error: "예약할 수 없는 시간대입니다." }, { status: 400 });
  }

  if (isPastSlot(date, slot_time as typeof VALID_TIMES[number])) {
    return NextResponse.json({ error: "이미 지나간 시간이에요." }, { status: 400 });
  }

  const { week_number, week_year } = getWeekInfo(date);

  const { data, error } = await getSupabase()
    .from("reservations")
    .insert({
      student_name: student_name.trim(),
      grade_class: grade_class.trim(),
      slot_date,
      slot_time,
      concern: concern.trim(),
      week_number,
      week_year,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("uq_slot")) {
        return NextResponse.json({ error: "이미 예약된 시간입니다." }, { status: 409 });
      }
      if (error.message.includes("uq_student_per_week")) {
        return NextResponse.json({ error: "이번 주에 이미 예약이 있어요. 다음 주에 다시 신청해주세요!" }, { status: 409 });
      }
      return NextResponse.json({ error: "중복된 예약입니다." }, { status: 409 });
    }
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 500 });
  }

  return NextResponse.json(
    {
      reservation: {
        id: data.id,
        student_name: data.student_name,
        grade_class: data.grade_class,
        slot_date: data.slot_date,
        slot_time: data.slot_time,
        concern: data.concern,
      },
      message: formatConfirmation(slot_date, slot_time),
    },
    { status: 201 }
  );
}
