"use strict";

/* ============================
   ユーティリティ関数
   ============================ */

/**
 * JSON ファイルを非同期で読み込む
 * @param {string} path - JSON ファイルのパス
 * @returns {Promise<Object>} パース済みオブジェクト
 */
async function loadJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
    return await res.json();
  } catch (err) {
    console.error(`[loadJSON] データ読み込みエラー: ${path}`, err);
    return null;
  }
}

/**
 * 日付文字列を日本語フォーマットに変換
 * @param {string} dateStr - "YYYY-MM-DD" 形式
 * @param {string} [dayOfWeek] - 曜日文字列（任意）
 * @returns {string} "2026年7月1日（水）" 形式
 */
function formatDate(dateStr, dayOfWeek) {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["日","月","火","水","木","金","土"];
  const dow = dayOfWeek || days[d.getDay()];
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${dow}）`;
}

/**
 * 日付が過去かどうか判定
 * @param {string} dateStr - "YYYY-MM-DD" 形式
 * @returns {boolean}
 */
function isPast(dateStr) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const target = new Date(dateStr + "T00:00:00");
  return target < today;
}

/* ============================
   ハンバーガーメニュー
   ============================ */
document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.querySelector(".hamburger");
  const navList = document.querySelector(".nav-list");

  if (hamburger && navList) {
    hamburger.addEventListener("click", () => {
      hamburger.classList.toggle("open");
      navList.classList.toggle("open");
      const expanded = hamburger.getAttribute("aria-expanded") === "true";
      hamburger.setAttribute("aria-expanded", !expanded);
    });

    // メニューリンククリックで閉じる
    navList.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        hamburger.classList.remove("open");
        navList.classList.remove("open");
        hamburger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ============================
     現在のページをハイライト
     ============================ */
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-list a").forEach(link => {
    const href = link.getAttribute("href");
    if (href === currentPage) {
      link.classList.add("active");
    }
  });
});
