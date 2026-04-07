/**
 * js/bio-quests.js
 * Gamification module for MediSimple.
 * Includes the Interactive Health Avatar and Bio-Quests system.
 */

(function () {
  const QUESTS_STORAGE_KEY = "ms_vitality_points";
  const AVATAR_CONTAINER_ID = "ms-interactive-avatar";
  const QUEST_PANEL_ID = "ms-bio-quests-panel";

  // Quest configurations
  const QUEST_TEMPLATES = [
    {
      id: "sugar_dragon",
      title: "Defeat the Sugar Dragon",
      metric: "sugar",
      condition: (val) => val > 125 || val === "high",
      description: "Your glucose levels are high. Track 7 days of low-carb meals to slay the dragon.",
      reward: 500
    },
    {
      id: "bp_zen",
      title: "The Heart Zen Master",
      metric: "bp",
      condition: (val) => {
        if (typeof val === 'string' && val.includes('/')) {
           return parseInt(val.split('/')[0]) > 130;
        }
        return false;
      },
      description: "Blood pressure is elevated. Complete 10 minutes of meditation daily to reach Zen.",
      reward: 300
    },
    {
      id: "liver_guardian",
      title: "Luminous Liver Guardian",
      metric: "alt",
      condition: (val) => val > 56,
      description: "Liver enzymes are elevated. Drink 3L of water daily and avoid processed oils.",
      reward: 400
    }
  ];

  /**
   * Initialize point system
   */
  function getPoints() {
    return parseInt(localStorage.getItem(QUESTS_STORAGE_KEY)) || 0;
  }

  function addPoints(pts) {
    const newTotal = getPoints() + pts;
    localStorage.setItem(QUESTS_STORAGE_KEY, newTotal);
    updateAvatarVisuals();
    updateQuestPanel();
  }

  /**
   * Injects the CSS for the module
   */
  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #${AVATAR_CONTAINER_ID} {
        position: relative;
        width: 120px;
        height: 180px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.5s ease;
      }
      .avatar-svg {
        width: 100%;
        height: 100%;
        filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.3));
        transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .avatar-state-tired {
        fill: #94a3b8;
        opacity: 0.6;
        transform: scale(0.95) translateY(5px);
      }
      .avatar-state-normal {
        fill: url(#avatarGradNormal);
        opacity: 0.9;
        transform: scale(1);
      }
      .avatar-state-glowing {
        fill: url(#avatarGradGlowing);
        opacity: 1;
        transform: scale(1.05);
        filter: drop-shadow(0 0 20px rgba(139, 92, 246, 0.8));
      }
      .aura-effect {
        position: absolute;
        inset: -20px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%);
        opacity: 0;
        transition: opacity 1s ease;
        pointer-events: none;
      }
      .glowing .aura-effect {
        opacity: 1;
        animation: pulseAura 3s infinite;
      }
      @keyframes pulseAura {
        0%, 100% { transform: scale(1); opacity: 0.2; }
        50% { transform: scale(1.2); opacity: 0.4; }
      }

      #${QUEST_PANEL_ID} {
        background: var(--card-bg, #fff);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 20px;
        padding: 24px;
        margin-top: 24px;
        box-shadow: var(--shadow-md, 0 4px 15px rgba(0,0,0,0.05));
      }
      .quest-card {
        background: var(--off-white, #f8fafc);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 14px;
        padding: 16px;
        margin-top: 12px;
        display: flex;
        align-items: center;
        gap: 16px;
        animation: slideInQuest 0.5s ease both;
      }
      @keyframes slideInQuest { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
      .quest-icon { font-size: 24px; }
      .quest-content { flex: 1; }
      .quest-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; font-family: 'Syne', sans-serif; }
      .quest-desc { font-size: 12px; color: var(--text-secondary, #64748b); line-height: 1.4; }
      .quest-reward { font-size: 11px; font-weight: 800; color: var(--blue, #3b82f6); margin-top: 5px; }
      .quest-action-btn {
        background: var(--blue, #3b82f6);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s;
      }
      .quest-action-btn:hover { transform: scale(1.05); }

      .vitality-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 4px 12px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 800;
        margin-bottom: 10px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Injects the Avatar UI
   */
  function injectAvatar() {
    const header = document.querySelector(".db-header-content");
    if (!header) return;

    // Create a container specifically for the avatar to sit next to the score ring or title
    const avatarWrapper = document.createElement("div");
    avatarWrapper.id = AVATAR_CONTAINER_ID + "-wrap";
    avatarWrapper.innerHTML = `
      <div class="vitality-badge">Points: <span id="v-points">0</span> VP</div>
      <div id="${AVATAR_CONTAINER_ID}">
        <div class="aura-effect"></div>
        <svg class="avatar-svg" viewBox="0 0 100 150">
          <defs>
            <linearGradient id="avatarGradNormal" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="avatarGradGlowing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#ef4444;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
            </linearGradient>
          </defs>
          <!-- Human Silhouette Path -->
          <path id="avatarPath" d="M50,15c-5.5,0-10,4.5-10,10s4.5,10,10,10s10-4.5,10-10S55.5,15,50,15z M35,40c-2.8,0-5,2.2-5,5v30 c0,2.8,2.2,5,5,5h5v50c0,2.8,2.2,5,5,5s5-2.2,5-5v-45h10v45c0,2.8,2.2,5,5,5s5-2.2,5-5v-50h5c2.8,0,5-2.2,5-5V45c0-2.8-2.2-5-5-5H35z" />
        </svg>
      </div>
    `;
    
    // Inject at start of header
    header.prepend(avatarWrapper);
  }

  /**
   * Injects the Quest Panel UI
   */
  function injectQuestPanel() {
    const anchor = document.getElementById("aiAndActionSection") || document.querySelector(".db-section");
    if (!anchor) return;

    if (document.getElementById(QUEST_PANEL_ID)) return;

    const panel = document.createElement("section");
    panel.id = QUEST_PANEL_ID;
    panel.className = "db-section"; // Match design language
    panel.style.borderBottom = "none";
    panel.style.marginTop = "0";
    
    panel.innerHTML = `
      <div class="section-head">
        <h2>Active Bio-Quests</h2>
        <span class="section-tag" style="background:#10b981; color:#fff; border:none;">RPG Expansion</span>
      </div>
      <div id="quest-list-container">
        <p class="quest-desc" style="font-style:italic;">Analyzing your reports to generate relevant quests...</p>
      </div>
    `;

    anchor.parentNode.insertBefore(panel, anchor);
  }

  /**
   * Updates Avatar Visuals based on Health Score and Vitality Points
   */
  function updateAvatarVisuals() {
    const avatarEl = document.getElementById(AVATAR_CONTAINER_ID);
    const path = document.getElementById("avatarPath");
    const pointsEl = document.getElementById("v-points");
    if (!avatarEl || !path) return;

    // Use health score from the UI if available
    const scoreValEl = document.getElementById("ringValue");
    const score = scoreValEl ? parseInt(scoreValEl.textContent) : 70;
    const points = getPoints();

    if (pointsEl) pointsEl.textContent = points;

    // Logic for states
    path.classList.remove("avatar-state-tired", "avatar-state-normal", "avatar-state-glowing");
    avatarEl.classList.remove("glowing");

    if (score < 50) {
      path.classList.add("avatar-state-tired");
    } else if (score >= 90 || points > 1000) {
      path.classList.add("avatar-state-glowing");
      avatarEl.classList.add("glowing");
    } else {
      path.classList.add("avatar-state-normal");
    }
  }

  /**
   * Updates the Quest list based on metrics
   */
  function updateQuestPanel() {
    const container = document.getElementById("quest-list-container");
    if (!container) return;

    // Detect metrics from DOM or common knowledge
    const activeQuests = [];
    
    // Check for metrics in the DOM cards
    const cards = document.querySelectorAll(".db-metric-card");
    const metricsMap = {};
    cards.forEach(card => {
       const name = card.querySelector(".db-card-name").textContent.toLowerCase();
       const value = card.querySelector(".db-card-value").textContent;
       metricsMap[name] = value;
    });

    QUEST_TEMPLATES.forEach(tmpl => {
      // Metric match check (loose name matching)
      let foundMetricValue = null;
      for (let key in metricsMap) {
        if (key.includes(tmpl.metric)) {
          foundMetricValue = metricsMap[key];
          break;
        }
      }

      if (foundMetricValue && tmpl.condition(foundMetricValue)) {
        activeQuests.push(tmpl);
      }
    });

    if (activeQuests.length === 0) {
      container.innerHTML = `
        <div class="quest-card" style="opacity:0.8; justify-content:center;">
          <div class="quest-icon">🛡️</div>
          <div class="quest-content">
            <div class="quest-title">All Clear!</div>
            <div class="quest-desc">No health monsters detected in your current report. Stay fit to maintain your shield!</div>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = "";
    activeQuests.forEach(q => {
      const card = document.createElement("div");
      card.className = "quest-card";
      card.innerHTML = `
        <div class="quest-icon">${q.id === 'sugar_dragon' ? '🐲' : q.id === 'bp_zen' ? '🧘' : '🛡️'}</div>
        <div class="quest-content">
          <div class="quest-title">${q.title}</div>
          <div class="quest-desc">${q.description}</div>
          <div class="quest-reward">+${q.reward} VP Potential</div>
        </div>
        <button class="quest-action-btn" data-reward="${q.reward}">Mark Done</button>
      `;
      
      card.querySelector("button").onclick = (e) => {
        const reward = parseInt(e.target.dataset.reward);
        addPoints(reward);
        card.style.opacity = "0.5";
        card.style.pointerEvents = "none";
        e.target.textContent = "Claimed!";
        
        // Sprinkle effect (optional but cool)
        alert(`Quest Completed! You earned ${reward} Vitality Points!`);
      };
      
      container.appendChild(card);
    });
  }

  // ──────────────────────────────────────────
  // INITIALIZATION
  // ──────────────────────────────────────────
  function init() {
    injectStyles();
    injectAvatar();
    injectQuestPanel();

    // Give it a small delay to allow dashboard.js to populate data
    setTimeout(() => {
      updateAvatarVisuals();
      updateQuestPanel();
    }, 1000);

    // Watch for updates (e.g. after upload)
    const observer = new MutationObserver(() => {
      updateAvatarVisuals();
      updateQuestPanel();
    });
    
    const grid = document.getElementById("dbMetricsGrid");
    if (grid) {
      observer.observe(grid, { childList: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
