"use client";

import { useState, useEffect, useCallback } from "react";
import { format, addDays, parse } from "date-fns";
import { ko } from "date-fns/locale";
import { getDefaultDisplayWeekStart } from "@/lib/slots";

interface AdminReservation {
  id: string;
  student_name: string;
  grade_class: string;
  slot_date: string;
  slot_time: string;
  concern: string;
  created_at: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [weekStart, setWeekStart] = useState(() => getDefaultDisplayWeekStart());
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annSubmitting, setAnnSubmitting] = useState(false);
  const [annMsg, setAnnMsg] = useState("");
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);

  const storedPw = typeof window !== "undefined" ? sessionStorage.getItem("admin_pw") : null;

  useEffect(() => {
    if (storedPw) {
      setPassword(storedPw);
      setAuthenticated(true);
    }
  }, [storedPw]);

  const fetchReservations = useCallback(async () => {
    if (!password) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reservations?week_start=${weekStart}`, {
        headers: { "x-admin-password": password },
      });
      if (res.status === 401) {
        setAuthenticated(false);
        sessionStorage.removeItem("admin_pw");
        setAuthError("비밀번호가 틀렸습니다.");
        return;
      }
      const data = await res.json();
      setReservations(data.reservations || []);
    } catch {
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, [weekStart, password]);

  useEffect(() => {
    if (authenticated) fetchReservations();
  }, [authenticated, fetchReservations]);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements");
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } catch {
      setAnnouncements([]);
    }
  }, []);

  useEffect(() => {
    if (authenticated) fetchAnnouncements();
  }, [authenticated, fetchAnnouncements]);

  async function handleAnnSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;
    setAnnSubmitting(true);
    setAnnMsg("");
    try {
      const url = editingAnnId
        ? `/api/admin/announcements/${editingAnnId}`
        : "/api/admin/announcements";
      const res = await fetch(url, {
        method: editingAnnId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({ title: annTitle.trim(), content: annContent.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnnMsg(data.error);
        return;
      }
      setAnnMsg(data.message);
      setAnnTitle("");
      setAnnContent("");
      setEditingAnnId(null);
      fetchAnnouncements();
    } catch {
      setAnnMsg("오류가 발생했습니다.");
    } finally {
      setAnnSubmitting(false);
    }
  }

  function handleAnnEdit(a: Announcement) {
    setEditingAnnId(a.id);
    setAnnTitle(a.title);
    setAnnContent(a.content);
    setAnnMsg("");
  }

  function handleAnnCancelEdit() {
    setEditingAnnId(null);
    setAnnTitle("");
    setAnnContent("");
  }

  async function h(id: string, title: string) {
    if (!confirm(`"${title}" 공지를 삭제할까요?`)) return;
    setAnnMsg("");
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: "DELETE",
        headers: { "x-admin-password": password },
      });
      const data = await res.json();
      if (!res.ok) {
        setAnnMsg(data.error);
        return;
      }
      setAnnMsg("공지가 삭제되었습니다.");
      if (editingAnnId === id) handleAnnCancelEdit();
      fetchAnnouncements();
    } catch {
      setAnnMsg("오류가 발생했습니다.");
    }
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    sessionStorage.setItem("admin_pw", password);
    setAuthenticated(true);
    setAuthError("");
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`${name} 학생의 예약을 취소할까요?`)) return;
    setActionMsg("");
    try {
      const res = await fetch(`/api/admin/reservations/${id}`, {
        method: "DELETE",
        headers: { "x-admin-password": password },
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(data.error);
        return;
      }
      setActionMsg("예약이 취소되었습니다.");
      fetchReservations();
    } catch {
      setActionMsg("오류가 발생했습니다.");
    }
  }

  async function handleExport() {
    try {
      const res = await fetch(`/api/admin/reservations/export?week_start=${weekStart}`, {
        headers: { "x-admin-password": password },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reservations_${weekStart}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setActionMsg("다운로드 중 오류가 발생했습니다.");
    }
  }

  function changeWeek(delta: number) {
    const monday = parse(weekStart, "yyyy-MM-dd", new Date());
    const newMonday = addDays(monday, delta * 7);
    setWeekStart(format(newMonday, "yyyy-MM-dd"));
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-snow">
        <form onSubmit={handleLogin} className="w-full max-w-xs space-y-4 text-center">
          <div className="text-5xl mb-2">🔒</div>
          <h1 className="text-xl font-bold">관리자 로그인</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            className="w-full h-[48px] px-4 rounded-xl border-2 border-lavender bg-white text-charcoal text-[15px] focus:border-deep-purple focus:ring-2 focus:ring-deep-purple/20 focus:outline-none"
          />
          {authError && <p className="text-coral text-sm">{authError}</p>}
          <button
            type="submit"
            className="w-full h-[52px] bg-deep-purple text-white rounded-button font-semibold shadow-md shadow-deep-purple/20 transition-all active:scale-[0.97]"
          >
            로그인
          </button>
        </form>
      </div>
    );
  }

  const monday = parse(weekStart, "yyyy-MM-dd", new Date());
  const friday = addDays(monday, 4);
  const weekLabel = `${format(monday, "M월 d일", { locale: ko })} ~ ${format(friday, "M월 d일", { locale: ko })}`;

  return (
    <div className="min-h-screen bg-snow">
      <header className="bg-lavender/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔒</span>
          <h1 className="text-lg font-bold">관리자 페이지</h1>
        </div>
        <button
          onClick={() => {
            sessionStorage.removeItem("admin_pw");
            setAuthenticated(false);
            setPassword("");
          }}
          className="text-sm text-deep-purple font-medium"
        >
          로그아웃
        </button>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-4 pb-8">
        {/* Announcements */}
        <section className="bg-white rounded-card p-4 border border-lavender/30 shadow-sm space-y-3">
          <h2 className="font-semibold text-base flex items-center gap-1.5">
            📢 공지사항
          </h2>

          <form onSubmit={handleAnnSubmit} className="space-y-2">
            <input
              type="text"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="제목 (예: 4월 25일 출장)"
              className="w-full h-[44px] px-3 rounded-xl border-2 border-lavender bg-white text-charcoal text-sm focus:border-deep-purple focus:ring-2 focus:ring-deep-purple/20 focus:outline-none"
            />
            <textarea
              value={annContent}
              onChange={(e) => setAnnContent(e.target.value)}
              placeholder="내용을 입력해주세요"
              rows={3}
              className="w-full px-3 py-2 rounded-xl border-2 border-lavender bg-white text-charcoal text-sm focus:border-deep-purple focus:ring-2 focus:ring-deep-purple/20 focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={annSubmitting || !annTitle.trim() || !annContent.trim()}
                className="flex-1 h-10 bg-deep-purple text-white rounded-button text-sm font-semibold active:scale-[0.97] transition disabled:bg-gray-200 disabled:text-gray-500"
              >
                {annSubmitting
                  ? "저장 중..."
                  : editingAnnId
                    ? "수정하기"
                    : "공지 등록"}
              </button>
              {editingAnnId && (
                <button
                  type="button"
                  onClick={handleAnnCancelEdit}
                  className="h-10 px-4 bg-white border border-lavender rounded-button text-sm font-medium text-deep-purple active:scale-[0.97] transition"
                >
                  취소
                </button>
              )}
            </div>
          </form>

          {annMsg && (
            <p className="text-xs text-center text-deep-purple bg-lavender/20 rounded-xl px-3 py-2">
              {annMsg}
            </p>
          )}

          {announcements.length > 0 && (
            <div className="space-y-2 pt-1">
              {announcements.map((a) => (
                <div
                  key={a.id}
                  className="bg-cream-light rounded-xl px-3 py-2.5 border-l-4 border-peach"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{a.title}</p>
                      <p className="text-xs text-charcoal/80 whitespace-pre-wrap mt-0.5">
                        {a.content}
                      </p>
                      <p className="text-[11px] text-charcoal/50 mt-1">
                        {format(new Date(a.created_at), "M월 d일 HH:mm", { locale: ko })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => handleAnnEdit(a)}
                        className="text-xs font-medium px-2 py-1 rounded-lg border border-lavender text-deep-purple hover:bg-lavender/20 transition"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleAnnDelete
                          (a.id, a.title)}
                        className="text-xs font-medium px-2 py-1 rounded-lg border border-coral/30 text-coral hover:bg-coral/5 transition"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Week Nav */}
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

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex-1 h-10 bg-mint text-charcoal rounded-button text-sm font-medium active:scale-[0.97] transition"
          >
            엑셀 다운로드
          </button>
          <button
            onClick={fetchReservations}
            className="h-10 px-4 bg-white border border-lavender rounded-button text-sm font-medium text-deep-purple active:scale-[0.97] transition"
          >
            새로고침
          </button>
        </div>

        {actionMsg && (
          <p className="text-sm text-center text-deep-purple bg-lavender/20 rounded-xl px-4 py-2">
            {actionMsg}
          </p>
        )}

        {/* Reservations List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-card bg-lavender/20 animate-pulse" />
            ))}
          </div>
        ) : reservations.length === 0 ? (
          <div className="text-center py-10 text-charcoal/50">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm">이번 주 예약이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reservations.map((r) => {
              const dateObj = new Date(r.slot_date + "T00:00:00");
              const dayLabel = format(dateObj, "M/d (EEE)", { locale: ko });
              return (
                <div
                  key={r.id}
                  className="bg-white rounded-card p-4 border border-lavender/20 shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{r.student_name}</span>
                        <span className="text-xs bg-lavender/30 px-2 py-0.5 rounded-full">
                          {r.grade_class}
                        </span>
                      </div>
                      <p className="text-sm text-charcoal/70">
                        {dayLabel} {r.slot_time}
                      </p>
                      <p className="text-sm mt-1 bg-cream-light rounded-lg px-3 py-1.5 inline-block">
                        {r.concern}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(r.id, r.student_name)}
                      className="text-coral text-xs font-medium ml-2 px-3 py-1.5 rounded-lg border border-coral/30 hover:bg-coral/5 transition"
                    >
                      취소
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-charcoal/40 pt-4">
          총 {reservations.length}건의 예약
        </p>
      </main>
    </div>
  );
}
