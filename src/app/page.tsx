"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, addDays, parse, isWeekend } from "date-fns";
import { ko } from "date-fns/locale";
import { getDefaultDisplayWeekStart } from "@/lib/slots";

type SlotTime = "07:30" | "16:00" | "16:30";

interface Reservation {
  id: string;
  student_name: string;
  grade_class: string;
  slot_date: string;
  slot_time: string;
}

interface ReservationDetail extends Reservation {
  concern: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

function buildGoogleCalendarUrl(r: ReservationDetail): string {
  const [h, m] = r.slot_time.split(":").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = r.slot_date.replace(/-/g, "");
  const startT = `${pad(h)}${pad(m)}00`;
  const endMin = m + 30;
  const endH = endMin >= 60 ? h + 1 : h;
  const endM = endMin % 60;
  const endT = `${pad(endH)}${pad(endM)}00`;
  const startStr = `${datePart}T${startT}`;
  const endStr = `${datePart}T${endT}`;
  const title = `상담 - ${r.student_name} (${r.grade_class})`;
  const details = `상담 내용: ${r.concern}\n\n인천금융고등학교 웹툰애니메이션과\n김지현 선생님 상담`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${startStr}/${endStr}`,
    details,
    ctz: "Asia/Seoul",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function isPastSlot(dateStr: string, time: string): boolean {
  const now = new Date();
  const [h, m] = time.split(":").map(Number);
  const slotEnd = new Date(dateStr + "T00:00:00");
  slotEnd.setHours(h, m + 30, 0, 0);
  return slotEnd < now;
}

const MORNING_DAYS = [1, 2, 3, 4, 5];
const AFTERNOON_DAYS = [2, 3, 5];

function getSlotsForDate(dateStr: string): SlotTime[] {
  const date = new Date(dateStr + "T00:00:00");
  if (isWeekend(date)) return [];
  const dow = date.getDay();
  const slots: SlotTime[] = [];
  if (MORNING_DAYS.includes(dow)) slots.push("07:30");
  if (AFTERNOON_DAYS.includes(dow)) {
    slots.push("16:00", "16:30");
  }
  return slots;
}

function TimeIcon({ time }: { time: string }) {
  if (time === "07:30") return <span className="text-lg mr-1.5">🌅</span>;
  return <span className="text-lg mr-1.5">🌇</span>;
}

function timeLabel(time: string) {
  if (time === "07:30") return "아침 상담";
  if (time === "16:00") return "방과후 상담 1";
  return "방과후 상담 2";
}

export default function HomePage() {
  const [weekStart, setWeekStart] = useState(() => getDefaultDisplayWeekStart());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: SlotTime } | null>(null);
  const [formData, setFormData] = useState({ student_name: "", grade_class: "", concern: "" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; reservation: ReservationDetail } | null>(null);
  const [error, setError] = useState("");

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reservations?week_start=${weekStart}`);
      const data = await res.json();
      setReservations(data.reservations || []);
    } catch {
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  useEffect(() => {
    fetch("/api/announcements")
      .then((res) => res.json())
      .then((data) => setAnnouncements(data.announcements || []))
      .catch(() => setAnnouncements([]));
  }, []);

  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const monday = parse(weekStart, "yyyy-MM-dd", new Date());
    return format(addDays(monday, i), "yyyy-MM-dd");
  });

  function changeWeek(delta: number) {
    const monday = parse(weekStart, "yyyy-MM-dd", new Date());
    const newMonday = addDays(monday, delta * 7);
    setWeekStart(format(newMonday, "yyyy-MM-dd"));
    setSelectedSlot(null);
  }

  function getSlotReservation(dateStr: string, time: SlotTime): Reservation | null {
    return reservations.find(
      (r) => r.slot_date === dateStr && r.slot_time === time
    ) || null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: formData.student_name,
          grade_class: formData.grade_class,
          slot_date: selectedSlot.date,
          slot_time: selectedSlot.time,
          concern: formData.concern,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setResult({
        success: true,
        message: data.message,
        reservation: data.reservation,
      });
      setFormData({ student_name: "", grade_class: "", concern: "" });
      setSelectedSlot(null);
      fetchReservations();
    } catch {
      setError("앗, 문제가 생겼어요. 잠시 후 다시 해주세요");
    } finally {
      setSubmitting(false);
    }
  }

  if (result?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-snow">
        <div className="w-full max-w-sm text-center animate-fade-in-up">
          <div className="text-6xl mb-4 animate-bounce-in">🐱✨</div>
          <h1 className="text-2xl font-bold mb-6">예약 완료!</h1>
          <div className="bg-cream-light rounded-card p-5 mb-4">
            <p className="text-lg font-semibold text-charcoal">{result.message}</p>
          </div>
          <p className="text-xs text-charcoal/60 mb-6 leading-relaxed">
            사정이 생기면 예약 시간 전까지<br />
            반톡이나 선생님께 꼭 연락해주세요 🙏
          </p>
          <a
            href={buildGoogleCalendarUrl(result.reservation)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-[52px] rounded-button bg-deep-purple text-white font-semibold text-[15px] shadow-md shadow-deep-purple/20 transition-all duration-200 hover:bg-deep-purple-hover active:scale-[0.97] flex items-center justify-center gap-2 mb-3"
          >
            📅 내 구글 캘린더에 추가하기
          </a>
          <button
            onClick={() => setResult(null)}
            className="w-full h-[52px] rounded-button border-2 border-lavender text-deep-purple font-semibold transition-all duration-200 active:scale-[0.97]"
          >
            캘린더로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const monday = parse(weekStart, "yyyy-MM-dd", new Date());
  const friday = addDays(monday, 4);
  const weekLabel = `${format(monday, "M월 d일", { locale: ko })} ~ ${format(friday, "M월 d일", { locale: ko })}`;

  return (
    <div className="min-h-screen bg-snow">
      <header className="bg-lavender/30 px-4 py-3 flex items-center gap-2">
        <span className="text-2xl">🐱</span>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">김지현 선생님과 상담 예약</h1>
          <p className="text-xs text-charcoal/70">원하는 시간을 골라주세요!</p>
        </div>
        <Link
          href="/calendar"
          className="text-xs font-medium text-deep-purple bg-white/70 border border-lavender rounded-full px-3 py-1.5 active:scale-95 transition"
          aria-label="이달의 상담 현황 보기"
        >
          📅 이달 현황
        </Link>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-4 pb-8 animate-fade-in-up">
        {/* Announcements */}
        {announcements.length > 0 && (
          <section className="space-y-2" aria-label="선생님 공지">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="bg-cream-light border-l-4 border-peach rounded-card px-4 py-3"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-base">📢</span>
                  <h2 className="font-semibold text-sm text-charcoal">{a.title}</h2>
                </div>
                <p className="text-sm text-charcoal/80 whitespace-pre-wrap leading-relaxed">
                  {a.content}
                </p>
                <p className="text-[11px] text-charcoal/50 mt-1.5">
                  {format(new Date(a.created_at), "M월 d일", { locale: ko })}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* Week Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => changeWeek(-1)}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white border border-lavender text-deep-purple font-bold text-lg active:scale-95 transition"
            aria-label="이전 주"
          >
            &lt;
          </button>
          <span className="font-semibold text-sm">{weekLabel}</span>
          <button
            onClick={() => changeWeek(1)}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white border border-lavender text-deep-purple font-bold text-lg active:scale-95 transition"
            aria-label="다음 주"
          >
            &gt;
          </button>
        </div>

        {/* Calendar */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-card bg-lavender/20 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {weekDates.map((dateStr) => {
              const slots = getSlotsForDate(dateStr);
              if (slots.length === 0) return null;
              const dateObj = new Date(dateStr + "T00:00:00");
              const dayLabel = format(dateObj, "M/d (EEE)", { locale: ko });

              return (
                <div key={dateStr}>
                  <h3 className="text-sm font-semibold mb-2 text-charcoal/80">{dayLabel}</h3>
                  <div className="space-y-2">
                    {slots.map((time) => {
                      const reservation = getSlotReservation(dateStr, time);
                      const past = isPastSlot(dateStr, time);
                      const isSelected =
                        selectedSlot?.date === dateStr && selectedSlot?.time === time;

                      if (past || reservation) {
                        return (
                          <div
                            key={time}
                            className={`rounded-card px-4 py-3 ${
                              reservation
                                ? "bg-peach-light border-l-4 border-peach"
                                : "bg-gray-200"
                            }`}
                          >
                            <div className="flex items-center text-sm">
                              <TimeIcon time={time} />
                              <span className="font-medium">
                                {time} {timeLabel(time)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {reservation
                                ? `${reservation.student_name} · ${reservation.grade_class}`
                                : "마감됨"}
                            </p>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={time}
                          onClick={() =>
                            setSelectedSlot(
                              isSelected ? null : { date: dateStr, time }
                            )
                          }
                          className={`w-full rounded-card px-4 py-3 text-left transition-all duration-150 active:scale-[0.98] ${
                            isSelected
                              ? "bg-deep-purple text-white shadow-md"
                              : "bg-mint border-l-4 border-deep-purple"
                          }`}
                          aria-label={`${dateStr} ${time} 예약하기`}
                        >
                          <div className="flex items-center text-sm">
                            <TimeIcon time={time} />
                            <span className="font-medium">
                              {time} {timeLabel(time)}
                            </span>
                          </div>
                          <p className={`text-xs mt-1 ${isSelected ? "text-white/80" : "text-charcoal/60"}`}>
                            {isSelected ? "아래에서 예약 정보를 입력하세요" : "터치하여 예약하기"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Booking Form */}
        {selectedSlot && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-card p-4 shadow-sm border border-lavender/30 space-y-3 animate-fade-in-up"
          >
            <h2 className="font-semibold text-base flex items-center gap-1.5">
              ✏️ 상담 신청
            </h2>

            <div>
              <label className="text-xs text-charcoal/70 mb-1 block">이름</label>
              <input
                type="text"
                required
                value={formData.student_name}
                onChange={(e) => setFormData((p) => ({ ...p, student_name: e.target.value }))}
                placeholder="이름을 입력해주세요"
                className="w-full h-[48px] px-4 rounded-xl border-2 border-lavender bg-white text-charcoal text-[15px] focus:border-deep-purple focus:ring-2 focus:ring-deep-purple/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-charcoal/70 mb-1 block">학년·반</label>
              <input
                type="text"
                required
                value={formData.grade_class}
                onChange={(e) => setFormData((p) => ({ ...p, grade_class: e.target.value }))}
                placeholder="예: 2-3"
                className="w-full h-[48px] px-4 rounded-xl border-2 border-lavender bg-white text-charcoal text-[15px] focus:border-deep-purple focus:ring-2 focus:ring-deep-purple/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-charcoal/70 mb-1 block">상담하고 싶은 내용</label>
              <input
                type="text"
                required
                value={formData.concern}
                onChange={(e) => setFormData((p) => ({ ...p, concern: e.target.value }))}
                placeholder="상담 주제를 한 줄로 적어주세요"
                className="w-full h-[48px] px-4 rounded-xl border-2 border-lavender bg-white text-charcoal text-[15px] focus:border-deep-purple focus:ring-2 focus:ring-deep-purple/20 focus:outline-none"
              />
            </div>

            {error && (
              <p className="text-coral text-sm animate-shake bg-coral/5 rounded-xl px-4 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-[52px] bg-deep-purple text-white rounded-button font-semibold text-[15px] shadow-md shadow-deep-purple/20 transition-all duration-200 hover:bg-deep-purple-hover active:scale-[0.97] disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none"
            >
              {submitting ? "예약 중..." : "예약하기"}
            </button>
          </form>
        )}

        {!selectedSlot && !loading && (
          <div className="text-center py-6 text-charcoal/50 text-sm">
            <p className="text-3xl mb-2">😴</p>
            <p>시간을 선택하면 예약할 수 있어요</p>
          </div>
        )}
      </main>
    </div>
  );
}
