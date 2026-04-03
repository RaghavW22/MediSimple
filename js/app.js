// js/app.js
// MediSimple — Landing Page Logic
// Uploads PDF to Flask backend → stores result → redirects to dashboard.html

(function () {
  const API_BASE = 'http://localhost:5000';

  const uploadZone    = document.getElementById('uploadZone');
  const fileInput     = document.getElementById('fileInput');
  const demoBtn       = document.getElementById('demoBtn');
  const loaderOverlay = document.getElementById('loaderOverlay');
  const resultsSection = document.getElementById('resultsSection');
  const metricsGrid   = document.getElementById('metricsGrid');
  const aiTyping      = document.getElementById('aiTyping');
  const voiceBtn      = document.getElementById('voiceBtn');
  const scoreBar      = document.getElementById('scoreBar');
  const scoreValue    = document.getElementById('scoreValue');
  const scoreDesc     = document.getElementById('scoreDesc');
  const downloadBtn   = document.getElementById('downloadBtn');

  let activeReport = null;  // holds the data returned by the backend

  // ── DRAG & DROP ─────────────────────────────────────────────────────────
  uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
  });

  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.pdf')) {
      handlePdfUpload(file);
    } else {
      showNotice('Please upload a PDF file.');
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handlePdfUpload(fileInput.files[0]);
  });

  // ── DEMO BUTTON ──────────────────────────────────────────────────────────
  demoBtn.addEventListener('click', async () => {
    showLoader('Loading demo report…');

    try {
      const res  = await fetch(`${API_BASE}/upload-demo`, { method: 'POST' });
      const json = await res.json();
      if (json.success && json.data) {
        finishAndShow(json.data);
      } else {
        // Fallback to SAMPLE_REPORT if API is down
        finishAndShow(SAMPLE_REPORT);
      }
    } catch {
      // Backend offline → use bundled sample
      finishAndShow(SAMPLE_REPORT);
    }
  });

  // ── MAIN UPLOAD HANDLER ──────────────────────────────────────────────────
  async function handlePdfUpload(file) {
    showLoader(`Analysing "${file.name}"…`);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res  = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
      const json = await res.json();

      if (json.success && json.data) {
        finishAndShow(json.data, json.mode, json.message);
      } else {
        hideLoader();
        showNotice(json.error || 'Upload failed. Check the backend console.');
      }
    } catch (err) {
      hideLoader();
      showNotice(`Network error — is the backend running? (${err.message})`);
    }

    fileInput.value = '';
  }

  // ── AFTER SUCCESS ────────────────────────────────────────────────────────
  function finishAndShow(data, mode, message) {
    activeReport = data;

    // Persist data so dashboard.html can read it
    try {
      sessionStorage.setItem('medisimple_report', JSON.stringify(data));
      sessionStorage.setItem('medisimple_mode',   mode || 'demo');
    } catch (e) { /* storage may be blocked */ }

    hideLoader();
    showResults(data, message);
  }

  // ── LOADER ───────────────────────────────────────────────────────────────
  function showLoader(hint) {
    document.querySelector('.loader-text').textContent = hint || 'Analyzing your report using AI…';
    loaderOverlay.classList.add('active');
    document.getElementById('step1').className = 'step active';
    document.getElementById('step2').className = 'step';
    document.getElementById('step3').className = 'step';
    setTimeout(() => activateStep('step2'), 900);
    setTimeout(() => activateStep('step3'), 1900);
  }

  function activateStep(id) {
    const prev = document.querySelector('.step.active');
    if (prev) { prev.classList.remove('active'); prev.classList.add('done'); }
    const step = document.getElementById(id);
    if (step) step.classList.add('active');
  }

  function hideLoader() {
    loaderOverlay.classList.remove('active');
  }

  // ── RENDER RESULTS ───────────────────────────────────────────────────────
  function showResults(data, message) {
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    renderMetrics(data.metrics);
    typewriterEffect(aiTyping, data.aiExplanation, 7);
    animateScore(data.healthScore);

    if (message) showNotice(message, 4000);
  }

  // ── RENDER METRICS GRID ──────────────────────────────────────────────────
  function renderMetrics(metrics) {
    metricsGrid.innerHTML = '';
    metrics.forEach((metric, i) => {
      const trendSymbol = metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→';
      const trendClass  = metric.trend === 'up' ? 'up' : metric.trend === 'down' ? 'down' : 'stable';
      const tooltip     = getTooltip(metric.id);
      const isNA        = metric.value === 'N/A';

      const card = document.createElement('div');
      card.className = `metric-card ${isNA ? 'na' : metric.status}`;
      card.style.animationDelay = `${i * 0.07}s`;
      card.innerHTML = `
        <div class="metric-tooltip">${tooltip}</div>
        <div class="metric-top">
          <span class="metric-name">${metric.icon} ${metric.name}</span>
          <span class="metric-trend ${isNA ? '' : trendClass}">${isNA ? '–' : trendSymbol}</span>
        </div>
        <div class="metric-value">${metric.value}</div>
        <div class="metric-unit">${metric.unit} · Normal: ${metric.range}</div>
        <span class="metric-status ${isNA ? 'na' : metric.status}">${isNA ? 'Not Found' : capitalize(metric.status)}</span>
      `;
      metricsGrid.appendChild(card);
    });
  }

  // ── TYPEWRITER ────────────────────────────────────────────────────────────
  function typewriterEffect(el, text, speed = 8) {
    el.textContent = '';
    let i = 0;
    const interval = setInterval(() => {
      el.textContent += text[i] || '';
      i++;
      if (i >= text.length) clearInterval(interval);
    }, speed);
  }

  // ── HEALTH SCORE ──────────────────────────────────────────────────────────
  function animateScore(score) {
    scoreBar.style.width = '0%';
    scoreValue.textContent = '0';
    const duration = 1500;
    const start = performance.now();

    function update(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      const current  = Math.round(eased * score);
      scoreBar.style.width = `${eased * score}%`;
      scoreValue.textContent = current;
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        scoreBar.style.width = `${score}%`;
        scoreValue.textContent = score;
        setScoreDescription(score);
      }
    }
    requestAnimationFrame(update);
  }

  function setScoreDescription(score) {
    if (score >= 80)      scoreDesc.textContent = '🟢 Excellent — Your health is in great shape!';
    else if (score >= 60) scoreDesc.textContent = '🟡 Good — A few areas to watch. Minor lifestyle changes recommended.';
    else                  scoreDesc.textContent = '🔴 Needs Attention — Please consult your doctor for follow-up.';
  }

  // ── VOICE SYNTHESIS ──────────────────────────────────────────────────────
  let speaking = false;

  voiceBtn.addEventListener('click', () => {
    if (!window.speechSynthesis) { alert('Voice not supported in this browser.'); return; }

    if (speaking) {
      window.speechSynthesis.cancel();
      speaking = false;
      voiceBtn.textContent = '🔊 Listen';
      voiceBtn.classList.remove('speaking');
      return;
    }

    const text = (activeReport ? activeReport.aiExplanation : SAMPLE_REPORT.aiExplanation)
      .replace(/[🔴🟡✅📋ℹ️]/g, '');
    const utterance  = new SpeechSynthesisUtterance(text);
    utterance.rate   = 0.9;
    utterance.pitch  = 1.0;
    utterance.onend  = () => {
      speaking = false;
      voiceBtn.textContent = '🔊 Listen';
      voiceBtn.classList.remove('speaking');
    };

    speaking = true;
    voiceBtn.textContent = '⏹ Stop';
    voiceBtn.classList.add('speaking');
    window.speechSynthesis.speak(utterance);
  });

  // ── FAQ ACCORDION LOGIC ───────────────────────────────────────────────────
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question');
    btn.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      
      // Close all others
      faqItems.forEach(otherItem => {
        otherItem.classList.remove('active');
        const answer = otherItem.querySelector('.faq-answer');
        answer.style.maxHeight = null;
      });

      // Toggle current
      if (!isActive) {
        item.classList.add('active');
        const answer = item.querySelector('.faq-answer');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  // ── UTILS ─────────────────────────────────────────────────────────────────
  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  function showNotice(msg, duration = 3000) {
    const n = document.createElement('div');
    n.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:#0a0a0a;color:white;padding:12px 24px;border-radius:10px;
      font-size:14px;z-index:9999;font-family:'DM Sans',sans-serif;
      box-shadow:0 4px 24px rgba(0,0,0,0.3);max-width:90vw;text-align:center;
    `;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), duration);
  }

})();
