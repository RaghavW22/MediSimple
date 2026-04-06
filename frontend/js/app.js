// js/app.js
// Logic for the landing page (index.html)
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  const uploadZone = document.getElementById('uploadZone');
  const demoBtn = document.getElementById('demoBtn');
  function resolveApiBase() {
    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    const isPrivateIp = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
    if (isLocalHost || isPrivateIp) return 'http://localhost:5000';
    return '';
  }
  const API_BASE = resolveApiBase();

  // UI Elements
  const loaderOverlay = document.getElementById('loaderOverlay');
  const resultsSection = document.getElementById('resultsSection');
  const metricsGrid = document.getElementById('metricsGrid');
  const scoreValue = document.getElementById('scoreValue');
  const scoreBar = document.getElementById('scoreBar');
  const aiTyping = document.getElementById('aiTyping');

  // ── DEMO BUTTON ──
  if (demoBtn) {
    demoBtn.addEventListener('click', async () => {
      showLoader();
      try {
        const res = await fetch(`${API_BASE}/upload-demo`, { method: 'POST' });
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          await res.text();
          throw new Error(`Server returned non-JSON response from ${API_BASE || window.location.origin}.`);
        }
        const json = await res.json();
        if (json.success) {
          sessionStorage.setItem('medisimple_report', JSON.stringify(json.data));
          sessionStorage.setItem('medisimple_mode', 'demo');
          // the old app.js used to populate results on index.html or redirect to dashboard
          // Based on user request, the landing page shows results directly OR redirects.
          // Wait, the index.html has a resultsSection, so I should render it here!
          renderResults(json.data);
        }
      } catch (e) {
        console.error(e);
        // Fallback to local
        if (typeof SAMPLE_REPORT !== 'undefined') {
          renderResults(SAMPLE_REPORT);
        }
      }
    });
  }

  // ── FILE UPLOAD ──
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleUpload(e.target.files[0]);
      }
    });
  }

  if (uploadZone) {
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.style.borderColor = 'var(--purple)';
      uploadZone.style.background = 'rgba(124, 58, 237, 0.05)';
    });
    uploadZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      uploadZone.style.borderColor = 'var(--border)';
      uploadZone.style.background = 'var(--surface)';
    });
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.style.borderColor = 'var(--border)';
      uploadZone.style.background = 'var(--surface)';
      if (e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files[0]);
      }
    });
  }

  async function handleUpload(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      alert("Please upload a PDF file.");
      return;
    }
    showLoader();

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        await res.text();
        throw new Error(`Server returned non-JSON response from ${API_BASE || window.location.origin}.`);
      }
      const json = await res.json();

      if (!res.ok) {
        alert('Upload failed: ' + (json.error || json.message || `HTTP ${res.status}`));
        hideLoader();
        return;
      }

      if (json.success && json.data) {
        renderResults(json.data);
      } else {
        alert('Upload failed: ' + (json.error || 'Unknown error'));
        hideLoader();
      }
    } catch (err) {
      console.error(err);
      alert('Network error - backend might not be running.');
      hideLoader();
    }
  }

  function showLoader() {
    if (loaderOverlay) loaderOverlay.classList.add('show');
    // Simulate steps
    setTimeout(() => setStep(2), 1000);
    setTimeout(() => setStep(3), 2000);
  }

  function hideLoader() {
    if (loaderOverlay) loaderOverlay.classList.remove('show');
  }

  function setStep(num) {
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    if (num === 2 && step2) step2.classList.add('active');
    if (num === 3 && step3) step3.classList.add('active');
  }

  function renderResults(data) {
    setTimeout(() => hideLoader(), 500);
    if (resultsSection) resultsSection.classList.remove('hidden');

    // Scroll to results
    setTimeout(() => {
      resultsSection.scrollIntoView({ behavior: 'smooth' });
    }, 600);

    // Render AI explanation
    if (aiTyping && data.aiExplanation) {
      aiTyping.textContent = '';
      let i = 0;
      const text = data.aiExplanation;
      const interval = setInterval(() => {
        aiTyping.textContent += text[i] || '';
        i++;
        if (i >= text.length) clearInterval(interval);
      }, 10);
    }

    // Render metrics
    if (metricsGrid && data.metrics) {
      metricsGrid.innerHTML = '';
      data.metrics.forEach((m, idx) => {
        const div = document.createElement('div');

        let statusClass = 'normal';
        if (m.status === 'borderline' || m.status === 'warning') statusClass = 'borderline';
        if (m.status === 'high' || m.status === 'low' || m.status === 'danger') statusClass = 'high';

        div.className = `metric-card ${statusClass}`;
        div.style.animationDelay = `${idx * 0.1}s`;
        div.innerHTML = `
            <div class="metric-top">
              <span class="metric-name">${m.icon || '📊'} ${m.name}</span>
              <span class="metric-status ${statusClass}">${m.status || 'Unknown'}</span>
            </div>
            <div class="metric-value">${m.value}</div>
            <div class="metric-unit">${m.unit}</div>
            <div class="metric-desc">${m.description || m.range || ''}</div>
          `;
        metricsGrid.appendChild(div);
      });
    }

    // Render score
    if (scoreValue && scoreBar) {
      const score = data.healthScore || 0;
      const currentScore = parseInt(scoreValue.textContent) || 0;

      // animate score
      let current = 0;
      const sInt = setInterval(() => {
        current += 2;
        if (current >= score) {
          current = score;
          clearInterval(sInt);
        }
        scoreValue.textContent = current;
      }, 20);

      setTimeout(() => {
        scoreBar.style.width = score + '%';
        if (score > 80) scoreBar.style.background = '#10b981';
        else if (score > 60) scoreBar.style.background = '#f59e0b';
        else scoreBar.style.background = '#ef4444';

        const desc = document.getElementById('scoreDesc');
        if (desc) {
          if (score > 80) desc.textContent = "Excellent health profile based on recent labs.";
          else if (score > 60) desc.textContent = "Good health with a few areas that need attention.";
          else desc.textContent = "Several metrics require attention. Consult a doctor.";
        }
      }, 200);
    }

    // Remediation 
    const remPanel = document.getElementById('remediationPanel');
    if (remPanel && data.metrics) {
      const abnormal = data.metrics.filter(m => m.status === 'high' || m.status === 'low' || m.status === 'borderline');
      const textEl = document.getElementById('remediationText');
      const display = document.getElementById('mealPlanDisplay');
      const remBtn = document.getElementById('remediationBtn');

      if (abnormal.length > 0) {
        const issues = abnormal.map(m => m.name).join(', ');
        if (textEl) textEl.innerHTML = `Based on your out-of-range metrics (<strong>${issues}</strong>), we've generated a 7-day personalized meal plan to help normalize these values.`;

        if (display) {
          display.style.display = 'block';
          display.innerHTML = '<i>🩺 Generative AI is building your tailored 7-day meal plan...</i>';

          fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: `Based on these out-of-range lab results: ${issues}, generate a helpful, short 7-day meal plan highlighting foods that fix these specific issues. Use standard emojis. Keep it under 150 words.`,
              context: abnormal
            })
          })
            .then(res => res.json())
            .then(chatData => {
              if (chatData.success && chatData.answer) display.textContent = chatData.answer;
              else display.innerHTML = '<i>Failed to generate meal plan.</i>';
            })
            .catch(() => {
              display.innerHTML = '<i>Error fetching AI Meal Plan via backend.</i>';
            });
        }
        if (remBtn) {
          remBtn.onclick = () => window.open('https://www.swiggy.com/instamart', '_blank');
        }
      } else {
        if (textEl) textEl.textContent = "Your metrics are perfectly normal! Click below to order a healthy maintenance grocery list.";
        if (display) display.style.display = 'none';
        if (remBtn) remBtn.onclick = () => window.open('https://www.swiggy.com/instamart', '_blank');
      }
    }
  }

  // ── FAQ ACCORDION ──
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close all FAQ items first (accordion behavior)
      faqItems.forEach(other => {
        other.classList.remove('active');
        const ans = other.querySelector('.faq-answer');
        if (ans) ans.style.maxHeight = null;
      });

      // Toggle the clicked one
      if (!isActive) {
        item.classList.add('active');
        const answer = item.querySelector('.faq-answer');
        if (answer) {
          answer.style.maxHeight = answer.scrollHeight + 'px';
        }
      }
    });
  });
});  
