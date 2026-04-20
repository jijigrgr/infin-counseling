-- 공지사항 RLS 정책 보강: service_role 에 대한 INSERT/UPDATE/DELETE 허용
-- (BYPASSRLS 만으로 의존할 때 PostgREST 경유 delete 가 0 rows 로 조용히 실패하는 문제 해결)

CREATE POLICY "admin_insert" ON announcements
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admin_update" ON announcements
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "admin_delete" ON announcements
  FOR DELETE USING (auth.role() = 'service_role');
