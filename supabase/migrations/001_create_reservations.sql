-- 상담 예약 테이블
CREATE TABLE reservations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text       NOT NULL,
  grade_class  text       NOT NULL,
  slot_date    date       NOT NULL,
  slot_time    text       NOT NULL CHECK (slot_time IN ('07:30', '16:00', '16:30')),
  concern      text       NOT NULL,
  week_number  integer    NOT NULL,
  week_year    integer    NOT NULL,
  created_at   timestamptz DEFAULT now()
);

-- 같은 날짜·시간에 중복 예약 방지 (슬롯당 1명)
ALTER TABLE reservations
  ADD CONSTRAINT uq_slot UNIQUE (slot_date, slot_time);

-- 같은 학생이 같은 주에 2번 예약 방지
ALTER TABLE reservations
  ADD CONSTRAINT uq_student_per_week UNIQUE (student_name, grade_class, week_year, week_number);

-- 조회 성능용 인덱스
CREATE INDEX idx_reservations_date ON reservations (slot_date);
CREATE INDEX idx_reservations_student_week ON reservations (student_name, grade_class, week_year, week_number);

-- RLS 활성화
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 (캘린더 표시)
CREATE POLICY "public_read" ON reservations
  FOR SELECT USING (true);

-- 공개 삽입 (로그인 없이 예약)
CREATE POLICY "public_insert" ON reservations
  FOR INSERT WITH CHECK (true);

-- 관리자만 수정/삭제 (service_role key 사용)
CREATE POLICY "admin_update" ON reservations
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "admin_delete" ON reservations
  FOR DELETE USING (auth.role() = 'service_role');
