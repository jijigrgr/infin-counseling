import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getSupabase()
    .from("announcements")
    .select("id, title, content, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 500 });
  }

  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
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
    announcements: data,
    _debug: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      keyType: key.startsWith("eyJ") ? "JWT(구형)" : key.startsWith("sb_publishable") ? "sb_publishable(신형)" : `기타(${key.substring(0, 10)})`,
      jwtInfo,
    },
  });
}
