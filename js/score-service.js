/**
 * LIVE SCOREBORD, GROEPSINDELING, FOTO-UPLOADS & CLOUD SYNCHRONISATIE SERVICE
 * ---------------------------------------------------------------------------
 * Synchroniseert scores, groepsindelingen, aangepaste teamnamen, aanwezigheid
 * én geüploade opdrachtfoto's realtime tussen alle spelers en de spelleider.
 */

const ScoreService = (() => {
  const STORAGE_KEY = `jb_score_events_${SPEL_CONFIG.cloudChannel}`;
  const SEEN_BONUSES_KEY = `jb_seen_bonuses_${SPEL_CONFIG.cloudChannel}`;
  const SEEN_INTEL_KEY = `jb_seen_intel_${SPEL_CONFIG.cloudChannel}`;
  const eventsMap = new Map(); // eventId -> event object
  const listeners = new Set();
  let sseConnection = null;
  let pollInterval = null;
  let isSyncing = false;

  let intelQueue = [];
  let isIntelModalOpen = false;

  const DEFAULT_PALETTE = [
    "#3b82f6",
    "#ef4444",
    "#eab308",
    "#10b981",
    "#a855f7",
    "#f97316",
    "#ec4899",
    "#06b6d4"
  ];

  // Vertaal eventuele oude groepsnamen automatisch naar de nieuwe kleurnamen
  const LEGACY_GROUP_MAP = {
    "team alpha": "Groep Blauw",
    "team bravo": "Groep Rood",
    "team charlie": "Groep Geel",
    "team delta": "Groep Groen",
    "team echo": "Groep Paars",
    "team foxtrot": "Groep Oranje",
    "team golf": "Groep Roze",
    "team hotel": "Groep Cyaan"
  };

  function normalizeGroupId(rawGroupId) {
    if (!rawGroupId) return "";
    const trimmed = String(rawGroupId).trim();
    const mapped = LEGACY_GROUP_MAP[trimmed.toLowerCase()];
    return mapped || trimmed;
  }

  function getGroupColor(groupId, indexFallback = 0) {
    if (!groupId) return null;
    const norm = normalizeGroupId(groupId);
    const preset = (SPEL_CONFIG.standaardGroepen || []).find(
      (g) =>
        (g.id && g.id.toLowerCase() === norm.toLowerCase()) ||
        g.naam.toLowerCase() === norm.toLowerCase()
    );
    if (preset) return preset.kleur;
    let hash = 0;
    for (let i = 0; i < norm.length; i++) {
      hash = norm.charCodeAt(i) + ((hash << 5) - hash);
    }
    return DEFAULT_PALETTE[Math.abs(hash + indexFallback) % DEFAULT_PALETTE.length];
  }

  /**
   * Geeft de 6 locaties terug in een unieke doorschuif-volgorde per groep,
   * zodat Groep 1 bij Zandpoort start, Groep 2 bij Begijnhof, Groep 3 bij Bovenpoort, enz.
   */
  function getOrderedLocationsForGroup(groupId) {
    const baseLocs = SPEL_CONFIG.locaties || [];
    if (baseLocs.length === 0) return [];
    if (!groupId) {
      return baseLocs.map((loc, idx) => ({ ...loc, stepNr: idx + 1 }));
    }

    const norm = normalizeGroupId(groupId);
    let grpIdx = (SPEL_CONFIG.standaardGroepen || []).findIndex(
      (g) =>
        (g.id && g.id.toLowerCase() === norm.toLowerCase()) ||
        g.naam.toLowerCase() === norm.toLowerCase()
    );
    if (grpIdx < 0) {
      let hash = 0;
      for (let i = 0; i < norm.length; i++) {
        hash = norm.charCodeAt(i) + ((hash << 5) - hash);
      }
      grpIdx = Math.abs(hash);
    }

    const offset = grpIdx % baseLocs.length;
    const rotated = [
      ...baseLocs.slice(offset),
      ...baseLocs.slice(0, offset)
    ];
    return rotated.map((loc, idx) => ({
      ...loc,
      stepNr: idx + 1
    }));
  }

  function getFirebaseUrl() {
    const raw = (SPEL_CONFIG.firebaseDatabaseUrl || "").trim();
    if (!raw) return null;
    return raw.replace(/\/+$/, "");
  }

  function loadLocalCache() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((ev) => {
            if (ev && ev.eventId) eventsMap.set(ev.eventId, ev);
          });
        }
      }
    } catch (e) {
      console.warn("Kon lokale score-cache niet lezen:", e);
    }
  }

  function saveLocalCache() {
    try {
      const all = Array.from(eventsMap.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn("Kon lokale score-cache niet opslaan:", e);
    }
  }

  function ingestRawEvent(ev) {
    if (!ev || !ev.eventId || !ev.type) return false;
    if (eventsMap.has(ev.eventId)) return false;
    eventsMap.set(ev.eventId, ev);
    saveLocalCache();
    return true;
  }

  function getSeenBonusSet() {
    try {
      const raw = localStorage.getItem(SEEN_BONUSES_KEY);
      if (raw) return new Set(JSON.parse(raw));
    } catch (_) {}
    return new Set();
  }

  function markBonusSeen(eventId) {
    try {
      const s = getSeenBonusSet();
      s.add(eventId);
      localStorage.setItem(SEEN_BONUSES_KEY, JSON.stringify(Array.from(s)));
    } catch (_) {}
  }

  function getSeenIntelSet() {
    try {
      const raw = localStorage.getItem(SEEN_INTEL_KEY);
      if (raw) return new Set(JSON.parse(raw));
    } catch (_) {}
    return new Set();
  }

  function markIntelSeen(eventId) {
    try {
      const s = getSeenIntelSet();
      s.add(eventId);
      localStorage.setItem(SEEN_INTEL_KEY, JSON.stringify(Array.from(s)));
    } catch (_) {}
  }

  function getActiveAgentId() {
    if (typeof document === "undefined" || !document.body) return null;
    const bodyId = document.body.getAttribute("data-player-id");
    if (bodyId) return bodyId;
    const st =
      localStorage.getItem("jb_active_agent_id") ||
      sessionStorage.getItem("jb_active_agent_id");
    if (st) return st;
    if (typeof SPEL_CONFIG !== "undefined" && SPEL_CONFIG.spelers) {
      for (const s of SPEL_CONFIG.spelers) {
        if (sessionStorage.getItem(`dossier_unlocked_${s.id}`) === "true") {
          return s.id;
        }
      }
    }
    return null;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showLiveToast(titleText, tagText, isNegative = false) {
    if (typeof document === "undefined" || !document.body) return;
    let container = document.getElementById("live-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "live-toast-container";
      container.className = "live-toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `live-toast ${isNegative ? "negative" : ""}`;
    toast.innerHTML = `
      <div class="live-toast-body">
        <span class="live-toast-tag">${tagText}</span>
        <span class="live-toast-title">${titleText}</span>
      </div>
      <button type="button" class="live-toast-close">OK</button>
    `;

    const closeBtn = toast.querySelector(".live-toast-close");
    const removeToast = () => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    };
    closeBtn.addEventListener("click", removeToast);
    setTimeout(removeToast, 8000);

    container.appendChild(toast);

    // Subtiele trilling op Android + kort Web Audio signaal bij live melding
    try {
      if (navigator.vibrate) navigator.vibrate(isNegative ? [120, 60, 120] : [90, 40, 90]);
    } catch (_) {}
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(isNegative ? 260 : 587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(isNegative ? 196 : 880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.36);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.38);
      }
    } catch (_) {}
  }

  /**
   * Mobiel-vriendelijke fullscreen foto-lightbox (werkt op iOS Safari & Android Chrome
   * zowel voor cloud-URL's als voor base64 data-URL's zonder popup-blocker).
   */
  function openPhotoLightbox(photoUrl, title = "", subtitle = "") {
    if (typeof document === "undefined" || !document.body || !photoUrl) return;
    let lb = document.getElementById("jb-photo-lightbox");
    if (!lb) {
      lb = document.createElement("div");
      lb.id = "jb-photo-lightbox";
      lb.className = "modal-backdrop";
      lb.style.zIndex = "2500";
      document.body.appendChild(lb);
    }

    lb.innerHTML = `
      <div class="modal-box" style="max-width: 680px; padding: 1rem; text-align: center; background: #070a0e; border-color: var(--accent);">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.65rem; text-align: left;">
          <div>
            <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--accent); font-weight: 700;">${title || "BEWIJSFOTO"}</div>
            ${subtitle ? `<div style="font-size: 0.82rem; color: #e2e8f0;">${subtitle}</div>` : ""}
          </div>
          <button type="button" class="btn btn-secondary lb-close-btn" style="flex: 0 0 auto; padding: 0.4rem 0.75rem; font-size: 0.75rem;">✕ Sluiten</button>
        </div>
        <img src="${photoUrl}" alt="${title}" style="max-width: 100%; max-height: 74dvh; border-radius: 8px; object-fit: contain; border: 1px solid var(--border-color); background: #000;" />
      </div>
    `;

    lb.classList.add("active");
    const closeLb = () => lb.classList.remove("active");
    lb.querySelector(".lb-close-btn").addEventListener("click", closeLb);
    lb.onclick = (e) => {
      if (e.target === lb) closeLb();
    };
  }

  function checkBonusNotifications(state) {
    if (typeof document === "undefined" || !document.body) return;
    const currentPagePlayerId = document.body.getAttribute("data-player-id");
    const seen = getSeenBonusSet();
    const now = Date.now();

    // 0) Melding zodra iedereen zijn code heeft ingevuld en de groepen onthuld worden!
    if (state.groupsRevealed && state.groupsList.length > 0) {
      const revealKey = `groups_revealed_${SPEL_CONFIG.cloudChannel}_${state.unlockedCount}`;
      if (!seen.has("groups_revealed_once")) {
        markBonusSeen("groups_revealed_once");
        showLiveToast(
          "🚨 Alle codes zijn gekraakt! De groepen zijn nu bekendgemaakt!",
          "PLOT TWIST // GROEPEN GEVORMD",
          false
        );
      }
    }

    state.allPlayers.forEach((p) => {
      const isMyPage = currentPagePlayerId === p.id;
      const isUnlockedOnThisDevice =
        sessionStorage.getItem(`dossier_unlocked_${p.id}`) === "true";

      // 1) Bonus-/strafpunten meldingen
      if (p.bonusHistory && p.bonusHistory.length > 0) {
        p.bonusHistory.forEach((b) => {
          if (!b.eventId) return;

          if (isMyPage || isUnlockedOnThisDevice) {
            const personalKey = `self_${b.eventId}`;
            if (!seen.has(personalKey)) {
              markBonusSeen(personalKey);
              markBonusSeen(`pub_${b.eventId}`);
              const absPts = Math.abs(b.delta);
              if (b.delta > 0) {
                const suffix = !isMyPage ? ` (${p.naam})` : "";
                showLiveToast(
                  `🎉 De spelleider gaf je ${absPts} extra punten!${suffix}`,
                  "BERICHT VAN DE SPELLEIDER",
                  false
                );
              } else if (b.delta < 0) {
                const suffix = !isMyPage ? ` (${p.naam})` : "";
                showLiveToast(
                  `⚠️ De spelleider trok ${absPts} punten van je af!${suffix}`,
                  "BERICHT VAN DE SPELLEIDER",
                  true
                );
              }
            }
          } else if (!currentPagePlayerId && now - (b.ts || 0) < 20000) {
            const pubKey = `pub_${b.eventId}`;
            if (!seen.has(pubKey)) {
              markBonusSeen(pubKey);
              const absPts = Math.abs(b.delta);
              if (b.delta > 0) {
                showLiveToast(
                  `🎉 De spelleider gaf ${p.naam} ${absPts} extra punten!`,
                  "LIVE SCORE UPDATE",
                  false
                );
              } else if (b.delta < 0) {
                showLiveToast(
                  `⚠️ De spelleider trok ${absPts} punten af bij ${p.naam}!`,
                  "LIVE SCORE UPDATE",
                  true
                );
              }
            }
          }
        });
      }
    });
  }

  let sharedAudioContext = null;
  function getSharedAudioContext() {
    if (!sharedAudioContext) {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (AudioClass) sharedAudioContext = new AudioClass();
    }
    if (sharedAudioContext && sharedAudioContext.state === "suspended") {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  }

  // Ontgrendel de audio-context direct bij de allereerste aanraking/klik van de speler
  if (typeof window !== "undefined") {
    const unlockAudio = () => {
      const ctx = getSharedAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      ["click", "touchstart", "keydown"].forEach((evt) => {
        window.removeEventListener(evt, unlockAudio);
      });
    };
    ["click", "touchstart", "keydown"].forEach((evt) => {
      window.addEventListener(evt, unlockAudio, { passive: true });
    });
  }

  function playIntelChime(category) {
    // 1. Speel het authentieke militaire radio-alert audiobestand af
    try {
      const isSub =
        typeof window !== "undefined" &&
        window.location.pathname.includes("/spelers/");
      const audioUrl = isSub ? "../audio/intel-alert.wav" : "audio/intel-alert.wav";
      const sound = new Audio(audioUrl);
      sound.volume = 1.0;
      sound.play().catch(() => {});
    } catch (_) {}

    // 2. Synthetiseer een luid, doordringend en thematisch militair belsignaal via Web Audio API
    try {
      const ctx = getSharedAudioContext();
      if (ctx) {
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const now = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.45, now);
        masterGain.connect(ctx.destination);

        let tones = [880, 1174.66, 1479.98, 1760];
        let waveType = "triangle";

        if (category === "alert") {
          // Luid tweetonig noodsignaal
          tones = [1396.91, 880, 1396.91, 880, 1567.98];
          waveType = "sawtooth";
        } else if (category === "bonus") {
          // Triomfantelijke missie-fanfare
          tones = [659.25, 783.99, 1046.5, 1318.51, 1567.98];
          waveType = "triangle";
        }

        tones.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = waveType;
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          gain.gain.setValueAtTime(0.4, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.22);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.25);
        });
      }
    } catch (_) {}

    // 3. Sterk mobiel trillingspatroon (tactisch dubbel-alarm)
    try {
      if (navigator.vibrate) {
        navigator.vibrate([220, 90, 220, 90, 400, 100, 400]);
      }
    } catch (_) {}
  }

  function showNextIntel() {
    if (typeof document === "undefined" || !document.body) return;
    if (intelQueue.length === 0) {
      isIntelModalOpen = false;
      const existing = document.getElementById("jb-intel-popup-backdrop");
      if (existing) existing.classList.remove("active");
      return;
    }

    isIntelModalOpen = true;
    const item = intelQueue[0];
    const m = item.msg;
    const targetLabel = item.targetLabel;

    let backdrop = document.getElementById("jb-intel-popup-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "jb-intel-popup-backdrop";
      backdrop.className = "intel-popup-backdrop";
      document.body.appendChild(backdrop);
    }

    const category = m.category || "tip";
    let catBadge = "💡 TACTISCHE TIP";
    let catClass = "tip";
    let headerTitle = "⚡ INTEL RECEIVED FROM HQ";

    if (category === "alert") {
      catBadge = "🚨 SPOEDINSTRUCTIE";
      catClass = "alert";
      headerTitle = "🚨 SPOEDINSTRUCTIE // HQ TRANSMISSIE";
    } else if (category === "bonus") {
      catBadge = "⭐ GEHEIME BONUSMISSIE";
      catClass = "bonus";
      headerTitle = "⭐ GEHEIME BONUSMISSIE // HQ INTEL";
    }

    const timeStr = m.ts
      ? new Date(m.ts).toLocaleTimeString("nl-BE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        })
      : new Date().toLocaleTimeString("nl-BE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        });

    const remainingCount = intelQueue.length;
    const queueIndicator =
      remainingCount > 1
        ? `<span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--amber); background: rgba(245, 158, 11, 0.15); padding: 0.15rem 0.5rem; border-radius: 4px; border: 1px solid var(--amber);">Bericht 1 van ${remainingCount}</span>`
        : "";

    backdrop.innerHTML = `
      <div class="intel-popup-box intel-theme-${catClass}">
        <div class="intel-popup-header">
          <div class="intel-popup-beacon">
            <span class="intel-beacon-dot"></span>
            <span class="intel-header-title">${headerTitle}</span>
          </div>
          ${queueIndicator}
        </div>
        <div class="intel-popup-body">
          <div class="intel-popup-meta">
            <span class="intel-meta-item"><strong>AFZENDER:</strong> HQ GAMEMASTER</span>
            <span class="intel-meta-sep">•</span>
            <span class="intel-meta-item"><strong>BESTEMMING:</strong> ${escapeHtml(targetLabel)}</span>
            <span class="intel-meta-sep">•</span>
            <span class="intel-meta-item"><strong>TIJD:</strong> ${timeStr}</span>
          </div>
          <div class="intel-popup-badge-row">
            <span class="intel-popup-tag ${catClass}">${catBadge}</span>
            ${
              m.locationName
                ? `<span class="intel-popup-loc-pill">📍 ${escapeHtml(m.locationName)}</span>`
                : ""
            }
          </div>
          <div class="intel-popup-content">
            ${escapeHtml(m.text || "")}
          </div>
        </div>
        <div class="intel-popup-actions">
          <button type="button" class="btn btn-primary intel-popup-confirm-btn">
            <span>⚡ BEVESTIG ONTVANGST</span>
            <span class="intel-btn-subtext">${remainingCount > 1 ? "(VOLGENDE BERICHT &rarr;)" : "(SLUITEN)"}</span>
          </button>
        </div>
      </div>
    `;

    backdrop.classList.add("active");
    playIntelChime(category);

    const confirmBtn = backdrop.querySelector(".intel-popup-confirm-btn");
    const dismissCurrent = () => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.05, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.2);
        }
      } catch (_) {}

      markIntelSeen(`intel_msg_seen_${m.eventId || m.ts}`);
      intelQueue.shift();

      if (intelQueue.length > 0) {
        showNextIntel();
      } else {
        backdrop.classList.remove("active");
        isIntelModalOpen = false;
      }
    };

    confirmBtn.onclick = dismissCurrent;
    backdrop.onclick = (e) => {
      if (e.target === backdrop) dismissCurrent();
    };
  }

  function checkIntelPopups(state) {
    if (typeof window === "undefined" || !document.body) return;
    if (window.location.pathname.includes("hq-dashboard")) return;

    const seenIntel = getSeenIntelSet();
    const activeAgentId = getActiveAgentId();
    const activePlayer = activeAgentId
      ? (state.allPlayers || []).find((p) => p.id === activeAgentId)
      : null;
    const now = Date.now();

    const messages = state.allMessages || [];
    let added = false;

    messages.forEach((m) => {
      if (!m || !m.text) return;
      const seenKey = `intel_msg_seen_${m.eventId || m.ts}`;
      if (seenIntel.has(seenKey)) return;

      // Alleen berichten tonen die recent zijn verzonden (laatste 30 minuten)
      if (m.ts && now - m.ts > 30 * 60 * 1000) return;

      let isTarget = false;
      let targetLabel = "ALLE AGENTEN (BROADCAST)";

      if (m.targetType === "all") {
        isTarget = true;
        targetLabel = "ALLE AGENTEN (BROADCAST)";
      } else if (m.targetType === "group") {
        if (
          activePlayer &&
          (activePlayer.groupId === m.targetId || activePlayer.adminGroupId === m.targetId)
        ) {
          isTarget = true;
          const grp = (state.allGroups || []).find((g) => g.id === m.targetId);
          targetLabel = grp ? `TEAM ${grp.naam}` : `TEAM ${m.targetId}`;
        }
      } else if (m.targetType === "player") {
        if (activeAgentId && m.targetId === activeAgentId) {
          isTarget = true;
          targetLabel = activePlayer ? `AGENT ${activePlayer.naam}` : `AGENT ${m.targetId}`;
        }
      }

      if (isTarget) {
        const alreadyQueued = intelQueue.some(
          (item) => (item.msg.eventId || item.msg.ts) === (m.eventId || m.ts)
        );
        if (!alreadyQueued) {
          intelQueue.push({ msg: m, targetLabel });
          added = true;
        }
      }
    });

    if (added && !isIntelModalOpen) {
      showNextIntel();
    }
  }

  function notifyListeners() {
    const state = computeScoreState();
    checkBonusNotifications(state);
    checkIntelPopups(state);
    listeners.forEach((cb) => {
      try {
        cb(state);
      } catch (e) {
        console.error("Fout in scorebord listener:", e);
      }
    });
  }

  /**
   * Berekent op basis van alle chronologische events de exacte stand,
   * groepsindeling, aangepaste groepsnamen, aanwezigheid én foto's.
   */
  function computeScoreState() {
    const inst = SPEL_CONFIG.scoreInstellingen || {
      eerstePlekPunten: 260,
      stapPerPlek: 10,
      minimumPunten: 10
    };

    const sortedEvents = Array.from(eventsMap.values()).sort(
      (a, b) => (a.ts || 0) - (b.ts || 0)
    );

    const unlocks = new Map(); // playerId -> { playerId, ts }
    const bonuses = new Map(); // playerId -> { totalDelta, history: [] }
    const playerGroups = new Map(); // playerId -> groupId (bv. "Groep Blauw")
    const groupCustomNames = new Map(); // groupId -> customName (bv. "De Wolven")
    const disabledPlayers = new Set(); // playerIds die niet meedoen
    const photosMap = new Map(); // eventId -> photo object
    const messagesMap = new Map(); // eventId -> message board object
    const playerLocUnlocks = new Map(); // playerId -> Set<locationId>
    let groupVisibilityMode = "auto"; // "auto" (pas na alle codes), "show" (forceer zichtbaar), "hide" (forceer verborgen)

    for (const ev of sortedEvents) {
      if (ev.type === "reset") {
        unlocks.clear();
        bonuses.clear();
        photosMap.clear();
        messagesMap.clear();
        playerLocUnlocks.clear();
        groupVisibilityMode = "auto";
        if (ev.resetGroups) {
          playerGroups.clear();
          groupCustomNames.clear();
        }
        if (ev.resetDisabled) {
          disabledPlayers.clear();
        }
      } else if (ev.type === "set_groups_visibility" && ev.mode) {
        groupVisibilityMode = ev.mode;
      } else if (ev.type === "revoke" && ev.playerId) {
        unlocks.delete(ev.playerId);
      } else if (ev.type === "unlock" && ev.playerId) {
        if (!unlocks.has(ev.playerId)) {
          unlocks.set(ev.playerId, {
            playerId: ev.playerId,
            ts: ev.ts
          });
        }
      } else if (ev.type === "unlock_location" && ev.playerId && ev.locationId) {
        if (!playerLocUnlocks.has(ev.playerId)) {
          playerLocUnlocks.set(ev.playerId, new Set());
        }
        playerLocUnlocks.get(ev.playerId).add(ev.locationId);
      } else if (ev.type === "bonus" && ev.playerId) {
        const delta = Number(ev.delta) || 0;
        const cur = bonuses.get(ev.playerId) || { totalDelta: 0, history: [] };
        cur.totalDelta += delta;
        cur.history.push({
          eventId: ev.eventId,
          delta,
          reason: ev.reason || "",
          ts: ev.ts
        });
        bonuses.set(ev.playerId, cur);
      } else if (ev.type === "set_groups" && ev.assignments && typeof ev.assignments === "object") {
        playerGroups.clear();
        groupCustomNames.clear();
        Object.entries(ev.assignments).forEach(([pid, gId]) => {
          const norm = normalizeGroupId(gId);
          if (norm) {
            playerGroups.set(pid, norm);
          }
        });
      } else if (ev.type === "assign_group" && ev.playerId) {
        const norm = normalizeGroupId(ev.groupName);
        if (norm) {
          playerGroups.set(ev.playerId, norm);
        } else {
          playerGroups.delete(ev.playerId);
        }
      } else if (ev.type === "rename_group" && ev.groupId) {
        const norm = normalizeGroupId(ev.groupId);
        const cName = (ev.customName || "").trim();
        if (norm) {
          if (cName) {
            groupCustomNames.set(norm, cName);
          } else {
            groupCustomNames.delete(norm);
          }
        }
      } else if (ev.type === "toggle_disabled" && ev.playerId) {
        if (ev.disabled) {
          disabledPlayers.add(ev.playerId);
        } else {
          disabledPlayers.delete(ev.playerId);
        }
      } else if (ev.type === "set_disabled" && Array.isArray(ev.disabledIds)) {
        disabledPlayers.clear();
        ev.disabledIds.forEach((id) => disabledPlayers.add(id));
      } else if (ev.type === "photo" && ev.playerId && ev.photoUrl) {
        photosMap.set(ev.eventId, {
          eventId: ev.eventId,
          mediaType: ev.mediaType || "image",
          playerId: ev.playerId,
          locationId: ev.locationId || "",
          locationName: ev.locationName || "",
          photoUrl: ev.photoUrl,
          caption: ev.caption || "",
          ts: ev.ts
        });
      } else if (ev.type === "delete_photo" && ev.targetEventId) {
        photosMap.delete(ev.targetEventId);
      } else if (ev.type === "post_message" && ev.text) {
        messagesMap.set(ev.eventId, {
          eventId: ev.eventId,
          targetType: ev.targetType || "all", // "all", "group", "player"
          targetId: ev.targetId || "",
          locationId: ev.locationId || "",
          locationName: ev.locationName || "",
          category: ev.category || "tip", // "tip", "bonus", "info"
          text: ev.text,
          ts: ev.ts
        });
      } else if (ev.type === "delete_message" && ev.targetEventId) {
        messagesMap.delete(ev.targetEventId);
      }
    }

    // Alleen ingeschakelde spelers tellen mee voor de ontgrendel-volgorde
    const unlockOrder = Array.from(unlocks.values())
      .filter((item) => !disabledPlayers.has(item.playerId))
      .sort((a, b) => a.ts - b.ts);

    const unlockRankMap = new Map();

    unlockOrder.forEach((item, index) => {
      const rank = index + 1;
      const basePoints = Math.max(
        inst.minimumPunten,
        inst.eerstePlekPunten - index * inst.stapPerPlek
      );
      unlockRankMap.set(item.playerId, {
        rank,
        basePoints,
        unlockedAt: item.ts
      });
    });

    // Verzamel foto's per speler
    const photosByPlayer = new Map();
    Array.from(photosMap.values())
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .forEach((ph) => {
        if (!photosByPlayer.has(ph.playerId)) {
          photosByPlayer.set(ph.playerId, []);
        }
        photosByPlayer.get(ph.playerId).push(ph);
      });

    // Bepaal of ALLE aanwezige spelers hun code al hebben ingevuld
    const enabledCount = SPEL_CONFIG.spelers.filter(
      (s) => !disabledPlayers.has(s.id)
    ).length;
    const allPresentUnlocked =
      enabledCount > 0 && unlockOrder.length >= enabledCount;

    const groupsRevealed =
      groupVisibilityMode === "show"
        ? true
        : groupVisibilityMode === "hide"
        ? false
        : allPresentUnlocked;

    // Als groepen onthuld worden en de admin had nog geen groepen klaargezet,
    // verdeel de aanwezige spelers dan automatisch in groepen van ~4:
    const defaultGroupList = (SPEL_CONFIG.standaardGroepen || []).map(
      (g) => g.id || g.naam
    );
    const numAutoGroups = Math.max(1, Math.ceil(enabledCount / 4));
    let enabledIdx = 0;

    // Bouw volledige spelerslijst
    const allPlayerScores = SPEL_CONFIG.spelers.map((speler) => {
      const isDisabled = disabledPlayers.has(speler.id);
      const unlockInfo = !isDisabled ? unlockRankMap.get(speler.id) || null : null;
      const bonusInfo = bonuses.get(speler.id) || { totalDelta: 0, history: [] };
      const basePoints = unlockInfo ? unlockInfo.basePoints : 0;
      const bonusPoints = !isDisabled ? bonusInfo.totalDelta : 0;
      const totalPoints = basePoints + bonusPoints;

      let configuredGroupId = !isDisabled
        ? playerGroups.get(speler.id) || null
        : null;
      if (!isDisabled && !configuredGroupId && playerGroups.size === 0) {
        const autoGrp =
          defaultGroupList[enabledIdx % numAutoGroups] ||
          `Groep ${(enabledIdx % numAutoGroups) + 1}`;
        configuredGroupId = autoGrp;
      }
      if (!isDisabled) enabledIdx++;

      const configuredGroupName = configuredGroupId
        ? groupCustomNames.get(configuredGroupId) || configuredGroupId
        : null;
      const configuredGroupColor = getGroupColor(configuredGroupId);

      // Spelers zien hun groep PAS zodra groupsRevealed === true!
      const visibleGroupId = groupsRevealed ? configuredGroupId : null;
      const visibleGroupName = groupsRevealed ? configuredGroupName : null;
      const visibleGroupColor = groupsRevealed ? configuredGroupColor : null;
      const playerPhotos = photosByPlayer.get(speler.id) || [];

      return {
        ...speler,
        disabled: isDisabled,
        unlocked: Boolean(unlockInfo),
        unlockRank: unlockInfo ? unlockInfo.rank : null,
        unlockedAt: unlockInfo ? unlockInfo.unlockedAt : null,
        basePoints,
        bonusPoints,
        bonusHistory: !isDisabled ? bonusInfo.history : [],
        totalPoints,
        // Voor spelers (alleen zichtbaar na onthulling):
        groupId: visibleGroupId,
        groupName: visibleGroupName,
        groupColor: visibleGroupColor,
        // Voor admin op voorhand in het Leiding Paneel:
        adminGroupId: configuredGroupId,
        adminGroupName: configuredGroupName,
        adminGroupColor: configuredGroupColor,
        photos: playerPhotos,
        active: Boolean(unlockInfo) || bonusPoints !== 0
      };
    });

    const enabledPlayerScores = allPlayerScores.filter((p) => !p.disabled);

    // Bereken groepen & groepsscores (op basis van adminGroupId, en zichtbaarheid op basis van groupsRevealed)
    const adminGroupsMap = new Map();
    enabledPlayerScores.forEach((p) => {
      if (!p.adminGroupId) return;
      if (!adminGroupsMap.has(p.adminGroupId)) {
        const orderedLocs = getOrderedLocationsForGroup(p.adminGroupId);
        adminGroupsMap.set(p.adminGroupId, {
          id: p.adminGroupId,
          naam: p.adminGroupName,
          kleur: p.adminGroupColor,
          leden: [],
          totalPoints: 0,
          unlockedCount: 0,
          orderedLocations: orderedLocs,
          startLocationName: orderedLocs.length > 0 ? orderedLocs[0].naam : ""
        });
      }
      const grp = adminGroupsMap.get(p.adminGroupId);
      grp.leden.push(p);
      grp.totalPoints += p.totalPoints;
      if (p.unlocked) grp.unlockedCount += 1;
    });

    const adminGroupsList = Array.from(adminGroupsMap.values()).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return a.naam.localeCompare(b.naam);
    });

    const groupsList = groupsRevealed ? adminGroupsList : [];

    const playerLookup = new Map(allPlayerScores.map((p) => [p.id, p]));

    // Alle geüploade foto's verrijkt met spelersnaam & team (nieuwste eerst)
    const allPhotos = Array.from(photosMap.values())
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .map((ph) => {
        const sp = playerLookup.get(ph.playerId);
        return {
          ...ph,
          playerName: sp ? sp.naam : ph.playerId,
          dossierNr: sp ? sp.dossierNr : "??",
          groupId: sp ? sp.adminGroupId : null,
          groupName: sp ? sp.adminGroupName : null,
          groupColor: sp ? sp.adminGroupColor : null
        };
      });

    // Alle Message Board berichten (nieuwste eerst)
    const allMessages = Array.from(messagesMap.values()).sort(
      (a, b) => (b.ts || 0) - (a.ts || 0)
    );

    // Verrijk elke groep in adminGroupsMap met gedeelde geopende locaties & ingezonden bewijsstukken
    adminGroupsMap.forEach((grp) => {
      const sharedLocs = new Set();
      grp.leden.forEach((member) => {
        const mSet = playerLocUnlocks.get(member.id);
        if (mSet) {
          mSet.forEach((locId) => sharedLocs.add(locId));
        }
      });
      const memberIds = new Set(grp.leden.map((m) => m.id));
      const grpPhotos = allPhotos.filter((ph) => memberIds.has(ph.playerId));

      grp.unlockedLocations = sharedLocs;
      grp.photos = grpPhotos;

      // Bepaal waar de groep nu zit op hun route (laatst geopende map zonder upload, of eerstvolgende vergrendelde map)
      let activeLoc = null;
      let completedCount = 0;
      (grp.orderedLocations || []).forEach((loc) => {
        const isOpen = sharedLocs.has(loc.id);
        const hasUpload = grpPhotos.some((ph) => ph.locationId === loc.id);
        if (isOpen && hasUpload) {
          completedCount++;
        } else if (isOpen && !activeLoc) {
          activeLoc = { ...loc, status: "bezig" };
        }
      });
      if (!activeLoc && grp.orderedLocations && grp.orderedLocations.length > 0) {
        const nextLocked = grp.orderedLocations.find((l) => !sharedLocs.has(l.id));
        if (nextLocked) {
          activeLoc = { ...nextLocked, status: "onderweg" };
        } else {
          activeLoc = {
            ...grp.orderedLocations[grp.orderedLocations.length - 1],
            status: "voltooid"
          };
        }
      }
      grp.completedLocationsCount = completedCount;
      grp.currentLocation = activeLoc;
    });

    // Deel map-inhoud (foto's + geopende locaties + message board) én locatie-volgorde met iedereen van hetzelfde team zodra groepen onthuld zijn!
    allPlayerScores.forEach((p) => {
      p.orderedLocations = getOrderedLocationsForGroup(p.groupId);

      // Filter berichten die voor deze speler of zijn/haar team bestemd zijn
      p.messages = allMessages.filter((m) => {
        if (m.targetType === "all") return true;
        if (m.targetType === "player" && m.targetId === p.id) return true;
        if (
          m.targetType === "group" &&
          (m.targetId === p.groupId || m.targetId === p.adminGroupId)
        ) {
          return true;
        }
        return false;
      });

      if (!p.disabled && p.groupId && adminGroupsMap.has(p.groupId)) {
        const grp = adminGroupsMap.get(p.groupId);
        p.groupMembers = grp.leden.map((m) => m.naam);

        const sharedLocs = new Set();
        grp.leden.forEach((member) => {
          const mSet = playerLocUnlocks.get(member.id);
          if (mSet) {
            mSet.forEach((locId) => sharedLocs.add(locId));
          }
        });
        p.sharedUnlockedLocations = sharedLocs;

        const memberIds = new Set(grp.leden.map((m) => m.id));
        p.sharedPhotos = allPhotos.filter((ph) => memberIds.has(ph.playerId));
      } else {
        p.groupMembers = [];
        p.sharedUnlockedLocations = new Set(playerLocUnlocks.get(p.id) || []);
        p.sharedPhotos = allPhotos.filter((ph) => ph.playerId === p.id);
      }
    });

    const leaderboard = [...enabledPlayerScores].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (a.unlocked && b.unlocked) return a.unlockedAt - b.unlockedAt;
      return a.naam.localeCompare(b.naam);
    });

    const nextRank = unlockOrder.length + 1;
    const nextPoints =
      nextRank <= enabledPlayerScores.length
        ? Math.max(
            inst.minimumPunten,
            inst.eerstePlekPunten - (nextRank - 1) * inst.stapPerPlek
          )
        : 0;

    return {
      leaderboard,
      allPlayers: allPlayerScores,
      enabledPlayers: enabledPlayerScores,
      disabledSet: disabledPlayers,
      groupsList,
      adminGroupsList,
      groupsRevealed,
      groupVisibilityMode,
      groupCustomNames,
      hasGroups: groupsList.length > 0,
      allPhotos,
      allMessages,
      playerScoresMap: playerLookup,
      unlockedCount: unlockOrder.length,
      totalCount: enabledPlayerScores.length,
      nextRank,
      nextPoints
    };
  }

  async function fetchCloudHistory() {
    const fbUrl = getFirebaseUrl();

    if (fbUrl) {
      try {
        const res = await fetch(`${fbUrl}/events.json`);
        if (res.ok) {
          const data = await res.json();
          let changed = false;
          if (data && typeof data === "object") {
            Object.values(data).forEach((ev) => {
              if (ingestRawEvent(ev)) changed = true;
            });
          }
          if (changed) notifyListeners();
        }
      } catch (e) {
        console.warn("Firebase synchronisatie waarschuwing:", e);
      }
      return;
    }

    try {
      const url = `https://ntfy.sh/${encodeURIComponent(
        SPEL_CONFIG.cloudChannel
      )}/json?poll=1&since=24h`;
      const res = await fetch(url);
      if (!res.ok) return;
      const text = await res.text();
      const lines = text.split("\n").filter((l) => l.trim().length > 0);
      let changed = false;

      for (const line of lines) {
        try {
          const envelope = JSON.parse(line);
          if (envelope.event === "message" && envelope.message) {
            const payload = JSON.parse(envelope.message);
            if (!payload.ts && envelope.time) {
              payload.ts = envelope.time * 1000;
            }
            if (ingestRawEvent(payload)) changed = true;
          }
        } catch (_) {}
      }

      if (changed) notifyListeners();
    } catch (e) {
      console.warn("Cloud geschiedenis ophalen mislukt (offline?):", e);
    }
  }

  function startRealtimeSync() {
    if (isSyncing) return;
    isSyncing = true;
    loadLocalCache();
    notifyListeners();
    fetchCloudHistory();

    const fbUrl = getFirebaseUrl();
    if (fbUrl) {
      if (!pollInterval) {
        pollInterval = setInterval(fetchCloudHistory, 3000);
      }
      return;
    }

    if (typeof EventSource !== "undefined" && !sseConnection) {
      try {
        const sseUrl = `https://ntfy.sh/${encodeURIComponent(
          SPEL_CONFIG.cloudChannel
        )}/sse`;
        sseConnection = new EventSource(sseUrl);
        sseConnection.onmessage = (e) => {
          try {
            const envelope = JSON.parse(e.data);
            if (envelope.event === "message" && envelope.message) {
              const payload = JSON.parse(envelope.message);
              if (ingestRawEvent(payload)) {
                notifyListeners();
              }
            }
          } catch (_) {}
        };
      } catch (e) {
        console.warn("SSE verbinding niet mogelijk, val terug op polling:", e);
      }
    }

    if (!pollInterval) {
      pollInterval = setInterval(fetchCloudHistory, 8000);
    }
  }

  async function publishEvent(eventData) {
    const ev = {
      ...eventData,
      eventId: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      ts: Date.now()
    };

    ingestRawEvent(ev);
    notifyListeners();

    const fbUrl = getFirebaseUrl();
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2000));

    const sendPromise = (async () => {
      try {
        if (fbUrl) {
          await fetch(`${fbUrl}/events.json`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ev)
          });
        } else {
          await fetch(
            `https://ntfy.sh/${encodeURIComponent(SPEL_CONFIG.cloudChannel)}`,
            {
              method: "POST",
              body: JSON.stringify(ev)
            }
          );
        }
      } catch (e) {
        console.warn("Kon event niet direct naar cloud sturen:", e);
      }
    })();

    await Promise.race([sendPromise, timeoutPromise]);
    return computeScoreState();
  }

  async function recordUnlock(playerId) {
    await fetchCloudHistory();
    const current = computeScoreState();
    const spelerState = current.playerScoresMap.get(playerId);
    if (spelerState && (spelerState.unlocked || spelerState.disabled)) {
      return current;
    }
    return publishEvent({
      type: "unlock",
      playerId
    });
  }

  async function addBonusPoints(playerId, delta, reason = "") {
    return publishEvent({
      type: "bonus",
      playerId,
      delta: Number(delta),
      reason
    });
  }

  async function revokePlayerUnlock(playerId) {
    return publishEvent({
      type: "revoke",
      playerId
    });
  }

  async function resetAllScores(resetGroups = false, resetDisabled = false) {
    try {
      localStorage.removeItem(SEEN_INTEL_KEY);
      intelQueue = [];
      if (typeof document !== "undefined") {
        const backdrop = document.getElementById("jb-intel-popup-backdrop");
        if (backdrop) backdrop.classList.remove("active");
      }
    } catch (_) {}
    return publishEvent({
      type: "reset",
      resetGroups: Boolean(resetGroups),
      resetDisabled: Boolean(resetDisabled)
    });
  }

  async function setAllGroups(assignments) {
    return publishEvent({
      type: "set_groups",
      assignments: assignments || {}
    });
  }

  async function assignPlayerGroup(playerId, groupName) {
    return publishEvent({
      type: "assign_group",
      playerId,
      groupName: groupName || ""
    });
  }

  /**
   * Laat een speler (of de leiding) de naam van zijn/haar eigen groep aanpassen.
   */
  async function renameGroup(groupId, customName, byPlayerId = "") {
    return publishEvent({
      type: "rename_group",
      groupId,
      customName: (customName || "").trim(),
      byPlayerId
    });
  }

  async function setPlayerDisabled(playerId, disabled) {
    return publishEvent({
      type: "toggle_disabled",
      playerId,
      disabled: Boolean(disabled)
    });
  }

  async function setDisabledPlayers(disabledIds) {
    return publishEvent({
      type: "set_disabled",
      disabledIds: Array.isArray(disabledIds) ? disabledIds : []
    });
  }

  /**
   * Comprimeer een afbeeldingsbestand in de browser naar een scherp, lichtgewicht JPEG-bestand.
   */
  function compressImageFile(file, maxDimension = 900, quality = 0.78) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Kon bestand niet lezen"));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error("Ongeldige afbeelding"));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          canvas.toBlob(
            (blob) => {
              resolve({ blob, dataUrl });
            },
            "image/jpeg",
            quality
          );
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Upload een foto of video vanuit het persoonlijke dossier van een speler,
   * zodat deze zichtbaar wordt in het eigen dossier én voor de spelmeester.
   */
  async function uploadPlayerPhoto(
    playerId,
    file,
    caption = "",
    locationId = "",
    locationName = ""
  ) {
    const isVideo = Boolean(file && file.type && file.type.startsWith("video/"));
    let blob = file;
    let finalPhotoUrl = "";

    if (isVideo) {
      finalPhotoUrl = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = (e) => resolve(e.target.result || "");
        r.onerror = () => resolve("");
        r.readAsDataURL(file);
      });
    } else {
      const compressed = await compressImageFile(file, 900, 0.78);
      blob = compressed.blob;
      finalPhotoUrl = compressed.dataUrl;
    }

    const fbUrl = getFirebaseUrl();
    if (!fbUrl && blob) {
      // Upload het mediabestand naar een apart media-kanaal op ntfy.sh
      try {
        const ext = isVideo ? (file.name.split(".").pop() || "mp4") : "jpg";
        const mediaChannel = `${SPEL_CONFIG.cloudChannel}_media`;
        const uploadRes = await fetch(
          `https://ntfy.sh/${encodeURIComponent(mediaChannel)}`,
          {
            method: "PUT",
            headers: {
              Filename: `bewijs_${playerId}_${locationId || "algemeen"}_${Date.now()}.${ext}`
            },
            body: blob
          }
        );
        if (uploadRes.ok) {
          const meta = await uploadRes.json();
          if (meta && meta.attachment && meta.attachment.url) {
            finalPhotoUrl = meta.attachment.url;
          }
        }
      } catch (e) {
        console.warn("Cloud media-upload waarschuwing, gebruikt lokale dataUrl:", e);
      }
    }

    return publishEvent({
      type: "photo",
      mediaType: isVideo ? "video" : "image",
      playerId,
      locationId: locationId || "",
      locationName: locationName || "",
      photoUrl: finalPhotoUrl,
      caption: (caption || "").trim()
    });
  }

  async function deletePlayerPhoto(targetEventId) {
    return publishEvent({
      type: "delete_photo",
      targetEventId
    });
  }

  /**
   * Ontgrendel een locatie-mapje voor een speler én automatisch voor zijn/haar hele team.
   */
  async function unlockLocation(playerId, locationId) {
    return publishEvent({
      type: "unlock_location",
      playerId,
      locationId
    });
  }

  /**
   * Geef bonuspunten aan elk lid van een specifiek team tegelijk.
   */
  async function addGroupBonusPoints(groupId, delta, reason = "Team bonus") {
    const state = computeScoreState();
    const grp = (state.adminGroupsList || state.groupsList).find(
      (g) => g.id === groupId
    );
    if (!grp) return state;
    for (const lid of grp.leden) {
      await publishEvent({
        type: "bonus",
        playerId: lid.id,
        delta: Number(delta),
        reason
      });
    }
    return computeScoreState();
  }

  /**
   * Plaats een nieuw bericht (tip of geheime opdracht voor extra punten) op het Message Board
   * van alle spelers, één team, of één specifieke speler.
   */
  async function postBoardMessage({
    targetType = "all",
    targetId = "",
    locationId = "",
    locationName = "",
    category = "tip",
    text = ""
  }) {
    return publishEvent({
      type: "post_message",
      targetType,
      targetId,
      locationId,
      locationName,
      category,
      text: (text || "").trim()
    });
  }

  async function deleteBoardMessage(targetEventId) {
    return publishEvent({
      type: "delete_message",
      targetEventId
    });
  }

  /**
   * Bepaal wanneer groepen zichtbaar zijn:
   * - "auto": pas zichtbaar zodra ALLE aanwezige spelers hun code hebben ingevuld
   * - "show": direct zichtbaar voor iedereen
   * - "hide": verborgen houden
   */
  async function setGroupsVisibilityMode(mode = "auto") {
    return publishEvent({
      type: "set_groups_visibility",
      mode
    });
  }

  function subscribe(callback) {
    listeners.add(callback);
    callback(computeScoreState());
    return () => listeners.delete(callback);
  }

  return {
    startRealtimeSync,
    subscribe,
    getState: computeScoreState,
    getOrderedLocationsForGroup,
    recordUnlock,
    unlockLocation,
    addBonusPoints,
    addGroupBonusPoints,
    revokePlayerUnlock,
    resetAllScores,
    setAllGroups,
    assignPlayerGroup,
    renameGroup,
    setGroupsVisibilityMode,
    setPlayerDisabled,
    setDisabledPlayers,
    uploadPlayerPhoto,
    deletePlayerPhoto,
    openPhotoLightbox,
    postBoardMessage,
    deleteBoardMessage,
    refresh: fetchCloudHistory,
    triggerIntelPopup: (msg, targetLabel) => {
      intelQueue.push({ msg, targetLabel: targetLabel || "ALLE AGENTEN (BROADCAST)" });
      if (!isIntelModalOpen) showNextIntel();
    }
  };
})();

if (typeof window !== "undefined") {
  setTimeout(() => {
    try {
      ScoreService.startRealtimeSync();
    } catch (_) {}
  }, 60);
}
