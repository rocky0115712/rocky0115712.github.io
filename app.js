/* ======================================================
   ポリマー添加量 最適化ツール — app.js
   ====================================================== */

(() => {
  "use strict";

  /* ---------- State ---------- */
  let filesData = [];
  let results   = [];
  let rateChart   = null;
  let targetChart = null;

  const DEFAULT_DOSAGES  = [0, 100, 200, 300];
  const MAX_PREVIEW_ROWS = 200;

  /* ---------- DOM refs ---------- */
  const csvInput      = document.getElementById("csvInput");
  const uploadArea    = document.getElementById("uploadArea");
  const fileListEl    = document.getElementById("fileList");
  const configCards   = document.getElementById("configCards");
  const btnCalc       = document.getElementById("btnCalc");
  const btnRecalc     = document.getElementById("btnRecalc");
  const resultTbody   = document.querySelector("#resultTable tbody");
  const resultCardsEl = document.getElementById("resultCards");
  const btnTarget     = document.getElementById("btnTarget");
  const targetRatioEl = document.getElementById("targetRatioValue");
  const recommendEl   = document.getElementById("recommendValue");
  const errorMsgEl    = document.getElementById("errorMessage");

  const step2 = document.getElementById("step2");
  const step3 = document.getElementById("step3");
  const step4 = document.getElementById("step4");

  const modalBackdrop = document.getElementById("modalBackdrop");
  const modalTitle    = document.getElementById("modalTitle");
  const modalBody     = document.getElementById("modalBody");
  const modalClose    = document.getElementById("modalClose");

  /* ========================================================
     1. FILE UPLOAD & PARSE
     ======================================================== */
  csvInput.addEventListener("change", (e) => handleFiles(e.target.files));

  uploadArea.addEventListener("click", () => csvInput.click());
  uploadArea.addEventListener("dragover", (e) => { e.preventDefault(); uploadArea.classList.add("dragover"); });
  uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("dragover"));
  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });

  function handleFiles(fileList) {
    for (const f of fileList) {
      if (!f.name.toLowerCase().endsWith(".csv")) continue;
      if (filesData.some(d => d.name === f.name)) continue;
      filesData.push({
        file: f, name: f.name, rawText: null, parsed: null,
        dosage: DEFAULT_DOSAGES[filesData.length] ?? 0,
        timeCol: null, weightCol: null, previewChart: null
      });
    }
    renderFileList();
    readAllFiles();
  }

  function renderFileList() {
    fileListEl.innerHTML = "";
    filesData.forEach((d, i) => {
      const el = document.createElement("div");
      el.className = "file-item";
      el.innerHTML = `<span class="file-item-name">${d.name}</span>` +
        `<button class="file-item-remove" data-idx="${i}" title="削除">&times;</button>`;
      fileListEl.appendChild(el);
    });
    fileListEl.querySelectorAll(".file-item-remove").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        if (filesData[idx].previewChart) filesData[idx].previewChart.destroy();
        filesData.splice(idx, 1);
        renderFileList();
        readAllFiles();
      });
    });
  }

  function readAllFiles() {
    let pending = filesData.filter(d => !d.rawText).length;
    if (pending === 0) { parseAllTexts(); return; }

    filesData.forEach(d => {
      if (d.rawText) return;
      const reader = new FileReader();
      reader.onload = () => {
        d.rawText = reader.result.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
        pending--;
        if (pending === 0) parseAllTexts();
      };
      reader.readAsText(d.file);
    });
  }

  function parseAllTexts() {
    filesData.forEach(d => {
      if (d.parsed) return;
      d.parsed = Papa.parse(d.rawText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      });
    });
    buildConfigUI();
  }

  /* ========================================================
     2. CONFIGURATION UI
     ======================================================== */
  function buildConfigUI() {
    if (filesData.length === 0) { step2.classList.add("hidden"); return; }
    step2.classList.remove("hidden");

    filesData.forEach(d => { if (d.previewChart) { d.previewChart.destroy(); d.previewChart = null; } });
    configCards.innerHTML = "";

    filesData.forEach((d, i) => {
      const cols = d.parsed ? d.parsed.meta.fields : [];

      const guessTime   = guessColumn(cols, ["elapsed_s", "elapsed", "sec", "time", "timestamp", "datetime", "date", "秒", "時間", "t"]);
      const guessWeight = guessColumn(cols, ["weight_g", "weight", "重量", "ろ液", "filtrate", "mass", "g", "w"]);
      d.timeCol   = d.timeCol || guessTime;
      d.weightCol = d.weightCol || guessWeight;

      const card = document.createElement("div");
      card.className = "config-card";
      card.innerHTML = `
        <div class="config-card-header">
          <span class="config-card-title" title="${d.name}">${d.name}</span>
          <button class="btn btn-secondary btn-sm btn-preview" data-idx="${i}">CSVプレビュー</button>
        </div>
        <div class="form-group">
          <label>ポリマー投与量 [mg/L]</label>
          <input type="number" class="form-input cfg-dosage" data-idx="${i}" value="${d.dosage}" min="0" step="1">
        </div>
        <div class="form-group">
          <label>時間列</label>
          <select class="form-select cfg-time" data-idx="${i}">
            ${cols.map(c => `<option value="${c}" ${c === d.timeCol ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>重量列</label>
          <select class="form-select cfg-weight" data-idx="${i}">
            ${cols.map(c => `<option value="${c}" ${c === d.weightCol ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </div>
        <div class="preview-chart-wrapper">
          <canvas id="previewChart${i}"></canvas>
        </div>
        <div class="preview-row-count" id="rowCount${i}"></div>`;
      configCards.appendChild(card);
    });

    configCards.querySelectorAll(".cfg-dosage").forEach(el => el.addEventListener("change", () => {
      filesData[Number(el.dataset.idx)].dosage = Number(el.value);
    }));
    configCards.querySelectorAll(".cfg-time").forEach(el => el.addEventListener("change", () => {
      const idx = Number(el.dataset.idx);
      filesData[idx].timeCol = el.value;
      renderPreviewChart(idx);
    }));
    configCards.querySelectorAll(".cfg-weight").forEach(el => el.addEventListener("change", () => {
      const idx = Number(el.dataset.idx);
      filesData[idx].weightCol = el.value;
      renderPreviewChart(idx);
    }));
    configCards.querySelectorAll(".btn-preview").forEach(el => el.addEventListener("click", () => {
      openCSVPreview(Number(el.dataset.idx));
    }));

    filesData.forEach((_, i) => renderPreviewChart(i));
  }

  function guessColumn(cols, hints) {
    for (const h of hints) {
      const found = cols.find(c => c.toLowerCase() === h.toLowerCase());
      if (found) return found;
    }
    for (const h of hints) {
      const found = cols.find(c => c.toLowerCase().includes(h.toLowerCase()));
      if (found) return found;
    }
    return cols[0] || null;
  }

  /* ========================================================
     3. INLINE PREVIEW CHART
     ======================================================== */
  function renderPreviewChart(idx) {
    const d = filesData[idx];
    if (!d.parsed) return;

    const { times, weights } = extractArrays(d);
    const countEl = document.getElementById(`rowCount${idx}`);
    if (countEl) countEl.textContent = `データ点数: ${times.length}`;
    if (times.length === 0) return;

    const step = Math.max(1, Math.floor(times.length / 500));
    const sT = [], sW = [];
    for (let j = 0; j < times.length; j += step) { sT.push(times[j]); sW.push(weights[j]); }

    const startTime = detectStartTime(times, weights);

    const ctx = document.getElementById(`previewChart${idx}`).getContext("2d");
    if (d.previewChart) d.previewChart.destroy();

    d.previewChart = new Chart(ctx, {
      type: "line",
      data: { datasets: [{
        label: "重量 [g]",
        data: sT.map((t, j) => ({ x: t, y: sW[j] })),
        borderColor: "#008486", backgroundColor: "rgba(0,132,134,0.1)",
        borderWidth: 1.5, pointRadius: 0, fill: true
      }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { type: "linear", title: { display: true, text: "経過時間 [s]", color: "#666", font: { size: 10 } }, ticks: { color: "#333", font: { size: 10 } } },
          y: { title: { display: true, text: "重量 [g]", color: "#666", font: { size: 10 } }, ticks: { color: "#333", font: { size: 10 } }, beginAtZero: true }
        }
      }
    });

    if (startTime != null) {
      const yMax = Math.max(...sW) * 1.1 || 10;
      d.previewChart.data.datasets.push({
        label: "ろ過開始",
        data: [{ x: startTime, y: 0 }, { x: startTime, y: yMax }],
        borderColor: "#c0392b", borderWidth: 1.5, borderDash: [4, 3],
        pointRadius: 3, pointBackgroundColor: "#c0392b",
        fill: false, showLine: true
      });
      d.previewChart.update();
    }
  }

  /* ========================================================
     4. CSV PREVIEW MODAL
     ======================================================== */
  function openCSVPreview(idx) {
    const d = filesData[idx];
    if (!d.parsed) return;

    modalTitle.textContent = `CSVプレビュー — ${d.name}`;
    const fields = d.parsed.meta.fields;
    const rows = d.parsed.data;
    const showRows = rows.slice(0, MAX_PREVIEW_ROWS);
    const truncated = rows.length > MAX_PREVIEW_ROWS;

    let html = `<table class="csv-preview-table"><thead><tr><th>#</th>`;
    fields.forEach(f => { html += `<th>${esc(f)}</th>`; });
    html += `</tr></thead><tbody>`;
    showRows.forEach((row, ri) => {
      html += `<tr><td>${ri + 1}</td>`;
      fields.forEach(f => { const v = row[f]; html += `<td>${v != null ? esc(String(v)) : ""}</td>`; });
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    html += truncated
      ? `<p class="csv-preview-note">※ 先頭 ${MAX_PREVIEW_ROWS} 行を表示（全 ${rows.length} 行）</p>`
      : `<p class="csv-preview-note">全 ${rows.length} 行</p>`;

    modalBody.innerHTML = html;
    modalBackdrop.classList.remove("hidden");
  }

  function esc(s) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  modalClose.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (e) => { if (e.target === modalBackdrop) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  function closeModal() { modalBackdrop.classList.add("hidden"); modalBody.innerHTML = ""; }

  /* ========================================================
     5. HELPERS
     ======================================================== */
  function extractArrays(d) {
    const rows = d.parsed.data;
    const tCol = d.timeCol, wCol = d.weightCol;
    const times = [], weights = [];
    rows.forEach(r => {
      const t = parseFloat(r[tCol]);
      const w = parseFloat(r[wCol]);
      if (!isNaN(t) && !isNaN(w)) { times.push(t); weights.push(w); }
    });
    return { times, weights };
  }

  function detectChangeIndex(weights) {
    for (let j = 0; j < weights.length; j++) {
      if (weights[j] >= 1) return j;
    }
    return -1;
  }

  function detectStartTime(times, weights) {
    const ci = detectChangeIndex(weights);
    if (ci < 0) return null;
    return times[ci] - 1;
  }

  /* ========================================================
     6. ANALYSIS
     ======================================================== */
  btnCalc.addEventListener("click", () => runAnalysis(false));
  btnRecalc.addEventListener("click", () => runAnalysis(true));

  function runAnalysis(useManualOverrides) {
    const manualStarts = {};
    if (useManualOverrides) {
      document.querySelectorAll(".start-time-input").forEach(inp => {
        const idx = Number(inp.dataset.idx);
        const val = parseFloat(inp.value);
        const prev = results[idx];
        if (prev && !isNaN(val)) {
          manualStarts[idx] = { time: val, manual: Math.abs(val - (prev.autoStart ?? NaN)) > 0.01 };
        }
      });
    }

    results = [];
    filesData.forEach((d, idx) => {
      if (!d.parsed) return;
      const { times, weights } = extractArrays(d);

      const autoStartTime = detectStartTime(times, weights);
      let startTime = autoStartTime;
      let isManual = false;

      if (useManualOverrides && manualStarts[idx] != null) {
        startTime = manualStarts[idx].time;
        isManual  = manualStarts[idx].manual;
      }

      if (startTime == null || times.length === 0) {
        results.push({ name: d.name, dosage: d.dosage, autoStart: null, startTime: null, rate: null, ratio: null, manual: false });
        return;
      }

      let startIdx = 0, minDist = Infinity;
      for (let j = 0; j < times.length; j++) {
        const dist = Math.abs(times[j] - startTime);
        if (dist < minDist) { minDist = dist; startIdx = j; }
      }

      const tRef = times[startIdx];
      const wT = [], wW = [];
      for (let j = startIdx; j < times.length; j++) {
        if (times[j] - tRef > 15) break;
        wT.push(times[j] - tRef);
        wW.push(weights[j]);
      }

      const rate = linRegSlope(wT, wW);

      results.push({
        name: d.name, dosage: d.dosage,
        autoStart: autoStartTime, startTime, rate,
        ratio: null, manual: isManual
      });
    });

    const baseline = results.find(r => r.dosage === 0);
    const baseRate = baseline && baseline.rate ? baseline.rate : null;
    results.forEach(r => {
      if (r.rate != null && baseRate != null && baseRate !== 0) {
        r.ratio = ((r.rate - baseRate) / baseRate) * 100;
      }
    });

    renderResults();
  }

  function linRegSlope(x, y) {
    const n = x.length;
    if (n < 2) return null;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxx += x[i]*x[i]; sxy += x[i]*y[i]; }
    const denom = n * sxx - sx * sx;
    if (denom === 0) return null;
    return (n * sxy - sx * sy) / denom;
  }

  /* ========================================================
     7. RENDER RESULTS — Table (desktop) + Cards (mobile)
     ======================================================== */
  function renderResults() {
    step3.classList.remove("hidden");
    step4.classList.remove("hidden");

    /* --- Desktop table --- */
    resultTbody.innerHTML = "";
    results.forEach((r, i) => {
      const tr = document.createElement("tr");
      const startVal = r.startTime != null ? Math.round(r.startTime) : "";
      const tagClass = r.manual ? "tag-manual" : "tag-auto";
      const tagLabel = r.manual ? "手動設定" : "自動検出";

      tr.innerHTML = `
        <td>${r.name}</td>
        <td>${r.dosage}</td>
        <td>
          <input type="number" class="form-input-inline start-time-input ${r.manual ? "manual" : ""}"
                 data-idx="${i}" value="${startVal}" step="1">
        </td>
        <td><span class="tag ${tagClass}">${tagLabel}</span></td>
        <td>${r.rate != null ? r.rate.toFixed(4) : "—"}</td>
        <td>${r.ratio != null ? r.ratio.toFixed(1) : "—"}</td>`;
      resultTbody.appendChild(tr);
    });

    /* --- Mobile cards --- */
    resultCardsEl.innerHTML = "";
    results.forEach((r, i) => {
      const startVal = r.startTime != null ? Math.round(r.startTime) : "";
      const tagClass = r.manual ? "tag-manual" : "tag-auto";
      const tagLabel = r.manual ? "手動設定" : "自動検出";

      const card = document.createElement("div");
      card.className = "result-card";
      card.innerHTML = `
        <div class="result-card-title">${r.name}</div>
        <div class="result-card-row">
          <span class="result-card-label">ポリマー投与量</span>
          <span class="result-card-value">${r.dosage} mg/L</span>
        </div>
        <div class="result-card-row">
          <span class="result-card-label">ろ過開始時刻</span>
          <span class="result-card-value">
            <input type="number" class="form-input-inline start-time-input ${r.manual ? "manual" : ""}"
                   data-idx="${i}" value="${startVal}" step="1"> s
            <span class="tag ${tagClass}">${tagLabel}</span>
          </span>
        </div>
        <div class="result-card-row">
          <span class="result-card-label">初期ろ過速度</span>
          <span class="result-card-value">${r.rate != null ? r.rate.toFixed(4) : "—"} g/s</span>
        </div>
        <div class="result-card-row">
          <span class="result-card-label">増加割合</span>
          <span class="result-card-value">${r.ratio != null ? r.ratio.toFixed(1) + " %" : "—"}</span>
        </div>`;
      resultCardsEl.appendChild(card);
    });

    /* --- Attach listeners to ALL .start-time-input (table + cards) --- */
    document.querySelectorAll(".start-time-input").forEach(inp => {
      inp.addEventListener("input", () => {
        const idx = Number(inp.dataset.idx);
        const r = results[idx];
        if (!r) return;
        const val = parseFloat(inp.value);
        const isManual = r.autoStart != null && !isNaN(val) && Math.abs(val - r.autoStart) > 0.01;

        /* Update ALL inputs & tags with the same data-idx (keep table & cards in sync) */
        document.querySelectorAll(`.start-time-input[data-idx="${idx}"]`).forEach(other => {
          if (other !== inp) other.value = inp.value;
          const tagEl = other.closest("tr, .result-card-row")?.querySelector(".tag");
          if (tagEl) {
            if (isManual) {
              other.classList.add("manual");
              tagEl.className = "tag tag-manual";
              tagEl.textContent = "手動設定";
            } else {
              other.classList.remove("manual");
              tagEl.className = "tag tag-auto";
              tagEl.textContent = "自動検出";
            }
          }
        });
      });
    });

    /* --- Line chart --- */
    const sorted = [...results].filter(r => r.rate != null).sort((a, b) => a.dosage - b.dosage);

    const ctx = document.getElementById("chartRate").getContext("2d");
    if (rateChart) rateChart.destroy();
    rateChart = new Chart(ctx, {
      type: "line",
      data: {
        datasets: [{
          label: "初期ろ過速度 [g/s]",
          data: sorted.map(r => ({ x: r.dosage, y: r.rate })),
          borderColor: "#008486",
          backgroundColor: "rgba(0,132,134,0.1)",
          borderWidth: 2,
          pointRadius: 5,
          pointBackgroundColor: "#008486",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: "ポリマー投与量 vs 初期ろ過速度", color: "#333", font: { size: 14, weight: "400" } },
          legend: { labels: { color: "#333" } }
        },
        scales: {
          x: { type: "linear", title: { display: true, text: "ポリマー投与量 [mg/L]", color: "#666" }, ticks: { color: "#333", stepSize: 50 } },
          y: { title: { display: true, text: "初期ろ過速度 [g/s]", color: "#666" }, ticks: { color: "#333" }, beginAtZero: true }
        }
      }
    });
  }

  /* ========================================================
     8. TARGET CALCULATION
     ======================================================== */
  btnTarget.addEventListener("click", computeTarget);

  function clearTargetError() {
    targetRatioEl.classList.remove("error-value");
    recommendEl.classList.remove("error-value");
    errorMsgEl.classList.add("hidden");
    errorMsgEl.textContent = "";
  }

  function computeTarget() {
    clearTargetError();

    const washInc = Number(document.getElementById("targetWashInterval").value);
    const volInc  = Number(document.getElementById("targetVolumeIncrease").value);

    const targetRatio = (washInc * volInc) / 10;
    targetRatioEl.textContent = targetRatio.toFixed(1) + " %";

    const sorted = [...results].filter(r => r.ratio != null).sort((a, b) => a.dosage - b.dosage);

    if (sorted.length < 2) {
      recommendEl.textContent = "データ不足";
      renderTargetChart(sorted, targetRatio, false);
      return;
    }

    const maxRatio = Math.max(...sorted.map(r => r.ratio));

    if (targetRatio > maxRatio) {
      targetRatioEl.classList.add("error-value");
      recommendEl.textContent = "—";
      recommendEl.classList.add("error-value");
      errorMsgEl.classList.remove("hidden");
      errorMsgEl.textContent = `目標値（${targetRatio.toFixed(1)}%）がデータから算出可能な最大増加割合（${maxRatio.toFixed(1)}%）を超えています。ポリマー投与量の範囲を拡大するか、目標値を見直してください。`;
      renderTargetChart(sorted, targetRatio, true);
      return;
    }

    let recommendDosage = null;
    if (targetRatio <= sorted[0].ratio) {
      recommendDosage = sorted[0].dosage;
    } else {
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].ratio <= targetRatio && sorted[i + 1].ratio >= targetRatio) {
          const frac = (targetRatio - sorted[i].ratio) / (sorted[i + 1].ratio - sorted[i].ratio);
          recommendDosage = sorted[i].dosage + frac * (sorted[i + 1].dosage - sorted[i].dosage);
          break;
        }
      }
    }

    recommendEl.textContent = recommendDosage != null ? recommendDosage.toFixed(0) + " mg/L" : "データ不足";
    renderTargetChart(sorted, targetRatio, false);
  }

  /* ========================================================
     9. TARGET CHART
     ======================================================== */
  function renderTargetChart(sorted, targetRatio, isError) {
    const ctx = document.getElementById("chartTarget").getContext("2d");
    if (targetChart) targetChart.destroy();

    targetChart = new Chart(ctx, {
      type: "line",
      data: {
        datasets: [
          {
            label: "増加割合 [%]",
            data: sorted.map(r => ({ x: r.dosage, y: r.ratio })),
            borderColor: "#008486",
            backgroundColor: "rgba(0,132,134,0.1)",
            borderWidth: 2,
            pointRadius: 5,
            pointBackgroundColor: "#008486",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            tension: 0.3,
            fill: true,
            order: 2
          },
          {
            label: isError ? "目標（範囲超過）" : "目標増加割合 [%]",
            data: (() => {
              const xMin = sorted.length ? sorted[0].dosage : 0;
              const xMax = sorted.length ? sorted[sorted.length - 1].dosage : 300;
              return [{ x: xMin, y: targetRatio }, { x: xMax, y: targetRatio }];
            })(),
            borderColor: "#c0392b",
            borderWidth: 2,
            borderDash: isError ? [3, 3] : [6, 4],
            pointRadius: 0,
            fill: false,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: "増加割合 vs 目標ライン", color: "#333", font: { size: 14, weight: "400" } },
          legend: { labels: { color: "#333" } }
        },
        scales: {
          x: { type: "linear", title: { display: true, text: "ポリマー投与量 [mg/L]", color: "#666" }, ticks: { color: "#333", stepSize: 50 } },
          y: { title: { display: true, text: "増加割合 [%]", color: "#666" }, ticks: { color: "#333" } }
        }
      }
    });
  }

})();
