import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ReservationRow {
  id: string;
  student_name: string;
  grade_class: string;
  slot_date: string;
  slot_time: string;
  concern: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateTime(slotDate: string, slotTime: string, addMinutes: number = 0): string {
  const [h, m] = slotTime.split(":").map(Number);
  const datePart = slotDate.replace(/-/g, "");
  const totalMin = m + addMinutes;
  const hours = h + Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return `${datePart}T${pad(hours)}${pad(minutes)}00`;
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildIcs(reservations: ReservationRow[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Incheon Finance HS Counseling//KR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:김지현 선생님 상담 예약",
    "X-WR-TIMEZONE:Asia/Seoul",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Seoul",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0900",
    "TZOFFSETTO:+0900",
    "TZNAME:KST",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  for (const r of reservations) {
    const dtStart = formatDateTime(r.slot_date, r.slot_time, 0);
    const dtEnd = formatDateTime(r.slot_date, r.slot_time, 30);
    const summary = escapeIcs(`상담 · ${r.student_name} (${r.grade_class})`);
    const description = escapeIcs(`상담 내용: ${r.concern}`);

    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.id}@incheon-counseling`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Asia/Seoul:${dtStart}`,
      `DTEND;TZID=Asia/Seoul:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || key !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  const today = new Date();
  today.setDate(today.getDate() - 1);
  const sinceDate = today.toISOString().split("T")[0];

  const { data, error } = await getAdminClient()
    .from("reservations")
    .select("id, student_name, grade_class, slot_date, slot_time, concern")
    .gte("slot_date", sinceDate)
    .order("slot_date")
    .order("slot_time");

  if (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }

  const ics = buildIcs((data || []) as ReservationRow[]);

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="counseling.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
