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

  const { data: existing, error: selectError } = await admin
    .from("announcements")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();

  if (selectError) {
    return NextResponse.json({
      error: `조회 실패: ${selectError.message} (code=${selectError.code})`,
      debug: { paramId: params.id, step: "select" },
    }, { status: 500 });
  }

  if (!existing) {
    const { data: all } = await admin.from("announcements").select("id").limit(5);
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    let jwtInfo = "N/A";
    if (key.startsWith("eyJ")) {
      try {
        const parts = key.split(".");
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
        jwtInfo = `ref=${payload.ref ?? "?"} role=${payload.role ?? "?"}`;
      } catch {
        jwtInfo = "decode-failed";
      }
    }
    return NextResponse.json({
      error: `DB에 없는 ID입니다. paramId=${params.id}`,
      debug: {
        paramId: params.id,
        dbSampleIds: all?.map((r) => r.id) ?? [],
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        keyType: key.startsWith("eyJ") ? "JWT(구형)" : key.startsWith("sb_secret") ? "sb_secret(신형)" : `기타(${key.substring(0, 10)})`,
        jwtInfo,
      },
    }, { status: 404 });
  }

  const { data, error } = await admin
    .from("announcements")
    .delete()
    .eq("id", params.id)
    .select("id");

  if (error) {
    return NextResponse.json({
      error: `삭제 실패: ${error.message} (code=${error.code})`,
      debug: { paramId: params.id, step: "delete" },
    }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({
      error: `삭제 0건 (존재했지만 삭제 권한 없음)`,
      debug: { paramId: params.id, existed: true, deletedCount: 0 },
    }, { status: 500 });
  }

  return NextResponse.json({ message: "공지가 삭제되었습니다." });
}
