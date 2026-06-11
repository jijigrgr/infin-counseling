// ============================================================================
// 김지현 선생님 상담 예약 시스템 (Google Apps Script 버전)
// ============================================================================

// ⚠️ 아래 값을 본인 구글 시트 ID 로 교체하세요!
// 시트 URL: https://docs.google.com/spreadsheets/d/[이부분이ID]/edit
const SHEET_ID = '여기에_본인_시트_ID_붙여넣기';

const ADMIN_PASSWORD_KEY = 'ADMIN_PASSWORD';
const TZ = 'Asia/Seoul';

// ============================================================================
// 라우팅
// ============================================================================
function doGet(e) {
  const page = e.parameter.page === 'admin' ? 'Admin' : 'Index';
  return HtmlService.createTemplateFromFile(page)
    .evaluate()
    .setTitle(page === 'Admin' ? '관리자 - 상담 예약' : '상담 예약')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

// ============================================================================
// 시트 헬퍼
// ============================================================================
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === 'Reservations') {
      sheet.getRange(1, 1, 1, 7).setValues([['id', '이름', '학년반', '날짜', '시간', '고민', '등록일시']]);
      sheet.setFrozenRows(1);
    } else if (name === 'Announcements') {
      sheet.getRange(1, 1, 1, 5).setValues([['id', '제목', '내용', '등록일시', '수정일시']]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function uuid() {
  return Utilities.getUuid();
}

function ymd(date) {
  return Utilities.formatDate(date instanceof Date ? date : new Date(date), TZ, 'yyyy-MM-dd');
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ============================================================================
// 시간대 규칙
// ============================================================================
// 7:30 → 월화수목금 / 16:00, 16:30 → 화수금
function isValidSlot(dateStr, time) {
  const date = new Date(dateStr + 'T00:00:00');
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false;
  if (time === '07:30') return [1, 2, 3, 4, 5].includes(dow);
  if (time === '16:00' || time === '16:30') return [2, 3, 5].includes(dow);
  return false;
}

function isPastSlot(dateStr, time) {
  const [h, m] = time.split(':').map(Number);
  const slotEnd = new Date(dateStr + 'T00:00:00');
  slotEnd.setHours(h, m + 30, 0, 0);
  return slotEnd < new Date();
}

// ============================================================================
// 관리자 비밀번호 확인
// ============================================================================
function verifyAdmin(password) {
  const stored = PropertiesService.getScriptProperties().getProperty(ADMIN_PASSWORD_KEY);
  return !!stored && password === stored;
}

// 초기 비밀번호 설정 (한 번만 실행. 메뉴에서 직접 실행)
function setAdminPassword() {
  const pw = Browser.inputBox('관리자 비밀번호', '사용할 비밀번호를 입력하세요:', Browser.Buttons.OK_CANCEL);
  if (pw && pw !== 'cancel') {
    PropertiesService.getScriptProperties().setProperty(ADMIN_PASSWORD_KEY, pw);
    Browser.msgBox('비밀번호가 설정되었습니다.');
  }
}

// ============================================================================
// 학생 - 예약 조회
// ============================================================================
function getReservationsPublic(weekStart) {
  const sheet = getSheet('Reservations');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 5);

  const result = [];
  for (let i = 1; i < data.length; i++) {
    const d = data[i][3] instanceof Date ? data[i][3] : new Date(data[i][3]);
    if (d >= start && d < end) {
      result.push({
        id: String(data[i][0]),
        student_name: String(data[i][1]),
        grade_class: String(data[i][2]),
        slot_date: ymd(d),
        slot_time: String(data[i][4]),
      });
    }
  }
  return result;
}

// ============================================================================
// 학생 - 예약 생성
// ============================================================================
function createReservation(payload) {
  try {
    const name = (payload.student_name || '').trim();
    const grade = (payload.grade_class || '').trim();
    const date = (payload.slot_date || '').trim();
    const time = (payload.slot_time || '').trim();
    const concern = (payload.concern || '').trim();

    if (!name || !grade || !date || !time || !concern) {
      return { error: '모든 항목을 입력해주세요.' };
    }
    if (!isValidSlot(date, time)) {
      return { error: '예약 가능한 시간이 아닙니다.' };
    }
    if (isPastSlot(date, time)) {
      return { error: '이미 지난 시간입니다.' };
    }

    const sheet = getSheet('Reservations');
    const all = sheet.getDataRange().getValues();

    // 같은 슬롯 중복 체크
    for (let i = 1; i < all.length; i++) {
      const rowDate = ymd(all[i][3]);
      if (rowDate === date && String(all[i][4]) === time) {
        return { error: '이미 예약된 시간입니다.' };
      }
    }

    // 같은 학생 같은 주 중복 체크
    const slotDate = new Date(date + 'T00:00:00');
    const monday = getMonday(slotDate);
    const friday = new Date(monday);
    friday.setDate(friday.getDate() + 5);

    for (let i = 1; i < all.length; i++) {
      const rowDate = all[i][3] instanceof Date ? all[i][3] : new Date(all[i][3]);
      if (rowDate >= monday && rowDate < friday) {
        if (String(all[i][1]) === name && String(all[i][2]) === grade) {
          return { error: '같은 주에 이미 예약이 있어요.' };
        }
      }
    }

    const id = uuid();
    sheet.appendRow([id, name, grade, date, time, concern, new Date()]);

    return {
      success: true,
      message: formatConfirmation(date, time),
      reservation: { id, student_name: name, grade_class: grade, slot_date: date, slot_time: time, concern },
    };
  } catch (err) {
    return { error: '오류가 발생했어요: ' + err.message };
  }
}

function formatConfirmation(dateStr, time) {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = days[date.getDay()];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const [h, m] = time.split(':');
  const timeStr = m === '00' ? `${parseInt(h)}시` : `${parseInt(h)}시 ${m}분`;
  return `${month}월 ${day}일 ${dayName}요일 ${timeStr}에 예약되었어요.`;
}

// ============================================================================
// 공지사항 (공개)
// ============================================================================
function getAnnouncementsPublic() {
  const sheet = getSheet('Announcements');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const created = data[i][3] instanceof Date ? data[i][3] : new Date(data[i][3]);
    result.push({
      id: String(data[i][0]),
      title: String(data[i][1]),
      content: String(data[i][2]),
      created_at: created.toISOString(),
    });
  }
  return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// ============================================================================
// 관리자 - 예약 관리
// ============================================================================
function adminGetReservations(password, weekStart) {
  if (!verifyAdmin(password)) return { error: '비밀번호가 틀렸어요.' };
  const sheet = getSheet('Reservations');
  const data = sheet.getDataRange().getValues();
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 5);

  const reservations = [];
  for (let i = 1; i < data.length; i++) {
    const d = data[i][3] instanceof Date ? data[i][3] : new Date(data[i][3]);
    if (d >= start && d < end) {
      reservations.push({
        id: String(data[i][0]),
        student_name: String(data[i][1]),
        grade_class: String(data[i][2]),
        slot_date: ymd(d),
        slot_time: String(data[i][4]),
        concern: String(data[i][5]),
      });
    }
  }
  return { reservations };
}

function adminCancelReservation(password, id) {
  if (!verifyAdmin(password)) return { error: '비밀번호가 틀렸어요.' };
  const sheet = getSheet('Reservations');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.deleteRow(i + 1);
      return { success: true, message: '예약이 취소되었어요.' };
    }
  }
  return { error: '해당 예약을 찾을 수 없어요.' };
}

