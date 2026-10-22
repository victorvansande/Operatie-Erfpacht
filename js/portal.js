document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("players-grid");
  const searchInput = document.getElementById("search-input");
  const modal = document.getElementById("auth-modal");
  const modalTitle = document.getElementById("modal-player-name");
  const modalTag = document.getElementById("modal-dossier-tag");
  const codeForm = document.getElementById("code-form");
  const codeInput = document.getElementById("code-input");
  const unlockSubmitBtn = document.getElementById("unlock-submit-btn");
  const errorMsg = document.getElementById("error-msg");
  const cancelBtn = document.getElementById("cancel-btn");

  // Scorebord elementen
  const scoreboardList = document.getElementById("scoreboard-list");
  const nextRewardPill = document.getElementById("next-reward-pill");
  const crackedCountPill = document.getElementById("cracked-count-pill");
  const toggleAllScoresBtn = document.getElementById("toggle-all-scores-btn");

  // Groepen overzicht elementen
  const groupsPanel = document.getElementById("groups-panel");
  const groupsGrid = document.getElementById("groups-grid");
  const groupsCountPill = document.getElementById("groups-count-pill");

  // Herentals Radar / Locaties elementen
  const locOverviewList = document.getElementById("loc-overview-list");

  // Leiding Paneel elementen
  const openAdminBtn = document.getElementById("open-admin-btn");
  const adminModal = document.getElementById("admin-modal");
  const adminLoginStep = document.getElementById("admin-login-step");
  const adminControlsStep = document.getElementById("admin-controls-step");
  const adminLoginForm = document.getElementById("admin-login-form");
  const adminCodeInput = document.getElementById("admin-code-input");
  const adminErrorMsg = document.getElementById("admin-error-msg");
  const adminCancelBtn = document.getElementById("admin-cancel-btn");
  const adminCloseBtn = document.getElementById("admin-close-btn");
  const adminAttendanceGrid = document.getElementById("admin-attendance-grid");
  const adminAttendanceCount = document.getElementById("admin-attendance-count");
  const adminEnableAllBtn = document.getElementById("admin-enable-all-btn");
  const adminPlayerSelect = document.getElementById("admin-player-select");
  const adminCustomDelta = document.getElementById("admin-custom-delta");
  const adminApplyCustomBtn = document.getElementById("admin-apply-custom-btn");
  const adminApplyTeamBonusBtn = document.getElementById("admin-apply-team-bonus-btn");
  const adminRevokePlayerBtn = document.getElementById("admin-revoke-player-btn");
  const adminGroupsRevealStatus = document.getElementById("admin-groups-reveal-status");
  const adminGroupsPreview = document.getElementById("admin-groups-preview");
  const adminToggleRevealBtn = document.getElementById("admin-toggle-reveal-btn");
  const adminGroupSize = document.getElementById("admin-group-size");
  const adminRandomGroupsBtn = document.getElementById("admin-random-groups-btn");
  const adminGroupSelect = document.getElementById("admin-group-select");
  const adminAssignGroupBtn = document.getElementById("admin-assign-group-btn");
  const adminClearGroupsBtn = document.getElementById("admin-clear-groups-btn");
  const adminMsgForm = document.getElementById("admin-msg-form");
  const adminMsgTarget = document.getElementById("admin-msg-target");
  const adminMsgPlayersOptgroup = document.getElementById("admin-msg-players-optgroup");
  const adminMsgCategory = document.getElementById("admin-msg-category");
  const adminMsgLocation = document.getElementById("admin-msg-location");
  const adminMsgText = document.getElementById("admin-msg-text");
  const adminMsgList = document.getElementById("admin-msg-list");
  const adminPhotosCount = document.getElementById("admin-photos-count");
  const adminPhotosGrid = document.getElementById("admin-photos-grid");
  const adminResetAllBtn = document.getElementById("admin-reset-all-btn");
  const adminStatusFeedback = document.getElementById("admin-status-feedback");

  let selectedPlayer = null;
  let showAllScores = false;
  let latestScoreState = ScoreService.getState();

  function isDeviceUnlocked(playerId) {
    if (playerId === "vicce") return true;
    const isLocal =
      sessionStorage.getItem(`dossier_unlocked_${playerId}`) === "true" ||
      localStorage.getItem(`dossier_unlocked_${playerId}`) === "true";
    if (isLocal) return true;
    const pInfo =
      latestScoreState &&
      latestScoreState.playerScoresMap &&
      latestScoreState.playerScoresMap.get(playerId);
    return Boolean(pInfo && pInfo.unlocked);
  }

  function formatTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString("nl-BE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  // =========================================================================
  // OPERATIEGEBIED HERENTALS // KAART & PULSERENDE LOCATIE-DOTS
  // =========================================================================
  function initHerentalsRadarMap() {
    const locaties = SPEL_CONFIG.locaties || [];
    const hq = SPEL_CONFIG.headquarters || null;
    if (!locOverviewList) return;

    let map = null;
    const markersById = new Map();

    if (typeof L !== "undefined" && document.getElementById("herentals-map")) {
      map = L.map("herentals-map", {
        center: [51.1782, 4.8355],
        zoom: 15,
        zoomControl: true
      });

      // Gebruik tile.openstreetmap.de (staat zowel file:// als GitHub Pages toe zonder 403 block of API key!)
      const tileLayer = L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19
      }).addTo(map);

      // Fallback mocht een tegel ooit haperen
      let switchedFallback = false;
      tileLayer.on("tileerror", () => {
        if (!switchedFallback) {
          switchedFallback = true;
          tileLayer.setUrl("https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png");
        }
      });
    }

    locOverviewList.innerHTML = "";
    const bounds = [];

    // 1) HEADQUARTERS (Rood HQ-icoon dat zich onderscheidt van de groene pulserende dots)
    if (hq) {
      const hqCard = document.createElement("button");
      hqCard.type = "button";
      hqCard.className = "loc-overview-card hq-card";
      hqCard.innerHTML = `
        <div class="hq-pin" style="margin-top: 0.15rem; flex-shrink: 0;">
          <span class="hq-pin-ring"></span>
          <span class="hq-pin-diamond"><span class="hq-pin-label">HQ</span></span>
        </div>
        <div style="flex: 1;">
          <div class="loc-overview-name" style="color: #fca5a5;">★ ${hq.naam}</div>
          <div class="loc-overview-address">📍 ${hq.adres}</div>
          <div class="loc-overview-desc">${hq.beschrijving || ""}</div>
        </div>
      `;

      if (map && hq.lat && hq.lng) {
        bounds.push([hq.lat, hq.lng]);
        const hqIcon = L.divIcon({
          className: "",
          html: `
            <div class="hq-pin">
              <span class="hq-pin-ring"></span>
              <span class="hq-pin-diamond"><span class="hq-pin-label">HQ</span></span>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -14]
        });

        const hqGmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${hq.adres}`
        )}`;

        const hqMarker = L.marker([hq.lat, hq.lng], {
          icon: hqIcon,
          zIndexOffset: 1000
        }).addTo(map);

        hqMarker.bindPopup(`
          <div style="padding: 0.2rem;">
            <div style="font-family: var(--font-mono); font-size: 0.68rem; color: #f87171; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700;">
              ★ COMMANDOPOST // HEADQUARTERS
            </div>
            <div style="font-weight: 700; font-size: 1rem; color: #fff; margin: 0.15rem 0;">
              ${hq.naam}
            </div>
            <div style="font-family: var(--font-mono); font-size: 0.75rem; color: #fca5a5; margin-bottom: 0.25rem;">
              ${hq.adres}
            </div>
            <div style="font-size: 0.78rem; color: #94a3b8; margin-bottom: 0.5rem;">
              ${hq.beschrijving || ""}
            </div>
            <a href="${hqGmapsUrl}" target="_blank" rel="noopener" style="font-family: var(--font-mono); font-size: 0.74rem; color: #f87171; text-decoration: underline;">
              Open route in Google Maps &rarr;
            </a>
          </div>
        `);

        markersById.set(hq.id, hqMarker);
      }

      hqCard.addEventListener("click", () => {
        document
          .querySelectorAll(".loc-overview-card")
          .forEach((c) => c.classList.remove("active"));
        hqCard.classList.add("active");

        if (map && markersById.has(hq.id)) {
          const mapEl = document.getElementById("herentals-map");
          if (window.innerWidth <= 820 && mapEl) {
            mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          const m = markersById.get(hq.id);
          map.flyTo([hq.lat, hq.lng], 16, { duration: 0.6 });
          m.openPopup();
        }
      });

      locOverviewList.appendChild(hqCard);
    }

    // 2) DE 6 DOELWIT-LOCATIES (Groene pulserende dots)
    locaties.forEach((loc, idx) => {
      // Maak kaartje in de rechterkolom met pulserende dot
      const card = document.createElement("button");
      card.type = "button";
      card.className = "loc-overview-card";
      card.innerHTML = `
        <div class="radar-pin" style="margin-top: 0.2rem; flex-shrink: 0;">
          <span class="radar-pin-pulse" style="animation-delay: ${idx * 0.28}s;"></span>
          <span class="radar-pin-core"></span>
        </div>
        <div style="flex: 1;">
          <div class="loc-overview-name">${loc.naam}</div>
          <div class="loc-overview-address">📍 ${loc.adres || "2200 Herentals"}</div>
          <div class="loc-overview-desc">${loc.beschrijving || ""}</div>
        </div>
      `;

      if (map && loc.lat && loc.lng) {
        bounds.push([loc.lat, loc.lng]);
        const icon = L.divIcon({
          className: "",
          html: `
            <div class="radar-pin">
              <span class="radar-pin-pulse" style="animation-delay: ${idx * 0.28}s;"></span>
              <span class="radar-pin-core"></span>
            </div>
          `,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
          popupAnchor: [0, -10]
        });

        const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${loc.adres || loc.naam}, 2200 Herentals`
        )}`;

        const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(map);
        marker.bindPopup(`
          <div style="padding: 0.2rem;">
            <div style="font-family: var(--font-mono); font-size: 0.68rem; color: var(--accent); letter-spacing: 0.1em; text-transform: uppercase;">
              DOELWIT LOCATIE #0${idx + 1}
            </div>
            <div style="font-weight: 700; font-size: 1rem; color: #fff; margin: 0.15rem 0;">
              ${loc.naam}
            </div>
            <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--amber); margin-bottom: 0.25rem;">
              ${loc.adres || ""}
            </div>
            <div style="font-size: 0.78rem; color: #94a3b8; margin-bottom: 0.5rem;">
              ${loc.beschrijving || ""}
            </div>
            <a href="${gmapsUrl}" target="_blank" rel="noopener" style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--accent); text-decoration: underline;">
              Open route in Google Maps &rarr;
            </a>
          </div>
        `);

        markersById.set(loc.id, marker);
      }

      card.addEventListener("click", () => {
        document
          .querySelectorAll(".loc-overview-card")
          .forEach((c) => c.classList.remove("active"));
        card.classList.add("active");

        if (map && markersById.has(loc.id)) {
          const mapEl = document.getElementById("herentals-map");
          if (window.innerWidth <= 820 && mapEl) {
            mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          const m = markersById.get(loc.id);
          map.flyTo([loc.lat, loc.lng], 16, { duration: 0.6 });
          m.openPopup();
        }
      });

      locOverviewList.appendChild(card);
    });

    if (map && bounds.length > 1) {
      map.fitBounds(bounds, { padding: [32, 32] });
      setTimeout(() => map.invalidateSize(), 250);
      window.addEventListener("resize", () => map.invalidateSize());
    }
  }

  // =========================================================================
  // GROEPEN OVERZICHT (Alleen zichtbaar zodra state.groupsRevealed === true!)
  // =========================================================================
  function renderGroupsPanel(state) {
    if (!groupsPanel || !groupsGrid) return;
    if (!state.hasGroups || !state.groupsRevealed) {
      groupsPanel.style.display = "none";
      return;
    }

    groupsPanel.style.display = "block";
    groupsCountPill.textContent = `${state.groupsList.length} GROEPEN ACTIEF`;
    groupsGrid.innerHTML = "";

    state.groupsList.forEach((grp, idx) => {
      const card = document.createElement("div");
      card.className = "group-card";
      card.style.setProperty("--group-color", grp.kleur || "var(--accent)");

      const membersHtml = grp.leden
        .map(
          (lid) =>
            `<span class="group-member-chip ${lid.unlocked ? "unlocked" : ""}">
              ${lid.unlocked ? "● " : ""}${lid.naam}
            </span>`
        )
        .join("");

      const startLocHtml = grp.startLocationName
        ? `<div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted);">
             📍 Startlocatie: <strong style="color: #fff;">${grp.startLocationName}</strong>
           </div>`
        : "";

      card.innerHTML = `
        <div class="group-card-header">
          <div class="group-card-title">
            <span class="group-color-dot"></span>
            <span>#${idx + 1} ${grp.naam}</span>
          </div>
          <span class="group-card-pts">${grp.totalPoints} PT</span>
        </div>
        ${startLocHtml}
        <div class="group-members-wrap">
          ${membersHtml}
        </div>
      `;

      groupsGrid.appendChild(card);
    });
  }

  function renderScoreboard(state) {
    latestScoreState = state;

    crackedCountPill.textContent = `${state.unlockedCount} / ${state.totalCount} GEKRAAKT`;
    if (state.unlockedCount < state.totalCount) {
      nextRewardPill.textContent = `VOLGENDE PLEK (#${state.nextRank}): +${state.nextPoints} PT`;
    } else {
      nextRewardPill.textContent = `ALLE DOSSIERS GEKRAAKT!`;
    }

    const activePlayers = state.leaderboard.filter((p) => p.active);
    const rowsToShow = showAllScores
      ? state.leaderboard
      : activePlayers.slice(0, 8);

    toggleAllScoresBtn.textContent = showAllScores
      ? "Toon enkel top / actieve spelers"
      : `Toon alle ${state.totalCount} aanwezige spelers`;

    if (rowsToShow.length === 0) {
      scoreboardList.innerHTML = `
        <div style="text-align: center; padding: 1.5rem 1rem; color: var(--text-muted); font-family: var(--font-mono); font-size: 0.85rem;">
          [ NOG GEEN CODE GEKRAAKT — WIE PAKT ALS EERSTE +${state.nextPoints} PUNTEN? ]
        </div>
      `;
      return;
    }

    scoreboardList.innerHTML = "";
    rowsToShow.forEach((p, idx) => {
      const pos = idx + 1;
      const row = document.createElement("div");
      const rankClass = p.active && pos <= 3 ? `rank-${pos}` : "";
      row.className = `score-row ${rankClass}`;

      let rankLabel = `#${pos}`;
      if (p.active && pos === 1) rankLabel = "🥇 #1";
      else if (p.active && pos === 2) rankLabel = "🥈 #2";
      else if (p.active && pos === 3) rankLabel = "🥉 #3";
      else if (!p.active) rankLabel = "—";

      const details = [];
      if (p.unlocked) {
        details.push(`Code #${p.unlockRank} (${formatTime(p.unlockedAt)})`);
      } else {
        details.push("Nog vergrendeld");
      }
      if (p.bonusPoints !== 0) {
        const sign = p.bonusPoints > 0 ? "+" : "";
        details.push(`Bonus: ${sign}${p.bonusPoints} pt`);
      }

      const groupBadgeHtml = p.groupName
        ? `<span class="group-badge" style="--group-color: ${p.groupColor}">
             <span class="group-color-dot" style="width:6px;height:6px;"></span>
             ${p.groupName}
           </span>`
        : "";

      row.innerHTML = `
        <div class="score-rank">${rankLabel}</div>
        <div class="score-player-info">
          <span class="score-player-name">${p.naam}</span>
          ${groupBadgeHtml}
          <span class="score-player-detail">${details.join(" • ")}</span>
        </div>
        <div class="score-points">${p.totalPoints} PT</div>
      `;
      scoreboardList.appendChild(row);
    });
  }

  const INACTIVE_REASONS = [
    "> STATUS: DOSSIER_VERSNIPPERD // GEWIST",
    "> ERR_404: AGENT_ONDERGEDOKEN",
    "> SYS_WARN: VERDACHT_EXCUUS_GEDETECTEERD",
    "> SAT_LINK: SIGNAAL_VERBROKEN [OFFLINE]",
    "> DEKMANTEL_ACTIEF // BUITEN_DIENST",
    "> AUTH_REVOKED: CODE_VERNIETIGD_DOOR_HQ",
    "> RADAR_LOST: SPOORLOOS_VERDWENEN",
    "> QUARANTAINE_PROTOCOL // NON_ACTIEF"
  ];

  function renderPlayers(filterText = "") {
    grid.innerHTML = "";
    const inactiveSection = document.getElementById("inactive-players-section");
    const inactiveGrid = document.getElementById("inactive-players-grid");
    if (inactiveGrid) inactiveGrid.innerHTML = "";

    const query = filterText.trim().toLowerCase();

    const matchesQuery = (speler) => {
      const sInfo = latestScoreState.playerScoresMap.get(speler.id);
      const grpName = sInfo && sInfo.groupName ? sInfo.groupName.toLowerCase() : "";
      return (
        speler.naam.toLowerCase().includes(query) ||
        speler.dossierNr.includes(query) ||
        grpName.includes(query)
      );
    };

    const filteredActive = SPEL_CONFIG.spelers.filter((speler) => {
      const sInfo = latestScoreState.playerScoresMap.get(speler.id);
      if (sInfo && sInfo.disabled) return false;
      return matchesQuery(speler);
    });

    const filteredInactive = SPEL_CONFIG.spelers.filter((speler) => {
      const sInfo = latestScoreState.playerScoresMap.get(speler.id);
      if (!(sInfo && sInfo.disabled)) return false;
      return matchesQuery(speler);
    });

    if (filteredActive.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; color: var(--text-muted); font-family: var(--font-mono);">
          [ GEEN ACTIEVE AGENT GEVONDEN MET DEZE NAAM ]
        </div>
      `;
    }

    filteredActive.forEach((speler) => {
      const deviceUnlocked = isDeviceUnlocked(speler.id);
      const scoreInfo = latestScoreState.playerScoresMap.get(speler.id);
      const globallyCracked = scoreInfo && scoreInfo.unlocked;
      const hasGroup = Boolean(scoreInfo && scoreInfo.groupName);

      const card = document.createElement("button");
      card.type = "button";
      card.className = `player-card ${deviceUnlocked ? "unlocked" : ""} ${hasGroup ? "has-group" : ""}`;
      if (hasGroup) {
        card.style.setProperty("--group-color", scoreInfo.groupColor);
      }

      let statusHtml = `<span class="lock-indicator">🔒 VERGRENDELD</span>`;
      if (deviceUnlocked) {
        statusHtml = `<span class="lock-indicator">● OPEN OP DIT TOESTEL</span>`;
      } else if (globallyCracked) {
        statusHtml = `<span class="player-score-pill">GEKRAAKT (#${scoreInfo.unlockRank})</span>`;
      }

      const groupBadgeHtml = hasGroup
        ? `<div style="margin-top: 0.45rem;">
             <span class="group-badge" style="--group-color: ${scoreInfo.groupColor}">
               <span class="group-color-dot" style="width:6px;height:6px;"></span>
               ${scoreInfo.groupName}
             </span>
           </div>`
        : "";

      const pointsLine =
        scoreInfo && scoreInfo.active
          ? `<span style="color: var(--amber); font-weight: 700;">${scoreInfo.totalPoints} PT</span>`
          : `<span>${deviceUnlocked ? "OPEN DOSSIER →" : "VOER CODE IN →"}</span>`;

      card.innerHTML = `
        <div>
          <div class="dossier-code">
            <span>DOSSIER #${speler.dossierNr}</span>
            ${statusHtml}
          </div>
          <div class="player-name"><span class="folder-icon" aria-hidden="true">📁</span> ${speler.naam}</div>
          ${groupBadgeHtml}
        </div>
        <div class="player-action" style="justify-content: space-between; width: 100%;">
          ${pointsLine}
          ${scoreInfo && scoreInfo.active ? `<span>OPEN →</span>` : ""}
        </div>
      `;

      card.addEventListener("click", () => {
        if (deviceUnlocked) {
          window.location.href = `spelers/${speler.id}.html`;
        } else {
          openModal(speler);
        }
      });

      grid.appendChild(card);
    });

    // Render gedeactiveerde / afwezige spelers ludiek onderaan
    if (inactiveSection && inactiveGrid) {
      if (filteredInactive.length > 0) {
        inactiveSection.style.display = "block";
        filteredInactive.forEach((speler, idx) => {
          const reasonIdx =
            (parseInt(speler.dossierNr, 10) || idx) % INACTIVE_REASONS.length;
          const funnyReason = INACTIVE_REASONS[reasonIdx];

          const card = document.createElement("button");
          card.type = "button";
          card.className = "player-card inactive-card";
          card.innerHTML = `
            <div>
              <div class="dossier-code">
                <span>DOSSIER #${speler.dossierNr}</span>
                <span class="inactive-stamp">✕ NON-ACTIEF</span>
              </div>
              <div class="player-name inactive-name"><span class="folder-icon" aria-hidden="true">📁</span> ${speler.naam}</div>
            </div>
            <div class="inactive-reason">${funnyReason}</div>
          `;

          card.addEventListener("click", () => {
            card.classList.remove("shake-card");
            void card.offsetWidth;
            card.classList.add("shake-card");
          });

          inactiveGrid.appendChild(card);
        });
      } else {
        inactiveSection.style.display = "none";
      }
    }
  }

  function openModal(speler) {
    selectedPlayer = speler;
    try {
      localStorage.setItem("jb_active_agent_id", speler.id);
      sessionStorage.setItem("jb_active_agent_id", speler.id);
    } catch (_) {}
    modalTag.textContent = `DOSSIER #${speler.dossierNr} // AUTORISATIE VEREIST`;
    modalTitle.innerHTML = `<span class="folder-icon" aria-hidden="true">📁</span> ${speler.naam}`;
    codeInput.value = "";
    errorMsg.textContent = "";
    codeInput.classList.remove("error");
    unlockSubmitBtn.disabled = false;
    unlockSubmitBtn.textContent = "Ontgrendel";
    modal.classList.add("active");
    setTimeout(() => codeInput.focus(), 50);
  }

  function closeModal() {
    modal.classList.remove("active");
    selectedPlayer = null;
  }

  codeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedPlayer) return;

    const entered = codeInput.value.trim().toLowerCase();
    const expected = String(selectedPlayer.code).trim().toLowerCase();
    const master = String(SPEL_CONFIG.masterCode || "").trim().toLowerCase();

    if (entered && (entered === expected || (master && entered === master))) {
      sessionStorage.setItem(`dossier_unlocked_${selectedPlayer.id}`, "true");
      try {
        localStorage.setItem(`dossier_unlocked_${selectedPlayer.id}`, "true");
        localStorage.setItem("jb_active_agent_id", selectedPlayer.id);
        sessionStorage.setItem("jb_active_agent_id", selectedPlayer.id);
      } catch (_) {}
      unlockSubmitBtn.disabled = true;
      unlockSubmitBtn.textContent = "Bezig...";

      if (entered === expected) {
        await ScoreService.recordUnlock(selectedPlayer.id);
      }

      window.location.href = `spelers/${selectedPlayer.id}.html`;
    } else {
      errorMsg.textContent = "TOEGANG GEWEIGERD: Ongeldige code.";
      codeInput.classList.remove("error");
      void codeInput.offsetWidth;
      codeInput.classList.add("error");
      codeInput.select();
    }
  });

  cancelBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  toggleAllScoresBtn.addEventListener("click", () => {
    showAllScores = !showAllScores;
    renderScoreboard(latestScoreState);
  });

  searchInput.addEventListener("input", (e) => {
    renderPlayers(e.target.value);
  });

  // =========================================================================
  // LEIDING PANEEL LOGICA (BEVEILIGD MET MASTERCODE)
  // =========================================================================
  function renderAttendanceGrid() {
    if (!adminAttendanceGrid) return;
    adminAttendanceGrid.innerHTML = "";

    const total = SPEL_CONFIG.spelers.length;
    const activeCount = latestScoreState.totalCount;
    if (adminAttendanceCount) {
      adminAttendanceCount.textContent = `${activeCount} / ${total} aanwezig`;
    }

    SPEL_CONFIG.spelers.forEach((speler) => {
      const sInfo = latestScoreState.playerScoresMap.get(speler.id);
      const isDisabled = Boolean(sInfo && sInfo.disabled);

      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `attendance-chip ${isDisabled ? "disabled" : ""}`;
      chip.title = isDisabled
        ? `Klik om ${speler.naam} weer mee te laten doen`
        : `Klik om ${speler.naam} uit te schakelen (afwezig)`;
      chip.innerHTML = `<span>${isDisabled ? "✕" : "✓"}</span><span>${speler.naam}</span>`;

      chip.addEventListener("click", async () => {
        await ScoreService.setPlayerDisabled(speler.id, !isDisabled);
        showAdminFeedback(
          !isDisabled
            ? `${speler.naam} is uitgeschakeld (doet niet mee).`
            : `${speler.naam} doet weer mee met het spel!`
        );
      });

      adminAttendanceGrid.appendChild(chip);
    });
  }

  function populateAdminSelect() {
    const currentVal = adminPlayerSelect.value;
    const prevMsgTarget = adminMsgTarget ? adminMsgTarget.value : "all";

    if (document.activeElement !== adminPlayerSelect) {
      adminPlayerSelect.innerHTML = "";
      SPEL_CONFIG.spelers.forEach((s) => {
        const sInfo = latestScoreState.playerScoresMap.get(s.id);
        const statusSuffix = sInfo && sInfo.disabled ? " [AFWEZIG]" : "";
        const grpSuffix =
          sInfo && sInfo.adminGroupName ? ` [${sInfo.adminGroupName}]` : "";
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = `#${s.dossierNr} - ${s.naam}${statusSuffix}${grpSuffix} (Code: ${s.code})`;
        adminPlayerSelect.appendChild(opt);
      });
      if (currentVal) adminPlayerSelect.value = currentVal;
    }

    if (adminMsgPlayersOptgroup && document.activeElement !== adminMsgTarget) {
      adminMsgPlayersOptgroup.innerHTML = "";
      SPEL_CONFIG.spelers.forEach((s) => {
        const sInfo = latestScoreState.playerScoresMap.get(s.id);
        if (!(sInfo && sInfo.disabled)) {
          const mOpt = document.createElement("option");
          mOpt.value = `player:${s.id}`;
          mOpt.textContent = `👤 Speler: ${s.naam}`;
          adminMsgPlayersOptgroup.appendChild(mOpt);
        }
      });
      if (adminMsgTarget && prevMsgTarget) {
        adminMsgTarget.value = prevMsgTarget;
      }
    }

    // Update groeps-status en voorvertoning voor de admin
    if (adminGroupsRevealStatus) {
      if (latestScoreState.groupsRevealed) {
        adminGroupsRevealStatus.style.borderColor = "rgba(16, 185, 129, 0.45)";
        adminGroupsRevealStatus.style.background = "rgba(16, 185, 129, 0.1)";
        adminGroupsRevealStatus.style.color = "var(--accent)";
        adminGroupsRevealStatus.textContent = `🔓 ZICHTBAAR VOOR SPELERS (${latestScoreState.unlockedCount}/${latestScoreState.totalCount} codes gekraakt)`;
      } else {
        adminGroupsRevealStatus.style.borderColor = "rgba(245, 158, 11, 0.35)";
        adminGroupsRevealStatus.style.background = "rgba(245, 158, 11, 0.1)";
        adminGroupsRevealStatus.style.color = "var(--amber)";
        adminGroupsRevealStatus.textContent = `🔒 VERBORGEN VOOR SPELERS — Wordt automatisch onthuld zodra alle aanwezige spelers hun code invullen (${latestScoreState.unlockedCount} / ${latestScoreState.totalCount} gekraakt)`;
      }
    }

    if (adminToggleRevealBtn) {
      adminToggleRevealBtn.textContent = latestScoreState.groupsRevealed
        ? "🔒 Verberg groepen weer (wacht op alle codes)"
        : "🔓 Onthul groepen nu al handmatig";
    }

    if (adminGroupsPreview) {
      const aGroups = latestScoreState.adminGroupsList || [];
      if (aGroups.length > 0) {
        adminGroupsPreview.innerHTML = aGroups
          .map(
            (g) =>
              `<div style="margin-bottom: 0.25rem;">
                <strong style="color: ${g.kleur || "#fff"};">${g.naam}</strong> (Start: ${g.startLocationName}):
                ${g.leden.map((l) => l.naam).join(", ")}
              </div>`
          )
          .join("");
      } else {
        adminGroupsPreview.textContent = "Nog geen groepen klaargezet.";
      }
    }

    if (document.activeElement !== adminGroupSelect) {
      syncAdminPlayerGroupSelect();
    }
  }

  function syncAdminPlayerGroupSelect() {
    const pid = adminPlayerSelect.value;
    if (!pid || !adminGroupSelect) return;
    const sInfo = latestScoreState.playerScoresMap.get(pid);
    adminGroupSelect.value = sInfo && sInfo.adminGroupId ? sInfo.adminGroupId : "";
  }

  function renderAdminMessages() {
    if (!adminMsgList) return;
    const msgs = latestScoreState.allMessages || [];
    if (msgs.length === 0) {
      adminMsgList.innerHTML = "";
      return;
    }

    adminMsgList.innerHTML = "";
    msgs.slice(0, 8).forEach((m) => {
      const row = document.createElement("div");
      row.style.cssText =
        "display:flex; justify-content:space-between; align-items:center; gap:0.5rem; background:var(--bg-dark); border:1px solid var(--border-color); padding:0.45rem 0.65rem; border-radius:6px; font-size:0.78rem;";

      let targetLabel = "Iedereen";
      if (m.targetType === "group") targetLabel = m.targetId;
      else if (m.targetType === "player") {
        const sp = SPEL_CONFIG.spelers.find((s) => s.id === m.targetId);
        targetLabel = sp ? sp.naam : m.targetId;
      }
      const locBadge = m.locationName ? ` • 📍 ${m.locationName}` : "";

      row.innerHTML = `
        <div>
          <span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--accent);">[${targetLabel}${locBadge}]</span>
          <span style="color:#fff; margin-left:0.35rem;">${m.text}</span>
        </div>
        <button type="button" class="text-btn" style="color:var(--danger); font-size:0.7rem;">Wis</button>
      `;

      row.querySelector("button").addEventListener("click", async () => {
        await ScoreService.deleteBoardMessage(m.eventId);
        showAdminFeedback("Bericht verwijderd van het Message Board.");
      });

      adminMsgList.appendChild(row);
    });
  }

  function renderAdminPhotos() {
    const photos = latestScoreState.allPhotos || [];
    if (openAdminBtn) {
      openAdminBtn.textContent =
        photos.length > 0
          ? `🛡️ HQ Control Panel (📷 ${photos.length})`
          : "🛡️ HQ Control Panel";
    }
    if (!adminPhotosGrid || !adminPhotosCount) return;

    adminPhotosCount.textContent = `${photos.length} foto${photos.length === 1 ? "" : "'s"}`;

    if (photos.length === 0) {
      adminPhotosGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 1rem; color: var(--text-muted); font-family: var(--font-mono); font-size: 0.78rem;">
          [ NOG GEEN OPDRACHTFOTO'S INGEZONDEN DOOR SPELERS ]
        </div>
      `;
      return;
    }

    adminPhotosGrid.innerHTML = "";
    photos.forEach((ph) => {
      const card = document.createElement("div");
      card.className = "photo-card";
      const timeStr = ph.ts
        ? new Date(ph.ts).toLocaleTimeString("nl-BE", {
            hour: "2-digit",
            minute: "2-digit"
          })
        : "";
      const grpBadge = ph.groupName
        ? `<span style="color: ${ph.groupColor || "var(--accent)"}; font-size: 0.7rem;">● ${ph.groupName}</span>`
        : "";
      const locBadge = ph.locationName
        ? `<div style="font-family: var(--font-mono); font-size: 0.68rem; color: var(--amber);">📍 ${ph.locationName}</div>`
        : "";

      const isVid =
        ph.mediaType === "video" ||
        (ph.photoUrl && (ph.photoUrl.startsWith("data:video/") || /\.(mp4|mov|webm)(\?|$)/i.test(ph.photoUrl)));
      const mediaHtml = isVid
        ? `<video src="${ph.photoUrl}" controls playsinline preload="metadata" style="width:100%; height:145px; object-fit:cover; background:#000; display:block;"></video>`
        : `<img src="${ph.photoUrl}" alt="Foto van ${ph.playerName}" title="Klik om op volledig scherm te openen" />`;

      card.innerHTML = `
        ${mediaHtml}
        <div class="photo-card-body">
          <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 0.35rem;">
            <strong style="color: #fff;">${ph.playerName}</strong>
            ${grpBadge}
          </div>
          ${locBadge}
          <div style="color: var(--text-main); font-size: 0.78rem;">${ph.caption || "Geen bijschrift"}</div>
          <div class="photo-card-meta" style="margin-top: 0.35rem;">
            <span>${timeStr}</span>
            <div style="display: flex; gap: 0.45rem;">
              <button type="button" class="text-btn reward-photo-btn" style="font-size: 0.7rem; color: var(--accent); font-weight: 700;">+25 Speler</button>
              ${ph.groupId ? `<button type="button" class="text-btn reward-team-photo-btn" style="font-size: 0.7rem; color: var(--amber); font-weight: 700;">+25 Team</button>` : ""}
              <button type="button" class="text-btn delete-photo-btn" style="font-size: 0.7rem; color: var(--danger);">Wis</button>
            </div>
          </div>
        </div>
      `;

      const imgEl = card.querySelector("img");
      if (imgEl) {
        imgEl.addEventListener("click", () => {
          if (typeof ScoreService !== "undefined" && ScoreService.openPhotoLightbox) {
            ScoreService.openPhotoLightbox(
              ph.photoUrl,
              `${ph.playerName}${ph.locationName ? ` • 📍 ${ph.locationName}` : ""}`,
              ph.caption || ""
            );
          } else {
            window.open(ph.photoUrl, "_blank");
          }
        });
      }

      card.querySelector(".reward-photo-btn").addEventListener("click", async () => {
        await ScoreService.addBonusPoints(ph.playerId, 25, "Foto opdracht goedgekeurd");
        showAdminFeedback(`+25 PT gegeven aan ${ph.playerName}!`);
      });

      const teamBtn = card.querySelector(".reward-team-photo-btn");
      if (teamBtn && ph.groupId) {
        teamBtn.addEventListener("click", async () => {
          await ScoreService.addGroupBonusPoints(ph.groupId, 25, "Team foto bonus");
          showAdminFeedback(`+25 PT gegeven aan heel ${ph.groupName}!`);
        });
      }

      card.querySelector(".delete-photo-btn").addEventListener("click", async () => {
        if (window.confirm(`Foto van ${ph.playerName} verwijderen?`)) {
          await ScoreService.deletePlayerPhoto(ph.eventId);
          showAdminFeedback(`Foto van ${ph.playerName} verwijderd.`);
        }
      });

      adminPhotosGrid.appendChild(card);
    });
  }

  adminPlayerSelect.addEventListener("change", syncAdminPlayerGroupSelect);

  function showAdminFeedback(msg) {
    adminStatusFeedback.textContent = msg;
    setTimeout(() => {
      if (adminStatusFeedback.textContent === msg) {
        adminStatusFeedback.textContent = "";
      }
    }, 4000);
  }

  openAdminBtn.addEventListener("click", () => {
    const isAdminAuth = sessionStorage.getItem("jb_admin_unlocked") === "true";
    if (isAdminAuth) {
      window.location.href = "hq-dashboard.html";
      return;
    }
    adminErrorMsg.textContent = "";
    adminStatusFeedback.textContent = "";
    adminCodeInput.value = "";
    adminLoginStep.style.display = "block";
    adminControlsStep.style.display = "none";
    adminModal.classList.add("active");
    setTimeout(() => adminCodeInput.focus(), 50);
  });

  function closeAdminModal() {
    adminModal.classList.remove("active");
  }

  adminCancelBtn.addEventListener("click", closeAdminModal);
  adminCloseBtn.addEventListener("click", closeAdminModal);
  adminModal.addEventListener("click", (e) => {
    if (e.target === adminModal) closeAdminModal();
  });

  adminLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const entered = adminCodeInput.value.trim().toLowerCase();
    const master = String(SPEL_CONFIG.masterCode || "").trim().toLowerCase();
    if (entered && entered === master) {
      sessionStorage.setItem("jb_admin_unlocked", "true");
      adminErrorMsg.textContent = "";
      window.location.href = "hq-dashboard.html";
    } else {
      adminErrorMsg.textContent = "Ongeldige mastercode.";
    }
  });

  if (adminEnableAllBtn) {
    adminEnableAllBtn.addEventListener("click", async () => {
      await ScoreService.setDisabledPlayers([]);
      showAdminFeedback("Alle 26 spelers staan weer op aanwezig!");
    });
  }

  document.querySelectorAll(".btn-chip[data-delta]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const playerId = adminPlayerSelect.value;
      const delta = Number(btn.getAttribute("data-delta"));
      if (!playerId || !delta) return;
      await ScoreService.addBonusPoints(playerId, delta, "Leiding bonus");
      const sp = SPEL_CONFIG.spelers.find((s) => s.id === playerId);
      showAdminFeedback(
        `${delta > 0 ? "+" : ""}${delta} PT toegekend aan ${sp ? sp.naam : playerId}!`
      );
    });
  });

  adminApplyCustomBtn.addEventListener("click", async () => {
    const playerId = adminPlayerSelect.value;
    const delta = Number(adminCustomDelta.value);
    if (!playerId || !delta) return;
    await ScoreService.addBonusPoints(playerId, delta, "Handmatige aanpassing");
    adminCustomDelta.value = "";
    const sp = SPEL_CONFIG.spelers.find((s) => s.id === playerId);
    showAdminFeedback(
      `${delta > 0 ? "+" : ""}${delta} PT toegekend aan ${sp ? sp.naam : playerId}!`
    );
  });

  if (adminApplyTeamBonusBtn) {
    adminApplyTeamBonusBtn.addEventListener("click", async () => {
      const playerId = adminPlayerSelect.value;
      const delta = Number(adminCustomDelta.value) || 25;
      const sInfo = latestScoreState.playerScoresMap.get(playerId);
      if (!sInfo || !sInfo.adminGroupId) {
        showAdminFeedback("Deze speler zit nog niet in een groep!");
        return;
      }
      await ScoreService.addGroupBonusPoints(
        sInfo.adminGroupId,
        delta,
        "Team bonus van de spelleider"
      );
      adminCustomDelta.value = "";
      showAdminFeedback(
        `${delta > 0 ? "+" : ""}${delta} PT toegekend aan elk lid van ${sInfo.adminGroupName}!`
      );
    });
  }

  adminRevokePlayerBtn.addEventListener("click", async () => {
    const playerId = adminPlayerSelect.value;
    if (!playerId) return;
    const sp = SPEL_CONFIG.spelers.find((s) => s.id === playerId);
    await ScoreService.revokePlayerUnlock(playerId);
    sessionStorage.removeItem(`dossier_unlocked_${playerId}`);
    showAdminFeedback(
      `Ontgrendeling van ${sp ? sp.naam : playerId} is teruggezet.`
    );
  });

  adminRandomGroupsBtn.addEventListener("click", async () => {
    const groupSize = Math.max(2, Math.min(13, Number(adminGroupSize.value) || 4));
    const presentPlayers = SPEL_CONFIG.spelers.filter((s) => {
      const sInfo = latestScoreState.playerScoresMap.get(s.id);
      return !(sInfo && sInfo.disabled);
    });

    if (presentPlayers.length === 0) {
      showAdminFeedback("Er zijn geen aanwezige spelers om in te delen!");
      return;
    }

    const shuffled = [...presentPlayers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Maximaal 6 groepen zodat elke groep op 1 van de 6 unieke locaties start
    const maxLocs = (SPEL_CONFIG.locaties || []).length || 6;
    const numGroups = Math.min(maxLocs, Math.max(1, Math.min(shuffled.length, 6)));
    const defaultNames = (SPEL_CONFIG.standaardGroepen || []).map(
      (g) => g.id || g.naam
    );
    const assignments = {};

    shuffled.forEach((speler, idx) => {
      const groupIdx = idx % numGroups;
      const groupName = defaultNames[groupIdx] || `Groep ${groupIdx + 1}`;
      assignments[speler.id] = groupName;
    });

    await ScoreService.setAllGroups(assignments);
    populateAdminSelect();
    showAdminFeedback(
      `${shuffled.length} aanwezige spelers zijn klaargezet in ${numGroups} groepen!`
    );
  });

  adminAssignGroupBtn.addEventListener("click", async () => {
    const playerId = adminPlayerSelect.value;
    const groupName = adminGroupSelect.value;
    if (!playerId) return;
    const sp = SPEL_CONFIG.spelers.find((s) => s.id === playerId);
    await ScoreService.assignPlayerGroup(playerId, groupName);
    populateAdminSelect();
    showAdminFeedback(
      groupName
        ? `${sp ? sp.naam : playerId} is klaargezet in ${groupName}!`
        : `${sp ? sp.naam : playerId} is uit de groep gehaald.`
    );
  });

  if (adminToggleRevealBtn) {
    adminToggleRevealBtn.addEventListener("click", async () => {
      const nextMode = latestScoreState.groupsRevealed ? "auto" : "show";
      await ScoreService.setGroupsVisibilityMode(nextMode);
      showAdminFeedback(
        nextMode === "show"
          ? "Groepen zijn nu handmatig zichtbaar gemaakt voor alle spelers!"
          : "Groepen staan weer op automatisch (pas zichtbaar na alle codes)."
      );
    });
  }

  adminClearGroupsBtn.addEventListener("click", async () => {
    await ScoreService.setAllGroups({});
    populateAdminSelect();
    showAdminFeedback("Alle groepen zijn gewist.");
  });

  if (adminMsgForm) {
    adminMsgForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const rawTarget = adminMsgTarget.value;
      const category = adminMsgCategory.value;
      const locId = adminMsgLocation.value;
      const text = adminMsgText.value.trim();
      if (!text) return;

      let targetType = "all";
      let targetId = "";
      if (rawTarget.startsWith("group:")) {
        targetType = "group";
        targetId = rawTarget.slice(6);
      } else if (rawTarget.startsWith("player:")) {
        targetType = "player";
        targetId = rawTarget.slice(7);
      }

      const locObj = (SPEL_CONFIG.locaties || []).find((l) => l.id === locId);
      const locationName = locObj ? locObj.naam : "";

      await ScoreService.postBoardMessage({
        targetType,
        targetId,
        locationId: locId,
        locationName,
        category,
        text
      });

      adminMsgText.value = "";
      showAdminFeedback("📡 Bericht geplaatst op het Message Board!");
    });
  }

  adminResetAllBtn.addEventListener("click", async () => {
    const confirmed = window.confirm(
      "Weet je zeker dat je ALLE scores, berichten, foto's en ontgrendelingen wilt resetten?"
    );
    if (!confirmed) return;
    await ScoreService.resetAllScores(false, false);
    SPEL_CONFIG.spelers.forEach((s) =>
      sessionStorage.removeItem(`dossier_unlocked_${s.id}`)
    );
    populateAdminSelect();
    showAdminFeedback("Volledig spel is gereset (klaargezette groepen zijn bewaard)!");
  });

  // Spelregels Modal logica
  const openRulesBtn = document.getElementById("open-rules-btn");
  const closeRulesBtn = document.getElementById("close-rules-btn");
  const rulesModal = document.getElementById("rules-modal");

  function openRulesModal() {
    if (rulesModal) rulesModal.classList.add("active");
  }

  function closeRulesModal() {
    if (rulesModal) rulesModal.classList.remove("active");
  }

  if (openRulesBtn) openRulesBtn.addEventListener("click", openRulesModal);
  if (closeRulesBtn) closeRulesBtn.addEventListener("click", closeRulesModal);
  if (rulesModal) {
    rulesModal.addEventListener("click", (e) => {
      if (e.target === rulesModal) closeRulesModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (modal.classList.contains("active")) closeModal();
      if (adminModal.classList.contains("active")) closeAdminModal();
      if (rulesModal && rulesModal.classList.contains("active")) closeRulesModal();
    }
  });

  // CIA / FBI Live Klok & Geheime Dienst Intercept Ticker
  const intelClockEl = document.getElementById("intel-live-clock");
  const intelTickerTextEl = document.getElementById("intel-ticker-text");

  function updateIntelClock() {
    if (!intelClockEl) return;
    intelClockEl.textContent = new Date().toLocaleTimeString("nl-BE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }
  updateIntelClock();
  setInterval(updateIntelClock, 1000);

  let tickerIdx = 0;
  function cycleIntelTicker() {
    if (!intelTickerTextEl) return;
    const s = latestScoreState;
    const feedLines = [
      `> SATELLIETVERBINDING MET HEADQUARTERS (KAPUCIJNENSTRAAT 7) ACTIEF — 6 DOELWITTEN VERGRENDELD OP RADAR...`,
      `> STATUS DOSSIERS: ${s.unlockedCount} VAN DE ${s.totalCount} VELDAGENTEN HEBBEN HUN PERSOONLIJKE CODE GEKRAAKT...`,
      s.groupsRevealed
        ? `> FASE 2 GEACTIVEERD: ALLE AGENTEN ZIJN GEAUTORISEERD — ${s.groupsList.length} OPERATIE-TEAMS ZIJN NU ZICHTBAAR!`
        : `> PROTOCOL FASE 1: OPERATIE STATUS [GECLASSIFICEERD] — ELKE AGENT WERKT VOORLOPIG STRIKT INDIVIDUEEL...`,
      `> BEVEILIGDE UPLINK (AES-256): CONTROLEER REGELMATIG HET LIVE MESSAGE BOARD BOVENAAN JE DOSSIER VOOR HQ-TRANSMISSIES...`,
      `> GAMEMASTER VICCE MONITORT LIVE ALLE SECTOREN VAN 2200 HERENTALS VANUIT HEADQUARTERS...`
    ];
    if (s.allMessages && s.allMessages.length > 0) {
      const latestMsg = s.allMessages[0];
      feedLines.unshift(
        `> [NIEUWE HQ-TRANSMISSIE ONTVANGEN OM ${formatTime(latestMsg.ts)}]: CONTROLEER HET MESSAGE BOARD IN JE PERSOONLIJKE MAP!`
      );
    }
    intelTickerTextEl.textContent = feedLines[tickerIdx % feedLines.length];
    tickerIdx++;
  }
  setInterval(cycleIntelTicker, 4800);

  // Start Herentals Radar Map + Realtime Sync
  // =========================================================================
  // T-MINUS AFTELKLOK NAAR DEADLINE (ZATERDAG 24 OKTOBER 22u00)
  // =========================================================================
  function initTMinusCountdown() {
    const daysEl = document.getElementById("tminus-days");
    const hoursEl = document.getElementById("tminus-hours");
    const minsEl = document.getElementById("tminus-mins");
    const secsEl = document.getElementById("tminus-secs");
    const statusEl = document.getElementById("tminus-status");
    if (!daysEl) return;

    function getTargetDeadline() {
      // Zaterdag 24 oktober 2026 om 22u00
      const fixedTarget = new Date("2026-10-24T22:00:00");
      const now = new Date();
      if (now <= fixedTarget) return fixedTarget;

      // Fallback voor testen op andere data: eerstvolgende zaterdag 22u00
      const d = new Date();
      const day = d.getDay();
      const diff = (6 - day + 7) % 7;
      d.setDate(d.getDate() + diff);
      d.setHours(22, 0, 0, 0);
      if (d <= now) {
        d.setDate(d.getDate() + 7);
      }
      return d;
    }

    const deadline = getTargetDeadline();

    function update() {
      const now = new Date();
      const diff = deadline - now;

      if (diff <= 0) {
        daysEl.textContent = "00";
        hoursEl.textContent = "00";
        minsEl.textContent = "00";
        secsEl.textContent = "00";
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: #ef4444; font-weight: 800; animation: tminusSepBlink 1s infinite alternate;">🚨 DEADLINE BEREIKT // ERFPACHT DEFINITIEF VERKOCHT AAN HET STAD</span>`;
        }
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      const secs = Math.floor((diff / 1000) % 60);

      daysEl.textContent = String(days).padStart(2, "0");
      hoursEl.textContent = String(hours).padStart(2, "0");
      minsEl.textContent = String(mins).padStart(2, "0");
      secsEl.textContent = String(secs).padStart(2, "0");
    }

    update();
    setInterval(update, 1000);
  }

  initTMinusCountdown();
  initHerentalsRadarMap();

  ScoreService.subscribe((state) => {
    renderScoreboard(state);
    renderGroupsPanel(state);
    renderPlayers(searchInput.value);
    renderAttendanceGrid();
    populateAdminSelect();
    renderAdminMessages();
    renderAdminPhotos();
    cycleIntelTicker();
  });
  ScoreService.startRealtimeSync();
});
