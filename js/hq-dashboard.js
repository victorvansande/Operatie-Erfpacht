/**
 * HQ GAMEMASTER COMMAND DASHBOARD (js/hq-dashboard.js)
 * ----------------------------------------------------
 * Speciaal gebouwd voor Gamemaster Vicce op HQ (Kapucijnenstraat 7):
 * - Overzicht waar elke groep zit en welke van hun 6 locatie-mappen geopend/voltooid zijn
 * - 1-klik bonuspunten toekennen aan een heel team of per ingezonden foto/video
 * - "Al beoordeeld"-bescherming zodat je nooit dubbel punten geeft voor hetzelfde bewijsstuk
 * - Live positie-radar & direct bericht sturen per groep
 */

document.addEventListener("DOMContentLoaded", () => {
  const kpiPlayers = document.getElementById("gm-kpi-players");
  const kpiPlayersSub = document.getElementById("gm-kpi-players-sub");
  const kpiGroups = document.getElementById("gm-kpi-groups");
  const kpiGroupsSub = document.getElementById("gm-kpi-groups-sub");
  const kpiLocations = document.getElementById("gm-kpi-locations");
  const kpiLocationsSub = document.getElementById("gm-kpi-locations-sub");
  const kpiUploads = document.getElementById("gm-kpi-uploads");
  const kpiUploadsSub = document.getElementById("gm-kpi-uploads-sub");

  const actionToast = document.getElementById("gm-action-toast");
  const btnRandomGroups = document.getElementById("gm-btn-random-groups");
  const btnToggleReveal = document.getElementById("gm-btn-toggle-reveal");
  const btnToggleAttendance = document.getElementById("gm-btn-toggle-attendance");
  const btnResetGame = document.getElementById("gm-btn-reset-game");
  const attendanceDrawer = document.getElementById("gm-attendance-drawer");
  const attendanceChips = document.getElementById("gm-attendance-chips");
  const attendanceCountsBadge = document.getElementById("gm-attendance-counts-badge");
  const enableAllPlayersBtn = document.getElementById("gm-enable-all-players-btn");
  const collapseAttendanceBtn = document.getElementById("gm-collapse-attendance-btn");
  const kpiCardAttendance = document.getElementById("gm-kpi-card-attendance");

  const broadcastForm = document.getElementById("gm-broadcast-form");
  const broadcastInput = document.getElementById("gm-broadcast-input");
  const broadcastTargetSelect = document.getElementById("gm-broadcast-target");
  const broadcastCategorySelect = document.getElementById("gm-broadcast-category");
  const broadcastGroupsOptGroup = document.getElementById("gm-broadcast-target-groups");
  const broadcastPlayersOptGroup = document.getElementById("gm-broadcast-target-players");

  const groupsContainer = document.getElementById("gm-groups-container");
  const groupFoldersContainer = document.getElementById("gm-group-folders-container");
  const uploadsStream = document.getElementById("gm-uploads-stream");
  const tabGroupFolders = document.getElementById("gm-tab-group-folders");
  const tabTimeline = document.getElementById("gm-tab-timeline");
  const filterGroupSelect = document.getElementById("gm-filter-group");
  const filterLocSelect = document.getElementById("gm-filter-location");
  const locationOccupancyEl = document.getElementById("gm-location-occupancy");
  const playerCodesListEl = document.getElementById("gm-player-codes-list");

  // Mastercode Modal (leiding2026)
  const authModal = document.getElementById("gm-auth-modal");
  const authForm = document.getElementById("gm-auth-form");
  const authInput = document.getElementById("gm-auth-input");
  const authError = document.getElementById("gm-auth-error");

  // Audio briefing preview op HQ Dashboard
  const hqAudioBtn = document.getElementById("gm-play-audio-briefing-btn");
  const hqAudioEl = document.getElementById("gm-briefing-audio");
  const hqAudioTxt = document.getElementById("gm-audio-btn-txt");
  if (hqAudioBtn && hqAudioEl) {
    hqAudioBtn.addEventListener("click", () => {
      if (hqAudioEl.paused) {
        hqAudioEl.play().then(() => {
          if (hqAudioTxt) hqAudioTxt.textContent = "Pauzeer Audio (01:27)";
          hqAudioBtn.style.background = "rgba(245, 158, 11, 0.25)";
          hqAudioBtn.style.borderColor = "var(--amber)";
        }).catch(err => console.warn("HQ audio play:", err));
      } else {
        hqAudioEl.pause();
        if (hqAudioTxt) hqAudioTxt.textContent = "Speel Audio-Briefing (01:27)";
        hqAudioBtn.style.background = "rgba(239, 68, 68, 0.12)";
        hqAudioBtn.style.borderColor = "#ef4444";
      }
    });
    hqAudioEl.addEventListener("ended", () => {
      if (hqAudioTxt) hqAudioTxt.textContent = "Speel Audio-Briefing (01:27)";
      hqAudioBtn.style.background = "rgba(239, 68, 68, 0.12)";
      hqAudioBtn.style.borderColor = "#ef4444";
    });
  }

  // Live 4G Cloud Status Indicator
  const headerStatusBadge = document.querySelector(".status-badge");
  if (headerStatusBadge && typeof ScoreService !== "undefined" && ScoreService.onSyncStatusChange) {
    ScoreService.onSyncStatusChange((status) => {
      const txt = status === "connected"
        ? "LIVE 4G REALTIME // DUBBELE CLOUD WOLK VERBONDEN (0ms)"
        : status === "connecting"
        ? "VERBINDING MAKEN MET REALTIME WOLK..."
        : "OFFLINE BUFFER // HERVERBINDEN...";
      headerStatusBadge.innerHTML = `<span class="status-dot" style="background:${status === "connected" ? "#10b981" : status === "connecting" ? "#f59e0b" : "#ef4444"}"></span> ${txt}`;
    });
  }

  function checkAdminAuth() {
    const isAuth = sessionStorage.getItem("jb_admin_unlocked") === "true";
    if (!isAuth && authModal) {
      authModal.style.display = "flex";
      authModal.classList.add("active");
      setTimeout(() => authInput && authInput.focus(), 60);
    } else if (authModal) {
      authModal.style.display = "none";
      authModal.classList.remove("active");
    }
  }
  checkAdminAuth();

  if (authForm) {
    authForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = (authInput.value || "").trim().toLowerCase();
      const expected = String(SPEL_CONFIG.masterCode || "leiding2026").trim().toLowerCase();
      if (val && val === expected) {
        sessionStorage.setItem("jb_admin_unlocked", "true");
        authModal.style.display = "none";
        authModal.classList.remove("active");
      } else {
        authError.textContent = "Ongeldige autorisatiecode. Toegang geweigerd.";
        authInput.select();
      }
    });
  }

  let activeUploadView = "folders"; // "folders" of "timeline"
  if (tabGroupFolders && tabTimeline) {
    tabGroupFolders.addEventListener("click", () => {
      activeUploadView = "folders";
      tabGroupFolders.classList.add("active");
      tabTimeline.classList.remove("active");
      if (groupFoldersContainer) groupFoldersContainer.style.display = "block";
      if (uploadsStream) uploadsStream.style.display = "none";
    });

    tabTimeline.addEventListener("click", () => {
      activeUploadView = "timeline";
      tabTimeline.classList.add("active");
      tabGroupFolders.classList.remove("active");
      if (groupFoldersContainer) groupFoldersContainer.style.display = "none";
      if (uploadsStream) uploadsStream.style.display = "grid";
    });
  }

  const radarTabSectors = document.getElementById("gm-radar-tab-sectors");
  const radarTabAgents = document.getElementById("gm-radar-tab-agents");
  const radarAgentsListEl = document.getElementById("gm-radar-agents-list");

  if (radarTabSectors && radarTabAgents) {
    radarTabSectors.addEventListener("click", () => {
      radarTabSectors.classList.add("active");
      radarTabAgents.classList.remove("active");
      if (locationOccupancyEl) locationOccupancyEl.style.display = "flex";
      if (radarAgentsListEl) radarAgentsListEl.style.display = "none";
    });

    radarTabAgents.addEventListener("click", () => {
      radarTabAgents.classList.add("active");
      radarTabSectors.classList.remove("active");
      if (locationOccupancyEl) locationOccupancyEl.style.display = "none";
      if (radarAgentsListEl) radarAgentsListEl.style.display = "flex";
    });
  }

  let latestState = ScoreService.getState();
  let mapInstance = null;

  // Bewaar welke uploads al beoordeeld zijn zodat je nooit per ongeluk dubbel punten geeft
  const REVIEWED_KEY = `jb_gm_reviewed_${SPEL_CONFIG.cloudChannel}`;
  function getReviewedMap() {
    try {
      const raw = localStorage.getItem(REVIEWED_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function markUploadReviewed(eventId, label) {
    const map = getReviewedMap();
    map[eventId] = label || "✓ Beoordeeld";
    try {
      localStorage.setItem(REVIEWED_KEY, JSON.stringify(map));
    } catch (_) {}
  }

  function showToast(msg) {
    if (!actionToast) return;
    actionToast.textContent = msg;
    actionToast.style.display = "block";
    setTimeout(() => {
      if (actionToast.textContent === msg) {
        actionToast.style.display = "none";
      }
    }, 4200);
  }

  // 1. Live Countdown naar Zaterdag 22u00 (Deadline Verkoop Lokaal)
  function updateCountdown() {
    const el = document.getElementById("gm-countdown-timer");
    if (!el) return;
    const now = new Date();
    const fixedTarget = new Date("2026-10-24T22:00:00");
    let target = fixedTarget;
    if (now > fixedTarget) {
      target = new Date();
      target.setHours(22, 0, 0, 0);
    }
    const diff = target - now;

    if (diff <= 0) {
      el.textContent = "22u00 BEREIKT (DEADLINE)";
      return;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hrs = String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, "0");
    const mins = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
    const secs = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
    const dayStr = days > 0 ? `${days}d ` : "";
    el.textContent = `${dayStr}${hrs}:${mins}:${secs} resterend`;
  }
  updateCountdown();
  setInterval(updateCountdown, 1000);

  // 2. Vul statische spiekbriefje-lijst van alle 26 spelerscodes + locatie-filter
  if (playerCodesListEl && SPEL_CONFIG.spelers) {
    playerCodesListEl.innerHTML = SPEL_CONFIG.spelers
      .map(
        (s) =>
          `<div style="background: rgba(15,23,42,0.7); border: 1px solid #1e293b; padding: 0.25rem 0.45rem; border-radius: 4px; display: flex; justify-content: space-between;">
             <span>#${s.dossierNr} ${s.naam}</span>
             <strong style="color: var(--amber);">${s.code}</strong>
           </div>`
      )
      .join("");
  }

  if (filterLocSelect && SPEL_CONFIG.locaties) {
    SPEL_CONFIG.locaties.forEach((loc) => {
      const opt = document.createElement("option");
      opt.value = loc.id;
      opt.textContent = `📍 ${loc.naam}`;
      filterLocSelect.appendChild(opt);
    });
  }

  if (broadcastGroupsOptGroup && SPEL_CONFIG.standaardGroepen) {
    broadcastGroupsOptGroup.innerHTML = SPEL_CONFIG.standaardGroepen
      .map((g) => `<option value="group:${g.id}">👥 ${g.naam}</option>`)
      .join("");
  }

  if (broadcastPlayersOptGroup && SPEL_CONFIG.spelers) {
    broadcastPlayersOptGroup.innerHTML = SPEL_CONFIG.spelers
      .map((s) => `<option value="player:${s.id}">📁 #${s.dossierNr} ${s.naam}</option>`)
      .join("");
  }

  // 3. Initialiseer Herentals Radar-Kaart
  function initRadarMap() {
    const mapEl = document.getElementById("gm-radar-map");
    if (!mapEl || typeof L === "undefined") return;

    mapInstance = L.map("gm-radar-map", {
      center: [51.1782, 4.8335],
      zoom: 14,
      zoomControl: true
    });

    L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(mapInstance);

    const bounds = [];
    const hq = SPEL_CONFIG.headquarters;
    if (hq && hq.lat && hq.lng) {
      bounds.push([hq.lat, hq.lng]);
      const hqIcon = L.divIcon({
        className: "radar-hq-marker-wrap",
        html: `<div class="radar-hq-pin"><span class="radar-hq-core">HQ</span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      L.marker([hq.lat, hq.lng], { icon: hqIcon })
        .addTo(mapInstance)
        .bindPopup(`<strong>★ HEADQUARTERS</strong><br/>${hq.adres}`);
    }

    (SPEL_CONFIG.locaties || []).forEach((loc, idx) => {
      if (!loc.lat || !loc.lng) return;
      bounds.push([loc.lat, loc.lng]);
      const pinIcon = L.divIcon({
        className: "radar-marker-wrap",
        html: `<div class="radar-pin"><span class="radar-pin-core">${idx + 1}</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      L.marker([loc.lat, loc.lng], { icon: pinIcon })
        .addTo(mapInstance)
        .bindPopup(`<strong>${loc.naam}</strong><br/>Code: <code>${loc.code}</code>`);
    });

    if (bounds.length > 1) {
      mapInstance.fitBounds(bounds, { padding: [24, 24] });
    }
  }
  initRadarMap();

  // 3B. Live GPS Agent Tracking Markers op Gamemaster HQ Radar-Kaart
  let gmAgentMarkers = new Map();
  let latestGpsPositionsList = [];

  function renderGmRadarAgentMarkers(positions) {
    if (!mapInstance || typeof L === "undefined") return;
    if (Array.isArray(positions)) {
      latestGpsPositionsList = positions;
    }

    const state = latestState || (typeof ScoreService !== "undefined" ? ScoreService.getState() : null);
    if (!state) return;

    const disabledSet = state.disabledSet || new Set();
    const allPlayers = SPEL_CONFIG.spelers.filter((s) => !s.isGamemaster && !s.isExternalTester);

    const posMap = new Map();
    latestGpsPositionsList.forEach((p) => {
      if (p && p.playerId && typeof p.lat === "number" && typeof p.lng === "number") {
        posMap.set(p.playerId, p);
      }
    });

    let liveCount = 0;

    allPlayers.forEach((sp, idx) => {
      const pInfo = state.playerScoresMap ? state.playerScoresMap.get(sp.id) : null;
      const isDisabled = disabledSet.has(sp.id);
      if (isDisabled) {
        if (gmAgentMarkers.has(sp.id)) {
          mapInstance.removeLayer(gmAgentMarkers.get(sp.id));
          gmAgentMarkers.delete(sp.id);
        }
        return;
      }

      const pGroup = pInfo ? (pInfo.adminGroupId || pInfo.groupId) : null;
      const groupColor = pInfo ? (pInfo.adminGroupColor || pInfo.groupColor || "#38bdf8") : "#38bdf8";
      const groupName = pInfo ? (pInfo.adminGroupName || pInfo.groupName || "Geen team") : "Geen team";

      let lat = null;
      let lng = null;
      let isLiveGps = false;
      let accuracy = 0;
      let lastTs = null;

      if (posMap.has(sp.id)) {
        const pGps = posMap.get(sp.id);
        lat = pGps.lat;
        lng = pGps.lng;
        isLiveGps = true;
        accuracy = pGps.accuracy || 8;
        lastTs = pGps.ts || Date.now();
        liveCount++;
      } else {
        // Geen GPS? Plot op huidige sector van team met een nette deterministische cirkel-offset
        const grp = (state.adminGroupsList || []).find((g) => g.id === pGroup);
        const curLoc = grp ? (grp.currentLocation || (grp.orderedLocations && grp.orderedLocations[0])) : null;
        if (curLoc && curLoc.lat && curLoc.lng) {
          const angle = (idx / allPlayers.length) * 2 * Math.PI;
          lat = curLoc.lat + Math.cos(angle) * 0.00032;
          lng = curLoc.lng + Math.sin(angle) * 0.00032;
        } else if (SPEL_CONFIG.headquarters) {
          const angle = (idx / allPlayers.length) * 2 * Math.PI;
          lat = SPEL_CONFIG.headquarters.lat + Math.cos(angle) * 0.00028;
          lng = SPEL_CONFIG.headquarters.lng + Math.sin(angle) * 0.00028;
        }
      }

      if (lat === null || lng === null) return;

      const coreLabel = `#${sp.dossierNr}`;
      const icon = L.divIcon({
        className: "live-agent-pin-wrap",
        html: `
          <div class="live-agent-pin ${isLiveGps ? 'is-live-gps' : 'is-team-cluster'}" style="--agent-color: ${groupColor};">
            <div class="live-agent-pin-ring" style="${!isLiveGps ? 'animation:none; opacity:0.25;' : ''}"></div>
            <div class="live-agent-pin-core" style="background:${groupColor}; color:#000; font-weight:900;">${coreLabel}</div>
            <div class="live-agent-pin-tag" style="border-color:${groupColor};">${isLiveGps ? '🛰️' : '📍'} ${sp.naam}</div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const popup = `
        <div style="font-family: var(--font-mono, monospace); font-size: 0.8rem; color: #e2e8f0; min-width: 160px;">
          <strong style="color: ${groupColor}; font-size: 0.92rem;">#${sp.dossierNr} ${sp.naam}</strong>
          <div style="color: #94a3b8; font-size: 0.76rem; margin-top: 2px;">
            Team: <strong style="color:#fff;">${groupName}</strong>
          </div>
          <div style="color: ${isLiveGps ? '#10b981' : '#f59e0b'}; font-size: 0.72rem; margin-top: 4px; font-weight:700;">
            ${isLiveGps ? `🟢 LIVE GPS (±${accuracy}m)` : `📍 Berekende Team Positie`}
          </div>
          ${isLiveGps ? `<div style="color: #64748b; font-size: 0.68rem;">Laatste update: ${new Date(lastTs).toLocaleTimeString("nl-BE")}</div>` : ''}
          <div style="color: var(--accent); font-size: 0.72rem; margin-top: 4px;">
            Behaalde punten: <strong>${pInfo ? pInfo.totalPoints : 0} PT</strong>
          </div>
        </div>
      `;

      if (gmAgentMarkers.has(sp.id)) {
        const m = gmAgentMarkers.get(sp.id);
        m.setLatLng([lat, lng]);
        m.setIcon(icon);
        m.setPopupContent(popup);
      } else {
        const m = L.marker([lat, lng], { icon, zIndexOffset: isLiveGps ? 700 : 400 })
          .addTo(mapInstance)
          .bindPopup(popup);
        gmAgentMarkers.set(sp.id, m);
      }
    });

    const badge = document.getElementById("gm-radar-tracking-badge");
    if (badge) {
      badge.textContent = `🛰️ ${liveCount} / ${allPlayers.length} Live GPS Pings`;
      badge.style.color = liveCount > 0 ? "#10b981" : "#38bdf8";
      badge.style.borderColor = liveCount > 0 ? "#10b981" : "rgba(56,189,248,0.3)";
    }

    renderRadarAgentsList(state, posMap);
  }

  // Focus op een speler vanaf de lijst
  window.gmFocusAgent = (playerId) => {
    if (!mapInstance || !gmAgentMarkers.has(playerId)) return;
    const m = gmAgentMarkers.get(playerId);
    mapInstance.setView(m.getLatLng(), 17, { animate: true });
    m.openPopup();
  };

  function renderRadarAgentsList(state, posMap) {
    const listEl = document.getElementById("gm-radar-agents-list");
    if (!listEl) return;
    const allPlayers = SPEL_CONFIG.spelers.filter((s) => !s.isGamemaster && !s.isExternalTester);
    const disabledSet = (state && state.disabledSet) || new Set();

    listEl.innerHTML = allPlayers
      .map((sp) => {
        const pInfo = state.playerScoresMap ? state.playerScoresMap.get(sp.id) : null;
        const isDisabled = disabledSet.has(sp.id);
        if (isDisabled) return "";

        const pGroup = pInfo ? (pInfo.adminGroupId || pInfo.groupId) : null;
        const groupColor = pInfo ? (pInfo.adminGroupColor || pInfo.groupColor || "#38bdf8") : "#38bdf8";
        const hasGps = posMap && posMap.has(sp.id);
        const curGps = hasGps ? posMap.get(sp.id) : null;

        const grp = (state.adminGroupsList || []).find((g) => g.id === pGroup);
        const curLoc = grp ? (grp.currentLocation || (grp.orderedLocations && grp.orderedLocations[0])) : null;
        const locationLabel = hasGps
          ? `🟢 Live GPS (±${curGps.accuracy || 8}m)`
          : curLoc ? `📍 ${curLoc.naam}` : "HQ Kapucijnenstr";

        return `
          <div style="background:rgba(15,23,42,0.85); border:1px solid #1e293b; border-radius:6px; padding:0.35rem 0.6rem; display:flex; justify-content:space-between; align-items:center; font-family:var(--font-mono); font-size:0.72rem; cursor:pointer;" onclick="gmFocusAgent('${sp.id}')" title="Klik om direct in te zoomen op ${sp.naam}">
            <div style="display:flex; align-items:center; gap:0.45rem;">
              <span style="width:8px; height:8px; border-radius:50%; background:${groupColor}; flex-shrink:0;"></span>
              <strong style="color:#fff;">#${sp.dossierNr} ${sp.naam}</strong>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <span style="color:${hasGps ? '#10b981' : '#f59e0b'}; font-size:0.68rem;">${locationLabel}</span>
              <span style="color:#38bdf8; font-size:0.65rem;">🔎 Zoek</span>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // 4. Render KPI's & Top Controls
  let lastUnreviewedCount = -1;

  function playTacticalSubmissionChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      // Tweeledige militaire radar-chime
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.setValueAtTime(880, now + 0.12); // A5
      gain1.gain.setValueAtTime(0.14, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.46);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(1174.66, now + 0.18); // D6
      gain2.gain.setValueAtTime(0.12, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.66);
    } catch (_) {}
  }

  function renderKPIs(state) {
    const groups = state.adminGroupsList || [];
    const reviewed = getReviewedMap();
    const unreviewedCount = (state.allPhotos || []).filter(
      (ph) => !reviewed[ph.eventId]
    ).length;

    // Speel een tactische audio-notificatie af als er een nieuwe inzending binnenkomt
    if (lastUnreviewedCount >= 0 && unreviewedCount > lastUnreviewedCount) {
      playTacticalSubmissionChime();
    }
    lastUnreviewedCount = unreviewedCount;

    // Pas de browservenster titel aan zodat Victor het ziet als hij op een ander tabblad/scherm staat
    if (unreviewedCount > 0) {
      document.title = `(${unreviewedCount}) 🚨 NIEUWE INZENDING - HQ CONTROL`;
    } else {
      document.title = "HQ CONTROL PANEL // Operatie Erfpacht";
    }

    let totalUnlockedFolders = 0;
    let totalCompletedFolders = 0;
    groups.forEach((g) => {
      totalUnlockedFolders += g.unlockedLocations ? g.unlockedLocations.size : 0;
      totalCompletedFolders += g.completedLocationsCount || 0;
    });

    if (kpiPlayers) {
      kpiPlayers.textContent = `${state.unlockedCount} / ${state.totalCount}`;
    }
    if (kpiPlayersSub) {
      const missing = Math.max(0, state.totalCount - state.unlockedCount);
      kpiPlayersSub.textContent =
        missing === 0
          ? "✓ Alle aanwezige agenten ingelogd!"
          : `Nog ${missing} agent(en) zoeken hun code`;
    }

    if (kpiGroups) {
      kpiGroups.textContent = state.groupsRevealed
        ? `ONTHULD (${groups.length})`
        : `VERBORGEN (${groups.length})`;
      kpiGroups.style.color = state.groupsRevealed ? "var(--accent)" : "var(--amber)";
    }
    if (kpiGroupsSub) {
      kpiGroupsSub.textContent = state.groupsRevealed
        ? "Spelers zien hun team & route"
        : "Klaargezet achter de schermen";
    }

    if (kpiLocations) {
      const maxFolders = groups.length * ((SPEL_CONFIG.locaties || []).length || 6);
      kpiLocations.textContent = `${totalCompletedFolders} / ${maxFolders || 6}`;
    }
    if (kpiLocationsSub) {
      kpiLocationsSub.textContent = `${totalUnlockedFolders} mappen geopend in het veld`;
    }

    if (kpiUploads) {
      kpiUploads.textContent = String((state.allPhotos || []).length);
    }
    if (kpiUploadsSub) {
      kpiUploadsSub.textContent =
        unreviewedCount > 0
          ? `🔔 ${unreviewedCount} nieuw(e) bewijsstuk(ken) te beoordelen!`
          : "✓ Alle uploads zijn beoordeeld";
      kpiUploadsSub.style.color =
        unreviewedCount > 0 ? "var(--amber)" : "var(--accent)";
    }

    if (btnToggleReveal) {
      btnToggleReveal.textContent = state.groupsRevealed
        ? "🙈 Verberg Groepen Weer"
        : "👁️ Onthul Groepen Nu aan Iedereen";
    }

    // Update groepsfilter dropdown
    if (filterGroupSelect) {
      const currentVal = filterGroupSelect.value;
      const existingOpts = Array.from(filterGroupSelect.options).map((o) => o.value);
      const targetOpts = ["all", ...groups.map((g) => g.id)];
      if (existingOpts.join("|") !== targetOpts.join("|")) {
        filterGroupSelect.innerHTML = `<option value="all">Alle Groepen (${groups.length})</option>`;
        groups.forEach((g) => {
          const opt = document.createElement("option");
          opt.value = g.id;
          opt.textContent = `${g.naam}`;
          filterGroupSelect.appendChild(opt);
        });
        if (targetOpts.includes(currentVal)) {
          filterGroupSelect.value = currentVal;
        }
      }
    }
  }

  // 5. Render Aanwezigheid & Inactieve Spelers Paneel
  function renderAttendanceDrawer(state) {
    if (!attendanceChips) return;
    attendanceChips.innerHTML = "";

    const all = state.allPlayers || [];
    const activeCount = all.filter((p) => !p.disabled && !p.isGamemaster && !p.isExternalTester).length;
    const inactiveCount = all.filter((p) => p.disabled && !p.isGamemaster && !p.isExternalTester).length;

    if (attendanceCountsBadge) {
      attendanceCountsBadge.innerHTML = `
        <span style="color: var(--accent); font-weight: 700;">🟢 ${activeCount} Veldagenten Aanwezig</span>
        &nbsp;|&nbsp;
        <span style="color: ${inactiveCount > 0 ? "var(--danger)" : "var(--text-muted)"}; font-weight: 700;">🔴 ${inactiveCount} Afwezig</span>
      `;
    }

    const liveGpsPositions = ScoreService.getLiveAgentPositions ? ScoreService.getLiveAgentPositions() : [];

    all.forEach((p) => {
      const chip = document.createElement("div");
      const isTester = Boolean(p.isExternalTester);
      const isStaff = Boolean(p.isGamemaster);

      if (isStaff) {
        chip.className = "gm-attend-chip is-staff";
        chip.style.cssText = `
          background: rgba(245, 158, 11, 0.12);
          border: 1.5px solid rgba(245, 158, 11, 0.65);
          border-radius: 8px;
          padding: 0.55rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          box-shadow: 0 0 14px rgba(245, 158, 11, 0.15);
        `;
        chip.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 0.35rem;">
            <strong style="font-size: 0.95rem; color: #fde047;">
              ★ ${p.naam} (Gamemaster HQ)
            </strong>
            <span style="font-family: var(--font-mono); font-size: 0.7rem; color: #f59e0b;">
              #${p.dossierNr}
            </span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.35rem; background: rgba(0,0,0,0.35); padding: 0.2rem 0.45rem; border-radius: 4px; border: 1px solid rgba(245,158,11,0.25);">
            <span style="font-family: var(--font-mono); font-size: 0.72rem; color: #94a3b8;">PIN / CODE:</span>
            <span style="font-family: var(--font-mono); font-size: 0.88rem; font-weight: 900; color: #fde047; letter-spacing: 0.08em;">${p.code}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <span style="font-family: var(--font-mono); font-size: 0.68rem; font-weight: 800; color: #f59e0b;">
              👑 COMMANDANT HOOFDKWARTIER
            </span>
            ${gpsPos ? `<span style="font-family: var(--font-mono); font-size: 0.62rem; color: #10b981; background: rgba(16,185,129,0.18); border: 1px solid rgba(16,185,129,0.5); padding: 0.1rem 0.35rem; border-radius: 3px; font-weight: 800;">🛰️ GPS LIVE (±${gpsPos.accuracy || 5}m)</span>` : '<span style="font-family: var(--font-mono); font-size: 0.62rem; color: #94a3b8;">Kapucijnenstraat 7</span>'}
          </div>
          <div style="font-size: 0.72rem; color: #cbd5e1; font-style: italic;">
            Blijft in HQ &bull; telt niet mee in groepsverdeling of klassement.
          </div>
        `;
        attendanceChips.appendChild(chip);
        return;
      }

      if (isTester) {
        chip.className = "gm-attend-chip is-tester";
        chip.style.cssText = `
          background: rgba(16, 185, 129, 0.12);
          border: 1.5px solid rgba(16, 185, 129, 0.6);
          border-radius: 8px;
          padding: 0.55rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        `;
        chip.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 0.35rem;">
            <strong style="font-size: 0.95rem; color: #6ee7b7;">
              🧪 ${p.naam} (Externe Tester)
            </strong>
            <span style="font-family: var(--font-mono); font-size: 0.7rem; color: #10b981;">
              #${p.dossierNr}
            </span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.35rem; background: rgba(0,0,0,0.35); padding: 0.2rem 0.45rem; border-radius: 4px; border: 1px solid rgba(16,185,129,0.25);">
            <span style="font-family: var(--font-mono); font-size: 0.72rem; color: #94a3b8;">TEST CODE:</span>
            <span style="font-family: var(--font-mono); font-size: 0.88rem; font-weight: 900; color: #6ee7b7; letter-spacing: 0.08em;">${p.code}</span>
          </div>
          <div style="font-size: 0.72rem; color: #cbd5e1; font-style: italic;">
            Volledig ontgrendeld mapje om te testen &bull; telt niet mee in spel.
          </div>
        `;
        attendanceChips.appendChild(chip);
        return;
      }

      const isOff = p.disabled;
      const isUnlocked = p.unlocked;
      const isDebriefed = p.debriefed;
      const gpsPos = liveGpsPositions.find((g) => g.playerId === p.id);

      chip.className = `gm-attend-chip ${isOff ? "is-off" : isUnlocked ? "is-unlocked" : "is-active"}`;
      chip.style.cssText = `
        background: ${isDebriefed ? "rgba(245, 158, 11, 0.14)" : isOff ? "rgba(239, 68, 68, 0.12)" : isUnlocked ? "rgba(16, 185, 129, 0.14)" : "rgba(15, 23, 42, 0.88)"};
        border: 1.5px solid ${isDebriefed ? "rgba(245, 158, 11, 0.7)" : isOff ? "rgba(239, 68, 68, 0.65)" : isUnlocked ? "rgba(16, 185, 129, 0.65)" : "#334155"};
        border-radius: 8px;
        padding: 0.55rem 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        transition: all 0.15s ease;
      `;

      const gpsBadge = gpsPos
        ? `<span style="font-family: var(--font-mono); font-size: 0.62rem; color: #10b981; background: rgba(16,185,129,0.18); border: 1px solid rgba(16,185,129,0.5); padding: 0.1rem 0.35rem; border-radius: 3px; font-weight: 800;">🛰️ GPS ±${gpsPos.accuracy || 8}m</span>`
        : "";

      const debriefBadge = isDebriefed
        ? `<span style="font-family: var(--font-mono); font-size: 0.62rem; color: #f59e0b; background: rgba(245,158,11,0.22); border: 1px solid rgba(245,158,11,0.6); padding: 0.1rem 0.35rem; border-radius: 3px; font-weight: 800;">🔒 AFGEMELD &amp; VERZEGELD</span>`
        : "";

      const statusBadge = isOff
        ? `<span style="font-family: var(--font-mono); font-size: 0.68rem; font-weight: 800; color: #f87171;">🔴 INACTIEF (AFWEZIG)</span>`
        : isUnlocked
        ? `<span style="font-family: var(--font-mono); font-size: 0.68rem; font-weight: 800; color: var(--accent);">🟢 AANWEZIG // INGELOGD #${p.unlockRank}</span> ${gpsBadge} ${debriefBadge}`
        : `<span style="font-family: var(--font-mono); font-size: 0.68rem; font-weight: 700; color: #38bdf8;">🟢 AANWEZIG // WACHT OP PIN</span> ${gpsBadge} ${debriefBadge}`;

      chip.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 0.35rem;">
          <strong style="font-size: 0.95rem; color: ${isOff ? "#94a3b8" : "#ffffff"}; text-decoration: ${isOff ? "line-through" : "none"};">
            📁 ${p.naam}
          </strong>
          <span style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-muted);">
            #${p.dossierNr}
          </span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.35rem; background: rgba(0,0,0,0.4); padding: 0.2rem 0.45rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.08);">
          <span style="font-family: var(--font-mono); font-size: 0.72rem; color: #94a3b8;">PIN / CODE:</span>
          <span style="font-family: var(--font-mono); font-size: 0.9rem; font-weight: 900; color: #fde047; letter-spacing: 0.08em;">${p.code || "----"}</span>
        </div>
        <div>${statusBadge}</div>
        <div style="display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.25rem;">
          <button type="button" class="btn-toggle-active" style="width: 100%; height: 28px; padding: 0 0.5rem; font-size: 0.72rem; font-weight: 700; border-radius: 5px; cursor: pointer; border: 1px solid ${isOff ? "var(--accent)" : "rgba(239, 68, 68, 0.6)"}; background: ${isOff ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.18)"}; color: ${isOff ? "#6ee7b7" : "#fca5a5"}; transition: all 0.15s ease; display: flex; align-items: center; justify-content: center;">
            ${isOff ? "✅ Zet Aanwezig" : "❌ Zet Inactief"}
          </button>
          <div style="display: flex; gap: 0.35rem; width: 100%;">
            <button type="button" class="btn-msg-p" title="Stuur directe HQ-notificatie popup naar ${p.naam}" style="flex: 1; height: 26px; padding: 0 0.35rem; font-size: 0.68rem; font-weight: 700; border-radius: 5px; cursor: pointer; border: 1px solid #38bdf8; background: rgba(56, 189, 248, 0.15); color: #7dd3fc; transition: all 0.15s ease; display: flex; align-items: center; justify-content: center;">
              💬 Bericht
            </button>
            <button type="button" class="btn-pts-p" title="Ken bonuspunten toe aan ${p.naam}" style="flex: 1; height: 26px; padding: 0 0.35rem; font-size: 0.68rem; font-weight: 700; border-radius: 5px; cursor: pointer; border: 1px solid var(--amber); background: rgba(245, 158, 11, 0.15); color: var(--amber); transition: all 0.15s ease; display: flex; align-items: center; justify-content: center;">
              ⭐ +PT
            </button>
            ${
              !isOff && !isUnlocked
                ? `<button type="button" class="force-unlock-p-btn" title="Ontgrendel speler direct handmatig" style="flex: 1; height: 26px; padding: 0 0.35rem; font-size: 0.68rem; font-weight: 700; border-radius: 5px; cursor: pointer; border: 1px solid var(--accent); background: rgba(16, 185, 129, 0.2); color: #6ee7b7; display: flex; align-items: center; justify-content: center;">⚡ Login</button>`
                : ""
            }
          </div>
        </div>
      `;

      chip.querySelector(".btn-toggle-active").addEventListener("click", async () => {
        const actionStr = isOff ? "AANWEZIG (ACTIEF)" : "INACTIEF (AFWEZIG)";
        const confirmMsg = `Weet je zeker dat je ${p.naam} op ${actionStr} wilt zetten?\n\n${
          !isOff
            ? "⚠️ Inactieve spelers kunnen niet meer inloggen en worden overgeslagen bij de groepsverdeling."
            : "✓ De speler wordt weer geactiveerd en telt mee in het spel."
        }`;
        if (!window.confirm(confirmMsg)) return;

        await ScoreService.setPlayerDisabled(p.id, !isOff);
        showToast(
          !isOff
            ? `⚠️ ${p.naam} staat nu op INACTIEF (afwezig).`
            : `✓ ${p.naam} staat nu weer op AANWEZIG (actief).`
        );
      });

      const forceBtn = chip.querySelector(".force-unlock-p-btn");
      if (forceBtn) {
        forceBtn.addEventListener("click", async () => {
          if (!window.confirm(`Weet je zeker dat je de persoonlijke code van ${p.naam} handmatig wilt ontgrendelen?`)) return;
          await ScoreService.recordUnlock(p.id);
          showToast(`✓ Code van ${p.naam} handmatig ontgrendeld!`);
        });
      }

      const msgBtn = chip.querySelector(".btn-msg-p");
      if (msgBtn) {
        msgBtn.addEventListener("click", () => {
          if (broadcastTargetSelect) {
            broadcastTargetSelect.value = `player:${p.id}`;
            updateBroadcastPlaceholder();
          }
          if (broadcastInput) {
            broadcastInput.scrollIntoView({ behavior: "smooth", block: "center" });
            broadcastInput.focus();
          }
        });
      }

      const ptsBtn = chip.querySelector(".btn-pts-p");
      if (ptsBtn) {
        ptsBtn.addEventListener("click", async () => {
          const val = window.prompt(
            `Hoeveel punten wil je toekennen aan ${p.naam}? (Gebruik een minteken voor aftrek, bv. -25)`,
            "50"
          );
          if (val === null) return;
          const delta = parseInt(val, 10);
          if (isNaN(delta) || delta === 0) return;
          const reason =
            window.prompt(
              `Reden voor ${delta > 0 ? "+" : ""}${delta} PT aan ${p.naam}:`,
              "Bonus Gamemaster HQ"
            ) || "Handmatige aanpassing HQ";
          await ScoreService.addBonusPoints(p.id, delta, reason);
          showToast(`${delta > 0 ? "+" : ""}${delta} PT toegekend aan ${p.naam}!`);
        });
      }

      attendanceChips.appendChild(chip);
    });
  }

  // 6. Render de Groepen Matrix (Waar zit elke groep + 6 stappen + 1-klik bonuspunten)
  function renderGroupsMatrix(state) {
    if (!groupsContainer) return;

    // Als de gamemaster aan het typen is in een groepskaart, breek zijn focus niet af!
    const activeEl = document.activeElement;
    if (
      activeEl &&
      groupsContainer.contains(activeEl) &&
      (activeEl.tagName === "INPUT" || activeEl.tagName === "SELECT")
    ) {
      return;
    }

    const groups = state.adminGroupsList || [];
    if (groups.length === 0) {
      groupsContainer.innerHTML = `
        <div class="gm-panel-card" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
          <p style="font-family: var(--font-mono); color: var(--amber); margin-bottom: 0.75rem;">
            Er zijn nog geen groepen ingedeeld. Klik op de knop hieronder om de aanwezige spelers automatisch in groepen te verdelen!
          </p>
          <button type="button" class="btn btn-primary" onclick="document.getElementById('gm-btn-random-groups').click()">
            🎲 Verdeel Aanwezige Spelers Nu in Groepen
          </button>
        </div>
      `;
      return;
    }

    groupsContainer.innerHTML = "";
    groups.forEach((grp, idx) => {
      const card = document.createElement("article");
      card.className = "gm-group-card";
      card.style.setProperty("--grp-color", grp.kleur || "var(--accent)");

      const avgPts =
        grp.leden.length > 0 ? Math.round(grp.totalPoints / grp.leden.length) : 0;

      // Waar zit deze groep nu?
      const cur = grp.currentLocation;
      let whereHtml = `<span style="color: var(--text-muted);">Nog niet gestart</span>`;
      if (cur) {
        if (cur.status === "voltooid") {
          whereHtml = `<strong style="color: var(--accent);">🏆 ALLE 6 LOCATIES VOLTOOID! (Op weg naar HQ)</strong>`;
        } else if (cur.status === "bezig") {
          whereHtml = `<span>📍 NU BEZIG OP: <strong style="color: var(--amber); font-size: 0.88rem;">${cur.naam.toUpperCase()}</strong> (Stap ${cur.stepNr}/6)</span>`;
        } else {
          whereHtml = `<span>🏃 VOLGENDE DOELWIT: <strong style="color: #fff;">${cur.naam}</strong> (Stap ${cur.stepNr}/6 • code: <code style="color:var(--amber);">${cur.code}</code>)</span>`;
        }
      }

      // Leden badges
      const membersHtml = grp.leden
        .map((m) => {
          const icon = m.unlocked ? `<span style="color:var(--accent);">✓</span>` : `<span style="color:var(--amber);">⏳</span>`;
          return `<span style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); padding:0.15rem 0.45rem; border-radius:4px; font-size:0.74rem; color:#e2e8f0;">${icon} ${m.naam} <small style="color:var(--text-muted);">(${m.totalPoints})</small></span>`;
        })
        .join("");

      // 6 Route-stappen in de exacte volgorde van dit team
      const stepsHtml = (grp.orderedLocations || [])
        .map((loc) => {
          const isOpen = grp.unlockedLocations && grp.unlockedLocations.has(loc.id);
          const locUploads = (grp.photos || []).filter(
            (ph) => ph.locationId === loc.id
          );
          const isDone = isOpen && locUploads.length > 0;
          const preset = getTaskPresetInfo(loc.id, loc.naam, "");
          const locPts = preset.points || 100;

          let pillClass = "";
          let statusLabel = `🔒 ${loc.code}`;
          if (isDone) {
            pillClass = "step-done";
            statusLabel = `🟢 KLAAR (📷${locUploads.length})`;
          } else if (isOpen) {
            pillClass = "step-open";
            statusLabel = `🟡 BEZIG`;
          }

          return `
            <div class="gm-step-pill ${pillClass}">
              <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:110px;">
                <strong style="color: var(--text-muted);">${loc.stepNr}.</strong>
                <strong>${loc.naam}</strong>
              </div>
              <div style="display:flex; align-items:center; gap:0.35rem; flex-shrink:0;">
                <span style="font-size:0.66rem;">${statusLabel}</span>
                ${
                  !isOpen
                    ? `<button type="button" class="gm-step-unlock-btn" data-unlock-loc="${loc.id}" title="Open dit mapje op afstand voor ${grp.naam}">Open</button>`
                    : ""
                }
                <button type="button" class="gm-step-award-btn" data-group-id="${grp.id}" data-loc-id="${loc.id}" data-loc-name="${loc.naam}" data-pts="${locPts}" title="Ken direct de vaste +${locPts} PT van sector ${loc.naam} toe aan ${grp.naam}">
                  +${locPts} PT
                </button>
              </div>
            </div>
          `;
        })
        .join("");

      const revStep = grp.revealedStepCount || 1;
      const nextStepNr = Math.min(6, revStep + 1);
      const nextLoc = (grp.orderedLocations || []).find((l) => l.stepNr === nextStepNr);
      const nextLocName = nextLoc ? nextLoc.naam : `Locatie ${nextStepNr}`;

      const revealBtnHtml =
        revStep < 6
          ? `
            <button type="button" class="btn btn-primary gm-btn-reveal-next-loc" data-group-id="${grp.id}" style="width: 100%; margin: 0.65rem 0 0.5rem; padding: 0.72rem 1rem; font-weight: 800; font-size: 0.85rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: 1.5px solid #34d399; box-shadow: 0 0 15px rgba(16, 185, 129, 0.35); text-align: center; justify-content: center; cursor: pointer;">
              🔓 ONTHUL VOLGENDE LOCATIE: Stap ${nextStepNr} (${nextLocName}) &rarr;
            </button>
          `
          : `
            <button type="button" class="gm-btn gm-btn-recall-hq" style="background: #f59e0b; border-color: #fbbf24; color: #05080d; font-weight: 900; width: 100%; padding: 0.65rem 1rem; margin: 0.55rem 0 0.45rem; font-family: var(--font-mono); font-size: 0.78rem;" title="Keur de 6e/laatste locatie goed en stuur de dramatische finale recall alert naar dit team">
              🏁 KEUR LAATSTE LOCATIE GOED &amp; ROEP TERUG NAAR HQ &rarr;
            </button>
          `;

      card.innerHTML = `
        <div class="gm-group-top">
          <div>
            <div class="gm-group-title">
              <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${grp.kleur};"></span>
              <span>#${idx + 1} ${grp.naam}</span>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-top:0.45rem;">
              ${membersHtml}
            </div>
          </div>
          <div class="gm-group-score-box">
            <div class="gm-group-total-pts" title="Eerlijke Teamscore (Gemiddelde per lid)">${avgPts} PT</div>
            <div style="font-size:0.68rem; color:var(--text-muted);">
              Gemiddelde/lid • ${grp.leden.length} spelers (som: ${grp.sumPoints || grp.totalPoints}) • 📷 ${(grp.photos || []).length}
            </div>
          </div>
        </div>

        <!-- Waar zit deze groep nu? -->
        <div class="gm-where-banner">
          ${whereHtml}
          <span style="color: var(--accent); font-weight: 800;">
            ${grp.completedLocationsCount || 0} / 6 VOLTOOID
          </span>
        </div>

        <!-- Knop om direct de volgende locatie te onthullen na verificatie bewijs -->
        ${revealBtnHtml}

        <!-- De 6 locaties in hun specifieke groepsvolgorde -->
        <div class="gm-route-steps">
          ${stepsHtml}
        </div>

        <!-- 1-Klik Team Bonuspunten & Strafpunten (De 7 Bonusmissies) -->
        <div class="gm-bonus-bar">
          <div style="display:flex; justify-content:space-between; align-items:center; font-family:var(--font-mono); font-size:0.68rem; color:var(--text-muted); margin-bottom:0.25rem;">
            <span>⭐ DE 7 BONUSMISSIES TOEKENNEN AAN ${grp.naam.toUpperCase()}:</span>
          </div>
          <div class="gm-bonus-btns" style="display:flex; flex-wrap:wrap; gap:0.35rem;">
            <button type="button" class="gm-chip-btn chip-amber" data-team-bonus="40" data-reason="Nokia Burner SMS gekraakt">📱 +40 Nokia SMS</button>
            <button type="button" class="gm-chip-btn chip-amber" data-team-bonus="60" data-reason="SMS SOS naar Vicce ontvangen">📞 +60 SOS SMS</button>
            <button type="button" class="gm-chip-btn chip-amber" data-team-bonus="50" data-reason="Speurhond K9 foto goedgekeurd">🐕 +50 Speurhond K9</button>
            <button type="button" class="gm-chip-btn chip-amber" data-team-bonus="140" data-reason="Ad Fundum Café Infiltratie">🍺 +140 Ad Fundum</button>
            <button type="button" class="gm-chip-btn chip-amber" data-team-bonus="160" data-reason="Volksstem 6 Vreemden Koor">📢 +160 Volksstem</button>
            <button type="button" class="gm-chip-btn chip-amber gm-custom-prompt-btn" data-reason="Snack voor Vicce">🍟 Snack Vicce (Vrij)</button>
            <button type="button" class="gm-chip-btn chip-amber gm-custom-prompt-btn" data-reason="Carte Blanche Stunt">🎭 Carte Blanche (Vrij)</button>
            <button type="button" class="gm-chip-btn chip-danger" data-team-bonus="-25" data-reason="Strafpunten HQ">⚠️ -25 Straf</button>
            <div style="display:flex; gap:0.25rem; margin-left:auto;">
              <input type="number" class="admin-input gm-custom-pts-input" placeholder="±PT" style="margin-bottom:0; width:68px; padding:0.25rem 0.45rem; font-size:0.75rem;" />
              <button type="button" class="gm-chip-btn gm-custom-pts-btn">Geef</button>
            </div>
          </div>
        </div>

        <!-- Direct Bericht sturen naar specifiek deze groep -->
        <form class="gm-group-msg-form" style="display:flex; gap:0.4rem;" autocomplete="off">
          <input
            type="text"
            class="admin-input gm-group-msg-input"
            placeholder="💬 Stuur bericht/hint enkel naar ${grp.naam}..."
            style="margin-bottom:0; flex:1; padding:0.4rem 0.65rem; font-size:0.76rem;"
            required
          />
          <button type="submit" class="btn btn-secondary" style="padding:0.4rem 0.75rem; font-size:0.72rem; white-space:nowrap;">
            Zend
          </button>
        </form>
      `;

      // Event: Onthul de volgende locatie voor deze groep en stuur een directe alert pop-up
      const revealBtn = card.querySelector(".gm-btn-reveal-next-loc");
      if (revealBtn) {
        revealBtn.addEventListener("click", async () => {
          revealBtn.disabled = true;
          revealBtn.textContent = "Ontgrendelen & Melden...";
          await ScoreService.revealNextLocationForGroup(grp.id);
          showToast(`✓ Volgende locatie (${nextLocName}) ontgrendeld voor ${grp.naam}! Alert pop-up verzonden.`);
        });
      }

      // Event: Finale recall pop-up sturen naar deze groep
      const recallBtn = card.querySelector(".gm-btn-recall-hq");
      if (recallBtn) {
        recallBtn.addEventListener("click", async () => {
          recallBtn.disabled = true;
          recallBtn.textContent = "Finale recall versturen...";
          await ScoreService.recallGroupToHQ(grp.id);
          showToast(`🏁 Finale recall verzonden naar ${grp.naam}! Schermvullende alert staat op hun schermen.`);
          recallBtn.textContent = "✓ Finale Recall Verzonden (Nogmaals zenden?)";
          recallBtn.disabled = false;
        });
      }

      // Event: Open een locatie-mapje op afstand voor dit team
      card.querySelectorAll("[data-unlock-loc]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const locId = btn.getAttribute("data-unlock-loc");
          const firstMember = grp.leden[0];
          if (!firstMember) return;
          btn.disabled = true;
          btn.textContent = "...";
          await ScoreService.unlockLocation(firstMember.id, locId);
          showToast(`Mapje '${locId}' op afstand geopend voor ${grp.naam}!`);
        });
      });

      // Event: Direct de afgesproken sectorpunten toekennen aan heel dit team
      card.querySelectorAll(".gm-step-award-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const gId = btn.getAttribute("data-group-id");
          const lId = btn.getAttribute("data-loc-id");
          const lName = btn.getAttribute("data-loc-name");
          const pts = Number(btn.getAttribute("data-pts")) || 100;
          const ok = window.confirm(
            `🎯 SECTOR PUNTEN TOEKENNEN // ${grp.naam.toUpperCase()}\n\n` +
            `Weet je zeker dat je +${pts} punten wilt toekennen aan heel ${grp.naam} voor sector:\n${lName}?`
          );
          if (!ok) return;
          btn.disabled = true;
          const origText = btn.textContent;
          btn.textContent = "...";
          await ScoreService.addGroupBonusPoints(gId, pts, `Sector ${lName} voltooid (+${pts} PT)`);
          await ScoreService.postBoardMessage({
            targetType: "group",
            targetId: gId,
            category: "alert",
            locationId: lId,
            locationName: lName,
            text: `🎯 SECTOR VOLTOOID // +${pts} PUNTEN!\nHQ heeft jullie bewijs voor ${lName} goedgekeurd (+${pts} PT toegekend aan jullie team)!`
          });
          btn.textContent = `✓ +${pts}`;
          btn.style.background = "rgba(16, 185, 129, 0.45)";
          btn.style.borderColor = "#10b981";
          btn.style.color = "#fff";
          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = origText;
          }, 3000);
          showToast(`✓ +${pts} punten toegekend aan ${grp.naam} voor sector ${lName}!`);
        });
      });

      // Event: 1-klik Team Bonus knoppen
      card.querySelectorAll("[data-team-bonus]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const delta = Number(btn.getAttribute("data-team-bonus"));
          const reason = btn.getAttribute("data-reason") || "Team bonus";
          btn.disabled = true;
          await ScoreService.addGroupBonusPoints(grp.id, delta, reason);
          btn.disabled = false;
          showToast(
            `${delta > 0 ? "+" : ""}${delta} PT toegekend aan heel ${grp.naam} (${reason})!`
          );
        });
      });

      // Event: Prompt bonus (Snack Vicce & Carte Blanche met zelfgekozen punten)
      card.querySelectorAll(".gm-custom-prompt-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const reason = btn.getAttribute("data-reason") || "Bonus";
          const input = window.prompt(`Hoeveel punten toekennen aan ${grp.naam} voor "${reason}"?`, "50");
          if (input === null) return;
          const delta = parseInt(input, 10);
          if (isNaN(delta) || delta === 0) return;
          btn.disabled = true;
          await ScoreService.addGroupBonusPoints(grp.id, delta, `${reason}: ${delta > 0 ? "+" : ""}${delta} PT`);
          btn.disabled = false;
          showToast(`✓ ${delta > 0 ? "+" : ""}${delta} PT toegekend aan ${grp.naam} (${reason})!`);
        });
      });

      // Event: Vrije punten geven aan heel het team
      const customInput = card.querySelector(".gm-custom-pts-input");
      const customBtn = card.querySelector(".gm-custom-pts-btn");
      if (customBtn && customInput) {
        customBtn.addEventListener("click", async () => {
          const delta = Number(customInput.value);
          if (!delta) return;
          customBtn.disabled = true;
          await ScoreService.addGroupBonusPoints(
            grp.id,
            delta,
            "Handmatige aanpassing HQ"
          );
          customInput.value = "";
          customBtn.disabled = false;
          showToast(`${delta > 0 ? "+" : ""}${delta} PT toegekend aan heel ${grp.naam}!`);
        });
      }

      // Event: Direct bericht naar deze groep
      const msgForm = card.querySelector(".gm-group-msg-form");
      const msgInput = card.querySelector(".gm-group-msg-input");
      if (msgForm && msgInput) {
        msgForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const txt = msgInput.value.trim();
          if (!txt) return;
          await ScoreService.postBoardMessage({
            targetType: "group",
            targetId: grp.id,
            category: "tip",
            text: txt
          });
          msgInput.value = "";
          showToast(`Bericht verzonden naar het Message Board van ${grp.naam}!`);
        });
      }

      groupsContainer.appendChild(card);
    });
  }

  // Helper: Bepaal vooraf klaargezette punten en titel op basis van de taak / sector
  function getTaskPresetInfo(locationId, locationName, caption) {
    const locId = String(locationId || "").toLowerCase();
    const text = `${locId} ${locationName || ""} ${caption || ""}`.toLowerCase();

    // 1. De 7 Bonusmissies
    if (locId.includes("speurhond") || text.includes("hond") || text.includes("k9") || text.includes("sollicitatie")) {
      return {
        points: 50,
        shortName: "HONDENFOTO K9",
        notification: "OPDRACHT SUCCESVOL: +50 PUNTEN VOOR HONDENFOTO K9"
      };
    }
    if (locId.includes("carte") || text.includes("carte") || text.includes("stunt")) {
      return {
        points: 0,
        shortName: "CARTE BLANCHE MISSIE",
        notification: "OPDRACHT SUCCESVOL: CARTE BLANCHE BEOORDEELD"
      };
    }
    if (locId.includes("snack") || text.includes("snack") || text.includes("proviand")) {
      return {
        points: 0,
        shortName: "SNACK VOOR VICCE",
        notification: "OPDRACHT SUCCESVOL: SNACK VOOR VICCE BEOORDEELD"
      };
    }
    if (locId.includes("adfundum") || text.includes("ad_fundum") || text.includes("ad fundum") || text.includes("adtje") || text.includes("café")) {
      return {
        points: 140,
        shortName: "AD FUNDUM",
        notification: "OPDRACHT SUCCESVOL: +140 PUNTEN VOOR AD FUNDUM"
      };
    }
    if (locId.includes("koor") || text.includes("volksstem") || text.includes("vreemden") || text.includes("leuze")) {
      return {
        points: 160,
        shortName: "6 VREEMDEN PROTESTKOOR",
        notification: "OPDRACHT SUCCESVOL: +160 PUNTEN VOOR 6 VREEMDEN PROTESTKOOR"
      };
    }
    if (locId.includes("burner") || text.includes("burner") || text.includes("nokia")) {
      return {
        points: 40,
        shortName: "NOKIA BURNER SMS",
        notification: "OPDRACHT SUCCESVOL: +40 PUNTEN VOOR NOKIA BURNER SMS"
      };
    }
    if (locId.includes("therese") || text.includes("therese") || text.includes("tap") || text.includes("sos")) {
      return {
        points: 60,
        shortName: "TAP THÉRÈSE SOS",
        notification: "OPDRACHT SUCCESVOL: +60 PUNTEN VOOR TAP THÉRÈSE SOS"
      };
    }

    // 2. De 6 Vaste Veldsectoren
    if (locId === "zandpoort" || text.includes("zandpoort") || text.includes("tagmark") || text.includes("mol")) {
      return {
        points: 150,
        shortName: "TAGMARK ZANDPOORT",
        notification: "OPDRACHT SUCCESVOL: +150 PUNTEN VOOR TAGMARK ZANDPOORT"
      };
    }
    if (locId === "begijnhof" || text.includes("begijnhof") || text.includes("avondlied")) {
      return {
        points: 70,
        shortName: "BEGIJNHOF AVONDLIED",
        notification: "OPDRACHT SUCCESVOL: +70 PUNTEN VOOR BEGIJNHOF AVONDLIED"
      };
    }
    if (locId === "bovenpoort" || text.includes("bovenpoort") || text.includes("getuige") || text.includes("interview")) {
      return {
        points: 130,
        shortName: "BOVENPOORT GETUIGENIS",
        notification: "OPDRACHT SUCCESVOL: +130 PUNTEN VOOR BOVENPOORT GETUIGENIS"
      };
    }
    if (locId === "stadspark" || text.includes("stadspark") || text.includes("hack")) {
      return {
        points: 80,
        shortName: "STADSPARK HACKERACTIE",
        notification: "OPDRACHT SUCCESVOL: +80 PUNTEN VOOR STADSPARK HACKERACTIE"
      };
    }
    if (locId === "kerkplein" || text.includes("kerkplein") || text.includes("10") || text.includes("cash")) {
      return {
        points: 100,
        shortName: "KERKPLEIN €10 BEWIJS",
        notification: "OPDRACHT SUCCESVOL: +100 PUNTEN VOOR KERKPLEIN €10 BEWIJS"
      };
    }
    if (locId === "nieuw-lokaal" || text.includes("lokaal") || text.includes("dakpuin") || text.includes("csi")) {
      return {
        points: 100,
        shortName: "NIEUW LOKAAL DAKPUIN",
        notification: "OPDRACHT SUCCESVOL: +100 PUNTEN VOOR NIEUW LOKAAL DAKPUIN"
      };
    }
    if (locId === "lakenhal" || text.includes("lakenhal")) {
      return {
        points: 40,
        shortName: "LAKENHAL ONDERZOEK",
        notification: "OPDRACHT SUCCESVOL: +40 PUNTEN VOOR LAKENHAL ONDERZOEK"
      };
    }
    if (locId === "stadhuis" || text.includes("stadhuis")) {
      return {
        points: 40,
        shortName: "STADHUIS ONDERZOEK",
        notification: "OPDRACHT SUCCESVOL: +40 PUNTEN VOOR STADHUIS ONDERZOEK"
      };
    }

    const cleanName = (locationName || "INZENDING").toUpperCase();
    return {
      points: 50,
      shortName: cleanName,
      notification: `OPDRACHT SUCCESVOL: +50 PUNTEN VOOR ${cleanName}`
    };
  }

  // 7A. Render Groepsmappen (Alle uploads per team in één oogopslag)
  function renderGroupFolders(state) {
    if (!groupFoldersContainer) return;
    const groups = state.adminGroupsList || [];
    const locFilter = filterLocSelect ? filterLocSelect.value : "all";
    const reviewedMap = getReviewedMap();

    if (groups.length === 0) {
      groupFoldersContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-family: var(--font-mono); font-size: 0.8rem;">
          [ NOG GEEN GROEPEN INGEDEELD ]
        </div>
      `;
      return;
    }

    groupFoldersContainer.innerHTML = "";

    groups.forEach((grp) => {
      const box = document.createElement("div");
      box.className = "gm-group-folder-box";
      box.style.setProperty("--grp-color", grp.kleur || "var(--accent)");

      // Filter uploads van deze groep
      const allGrpPhotos = grp.photos || [];
      const filteredPhotos = allGrpPhotos.filter((ph) => {
        if (locFilter !== "all" && ph.locationId !== locFilter) return false;
        return true;
      });

      // Tel op hoeveel van de 6 locaties deze groep al bewijs heeft geüpload
      const locsWithUploads = new Set(allGrpPhotos.map((p) => p.locationId));

      box.innerHTML = `
        <div class="gm-group-folder-header">
          <div>
            <div style="font-size: 1.15rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 0.5rem;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${grp.kleur};"></span>
              <span>📂 Groepsmap: ${grp.naam}</span>
              <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--amber); font-weight: 800;">(${grp.totalPoints} PT • ${grp.leden.length} spelers)</span>
            </div>
            <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem;">
              📷🎬 ${allGrpPhotos.length} bestand(en) ingezonden • <strong style="color: var(--accent);">${locsWithUploads.size} / 6 locaties</strong> voorzien van bewijs
            </div>
          </div>

          <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
            <button type="button" class="gm-chip-btn reward-best-group-btn" style="background: rgba(245,158,11,0.18); border-color: var(--amber); color: #fde047; font-size: 0.74rem;">
              🏆 +100 PT Beste Materiaal (Heel Team)
            </button>
          </div>
        </div>

        <div class="gm-group-folder-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0.8rem;">
          <!-- Wordt hieronder gevuld met foto's en video's van dit team -->
        </div>
      `;

      // Event: Eindbonus Beste Materiaal voor heel het team
      box.querySelector(".reward-best-group-btn").addEventListener("click", async () => {
        await ScoreService.addGroupBonusPoints(
          grp.id,
          100,
          "Eindbonus: Beste bewijsmateriaal van de avond"
        );
        showToast(`🏆 +100 PT toegekend aan heel ${grp.naam} voor Beste Materiaal!`);
      });

      const gridEl = box.querySelector(".gm-group-folder-grid");

      if (filteredPhotos.length === 0) {
        gridEl.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 1.25rem; background: rgba(0,0,0,0.3); border: 1px dashed #334155; border-radius: 6px; color: var(--text-muted); font-family: var(--font-mono); font-size: 0.74rem;">
            [ Nog geen ${locFilter !== "all" ? "bewijs voor deze locatie" : "foto's of video's"} ingezonden door ${grp.naam} ]
          </div>
        `;
      } else {
        filteredPhotos.forEach((ph) => {
          const card = document.createElement("div");
          const reviewedLabel = reviewedMap[ph.eventId];
          card.className = `gm-upload-card ${reviewedLabel ? "is-reviewed" : ""}`;

          const timeStr = ph.ts
            ? new Date(ph.ts).toLocaleTimeString("nl-BE", {
                hour: "2-digit",
                minute: "2-digit"
              })
            : "";

          const isVid =
            ph.mediaType === "video" ||
            (ph.photoUrl &&
              (ph.photoUrl.startsWith("data:video/") ||
                /\.(mp4|mov|webm)(\?|$)/i.test(ph.photoUrl)));

          const mediaHtml = isVid
            ? `<video src="${ph.photoUrl}" class="gm-upload-media" controls playsinline preload="metadata"></video>`
            : `<img src="${ph.photoUrl}" class="gm-upload-media" alt="Bewijs van ${ph.playerName}" title="Klik om op volledig scherm te bekijken" />`;

          const statusPill = reviewedLabel
            ? `<span style="background:rgba(16,185,129,0.2); border:1px solid #10b981; color:#6ee7b7; font-family:var(--font-mono); font-size:0.64rem; font-weight:800; padding:0.12rem 0.42rem; border-radius:4px;">${reviewedLabel}</span>`
            : `<span style="background:rgba(245,158,11,0.2); border:1px solid #f59e0b; color:#fde047; font-family:var(--font-mono); font-size:0.64rem; font-weight:800; padding:0.12rem 0.42rem; border-radius:4px;">🔔 NOG BEOORDELEN</span>`;

          const preset = getTaskPresetInfo(ph.locationId, ph.locationName, ph.caption);
          const curGrpStep = grp.revealedStepCount || 1;
          const canUnlockNext = curGrpStep < 6;
          const isAtStep6 = curGrpStep >= 6;

          card.innerHTML = `
            <div>
              ${mediaHtml}
              <div style="padding: 0.65rem 0.75rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.35rem; margin-bottom:0.25rem;">
                  <span style="font-family:var(--font-mono); font-size:0.72rem; color:var(--amber); font-weight:700;">
                    📍 ${ph.locationName || "Locatie"}
                  </span>
                  ${statusPill}
                </div>
                <div style="font-family:var(--font-mono); font-size:0.68rem; color:var(--text-muted); margin-bottom:0.25rem;">
                  Door ${ph.playerName} • ${timeStr}
                </div>
                <div style="font-size:0.78rem; color:#fff; font-weight:600;">
                  ${ph.caption || "Geen opmerking"}
                </div>
              </div>
            </div>

            <!-- Beoordeling & Melding Zendpaneel -->
            <div style="padding: 0.65rem 0.75rem; border-top: 1px solid #1e293b; background: rgba(15,23,42,0.85); display:flex; flex-direction:column; gap:0.45rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; font-family:var(--font-mono); font-size:0.68rem; color:#94a3b8; font-weight:800;">
                <span>🎁 LEVER PUNTEN IN (${preset.shortName})</span>
                <button type="button" class="text-btn folder-delete-btn" style="font-size:0.66rem; color:var(--danger); text-decoration:underline;">Wis</button>
              </div>
              <div style="display:flex; gap:0.35rem; align-items:center; flex-wrap:wrap;">
                <input type="number" class="admin-input folder-pts-input" value="${preset.points}" style="width:62px; margin-bottom:0; padding:0.35rem 0.4rem; font-weight:800; text-align:center; font-size:0.85rem;" />
                <button type="button" class="gm-btn gm-btn-primary folder-deliver-pts-btn" style="background:#10b981; border-color:#10b981; color:#05080d; font-weight:900; font-size:0.74rem; padding:0.42rem 0.7rem; flex:1; min-width:135px;">
                  🎁 Lever de punten in (+${preset.points} PT)
                </button>
                ${
                  canUnlockNext
                    ? `<button type="button" class="gm-btn folder-deliver-unlock-btn" style="background:rgba(56,189,248,0.2); border-color:#38bdf8; color:#7dd3fc; font-weight:800; font-size:0.7rem; padding:0.42rem 0.6rem;" title="Ken punten toe én ontgrendel direct de volgende locatie">🔓 Lever In + Volgende Locatie</button>`
                    : ""
                }
                ${
                  isAtStep6
                    ? `<button type="button" class="gm-btn folder-deliver-recall-btn" style="background:rgba(245,158,11,0.25); border-color:#f59e0b; color:#fde047; font-weight:800; font-size:0.7rem; padding:0.42rem 0.6rem;" title="Ken punten toe én roep team terug naar HQ">🏁 Lever In + Recall HQ</button>`
                    : ""
                }
              </div>
              <div style="font-size:0.67rem; color:#94a3b8;">
                Melding: <span class="folder-deliver-preview" style="color:#cbd5e1; font-family:var(--font-mono); font-weight:700;">"${preset.notification}"</span>
              </div>
            </div>
          `;

          const imgEl = card.querySelector("img.gm-upload-media");
          if (imgEl) {
            imgEl.addEventListener("click", () => {
              ScoreService.openPhotoLightbox(
                ph.photoUrl,
                `${grp.naam} (${ph.playerName}) • 📍 ${ph.locationName || ""}`,
                ph.caption || ""
              );
            });
          }

          const ptsInput = card.querySelector(".folder-pts-input");
          const deliverBtn = card.querySelector(".folder-deliver-pts-btn");
          const previewSpan = card.querySelector(".folder-deliver-preview");
          const unlockBtn = card.querySelector(".folder-deliver-unlock-btn");
          const recallBtn = card.querySelector(".folder-deliver-recall-btn");

          const getDeliverData = () => {
            const pVal = Number(ptsInput ? ptsInput.value : preset.points) || preset.points;
            const notif = `OPDRACHT SUCCESVOL: +${pVal} PUNTEN VOOR ${preset.shortName}`;
            return { points: pVal, notif };
          };

          if (ptsInput && deliverBtn && previewSpan) {
            ptsInput.addEventListener("input", () => {
              const d = getDeliverData();
              deliverBtn.textContent = `🎁 Lever de punten in (+${d.points} PT)`;
              previewSpan.textContent = `"${d.notif}"`;
            });
          }

          if (deliverBtn) {
            deliverBtn.addEventListener("click", async () => {
              deliverBtn.disabled = true;
              const d = getDeliverData();
              await ScoreService.awardSubmissionPoints({
                groupId: grp.id,
                playerId: ph.playerId,
                points: d.points,
                taskName: preset.shortName,
                notificationText: d.notif,
                eventId: ph.eventId
              });
              markUploadReviewed(ph.eventId, `✓ +${d.points} PT (${preset.shortName})`);
              renderGroupFolders(ScoreService.getState());
              renderUploadsStream(ScoreService.getState());
              renderKPIs(ScoreService.getState());
              showToast(`✓ +${d.points} PT toegekend aan ${grp.naam} en melding verzonden!`);
            });
          }

          if (unlockBtn) {
            unlockBtn.addEventListener("click", async () => {
              unlockBtn.disabled = true;
              const d = getDeliverData();
              await ScoreService.awardSubmissionPoints({
                groupId: grp.id,
                playerId: ph.playerId,
                points: d.points,
                taskName: preset.shortName,
                notificationText: d.notif,
                eventId: ph.eventId
              });
              await ScoreService.revealNextLocationForGroup(grp.id);
              markUploadReviewed(ph.eventId, `✓ +${d.points} PT & Ontgrendeld`);
              renderGroupFolders(ScoreService.getState());
              renderUploadsStream(ScoreService.getState());
              renderKPIs(ScoreService.getState());
              showToast(`✓ +${d.points} PT toegekend én volgende locatie ontgrendeld voor ${grp.naam}!`);
            });
          }

          if (recallBtn) {
            recallBtn.addEventListener("click", async () => {
              recallBtn.disabled = true;
              const d = getDeliverData();
              await ScoreService.awardSubmissionPoints({
                groupId: grp.id,
                playerId: ph.playerId,
                points: d.points,
                taskName: preset.shortName,
                notificationText: d.notif,
                eventId: ph.eventId
              });
              await ScoreService.recallGroupToHQ(grp.id);
              markUploadReviewed(ph.eventId, `✓ +${d.points} PT & Finale Recall`);
              renderGroupFolders(ScoreService.getState());
              renderUploadsStream(ScoreService.getState());
              renderKPIs(ScoreService.getState());
              showToast(`✓ +${d.points} PT toegekend én finale recall verzonden naar ${grp.naam}!`);
            });
          }

          card.querySelector(".folder-delete-btn").addEventListener("click", async () => {
            if (window.confirm(`Dit bestand van ${ph.playerName} verwijderen?`)) {
              await ScoreService.deletePlayerPhoto(ph.eventId);
              showToast("Upload verwijderd.");
            }
          });

          gridEl.appendChild(card);
        });
      }

      groupFoldersContainer.appendChild(box);
    });
  }

  // 7B. Render Inkomend Bewijsmateriaal Stream (Foto's & Video's chronologisch)
  function renderUploadsStream(state) {
    if (!uploadsStream) return;
    const allPhotos = state.allPhotos || [];
    const grpFilter = filterGroupSelect ? filterGroupSelect.value : "all";
    const locFilter = filterLocSelect ? filterLocSelect.value : "all";
    const reviewedMap = getReviewedMap();

    const filtered = allPhotos.filter((ph) => {
      if (grpFilter !== "all" && ph.groupId !== grpFilter) return false;
      if (locFilter !== "all" && ph.locationId !== locFilter) return false;
      return true;
    });

    if (filtered.length === 0) {
      uploadsStream.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted); font-family: var(--font-mono); font-size: 0.8rem;">
          [ NOG GEEN FOTO'S OF VIDEO'S BINNENGEKOMEN VOOR DEZE FILTER ]
        </div>
      `;
      return;
    }

    uploadsStream.innerHTML = "";
    filtered.forEach((ph) => {
      const card = document.createElement("div");
      const reviewedLabel = reviewedMap[ph.eventId];
      card.className = `gm-upload-card ${reviewedLabel ? "is-reviewed" : ""}`;

      const timeStr = ph.ts
        ? new Date(ph.ts).toLocaleTimeString("nl-BE", {
            hour: "2-digit",
            minute: "2-digit"
          })
        : "";

      const isVid =
        ph.mediaType === "video" ||
        (ph.photoUrl &&
          (ph.photoUrl.startsWith("data:video/") ||
            /\.(mp4|mov|webm)(\?|$)/i.test(ph.photoUrl)));

      const mediaHtml = isVid
        ? `<video src="${ph.photoUrl}" class="gm-upload-media" controls playsinline preload="metadata"></video>`
        : `<img src="${ph.photoUrl}" class="gm-upload-media" alt="Bewijs van ${ph.playerName}" title="Klik om op volledig scherm te bekijken" />`;

      const statusPill = reviewedLabel
        ? `<span style="background:rgba(16,185,129,0.2); border:1px solid #10b981; color:#6ee7b7; font-family:var(--font-mono); font-size:0.65rem; font-weight:800; padding:0.12rem 0.45rem; border-radius:4px;">${reviewedLabel}</span>`
        : `<span style="background:rgba(245,158,11,0.2); border:1px solid #f59e0b; color:#fde047; font-family:var(--font-mono); font-size:0.65rem; font-weight:800; padding:0.12rem 0.45rem; border-radius:4px;">🔔 NOG BEOORDELEN</span>`;

      const preset = getTaskPresetInfo(ph.locationId, ph.locationName, ph.caption);
      const grpObj = ph.groupId ? (state.allGroups || []).find((g) => g.id === ph.groupId) : null;
      const curStep = grpObj ? (grpObj.revealedStepCount || 1) : 1;
      const canUnlockNext = Boolean(ph.groupId && curStep < 6);
      const isAtStep6 = Boolean(ph.groupId && curStep >= 6);

      card.innerHTML = `
        <div>
          ${mediaHtml}
          <div style="padding: 0.7rem 0.8rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:0.4rem; margin-bottom:0.3rem;">
              <span style="font-family:var(--font-mono); font-size:0.74rem; font-weight:800; color:${ph.groupColor || "var(--accent)"};">
                ● ${ph.groupName || "Geen groep"} (${ph.playerName})
              </span>
              ${statusPill}
            </div>
            <div style="font-family:var(--font-mono); font-size:0.72rem; color:var(--amber); margin-bottom:0.25rem;">
              📍 ${ph.locationName || "Algemene upload"} • ${timeStr}
            </div>
            <div style="font-size:0.8rem; color:#fff; font-weight:600;">
              ${ph.caption || "Geen opmerking"}
            </div>
          </div>
        </div>

        <!-- Beoordeling & Melding Zendpaneel -->
        <div style="padding: 0.65rem 0.8rem; border-top: 1px solid #1e293b; background: rgba(15,23,42,0.85); display:flex; flex-direction:column; gap:0.45rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; font-family:var(--font-mono); font-size:0.68rem; color:#94a3b8; font-weight:800;">
            <span>🎁 LEVER PUNTEN IN (${preset.shortName})</span>
            <button type="button" class="text-btn delete-upload-btn" style="font-size:0.66rem; color:var(--danger); text-decoration:underline;">Wis</button>
          </div>
          <div style="display:flex; gap:0.35rem; align-items:center; flex-wrap:wrap;">
            <input type="number" class="admin-input stream-pts-input" value="${preset.points}" style="width:62px; margin-bottom:0; padding:0.35rem 0.4rem; font-weight:800; text-align:center; font-size:0.85rem;" />
            <button type="button" class="gm-btn gm-btn-primary stream-deliver-pts-btn" style="background:#10b981; border-color:#10b981; color:#05080d; font-weight:900; font-size:0.74rem; padding:0.42rem 0.7rem; flex:1; min-width:135px;">
              🎁 Lever de punten in (+${preset.points} PT)
            </button>
            ${
              canUnlockNext
                ? `<button type="button" class="gm-btn stream-deliver-unlock-btn" style="background:rgba(56,189,248,0.2); border-color:#38bdf8; color:#7dd3fc; font-weight:800; font-size:0.7rem; padding:0.42rem 0.6rem;" title="Ken punten toe én ontgrendel direct de volgende locatie">🔓 Lever In + Volgende Locatie</button>`
                : ""
            }
            ${
              isAtStep6
                ? `<button type="button" class="gm-btn stream-deliver-recall-btn" style="background:rgba(245,158,11,0.25); border-color:#f59e0b; color:#fde047; font-weight:800; font-size:0.7rem; padding:0.42rem 0.6rem;" title="Ken punten toe én roep team terug naar HQ">🏁 Lever In + Recall HQ</button>`
                : ""
            }
          </div>
          <div style="font-size:0.67rem; color:#94a3b8;">
            Melding: <span class="stream-deliver-preview" style="color:#cbd5e1; font-family:var(--font-mono); font-weight:700;">"${preset.notification}"</span>
          </div>
        </div>
      `;

      const imgEl = card.querySelector("img.gm-upload-media");
      if (imgEl) {
        imgEl.addEventListener("click", () => {
          ScoreService.openPhotoLightbox(
            ph.photoUrl,
            `${ph.groupName || ph.playerName} • 📍 ${ph.locationName || ""}`,
            ph.caption || ""
          );
        });
      }

      const ptsInput = card.querySelector(".stream-pts-input");
      const deliverBtn = card.querySelector(".stream-deliver-pts-btn");
      const previewSpan = card.querySelector(".stream-deliver-preview");
      const unlockBtn = card.querySelector(".stream-deliver-unlock-btn");
      const recallBtn = card.querySelector(".stream-deliver-recall-btn");

      const getDeliverData = () => {
        const pVal = Number(ptsInput ? ptsInput.value : preset.points) || preset.points;
        const notif = `OPDRACHT SUCCESVOL: +${pVal} PUNTEN VOOR ${preset.shortName}`;
        return { points: pVal, notif };
      };

      if (ptsInput && deliverBtn && previewSpan) {
        ptsInput.addEventListener("input", () => {
          const d = getDeliverData();
          deliverBtn.textContent = `🎁 Lever de punten in (+${d.points} PT)`;
          previewSpan.textContent = `"${d.notif}"`;
        });
      }

      if (deliverBtn) {
        deliverBtn.addEventListener("click", async () => {
          deliverBtn.disabled = true;
          const d = getDeliverData();
          await ScoreService.awardSubmissionPoints({
            groupId: ph.groupId,
            playerId: ph.playerId,
            points: d.points,
            taskName: preset.shortName,
            notificationText: d.notif,
            eventId: ph.eventId
          });
          markUploadReviewed(ph.eventId, `✓ +${d.points} PT (${preset.shortName})`);
          renderGroupFolders(ScoreService.getState());
          renderUploadsStream(ScoreService.getState());
          renderKPIs(ScoreService.getState());
          showToast(`✓ +${d.points} PT toegekend aan ${ph.groupName || ph.playerName} en melding verzonden!`);
        });
      }

      if (unlockBtn) {
        unlockBtn.addEventListener("click", async () => {
          unlockBtn.disabled = true;
          const d = getDeliverData();
          await ScoreService.awardSubmissionPoints({
            groupId: ph.groupId,
            playerId: ph.playerId,
            points: d.points,
            taskName: preset.shortName,
            notificationText: d.notif,
            eventId: ph.eventId
          });
          await ScoreService.revealNextLocationForGroup(ph.groupId);
          markUploadReviewed(ph.eventId, `✓ +${d.points} PT & Ontgrendeld`);
          renderGroupFolders(ScoreService.getState());
          renderUploadsStream(ScoreService.getState());
          renderKPIs(ScoreService.getState());
          showToast(`✓ +${d.points} PT toegekend én volgende locatie ontgrendeld voor ${ph.groupName || "deze groep"}!`);
        });
      }

      if (recallBtn) {
        recallBtn.addEventListener("click", async () => {
          recallBtn.disabled = true;
          const d = getDeliverData();
          await ScoreService.awardSubmissionPoints({
            groupId: ph.groupId,
            playerId: ph.playerId,
            points: d.points,
            taskName: preset.shortName,
            notificationText: d.notif,
            eventId: ph.eventId
          });
          await ScoreService.recallGroupToHQ(ph.groupId);
          markUploadReviewed(ph.eventId, `✓ +${d.points} PT & Finale Recall`);
          renderGroupFolders(ScoreService.getState());
          renderUploadsStream(ScoreService.getState());
          renderKPIs(ScoreService.getState());
          showToast(`✓ +${d.points} PT toegekend én finale recall verzonden naar ${ph.groupName || "deze groep"}!`);
        });
      }

      card.querySelector(".delete-upload-btn").addEventListener("click", async () => {
        if (window.confirm(`Dit bestand van ${ph.playerName} verwijderen?`)) {
          await ScoreService.deletePlayerPhoto(ph.eventId);
          showToast("Upload verwijderd.");
        }
      });

      uploadsStream.appendChild(card);
    });
  }

  // 8. Render Locatie-Bezetting onder de Radar-Kaart
  function renderLocationOccupancy(state) {
    if (!locationOccupancyEl) return;
    const groups = state.adminGroupsList || [];
    const locs = SPEL_CONFIG.locaties || [];

    locationOccupancyEl.innerHTML = locs
      .map((loc) => {
        const activeGroupsHere = groups.filter(
          (g) => g.currentLocation && g.currentLocation.id === loc.id && g.currentLocation.status !== "voltooid"
        );
        const doneGroupsHere = groups.filter((g) => {
          const isOpen = g.unlockedLocations && g.unlockedLocations.has(loc.id);
          const hasPhoto = (g.photos || []).some((ph) => ph.locationId === loc.id);
          return isOpen && hasPhoto;
        });

        const badges = activeGroupsHere
          .map(
            (g) =>
              `<span style="background:rgba(255,255,255,0.06); border:1px solid ${g.kleur}; color:${g.kleur}; padding:0.1rem 0.45rem; border-radius:4px; font-size:0.68rem; font-weight:700;">● ${g.naam} (${g.currentLocation.status === "bezig" ? "Nu bezig" : "Onderweg"})</span>`
          )
          .join(" ");

        return `
          <div style="background:rgba(7,10,14,0.8); border:1px solid #1e293b; border-radius:6px; padding:0.42rem 0.65rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem; font-family:var(--font-mono); font-size:0.72rem;">
            <div>
              <strong style="color:#fff;">📍 ${loc.naam}</strong>
              <span style="color:var(--text-muted); font-size:0.65rem;">(${doneGroupsHere.length}/${groups.length} klaar)</span>
            </div>
            <div style="display:flex; gap:0.3rem; flex-wrap:wrap;">
              ${badges || `<span style="color:#64748b; font-size:0.66rem;">Geen groep actief</span>`}
            </div>
          </div>
        `;
      })
      .join("");
  }

  // Top Control Events
  if (kpiCardAttendance && attendanceDrawer) {
    kpiCardAttendance.addEventListener("click", () => {
      attendanceDrawer.style.display = "block";
      attendanceDrawer.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (btnToggleAttendance && attendanceDrawer) {
    btnToggleAttendance.addEventListener("click", () => {
      const isHidden = attendanceDrawer.style.display === "none";
      attendanceDrawer.style.display = isHidden ? "block" : "none";
      if (isHidden) {
        attendanceDrawer.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  if (collapseAttendanceBtn && attendanceDrawer) {
    collapseAttendanceBtn.addEventListener("click", () => {
      const isHidden = attendanceDrawer.style.display === "none";
      attendanceDrawer.style.display = isHidden ? "block" : "none";
    });
  }

  // Zet iedereen op aanwezig (met bevestiging)
  if (enableAllPlayersBtn) {
    enableAllPlayersBtn.addEventListener("click", async () => {
      const ok = window.confirm(
        "✅ BEVESTIGING: IEDEREEN OP AANWEZIG ZETTEN\n\n" +
        "Weet je zeker dat je alle 26 veldagenten weer op AANWEZIG (actief) wilt zetten?\n\n" +
        "Iedereen kan dan weer inloggen en telt mee voor de groepsverdeling."
      );
      if (!ok) return;

      await ScoreService.setDisabledPlayers([]);
      showToast(`✓ Alle ${SPEL_CONFIG.spelers.length} spelers staan weer op AANWEZIG (actief)!`);
    });
  }

  // Verdeel aanwezigen in groepen (met bevestiging)
  if (btnRandomGroups) {
    btnRandomGroups.addEventListener("click", async () => {
      const presentPlayers = SPEL_CONFIG.spelers.filter((s) => {
        if (s.isGamemaster || s.isExternalTester) return false;
        const sInfo = latestState.playerScoresMap.get(s.id);
        return !(sInfo && sInfo.disabled);
      });
      if (presentPlayers.length === 0) {
        alert("Er zijn momenteel geen aanwezige spelers actief om in groepen te verdelen!");
        return;
      }

      const ok = window.confirm(
        `🎲 BEVESTIGING: WILLEKEURIGE GROEPSVERDELING (6 LOCATIES)\n\n` +
        `Weet je zeker dat je de ${presentPlayers.length} aanwezige spelers willekeurig wilt verdelen over de 6 groepen (4 à 5 spelers per team)?\n\n` +
        `✓ Elk van de 6 groepen start direct op een unieke locatie in Herentals!\n` +
        `⚠️ Let op: dit overschrijft eventuele eerder gemaakte groepsindelingen direct!`
      );
      if (!ok) return;

      const shuffled = [...presentPlayers];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Maximaal 6 groepen zodat elk team op 1 van de 6 unieke locaties start
      const maxLocs = (SPEL_CONFIG.locaties || []).length || 6;
      const numGroups = Math.min(maxLocs, Math.max(1, Math.min(shuffled.length, 6)));
      const defaultNames = (SPEL_CONFIG.standaardGroepen || []).map(
        (g) => g.id || g.naam
      );
      const assignments = {};
      shuffled.forEach((sp, i) => {
        assignments[sp.id] =
          defaultNames[i % numGroups] || `Groep ${(i % numGroups) + 1}`;
      });

      await ScoreService.setAllGroups(assignments);
      showToast(`✓ ${shuffled.length} spelers verdeeld op HQ (blijft verborgen op beamer tot je op 'Onthul' klikt)!`);
    });
  }

  // =========================================================================
  // MANUELE GROEPSINDELING CONTROLLER (HQ COMMANDO)
  // =========================================================================
  const btnManualGroups = document.getElementById("gm-btn-manual-groups");
  const manualGroupsModal = document.getElementById("gm-manual-groups-modal");
  const btnCloseManualGroups = document.getElementById("gm-btn-close-manual-groups");
  const btnCancelManualGroups = document.getElementById("gm-btn-cancel-manual-groups");
  const btnSaveManualGroups = document.getElementById("gm-btn-save-manual-groups");
  const btnAutoFillEven = document.getElementById("gm-btn-auto-fill-even");
  const manualGroupCountsEl = document.getElementById("gm-manual-group-counts");
  const manualPlayersListEl = document.getElementById("gm-manual-players-list");

  const GROUPS_META = (SPEL_CONFIG.standaardGroepen || []).map((g) => ({
    id: g.id || g.naam,
    naam: g.naam,
    kleur: g.kleur || "#38bdf8"
  }));

  function updateManualGroupsCounts() {
    if (!manualGroupCountsEl || !manualPlayersListEl) return;
    const selects = manualPlayersListEl.querySelectorAll(".gm-manual-group-select");
    const counts = {};
    GROUPS_META.forEach((g) => { counts[g.id] = 0; });

    selects.forEach((sel) => {
      const val = sel.value;
      if (counts[val] !== undefined) {
        counts[val]++;
      }
    });

    manualGroupCountsEl.innerHTML = GROUPS_META.map((g) => {
      const c = counts[g.id] || 0;
      const isGood = c >= 3 && c <= 6;
      const badgeStyle = isGood
        ? "background:rgba(16,185,129,0.15); border-color:#10b981; color:#6ee7b7;"
        : "background:rgba(255,255,255,0.06); border-color:rgba(255,255,255,0.15); color:#cbd5e1;";
      return `
        <span style="font-family:var(--font-mono); font-size:0.75rem; padding:0.25rem 0.6rem; border-radius:5px; border:1px solid; display:inline-flex; align-items:center; gap:0.4rem; ${badgeStyle}">
          <span style="width:9px; height:9px; border-radius:50%; background:${g.kleur};"></span>
          <strong>${g.naam}:</strong> <span>${c} spelers</span>
        </span>
      `;
    }).join("");
  }

  function openManualGroupsModal() {
    if (!manualGroupsModal || !manualPlayersListEl) return;
    manualGroupsModal.style.display = "flex";

    const state = latestState || ScoreService.getState();
    const disabledSet = (state && state.disabledSet) || new Set();

    manualPlayersListEl.innerHTML = SPEL_CONFIG.spelers
      .filter((s) => !s.isGamemaster && !s.isExternalTester)
      .map((s) => {
        const pInfo = state.playerScoresMap ? state.playerScoresMap.get(s.id) : null;
        const isDisabled = disabledSet.has(s.id);
        const curGroup = pInfo ? (pInfo.adminGroupId || pInfo.groupId || "") : "";

        const optionsHtml = GROUPS_META.map((g) => {
          const selected =
            curGroup &&
            (curGroup.toLowerCase() === g.id.toLowerCase() ||
              curGroup.toLowerCase() === g.naam.toLowerCase())
              ? "selected"
              : "";
          return `<option value="${g.id}" ${selected}>● ${g.naam}</option>`;
        }).join("");

        const statusTag = isDisabled
          ? `<span style="color:#ef4444; font-size:0.68rem; font-weight:700;">[🔴 AFWEZIG]</span>`
          : pInfo && pInfo.unlocked
          ? `<span style="color:#10b981; font-size:0.68rem; font-weight:700;">[🟢 Ingelogd]</span>`
          : `<span style="color:#f59e0b; font-size:0.68rem;">[⏳ Wacht]</span>`;

        return `
          <div style="background:rgba(15,23,42,0.9); border:1px solid var(--border-color); border-radius:8px; padding:0.65rem 0.85rem; display:flex; flex-direction:column; gap:0.35rem; ${isDisabled ? 'opacity:0.45;' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.85rem; font-weight:700; color:#fff;">#${s.dossierNr} ${s.naam}</span>
              ${statusTag}
            </div>
            <select class="admin-input gm-manual-group-select" data-player-id="${s.id}" style="margin-bottom:0; padding:0.35rem 0.5rem; font-size:0.78rem; font-family:var(--font-mono); background:#070a0e;">
              ${optionsHtml}
            </select>
          </div>
        `;
      }).join("");

    manualPlayersListEl.querySelectorAll(".gm-manual-group-select").forEach((sel) => {
      sel.addEventListener("change", updateManualGroupsCounts);
    });

    updateManualGroupsCounts();
  }

  function closeManualGroupsModal() {
    if (manualGroupsModal) manualGroupsModal.style.display = "none";
  }

  if (btnManualGroups) {
    btnManualGroups.addEventListener("click", openManualGroupsModal);
  }
  if (btnCloseManualGroups) {
    btnCloseManualGroups.addEventListener("click", closeManualGroupsModal);
  }
  if (btnCancelManualGroups) {
    btnCancelManualGroups.addEventListener("click", closeManualGroupsModal);
  }

  if (btnAutoFillEven) {
    btnAutoFillEven.addEventListener("click", () => {
      if (!manualPlayersListEl) return;
      const selects = manualPlayersListEl.querySelectorAll(".gm-manual-group-select");
      const disabledSet = (latestState && latestState.disabledSet) || new Set();
      let activeIdx = 0;
      selects.forEach((sel) => {
        const pId = sel.getAttribute("data-player-id");
        if (disabledSet.has(pId)) return;
        const targetGroup = GROUPS_META[activeIdx % GROUPS_META.length];
        sel.value = targetGroup.id;
        activeIdx++;
      });
      updateManualGroupsCounts();
      showToast("🎲 Spelers gelijkmatig verdeeld over de 6 groepen!");
    });
  }

  if (btnSaveManualGroups) {
    btnSaveManualGroups.addEventListener("click", async () => {
      if (!manualPlayersListEl) return;
      btnSaveManualGroups.disabled = true;
      btnSaveManualGroups.textContent = "Opslaan & Publiceren...";

      const selects = manualPlayersListEl.querySelectorAll(".gm-manual-group-select");
      const assignments = {};
      selects.forEach((sel) => {
        const pId = sel.getAttribute("data-player-id");
        const gId = sel.value;
        if (pId && gId) {
          assignments[pId] = gId;
        }
      });

      await ScoreService.setAllGroups(assignments);
      btnSaveManualGroups.disabled = false;
      btnSaveManualGroups.textContent = "💾 Sla Groepsindeling Op & Activeer";
      closeManualGroupsModal();
      showToast("✅ Groepsindeling succesvol opgeslagen en gesynchroniseerd naar alle schermen!");
    });
  }

  // Onthul / Verberg groepen aan iedereen (met duidelijke bevestiging!)
  if (btnToggleReveal) {
    btnToggleReveal.addEventListener("click", async () => {
      const nextMode = latestState.groupsRevealed ? "hide" : "show";
      const isShow = nextMode === "show";

      const confirmMsg = isShow
        ? "🚨 CRUCIALE BEVESTIGING: GROEPEN ONTHULLEN AAN IEDEREEN\n\n" +
          "Weet je 100% zeker dat je de groepsindeling en startroutes NU wilt tonen aan alle spelers?\n\n" +
          "• Op de schermen van alle leden verschijnt nu direct hun teamnaam, teamgenoten en startlocatie!\n" +
          "• Dit is het officiële startschot van Fase 2.\n\n" +
          "Klik op OK om te onthullen, of Annuleren om te wachten."
        : "🙈 BEVESTIGING: GROEPEN VERBERGEN\n\n" +
          "Weet je zeker dat je de groepen weer wilt VERBERGEN voor alle spelers?\n\n" +
          "Klik op OK om te verbergen, of Annuleren om te annuleren.";

      const ok = window.confirm(confirmMsg);
      if (!ok) return;

      await ScoreService.setGroupsVisibilityMode(nextMode);
      showToast(
        isShow
          ? "🚨 Groepen en routes zijn nu LIVE ZICHTBAAR voor alle spelers!"
          : "Groepen zijn weer verborgen voor spelers."
      );
    });
  }

  // Volledig Spel Resetten (met dubbele veiligheidsbevestiging!)
  if (btnResetGame) {
    btnResetGame.addEventListener("click", async () => {
      const ok = window.confirm(
        "⚠️ HOOFDKWARTIER // VOLLEDIG SPEL RESETTEN\n\n" +
        "Weet je 100% zeker dat je het hele spel wilt resetten?\n\n" +
        "• Alle scores en punten worden gewist (terug naar 0)\n" +
        "• Alle geopende locatiemappen worden weer vergrendeld\n" +
        "• Alle geüploade bewijsfoto's en -video's worden gewist\n" +
        "• Alle berichten op het Message Board worden gewist\n\n" +
        "Druk op OK om door te gaan naar de opties, of Annuleren om te stoppen."
      );
      if (!ok) return;

      const resetGroupsToo = window.confirm(
        "Wil je ook de klaargezette groepsindeling en aanwezigheid wissen?\n\n" +
        "• Klik OK = Volledige Harde Fabrieksreset (ook groepen & afwezigheid wissen)\n" +
        "• Klik Annuleren = Alleen scores & uploads wissen (groepen & aanwezigheid blijven bewaard)"
      );

      await ScoreService.resetAllScores(resetGroupsToo, resetGroupsToo);

      // Wis ook lokale browser caches van dossiers en beoordeelde bestanden
      SPEL_CONFIG.spelers.forEach((s) => {
        sessionStorage.removeItem(`dossier_unlocked_${s.id}`);
        (SPEL_CONFIG.locaties || []).forEach((l) => {
          localStorage.removeItem(`jb_loc_unlocked_${SPEL_CONFIG.cloudChannel}_${s.id}_${l.id}`);
        });
      });
      localStorage.removeItem(REVIEWED_KEY);
      localStorage.removeItem(`jb_reviewed_uploads_${SPEL_CONFIG.cloudChannel}`);

      showToast(
        resetGroupsToo
          ? "✓ Volledige fabrieksreset uitgevoerd! Alles staat weer op blanco."
          : "✓ Voortgang & uploads gereset (groepen en aanwezigheid zijn bewaard)!"
      );
    });
  }

  function updateBroadcastPlaceholder() {
    if (!broadcastInput || !broadcastTargetSelect) return;
    const rawTarget = broadcastTargetSelect.value || "all";
    if (rawTarget === "all") {
      broadcastInput.placeholder = "Typ live popup-instructie voor ALLE veldagenten...";
    } else if (rawTarget.startsWith("group:")) {
      const gId = rawTarget.slice(6);
      const grp = (latestState.allGroups || []).find((g) => g.id === gId);
      const name = grp ? grp.naam : gId;
      broadcastInput.placeholder = `Typ live popup-instructie voor team ${name}...`;
    } else if (rawTarget.startsWith("player:")) {
      const pId = rawTarget.slice(7);
      const sp =
        (SPEL_CONFIG.spelers || []).find((s) => s.id === pId) ||
        (latestState.allPlayers || []).find((x) => x.id === pId);
      const name = sp ? sp.naam : pId;
      broadcastInput.placeholder = `Typ live popup-instructie voor ${name}...`;
    } else {
      broadcastInput.placeholder = "Typ bericht (verschijnt direct als popup bij ontvanger)...";
    }
  }

  if (broadcastTargetSelect) {
    broadcastTargetSelect.addEventListener("change", updateBroadcastPlaceholder);
  }

  if (broadcastForm && broadcastInput) {
    broadcastForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const txt = broadcastInput.value.trim();
      if (!txt) return;

      const rawTarget = broadcastTargetSelect ? broadcastTargetSelect.value : "all";
      const category = "broadcast";

      let targetType = "all";
      let targetId = "";
      let targetLabel = "ALLE AGENTEN (BROADCAST)";

      if (rawTarget.startsWith("group:")) {
        targetType = "group";
        targetId = rawTarget.slice(6);
        const grp = (latestState.allGroups || []).find((g) => g.id === targetId);
        targetLabel = grp ? `Groep ${grp.naam}` : targetId;
      } else if (rawTarget.startsWith("player:")) {
        targetType = "player";
        targetId = rawTarget.slice(7);
        const p = (latestState.allPlayers || []).find((x) => x.id === targetId);
        targetLabel = p ? `Agent ${p.naam}` : targetId;
      }

      await ScoreService.postBoardMessage({
        targetType,
        targetId,
        category,
        text: txt
      });

      broadcastInput.value = "";
      updateBroadcastPlaceholder();
      showToast(`⚡ HQ Notificatie popup live verzonden naar ${targetLabel}!`);
    });
  }

  if (filterGroupSelect) {
    filterGroupSelect.addEventListener("change", () =>
      renderUploadsStream(latestState)
    );
  }
  if (filterLocSelect) {
    filterLocSelect.addEventListener("change", () => {
      renderGroupFolders(latestState);
      renderUploadsStream(latestState);
    });
  }

  function updateBroadcastGroupsOptions(state) {
    if (!broadcastGroupsOptGroup) return;
    const currentVal = broadcastTargetSelect ? broadcastTargetSelect.value : "";
    const groups = (state && (state.allGroups || state.adminGroupsList || state.groupsList)) || SPEL_CONFIG.standaardGroepen || [];
    broadcastGroupsOptGroup.innerHTML = groups
      .map((g) => `<option value="group:${g.id}">👥 ${g.naam}</option>`)
      .join("");
    if (currentVal && broadcastTargetSelect) {
      broadcastTargetSelect.value = currentVal;
    }
  }

  // 8. Einde Missie & Debriefing Beheer (Fase 3)
  const btnToggleDebrief = document.getElementById("gm-btn-toggle-debrief");
  const debriefStatusPill = document.getElementById("gm-debrief-status-pill");
  const debriefCountSub = document.getElementById("gm-debrief-count-sub");

  function renderDebriefStatus(state) {
    if (!state) return;
    const isActive = Boolean(state.debriefingActive);
    const count = state.debriefedCount || 0;
    const total = state.totalCount || 25;

    if (debriefStatusPill) {
      debriefStatusPill.textContent = isActive
        ? `🟢 DEBRIEFING VRIJGEGEVEN (${count}/${total} AFGEMELD)`
        : "DEBRIEFING INACTIEF (SPEL BEZIG)";
      debriefStatusPill.style.background = isActive ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.08)";
      debriefStatusPill.style.borderColor = isActive ? "#10b981" : "rgba(255, 255, 255, 0.15)";
      debriefStatusPill.style.color = isActive ? "#6ee7b7" : "#94a3b8";
    }

    if (debriefCountSub) {
      debriefCountSub.textContent = `Voortgang: ${count} / ${total} veldagenten afgemeld & verzegeld`;
      debriefCountSub.style.color = count >= total && total > 0 ? "var(--accent)" : "var(--amber)";
    }

    if (btnToggleDebrief) {
      btnToggleDebrief.textContent = isActive
        ? "🔒 Debriefing Stopzetten / Spel Hervatten"
        : "🚨 Activeer Einde Spel & Debriefing";
      btnToggleDebrief.style.background = isActive ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)";
      btnToggleDebrief.style.borderColor = isActive ? "#ef4444" : "var(--amber)";
      btnToggleDebrief.style.color = isActive ? "#fca5a5" : "#fde047";
    }
  }

  if (btnToggleDebrief) {
    btnToggleDebrief.addEventListener("click", async () => {
      const isCurrentlyActive = Boolean(latestState && latestState.debriefingActive);
      const confirmMsg = !isCurrentlyActive
        ? "⚠️ MISSIE BEËINDIGEN // DEBRIEFING PROTOCOL VRIJGEVEN\n\nWeet je zeker dat het spel ten einde is?\n\nHierdoor verschijnt bij alle actieve agenten op hun gsm de knop om hun dossier definitief te verzegelen en hun bedanking / eervol ontslag te zien."
        : "Weet je zeker dat je de debriefing-modus wilt DEACTIVEREN en het spel wilt hervatten?";

      if (!window.confirm(confirmMsg)) return;

      await ScoreService.setDebriefingMode(!isCurrentlyActive);
      showToast(
        !isCurrentlyActive
          ? "🚨 EINDE SPEL GESTART: Debriefing & uitlog-prompt live verstuurd naar alle agenten!"
          : "ℹ️ Debriefing stopgezet. Spelers kunnen weer gewoon navigeren."
      );
    });
  }

  // 9. Finale HQ Podium & Aankomst Registratie
  const hqArrivalContainer = document.getElementById("gm-hq-arrival-list");
  const hqArrivalCounter = document.getElementById("gm-hq-arrival-counter");
  const ARRIVAL_POINTS_TABLE = [100, 75, 50, 30, 15, 10];
  const PODIUM_MEDALS = ["🥇 1e PLEK", "🥈 2e PLEK", "🥉 3e PLEK", "4e PLEK", "5e PLEK", "6e PLEK"];

  function renderHqArrivals(state) {
    if (!hqArrivalContainer) return;
    const groups = state.adminGroupsList || state.groupsList || [];
    const arrivalsMap = state.hqArrivalsMap || new Map();
    const arrivalsList = state.hqArrivals || [];

    if (hqArrivalCounter) {
      hqArrivalCounter.textContent = `${arrivalsList.length} / ${groups.length || 6} Teams Binnen`;
    }

    if (groups.length === 0) {
      hqArrivalContainer.innerHTML = `<span style="color:#64748b; font-size:0.75rem;">Nog geen groepen geactiveerd.</span>`;
      return;
    }

    const nextPlace = arrivalsList.length + 1;
    const nextPoints = nextPlace <= ARRIVAL_POINTS_TABLE.length ? ARRIVAL_POINTS_TABLE[nextPlace - 1] : 10;
    const nextMedal = nextPlace <= PODIUM_MEDALS.length ? PODIUM_MEDALS[nextPlace - 1] : `${nextPlace}e Plek`;

    hqArrivalContainer.innerHTML = groups
      .map((g) => {
        const arr = arrivalsMap.get(g.id);
        if (arr) {
          const medal =
            arr.place <= PODIUM_MEDALS.length
              ? PODIUM_MEDALS[arr.place - 1]
              : `${arr.place}e Plek`;
          const timeStr = arr.ts
            ? new Date(arr.ts).toLocaleTimeString("nl-BE", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
              })
            : "";
          return `
            <div style="background: rgba(16, 185, 129, 0.12); border: 1.5px solid #10b981; border-radius: 8px; padding: 0.55rem 0.85rem; display: flex; align-items: center; gap: 0.65rem; font-family: var(--font-mono); font-size: 0.76rem;">
              <span style="font-size: 1.25rem;">🏁</span>
              <div>
                <strong style="color: #6ee7b7; font-size: 0.84rem;">${escapeHtml(g.naam)}</strong>
                <div style="color: #cbd5e1; font-size: 0.7rem; margin-top: 0.1rem;">
                  ${medal} (+${arr.points} PT) om ${timeStr} ✓
                </div>
              </div>
            </div>
          `;
        }

        return `
          <button
            type="button"
            class="btn-gm-arrival"
            data-group-id="${g.id}"
            data-group-name="${escapeHtml(g.naam)}"
            data-place="${nextPlace}"
            data-points="${nextPoints}"
            style="background: rgba(14, 20, 28, 0.95); border: 1.5px solid ${g.kleur || "#38bdf8"}; border-radius: 8px; padding: 0.55rem 0.85rem; display: flex; align-items: center; gap: 0.55rem; cursor: pointer; color: #fff; font-family: var(--font-mono); text-align: left; transition: all 0.15s ease;"
          >
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${g.kleur || "#38bdf8"};"></span>
            <div>
              <div style="font-weight: 800; font-size: 0.82rem; color: #fff;">${escapeHtml(g.naam)} Aangekomen</div>
              <div style="font-size: 0.68rem; color: #f59e0b; margin-top: 0.1rem;">
                Registreer ${nextMedal} (+${nextPoints} PT) &rarr;
              </div>
            </div>
          </button>
        `;
      })
      .join("");

    hqArrivalContainer.querySelectorAll(".btn-gm-arrival").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const gid = btn.getAttribute("data-group-id");
        const gname = btn.getAttribute("data-group-name");
        const place = Number(btn.getAttribute("data-place")) || 1;
        const points = Number(btn.getAttribute("data-points")) || 10;

        if (
          window.confirm(
            `Bevestig dat ${gname} zojuist is binnengekomen op HQ?\nDit kent +${points} aankomstpunten toe (Plek #${place}) en stuurt een live broadcast!`
          )
        ) {
          btn.disabled = true;
          await ScoreService.registerHqArrival({ groupId: gid, place, points });
          showToast(`🏁 ${gname} geregistreerd als aankomst #${place} (+${points} PT)!`);
        }
      });
    });
  }

  // Start Realtime Synchronisatie & GPS Radar Tracking
  ScoreService.startRealtimeSync();
  updateBroadcastPlaceholder();
  ScoreService.subscribe((state) => {
    latestState = state;
    renderKPIs(state);
    renderAttendanceDrawer(state);
    renderGroupsMatrix(state);
    renderGroupFolders(state);
    renderUploadsStream(state);
    renderLocationOccupancy(state);
    renderGmRadarAgentMarkers(latestGpsPositionsList);
    updateBroadcastGroupsOptions(state);
    renderHqArrivals(state);
    renderDebriefStatus(state);
  });

  if (typeof ScoreService.onGpsPositionChange === "function") {
    ScoreService.onGpsPositionChange((positions) => {
      renderGmRadarAgentMarkers(positions);
      if (latestState) {
        renderAttendanceDrawer(latestState);
      }
    });
  }
});