function adminExportReservations(password, weekStart) {
  if (!verifyAdmin(password)) return { error: '비밀번호가 틀렸어요.' };
  const sheet = getSheet('Reservations');
  const data = sheet.getDataRange().getValues();
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 5);

  const rows = [['이름', '학년반', '날짜', '요일', '시간', '고민']];
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  for (let i = 1; i < data.length; i++) {
    const d = data[i][3] instanceof Date ? data[i][3] : new Date(data[i][3]);
    if (d >= start && d < end) {
      rows.push([
        String(data[i][1]),
        String(data[i][2]),
        ymd(d),
        days[d.getDay()],
        String(data[i][4]),
        String(data[i][5]),
      ]);
    }
  }
  // 정렬: 날짜 → 시간
  const header = rows.shift();
  rows.sort((a, b) => (a[2] + a[4]).localeCompare(b[2] + b[4]));
  rows.unshift(header);
  return { rows };
}

// ============================================================================
// 관리자 - 공지 관리
// ============================================================================
function adminCreateAnnouncement(password, title, content) {
  if (!verifyAdmin(password)) return { error: '비밀번호가 틀렸어요.' };
  title = (title || '').trim();
  content = (content || '').trim();
  if (!title || !content) return { error: '제목과 내용을 입력해주세요.' };
  const sheet = getSheet('Announcements');
  const now = new Date();
  sheet.appendRow([uuid(), title, content, now, now]);
  return { success: true, message: '공지가 등록되었어요.' };
}

function adminUpdateAnnouncement(password, id, title, content) {
  if (!verifyAdmin(password)) return { error: '비밀번호가 틀렸어요.' };
  title = (title || '').trim();
  content = (content || '').trim();
  if (!title || !content) return { error: '제목과 내용을 입력해주세요.' };
  const sheet = getSheet('Announcements');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.getRange(i + 1, 2).setValue(title);
      sheet.getRange(i + 1, 3).setValue(content);
      sheet.getRange(i + 1, 5).setValue(new Date());
      return { success: true, message: '공지가 수정되었어요.' };
    }
  }
  return { error: '해당 공지를 찾을 수 없어요.' };
}

function adminDeleteAnnouncement(password, id) {
  if (!verifyAdmin(password)) return { error: '비밀번호가 틀렸어요.' };
  const sheet = getSheet('Announcements');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.deleteRow(i + 1);
      return { success: true, message: '공지가 삭제되었어요.' };
    }
  }
  return { error: '해당 공지를 찾을 수 없어요.' };
}

// ============================================================================
// 초기 세팅: 메뉴 추가 (시트 열 때 자동 실행)
// ============================================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🛠 상담 예약 설정')
    .addItem('관리자 비밀번호 설정', 'setAdminPassword')
    .addToUi();
}
