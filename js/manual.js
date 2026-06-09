"use strict";

/**
 * マニュアルページの初期化
 */
async function initManual() {
  const container = document.getElementById("manual-list");
  if (!container) return;

  const data = await loadJSON("data/manuals.json");
  if (!data) {
    container.innerHTML = '<p class="text-secondary">データの読み込みに失敗しました。</p>';
    return;
  }

  const manuals = data.manuals;
  renderManuals(manuals, container);

  // カテゴリフィルター
  document.querySelectorAll(".category-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".category-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const cat = tab.dataset.category;
      if (cat === "all") {
        renderManuals(manuals, container);
      } else {
        renderManuals(manuals.filter(m => m.category === cat), container);
      }
    });
  });
}

/**
 * マニュアルカードをレンダリング
 */
function renderManuals(manuals, container) {
  container.innerHTML = "";

  if (manuals.length === 0) {
    container.innerHTML = '<p class="text-secondary text-center mt-lg">該当するマニュアルはありません。</p>';
    return;
  }

  manuals.forEach(m => {
    const card = document.createElement("article");
    card.className = "card manual-card";
    card.dataset.category = m.category;

    let contentInner = "";
    if (m.contentType === "html") {
      contentInner = `<div class="manual-content-inner">${m.content}</div>`;
    } else if (m.contentType === "pdf") {
      contentInner = `<iframe src="${m.content}" width="100%" height="500" style="border:none; border-radius:var(--radius-sm);"></iframe>`;
    }

    card.innerHTML = `
      <div class="manual-header" role="button" tabindex="0" aria-expanded="false">
        <div>
          <div class="manual-title">${m.title}</div>
          <div class="manual-meta">
            <span class="badge badge-category">${m.category}</span>
            <span>更新日: ${m.updatedAt}</span>
          </div>
        </div>
        <span class="expand-icon" aria-hidden="true">▼</span>
      </div>
      <div class="manual-content">
        ${contentInner}
      </div>
    `;

    // アコーディオン開閉
    const header = card.querySelector(".manual-header");
    const content = card.querySelector(".manual-content");

    header.addEventListener("click", () => toggleAccordion(card, content));
    header.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleAccordion(card, content);
      }
    });

    container.appendChild(card);
  });
}

function toggleAccordion(card, content) {
  const isOpen = card.classList.contains("open");
  card.classList.toggle("open");

  const header = card.querySelector(".manual-header");
  header.setAttribute("aria-expanded", !isOpen);

  if (!isOpen) {
    content.style.maxHeight = content.scrollHeight + "px";
  } else {
    content.style.maxHeight = "0px";
  }
}

document.addEventListener("DOMContentLoaded", initManual);
