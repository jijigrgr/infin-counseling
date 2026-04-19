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

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const password = req.headers.get("x-admin-password");
  if (!password || !verifyPassword(password)) {
    return NextResponse.json({ error: "비밀번호가 틀렸습니다." }, { status: 401 });
  }

  const admin = getAdminClient();
  const { error, count } = await admin
    .from("reservations")
    .delete({ count: "exact" })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 500 });
  }

  if (count === 0) {
    return NextResponse.json({ error: "해당 예약을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ message: "예약이 취소되었습니다." });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const password = req.headers.get("x-admin-password");
  if (!password || !verifyPassword(password)) {
    return NextResponse.json({ error: "비밀번호가 틀렸습니다." }, { status: 401 });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  if (body.slot_date) updates.slot_date = body.slot_date;
  if (body.slot_time) updates.slot_time = body.slot_time;
  if (body.concern) updates.concern = body.concern;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "수정할 항목이 없습니다." }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("reservations")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "변경하려는 시간에 이미 예약이 있습니다." }, { status: 409 });
    }
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "해당 예약을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 500 });
  }

  return NextResponse.json({
    reservation: {
      id: data.id,
      student_name: data.student_name,
      grade_class: data.grade_class,
      slot_date: data.slot_date,
      slot_time: data.slot_time,
      concern: data.concern,
    },
    message: "예약이 수정되었습니다.",
  });
}
