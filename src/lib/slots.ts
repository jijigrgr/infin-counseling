import { getISOWeek, getISOWeekYear, format, isBefore, startOfDay, addDays, isWeekend, parse } from "date-fns";
import { ko } from "date-fns/locale";

export const VALID_TIMES = ["07:30", "16:00", "16:30"] as const;
export type SlotTime = (typeof VALID_TIMES)[number];

const MORNING_DAYS = [1, 2, 3, 4, 5];
const AFTERNOON_DAYS = [2, 3, 5];

export function isValidSlot(date: Date, time: SlotTime): boolean {
  if (isWeekend(date)) return false;
  const dow = date.getDay();
  if (dow === 0) return false;
  if (time === "07:30") return MORNING_DAYS.includes(dow);
  return AFTERNOON_DAYS.includes(dow);
}

export function isPastSlot(date: Date, time: SlotTime): boolean {
  const now = new Date();
  const [h, m] = time.split(":").map(Number);
  const slotEnd = new Date(date);
  slotEnd.setHours(h, m + 30, 0, 0);
  return isBefore(slotEnd, now);
}

export function getWeekInfo(date: Date) {
  return {
    week_number: getISOWeek(date),
    week_year: getISOWeekYear(date),
  };
}

export function getWeekDates(mondayStr: string): Date[] {
  const monday = parse(mondayStr, "yyyy-MM-dd", new Date());
  return Array.from({ length: 5 }, (_, i) => addDays(monday, i));
}

export function getSlotsForDate(date: Date): SlotTime[] {
  return VALID_TIMES.filter((t) => isValidSlot(date, t));
}

export function formatConfirmation(dateStr: string, time: string): string {
  const date = parse(dateStr, "yyyy-MM-dd", new Date());
  const dayName = format(date, "EEEE", { locale: ko });
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = parseInt(time.split(":")[0]);
  const min = time.split(":")[1];
  const timeStr = min === "00" ? `${hour}시` : `${hour}시 ${min}분`;
  return `${month}월 ${day}일 ${dayName} ${timeStr}에 예약되었습니다.`;
}

export function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return format(d, "yyyy-MM-dd");
}
