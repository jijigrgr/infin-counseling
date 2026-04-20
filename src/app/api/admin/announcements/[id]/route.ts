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
  if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim();
  if (typeof body.content === "string" && body.content.trim()) updates.content = body.content.trim();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "수정할 항목이 없습니다." }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("announcements")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "해당 공지를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 500 });
  }

  return NextResponse.json({ announcement: data, message: "공지가 수정되었습니다." });
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
  const { data, error } = await admin
    .from("announcements")
    .delete()
    .eq("id", params.id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "해당 공지를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ message: "공지가 삭제되었습니다." });
}
