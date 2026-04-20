-- 공지사항 테이블 (출장/휴강 등 공지)
CREATE TABLE announcements (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    title      text        NOT NULL,
    content    text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

CREATE INDEX idx_announcements_created_at ON announcements (created_at DESC);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION set_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION set_announcements_updated_at();

-- RLS 활성화
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 (학생 페이지 상단 표시용)
CREATE POLICY "public_read" ON announcements
  FOR SELECT USING (true);

-- 관리자만 작성/수정/삭제 (service_role key 사용)
CREATE POLICY "admin_insert" ON announcements
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

CREATE POLICY "admin_update" ON announcements
  FOR UPDATE USING ((auth.jwt() ->> 'role') = 'service_role');

CREATE POLICY "admin_delete" ON announcements
  FOR DELETE USING ((auth.jwt() ->> 'role') = 'service_role');
