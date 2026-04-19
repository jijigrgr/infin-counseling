"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { format, parse, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isBefore, startOfDay } from "date-fns";
import { ko } from "date-fns/locale";
import { getSlotsForDate } from "@/lib/slots";

interface Booking {
  slot_date: string;
  slot_time: string;
}

function currentMonthStr(): string {
  return format(new Date(), "yyyy-MM");
}

export default function PublicCalendarPage() {
  const [monthStr, setMonthStr] = useState(currentMonthStr);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchMonth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar/month?month=${monthStr}`);
      const data = await res.json();
      setBookings(data.bookings ?? []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [monthStr]);

  useEffect(() => {
    fetchMonth();
    setSelectedDate(null);
  }, [fetchMonth]);

  const monthDate = parse(monthStr + "-01", "yyyy-MM-dd", new Date());
  const monthLabel = format(monthDate, "yyyy년 M월", { locale: ko });

  const gridDays = useMemo(() => {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const days = eachDayOfInterval({ start, end });
    const leadingBlanks = (getDay(start) + 6) % 7; // 월요일 시작 (0=월 ... 6=일)
    return { days, leadingBlanks };
  }, [monthDate]);

  function changeMonth(delta: number) {
    const newDate = addMonths(monthDate, delta);
    setMonthStr(format(newDate, "yyyy-MM"));
  }

  function bookingsForDate(dateStr: string): string[] {
    return bookings.filter((b) => b.slot_date === dateStr).map((b) => b.slot_time);
  }

  const today = startOfDay(new Date());

  return (
    <div className="min-h-screen bg-snow">
      <header className="bg-lavender/30 px-4 py-3 flex items-center gap-2">
        <Link
          href="/"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-lavender text-deep-purple font-bold active:scale-95 transition"
          aria-label="홈으로"
        >
          &lt;
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">이달의 상담 현황</h1>
          <p className="text-xs text-charcoal/70">누가 예약했는지는 비공개예요</p>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-4 pb-8 animate-fade-in-up">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => changeMonth(-1)}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white border border-lavender text-deep-purple font-bold text-lg active:scale-95 transition"
            aria-label="이전 달"
          >
            &lt;
          </button>
          <span className="font-semibold text-base">{monthLabel}</span>
          <button
            onClick={() => changeMonth(1)}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white border border-lavender text-deep-purple font-bold text-lg active:scale-95 transition"
            aria-label="다음 달"
          >
            &gt;
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-3 text-[11px] text-charcoal/70">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-mint border border-deep-purple" />
            예약 가능
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-peach" />
            일부 예약
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
            마감
          </span>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-charcoal/70">
          {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        {/* Month grid */}
        {loading ? (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-lavender/20 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: gridDays.leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} className="aspect-square" />
            ))}
            {gridDays.days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const totalSlots = getSlotsForDate(day).length;
              const booked = bookingsForDate(dateStr).length;
              const past = isBefore(day, today);
              const inMonth = isSameMonth(day, monthDate);
              const isSelected = selectedDate === dateStr;

              let bgClass = "bg-white border border-lavender/40";
              let textClass = "text-charcoal";

              if (!inMonth || past) {
                bgClass = "bg-gray-50 border border-gray-100";
                textClass = "text-charcoal/30";
              } else if (totalSlots === 0) {
                bgClass = "bg-gray-50 border border-gray-100";
                textClass = "text-charcoal/40";
              } else if (booked >= totalSlots) {
                bgClass = "bg-gray-200 border border-gray-300";
                textClass = "text-charcoal/50";
              } else if (booked > 0) {
                bgClass = "bg-peach-light border border-peach";
                textClass = "text-charcoal";
              } else {
                bgClass = "bg-mint border border-deep-purple/30";
                textClass = "text-charcoal";
              }

              if (isSelected && totalSlots > 0) {
                bgClass = "bg-deep-purple border-2 border-deep-purple";
                textClass = "text-white";
              }

              const clickable = totalSlots > 0 && !past;

              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={!clickable}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`aspect-square rounded-lg ${bgClass} ${textClass} text-[12px] font-medium flex flex-col items-center justify-center gap-0.5 transition active:scale-95 disabled:cursor-default disabled:active:scale-100`}
                  aria-label={`${format(day, "M월 d일", { locale: ko })} ${
                    totalSlots === 0
                      ? "상담 없음"
                      : past
                      ? "지난 날짜"
                      : `${booked}/${totalSlots} 예약됨`
                  }`}
                >
                  <span>{day.getDate()}</span>
                  {totalSlots > 0 && !past && (
                    <span className="text-[10px] leading-none opacity-80">
                      {booked}/{totalSlots}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Selected day detail */}
        {selectedDate && (
          <div className="bg-white rounded-card p-4 border border-lavender/30 shadow-sm animate-fade-in-up">
            <h2 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
              🗓️ {format(parse(selectedDate, "yyyy-MM-dd", new Date()), "M월 d일 (EEE)", { locale: ko })}
            </h2>
            <SlotDetail dateStr={selectedDate} bookings={bookingsForDate(selectedDate)} />
          </div>
        )}

        <Link
          href="/"
          className="block w-full text-center h-[48px] leading-[48px] rounded-button border-2 border-lavender text-deep-purple font-semibold text-sm active:scale-[0.97] transition"
        >
          예약하러 가기 →
        </Link>
      </main>
    </div>
  );
}

function timeLabel(t: string) {
  if (t === "07:30") return "아침 상담";
  if (t === "16:00") return "방과후 상담 1";
  return "방과후 상담 2";
}

function SlotDetail({ dateStr, bookings }: { dateStr: string; bookings: string[] }) {
  const date = parse(dateStr, "yyyy-MM-dd", new Date());
  const slots = getSlotsForDate(date);
  if (slots.length === 0) {
    return <p className="text-xs text-charcoal/60">상담이 없는 날이에요.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {slots.map((time) => {
        const isBooked = bookings.includes(time);
        return (
          <li
            key={time}
            className={`rounded-lg px-3 py-2 text-sm flex items-center justify-between ${
              isBooked
                ? "bg-gray-100 text-charcoal/60"
                : "bg-mint/60 text-charcoal"
            }`}
          >
            <span>
              {time === "07:30" ? "🌅" : "🌇"} {time} {timeLabel(time)}
            </span>
            <span className="text-xs font-medium">
              {isBooked ? "예약됨" : "예약 가능"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
