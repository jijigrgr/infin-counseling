import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getSupabase()
    .from("announcements")
    .select("id, title, content, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 500 });
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex").substring(0, 10);
  const jwtRole = (k: string) => {
    if (!k.startsWith("eyJ")) return "not-jwt";
    try {
      const payload = JSON.parse(Buffer.from(k.split(".")[1], "base64").toString());
      return `ref=${payload.ref} role=${payload.role}`;
    } catch {
      return "decode-err";
    }
  };

  return NextResponse.json({
    announcements: data,
    _debug: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKeyHash: hash(anonKey),
      adminKeyHash: hash(adminKey),
      anonJwt: jwtRole(anonKey),
      adminJwt: jwtRole(adminKey),
      sameKey: anonKey === adminKey,
    },
  });
}
