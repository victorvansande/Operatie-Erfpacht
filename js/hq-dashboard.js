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

  function renderGmRadarAgentMarkers(positions) {
    if (!mapInstance || typeof L === "undefined") return;
    if (!Array.isArray(positions)) return;

    positions.forEach((pos) => {
      if (!pos || typeof pos.lat !== "number" || typeof pos.lng !== "number") return;
      const isVicce = pos.playerId === "vicce" || pos.isGamemaster;
      const color = isVicce ? "#f59e0b" : (pos.groupColor || "#38bdf8");
      const coreLabel = isVicce ? "★" : (pos.dossierNr ? `#${pos.dossierNr}` : "●");
      const tagLabel = isVicce ? "★ VICCE (HQ)" : (pos.playerName || `Agent #${pos.dossierNr || ""}`);

      const icon = L.divIcon({
        className: "live-agent-pin-wrap",
        html: `
          <div class="live-agent-pin ${isVicce ? 'is-hq' : ''}" style="--agent-color: ${color};">
            <div class="live-agent-pin-ring"></div>
            <div class="live-agent-pin-core">${coreLabel}</div>
            <div class="live-agent-pin-tag">${tagLabel}</div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const popup = `
        <div style="font-family: var(--font-mono, monospace); font-size: 0.8rem; color: #e2e8f0; min-width: 140px;">
          <strong style="color: ${color}; font-size: 0.9rem;">${isVicce ? "★ VICCE (HQ COMMANDO)" : (pos.playerName || "Veldagent")}</strong>
          <div style="color: #94a3b8; font-size: 0.75rem; margin-top: 2px;">
            ${isVicce ? "Gamemaster HQ" : (pos.groupName ? `Team: <strong>${pos.groupName}</strong>` : "Individueel op pad")}
          </div>
          <div style="color: #64748b; font-size: 0.7rem; margin-top: 4px;">
            GPS Nauwkeurigheid: ±${pos.accuracy || 8}m<br>
            Laatste update: ${new Date(pos.ts || Date.now()).toLocaleTimeString("nl-BE")}
          </div>
        </div>
      `;

      if (gmAgentMarkers.has(pos.playerId)) {
        const m = gmAgentMarkers.get(pos.playerId);
        m.setLatLng([pos.lat, pos.lng]);
        m.setIcon(icon);
        m.setPopupContent(popup);
      } else {
        const m = L.marker([pos.lat, pos.lng], { icon, zIndexOffset: isVicce ? 1000 : 500 })
          .addTo(mapInstance)
          .bindPopup(popup);
        gmAgentMarkers.set(pos.playerId, m);
      }
    });
  }

  // 4. Render KPI's & Top Controls
  function renderKPIs(state) {
    const groups = state.adminGroupsList || [];
    const reviewed = getReviewedMap();
    const unreviewedCount = (state.allPhotos || []).filter(
      (ph) => !reviewed[ph.eventId]
    ).length;

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
    const activeCount = all.filter((p) => !p.disabled && !p.isGamemaster && !p.isExternalTester && p.id !== "vicce" && p.id !== "lander").length;
    const inactiveCount = all.filter((p) => p.disabled && !p.isGamemaster && !p.isExternalTester && p.id !== "vicce" && p.id !== "lander").length;

    if (attendanceCountsBadge) {
      attendanceCountsBadge.innerHTML = `
        <span style="color: var(--accent); font-weight: 700;">🟢 ${activeCount} Veldagenten Aanwezig</span>
        &nbsp;|&nbsp;
        <span style="color: ${inactiveCount > 0 ? "var(--danger)" : "var(--text-muted)"}; font-weight: 700;">🔴 ${inactiveCount} Afwezig</span>
        &nbsp;|&nbsp;
        <span style="color: #f59e0b; font-weight: 700;">★ 1 Gamemaster HQ</span>
      `;
    }

    const liveGpsPositions = ScoreService.getLiveAgentPositions ? ScoreService.getLiveAgentPositions() : [];

    all.forEach((p) => {
      const chip = document.createElement("div");
      const isTester = p.isExternalTester || p.id === "lander";
      const isStaff = p.isGamemaster || p.id === "vicce";

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
        <div style="display: flex; gap: 0.4rem; margin-top: 0.2rem; flex-wrap: wrap;">
          <button type="button" class="btn-toggle-active" style="flex: 1; min-width: 95px; padding: 0.32rem 0.5rem; font-size: 0.72rem; font-weight: 700; border-radius: 5px; cursor: pointer; border: 1px solid ${isOff ? "var(--accent)" : "rgba(239, 68, 68, 0.6)"}; background: ${isOff ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.18)"}; color: ${isOff ? "#6ee7b7" : "#fca5a5"}; transition: all 0.15s ease;">
            ${isOff ? "✅ Zet Aanwezig" : "❌ Zet Inactief"}
          </button>
          <button type="button" class="btn-msg-p" title="Stuur directe HQ-notificatie popup naar ${p.naam}" style="padding: 0.32rem 0.5rem; font-size: 0.68rem; font-weight: 700; border-radius: 5px; cursor: pointer; border: 1px solid #38bdf8; background: rgba(56, 189, 248, 0.15); color: #7dd3fc; transition: all 0.15s ease;">
            💬 Bericht
          </button>
          <button type="button" class="btn-pts-p" title="Ken bonuspunten toe aan ${p.naam}" style="padding: 0.32rem 0.5rem; font-size: 0.68rem; font-weight: 700; border-radius: 5px; cursor: pointer; border: 1px solid var(--amber); background: rgba(245, 158, 11, 0.15); color: var(--amber); transition: all 0.15s ease;">
            ⭐ +PT
          </button>
          ${
            !isOff && !isUnlocked
              ? `<button type="button" class="force-unlock-p-btn" title="Ontgrendel speler direct handmatig" style="padding: 0.32rem 0.5rem; font-size: 0.68rem; font-weight: 700; border-radius: 5px; cursor: pointer; border: 1px solid var(--accent); background: rgba(16, 185, 129, 0.2); color: #6ee7b7;">⚡ Login</button>`
              : ""
          }
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
          }
          if (broadcastInput) {
            broadcastInput.placeholder = `Typ live popup-instructie voor ${p.naam}...`;
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
              <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                <strong style="color: var(--text-muted);">${loc.stepNr}.</strong>
                <strong>${loc.naam}</strong>
              </div>
              <div style="display:flex; align-items:center; gap:0.3rem; flex-shrink:0;">
                <span style="font-size:0.66rem;">${statusLabel}</span>
                ${
                  !isOpen
                    ? `<button type="button" class="gm-step-unlock-btn" data-unlock-loc="${loc.id}" title="Open dit mapje op afstand voor ${grp.naam}">Open</button>`
                    : ""
                }
              </div>
            </div>
          `;
        })
        .join("");

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
            <div class="gm-group-total-pts">${grp.totalPoints} PT</div>
            <div style="font-size:0.68rem; color:var(--text-muted);">
              Gem: ${avgPts} pt • 📷 ${(grp.photos || []).length}
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

        <!-- De 6 locaties in hun specifieke groepsvolgorde -->
        <div class="gm-route-steps">
          ${stepsHtml}
        </div>

        <!-- 1-Klik Team Bonuspunten & Strafpunten -->
        <div class="gm-bonus-bar">
          <div style="display:flex; justify-content:space-between; align-items:center; font-family:var(--font-mono); font-size:0.68rem; color:var(--text-muted);">
            <span>⚡ 1-KLIK PUNTEN VOOR HEEL ${grp.naam.toUpperCase()}:</span>
          </div>
          <div class="gm-bonus-btns">
            <button type="button" class="gm-chip-btn" data-team-bonus="25" data-reason="Goed bewijsmateriaal">+25 Bewijs OK</button>
            <button type="button" class="gm-chip-btn chip-amber" data-team-bonus="50" data-reason="Bonusopdracht volbracht">⭐ +50 Bonus</button>
            <button type="button" class="gm-chip-btn" data-team-bonus="100" data-reason="Beste materiaal / Topuitvoering">🏆 +100 Topmateriaal</button>
            <button type="button" class="gm-chip-btn chip-danger" data-team-bonus="-25" data-reason="Strafpunten HQ">-25 Straf</button>
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
              <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--amber); font-weight: 800;">(${grp.totalPoints} PT)</span>
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

            <div style="padding: 0.5rem 0.75rem; border-top: 1px solid #1e293b; background: rgba(15,23,42,0.6); display:flex; flex-wrap:wrap; gap:0.3rem; justify-content:space-between; align-items:center;">
              <div style="display:flex; gap:0.25rem; flex-wrap:wrap;">
                <button type="button" class="gm-chip-btn folder-reward-btn" data-pts="25" data-label="✓ +25 PT (OK)">+25 Team</button>
                <button type="button" class="gm-chip-btn chip-amber folder-reward-btn" data-pts="50" data-label="✓ +50 PT (Bonus)">⭐ +50 Bonus</button>
                <button type="button" class="gm-chip-btn folder-reward-btn" data-pts="100" data-label="✓ +100 PT (Top)">🏆 +100 Top</button>
              </div>
              <button type="button" class="text-btn folder-delete-btn" style="font-size:0.66rem; color:var(--danger);">Wis</button>
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

          card.querySelectorAll(".folder-reward-btn").forEach((btn) => {
            btn.addEventListener("click", async () => {
              const pts = Number(btn.getAttribute("data-pts"));
              const lbl = btn.getAttribute("data-label");
              btn.disabled = true;

              await ScoreService.addGroupBonusPoints(
                grp.id,
                pts,
                `Bewijs ${ph.locationName || ""} goedgekeurd`
              );

              markUploadReviewed(ph.eventId, lbl);
              renderGroupFolders(ScoreService.getState());
              renderUploadsStream(ScoreService.getState());
              renderKPIs(ScoreService.getState());
              showToast(
                `+${pts} PT toegekend aan heel ${grp.naam} voor ${ph.locationName || "upload"}!`
              );
            });
          });

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

        <div style="padding: 0.55rem 0.8rem; border-top: 1px solid #1e293b; background: rgba(15,23,42,0.6); display:flex; flex-wrap:wrap; gap:0.35rem; justify-content:space-between; align-items:center;">
          <div style="display:flex; gap:0.3rem; flex-wrap:wrap;">
            <button type="button" class="gm-chip-btn reward-upload-btn" data-pts="25" data-label="✓ +25 PT (OK)">✅ +25 Team</button>
            <button type="button" class="gm-chip-btn chip-amber reward-upload-btn" data-pts="50" data-label="✓ +50 PT (Bonus)">⭐ +50 Bonus</button>
            <button type="button" class="gm-chip-btn reward-upload-btn" data-pts="100" data-label="✓ +100 PT (Top)">🏆 +100 Top</button>
          </div>
          <button type="button" class="text-btn delete-upload-btn" style="font-size:0.68rem; color:var(--danger);">Wis</button>
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

      card.querySelectorAll(".reward-upload-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const pts = Number(btn.getAttribute("data-pts"));
          const lbl = btn.getAttribute("data-label");
          btn.disabled = true;

          if (ph.groupId) {
            await ScoreService.addGroupBonusPoints(
              ph.groupId,
              pts,
              `Bewijs ${ph.locationName || ""} goedgekeurd`
            );
          } else {
            await ScoreService.addBonusPoints(
              ph.playerId,
              pts,
              `Bewijs ${ph.locationName || ""} goedgekeurd`
            );
          }

          markUploadReviewed(ph.eventId, lbl);
          renderUploadsStream(ScoreService.getState());
          renderKPIs(ScoreService.getState());
          showToast(
            `+${pts} PT toegekend aan ${ph.groupName || ph.playerName} voor ${ph.locationName || "upload"}!`
          );
        });
      });

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
      showToast("✓ Alle 26 spelers staan weer op AANWEZIG (actief)!");
    });
  }

  // Verdeel aanwezigen in groepen (met bevestiging)
  if (btnRandomGroups) {
    btnRandomGroups.addEventListener("click", async () => {
      const presentPlayers = SPEL_CONFIG.spelers.filter((s) => {
        if (s.id === "vicce" || s.isGamemaster) return false;
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
      localStorage.removeItem(`jb_reviewed_uploads_${SPEL_CONFIG.cloudChannel}`);

      showToast(
        resetGroupsToo
          ? "✓ Volledige fabrieksreset uitgevoerd! Alles staat weer op blanco."
          : "✓ Voortgang & uploads gereset (groepen en aanwezigheid zijn bewaard)!"
      );
    });
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
    const groups = state.allGroups || [];
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

  // Start Realtime Synchronisatie & GPS Radar Tracking
  ScoreService.startRealtimeSync();
  ScoreService.subscribe((state) => {
    latestState = state;
    renderKPIs(state);
    renderAttendanceDrawer(state);
    renderGroupsMatrix(state);
    renderGroupFolders(state);
    renderUploadsStream(state);
    renderLocationOccupancy(state);
    updateBroadcastGroupsOptions(state);
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
