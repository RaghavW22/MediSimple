// js/dashboard.js
// MediSimple — Dashboard Logic with PDF Upload + Live NER Data

(function () {

  const API_BASE = 'http://localhost:5000';

  // Active data source — starts with SAMPLE_REPORT, replaced on upload
  let activeData = null;
  let currentMode = 'demo'; // 'demo' | 'live'
  let currentUser = null;
  let chartInstances = [];

  function checkSession() {
    const s = localStorage.getItem('ms_session') || sessionStorage.getItem('ms_session');
    if (s) {
      try {
        currentUser = JSON.parse(s);
        // update nav elements
        const nameEl = document.getElementById('navPatientName');
        const addrEl = document.getElementById('navPatientAddress');
        const subEl = document.getElementById('headerSubText');
        if (nameEl) nameEl.textContent = `👤 ${currentUser.name}`;
        if (addrEl && currentUser.address) addrEl.textContent = currentUser.address;
        if (subEl) subEl.textContent = `Comprehensive breakdown of ${currentUser.name}'s latest lab results.`;
      } catch (e) {
        console.error("Session parse error", e);
      }
    }
  }

  // Read data passed from index.html via sessionStorage
  function getInitialData() {
    try {
      const stored = sessionStorage.getItem('medisimple_report');
      const mode   = sessionStorage.getItem('medisimple_mode') || 'demo';
      if (stored) {
        sessionStorage.removeItem('medisimple_report');
        sessionStorage.removeItem('medisimple_mode');
        return { data: JSON.parse(stored), mode };
      }
    } catch (e) {}
    return null;
  }

  // ──────────────────────────────────────────
  // RENDER: METRICS GRID
  // ──────────────────────────────────────────
  function renderMetricsGrid(metrics) {
    const grid = document.getElementById('dbMetricsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    metrics.forEach((metric, i) => {
      const card = document.createElement('div');
      card.className = `db-metric-card ${metric.status}`;
      card.style.animationDelay = `${i * 0.08}s`;

      const trendSymbol = metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→';
      const trendColor  = metric.trend === 'up' ? '#ef4444' : metric.trend === 'down' ? '#10b981' : '#f59e0b';
      const icon = metric.icon || '📊';

      card.innerHTML = `
        <div class="db-card-top">
          <span class="db-card-name">${icon} ${metric.name}</span>
          <span class="db-card-badge ${metric.status}">${capitalize(metric.status)}</span>
        </div>
        <div class="db-card-value" style="color: ${getValueColor(metric.status)}">${metric.value}</div>
        <div class="db-card-unit">${metric.unit}</div>
        <div class="db-card-range">
          <span class="range-dot ${metric.status}"></span>
          Normal: ${metric.range}
          <span style="margin-left:auto;color:${trendColor};font-weight:700;font-size:16px">${trendSymbol}</span>
        </div>
      `;
      grid.appendChild(card);
    });

    // Update count tag
    const tag = document.getElementById('metricsCountTag');
    if (tag) {
      const found = metrics.filter(m => m.value !== 'N/A').length;
      tag.textContent = `${found} markers analyzed`;
    }
  }

  // ──────────────────────────────────────────
  // RENDER: BREAKDOWN LIST
  // ──────────────────────────────────────────
  function renderBreakdown(metrics) {
    const list = document.getElementById('breakdownList');
    if (!list) return;
    list.innerHTML = '';

    metrics.forEach((metric, i) => {
      const item = document.createElement('div');
      item.className = 'breakdown-item';
      item.style.animationDelay = `${i * 0.07}s`;
      const icon = metric.icon || '📊';

      item.innerHTML = `
        <div class="breakdown-icon ${metric.status}">${icon}</div>
        <div class="breakdown-content">
          <div class="breakdown-name">${metric.name}</div>
          <div class="breakdown-text">${metric.description || ''}</div>
        </div>
        <div class="breakdown-value" style="color:${getValueColor(metric.status)}">${metric.value}<small style="font-size:12px;font-weight:400;opacity:0.6"> ${metric.unit}</small></div>
      `;
      list.appendChild(item);
    });
  }

  // AI Recommendations removed

  // ──────────────────────────────────────────
  // HEALTH SCORE RING
  // ──────────────────────────────────────────
  function animateScoreRing(score) {
    const ring = document.getElementById('ringProgress');
    const valueEl = document.getElementById('ringValue');
    if (!ring || !valueEl) return;

    const circumference = 326.73;
    const offset = circumference - (score / 100) * circumference;
    const duration = 1600;
    const start = performance.now();
    const startOffset = circumference;

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentOffset = startOffset - eased * (startOffset - offset);
      ring.style.strokeDashoffset = currentOffset;
      valueEl.textContent = Math.round(eased * score);
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        ring.style.strokeDashoffset = offset;
        valueEl.textContent = score;
      }
    }
    requestAnimationFrame(update);
  }

  function clearCanvas(canvasId) {
    // Canvas rendering removed as it is replaced by Chart.js 
  }

  // ──────────────────────────────────────────
  // RENDER: CURRENT METRICS CHARTS (always visible)
  // ──────────────────────────────────────────
  let currentChartInstances = [];

  function renderCurrentCharts(metrics) {
    const container = document.getElementById('currentChartsContainer');
    if (!container) return;

    // Destroy old chart instances
    currentChartInstances.forEach(c => c.destroy());
    currentChartInstances = [];
    container.innerHTML = '';

    const validMetrics = metrics.filter(m => m.value !== 'N/A');
    if (validMetrics.length === 0) return;

    // ── 1. BAR CHART — metric values comparison ──
    const barWrap = document.createElement('div');
    barWrap.className = 'chart-card-wrap';
    barWrap.innerHTML = '<h3 class="chart-card-title">📊 Metrics Comparison</h3>';
    const barCanvasWrap = document.createElement('div');
    barCanvasWrap.style.height = '220px';
    barCanvasWrap.style.position = 'relative';
    const barCanvas = document.createElement('canvas');
    barCanvasWrap.appendChild(barCanvas);
    barWrap.appendChild(barCanvasWrap);
    container.appendChild(barWrap);

    const barColors = validMetrics.map(m => {
      if (m.status === 'normal') return '#10b981';
      if (m.status === 'borderline') return '#f59e0b';
      return '#ef4444';
    });
    const barBgColors = validMetrics.map(m => {
      if (m.status === 'normal') return 'rgba(16,185,129,0.15)';
      if (m.status === 'borderline') return 'rgba(245,158,11,0.15)';
      return 'rgba(239,68,68,0.15)';
    });

    // Normalize values for bar chart (handle BP string)
    const barValues = validMetrics.map(m => {
      let v = m.value;
      if (typeof v === 'string' && v.includes('/')) v = parseFloat(v.split('/')[0]);
      return parseFloat(v) || 0;
    });

    currentChartInstances.push(new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels: validMetrics.map(m => m.name),
        datasets: [{
          label: 'Value',
          data: barValues,
          backgroundColor: barBgColors,
          borderColor: barColors,
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } },
          x: { grid: { display: false } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const m = validMetrics[ctx.dataIndex];
                return `${m.value} ${m.unit} (${m.status})`;
              }
            }
          }
        }
      }
    }));

    // ── 2. DOUGHNUT CHART — status distribution ──
    const doughnutWrap = document.createElement('div');
    doughnutWrap.className = 'chart-card-wrap';
    doughnutWrap.innerHTML = '<h3 class="chart-card-title">🎯 Status Distribution</h3>';
    const doughCanvasWrap = document.createElement('div');
    doughCanvasWrap.style.height = '220px';
    doughCanvasWrap.style.position = 'relative';
    const doughCanvas = document.createElement('canvas');
    doughCanvasWrap.appendChild(doughCanvas);
    doughnutWrap.appendChild(doughCanvasWrap);
    container.appendChild(doughnutWrap);

    const statusCounts = { normal: 0, borderline: 0, high: 0 };
    validMetrics.forEach(m => { statusCounts[m.status] = (statusCounts[m.status] || 0) + 1; });

    currentChartInstances.push(new Chart(doughCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Normal', 'Borderline', 'High'],
        datasets: [{
          data: [statusCounts.normal, statusCounts.borderline, statusCounts.high],
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { size: 12, family: "'DM Sans', sans-serif" } }
          }
        }
      }
    }));

    // ── 3. RADAR CHART — health profile shape ──
    const radarWrap = document.createElement('div');
    radarWrap.className = 'chart-card-wrap';
    radarWrap.innerHTML = '<h3 class="chart-card-title">🕸️ Health Profile</h3>';
    const radarCanvasWrap = document.createElement('div');
    radarCanvasWrap.style.height = '220px';
    radarCanvasWrap.style.position = 'relative';
    const radarCanvas = document.createElement('canvas');
    radarCanvasWrap.appendChild(radarCanvas);
    radarWrap.appendChild(radarCanvasWrap);
    container.appendChild(radarWrap);

    // Normalised scores 0-100: normal=95, borderline=60, high=30
    const radarScores = validMetrics.map(m => {
      if (m.status === 'normal') return 95;
      if (m.status === 'borderline') return 60;
      return 30;
    });

    currentChartInstances.push(new Chart(radarCanvas, {
      type: 'radar',
      data: {
        labels: validMetrics.map(m => m.name),
        datasets: [{
          label: 'Health Score',
          data: radarScores,
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124, 58, 237, 0.12)',
          borderWidth: 2,
          pointBackgroundColor: '#7c3aed',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: { stepSize: 25, display: false },
            grid: { color: 'rgba(0,0,0,0.06)' },
            angleLines: { color: 'rgba(0,0,0,0.06)' },
            pointLabels: { font: { size: 11, family: "'DM Sans', sans-serif" } }
          }
        },
        plugins: { legend: { display: false } }
      }
    }));

    // ── 4. Use chartData from SAMPLE_REPORT if available ──
    if (activeData && activeData.chartData) {
      const sparkColors = [
        { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6' },
        { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981' },
        { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b' },
        { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444' }
      ];
      let ci = 0;
      Object.keys(activeData.chartData).forEach(key => {
        const cd = activeData.chartData[key];
        const metricObj = validMetrics.find(m => m.id === key);
        const title = metricObj ? metricObj.name + ' Trend' : key + ' Trend';
        const col = sparkColors[ci % sparkColors.length];
        ci++;

        const sparkWrap = document.createElement('div');
        sparkWrap.className = 'chart-card-wrap';
        sparkWrap.innerHTML = `<h3 class="chart-card-title">📈 ${title}</h3>`;
        const sparkCanvasWrap = document.createElement('div');
        sparkCanvasWrap.style.height = '150px';
        sparkCanvasWrap.style.position = 'relative';
        const sparkCanvas = document.createElement('canvas');
        sparkCanvasWrap.appendChild(sparkCanvas);
        sparkWrap.appendChild(sparkCanvasWrap);
        container.appendChild(sparkWrap);

        currentChartInstances.push(new Chart(sparkCanvas, {
          type: 'line',
          data: {
            labels: cd.labels,
            datasets: [{
              label: title,
              data: cd.values,
              borderColor: col.border,
              backgroundColor: col.bg,
              borderWidth: 3,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: col.border,
              pointRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { grid: { color: 'rgba(0,0,0,0.04)' } }, x: { grid: { display: false } } }
          }
        }));
      });
    }
  }

  // ──────────────────────────────────────────
  // HISTORY CHART FETCH & RENDER
  // ──────────────────────────────────────────
  async function loadHistory() {
    if (!currentUser || !currentUser.id) {
      console.log("No user logged in, skipping history fetch.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/history/${currentUser.id}`);
      const result = await res.json();
      if (result.success && result.history && result.history.length > 0) {
        document.getElementById('historyLogSection').style.display = 'block';
        drawHistoryChart(result.history);
        renderHistoryLog(result.history);
      }
    } catch (err) { 
      console.error("History fetch error", err); 
    }
  }

  function drawHistoryChart(historyList) {
    const container = document.getElementById('chartsContainer');
    if (!container) return;

    // Use global chartInstances for cleanup
    chartInstances.forEach(c => c.destroy());
    chartInstances = [];
    container.innerHTML = '';

    const dbSec = document.getElementById('chartsSection');
    if (dbSec) dbSec.style.display = 'block';

    const labels = historyList.map((h, i) => h.reportDate || `Report ${i+1}`);
    const healthScores = historyList.map(h => h.healthScore || 0);

    const metricsData = {};
    historyList.forEach((h, hIdx) => {
       if(h.metrics && Array.isArray(h.metrics)) {
         h.metrics.forEach(m => {
           if(m.value && m.value !== 'N/A') {
             if(!metricsData[m.name]) metricsData[m.name] = new Array(historyList.length).fill(null);
             let val = m.value;
             if(typeof val === 'string' && val.includes('/')) {
                 val = parseFloat(val.split('/')[0]); // Use systolic reading
             } else {
                 val = parseFloat(val);
             }
             if(!isNaN(val)) metricsData[m.name][hIdx] = val;
           }
         });
       }
    });

    const createChart = (title, data, colorBg, colorBorder) => {
        const wrap = document.createElement('div');
        // Add class just in case styles are needed
        wrap.className = 'chart-card-wrap';
        wrap.style.background = 'var(--card-bg, var(--white))';
        wrap.style.borderRadius = '20px';
        wrap.style.padding = '20px';
        wrap.style.boxShadow = '0 4px 15px rgba(0,0,0,0.05)';
        wrap.style.border = '1px solid var(--border)';

        const h3 = document.createElement('h3');
        h3.textContent = title;
        h3.style.margin = '0 0 15px 0';
        h3.style.fontSize = '16px';
        wrap.appendChild(h3);

        const canvasWrap = document.createElement('div');
        canvasWrap.style.height = '180px';
        canvasWrap.style.position = 'relative';

        const canvas = document.createElement('canvas');
        canvasWrap.appendChild(canvas);
        wrap.appendChild(canvasWrap);
        container.appendChild(wrap);

        const instance = new Chart(canvas, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: title,
              data: data,
              borderColor: colorBorder,
              backgroundColor: colorBg,
              borderWidth: 3,
              fill: true,
              tension: 0.4,
              spanGaps: true,
              pointBackgroundColor: colorBorder,
              pointBorderWidth: 2,
              pointRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { 
                beginAtZero: title === 'Health Score Trend',
                grid: { color: 'rgba(0,0,0,0.04)' }
              },
              x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
          }
        });
        chartInstances.push(instance);
    };

    // Comparison Chart: Health Score Trend
    createChart('Health Score Trend', healthScores, 'rgba(124, 58, 237, 0.15)', '#7c3aed');

    const colors = [
      { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6' },
      { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981' },
      { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b' },
      { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444' }
    ];

    let colorIdx = 0;
    Object.keys(metricsData).forEach(key => {
       if(metricsData[key].some(v => v !== null)) {
           const col = colors[colorIdx % colors.length];
           colorIdx++;
           createChart(key + ' Trend', metricsData[key], col.bg, col.border);
       }
    });
  }

  function renderHistoryLog(historyList) {
    const listContainer = document.getElementById('historyLogList');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    
    // Reverse copy so most recent is first
    const sorted = [...historyList].reverse();
    sorted.forEach((h, i) => {
       const div = document.createElement('div');
       div.style.padding = '12px';
       div.style.borderBottom = '1px solid var(--border)';
       div.style.display = 'flex';
       div.style.justifyContent = 'space-between';
       div.style.alignItems = 'center';
       
       div.innerHTML = `
         <div>
           <strong>${h.reportDate || 'Past Report'}</strong>
           <div style="font-size:12px;color:var(--text-muted)">Health Score: ${h.healthScore}</div>
         </div>
         <button class="btn-secondary" style="padding:4px 8px;font-size:12px;cursor:pointer;" onclick="loadPastReport(${i})">View Details</button>
       `;
       listContainer.appendChild(div);
    });
    
    window.__msPastHistory = sorted;
  }

  window.loadPastReport = function(idx) {
      if (window.__msPastHistory && window.__msPastHistory[idx]) {
          const past = window.__msPastHistory[idx];
          const pastData = {
              patientName: currentUser ? currentUser.name : "Patient",
              reportDate: past.reportDate,
              healthScore: past.healthScore,
              aiExplanation: past.aiExplanation || "Reviewing this past report based on historical data.",
              metrics: past.metrics,
              recommendations: [] 
          };
          renderAll(pastData);
          const found = (past.metrics || []).filter(m => m.value !== 'N/A').length;
          showModeBadge('demo', found);
          const subText = document.getElementById('headerSubText');
          if (subText) subText.textContent = `Viewing historic lab results from ${past.reportDate}`;
          window.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

  // ──────────────────────────────────────────
  // PDF REPORT DOWNLOAD
  // ──────────────────────────────────────────
  window.downloadPDF = function() {
    const element = document.body;
    
    const opt = {
      margin:       [0.5, 0.5, 0.5, 0.5],
      filename:     `${currentUser ? currentUser.name.replace(/\s+/g, '_') : 'Patient'}_Medical_Report.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false, windowWidth: 1000 },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // Hide interactive UI before print
    const strip = document.getElementById('uploadStrip');
    const chatbot = document.getElementById('chatbotWidget');
    const chatbotTrig = document.getElementById('chatbotTrigger');
    const nav = document.querySelector('.db-nav');
    const actionBtns = document.querySelector('.db-actions');
    const btns = document.querySelectorAll('.btn-back, .btn-print, .btn-secondary, button');
    
    if(strip) strip.style.display = 'none';
    if(chatbot) chatbot.style.display = 'none';
    if(chatbotTrig) chatbotTrig.style.display = 'none';
    if(nav) nav.style.display = 'none';
    if(actionBtns) actionBtns.style.display = 'none';
    btns.forEach(b => b.style.display = 'none');

    element.classList.add('pdf-exporting');
    const prevWidth = element.style.width;
    element.style.width = '1000px';

    html2pdf().set(opt).from(element).save().then(() => {
      // Restore UI
      if(strip) strip.style.display = '';
      if(chatbot) chatbot.style.display = '';
      if(chatbotTrig) chatbotTrig.style.display = '';
      if(nav) nav.style.display = '';
      if(actionBtns) actionBtns.style.display = '';
      btns.forEach(b => b.style.display = '');
      element.style.width = prevWidth;
      element.classList.remove('pdf-exporting');
    });
  };

  // ──────────────────────────────────────────
  // AI & REMEDIATION PIPELINE
  // ──────────────────────────────────────────
  function renderAIExplanation(text) {
    const sec = document.getElementById('aiAndActionSection');
    const typeWrap = document.getElementById('aiTyping');
    if (!sec || !typeWrap) return;
    
    sec.style.display = 'block';
    typeWrap.textContent = '';
    
    let i = 0;
    const speed = 7;
    const interval = setInterval(() => {
      typeWrap.textContent += text[i] || '';
      i++;
      if (i >= text.length) clearInterval(interval);
    }, speed);
  }

  function renderRemediationPanel(metrics) {
    const textEl = document.getElementById('remediationText');
    const btn = document.getElementById('remediationBtn');
    const display = document.getElementById('mealPlanDisplay');
    if (!textEl || !btn) return;

    const abnormal = metrics.filter(m => m.status === 'high' || m.status === 'low' || m.status === 'borderline');
    
    if (abnormal.length > 0) {
      const issues = abnormal.map(m => m.name).join(', ');
      textEl.innerHTML = `Based on your out-of-range metrics (<strong>${issues}</strong>), we've generated a 7-day personalized meal plan to help normalize these values.`;
      
      if (display) {
         display.style.display = 'block';
         display.innerHTML = '<i>🩺 Generative AI is building your tailored 7-day meal plan...</i>';
         const prompt = `Based on these out-of-range lab results: ${issues}, generate a helpful, short 7-day meal plan highlighting foods that fix these specific issues. Use standard emojis. Keep it under 150 words.`;
         
         fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               question: prompt,
               context: abnormal
            })
         })
         .then(res => res.json())
         .then(data => {
             if (data.success && data.answer) {
                 display.textContent = data.answer;
             } else {
                 display.innerHTML = '<i>Failed to generate meal plan. Please check backend connection.</i>';
             }
         })
         .catch(err => {
             display.innerHTML = '<i>Error fetching AI Meal Plan via HuggingFace: ' + err.message + '</i>';
         });
      }

      btn.onclick = () => {
        const n = document.createElement('div');
        n.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0a0a0a;color:white;padding:12px 24px;border-radius:10px;font-size:14px;z-index:9999;font-family:'DM Sans',sans-serif;box-shadow:0 4px 24px rgba(0,0,0,0.3);";
        n.textContent = 'Generative AI is building your tailored Swiggy Instamart basket...';
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
        
        setTimeout(() => {
          window.open('https://www.swiggy.com/instamart', '_blank');
        }, 1500);
      };
    } else {
      textEl.textContent = "Your metrics are perfectly normal! Click below to order a healthy maintenance grocery list.";
      if (display) display.style.display = 'none';
      btn.onclick = () => window.open('https://www.swiggy.com/instamart', '_blank');
    }
  }

  // ──────────────────────────────────────────
  // RENDER ALL
  // ──────────────────────────────────────────
  function renderAll(data) {
    activeData = data;
    renderMetricsGrid(data.metrics);
    renderBreakdown(data.metrics);
    
    if (data.aiExplanation) {
      renderAIExplanation(data.aiExplanation);
    }
    if (data.metrics) {
      renderRemediationPanel(data.metrics);
    }

    setTimeout(() => {
      animateScoreRing(data.healthScore);
      renderCurrentCharts(data.metrics);
    }, 200);
  }

  // ──────────────────────────────────────────
  // PDF UPLOAD HANDLER
  // ──────────────────────────────────────────
  function initUpload() {
    const input     = document.getElementById('pdfUploadInput');
    const label     = document.getElementById('uploadLabel');
    const nameEl    = document.getElementById('uploadFilename');
    const spinner   = document.getElementById('uploadProcessing');
    const statusEl  = document.getElementById('uploadStatus');

    if (!input) return;

    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;

      // Show filename
      nameEl.textContent = file.name;

      // UI → processing
      label.classList.add('uploading');
      spinner.classList.remove('hidden');
      statusEl.classList.add('hidden');

      try {
        const formData = new FormData();
        formData.append('file', file);
        if (currentUser && currentUser.id) {
          formData.append('user_id', currentUser.id);
        }

        const res = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          body: formData
        });

        const json = await res.json();

        spinner.classList.add('hidden');
        label.classList.remove('uploading');

        if (json.success && json.data) {
          currentMode = json.mode || 'live';

          // Show status
          if (currentMode === 'live') {
            const found = json.data.foundCount || json.data.metrics.filter(m => m.value !== 'N/A').length;
            showStatus(statusEl, 'success', `✓ Extracted ${found}/6 metrics from "${file.name}" using NER`);
          } else {
            showStatus(statusEl, 'info', `⚠ ${json.message || 'Showing demo data — NER could not extract metrics.'}`);
          }

          // Re-render dashboard with new data
          renderAll(json.data);

          // Fetch updated history
          loadHistory();
        } else {
          showStatus(statusEl, 'error', `✗ ${json.error || 'Upload failed.'}`);
        }

      } catch (err) {
        spinner.classList.add('hidden');
        label.classList.remove('uploading');
        showStatus(statusEl, 'error', `✗ Network error — is the backend running? (${err.message})`);
      }

      // Reset input so the same file can be re-uploaded
      input.value = '';
    });
  }

  function showStatus(el, type, msg) {
    if (!el) return;
    el.className = `upload-status ${type}`;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  // ──────────────────────────────────────────
  // UTILS
  // ──────────────────────────────────────────
  function getValueColor(status) {
    if (status === 'normal') return '#10b981';
    if (status === 'borderline') return '#f59e0b';
    if (status === 'high') return '#ef4444';
    return '#0a0a0a';
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ──────────────────────────────────────────
  // MODE BADGE
  // ──────────────────────────────────────────
  function showModeBadge(mode, foundCount) {
    const strip = document.getElementById('uploadStrip');
    if (!strip) return;
    const existing = document.getElementById('modeBadge');
    if (existing) existing.remove();

    if (mode === 'live') {
      const badge = document.createElement('div');
      badge.id = 'modeBadge';
      badge.style.cssText = `
        margin-top:10px;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;
        font-family:'DM Sans',sans-serif;display:inline-block;
        background:#dcfce7;
        color:#166534;
        border:1px solid #bbf7d0;
      `;
      badge.textContent = `✅ Live data loaded — ${foundCount || '?'}/6 metrics extracted from your PDF`;
      strip.appendChild(badge);
    }
  }

  // ──────────────────────────────────────────
  // INIT
  // ──────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {

    checkSession();

    // Check if data was passed from the landing page
    const incoming = getInitialData();

    if (incoming && incoming.data) {
      currentMode = incoming.mode;
      renderAll(incoming.data);
      const found = incoming.data.foundCount
        || (incoming.data.metrics || []).filter(m => m.value !== 'N/A').length;
      showModeBadge(incoming.mode, found);
    } else {
      // Default render with sample data
      renderAll(SAMPLE_REPORT);
      showModeBadge('demo', 0);
    }

    // Wire up PDF upload strip on dashboard itself
    initUpload();

    // Load user history if logged in
    loadHistory();

    // Wire up history toggle button
    const historyToggleBtn = document.getElementById('historyToggleBtn');
    const historyPanel = document.getElementById('historyPanel');
    if (historyToggleBtn && historyPanel) {
      historyToggleBtn.addEventListener('click', () => {
        const isCollapsed = historyPanel.classList.contains('collapsed');
        if (isCollapsed) {
          historyPanel.classList.remove('collapsed');
          historyToggleBtn.textContent = '▲ Hide Records';
        } else {
          historyPanel.classList.add('collapsed');
          historyToggleBtn.textContent = '▼ Show Records';
        }
      });
    }

    // Wire up profile click area to toggle history
    const profileBtn = document.getElementById('profileClickArea');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        const historySec = document.getElementById('historyLogSection');
        if (historySec) {
          historySec.style.display = 'block';
          historySec.scrollIntoView({ behavior: 'smooth' });
          if (historyPanel && historyPanel.classList.contains('collapsed')) {
             historyToggleBtn.click();
          }
        }
      });
    }
  });

  // Redraw current charts on resize
  window.addEventListener('resize', () => {
    if (activeData && activeData.metrics) {
      setTimeout(() => renderCurrentCharts(activeData.metrics), 150);
    }
  });

  // ──────────────────────────────────────────
  // AI CHATBOT LOGIC
  // ──────────────────────────────────────────
  const chatTrigger = document.getElementById('chatbotTrigger');
  const chatWidget = document.getElementById('chatbotWidget');
  const chatClose = document.getElementById('chatbotClose');
  const chatBody = document.getElementById('chatbotBody');
  const chatInput = document.getElementById('chatbotInput');
  const chatSend = document.getElementById('chatbotSend');

  if (chatTrigger && chatWidget) {
    chatTrigger.addEventListener('click', () => {
      chatWidget.classList.add('active');
      chatInput.focus();
    });

    chatClose.addEventListener('click', () => {
      chatWidget.classList.remove('active');
    });

    const addMessage = (text, sender) => {
      const div = document.createElement('div');
      div.className = `chatbot-message ${sender}`;
      div.textContent = text;
      chatBody.appendChild(div);
      chatBody.scrollTop = chatBody.scrollHeight;
    };

    const handleSend = async () => {
      const question = chatInput.value.trim();
      if (!question) return;

      addMessage(question, 'user');
      chatInput.value = '';
      chatInput.disabled = true;
      chatSend.disabled = true;

      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'chatbot-message bot';
      loadingDiv.textContent = 'Thinking...';
      chatBody.appendChild(loadingDiv);
      chatBody.scrollTop = chatBody.scrollHeight;

      try {
        const payload = {
          question: question,
          context: activeData ? activeData.metrics : []
        };
        if (currentUser && currentUser.id) {
          payload.user_id = currentUser.id;
        }

        const res = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const json = await res.json();
        
        chatBody.removeChild(loadingDiv);
        
        if (json.success && json.answer) {
          addMessage(json.answer, 'bot');
        } else {
          addMessage(`Error: ${json.message || 'Failed to get answer.'}`, 'error');
        }
      } catch (err) {
        if (chatBody.contains(loadingDiv)) chatBody.removeChild(loadingDiv);
        addMessage('Network error. Please make sure the backend is running.', 'error');
      }

      chatInput.disabled = false;
      chatSend.disabled = false;
      chatInput.focus();
    };

    chatSend.addEventListener('click', handleSend);
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSend();
    });
  }

})();
