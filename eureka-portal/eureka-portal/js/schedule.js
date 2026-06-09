"use strict";

const STORAGE_KEY = "eureka_attendance";

/**
 * localStorage から参加可否データを取得
 */
function getAttendanceData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * localStorage に参加可否データを保存
 */
function saveAttendanceData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * ステータスバッジHTMLを生成
 */
function statusBadgeHTML(status) {
  if (status === "○") return '<span class="status-badge status-yes">○</span>';
  if (status === "△") return '<span class="status-badge status-maybe">△</span>';
  if (status === "×") return '<span class="status-badge status-no">×</span>';
  return '<span class="status-badge status-none">—</span>';
}

/**
 * スケジュールページの初期化
 */
async function initSchedule() {
  const container = document.getElementById("schedule-list");
  if (!container) return;

  const [scheduleData, memberData] = await Promise.all([
    loadJSON("data/schedules.json"),
    loadJSON("data/members.json")
  ]);

  if (!scheduleData || !memberData) {
    container.innerHTML = '<p class="text-secondary">データの読み込みに失敗しました。</p>';
    return;
  }

  const schedules = scheduleData.schedules;
  const members = memberData.members;
  const attendance = getAttendanceData();

  // 日付でソート（新しい順 → 未来が上、過去が下）
  schedules.sort((a, b) => {
    const aP = isPast(a.date) ? 1 : 0;
    const bP = isPast(b.date) ? 1 : 0;
    if (aP !== bP) return aP - bP;
    return aP ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date);
  });

  container.innerHTML = "";

  schedules.forEach(sch => {
    const past = isPast(sch.date);
    const card = document.createElement("article");
    card.className = `card schedule-card${past ? " past" : ""}`;

    const att = { ...(sch.attendance || {}), ...(attendance[sch.id] || {}) };

    let noteHTML = sch.note ? `<div class="note">📝 ${sch.note}</div>` : "";

    let matrixRows = members.map(m => {
      const s = att[m.id] || "";
      return `<tr><td>${m.name}</td><td>${m.part}</td><td>${statusBadgeHTML(s)}</td></tr>`;
    }).join("");

    card.innerHTML = `
      ${past ? '<span class="badge badge-ended ended-badge">終了</span>' : ''}
      <div class="date-display">${formatDate(sch.date, sch.dayOfWeek)}</div>
      <div class="time-location">
        <span>🕐 ${sch.startTime}〜${sch.endTime}</span>
        <span>📍 ${sch.location}</span>
      </div>
      ${sch.address ? `<div class="time-location" style="margin-top:2px;"><span style="font-size:0.75rem;">　　${sch.address}</span></div>` : ''}
      ${noteHTML}
      <div class="attendance-matrix">
        <h3>参加可否</h3>
        <table class="attendance-table">
          <thead><tr><th>団員名</th><th>パート</th><th>参加</th></tr></thead>
          <tbody>${matrixRows}</tbody>
        </table>
        ${!past ? `<div class="attendance-actions">
          <button class="btn-primary" onclick="openModal('${sch.id}')">参加登録</button>
        </div>` : ''}
      </div>
    `;
    container.appendChild(card);
  });

  // モーダルに団員リストをセット
  const memberSelect = document.getElementById("modal-member");
  if (memberSelect) {
    memberSelect.innerHTML = '<option value="">選択してください</option>' +
      members.map(m => `<option value="${m.id}">${m.name}（${m.part}）</option>`).join("");
  }
}

/* ============================
   モーダル制御
   ============================ */
let currentScheduleId = null;

function openModal(scheduleId) {
  currentScheduleId = scheduleId;
  const overlay = document.getElementById("attendance-modal");
  if (overlay) {
    overlay.classList.add("open");
    // 既存の選択をリセット
    document.getElementById("modal-member").value = "";
    document.querySelectorAll('input[name="attendance"]').forEach(r => r.checked = false);
  }
}

function closeModal() {
  const overlay = document.getElementById("attendance-modal");
  if (overlay) overlay.classList.remove("open");
  currentScheduleId = null;
}

function submitAttendance() {
  const memberId = document.getElementById("modal-member").value;
  const statusEl = document.querySelector('input[name="attendance"]:checked');

  if (!memberId) { alert("団員を選択してください。"); return; }
  if (!statusEl) { alert("参加可否を選択してください。"); return; }

  const status = statusEl.value;
  const data = getAttendanceData();
  if (!data[currentScheduleId]) data[currentScheduleId] = {};
  data[currentScheduleId][memberId] = status;
  saveAttendanceData(data);

  closeModal();
  // 再描画
  initSchedule();
}

// ページ読み込み時に初期化
document.addEventListener("DOMContentLoaded", initSchedule);

// モーダル外クリックで閉じる
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-overlay")) {
    closeModal();
  }
});

// Escキーでモーダルを閉じる
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});
