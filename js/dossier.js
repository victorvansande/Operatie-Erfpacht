document.addEventListener("DOMContentLoaded", () => {
  const playerId = document.body.getAttribute("data-player-id");
  const contentEl = document.getElementById("dossier-content");
  const lockScreen = document.getElementById("dossier-lock-screen");
  const lockForm = document.getElementById("dossier-lock-form");
  const lockInput = document.getElementById("dossier-code-input");
  const lockError = document.getElementById("dossier-error-msg");
  const lockBtn = document.getElementById("lock-dossier-btn");

  const speler = SPEL_CONFIG.spelers.find((s) => s.id === playerId);
  let latestPlayerInfo = null;

  if (playerId) {
    try {
      localStorage.setItem("jb_active_agent_id", playerId);
      sessionStorage.setItem("jb_active_agent_id", playerId);
    } catch (_) {}
  }

  // Injecteer CIA / FBI Geheime Dienst Telemetrie Balk bovenaan elk spelersdossier
  function initDossierIntelTopbar() {
    if (document.querySelector(".intel-topbar")) return;
    const topbar = document.createElement("div");
    topbar.className = "intel-topbar";
    const agentTag = speler ? `AGENT ${speler.naam.toUpperCase()} (#${speler.dossierNr})` : "VELDAGENT";
    const gmLinkHtml =
      playerId === "vicce"
        ? `<a href="../hq-dashboard.html" style="background: var(--accent); color: #05080d; font-weight: 800; padding: 0.2rem 0.65rem; border-radius: 4px; text-decoration: none; font-size: 0.72rem;">🛰️ OPEN HQ GAMEMASTER DASHBOARD &rarr;</a>`
        : `<span class="intel-topbar-item intel-hide-mobile">🛰️ UPLINK: <strong>HQ KAPUCIJNENSTRAAT 7 [ENCRYPTED]</strong></span>`;
    topbar.innerHTML = `
      <div class="intel-topbar-inner">
        <span class="intel-topbar-item">
          <span class="intel-blink-red"></span>
          <strong>CIA // FBI FIELD TERMINAL</strong> — ${agentTag}
        </span>
        ${gmLinkHtml}
        <span class="intel-topbar-item">
          🕒 <span id="dossier-live-clock">--:--:--</span> // <span style="color: var(--amber);">CLEARANCE LVL-4</span>
        </span>
      </div>
    `;
    document.body.insertBefore(topbar, document.body.firstChild);

    const clockEl = document.getElementById("dossier-live-clock");
    const updateClock = () => {
      if (!clockEl) return;
      clockEl.textContent = new Date().toLocaleTimeString("nl-BE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    };
    updateClock();
    setInterval(updateClock, 1000);

    // Optimaliseer mobiele adresbalk-kleur & toetsenbord-attributen op elk spelersdossier
    if (document.head && !document.querySelector('meta[name="theme-color"]')) {
      const metaTheme = document.createElement("meta");
      metaTheme.name = "theme-color";
      metaTheme.content = "#070a0e";
      document.head.appendChild(metaTheme);
    }
    if (lockInput) {
      lockInput.setAttribute("autocapitalize", "none");
      lockInput.setAttribute("autocorrect", "off");
      lockInput.setAttribute("spellcheck", "false");
      lockInput.setAttribute("enterkeyhint", "go");
    }

    const dossierTitleEl = document.querySelector(".dossier-header h1.portal-title");
    if (dossierTitleEl && !dossierTitleEl.innerHTML.includes("📁") && !dossierTitleEl.innerHTML.includes("📂")) {
      dossierTitleEl.innerHTML = `<span class="folder-icon" aria-hidden="true">📁</span> ${dossierTitleEl.innerHTML}`;
    }
    const lockTitleEl = document.querySelector("#dossier-lock-screen .modal-title");
    if (lockTitleEl && !lockTitleEl.innerHTML.includes("📁") && !lockTitleEl.innerHTML.includes("📂")) {
      lockTitleEl.innerHTML = `<span class="folder-icon" aria-hidden="true">📁</span> ${lockTitleEl.innerHTML}`;
    }

    // Ruim overbodige standaard-tekstblokken ("Welkom...", "Nog geen specifieke opdracht...", "Extra Hint: ---")
    // op zodat het dossier veel rustiger en overzichtelijker oogt:
    if (contentEl) {
      contentEl.querySelectorAll(".mission-block").forEach((block) => {
        if (!block.closest(".location-folder")) {
          block.style.display = "none";
        }
      });
      contentEl.querySelectorAll(".clue-box").forEach((box) => {
        const val = box.querySelector(".clue-value");
        if (val && val.textContent.trim() === "---") {
          box.style.display = "none";
        }
      });
      const clueGrid = contentEl.querySelector(".clue-grid");
      if (clueGrid) {
        clueGrid.style.marginTop = "0";
        clueGrid.style.marginBottom = "1.25rem";
      }
    }
  }

  initDossierIntelTopbar();

  function isPlayerDisabled() {
    if (typeof ScoreService === "undefined") return false;
    const state = ScoreService.getState();
    const info = state.playerScoresMap.get(playerId);
    return Boolean(info && info.disabled);
  }

  function isLocationUnlocked(locId) {
    if (playerId === "vicce") {
      return true;
    }
    if (
      latestPlayerInfo &&
      latestPlayerInfo.sharedUnlockedLocations &&
      latestPlayerInfo.sharedUnlockedLocations.has(locId)
    ) {
      return true;
    }
    return (
      localStorage.getItem(
        `jb_loc_unlocked_${SPEL_CONFIG.cloudChannel}_${playerId}_${locId}`
      ) === "true"
    );
  }

  async function unlockLocationForTeam(locId) {
    localStorage.setItem(
      `jb_loc_unlocked_${SPEL_CONFIG.cloudChannel}_${playerId}_${locId}`,
      "true"
    );
    if (typeof ScoreService !== "undefined" && ScoreService.unlockLocation) {
      await ScoreService.unlockLocation(playerId, locId);
    }
  }

  function checkAccess() {
    if (isPlayerDisabled()) {
      if (contentEl) contentEl.classList.remove("unlocked");
      if (lockScreen) {
        lockScreen.style.display = "block";
        if (lockError) {
          lockError.textContent = "DIT DOSSIER IS GEDEACTIVEERD (SPELER DOET NIET MEE).";
        }
      }
      return;
    }

    const unlocked =
      playerId === "vicce" ||
      sessionStorage.getItem(`dossier_unlocked_${playerId}`) === "true";
    if (unlocked) {
      if (lockScreen) lockScreen.style.display = "none";
      if (contentEl) contentEl.classList.add("unlocked");
    } else {
      if (contentEl) contentEl.classList.remove("unlocked");
      if (lockScreen) {
        lockScreen.style.display = "block";
        setTimeout(() => lockInput && lockInput.focus(), 50);
      }
    }
  }

  if (lockForm && speler) {
    lockForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isPlayerDisabled()) {
        lockError.textContent = "DIT DOSSIER IS GEDEACTIVEERD (SPELER DOET NIET MEE).";
        return;
      }

      const entered = lockInput.value.trim().toLowerCase();
      const expected = String(speler.code).trim().toLowerCase();
      const master = String(SPEL_CONFIG.masterCode || "").trim().toLowerCase();

      if (entered && (entered === expected || (master && entered === master))) {
        sessionStorage.setItem(`dossier_unlocked_${playerId}`, "true");
        lockError.textContent = "";

        if (entered === expected && typeof ScoreService !== "undefined") {
          await ScoreService.recordUnlock(playerId);
        }

        checkAccess();
      } else {
        lockError.textContent = "TOEGANG GEWEIGERD: Ongeldige toegangscode.";
        lockInput.classList.remove("error");
        void lockInput.offsetWidth;
        lockInput.classList.add("error");
        lockInput.select();
      }
    });
  }

  if (lockBtn) {
    lockBtn.addEventListener("click", () => {
      sessionStorage.removeItem(`dossier_unlocked_${playerId}`);
      window.location.href = "../index.html";
    });
  }

  // =========================================================================
  // MESSAGE BOARD IN DE MAP VAN DE SPELER (RUSTIG, STRAK & BOVENAAN)
  // =========================================================================
  function renderPlayerMessageBoard(info) {
    if (!contentEl) return;
    let boardEl = document.getElementById("player-message-board");
    if (!boardEl) {
      boardEl = document.createElement("section");
      boardEl.id = "player-message-board";
      // Plaats het Message Board netjes direct onder de Status/Team balk (vóór de 6 locatiemappen)
      const clueGrid = contentEl.querySelector(".clue-grid");
      if (clueGrid && clueGrid.nextSibling) {
        contentEl.insertBefore(boardEl, clueGrid.nextSibling);
      } else {
        const headerEl = contentEl.querySelector(".dossier-header");
        if (headerEl && headerEl.nextSibling) {
          contentEl.insertBefore(boardEl, headerEl.nextSibling);
        } else {
          contentEl.insertBefore(boardEl, contentEl.firstChild);
        }
      }
    }

    const msgs = (info && info.messages) || [];
    const bonusHist = (info && info.bonusHistory) || [];
    const totalAlerts = msgs.length + bonusHist.length;
    const hasActiveItems = totalAlerts > 0;

    boardEl.style.cssText =
      "background: rgba(7, 10, 14, 0.65); border: 1px solid var(--border-color); border-left: 3px solid var(--accent); border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.5rem;";

    let itemsHtml = "";

    // 1. Geplaatste berichten van de spelleider (tips / geheime opdrachten)
    msgs.forEach((m) => {
      const timeStr = m.ts
        ? new Date(m.ts).toLocaleTimeString("nl-BE", {
            hour: "2-digit",
            minute: "2-digit"
          })
        : "";
      let badgeColor = "var(--accent)";
      let badgeLabel = "💡 TIP";
      if (m.category === "bonus") {
        badgeColor = "var(--amber)";
        badgeLabel = "⭐ BONUSOPDRACHT";
      } else if (m.category === "info") {
        badgeColor = "#38bdf8";
        badgeLabel = "📡 BERICHT";
      }
      const locTag = m.locationName ? ` • 📍 ${m.locationName}` : "";

      itemsHtml += `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-left: 3px solid ${badgeColor}; border-radius: 6px; padding: 0.7rem 0.95rem; margin-top: 0.55rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
            <span style="font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700; color: ${badgeColor};">${badgeLabel}${locTag}</span>
            <span style="font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-muted);">${timeStr}</span>
          </div>
          <div style="color: #fff; font-size: 0.92rem; line-height: 1.4;">${m.text}</div>
        </div>
      `;
    });

    // 2. Gekregen bonus-/strafpunten meldingen
    [...bonusHist].reverse().forEach((b) => {
      const abs = Math.abs(b.delta);
      const timeStr = b.ts
        ? new Date(b.ts).toLocaleTimeString("nl-BE", {
            hour: "2-digit",
            minute: "2-digit"
          })
        : "";
      const isPos = b.delta >= 0;
      const color = isPos ? "var(--accent)" : "var(--danger)";
      const text = isPos
        ? `🎉 <strong>+${abs} extra punten</strong> van de spelleider`
        : `⚠️ <strong>-${abs} punten</strong> aftrek van de spelleider`;

      itemsHtml += `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-left: 3px solid ${color}; border-radius: 6px; padding: 0.6rem 0.95rem; margin-top: 0.55rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
          <span style="font-size: 0.88rem; color: #fff;">${text}</span>
          <span style="font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-muted);">${timeStr}</span>
        </div>
      `;
    });

    if (!itemsHtml) {
      itemsHtml = `
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
          Nog geen berichten of extra opdrachten van de spelleider.
        </div>
      `;
    }

    const countBadge = hasActiveItems
      ? `<span style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--accent);">${totalAlerts} bericht${totalAlerts > 1 ? "en" : ""}</span>`
      : "";

    boardEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
        <div class="clue-label" style="margin-bottom: 0; color: var(--accent);">📡 Message Board</div>
        ${countBadge}
      </div>
      ${itemsHtml}
    `;

    ensureLocationsSection();
  }

  // =========================================================================
  // PERSOONLIJKE UITNODIGING / GEVONDEN VELDDOSSIER VOORVERTONING IN DE MAP
  // =========================================================================
  const INV_DIVISIONS = [
    "CIA // SPECIAL ACTIVITIES DIVISION (SAD)",
    "FBI // COUNTERINTELLIGENCE DIVISION (CD-4)",
    "NSA // SIGNALS INTELLIGENCE DIRECTORATE (SIGINT)",
    "ADIV // ALGEMENE DIENST INLICHTINGEN & VEILIGHEID",
    "MI6 // SECRET INTELLIGENCE SERVICE — FIELD OPS",
    "NATO // CLANDESTINE HUMINT TASKFORCE 2200"
  ];

  const INV_CODENAMES = [
    "NIGHTHAWK", "BLACKBRIAR", "TREADSTONE", "SENTINEL", "VALKYRIE",
    "GLASS-HOUSE", "ECLIPSE", "IRON-GATE", "WINTER-FOX", "SHADOW-NET",
    "SPECTRE", "OMEGA-7", "SILVER-WOLF", "RED-MERCURY", "COBALT"
  ];

  // =========================================================================
  // MAP: 'BRIEFING' (ALTIJD ONTGRENDELD, GEEN PIN, MET ONDERSCHEPTE AUDIO & UITLEG)
  // =========================================================================
  function ensureBriefingFolder() {
    if (!contentEl) return;
    const container = document.getElementById("briefing-folder-container");
    if (!container) return;
    if (document.getElementById("loc-folder-briefing")) return;

    const nrInt = speler ? parseInt(speler.dossierNr, 10) || 1 : 1;
    const division = INV_DIVISIONS[(nrInt - 1) % INV_DIVISIONS.length];
    const codename = INV_CODENAMES[(nrInt - 1) % INV_CODENAMES.length];
    const clearanceSerial = speler
      ? `CIA-2200-HR-${speler.dossierNr}-${1000 + nrInt * 37}`
      : "CIA-2200-HQ";

    const AGENCY_SEAL_SMALL_SVG = `
      <svg class="intel-doc-seal" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="30" stroke="#0f172a" stroke-width="2.5" fill="#f1ede2"/>
        <circle cx="32" cy="32" r="24" stroke="#0f172a" stroke-width="1.2" stroke-dasharray="2 2"/>
        <path d="M32 10 L37 25 L52 25 L40 34 L44 49 L32 40 L20 49 L24 34 L12 25 L27 25 Z" fill="#0f172a"/>
        <circle cx="32" cy="32" r="6" fill="#f8f6f0" stroke="#0f172a" stroke-width="1.5"/>
      </svg>
    `;

    const folder = document.createElement("div");
    folder.className = "location-folder briefing-folder unlocked expanded";
    folder.id = "loc-folder-briefing";
    folder.setAttribute("data-loc-id", "briefing");

    folder.innerHTML = `
      <button type="button" class="location-folder-header">
        <div class="location-folder-title">
          <span class="folder-icon">📂</span>
          <span class="loc-step-label" style="font-family: var(--font-mono); font-size: 0.78rem; color: #38bdf8; font-weight: 800;">ALGEMENE BRIEFING:</span>
          <span>Briefing</span>
        </div>
        <div class="location-folder-badges">
          <span class="briefing-audio-pill">
            <span class="intel-blink-red"></span>🎙️ SIGINT-AUDIO [01:27]
          </span>
          <span class="loc-lock-badge" style="color: var(--accent); border-color: rgba(16, 185, 129, 0.45);">🔓 GEEN PIN VEREIST</span>
        </div>
      </button>

      <div class="location-folder-body">
        <div style="margin-bottom: 0.95rem; padding-bottom: 0.75rem; border-bottom: 1px dashed rgba(56, 189, 248, 0.25); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem;">
          <div>
            <div style="font-family: var(--font-mono); font-size: 0.78rem; color: #38bdf8; font-weight: 700;">
              📍 CENTRALE COMMANDOPOST // HOOFDKWARTIER KAPUCIJNENSTRAAT 7
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
              Beluister hieronder eerst de onderschepte audio en lees de situatie-analyse alvorens te vertrekken.
            </div>
          </div>
          <span class="doc-highlight-yellow" style="font-size: 0.72rem; padding: 0.2rem 0.55rem;">CLEARANCE LEVEL 4</span>
        </div>

        <!-- ================================================================= -->
        <!-- AUDIO SPELER: SIGINT-REC-1636-ENCRYPTED.mp3 -->
        <!-- ================================================================= -->
        <div class="intel-audio-player-card">
          <div class="intel-audio-top-row">
            <div class="intel-audio-tag">
              <span class="intel-blink-red"></span>
              <span>ONDERSCHEPTE SPOEDOPNAME // KLOKKENLUIDER</span>
            </div>
            <span class="intel-audio-filename">SIGINT-REC-1636-ENCRYPTED.mp3</span>
          </div>

          <div class="intel-audio-header">
            <div class="intel-audio-avatar">🎙️</div>
            <div class="intel-audio-meta">
              <div class="intel-audio-title">ANONIEME OPROEP INZAKE VERKOOP KSA-LOKAAL</div>
              <div class="intel-audio-subtitle">SIGINT-TAP #1636 // FREQ: 144.80 MHz // OPNAMEDUUR: 01:27 MIN</div>
            </div>
          </div>

          <audio id="briefing-audio-el" preload="metadata">
            <source src="../audio/SIGINT-REC-1636-ENCRYPTED.mp3" type="audio/mpeg">
            <source src="../audio/SIGINT-REC-1636-ENCRYPTED.mpeg" type="audio/mpeg">
            <source src="audio/SIGINT-REC-1636-ENCRYPTED.mp3" type="audio/mpeg">
            <source src="audio/SIGINT-REC-1636-ENCRYPTED.mpeg" type="audio/mpeg">
          </audio>

          <div class="intel-audio-controls">
            <button type="button" id="briefing-audio-play-btn" class="intel-audio-btn">
              <span class="play-icon">▶</span>
              <span class="btn-text">SPEEL AUDIO-BRIEFING AF</span>
            </button>
            <div class="intel-audio-time">
              <span id="briefing-audio-curr">00:00</span> / <span id="briefing-audio-total">01:27</span>
            </div>
          </div>

          <div class="intel-audio-progress-wrap" id="briefing-audio-progress-wrap" title="Klik om vooruit of terug te spoelen">
            <div class="intel-audio-progress-bar" id="briefing-audio-progress-bar"></div>
          </div>

          <!-- Soundwave visualizer bars -->
          <div class="intel-audio-visualizer" id="briefing-audio-visualizer">
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
          </div>

          <!-- Uitklapbare Transcriptie -->
          <div class="intel-audio-transcript-wrapper">
            <button type="button" id="briefing-transcript-toggle" class="text-btn" style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--accent); padding: 0.2rem 0; cursor: pointer;">
              ▼ Toon geschreven transcriptie van de spraakopname
            </button>
            <div id="briefing-transcript-body" style="display: none; margin-top: 0.6rem; padding: 0.85rem; background: rgba(0,0,0,0.45); border-left: 3px solid var(--accent); border-radius: 4px; font-family: var(--font-mono); font-size: 0.8rem; line-height: 1.55; color: #cbd5e1;">
              <div style="font-weight: 700; color: var(--accent); margin-bottom: 0.4rem; font-size: 0.72rem; letter-spacing: 0.06em;">
                [WOORDELIJK TRANSCRIPT // SIGINT-REC-1636-ENCRYPTED.mp3]:
              </div>
              <p style="margin-bottom: 0.45rem;">
                <em>"Ok, ik heb niet veel tijd. Maar... lang verhaal kort: We hebben van een anonieme bron te horen gekregen dat Stad Herentals een plan heeft gesmeed om de nieuwe lokalen van KSA Herentals door te verkopen aan een onbekende derde partij van zodra het nieuwe dak erop ligt."</em>
              </p>
              <p style="margin-bottom: 0.45rem;">
                <em>"Dit hebben ze kunnen doen door een loophole in het contract met KSA Herentals. Niemand weet hier nog iets van, maar jullie hebben geluk: want er is een geheime inlichtingendienst meteen opgesprongen."</em>
              </p>
              <p style="margin-bottom: 0.45rem;">
                <em>"Die gaat jullie meteen contacteren, en die hebben een portaal opgestart om jullie hierin te helpen en ermee voor te zorgen dat deze deal tussen Stad Herentals en die derde partij niet zal kunnen doorgaan."</em>
              </p>
              <p style="margin-bottom: 0.45rem;">
                <em>"Het gaat niet gemakkelijk zijn. Ik kan ook mijn bronnen op dit moment nog niet verraden. Maar deze inlichtingendienst zal jullie contacteren met alle nodige info, en... Oh shit, ik moet gaan man!"</em>
              </p>
              <div style="color: #f87171; font-weight: 700; font-size: 0.72rem; margin-top: 0.35rem;">
                [SIGINT-STATUS: VERBINDING PLOTSELING VERBROKEN // GELUID VAN DICHTSLAANDE DEUR &amp; WEGRENNENDE VOETSTAPPEN]
              </div>
            </div>
          </div>
        </div>

        <!-- ================================================================= -->
        <!-- DOCUMENT 1: SPOEDBERICHT HOOFDKWARTIER (HET STAD HEEFT ONS SCHAAKMAT GEZET) -->
        <!-- ================================================================= -->
        <article class="intel-doc-sheet doc-variant-leaked" style="margin-bottom: 1.25rem;">
          <div class="intel-doc-top-tab tab-red">SPOEDBERICHT HOOFDKWARTIER // OPERATIE ERFPACHT (DEADLINE 22u00)</div>
          <div class="intel-doc-header">
            <div class="intel-doc-brand">
              ${AGENCY_SEAL_SMALL_SVG}
              <div>
                <div class="intel-doc-dept">GEHEIME INLICHTINGENDIENST // ONDERSCHEPTE INLICHTINGEN</div>
                <div class="intel-doc-main-title">HET STAD HEEFT ONS SCHAAKMAT GEZET</div>
                <div class="intel-doc-sub">SIGINT-TAP #1636 // SPOEDDOSSIER MARKGRAVENSTRAAT 77</div>
              </div>
            </div>
            <div class="intel-doc-stamp">TOP SECRET</div>
          </div>
          <div class="intel-doc-body">
            <p>
              <strong>DE DREIGING:</strong> Gisteren rond <strong>16u36</strong> kreeg het stadsbestuur een telefoontje van een <strong>onbekende derde partij</strong> (<span class="doc-redacted">IMMO-GROEP ████████ NV</span>). Zij boden enorm veel geld om ons lokaal — dat momenteel in onze erfpacht is en volop in verbouwing staat — stiekem door te verkopen vanaf het nieuwe dak erop ligt via een juridische maas in het erfpachtcontract.
            </p>
            <p>
              <strong>DEADLINE 22u00:</strong> Vanavond om <strong>22u00</strong> stipt gaat deze geheime transactie door, wordt het geld digitaal overgeschreven en is het lokaal definitief kwijt. We zullen ze op <strong>6 verschillende locaties moeten dwarsbomen</strong> via de 6 locatiemappen hieronder!
            </p>
            <div class="intel-checklist-box" style="margin-top: 0.65rem;">
              <div class="intel-checklist-title">★ SPELPROTOCOL &amp; EVALUATIE-CRITERIA:</div>
              <ul style="margin: 0.35rem 0 0 1.1rem; padding: 0; font-size: 0.78rem; line-height: 1.5; color: #0f172a;">
                <li><strong>1. Codes vinden:</strong> Op elke locatie in Herentals vinden jullie een code om het bijbehorende mapje te ontgrendelen.</li>
                <li><strong>2. Bewijs verzamelen:</strong> Voer de opdracht uit en upload jullie foto- of videobewijs rechtstreeks in het mapje.</li>
                <li><strong>3. Bonuspunten (+50 pt):</strong> Voer de bonusopdrachten uit voor extra voorsprong op het klassement!</li>
                <li><strong>4. 22u00 Deadline op HQ:</strong> Zorg dat jullie om 22u00 terug op het Hoofdkwartier (Kapucijnenstraat 7) zijn met de fysieke bewijsstukken (€10 cash, spijsrot dakpuin, audio)!</li>
              </ul>
            </div>
            <div style="margin-top: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
              <a href="../brief-leden-intro.pdf" target="_blank" class="back-link" style="font-size: 0.75rem; padding: 0.35rem 0.65rem; background: #0f172a; color: #f8f6f0; border: 1px solid #334155;">
                📄 Bekijk de officiële intro-brief (A4 PDF) &rarr;
              </a>
            </div>
          </div>
          <div class="intel-doc-footer">
            <span>HQ KAPUCIJNENSTRAAT 7 // OPEN DE LOCATIE-MAPPEN HIERONDER</span>
            <div class="intel-barcode-bars"></div>
          </div>
        </article>

        <!-- ================================================================= -->
        <!-- DOCUMENT 2: PERSOONLIJK GEVONDEN VELDDOSSIER / FICHE -->
        <!-- ================================================================= -->
        ${
          speler
            ? `
          <div id="paper-dossier-preview-card" class="paper-dossier-card">
            <div class="paper-dossier-top">
              <div class="paper-agency-group">
                <svg class="paper-seal-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="32" cy="32" r="30" stroke="#0f172a" stroke-width="2.5" fill="#f1ede2"/>
                  <circle cx="32" cy="32" r="24" stroke="#0f172a" stroke-width="1.2" stroke-dasharray="2 2"/>
                  <path d="M32 10 L37 25 L52 25 L40 34 L44 49 L32 40 L20 49 L24 34 L12 25 L27 25 Z" fill="#0f172a"/>
                  <circle cx="32" cy="32" r="6" fill="#f8f6f0" stroke="#0f172a" stroke-width="1.5"/>
                </svg>
                <div>
                  <div class="paper-dept-label">${division}</div>
                  <div class="paper-main-title">PERSOONLIJK VELDDOSSIER #${speler.dossierNr}</div>
                </div>
              </div>
              <div class="paper-rubber-stamp">TOP SECRET // EYES ONLY</div>
            </div>

            <div class="paper-meta-grid">
              <div class="paper-meta-item">
                <span class="paper-meta-key">Opgeroepen Agent</span>
                <span class="paper-meta-val"><span class="paper-agent-highlight">AGENT ${speler.naam.toUpperCase()}</span></span>
              </div>
              <div class="paper-meta-item">
                <span class="paper-meta-key">Codenaam &amp; Dossier</span>
                <span class="paper-meta-val">#${speler.dossierNr} // PROJECT "${codename}"</span>
              </div>
              <div class="paper-meta-item">
                <span class="paper-meta-key">Hoofdkwartier (HQ)</span>
                <span class="paper-meta-val">KAPUCIJNENSTRAAT 7, HERENTALS</span>
              </div>
            </div>

            <div class="paper-briefing-body">
              <div style="font-size: 0.66rem; font-weight: 800; color: #b91c1c; letter-spacing: 0.08em; margin-bottom: 0.35rem; text-transform: uppercase;">
                &gt;_ GECLASSIFICEERD VELDDOSSIER // VERIFICATIE AFGEROND
              </div>
              <p>
                Goed werk <strong>Agent ${speler.naam}</strong> — uw dossier is succesvol ontgrendeld. Op last van het <strong>Joint Intelligence Command</strong> bent u nu officieel geactiveerd in <strong>Sector 2200 Herentals</strong>.
              </p>
              <p>
                Open hieronder de 6 geheime locatiemappen in de volgorde van jullie teamroute om het stadsbestuur te dwarsbomen en de verkoopakte van 22u00 nietig te laten verklaren!
              </p>
            </div>

            <div class="paper-footer-row">
              <div>
                <strong>Gamemaster HQ // Director Operations</strong><br/>
                <span>DOC-REF: ${clearanceSerial}</span>
              </div>
              <div class="paper-code-pill">
                PERSOONLIJKE CODE: ${speler.code}
              </div>
            </div>
          </div>
        `
            : ""
        }
      </div>
    `;

    container.appendChild(folder);

    // Accordion toggle
    const headerBtn = folder.querySelector(".location-folder-header");
    headerBtn.addEventListener("click", () => {
      folder.classList.toggle("expanded");
    });

    // Custom Audio Player Logica
    const audioEl = folder.querySelector("#briefing-audio-el");
    const playBtn = folder.querySelector("#briefing-audio-play-btn");
    const playIcon = playBtn ? playBtn.querySelector(".play-icon") : null;
    const btnText = playBtn ? playBtn.querySelector(".btn-text") : null;
    const currTimeEl = folder.querySelector("#briefing-audio-curr");
    const totalTimeEl = folder.querySelector("#briefing-audio-total");
    const progressBar = folder.querySelector("#briefing-audio-progress-bar");
    const progressWrap = folder.querySelector("#briefing-audio-progress-wrap");
    const visualizer = folder.querySelector("#briefing-audio-visualizer");
    const transcriptToggle = folder.querySelector("#briefing-transcript-toggle");
    const transcriptBody = folder.querySelector("#briefing-transcript-body");

    function formatTime(sec) {
      if (isNaN(sec) || sec < 0) return "00:00";
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    if (playBtn && audioEl) {
      playBtn.addEventListener("click", () => {
        if (audioEl.paused) {
          audioEl
            .play()
            .then(() => {
              playBtn.classList.add("is-playing");
              if (visualizer) visualizer.classList.add("is-playing");
              if (playIcon) playIcon.textContent = "⏸";
              if (btnText) btnText.textContent = "PAUZEER TRANSMISSIE";
            })
            .catch((err) => {
              console.warn("Audio playback issue:", err);
            });
        } else {
          audioEl.pause();
          playBtn.classList.remove("is-playing");
          if (visualizer) visualizer.classList.remove("is-playing");
          if (playIcon) playIcon.textContent = "▶";
          if (btnText) btnText.textContent = "HERVAT TRANSMISSIE";
        }
      });

      audioEl.addEventListener("loadedmetadata", () => {
        if (totalTimeEl && audioEl.duration) {
          totalTimeEl.textContent = formatTime(audioEl.duration);
        }
      });

      audioEl.addEventListener("timeupdate", () => {
        const c = audioEl.currentTime || 0;
        const d = audioEl.duration || 87;
        const pct = Math.min(100, Math.max(0, (c / d) * 100));
        if (progressBar) progressBar.style.width = pct + "%";
        if (currTimeEl) currTimeEl.textContent = formatTime(c);
        if (totalTimeEl && audioEl.duration) {
          totalTimeEl.textContent = formatTime(audioEl.duration);
        }
      });

      audioEl.addEventListener("ended", () => {
        playBtn.classList.remove("is-playing");
        if (visualizer) visualizer.classList.remove("is-playing");
        if (playIcon) playIcon.textContent = "▶";
        if (btnText) btnText.textContent = "SPEEL OPNIEUW AF";
        if (progressBar) progressBar.style.width = "0%";
        if (currTimeEl) currTimeEl.textContent = "00:00";
      });

      if (progressWrap) {
        progressWrap.addEventListener("click", (e) => {
          const rect = progressWrap.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const ratio = Math.max(0, Math.min(1, clickX / rect.width));
          const d = audioEl.duration || 87;
          audioEl.currentTime = ratio * d;
        });
      }
    }

    if (transcriptToggle && transcriptBody) {
      transcriptToggle.addEventListener("click", () => {
        const isHidden = transcriptBody.style.display === "none";
        transcriptBody.style.display = isHidden ? "block" : "none";
        transcriptToggle.textContent = isHidden
          ? "▲ Verberg gesproken transcriptie"
          : "▼ Toon geschreven transcriptie van de spraakopname";
      });
    }
  }

  // =========================================================================
  // BONUSDOSSIERS (5 GEHEIME NEVENMISSIES)
  // =========================================================================
  function setupBonusUploadForm(folderEl, bonusLocId, bonusLocName) {
    const photoForm = folderEl.querySelector(".loc-photo-form");
    const photoInput = folderEl.querySelector(".loc-photo-input");
    const photoFilename = folderEl.querySelector(".loc-photo-filename");
    const photoCaption = folderEl.querySelector(".loc-photo-caption");
    const photoSubmit = folderEl.querySelector(".loc-photo-submit");
    const photoStatus = folderEl.querySelector(".loc-photo-status");

    if (!photoForm || !photoInput) return;

    photoInput.addEventListener("change", () => {
      if (photoInput.files && photoInput.files[0]) {
        photoFilename.textContent = photoInput.files[0].name;
      } else {
        photoFilename.textContent = "Geen bestand gekozen";
      }
    });

    photoForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!photoInput.files || !photoInput.files[0]) return;
      const file = photoInput.files[0];

      photoSubmit.disabled = true;
      photoSubmit.textContent = "Uploaden...";
      photoStatus.textContent = `Bewijs wordt verstuurd naar HQ...`;

      try {
        await ScoreService.uploadPlayerPhoto(
          playerId,
          file,
          photoCaption ? photoCaption.value : "",
          bonusLocId,
          bonusLocName
        );
        photoInput.value = "";
        if (photoCaption) photoCaption.value = "";
        photoFilename.textContent = "Geen bestand gekozen";
        photoStatus.textContent = "✓ Bewijsmateriaal succesvol verzonden naar HQ!";
        setTimeout(() => {
          if (photoStatus.textContent.startsWith("✓")) {
            photoStatus.textContent = "";
          }
        }, 4500);
      } catch (err) {
        photoStatus.textContent = "Fout bij uploaden. Probeer opnieuw.";
      } finally {
        photoSubmit.disabled = false;
        photoSubmit.textContent = "Upload naar HQ";
      }
    });
  }

  function renderBonusGallery(folderEl, bonusLocId, info) {
    const gallery = folderEl.querySelector(".loc-photos-gallery");
    if (!gallery) return;

    const teamPhotos =
      info && info.sharedPhotos ? info.sharedPhotos : (latestPlayerInfo && latestPlayerInfo.sharedPhotos) || [];
    const photos = teamPhotos.filter((ph) => ph.locationId === bonusLocId);

    const sig = photos.map((p) => p.eventId).join("|");
    if (folderEl.dataset.bonusSig === sig) return;
    folderEl.dataset.bonusSig = sig;

    gallery.innerHTML = "";
    photos.forEach((ph) => {
      const card = document.createElement("div");
      card.className = "photo-card";
      const timeStr = ph.ts
        ? new Date(ph.ts).toLocaleTimeString("nl-BE", {
            hour: "2-digit",
            minute: "2-digit"
          })
        : "";

      const isVid =
        ph.mediaType === "video" ||
        (ph.photoUrl && (ph.photoUrl.startsWith("data:video/") || /\.(mp4|mov|webm)(\?|$)/i.test(ph.photoUrl)));
      const mediaHtml = isVid
        ? `<video src="${ph.photoUrl}" controls playsinline preload="metadata" style="width:100%; height:145px; object-fit:cover; background:#000; display:block;"></video>`
        : `<img src="${ph.photoUrl}" alt="Bewijs ${bonusLocId}" title="Tik om op volledig scherm te bekijken" />`;

      card.innerHTML = `
        ${mediaHtml}
        <div class="photo-card-body">
          <div style="color: var(--amber); font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700;">
            Door ${ph.playerName} ${ph.groupName ? `(${ph.groupName})` : ""} // ${timeStr}
          </div>
          ${ph.caption ? `<div class="photo-card-caption">${ph.caption}</div>` : ""}
        </div>
      `;

      if (!isVid) {
        const img = card.querySelector("img");
        if (img) {
          img.addEventListener("click", () => {
            if (ScoreService.openPhotoLightbox) {
              ScoreService.openPhotoLightbox(ph.photoUrl, ph.caption, ph.playerName, timeStr);
            }
          });
        }
      }
      gallery.appendChild(card);
    });
  }

  function ensureBonusFolders(info) {
    if (!contentEl) return;
    const container = document.getElementById("bonus-folders-container");
    if (!container) return;

    const AGENCY_SEAL_SMALL_SVG = `
      <svg class="intel-doc-seal" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="30" stroke="#0f172a" stroke-width="2.5" fill="#f1ede2"/>
        <circle cx="32" cy="32" r="24" stroke="#0f172a" stroke-width="1.2" stroke-dasharray="2 2"/>
        <path d="M32 10 L37 25 L52 25 L40 34 L44 49 L32 40 L20 49 L24 34 L12 25 L27 25 Z" fill="#0f172a"/>
        <circle cx="32" cy="32" r="6" fill="#f8f6f0" stroke="#0f172a" stroke-width="1.5"/>
      </svg>
    `;

    const isBurnerSolved =
      Boolean(
        info &&
        info.bonusSolves &&
        info.bonusSolves.some(
          (s) => s.riddleId === "burner_sms" && s.status === "correct"
        )
      ) || localStorage.getItem(`jb_solved_burner_sms_${playerId}`) === "true";

    let wrapper = document.getElementById("bonus-folders-wrapper");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.id = "bonus-folders-wrapper";
      wrapper.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin: 1.25rem 0 0.55rem; padding-bottom: 0.35rem; border-bottom: 1px dashed rgba(245, 158, 11, 0.35);">
          <div class="live-toast-tag" style="color: var(--amber);">&gt;_ GEHEIME BONUSDOSSIERS // 5 NEVENMISSIES VOOR EXTRA PUNTEN</div>
          <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--amber); font-weight: 700;">★ OPTIONEEL VOOR VASTE PUNTEN</span>
        </div>
        <div id="bonus-folders-list" class="locations-list"></div>
      `;
      container.appendChild(wrapper);

      const list = wrapper.querySelector("#bonus-folders-list");

      // -------------------------------------------------------------
      // BONUS 1: Onderschepte SMS Burner-Phone (T9 Decryptie)
      // -------------------------------------------------------------
      const b1 = document.createElement("div");
      b1.className = "location-folder bonus-folder";
      b1.id = "loc-folder-bonus-burner";
      b1.innerHTML = `
        <button type="button" class="location-folder-header">
          <div class="location-folder-title">
            <span class="folder-icon">📁</span>
            <span class="loc-step-label" style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--amber); font-weight: 800;">BONUS #01:</span>
            <span>Onderschepte SMS Burner-Phone</span>
          </div>
          <div class="location-folder-badges">
            <span class="briefing-audio-pill" style="border-color: rgba(245, 158, 11, 0.4); color: var(--amber); background: rgba(245, 158, 11, 0.1);">
              ⭐ DECRYPTIE (+75 PT)
            </span>
            <span class="loc-lock-badge b1-status-badge" style="color: var(--amber); border-color: rgba(245, 158, 11, 0.45);">
              ${isBurnerSolved ? "✅ VOLBRACHT (+75 PT)" : "🔓 OPENSTAAND"}
            </span>
          </div>
        </button>

        <div class="location-folder-body">
          <article class="intel-doc-sheet doc-variant-tool" style="border-left-color: var(--amber); margin-bottom: 0;">
            <div class="intel-doc-top-tab" style="background: var(--amber); color: #000;">BIJLAGE SIGINT // AFGELUISTERDE OUDE BURNER-PHONE</div>
            <div class="intel-doc-header">
              <div class="intel-doc-brand">
                ${AGENCY_SEAL_SMALL_SVG}
                <div>
                  <div class="intel-doc-dept">SIGINT COMMUNICATIE-AFLUISTERING // ARCHIEF HERENTALS</div>
                  <div class="intel-doc-main-title">ONDERSCHEPTE BURNER-PHONE SMS</div>
                  <div class="intel-doc-sub" style="color: var(--amber);">AFGELUISTERDE TRANSMISSIE // CODENAAM: RETRO-CELL</div>
                </div>
              </div>
              <div class="intel-doc-stamp" style="border-color: var(--amber); color: var(--amber); background: rgba(245, 158, 11, 0.08);">
                CLASSIFIED INTEL
              </div>
            </div>

            <div class="intel-doc-body">
              <p>
                <strong>INTERCEPTIE-VERSLAG:</strong> Onze afluisterdienst heeft ontdekt dat het stadsbestuur voor gevoelige afspraken géén traceerbare smartphones of officiële e-mails gebruikt, maar een oude, anonieme <em>burner-phone</em> (een fysieke Nokia met numerieke druktoetsen).
              </p>
              <p>
                Zojuist heeft onze antenne een uitgaande SMS-toetsenreeks van dit toestel kunnen onderscheppen:
              </p>

              <div class="retro-burner-phone-box">
                <div class="burner-screen-top">
                  <span>📟 NOKIA BUFFER // INTERCEPTED SMS-STREAM</span>
                  <span>BURST-TRANSMISSION</span>
                </div>
                <div class="burner-keystrokes">
                  44 &bull; 2 &bull; 66 &bull; 4 &bull; 5 &bull; 666 &bull; 66 &bull; 4 &bull; 33 &bull; 777 &bull; 33 &bull; 66
                </div>
              </div>

              <!-- Formulier of Opgelost Scherm -->
              <div class="b1-form-area" style="${isBurnerSolved ? "display: none;" : "display: block;"}">
                <p style="font-size: 0.82rem; color: #475569; margin-bottom: 0.5rem; font-weight: 700;">
                  Voer het ontcijferde woord hieronder in. Zodra het klopt, wordt het direct naar Gamemaster HQ gestuurd en ontvangt je team <strong>+75 bonuspunten</strong>:
                </p>
                <form class="b1-submit-form" autocomplete="off" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                  <input
                    type="text"
                    class="loc-code-input b1-input"
                    placeholder="Typ het ontcijferde woord..."
                    autocapitalize="none"
                    autocorrect="off"
                    spellcheck="false"
                    enterkeyhint="go"
                    required
                    style="flex: 1; min-width: 190px; text-transform: uppercase;"
                  />
                  <button type="submit" class="btn btn-primary b1-btn" style="flex: 0 0 auto; background: var(--amber); border-color: var(--amber); color: #000; font-weight: 800;">
                    📡 VERZEND NAAR HQ (+75 PT)
                  </button>
                </form>
                <div class="b1-feedback-msg" style="font-family: var(--font-mono); font-size: 0.8rem; margin-top: 0.5rem; min-height: 1.2rem;"></div>
              </div>

              <div class="b1-solved-card" style="${isBurnerSolved ? "display: block;" : "display: none;"} background: rgba(16, 185, 129, 0.15); border: 2px solid #10b981; border-radius: 6px; padding: 1rem; text-align: center; margin-top: 0.85rem;">
                <div style="font-size: 1.4rem; margin-bottom: 0.2rem;">✅</div>
                <div style="font-family: var(--font-mono); font-weight: 800; color: #34d399; font-size: 1.05rem;">
                  INTERCEPTIE SUCCESVOL ONTRAADSELD // VERZONDEN NAAR HQ
                </div>
                <div style="font-size: 0.88rem; color: #ecfdf5; margin-top: 0.35rem;">
                  Gedecodeerd codewoord: <strong style="letter-spacing: 0.1em; color: var(--amber);">"HANGJONGEREN"</strong>
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.78rem; color: #a7f3d0; margin-top: 0.5rem;">
                  ⭐ +75 BONUSPUNTEN BIJGESCHREVEN OP HET LIVE SCOREBORD!
                </div>
              </div>
            </div>

            <div class="intel-doc-footer">
              <span>AUTH: SIGINT DIRECTORATE // CLASSIFIED TRANSMISSION</span>
              <div class="intel-barcode-bars"></div>
            </div>
          </article>
        </div>
      `;
      list.appendChild(b1);

      // Accordion toggle & form submit event for Bonus 1
      const b1Header = b1.querySelector(".location-folder-header");
      b1Header.addEventListener("click", () => b1.classList.toggle("expanded"));

      const b1Form = b1.querySelector(".b1-submit-form");
      const b1Input = b1.querySelector(".b1-input");
      const b1Msg = b1.querySelector(".b1-feedback-msg");
      const b1Btn = b1.querySelector(".b1-btn");
      const b1FormArea = b1.querySelector(".b1-form-area");
      const b1SolvedCard = b1.querySelector(".b1-solved-card");
      const b1Badge = b1.querySelector(".b1-status-badge");

      if (b1Form) {
        b1Form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const val = b1Input.value.trim();
          if (!val) return;

          b1Btn.disabled = true;
          b1Btn.textContent = "Verifiëren met HQ...";
          b1Msg.style.color = "var(--text-muted)";
          b1Msg.textContent = "Verbinding maken met Gamemaster HQ...";

          try {
            const res = await ScoreService.submitBonusRiddle(playerId, "burner_sms", val);
            if (res.success) {
              localStorage.setItem(`jb_solved_burner_sms_${playerId}`, "true");
              b1Msg.textContent = "";
              b1FormArea.style.display = "none";
              b1SolvedCard.style.display = "block";
              b1Badge.textContent = "✅ VOLBRACHT (+75 PT)";
              b1Badge.style.color = "var(--accent)";
              b1Badge.style.borderColor = "var(--accent)";
              if (ScoreService.triggerIntelPopup) {
                ScoreService.triggerIntelPopup(
                  "🎯 BONUS VOLBRACHT! Het codewoord 'HANGJONGEREN' is geverifieerd door Gamemaster HQ (+75 PT).",
                  "VELDAGENT"
                );
              }
            } else {
              b1Msg.style.color = "var(--danger)";
              b1Msg.textContent = res.message || "❌ ONJUIST WOORD: Probeer opnieuw!";
              b1Btn.disabled = false;
              b1Btn.textContent = "📡 VERZEND NAAR HQ (+75 PT)";
              b1Input.select();
            }
          } catch (err) {
            b1Msg.style.color = "var(--danger)";
            b1Msg.textContent = "Verbindingsfout met HQ: " + err.message;
            b1Btn.disabled = false;
            b1Btn.textContent = "📡 VERZEND NAAR HQ (+75 PT)";
          }
        });
      }

      // -------------------------------------------------------------
      // BONUS 2: Operatie Ad Fundum (Café Infiltratie)
      // -------------------------------------------------------------
      const b2 = document.createElement("div");
      b2.className = "location-folder bonus-folder";
      b2.id = "loc-folder-bonus-adfundum";
      b2.innerHTML = `
        <button type="button" class="location-folder-header">
          <div class="location-folder-title">
            <span class="folder-icon">📁</span>
            <span class="loc-step-label" style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--amber); font-weight: 800;">BONUS #02:</span>
            <span>Operatie Ad Fundum (Café Infiltratie)</span>
          </div>
          <div class="location-folder-badges">
            <span class="briefing-audio-pill" style="border-color: rgba(245, 158, 11, 0.4); color: var(--amber); background: rgba(245, 158, 11, 0.1);">
              ⭐ SNELSTE AT WINT (+100 PT)
            </span>
            <span class="loc-lock-badge" style="color: var(--amber); border-color: rgba(245, 158, 11, 0.45);">
              📹 VIDEO VEREIST
            </span>
          </div>
        </button>

        <div class="location-folder-body">
          <article class="intel-doc-sheet doc-variant-tool" style="border-left-color: var(--amber); margin-bottom: 0.85rem;">
            <div class="intel-doc-top-tab" style="background: var(--amber); color: #000;">HUMINT VELDTEST // TACTISCHE REACTIESNELHEID</div>
            <div class="intel-doc-header">
              <div class="intel-doc-brand">
                ${AGENCY_SEAL_SMALL_SVG}
                <div>
                  <div class="intel-doc-dept">HUMINT COMMUNICATIE-DIRECTIE // HORECA SECTOR HERENTALS</div>
                  <div class="intel-doc-main-title">OPERATIE AD FUNDUM // CAFÉ INFILTRATIE</div>
                  <div class="intel-doc-sub" style="color: var(--amber);">SNELSTE AT WINT // PROEF VAN PARAATHEID</div>
                </div>
              </div>
              <div class="intel-doc-stamp" style="border-color: var(--amber); color: var(--amber); background: rgba(245, 158, 11, 0.08);">
                ACTIVE CHALLENGE
              </div>
            </div>

            <div class="intel-doc-body">
              <p>
                <strong>TACTISCHE BRIEFING:</strong> Een echte veldagent moet te allen tijde alert en paraat zijn, maar moet ook <strong>bliksemsnel zijn glas kunnen leegdrinken</strong> wanneer de plicht roept en HQ plots het evacuatie-signaal geeft!
              </p>
              <p>
                <strong>DE OPDRACHT:</strong> Infiltreer undercover een café in Herentals en bestel aan de toog een pint (of een glas frisdrank/water voor wie geen alcohol drinkt). Trek een <strong>adje ('at') van start tot finish</strong>!
              </p>
              <p>
                <strong>HET BEWIJS:</strong> Film het adje van start tot finish op video met een <strong>lopende stopwatch</strong> (bv. op een tweede gsm) duidelijk zichtbaar in beeld. De agent of groep met de allersnelste tijd pakt de maximale bonuspunten van Gamemaster Vicce!
              </p>
            </div>

            <div class="intel-doc-footer">
              <span>AUTH: HUMINT DIRECTORATE // OPERATION AD FUNDUM</span>
              <div class="intel-barcode-bars"></div>
            </div>
          </article>

          <!-- Uploadzone voor Ad Fundum Video -->
          <div style="background: rgba(14, 20, 28, 0.92); border: 2px solid var(--amber); border-radius: 8px; padding: 1.05rem;">
            <div class="clue-label" style="color: var(--amber); margin-bottom: 0.35rem; font-size: 0.82rem;">
              📹 BEWIJSMATERIAAL UPLOAD // OPERATIE AD FUNDUM VIDEO
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.55rem;">
              Upload hier jullie video met de stopwatch duidelijk in beeld. Vermeld jullie chrono-tijd in de beschrijving!
            </p>
            <form class="photo-upload-form loc-photo-form" autocomplete="off" style="margin-top: 0.5rem;">
              <label class="file-input-label">
                <span>📹 Kies of maak Ad Fundum video</span>
                <input type="file" class="loc-photo-input" accept="video/*,image/*" style="display: none;" required />
              </label>
              <span class="loc-photo-filename" style="font-family: var(--font-mono); font-size: 0.76rem; color: var(--text-main);">Geen bestand gekozen</span>
              <input
                type="text"
                class="admin-input loc-photo-caption"
                placeholder="bv. Chrono: 3.84s - Café Den Beiaard - Agent Daan"
                style="margin-bottom: 0; flex: 1; min-width: 170px;"
                required
              />
              <button type="submit" class="btn btn-primary loc-photo-submit" style="flex: 0 0 auto; background: var(--amber); border-color: var(--amber); color: #000; font-weight: 800; padding: 0.6rem 1rem;">
                Upload Video naar HQ
              </button>
            </form>
            <div class="loc-photo-status" style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--amber); margin-top: 0.45rem; min-height: 1.1rem;"></div>
            <div class="photos-grid loc-photos-gallery"></div>
          </div>
        </div>
      `;
      list.appendChild(b2);

      const b2Header = b2.querySelector(".location-folder-header");
      b2Header.addEventListener("click", () => b2.classList.toggle("expanded"));
      setupBonusUploadForm(b2, "bonus_ad_fundum", "Bonus #02: Operatie Ad Fundum");

      // -------------------------------------------------------------
      // BONUS 3: Operatie Snack Attack (Red Gamemaster Vicce)
      // -------------------------------------------------------------
      const b3 = document.createElement("div");
      b3.className = "location-folder bonus-folder";
      b3.id = "loc-folder-bonus-snack";
      b3.innerHTML = `
        <button type="button" class="location-folder-header">
          <div class="location-folder-title">
            <span class="folder-icon">📁</span>
            <span class="loc-step-label" style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--amber); font-weight: 800;">BONUS #03:</span>
            <span>Operatie Snack Attack (Red Gamemaster Vicce)</span>
          </div>
          <div class="location-folder-badges">
            <span class="briefing-audio-pill" style="border-color: rgba(245, 158, 11, 0.4); color: var(--amber); background: rgba(245, 158, 11, 0.1);">
              ⭐ PROVIAND HQ (+100 PT)
            </span>
            <span class="loc-lock-badge" style="color: var(--amber); border-color: rgba(245, 158, 11, 0.45);">
              🍟 FYSIEKE LEVERING
            </span>
          </div>
        </button>

        <div class="location-folder-body">
          <article class="intel-doc-sheet doc-variant-tool" style="border-left-color: var(--amber); margin-bottom: 0.85rem;">
            <div class="intel-doc-top-tab" style="background: var(--amber); color: #000;">LOGISTIEKE NOODMISSIE // COMMANDOPOST KAPUCIJNENSTRAAT 7</div>
            <div class="intel-doc-header">
              <div class="intel-doc-brand">
                ${AGENCY_SEAL_SMALL_SVG}
                <div>
                  <div class="intel-doc-dept">LOGISTIEKE DIENST HQ // BEVOORRADING COMMANDOCENTRUM</div>
                  <div class="intel-doc-main-title">OPERATIE SNACK ATTACK // RED GAMEMASTER VICCE</div>
                  <div class="intel-doc-sub" style="color: var(--amber);">BATTERIJ VICCE: 1% // ACUTE HONGER</div>
                </div>
              </div>
              <div class="intel-doc-stamp" style="border-color: var(--amber); color: var(--amber); background: rgba(245, 158, 11, 0.08);">
                URGENT MISSION
              </div>
            </div>

            <div class="intel-doc-body">
              <p>
                <strong>NOODSITUATIE OP HQ:</strong> Gamemaster Vicce is al dagen- en nachtenlang onafgebroken bezig met het uitpluizen van deze duistere samenzwering, het coderen van het commandoportaal en het bewaken van de satellietverbindingen.
              </p>
              <p>
                Zijn energiepeil staat op 1% en zijn maag knort inmiddels luider dan de afluisterantennes. <strong>Hij heeft acute honger!</strong>
              </p>
              <p>
                <strong>DE OPDRACHT:</strong> Zorg dat Gamemaster Vicce niet omvalt van de honger: breng hem op het einde van de tocht een snack mee terug naar het Hoofdkwartier (Kapucijnenstraat 7) die hij écht lust (bv. van de frituur, bakkerij, nachtwinkel of café). De lekkerste snack levert koninklijke bonuspunten op van de Gamemaster!
              </p>
            </div>

            <div class="intel-doc-footer">
              <span>AUTH: GAMEMASTER VICCE // HQ PROVIAND PROTOCOL</span>
              <div class="intel-barcode-bars"></div>
            </div>
          </article>

          <!-- Optionele Teaser Foto Upload voor Snack -->
          <div style="background: rgba(14, 20, 28, 0.92); border: 2px solid var(--amber); border-radius: 8px; padding: 1.05rem;">
            <div class="clue-label" style="color: var(--amber); margin-bottom: 0.35rem; font-size: 0.82rem;">
              📷 OPTIONELE PREVIEW // FOTO VAN DE SNACK
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.55rem;">
              Hebben jullie al een snack geregeld voor Vicce? Upload hier alvast een teaser-foto om HQ warm te maken!
            </p>
            <form class="photo-upload-form loc-photo-form" autocomplete="off" style="margin-top: 0.5rem;">
              <label class="file-input-label">
                <span>📷 Kies of maak foto van de snack</span>
                <input type="file" class="loc-photo-input" accept="image/*,video/*" style="display: none;" required />
              </label>
              <span class="loc-photo-filename" style="font-family: var(--font-mono); font-size: 0.76rem; color: var(--text-main);">Geen bestand gekozen</span>
              <input
                type="text"
                class="admin-input loc-photo-caption"
                placeholder="bv. Frituur 't Hoekske - Bicky Burger voor Vicce"
                style="margin-bottom: 0; flex: 1; min-width: 170px;"
              />
              <button type="submit" class="btn btn-primary loc-photo-submit" style="flex: 0 0 auto; background: var(--amber); border-color: var(--amber); color: #000; font-weight: 800; padding: 0.6rem 1rem;">
                Upload Teaser naar HQ
              </button>
            </form>
            <div class="loc-photo-status" style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--amber); margin-top: 0.45rem; min-height: 1.1rem;"></div>
            <div class="photos-grid loc-photos-gallery"></div>
          </div>
        </div>
      `;
      list.appendChild(b3);

      const b3Header = b3.querySelector(".location-folder-header");
      b3Header.addEventListener("click", () => b3.classList.toggle("expanded"));
      setupBonusUploadForm(b3, "bonus_snack_vicce", "Bonus #03: Operatie Snack Attack");

      // -------------------------------------------------------------
      // BONUS 4: Operatie Volksstem (Overtuig de Derde Partij)
      // -------------------------------------------------------------
      const b4 = document.createElement("div");
      b4.className = "location-folder bonus-folder";
      b4.id = "loc-folder-bonus-volksstem";
      b4.innerHTML = `
        <button type="button" class="location-folder-header">
          <div class="location-folder-title">
            <span class="folder-icon">📁</span>
            <span class="loc-step-label" style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--amber); font-weight: 800;">BONUS #04:</span>
            <span>Operatie Volksstem (Overtuig de Derde Partij)</span>
          </div>
          <div class="location-folder-badges">
            <span class="briefing-audio-pill" style="border-color: rgba(245, 158, 11, 0.4); color: var(--amber); background: rgba(245, 158, 11, 0.1);">
              ⭐ PSY-OP (+150 PT)
            </span>
            <span class="loc-lock-badge" style="color: var(--amber); border-color: rgba(245, 158, 11, 0.45);">
              📢 6 VREEMDEN IN KOOR
            </span>
          </div>
        </button>

        <div class="location-folder-body">
          <article class="intel-doc-sheet doc-variant-tool" style="border-left-color: var(--amber); margin-bottom: 0.85rem;">
            <div class="intel-doc-top-tab" style="background: var(--amber); color: #000;">PSY-OPS STRATEGIE // MASSA-GETUIGENIS</div>
            <div class="intel-doc-header">
              <div class="intel-doc-brand">
                ${AGENCY_SEAL_SMALL_SVG}
                <div>
                  <div class="intel-doc-dept">PSYCHOLOGISCHE OORLOGSVOERING // OVERTUIG DERDE PARTIJ</div>
                  <div class="intel-doc-main-title">OPERATIE VOLKSSTEM // MASSALE GETUIGENIS</div>
                  <div class="intel-doc-sub" style="color: var(--amber);">VEREISTE: MINIMAAL 6 VOLSLAGEN VREEMDEN TEGELIJK</div>
                </div>
              </div>
              <div class="intel-doc-stamp" style="border-color: var(--amber); color: var(--amber); background: rgba(245, 158, 11, 0.08);">
                TOP VALUE (+150 PT)
              </div>
            </div>

            <div class="intel-doc-body">
              <p>
                <strong>TACTISCH DOELWIT:</strong> Om de louche derde partij definitief af te schrikken en te bewijzen dat heel Herentals pal achter de KSA staat, hebben we een overweldigende, massale volksgetuigenis nodig. Eén getuige is niet genoeg; we moeten tonen dat de hele stad in opstand komt!
              </p>
              <p>
                <strong>DE OPDRACHT:</strong> Verzamel <strong>minstens 6 volslagen vreemden</strong> (voorbijgangers op straat in Herentals) tegelijkertijd voor jullie smartphone-camera en laat hen synchroon, luid en vol overgave roepen:
              </p>
              <div class="intel-codeword-banner" style="background: #fef3c7; border: 2px dashed #d97706; margin: 0.75rem 0; padding: 0.85rem; border-radius: 6px; text-align: center;">
                <div style="font-size: 0.75rem; font-weight: 800; color: #b45309; text-transform: uppercase;">📢 VERPLICHTE SLOGAN (WOORD VOOR WOORD):</div>
                <div style="font-size: 1.15rem; font-weight: 800; color: #78350f; margin-top: 0.25rem;">
                  "Redt de KSA, de ware eigenaars van de erfpacht!"
                </div>
              </div>
              <p>
                <strong>HET BEWIJS:</strong> Film de 6 vreemden die dit tegelijk in koor scanderen en upload de video hier direct voor Gamemaster HQ. Succesvol volbrengen levert maar liefst <strong>+150 bonuspunten</strong> op!
              </p>
            </div>

            <div class="intel-doc-footer">
              <span>AUTH: PSY-OPS STRATEGY // SECTOR HERENTALS</span>
              <div class="intel-barcode-bars"></div>
            </div>
          </article>

          <!-- Video Uploadzone voor Koor -->
          <div style="background: rgba(14, 20, 28, 0.92); border: 2px solid var(--amber); border-radius: 8px; padding: 1.05rem;">
            <div class="clue-label" style="color: var(--amber); margin-bottom: 0.35rem; font-size: 0.82rem;">
              📹 BEWIJSMATERIAAL UPLOAD // VIDEO 6 VREEMDEN IN KOOR
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.55rem;">
              Upload hier jullie video waarop de 6 vreemden tegelijkertijd de leuze roepen!
            </p>
            <form class="photo-upload-form loc-photo-form" autocomplete="off" style="margin-top: 0.5rem;">
              <label class="file-input-label">
                <span>📹 Kies of maak koor-video</span>
                <input type="file" class="loc-photo-input" accept="video/*,image/*" style="display: none;" required />
              </label>
              <span class="loc-photo-filename" style="font-family: var(--font-mono); font-size: 0.76rem; color: var(--text-main);">Geen bestand gekozen</span>
              <input
                type="text"
                class="admin-input loc-photo-caption"
                placeholder="bv. 7 voorbijgangers aan de kiosk - Groep Rood"
                style="margin-bottom: 0; flex: 1; min-width: 170px;"
                required
              />
              <button type="submit" class="btn btn-primary loc-photo-submit" style="flex: 0 0 auto; background: var(--amber); border-color: var(--amber); color: #000; font-weight: 800; padding: 0.6rem 1rem;">
                Upload Video naar HQ (+150 PT)
              </button>
            </form>
            <div class="loc-photo-status" style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--amber); margin-top: 0.45rem; min-height: 1.1rem;"></div>
            <div class="photos-grid loc-photos-gallery"></div>
          </div>
        </div>
      `;
      list.appendChild(b4);

      const b4Header = b4.querySelector(".location-folder-header");
      b4Header.addEventListener("click", () => b4.classList.toggle("expanded"));
      setupBonusUploadForm(b4, "bonus_volksstem", "Bonus #04: Operatie Volksstem");

      // -------------------------------------------------------------
      // BONUS 5: Operatie Speurhond (K9 Rekruteringsbureau)
      // -------------------------------------------------------------
      const b5 = document.createElement("div");
      b5.className = "location-folder bonus-folder";
      b5.id = "loc-folder-bonus-speurhond";
      b5.innerHTML = `
        <button type="button" class="location-folder-header">
          <div class="location-folder-title">
            <span class="folder-icon">📁</span>
            <span class="loc-step-label" style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--amber); font-weight: 800;">BONUS #05:</span>
            <span>Operatie Speurhond (K9 Rekrutering)</span>
          </div>
          <div class="location-folder-badges">
            <span class="briefing-audio-pill" style="border-color: rgba(245, 158, 11, 0.4); color: var(--amber); background: rgba(245, 158, 11, 0.1);">
              ⭐ K9-REKRUUT (+50 PT)
            </span>
            <span class="loc-lock-badge" style="color: var(--amber); border-color: rgba(245, 158, 11, 0.45);">
              🐕 FOTO VEREIST
            </span>
          </div>
        </button>

        <div class="location-folder-body">
          <article class="intel-doc-sheet doc-variant-tool" style="border-left-color: var(--amber); margin-bottom: 0.85rem;">
            <div class="intel-doc-top-tab" style="background: var(--amber); color: #000;">K9 TACTICAL SQUAD // VIERVOETIGE INLICHTINGENDIENST</div>
            <div class="intel-doc-header">
              <div class="intel-doc-brand">
                ${AGENCY_SEAL_SMALL_SVG}
                <div>
                  <div class="intel-doc-dept">K9 REKRUTERINGSBUREAU HQ // TACTISCHE SPEURDIENST</div>
                  <div class="intel-doc-main-title">OPERATIE SPEURHOND // K9 REKRUTERINGSSELECTIE</div>
                  <div class="intel-doc-sub" style="color: var(--amber);">VIERVOETIGE VERSTERKING VOOR HQ HERENTALS</div>
                </div>
              </div>
              <div class="intel-doc-stamp" style="border-color: var(--amber); color: var(--amber); background: rgba(245, 158, 11, 0.08);">
                K9 SQUAD
              </div>
            </div>

            <div class="intel-doc-body">
              <p>
                <strong>CAPACITEITSTEKORT OP HQ:</strong> De inlichtingendienst kampt met een acuut gebrek aan getrainde speurhonden om geursporen van het stadsbestuur te volgen en de geheime documenten op HQ te bewaken.
              </p>
              <p>
                <strong>DE OPDRACHT:</strong> HQ zoekt nog een speurhond. Vind een mogelijke kandidaat, neem een foto met de hond en upload hem als officieel sollicitatiedossier voor Gamemaster Vicce!
              </p>
            </div>

            <div class="intel-doc-footer">
              <span>AUTH: K9 DIRECTORATE // AGENT RECRUITMENT</span>
              <div class="intel-barcode-bars"></div>
            </div>
          </article>

          <!-- Foto Uploadzone voor Speurhond -->
          <div style="background: rgba(14, 20, 28, 0.92); border: 2px solid var(--amber); border-radius: 8px; padding: 1.05rem;">
            <div class="clue-label" style="color: var(--amber); margin-bottom: 0.35rem; font-size: 0.82rem;">
              📷 BEWIJSMATERIAAL UPLOAD // FOTO KANDIDAAT-SPEURHOND
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.55rem;">
              Upload hier jullie foto met de kandidaat-speurhond en vermeld zijn/haar 'codenaam'!
            </p>
            <form class="photo-upload-form loc-photo-form" autocomplete="off" style="margin-top: 0.5rem;">
              <label class="file-input-label">
                <span>📷 Kies of maak foto van speurhond</span>
                <input type="file" class="loc-photo-input" accept="image/*,video/*" style="display: none;" required />
              </label>
              <span class="loc-photo-filename" style="font-family: var(--font-mono); font-size: 0.76rem; color: var(--text-main);">Geen bestand gekozen</span>
              <input
                type="text"
                class="admin-input loc-photo-caption"
                placeholder="bv. Kandidaat 'Bobi' aan de Zandstraat - Groep Geel"
                style="margin-bottom: 0; flex: 1; min-width: 170px;"
                required
              />
              <button type="submit" class="btn btn-primary loc-photo-submit" style="flex: 0 0 auto; background: var(--amber); border-color: var(--amber); color: #000; font-weight: 800; padding: 0.6rem 1rem;">
                Upload Sollicitatie (+50 PT)
              </button>
            </form>
            <div class="loc-photo-status" style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--amber); margin-top: 0.45rem; min-height: 1.1rem;"></div>
            <div class="photos-grid loc-photos-gallery"></div>
          </div>
        </div>
      `;
      list.appendChild(b5);

      const b5Header = b5.querySelector(".location-folder-header");
      b5Header.addEventListener("click", () => b5.classList.toggle("expanded"));
      setupBonusUploadForm(b5, "bonus_speurhond", "Bonus #05: Operatie Speurhond");
    }

    // Refresh galleries for bonus uploads if info has updated photos
    const b2 = document.getElementById("loc-folder-bonus-adfundum");
    if (b2) renderBonusGallery(b2, "bonus_ad_fundum", info);

    const b3 = document.getElementById("loc-folder-bonus-snack");
    if (b3) renderBonusGallery(b3, "bonus_snack_vicce", info);

    const b4 = document.getElementById("loc-folder-bonus-volksstem");
    if (b4) renderBonusGallery(b4, "bonus_volksstem", info);

    const b5 = document.getElementById("loc-folder-bonus-speurhond");
    if (b5) renderBonusGallery(b5, "bonus_speurhond", info);
  }

  // =========================================================================
  // 6 LOCATIE-MAPJES (Gedeeld binnen het team + unieke route-volgorde per groep!)
  // =========================================================================
  function ensureLocationsSection() {
    if (!contentEl) return;
    let section = document.getElementById("player-locations-section");
    if (section) {
      ensureBriefingFolder();
      ensureBonusFolders(latestPlayerInfo);
      return;
    }

    section = document.createElement("div");
    section.id = "player-locations-section";
    section.className = "locations-section";

    const locaties = SPEL_CONFIG.locaties || [];
    section.innerHTML = `
      <div class="live-toast-tag" style="margin-bottom: 0.35rem;">&gt;_ DOSSIER MAPPEN HERENTALS</div>
      <p id="locations-route-subtitle" style="font-size: 0.9rem; color: var(--text-muted);">
        Bekijk hieronder eerst de algemene Briefing. Open daarna elk locatie-mapje met de code die je op die locatie in Herentals vindt!
      </p>

      <!-- MAP 0: INTRO / BRIEFING (ALTIJD ONTGRENDELD, GEEN APARTE PIN) -->
      <div id="briefing-folder-container"></div>

      <!-- BONUSDOSSIERS (5 GEHEIME NEVENMISSIES) -->
      <div id="bonus-folders-container"></div>

      <!-- DE 6 LOCATIE-MAPPEN (UNIEKE ROUTE PER GROEP) -->
      <div id="locations-list" class="locations-list"></div>
    `;

    contentEl.appendChild(section);
    ensureBriefingFolder();
    ensureBonusFolders(latestPlayerInfo);
    const listEl = section.querySelector("#locations-list");

    locaties.forEach((loc, idx) => {
      const folder = document.createElement("div");
      folder.className = "location-folder";
      folder.id = `loc-folder-${loc.id}`;
      folder.setAttribute("data-loc-id", loc.id);

      const customMissionEl = document.querySelector(
        `[data-locatie-opdracht="${loc.id}"]`
      );
      const missionHtml = customMissionEl
        ? customMissionEl.innerHTML
        : loc.opdracht;

  const AGENCY_SEAL_SMALL_SVG = `
    <svg class="intel-doc-seal" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" stroke="#0f172a" stroke-width="2.5" fill="#f1ede2"/>
      <circle cx="32" cy="32" r="24" stroke="#0f172a" stroke-width="1.2" stroke-dasharray="2 2"/>
      <path d="M32 10 L37 25 L52 25 L40 34 L44 49 L32 40 L20 49 L24 34 L12 25 L27 25 Z" fill="#0f172a"/>
      <circle cx="32" cy="32" r="6" fill="#f8f6f0" stroke="#0f172a" stroke-width="1.5"/>
    </svg>
  `;

  function buildVeldToolDocumentHtml(loc) {
    const vt = loc.veldTool;
    if (!vt) return "";

    if (vt.type === "mol_telefoon") {
      return `
        <article class="intel-doc-sheet doc-variant-tool">
          <div class="intel-doc-top-tab tab-green">BIJLAGE B // TELEFOON-PROTOCOL &amp; GEHEIM CODEWOORD</div>
          <div class="intel-doc-header">
            <div class="intel-doc-brand">
              ${AGENCY_SEAL_SMALL_SVG}
              <div>
                <div class="intel-doc-dept">HUMINT COMMUNICATIE-EENHEID // SECTOR ZANDPOORT</div>
                <div class="intel-doc-main-title">DIRECT CONTACT MET INFILTRANT JEUGDDIENST</div>
                <div class="intel-doc-sub">CODENAAM: "DE POORTWACHTER" // VERIFICATIE VEREIST</div>
              </div>
            </div>
            <div class="intel-doc-stamp stamp-green">VERIFIED LINE</div>
          </div>

          <div class="intel-doc-body">
            <p>${vt.instructie || ""}</p>
            <div class="intel-codeword-banner">
              <div class="intel-codeword-label">🔑 GEHEIM CODEWOORD (ZEG DIT ZODRA HIJ OPNEEMT):</div>
              <div class="intel-codeword-value">"${vt.codewoord}"</div>
            </div>
            <div style="background: #f1ede2; border: 1px solid #94a3b8; padding: 0.65rem 0.8rem; margin-top: 0.55rem; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem;">
              <div>
                <div style="font-size: 0.65rem; font-weight: 800; color: #475569; text-transform: uppercase;">BEVEILIGD GSM-NUMMER MOL:</div>
                <div style="font-size: 1.15rem; font-weight: 800; color: #0f172a; letter-spacing: 0.05em;">${vt.telefoonWeergave}</div>
              </div>
              <span class="doc-highlight-yellow" style="font-size: 0.72rem;">ACTIEF TOT 22u00</span>
            </div>
            <a href="${vt.telefoonHref}" class="intel-call-btn">
              📞 BEL DE MOL DIRECT (${vt.telefoonWeergave})
            </a>
          </div>

          <div class="intel-doc-footer">
            <span>AUTH: HUMINT-DIRECTORATE // ZANDPOORT</span>
            <div class="intel-barcode-bars"></div>
          </div>
        </article>
      `;
    }

    if (vt.type === "avondlied_tekst") {
      return `
        <article class="intel-doc-sheet doc-variant-tool">
          <div class="intel-doc-top-tab tab-green">BIJLAGE B // ARCHIEFSTUK #1928-KSA</div>
          <div class="intel-doc-header">
            <div class="intel-doc-brand">
              ${AGENCY_SEAL_SMALL_SVG}
              <div>
                <div class="intel-doc-dept">HISTORISCH ARCHIEF // KSA HERENTALS</div>
                <div class="intel-doc-main-title">${vt.titel || "ORIGINELE TEKST AVONDLIED"}</div>
                <div class="intel-doc-sub">VOOR GEBRUIK TIJDENS VIDEO-OPNAME IN HET BEGIJNHOF</div>
              </div>
            </div>
            <div class="intel-doc-stamp stamp-green">ARCHIVE COPY</div>
          </div>

          <div class="intel-doc-body">
            <p>${vt.instructie || ""}</p>
            <div class="intel-lyric-sheet">${vt.tekst || ""}</div>
          </div>

          <div class="intel-doc-footer">
            <span>REF: #KSA-AVONDLIED-ODE // BEGIJNHOF</span>
            <div class="intel-barcode-bars"></div>
          </div>
        </article>
      `;
    }

    if (vt.type === "interview_vragen") {
      const vragenList = (vt.vragen || [])
        .map((v) => `<li style="margin-bottom: 0.35rem;"><strong>&gt;</strong> <span>${v}</span></li>`)
        .join("");
      return `
        <article class="intel-doc-sheet doc-variant-tool">
          <div class="intel-doc-top-tab tab-green">BIJLAGE B // PERS- &amp; GETUIGENprotocol</div>
          <div class="intel-doc-header">
            <div class="intel-doc-brand">
              ${AGENCY_SEAL_SMALL_SVG}
              <div>
                <div class="intel-doc-dept">PSYCHOLOGISCHE OPERATIES (PSYOPS) // BOVENPOORT</div>
                <div class="intel-doc-main-title">${vt.titel || "RICHTVRAGEN VOOR DE KROONGETUIGE"}</div>
                <div class="intel-doc-sub">DOEL: 3e PARTIJ OVERTUIGEN OM DE KOOP AF TE BREKEN</div>
              </div>
            </div>
            <div class="intel-doc-stamp stamp-green">PRESS BRIEF</div>
          </div>

          <div class="intel-doc-body">
            <p>Gebruik onderstaande richtlijnen tijdens het filmen van jullie voorbijganger aan de Bovenpoort:</p>
            <div class="intel-checklist-box">
              <div class="intel-checklist-title">🎙️ VERPLICHTE ELEMENTEN IN HET INTERVIEW:</div>
              <ul class="intel-checklist-list">${vragenList}</ul>
            </div>
          </div>

          <div class="intel-doc-footer">
            <span>DOEL: CONTRACT ART. 14.2 ACTIVEREN</span>
            <div class="intel-barcode-bars"></div>
          </div>
        </article>
      `;
    }

    if (vt.type === "sigint_hack") {
      return `
        <article class="intel-doc-sheet doc-variant-tool">
          <div class="intel-doc-top-tab tab-green">BIJLAGE B // INTERACTIEVE WIFI &amp; SIGINT HACK-MODULE</div>
          <div class="intel-doc-header">
            <div class="intel-doc-brand">
              ${AGENCY_SEAL_SMALL_SVG}
              <div>
                <div class="intel-doc-dept">CYBER &amp; SIGINT DIVISION // ONDERGRONDS KNOOPPUNT</div>
                <div class="intel-doc-main-title">${vt.titel || "ONDERGRONDSE STAD-WIFI HACKEN"}</div>
                <div class="intel-doc-sub">FREQUENTIE: ${vt.frequentie || "144.80 MHz"} // NODE-PK04 STADSPARK</div>
              </div>
            </div>
            <div class="intel-doc-stamp stamp-green">LIVE HACKER-TOOL</div>
          </div>

          <div class="intel-doc-body">
            <p>Sta midden in het <strong>Stadspark</strong> bovenop de ondergrondse leidingen van de stad en start hieronder de <strong>geautomatiseerde SIGINT Wi-Fi &amp; Glasvezel Hack</strong> om de deal van 22u00 te saboteren:</p>

            <div class="cyber-hack-terminal">
              <div class="cyber-hack-topbar">
                <span style="color: #10b981; font-weight: 800;">&gt;_ SIGINT_EXPLOIT_V4.2 // TARGET: STAD_HERENTALS_WIFI</span>
                <span class="hack-status-badge" style="background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid #ef4444; padding: 0.12rem 0.5rem; font-weight: 800;">
                  🔴 STAD-WIFI: ONLINE (BEVEILIGD)
                </span>
              </div>

              <!-- Matrix Hex Stream + Live 144.80 MHz Oscilloscope Golf -->
              <div class="cyber-hack-visual-stage">
                <canvas class="hack-matrix-canvas" width="520" height="118"></canvas>
                <div class="cyber-hack-overlay-hud">
                  <div class="cyber-hack-hud-row">
                    <span class="hack-hud-freq">📡 UPLINK: 144.80 MHz // WPA3-ENT</span>
                    <span class="hack-hud-key">AES-KEY: [██:██:██:██:██:██]</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <div>
                      <div style="font-size: 0.62rem; color: #94a3b8; text-transform: uppercase;">STATUS ONDERGRONDSE HACK:</div>
                      <div class="hack-phase-title" style="font-size: 0.8rem; font-weight: 800; color: #10b981;">WACHT OP START-SIGNAAL IN STADSPARK...</div>
                    </div>
                    <div class="cyber-hack-big-percent hack-percent-num">0%</div>
                  </div>
                </div>
              </div>

              <!-- Duidelijke Geanimeerde Hacker Progress Bar -->
              <div class="cyber-progress-wrap">
                <div class="cyber-progress-header">
                  <span class="hack-progress-sub">VOORTGANG WIFI &amp; GLASVEZEL OVERRIDE</span>
                  <span class="hack-progress-eta" style="color: #fde047; font-weight: 700;">GEREED VOOR INJECTIE</span>
                </div>
                <div class="cyber-progress-track">
                  <div class="cyber-progress-fill hack-progress-fill" style="width: 0%;"></div>
                </div>
              </div>

              <!-- Live Hacker Telemetrie Counters -->
              <div class="cyber-telemetry-pills">
                <div class="cyber-telemetry-pill">
                  <span class="cyber-telemetry-label">PACKETS INJECTED</span>
                  <span class="cyber-telemetry-val hack-pkt-val">0 / 8.192 PKTS</span>
                </div>
                <div class="cyber-telemetry-pill">
                  <span class="cyber-telemetry-label">FIREWALL NODES</span>
                  <span class="cyber-telemetry-val hack-nodes-val" style="color: #fde047;">0 / 6 GEKRAAKT</span>
                </div>
                <div class="cyber-telemetry-pill">
                  <span class="cyber-telemetry-label">BANK-DEAL 22u00</span>
                  <span class="cyber-telemetry-val hack-deal-val" style="color: #f87171;">ACTIEF (NIET GEBLOKKEERD)</span>
                </div>
              </div>

              <!-- Live Scrolling Hacker Terminal Console -->
              <div class="cyber-log-console hack-log-console">
                <div class="cyber-log-line log-ok">[SYS] SIGINT Field-Unit verbonden met ondergrondse antenne Stadspark...</div>
                <div class="cyber-log-line">[SYS] Doelwit gedetecteerd: STADHUIS_DEAL_2200_WIFI (Node PK-04).</div>
                <div class="cyber-log-line log-warn">[WAIT] Druk hieronder op 'START WIFI-HACK' om de aanval te starten...</div>
              </div>

              <!-- Bedieningsknoppen + Geslaagd-Melding -->
              <div style="display: flex; flex-direction: column; gap: 0.55rem;">
                <button type="button" class="btn btn-danger hack-start-btn" style="width: 100%; justify-content: center; font-size: 0.9rem; font-weight: 800; padding: 0.78rem 1rem; letter-spacing: 0.04em;">
                  ⚡ START ONDERGRONDSE WIFI-HACK (144.80 MHz)
                </button>

                <div class="hack-complete-banner" style="display: none; background: rgba(16,185,129,0.18); border: 2px solid #10b981; color: #ecfdf5; padding: 0.8rem; border-radius: 6px; text-align: center;">
                  <div style="font-size: 0.92rem; font-weight: 800; color: #6ee7b7; letter-spacing: 0.04em;">
                    🚨 SYSTEM BREACHED // WIFI &amp; STAD-CONNECTIE VOLLEDIG PLATGELEGD (100%)!
                  </div>
                  <div style="font-size: 0.76rem; color: #d1fae5; margin-top: 0.25rem;">
                    De bankoverschrijving en communicatie van 22u00 zijn geblokkeerd via het Stadspark. Neem nu jullie groeps-/hackerfoto en upload hem hieronder!
                  </div>
                  <button type="button" class="text-btn hack-replay-btn" style="margin-top: 0.45rem; font-size: 0.72rem; color: #fde047;">
                    ↻ Speel Hack-Animatie Opnieuw
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="intel-doc-footer">
            <span>TARGET: STADHUIS UPLINK // STADSPARK</span>
            <div class="intel-barcode-bars"></div>
          </div>
        </article>
      `;
    }

    if (vt.type === "blackmail_instructie" || vt.type === "forensisch_protocol") {
      const puntenList = (vt.punten || [])
        .map((p) => `<li style="margin-bottom: 0.35rem;"><strong>✓</strong> <span>${p}</span></li>`)
        .join("");
      return `
        <article class="intel-doc-sheet doc-variant-tool">
          <div class="intel-doc-top-tab tab-green">BIJLAGE B // OPERATIONEEL VELD-PROTOCOL</div>
          <div class="intel-doc-header">
            <div class="intel-doc-brand">
              ${AGENCY_SEAL_SMALL_SVG}
              <div>
                <div class="intel-doc-dept">SPECIAL OPERATIONS // VELD-INSTRUCTIEKAART</div>
                <div class="intel-doc-main-title">${vt.titel || "INSTRUCTIES VOOR BEWIJSMATERIAAL"}</div>
                <div class="intel-doc-sub">STRIKT NALEVEREN VOOR GOEDKEURING OP HQ</div>
              </div>
            </div>
            <div class="intel-doc-stamp stamp-green">FIELD ORDER</div>
          </div>

          <div class="intel-doc-body">
            <div class="intel-checklist-box">
              <div class="intel-checklist-title">📋 STAPPENPLAN OP DEZE LOCATIE:</div>
              <ul class="intel-checklist-list">${puntenList}</ul>
            </div>
          </div>

          <div class="intel-doc-footer">
            <span>RETURN TO HQ: KAPUCIJNENSTRAAT 7</span>
            <div class="intel-barcode-bars"></div>
          </div>
        </article>
      `;
    }

    return "";
  }

  function buildLocationOfficialDocumentsHtml(loc, idx, missionHtml) {
    const checklistItems = (loc.vereistBewijs || [])
      .map((item) => `<li><strong>☑</strong> <span>${item}</span></li>`)
      .join("");

    const checklistHtml = checklistItems
      ? `
        <div class="intel-checklist-box">
          <div class="intel-checklist-title">✓ VEREIST BEWIJSMATERIAAL VOOR DEZE SECTOR:</div>
          <ul class="intel-checklist-list">${checklistItems}</ul>
        </div>
      `
      : "";

    const bonusDocHtml = loc.bonusOpdracht
      ? `
        <div class="intel-bonus-box">
          <div class="intel-bonus-title">⭐ EXTRA BONUSOPDRACHT (VOOR EXTRA PUNTEN &amp; EINDWINST):</div>
          <div>${loc.bonusOpdracht}</div>
        </div>
      `
      : "";

    const gelekt = loc.gelektDocument;
    const gelektDocHtml = gelekt
      ? `
        <article class="intel-doc-sheet doc-variant-leaked">
          <div class="intel-doc-top-tab tab-red">BIJLAGE A // ONDERSCHEPT BEWIJSSTUK (VERTROUWELIJK)</div>
          <div class="intel-doc-header">
            <div class="intel-doc-brand">
              ${AGENCY_SEAL_SMALL_SVG}
              <div>
                <div class="intel-doc-dept">GEHEIME INLICHTINGENDIENST // INTERCEPT ARCHIVE</div>
                <div class="intel-doc-main-title">${gelekt.titel}</div>
                <div class="intel-doc-sub">${gelekt.stempel || "CLASSIFIED EXHIBIT"}</div>
              </div>
            </div>
            <div class="intel-doc-stamp">LEAKED // HQ</div>
          </div>
          <div class="intel-doc-body">
            ${gelekt.inhoud}
          </div>
          <div class="intel-doc-footer">
            <span>DOSSIER-FRAGMENT // OPERATIE ERFPACHT 22u00</span>
            <div class="intel-barcode-bars"></div>
          </div>
        </article>
      `
      : "";

    const veldToolDocHtml = buildVeldToolDocumentHtml(loc);

    return `
      <div class="folder-documents-desk">
        <!-- DOCUMENT 1: Officiële Opdrachtbriefing voor deze sector -->
        <article class="intel-doc-sheet">
          <div class="intel-doc-top-tab">OFFICIEEL MISSIE-BEVEL // SECTOR #0${idx + 1} (${loc.naam.toUpperCase()})</div>
          <div class="intel-doc-header">
            <div class="intel-doc-brand">
              ${AGENCY_SEAL_SMALL_SVG}
              <div>
                <div class="intel-doc-dept">CENTRAL INTELLIGENCE &amp; SIGINT DIRECTORATE // HQ</div>
                <div class="intel-doc-main-title">VELDOPDRACHT: ${loc.naam}</div>
                <div class="intel-doc-sub">OPERATIE: ERFPACHT // DEADLINE: VANAVOND 22u00 STIPT</div>
              </div>
            </div>
            <div class="intel-doc-stamp">TOP SECRET</div>
          </div>

          <div class="intel-doc-meta-grid">
            <div class="intel-doc-meta-cell">
              <span class="intel-doc-meta-label">DOELWIT LOCATIE</span>
              <span class="intel-doc-meta-val">${loc.naam} (${loc.adres || "2200 Herentals"})</span>
            </div>
            <div class="intel-doc-meta-cell">
              <span class="intel-doc-meta-label">SECTOR-CODE</span>
              <span class="intel-doc-meta-val"><span class="doc-highlight-yellow">${loc.code}</span> // ONTGRENDELD</span>
            </div>
          </div>

          <div class="intel-doc-body">
            <p><strong>INSTRUCTIE VAN HOOFDKWARTIER:</strong> ${missionHtml}</p>
            ${checklistHtml}
            ${bonusDocHtml}
          </div>

          <div class="intel-doc-footer">
            <span>GAMEMASTER HQ // KAPUCIJNENSTRAAT 7</span>
            <div class="intel-barcode-bars"></div>
          </div>
        </article>

        <!-- DOCUMENT 2: Gelekt Bewijsstuk / Onderschept Document (Overeenkomst, Tap, Mol-fiche, ...) -->
        ${gelektDocHtml}

        <!-- DOCUMENT 3: Specifieke Veld-Tool (Belkaart + Codewoord, Avondlied, Richtvragen, Hack-terminal, ...) -->
        ${veldToolDocHtml}
      </div>
    `;
  }

      const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${loc.adres || loc.naam}, 2200 Herentals`
      )}`;

      folder.innerHTML = `
        <button type="button" class="location-folder-header">
          <div class="location-folder-title">
            <span class="folder-icon">📁</span>
            <span class="loc-step-label" style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--accent);">LOCATIE ${idx + 1}:</span>
            <span>${loc.naam}</span>
          </div>
          <div class="location-folder-badges">
            <span class="loc-photo-badge" style="color: var(--accent); display: none;"></span>
            <span class="loc-lock-badge">🔒 VERGRENDELD</span>
          </div>
        </button>

        <div class="location-folder-body">
          <div style="margin-bottom: 0.9rem; padding-bottom: 0.75rem; border-bottom: 1px dashed var(--border-color); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem;">
            <div>
              <div style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--accent);">📍 ${loc.adres || "2200 Herentals"}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${loc.beschrijving || ""}</div>
            </div>
            <a href="${gmapsUrl}" target="_blank" rel="noopener" class="back-link" style="font-size: 0.74rem; padding: 0.35rem 0.65rem;">
              🗺️ Route in Google Maps &rarr;
            </a>
          </div>

          <!-- Locatie-specifieke berichten van het Message Board -->
          <div class="loc-board-messages"></div>

          <!-- Vergrendelde weergave: vraag om locatiecode -->
          <div class="loc-locked-view">
            <p style="font-size: 0.88rem; color: var(--text-muted);">
              Voer de locatiecode van <strong>${loc.naam}</strong> in om dit mapje te ontgrendelen:
            </p>
            <form class="loc-code-form" autocomplete="off">
              <input
                type="text"
                class="loc-code-input"
                placeholder="Code voor ${loc.naam}..."
                autocapitalize="none"
                autocorrect="off"
                spellcheck="false"
                enterkeyhint="go"
                required
              />
              <button type="submit" class="btn btn-primary" style="flex: 0 0 auto; padding: 0.6rem 1rem;">
                Open Mapje
              </button>
            </form>
            <div class="loc-error-msg" style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--danger); margin-top: 0.45rem; min-height: 1.1rem;"></div>
          </div>

          <!-- Ontgrendelde weergave: Officiële Geheime Dienst Documentjes + Uploadzone -->
          <div class="loc-unlocked-view" style="display: none;">
            ${buildLocationOfficialDocumentsHtml(loc, idx, missionHtml)}

            <div style="background: rgba(14, 20, 28, 0.92); border: 2px solid var(--accent); border-radius: 8px; padding: 1.05rem;">
              <div class="clue-label" style="color: var(--accent); margin-bottom: 0.35rem; font-size: 0.82rem;">
                ${loc.uploadTitel || `📷🎬 BEWIJSMATERIAAL UPLOADZONE // MAPJE ${loc.naam.toUpperCase()}`}
              </div>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.55rem;">
                ${loc.uploadHint || "Foto's en video's die hier worden geüpload zijn direct zichtbaar voor je teamgenoten én voor HQ."}
              </p>
              <form class="photo-upload-form loc-photo-form" autocomplete="off" style="margin-top: 0.5rem;">
                <label class="file-input-label">
                  <span>📷🎬 Kies of maak foto / video</span>
                  <input type="file" class="loc-photo-input" accept="image/*,video/*" style="display: none;" required />
                </label>
                <span class="loc-photo-filename" style="font-family: var(--font-mono); font-size: 0.76rem; color: var(--text-main);">Geen bestand gekozen</span>
                <input
                  type="text"
                  class="admin-input loc-photo-caption"
                  placeholder="${loc.id === 'zandpoort' ? 'Beschrijving tagmark (bv. logo van onze groep)' : 'Opmerking voor HQ (bv. hoofdopdracht of bonusopdracht)'}"
                  style="margin-bottom: 0; flex: 1; min-width: 160px;"
                />
                <button type="submit" class="btn btn-primary loc-photo-submit" style="flex: 0 0 auto; padding: 0.6rem 1rem;">
                  ${loc.uploadKnopTekst || `Upload Bewijs in ${loc.naam}`}
                </button>
              </form>
              <div class="loc-photo-status" style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--accent); margin-top: 0.45rem; min-height: 1.1rem;"></div>
              <div class="photos-grid loc-photos-gallery"></div>
            </div>
          </div>
        </div>
      `;

      const headerBtn = folder.querySelector(".location-folder-header");
      const codeForm = folder.querySelector(".loc-code-form");
      const codeInput = folder.querySelector(".loc-code-input");
      const codeError = folder.querySelector(".loc-error-msg");
      const photoForm = folder.querySelector(".loc-photo-form");
      const photoInput = folder.querySelector(".loc-photo-input");
      const photoFilename = folder.querySelector(".loc-photo-filename");
      const photoCaption = folder.querySelector(".loc-photo-caption");
      const photoSubmit = folder.querySelector(".loc-photo-submit");
      const photoStatus = folder.querySelector(".loc-photo-status");

      headerBtn.addEventListener("click", () => {
        const isExpanded = folder.classList.toggle("expanded");
        if (isExpanded && !isLocationUnlocked(loc.id)) {
          setTimeout(() => codeInput && codeInput.focus(), 50);
        }
      });

      codeForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const entered = codeInput.value.trim().toLowerCase();
        const expected = String(loc.code || "").trim().toLowerCase();
        const master = String(SPEL_CONFIG.masterCode || "").trim().toLowerCase();

        if (entered && (entered === expected || (master && entered === master))) {
          codeError.textContent = "";
          await unlockLocationForTeam(loc.id);
          updateLocationFolderState(folder, loc);
        } else {
          codeError.textContent = `Ongeldige code voor ${loc.naam}.`;
          codeInput.select();
        }
      });

      photoInput.addEventListener("change", () => {
        if (photoInput.files && photoInput.files[0]) {
          photoFilename.textContent = photoInput.files[0].name;
        } else {
          photoFilename.textContent = "Geen foto gekozen";
        }
      });

      photoForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!photoInput.files || !photoInput.files[0]) return;
        const file = photoInput.files[0];

        photoSubmit.disabled = true;
        photoSubmit.textContent = "Uploaden...";
        photoStatus.textContent = `Foto wordt in mapje ${loc.naam} geplaatst...`;

        try {
          await ScoreService.uploadPlayerPhoto(
            playerId,
            file,
            photoCaption.value,
            loc.id,
            loc.naam
          );
          photoInput.value = "";
          photoCaption.value = "";
          photoFilename.textContent = "Geen foto gekozen";
          photoStatus.textContent = `✓ Foto toegevoegd aan ${loc.naam}!`;
          setTimeout(() => {
            if (photoStatus.textContent.startsWith("✓")) {
              photoStatus.textContent = "";
            }
          }, 4500);
        } catch (err) {
          photoStatus.textContent = "Fout bij uploaden. Probeer opnieuw.";
        } finally {
          photoSubmit.disabled = false;
          photoSubmit.textContent = loc.uploadKnopTekst || `Upload Bewijs in ${loc.naam}`;
        }
      });

      // Interactieve SIGINT Wi-Fi Hacker-Animatie + Progress Bar in mapje Stadspark
      const cyberTerminal = folder.querySelector(".cyber-hack-terminal");
      const matrixCanvas = folder.querySelector(".hack-matrix-canvas");
      const hackStartBtn = folder.querySelector(".hack-start-btn");
      const hackReplayBtn = folder.querySelector(".hack-replay-btn");
      const hackProgressFill = folder.querySelector(".hack-progress-fill");
      const hackPercentNum = folder.querySelector(".hack-percent-num");
      const hackPhaseTitle = folder.querySelector(".hack-phase-title");
      const hackProgressEta = folder.querySelector(".hack-progress-eta");
      const hackHudFreq = folder.querySelector(".hack-hud-freq");
      const hackHudKey = folder.querySelector(".hack-hud-key");
      const hackPktVal = folder.querySelector(".hack-pkt-val");
      const hackNodesVal = folder.querySelector(".hack-nodes-val");
      const hackDealVal = folder.querySelector(".hack-deal-val");
      const hackLogConsole = folder.querySelector(".hack-log-console");
      const hackCompleteBanner = folder.querySelector(".hack-complete-banner");
      const hackStatusBadge = folder.querySelector(".hack-status-badge");

      if (cyberTerminal && matrixCanvas && hackStartBtn) {
        let hackProgress = 0;
        let hackRunning = false;
        let hackCompleted = false;
        let hackTimer = null;
        let wavePhase = 0;

        const ctx = matrixCanvas.getContext("2d");
        const cols = 32;
        const drops = Array.from({ length: cols }, () => Math.random() * 118);
        const chars = "0123456789ABCDEF@#$%&*";

        function drawMatrixAndSignal() {
          if (!ctx) return;
          const w = matrixCanvas.width;
          const h = matrixCanvas.height;

          ctx.fillStyle = "rgba(2, 4, 7, 0.24)";
          ctx.fillRect(0, 0, w, h);

          // Matrix Hex Rain
          ctx.font = "bold 11px monospace";
          for (let i = 0; i < cols; i++) {
            const ch = chars[Math.floor(Math.random() * chars.length)];
            if (hackCompleted) {
              ctx.fillStyle = "rgba(16, 185, 129, 0.55)";
            } else if (hackRunning) {
              ctx.fillStyle = i % 3 === 0 ? "rgba(253, 224, 71, 0.75)" : "rgba(239, 68, 68, 0.65)";
            } else {
              ctx.fillStyle = "rgba(16, 185, 129, 0.28)";
            }
            ctx.fillText(ch, i * (w / cols), drops[i]);
            const speed = hackRunning ? 4.8 : 1.6;
            drops[i] += speed;
            if (drops[i] > h && Math.random() > 0.85) {
              drops[i] = 0;
            }
          }

          // Live Wi-Fi / Radio Golf (Oscilloscope)
          ctx.beginPath();
          const midY = h * 0.52;
          for (let x = 0; x < w; x += 3) {
            let y = midY;
            if (hackCompleted) {
              // Flatline wanneer de Wi-Fi van het stad platligt!
              y = midY + (Math.random() - 0.5) * 1.5;
            } else if (hackRunning) {
              // Hevige glitch-golf tijdens het kraken
              const amp = 18 + Math.sin(wavePhase * 2) * 10;
              const noise = (Math.random() - 0.5) * 18;
              y = midY + Math.sin(x * 0.06 + wavePhase) * amp + noise;
            } else {
              y = midY + Math.sin(x * 0.04 + wavePhase) * 12;
            }
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = hackCompleted
            ? "#10b981"
            : hackRunning
            ? "#fde047"
            : "#ef4444";
          ctx.lineWidth = 2.2;
          ctx.stroke();

          wavePhase += hackRunning ? 0.35 : 0.1;
        }

        setInterval(drawMatrixAndSignal, 65);

        function playHackerBeep(freq = 640, dur = 0.06, type = "square") {
          try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const aCtx = new AudioCtx();
            const osc = aCtx.createOscillator();
            const gain = aCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, aCtx.currentTime);
            gain.gain.setValueAtTime(0.035, aCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, aCtx.currentTime + dur);
            osc.connect(gain);
            gain.connect(aCtx.destination);
            osc.start();
            osc.stop(aCtx.currentTime + dur + 0.01);
          } catch (_) {}
        }

        function appendHackLog(text, cls = "") {
          if (!hackLogConsole) return;
          const line = document.createElement("div");
          line.className = `cyber-log-line ${cls}`;
          line.textContent = text;
          hackLogConsole.appendChild(line);
          hackLogConsole.scrollTop = hackLogConsole.scrollHeight;
        }

        const keyBytes = ["A9", "4F", "22", "00", "C7", "E1"];
        const hackMilestones = [
          {
            pct: 5,
            phase: "FASE 1/10: ONDERGRONDSE ANTENNE KALIBREREN (144.80 MHz)...",
            log: "[05%] Kalibreren van SIGINT veld-ontvanger boven ondergrondse leidingen Stadspark...",
            cls: "log-ok"
          },
          {
            pct: 14,
            phase: "FASE 2/10: WIFI-HANDSHAKE ONDERSCHEPPEN (WPA3-ENT)...",
            log: "[14%] Sniffing WPA3-Enterprise pakketten van STADHUIS_DEAL_2200_GATEWAY...",
            cls: "log-warn"
          },
          {
            pct: 24,
            phase: "FASE 3/10: MAC-ADRES SPOOFING & TOKEN CLONING...",
            log: "[24%] Handshake onderschept! Bezig met klonen van schepencollege-certificaat...",
            cls: "log-ok"
          },
          {
            pct: 35,
            phase: "FASE 4/10: GEMEENTELIJKE FIREWALL POORT 8443 KRAKEN...",
            log: "[35%] Brute-force aanval op gemeentelijke firewall (Node PK-04) gestart...",
            cls: "log-warn"
          },
          {
            pct: 46,
            phase: "⚠️ WAARSCHUWING: STAD-FIREWALL DETECTEERT INBRAAKPOGING!",
            log: "[46%] ALERT! Stadhuis-beveiliging probeert verbinding te blokkeren — tegenmaatregel actief!",
            cls: "log-crit"
          },
          {
            pct: 55,
            phase: "FASE 5/10: TEGENAANVAL AFGESLAGEN // ROOT-SHELL GEOPEND...",
            log: "[55%] Override-sleutel #2200 geaccepteerd! Volledige root-toegang tot stadsnetwerk!",
            cls: "log-ok"
          },
          {
            pct: 66,
            phase: "FASE 6/10: NOTARIËLE VERKOOPAKTE (MARKGRAVENSTRAAT 77)ZOEKEN...",
            log: "[66%] Geheime map gevonden: 'VERKOOP_ERFPACHT_KSA_22U00.PDF'...",
            cls: "log-warn"
          },
          {
            pct: 76,
            phase: "FASE 7/10: BANK-UPLINK DERDE PARTIJ ONDERSCHEPPEN...",
            log: "[76%] Onderscheppen van automatische storting (rekening BE██ ████ ████)...",
            cls: "log-crit"
          },
          {
            pct: 86,
            phase: "FASE 8/10: VIRUS-PAYLOAD INJECTEREN IN GLASVEZELKNOOPPUNT...",
            log: "[86%] Injecteren van corrupte datapakketten in ondergrondse router NODE-PK04...",
            cls: "log-warn"
          },
          {
            pct: 94,
            phase: "FASE 9/10: KILL-SWITCH ACTIVEREN OP STAD-WIFI...",
            log: "[94%] KILL-SWITCH GEACTIVEERD: Ondergrondse radio- en wifilink wordt verbroken...",
            cls: "log-crit"
          }
        ];

        function startWifiHackAnimation() {
          if (hackRunning) return;
          if (hackTimer) clearInterval(hackTimer);

          hackRunning = true;
          hackCompleted = false;
          hackProgress = 0;
          let stallTicks = 0;
          const firedMilestones = new Set();

          cyberTerminal.classList.add("is-hacking");
          cyberTerminal.classList.remove("is-breached");
          hackStartBtn.disabled = true;
          hackStartBtn.textContent = "⏳ BEZIG MET HACKEN VAN STAD-WIFI (BLIJF IN HET PARK)...";
          if (hackCompleteBanner) hackCompleteBanner.style.display = "none";

          if (hackStatusBadge) {
            hackStatusBadge.textContent = "🟡 HACKING IN PROGRESS...";
            hackStatusBadge.style.background = "rgba(245,158,11,0.22)";
            hackStatusBadge.style.color = "#fde047";
            hackStatusBadge.style.borderColor = "#f59e0b";
          }

          if (hackLogConsole) {
            hackLogConsole.innerHTML = "";
            appendHackLog("[00%] INIT: Verbinden met ondergrondse kabels Stadspark (NODE-PK04)...", "log-ok");
          }

          playHackerBeep(520, 0.08, "sawtooth");

          // ~34 seconden durende filmische hacker-animatie met spannende firewall-momenten
          hackTimer = setInterval(() => {
            // Spannende vertraging rond 46% (firewall detectie) en 86% (payload injectie)
            if ((hackProgress === 46 || hackProgress === 86) && stallTicks < 4) {
              stallTicks++;
              playHackerBeep(290, 0.06, "sawtooth");
              return;
            }
            stallTicks = 0;

            hackProgress = Math.min(100, hackProgress + 1);

            if (hackProgressFill) hackProgressFill.style.width = `${hackProgress}%`;
            if (hackPercentNum) hackPercentNum.textContent = `${hackProgress}%`;

            // Update live counters
            const pkts = Math.round((hackProgress / 100) * 8192);
            const nodes = Math.min(6, Math.floor((hackProgress / 100) * 6));
            if (hackPktVal) hackPktVal.textContent = `${pkts.toLocaleString("nl-BE")} / 8.192 PKTS`;
            if (hackNodesVal) hackNodesVal.textContent = `${nodes} / 6 GEKRAAKT`;
            if (hackProgressEta) {
              const remSec = Math.max(0, Math.ceil(((100 - hackProgress) / 100) * 34));
              hackProgressEta.textContent =
                hackProgress < 100 ? `KRAAKT STAD-NETWERK... (~${remSec}s)` : "100% VOLTOOID";
            }

            // Decrypt AES key byte per byte
            if (hackHudKey) {
              const revealedCount = Math.floor((hackProgress / 100) * keyBytes.length);
              const keyStr = keyBytes
                .map((b, idx) => {
                  if (idx < revealedCount) return b;
                  const randHex = Math.floor(Math.random() * 256)
                    .toString(16)
                    .toUpperCase()
                    .padStart(2, "0");
                  return idx === revealedCount ? randHex : "██";
                })
                .join(":");
              hackHudKey.textContent = `AES-KEY: [${keyStr}]`;
            }

            // Check milestones
            hackMilestones.forEach((m) => {
              if (hackProgress >= m.pct && !firedMilestones.has(m.pct)) {
                firedMilestones.add(m.pct);
                if (hackPhaseTitle) hackPhaseTitle.textContent = m.phase;
                appendHackLog(m.log, m.cls);
                playHackerBeep(420 + m.pct * 4.5, 0.055, "square");
              }
            });

            if (hackProgress >= 100) {
              clearInterval(hackTimer);
              hackTimer = null;
              hackRunning = false;
              hackCompleted = true;

              cyberTerminal.classList.remove("is-hacking");
              cyberTerminal.classList.add("is-breached");

              if (hackPhaseTitle) {
                hackPhaseTitle.textContent = "✓ ACCESS GRANTED // STAD-WIFI & DEAL 22u00 GEBLOKKEERD!";
                hackPhaseTitle.style.color = "#6ee7b7";
              }
              if (hackHudFreq) hackHudFreq.textContent = "📡 UPLINK: 0.00 MHz // SIGNAL TERMINATED";
              if (hackDealVal) {
                hackDealVal.textContent = "GEBLOKKEERD (OFFLINE)";
                hackDealVal.style.color = "#10b981";
              }
              if (hackStatusBadge) {
                hackStatusBadge.textContent = "🟢 STAD-WIFI: GEHACKT & OFFLINE";
                hackStatusBadge.style.background = "rgba(16,185,129,0.22)";
                hackStatusBadge.style.color = "#6ee7b7";
                hackStatusBadge.style.borderColor = "#10b981";
              }

              appendHackLog(
                "[100%] SUCCES! De ondergrondse Wi-Fi- en bankconnectie van het stad ligt volledig plat!",
                "log-ok"
              );

              hackStartBtn.style.display = "none";
              if (hackCompleteBanner) hackCompleteBanner.style.display = "block";

              playHackerBeep(880, 0.18, "triangle");
              try {
                if (navigator.vibrate) navigator.vibrate([100, 50, 180]);
              } catch (_) {}
            }
          }, 330);
        }

        hackStartBtn.addEventListener("click", startWifiHackAnimation);
        if (hackReplayBtn) {
          hackReplayBtn.addEventListener("click", () => {
            hackStartBtn.style.display = "inline-flex";
            startWifiHackAnimation();
          });
        }
      }

      listEl.appendChild(folder);
    });
  }

  function updateLocationFolderState(folder, loc, stepNr) {
    const unlocked = isLocationUnlocked(loc.id);
    const lockedView = folder.querySelector(".loc-locked-view");
    const unlockedView = folder.querySelector(".loc-unlocked-view");
    const lockBadge = folder.querySelector(".loc-lock-badge");
    const folderIcon = folder.querySelector(".folder-icon");
    const stepLabel = folder.querySelector(".loc-step-label");
    const photoBadge = folder.querySelector(".loc-photo-badge");
    const gallery = folder.querySelector(".loc-photos-gallery");
    const locBoardMsgsEl = folder.querySelector(".loc-board-messages");

    if (stepLabel && stepNr) {
      stepLabel.textContent = `LOCATIE ${stepNr}:`;
    }

    if (unlocked) {
      folder.classList.add("unlocked");
      lockedView.style.display = "none";
      unlockedView.style.display = "block";
      lockBadge.textContent = "🔓 GEOPEND";
      lockBadge.style.color = "var(--accent)";
      folderIcon.textContent = "📂";
    } else {
      folder.classList.remove("unlocked");
      lockedView.style.display = "block";
      unlockedView.style.display = "none";
      lockBadge.textContent = "🔒 VERGRENDELD";
      lockBadge.style.color = "var(--amber)";
      folderIcon.textContent = "📁";
    }

    // Toon eventuele Message Board berichten voor deze specifieke locatie
    if (locBoardMsgsEl) {
      const locMsgs = ((latestPlayerInfo && latestPlayerInfo.messages) || []).filter(
        (m) => m.locationId === loc.id
      );
      if (locMsgs.length > 0) {
        locBoardMsgsEl.innerHTML = locMsgs
          .map((m) => {
            const color = m.category === "bonus" ? "var(--amber)" : "var(--accent)";
            const label =
              m.category === "bonus"
                ? "⭐ EXTRA BONUSOPDRACHT"
                : "💡 TIP VAN DE SPELLEIDER";
            return `
              <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid ${color}; border-radius: 6px; padding: 0.65rem 0.85rem; margin-bottom: 0.75rem;">
                <div style="font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700; color: ${color}; margin-bottom: 0.2rem;">${label}</div>
                <div style="color: #fff; font-size: 0.9rem;">${m.text}</div>
              </div>
            `;
          })
          .join("");
      } else {
        locBoardMsgsEl.innerHTML = "";
      }
    }

    // Gebruik de gedeelde teamfoto's
    const teamPhotos =
      latestPlayerInfo && latestPlayerInfo.sharedPhotos
        ? latestPlayerInfo.sharedPhotos
        : [];
    const locPhotos = teamPhotos.filter((ph) => ph.locationId === loc.id);

    if (locPhotos.length > 0) {
      photoBadge.style.display = "inline";
      photoBadge.textContent = `📷 ${locPhotos.length} FOTO${locPhotos.length > 1 ? "'S" : ""}`;
    } else {
      photoBadge.style.display = "none";
    }

    if (gallery) {
      const photoSignature = locPhotos.map((p) => p.eventId).join("|");
      if (folder.dataset.photoSig !== photoSignature) {
        folder.dataset.photoSig = photoSignature;
        gallery.innerHTML = "";
        locPhotos.forEach((ph) => {
          const card = document.createElement("div");
          card.className = "photo-card";
          const timeStr = ph.ts
            ? new Date(ph.ts).toLocaleTimeString("nl-BE", {
                hour: "2-digit",
                minute: "2-digit"
              })
            : "";

          const isVid =
            ph.mediaType === "video" ||
            (ph.photoUrl && (ph.photoUrl.startsWith("data:video/") || /\.(mp4|mov|webm)(\?|$)/i.test(ph.photoUrl)));
          const mediaHtml = isVid
            ? `<video src="${ph.photoUrl}" controls playsinline preload="metadata" style="width:100%; height:145px; object-fit:cover; background:#000; display:block;"></video>`
            : `<img src="${ph.photoUrl}" alt="Bewijs ${loc.naam}" title="Tik om op volledig scherm te bekijken" />`;

          card.innerHTML = `
            ${mediaHtml}
            <div class="photo-card-body">
              <div style="color: var(--accent); font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700;">
                Door ${ph.playerName}
              </div>
              <div style="color: #fff; font-weight: 600;">${ph.caption || loc.naam}</div>
              <div class="photo-card-meta">
                <span>${timeStr}</span>
                <button type="button" class="text-btn delete-own-photo-btn" style="font-size: 0.7rem; color: var(--danger);">Verwijder</button>
              </div>
            </div>
          `;

          const imgEl = card.querySelector("img");
          if (imgEl) {
            imgEl.addEventListener("click", () => {
              if (typeof ScoreService !== "undefined" && ScoreService.openPhotoLightbox) {
                ScoreService.openPhotoLightbox(
                  ph.photoUrl,
                  `${loc.naam} — Door ${ph.playerName}`,
                  ph.caption || ""
                );
              } else {
                window.open(ph.photoUrl, "_blank");
              }
            });
          }

          card.querySelector(".delete-own-photo-btn").addEventListener("click", async () => {
            if (window.confirm("Wil je deze foto verwijderen?")) {
              await ScoreService.deletePlayerPhoto(ph.eventId);
            }
          });

          gallery.appendChild(card);
        });
      }
    }
  }

  function refreshAllLocationFolders() {
    ensureLocationsSection();
    const listEl = document.getElementById("locations-list");
    const routeSubtitle = document.getElementById("locations-route-subtitle");
    if (!listEl) return;

    const orderedLocs =
      latestPlayerInfo && latestPlayerInfo.orderedLocations
        ? latestPlayerInfo.orderedLocations
        : (SPEL_CONFIG.locaties || []).map((l, i) => ({ ...l, stepNr: i + 1 }));

    if (routeSubtitle && latestPlayerInfo && latestPlayerInfo.groupName && orderedLocs.length > 0) {
      routeSubtitle.innerHTML = `
        Route voor <strong style="color: ${latestPlayerInfo.groupColor || "var(--accent)"};">${latestPlayerInfo.groupName}</strong>:
        jullie starten bij <strong>${orderedLocs[0].naam}</strong>! Alles wat een teamgenoot hier opent of uploadt is direct zichtbaar bij jullie allemaal.
      `;
    }

    orderedLocs.forEach((loc, idx) => {
      const folder = document.getElementById(`loc-folder-${loc.id}`);
      if (folder) {
        // Verplaats alleen als de volgorde daadwerkelijk anders is (zodat een mobiel toetsenbord nooit sluit tijdens het typen!)
        if (listEl.children[idx] !== folder) {
          listEl.insertBefore(folder, listEl.children[idx] || null);
        }
        updateLocationFolderState(folder, loc, idx + 1);
      }
    });
  }

  // Start realtime sync op de persoonlijke dossierpagina
  if (typeof ScoreService !== "undefined") {
    ensureLocationsSection();

    ScoreService.subscribe((state) => {
      checkAccess();
      const info = state.playerScoresMap.get(playerId);
      latestPlayerInfo = info || null;

      const statusBox = document.getElementById("player-live-score-status");
      const teamBox = document.getElementById("player-live-team-status");

      if (statusBox && info) {
        if (info.unlocked) {
          statusBox.textContent = `GEKRAAKT ALS #${info.unlockRank} (${info.totalPoints} PT)`;
        } else if (info.bonusPoints !== 0) {
          statusBox.textContent = `ACTIEF (${info.totalPoints} PT)`;
        } else {
          statusBox.textContent = "ACTIEF IN HET SPEL";
        }
      }

      if (teamBox && info) {
        if (info.groupId) {
          const mates = (info.groupMembers || []).filter((n) => n !== info.naam);
          const matesText =
            mates.length > 0
              ? `<div style="font-size:0.75rem; color: var(--text-muted); margin-top: 0.25rem; font-weight: 400;">Teamgenoten: ${mates.join(", ")}</div>`
              : "";

          const renameInput = teamBox.querySelector(".team-rename-input");
          const isTypingRename = renameInput && document.activeElement === renameInput;

          if (!isTypingRename) {
            teamBox.innerHTML = `
              <div>
                <span style="color: ${info.groupColor || "var(--accent)"}; font-size: 1.05rem;">
                  ● ${info.groupName}
                </span>
              </div>
              ${matesText}
              <form class="team-rename-form" autocomplete="off">
                <input
                  type="text"
                  class="team-rename-input"
                  placeholder="Kies eigen teamnaam..."
                  value="${info.customGroupName || ""}"
                  maxlength="28"
                />
                <button type="submit" class="team-rename-btn">Bewaar</button>
              </form>
            `;

            const form = teamBox.querySelector(".team-rename-form");
            const input = teamBox.querySelector(".team-rename-input");
            if (form && input) {
              form.addEventListener("submit", async (e) => {
                e.preventDefault();
                await ScoreService.renameGroup(info.groupId, input.value, playerId);
              });
            }
          }
        } else {
          teamBox.textContent = "Individueel";
        }
      }

      if (info) {
        renderPlayerMessageBoard(info);
        ensureBonusFolders(info);
        refreshAllLocationFolders();
      }
    });
    ScoreService.startRealtimeSync();
  }

  checkAccess();
});
