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

  // Vertaal eventuele alternatieve of oude groepsnamen altijd naar de 6 officiële kleurnamen
  const LEGACY_GROUP_MAP = {
    "groep-1": "Groep Blauw",
    "groep 1": "Groep Blauw",
    "groep1": "Groep Blauw",
    "1": "Groep Blauw",
    "team alpha": "Groep Blauw",
    "groep alpha": "Groep Blauw",
    "alpha": "Groep Blauw",

    "groep-2": "Groep Rood",
    "groep 2": "Groep Rood",
    "groep2": "Groep Rood",
    "2": "Groep Rood",
    "team bravo": "Groep Rood",
    "groep bravo": "Groep Rood",
    "bravo": "Groep Rood",

    "groep-3": "Groep Geel",
    "groep 3": "Groep Geel",
    "groep3": "Groep Geel",
    "3": "Groep Geel",
    "team charlie": "Groep Geel",
    "groep charlie": "Groep Geel",
    "charlie": "Groep Geel",

    "groep-4": "Groep Groen",
    "groep 4": "Groep Groen",
    "groep4": "Groep Groen",
    "4": "Groep Groen",
    "team delta": "Groep Groen",
    "groep delta": "Groep Groen",
    "delta": "Groep Groen",

    "groep-5": "Groep Paars",
    "groep 5": "Groep Paars",
    "groep5": "Groep Paars",
    "5": "Groep Paars",
    "team echo": "Groep Paars",
    "groep echo": "Groep Paars",
    "echo": "Groep Paars",

    "groep-6": "Groep Oranje",
    "groep 6": "Groep Oranje",
    "groep6": "Groep Oranje",
    "6": "Groep Oranje",
    "team foxtrot": "Groep Oranje",
    "groep foxtrot": "Groep Oranje",
    "foxtrot": "Groep Oranje"
  };

  function normalizeGroupId(rawGroupId) {
    if (!rawGroupId) return "";
    const trimmed = String(rawGroupId).trim();
    const mapped = LEGACY_GROUP_MAP[trimmed.toLowerCase()];
    return mapped || trimmed;
  }

  function getGroupIndex(groupId) {
    if (!groupId) return 0;
    const norm = normalizeGroupId(groupId).toLowerCase();
    const groups = SPEL_CONFIG.standaardGroepen || [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (
        (g.id && g.id.toLowerCase() === norm) ||
        (g.naam && g.naam.toLowerCase() === norm)
      ) {
        return i;
      }
    }
    const m = norm.match(/\d+/);
    if (m) {
      const nr = parseInt(m[0], 10);
      if (nr >= 1 && nr <= groups.length) return nr - 1;
    }
    return 0;
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
   * Geeft de 6 locaties terug in een unieke, gegarandeerde rotatie-volgorde per groep:
   * Groep 1 (Blauw)  -> start op Zandpoort (stap 1)
   * Groep 2 (Rood)   -> start op Begijnhof (stap 1)
   * Groep 3 (Geel)   -> start op Bovenpoort (stap 1)
   * Groep 4 (Groen)  -> start op Stadspark (stap 1)
   * Groep 5 (Paars)  -> start op Kerkplein (stap 1)
   * Groep 6 (Oranje) -> start op Nieuw Lokaal (stap 1)
   * Teammaten krijgen ALTIJD 100% exact dezelfde volgorde en startpunt!
   */
  function getOrderedLocationsForGroup(groupId) {
    const baseLocs = SPEL_CONFIG.locaties || [];
    if (baseLocs.length === 0) return [];
    if (!groupId) {
      return baseLocs.map((loc, idx) => ({ ...loc, stepNr: idx + 1 }));
    }

    const grpIdx = getGroupIndex(groupId);
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
      localStorage.getItem("jb_my_agent_id") ||
      localStorage.getItem("jb_active_agent_id") ||
      sessionStorage.getItem("jb_my_agent_id") ||
      sessionStorage.getItem("jb_active_agent_id");
    if (st) return st;
    if (typeof SPEL_CONFIG !== "undefined" && SPEL_CONFIG.spelers) {
      for (const s of SPEL_CONFIG.spelers) {
        if (
          localStorage.getItem(`dossier_unlocked_${s.id}`) === "true" ||
          sessionStorage.getItem(`dossier_unlocked_${s.id}`) === "true"
        ) {
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
      <div class="live-toast-body" style="flex: 1; padding-right: 0.5rem;">
        <span class="live-toast-tag">${tagText}</span>
        <span class="live-toast-title">${titleText}</span>
      </div>
      <button type="button" class="live-toast-close" aria-label="Sluit melding" title="Sluit melding" style="width: 34px; height: 34px; min-width: 34px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; font-weight: 700; line-height: 1; border-radius: 6px; cursor: pointer; background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.25); color: #fff;">&times;</button>
    `;

    const closeBtn = toast.querySelector(".live-toast-close");
    const removeToast = () => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    };
    closeBtn.addEventListener("click", removeToast);
    // GEEN setTimeout auto-dismiss: notificatie blijft persistent staan tot de gebruiker op het kruisje klikt!

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

    const isVideoUrl = Boolean(
      photoUrl &&
        (photoUrl.startsWith("data:video/") ||
          /\.(mp4|mov|webm|m4v|3gp|avi|mkv|quicktime)(\?|$)/i.test(photoUrl))
    );
    const mediaTag = isVideoUrl
      ? `<video src="${photoUrl}" controls autoplay playsinline style="max-width: 100%; max-height: 68dvh; border-radius: 8px; border: 1px solid var(--border-color); background: #000;">
           <source src="${photoUrl}" type="video/mp4">
           <source src="${photoUrl}" type="video/quicktime">
           <source src="${photoUrl}" type="video/webm">
         </video>`
      : `<img src="${photoUrl}" alt="${title}" style="max-width: 100%; max-height: 68dvh; border-radius: 8px; object-fit: contain; border: 1px solid var(--border-color); background: #000;" />`;

    lb.innerHTML = `
      <div class="modal-box" style="max-width: 680px; padding: 1rem; text-align: center; background: #070a0e; border-color: var(--accent);">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.65rem; text-align: left;">
          <div>
            <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--accent); font-weight: 700;">${title || "BEWIJSFOTO"}</div>
            ${subtitle ? `<div style="font-size: 0.82rem; color: #e2e8f0;">${subtitle}</div>` : ""}
          </div>
          <button type="button" class="btn btn-secondary lb-close-btn" style="flex: 0 0 auto; padding: 0.4rem 0.75rem; font-size: 0.75rem;">✕ Sluiten</button>
        </div>
        ${mediaTag}
        <div style="display: flex; justify-content: center; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap;">
          <a href="${photoUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="font-size: 0.76rem; padding: 0.45rem 0.85rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem; background: #10b981; border-color: #10b981; color: #020617; font-weight: 800;">
            ▶ Speel Af / Bekijk in Nieuw Tabblad ↗
          </a>
          <a href="${photoUrl}" download class="btn btn-secondary" style="font-size: 0.76rem; padding: 0.45rem 0.85rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem;">
            ⬇ Download Bestand
          </a>
        </div>
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
      const activeAgentId = getActiveAgentId();
      const isMyPage =
        currentPagePlayerId === p.id ||
        (activeAgentId && activeAgentId === p.id) ||
        localStorage.getItem("jb_my_agent_id") === p.id;
      const isUnlockedOnThisDevice =
        sessionStorage.getItem(`dossier_unlocked_${p.id}`) === "true" ||
        localStorage.getItem(`dossier_unlocked_${p.id}`) === "true" ||
        isMyPage;

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
                  `🎉 Gamemaster HQ kende ${absPts} punten toe!${suffix}${b.reason ? ' // ' + b.reason : ''}`,
                  "MESSAGE FROM HQ",
                  false
                );
              } else if (b.delta < 0) {
                const suffix = !isMyPage ? ` (${p.naam})` : "";
                showLiveToast(
                  `⚠️ Gamemaster HQ trok ${absPts} punten af!${suffix}${b.reason ? ' // ' + b.reason : ''}`,
                  "MESSAGE FROM HQ",
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
    let catBadge = "📡 MESSAGE FROM HQ";
    let catClass = "tip";
    let headerTitle = "📡 MESSAGE FROM HQ";

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

    const isNextLocAlert = Boolean(m.text && m.text.includes("VOLGENDE LOCATIE ONTGRENDELD"));
    const isRecallAlert = Boolean(m.text && m.text.includes("KEER ONMIDDELLIJK TERUG NAAR HQ"));

    let alertHeaderTitle = headerTitle;
    let alertBadgeTag = catBadge;
    let alertBoxClass = catClass;
    let alertCustomStyle = "";
    let alertConfirmText = "⚡ BEVESTIG ONTVANGST";

    if (isRecallAlert) {
      alertHeaderTitle = "🚨 HOOFDKWARTIER SPOEDTRANSMISSIE // LAATSTE SECTOR AFGEROND";
      alertBadgeTag = "🏁 ALLE 6 LOCATIES VOLTOOID // KEUZEMOMENT";
      alertBoxClass = "alert";
      alertCustomStyle = "border-color: #fbbf24; box-shadow: 0 0 50px rgba(245, 158, 11, 0.55);";
      alertConfirmText = "⚡ BEGREPEN // WIJ MAKEN ONZE KEUZE &rarr;";
    } else if (isNextLocAlert) {
      alertHeaderTitle = "🔓 HOOFDKWARTIER TRANSMISSIE // VOLGENDE LOCATIE VRIJGEGEVEN";
      alertBadgeTag = "🎯 VOLGENDE BESTEMMING VRIJGEGEVEN";
      alertBoxClass = "alert";
      alertCustomStyle = "border-color: #10b981; box-shadow: 0 0 45px rgba(16, 185, 129, 0.45);";
      alertConfirmText = "⚡ GOED BEGREPEN // BEKIJK ONTGRENDELDE BESTEMMING &rarr;";
    }

    backdrop.innerHTML = `
      <div class="intel-popup-box intel-theme-${alertBoxClass}" style="${alertCustomStyle}">
        <div class="intel-popup-header">
          <div class="intel-popup-beacon">
            <span class="intel-beacon-dot" style="${isRecallAlert ? 'background:#f59e0b; box-shadow:0 0 12px #f59e0b;' : isNextLocAlert ? 'background:#10b981; box-shadow:0 0 10px #10b981;' : ''}"></span>
            <span class="intel-header-title">${alertHeaderTitle}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            ${queueIndicator}
            <button type="button" class="intel-popup-x-close" aria-label="Sluit melding" title="Sluiten" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.25); color: #fff; width: 34px; height: 34px; border-radius: 6px; font-size: 1.4rem; font-weight: 700; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
          </div>
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
            <span class="intel-popup-tag ${alertBoxClass}" style="${isRecallAlert ? 'background:rgba(245,158,11,0.2); color:#fde047; border-color:#fbbf24;' : isNextLocAlert ? 'background:rgba(16,185,129,0.2); color:#34d399; border-color:#10b981;' : ''}">${alertBadgeTag}</span>
            ${
              m.locationName
                ? `<span class="intel-popup-loc-pill" style="border-color:${isRecallAlert ? '#fbbf24; color:#fde047;' : '#10b981; color:#34d399;'}">📍 ${escapeHtml(m.locationName)}</span>`
                : ""
            }
          </div>
          ${
            isRecallAlert
              ? `
                <div style="background: rgba(245, 158, 11, 0.16); border: 2.5px solid #fbbf24; border-radius: 12px; padding: 1.35rem 1.1rem; text-align: center; margin: 0.65rem 0; box-shadow: 0 0 35px rgba(245, 158, 11, 0.45);">
                  <div style="font-size: 2.6rem; margin-bottom: 0.45rem;">🏃💨 🏁 ⭐</div>
                  <div style="font-family: var(--font-mono); font-size: 1.02rem; font-weight: 900; color: #fde047; letter-spacing: 0.02em; line-height: 1.5; text-transform: uppercase;">
                    ${escapeHtml(m.text)}
                  </div>
                </div>
              `
              : isNextLocAlert
              ? `
                <div style="background: rgba(16, 185, 129, 0.16); border: 2.5px solid #10b981; border-radius: 10px; padding: 1.25rem 1rem; text-align: center; margin: 0.5rem 0; box-shadow: 0 0 25px rgba(16, 185, 129, 0.35);">
                  <div style="font-size: 2.4rem; margin-bottom: 0.4rem;">🔓🎯</div>
                  <div style="font-family: var(--font-mono); font-size: 1.12rem; font-weight: 900; color: #34d399; letter-spacing: 0.04em; line-height: 1.45; text-transform: uppercase;">
                    ${escapeHtml(m.text)}
                  </div>
                </div>
              `
              : `<div class="intel-popup-content">${escapeHtml(m.text || "")}</div>`
          }
        </div>
        <div class="intel-popup-actions">
          <button type="button" class="btn btn-primary intel-popup-confirm-btn" style="${isRecallAlert ? 'background:#f59e0b; border-color:#fbbf24; color:#05080d; font-weight:900;' : isNextLocAlert ? 'background:#10b981; border-color:#10b981; color:#05080d; font-weight:800;' : ''}">
            <span>${alertConfirmText}</span>
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

      if (isNextLocAlert) {
        const locList = document.getElementById("locations-list");
        if (locList) {
          setTimeout(() => {
            locList.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 80);
        }
      }

      if (intelQueue.length > 0) {
        showNextIntel();
      } else {
        backdrop.classList.remove("active");
        isIntelModalOpen = false;
      }
    };

    confirmBtn.onclick = dismissCurrent;
    const xCloseBtn = backdrop.querySelector(".intel-popup-x-close");
    if (xCloseBtn) xCloseBtn.onclick = dismissCurrent;
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
      eerstePlekPunten: 100,
      stapPerPlek: 5,
      minimumPunten: 10
    };

    const sortedEvents = Array.from(eventsMap.values()).sort(
      (a, b) => (a.ts || 0) - (b.ts || 0)
    );

    const unlocks = new Map(); // playerId -> { playerId, ts }
    const bonuses = new Map(); // playerId -> { totalDelta, history: [] }
    const OFFICIAL_GAME_GROUPS = {
      "daan": "Groep Rood",
      "leon": "Groep Rood",
      "merlijn": "Groep Rood",
      "emile": "Groep Paars",
      "julie": "Groep Paars",
      "lex": "Groep Paars",
      "luna": "Groep Paars",
      "lotte": "Groep Groen",
      "rik": "Groep Groen",
      "rosan": "Groep Groen",
      "jassin": "Groep Blauw",
      "matthijs": "Groep Blauw",
      "riet": "Groep Blauw",
      "dominique": "Groep Geel",
      "floris": "Groep Geel",
      "jules": "Groep Geel"
    };

    const playerGroups = new Map(); // playerId -> groupId (bv. "Groep Blauw")
    Object.entries(OFFICIAL_GAME_GROUPS).forEach(([pid, gid]) => playerGroups.set(pid, gid));
    const groupCustomNames = new Map(); // groupId -> customName (bv. "De Wolven")
    const groupRevealedSteps = new Map(); // groupId -> revealedStepCount (1..6)
    const disabledPlayers = new Set(); // playerIds die niet meedoen
    const photosMap = new Map(); // eventId -> photo object
    const messagesMap = new Map(); // eventId -> message board object
    const playerLocUnlocks = new Map(); // playerId -> Set<locationId>
    const bonusSolves = []; // list of { eventId, playerId, playerName, groupId, riddleId, answer, status, reward, ts }
    const reviewedSubmissionsMap = new Map(); // targetEventId -> { eventId, label, awardedPoints, reviewedAt }
    const hqArrivals = new Map(); // groupId -> { groupId, place, points, ts }
    let groupVisibilityMode = "hide"; // "hide" (standaard verborgen tot leiding onthult), "show" (leiding onthult aan iedereen)
    let debriefingModeActive = false;
    const debriefedPlayersMap = new Map(); // playerId -> { ts, eventId }
    const groupDebriefExemptions = new Map(); // normGroupId -> boolean (true = heropend / vrijgesteld)

    for (const ev of sortedEvents) {
      if (ev.type === "reset") {
        unlocks.clear();
        bonuses.clear();
        photosMap.clear();
        messagesMap.clear();
        playerLocUnlocks.clear();
        groupRevealedSteps.clear();
        bonusSolves.length = 0;
        reviewedSubmissionsMap.clear();
        hqArrivals.clear();
        groupVisibilityMode = "hide";
        debriefingModeActive = false;
        debriefedPlayersMap.clear();
        groupDebriefExemptions.clear();
        if (ev.resetGroups) {
          playerGroups.clear();
          Object.entries(OFFICIAL_GAME_GROUPS).forEach(([pid, gid]) => playerGroups.set(pid, gid));
          groupCustomNames.clear();
        }
        if (ev.resetDisabled) {
          disabledPlayers.clear();
        }
      } else if (ev.type === "set_groups_visibility" && ev.mode) {
        groupVisibilityMode = ev.mode;
      } else if (ev.type === "set_debriefing_mode") {
        debriefingModeActive = Boolean(ev.active);
      } else if (ev.type === "set_group_debrief_exemption" && ev.groupId) {
        const normG = normalizeGroupId(ev.groupId);
        if (normG) {
          if (ev.exempt) {
            groupDebriefExemptions.set(normG, true);
          } else {
            groupDebriefExemptions.delete(normG);
          }
        }
      } else if (ev.type === "player_debrief" && ev.playerId) {
        debriefedPlayersMap.set(ev.playerId, {
          playerId: ev.playerId,
          ts: ev.ts || Date.now(),
          eventId: ev.eventId
        });
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
      } else if (ev.type === "set_group_revealed_step" && ev.groupId) {
        const normG = normalizeGroupId(ev.groupId);
        if (normG) {
          const step = Math.min(6, Math.max(1, Number(ev.stepNumber) || 1));
          groupRevealedSteps.set(normG, step);
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
      } else if (ev.type === "photo" && ev.playerId) {
        photosMap.set(ev.eventId, {
          eventId: ev.eventId,
          mediaType: ev.mediaType || "image",
          playerId: ev.playerId,
          locationId: ev.locationId || "",
          locationName: ev.locationName || "",
          photoUrl: ev.photoUrl || "",
          caption: ev.caption || "",
          ts: ev.ts
        });
      } else if (ev.type === "delete_photo" && ev.targetEventId) {
        photosMap.delete(ev.targetEventId);
      } else if (ev.type === "hq_arrival" && ev.groupId) {
        const normG = normalizeGroupId(ev.groupId);
        if (normG) {
          hqArrivals.set(normG, {
            groupId: normG,
            place: Number(ev.place) || 1,
            points: Number(ev.points) || 0,
            ts: ev.ts || Date.now()
          });
        }
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
      } else if (ev.type === "bonus_submission") {
        bonusSolves.push({
          eventId: ev.eventId,
          playerId: ev.playerId,
          playerName: ev.playerName || ev.playerId,
          groupId: ev.groupId || null,
          riddleId: ev.riddleId,
          answer: ev.answer,
          status: ev.status,
          reward: ev.reward,
          ts: ev.ts
        });
      } else if (ev.type === "review_submission" && ev.targetEventId) {
        reviewedSubmissionsMap.set(ev.targetEventId, {
          eventId: ev.targetEventId,
          label: ev.label || "✓ Beoordeeld",
          awardedPoints: Number(ev.awardedPoints) || 0,
          reviewedAt: ev.reviewedAt || ev.ts
        });
      }
    }

    // Alleen actieve veldspelers (niet-gamemaster, niet-tester en niet-uitgeschakeld) tellen mee
    const isStaffPlayer = (id) => {
      const sp = SPEL_CONFIG.spelers.find((s) => s.id === id);
      return Boolean(sp && (sp.isGamemaster || sp.isExternalTester));
    };

    const unlockOrder = Array.from(unlocks.values())
      .filter((item) => !disabledPlayers.has(item.playerId) && !isStaffPlayer(item.playerId))
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

    // Bepaal of ALLE aanwezige spelers hun code al hebben ingevuld (exclusief Vicce / Gamemaster)
    const enabledCount = SPEL_CONFIG.spelers.filter(
      (s) => !disabledPlayers.has(s.id) && !isStaffPlayer(s.id)
    ).length;
    const allPresentUnlocked =
      enabledCount > 0 && unlockOrder.length >= enabledCount;

    // Groepen worden ENKEL onthuld als de spelleiding expliciet op 'Onthul groepen nu aan iedereen' klikt!
    const groupsRevealed = groupVisibilityMode === "show";

    // Als groepen onthuld worden en de admin had nog geen groepen klaargezet,
    // verdeel de aanwezige spelers dan automatisch in groepen van ~4:
    const defaultGroupList = (SPEL_CONFIG.standaardGroepen || []).map(
      (g) => g.id || g.naam
    );
    // Maximaal 6 groepen zodat elk team aan 1 van de 6 unieke locaties begint
    const maxLocCount = (SPEL_CONFIG.locaties || []).length || 6;
    const numAutoGroups = Math.min(maxLocCount, Math.max(1, Math.min(enabledCount, 6)));
    let enabledIdx = 0;

    // Bouw volledige spelerslijst (Vicce wordt nooit meegenomen in groepsverdeling of klassement)
    const allPlayerScores = SPEL_CONFIG.spelers.map((speler) => {
      const isStaff = isStaffPlayer(speler.id);
      const isDisabled = disabledPlayers.has(speler.id) || isStaff;
      const unlockInfo = !isStaff && !disabledPlayers.has(speler.id) ? unlockRankMap.get(speler.id) || null : null;
      const bonusInfo = bonuses.get(speler.id) || { totalDelta: 0, history: [] };
      const basePoints = unlockInfo ? unlockInfo.basePoints : 0;
      const bonusPoints = !isDisabled ? bonusInfo.totalDelta : 0;
      const totalPoints = basePoints + bonusPoints;

      let configuredGroupId = !isDisabled
        ? playerGroups.get(speler.id) || speler.groepId || null
        : null;
      if (!isDisabled && configuredGroupId) enabledIdx++;

      const configuredGroupName = configuredGroupId
        ? groupCustomNames.get(configuredGroupId) || configuredGroupId
        : null;
      const configuredGroupColor = getGroupColor(configuredGroupId);

      // Spelers zien hun groep en unieke route direct zodra ze ingedeeld zijn!
      const visibleGroupId = configuredGroupId;
      const visibleGroupName = configuredGroupName;
      const visibleGroupColor = configuredGroupColor;
      const playerPhotos = photosByPlayer.get(speler.id) || [];

      return {
        ...speler,
        isGamemaster: isStaff,
        disabled: isDisabled,
        unlocked: Boolean(unlockInfo) || Boolean(unlocks.get(speler.id)),
        unlockRank: unlockInfo ? unlockInfo.rank : null,
        unlockedAt: unlockInfo ? unlockInfo.unlockedAt : (unlocks.get(speler.id) ? unlocks.get(speler.id).ts : null),
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
        active: Boolean(unlockInfo) || bonusPoints !== 0,
        // Debriefing & checkout status op het einde van de missie:
        debriefed: Boolean(debriefedPlayersMap.has(speler.id)),
        debriefedAt: debriefedPlayersMap.get(speler.id) ? debriefedPlayersMap.get(speler.id).ts : null,
        isDebriefExempt: Boolean(configuredGroupId && groupDebriefExemptions.get(normalizeGroupId(configuredGroupId)))
      };
    });

    const enabledPlayerScores = allPlayerScores.filter((p) => !p.disabled && !p.isGamemaster);

    // Bereken groepen & groepsscores (op basis van adminGroupId, en zichtbaarheid op basis van groupsRevealed)
    const adminGroupsMap = new Map();
    enabledPlayerScores.forEach((p) => {
      if (!p.adminGroupId) return;
      if (!adminGroupsMap.has(p.adminGroupId)) {
        const orderedLocs = getOrderedLocationsForGroup(p.adminGroupId);
        const normG = normalizeGroupId(p.adminGroupId);
        adminGroupsMap.set(p.adminGroupId, {
          id: p.adminGroupId,
          normId: normG,
          naam: p.adminGroupName,
          kleur: p.adminGroupColor,
          leden: [],
          totalPoints: 0,
          unlockedCount: 0,
          isDebriefExempt: Boolean(groupDebriefExemptions.get(normG)),
          orderedLocations: orderedLocs,
          startLocationName: orderedLocs.length > 0 ? orderedLocs[0].naam : ""
        });
      }
      const grp = adminGroupsMap.get(p.adminGroupId);
      grp.leden.push(p);
      grp.totalPoints += p.totalPoints;
      if (p.unlocked) grp.unlockedCount += 1;
    });

    // Bereken het eerlijke teamgemiddelde per groep (onafhankelijk van 4 of 5 spelers!)
    adminGroupsMap.forEach((grp) => {
      const activeLedenCount = grp.leden.length;
      grp.sumPoints = grp.totalPoints; // de ruwe som van alle leden
      const rawAvg = activeLedenCount > 0 ? grp.sumPoints / activeLedenCount : 0;
      // Afronding op 1 decimaal (bv. 142.5), en afgerond op heel getal voor overzicht
      grp.averagePoints = Math.round(rawAvg * 10) / 10;
      grp.roundedAverage = Math.round(rawAvg);
      // De officiële teamscore is het gemiddelde per lid (eerlijk tussen 4 en 5 spelers!):
      grp.totalPoints = grp.averagePoints;
      grp.score = grp.averagePoints;
    });

    const adminGroupsList = Array.from(adminGroupsMap.values()).sort((a, b) => {
      if (b.averagePoints !== a.averagePoints) return b.averagePoints - a.averagePoints;
      if (b.unlockedCount !== a.unlockedCount) return b.unlockedCount - a.unlockedCount;
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
      const normG = normalizeGroupId(grp.id);
      // Alle 6 locaties zijn nu direct zichtbaar & open voor iedereen
      const revealedCount = groupRevealedSteps.get(normG) || 6;
      grp.revealedStepCount = revealedCount;

      const sharedLocs = new Set();
      (grp.orderedLocations || []).forEach((loc) => {
        loc.isRevealed = true;
        sharedLocs.add(loc.id);
      });

      const memberIds = new Set(grp.leden.map((m) => m.id));
      const grpPhotos = allPhotos.filter((ph) => memberIds.has(ph.playerId));

      grp.unlockedLocations = sharedLocs;
      grp.photos = grpPhotos;

      // Volgende locatie om te ontgrendelen
      const nextLoc = (grp.orderedLocations || []).find((l) => l.stepNr === revealedCount + 1) || null;
      grp.nextLocationToReveal = nextLoc;

      // Huidige actieve locatie
      const currentLoc = (grp.orderedLocations || []).find((l) => l.stepNr === revealedCount) || null;
      grp.currentLocation = currentLoc ? { ...currentLoc, status: revealedCount >= 6 ? "voltooid" : "bezig" } : null;
      grp.completedLocationsCount = (grp.orderedLocations || []).filter((l) => {
        return sharedLocs.has(l.id) && grpPhotos.some((ph) => ph.locationId === l.id);
      }).length;
    });

    // Deel map-inhoud (foto's + geopende locaties + message board) én locatie-volgorde met iedereen van hetzelfde team zodra groepen onthuld zijn!
    allPlayerScores.forEach((p) => {
      const pGrpId = p.groupId || p.adminGroupId;
      const normPG = pGrpId ? normalizeGroupId(pGrpId) : null;
      const pRevealedStepCount = normPG ? (groupRevealedSteps.get(normPG) || 6) : 6;
      p.groupRevealedStepCount = pRevealedStepCount;

      p.orderedLocations = getOrderedLocationsForGroup(p.groupId || p.adminGroupId);
      (p.orderedLocations || []).forEach((loc) => {
        loc.isRevealed = true;
      });

      // Filter berichten die voor deze speler of zijn/haar team bestemd zijn
      const myNormG = normalizeGroupId(p.groupId || p.adminGroupId);
      p.messages = allMessages.filter((m) => {
        if (m.targetType === "all") return true;
        if (m.targetType === "player" && m.targetId === p.id) return true;
        if (
          m.targetType === "group" &&
          (m.targetId === p.groupId || m.targetId === p.adminGroupId || (myNormG && normalizeGroupId(m.targetId) === myNormG))
        ) {
          return true;
        }
        return false;
      });

      const sharedLocs = new Set();
      // Voeg alle locaties tot en met pRevealedStepCount toe
      (p.orderedLocations || []).forEach((loc) => {
        if (loc.isRevealed) sharedLocs.add(loc.id);
      });

      if (!p.disabled && p.groupId && adminGroupsMap.has(p.groupId)) {
        const grp = adminGroupsMap.get(p.groupId);
        p.groupMembers = grp.leden.map((m) => m.naam);
        p.groupAveragePoints = grp.averagePoints;
        p.groupTotalPoints = grp.averagePoints;
        p.groupSumPoints = grp.sumPoints;
        p.groupRank = adminGroupsList.findIndex((g) => g.id === grp.id) + 1;

        grp.leden.forEach((member) => {
          const mSet = playerLocUnlocks.get(member.id);
          if (mSet) {
            mSet.forEach((locId) => sharedLocs.add(locId));
          }
        });
        p.sharedUnlockedLocations = sharedLocs;

        const memberIds = new Set(grp.leden.map((m) => m.id));
        p.sharedPhotos = allPhotos.filter((ph) => memberIds.has(ph.playerId));
        p.bonusSolves = bonusSolves.filter(
          (s) => (s.playerId === p.id || memberIds.has(s.playerId)) && s.status === "correct"
        );
      } else {
        p.groupMembers = [];
        const mSet = playerLocUnlocks.get(p.id);
        if (mSet) mSet.forEach((id) => sharedLocs.add(id));
        p.sharedUnlockedLocations = sharedLocs;
        p.sharedPhotos = allPhotos.filter((ph) => ph.playerId === p.id);
        p.bonusSolves = bonusSolves.filter(
          (s) => s.playerId === p.id && s.status === "correct"
        );
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
      allGroups: adminGroupsList.length > 0 ? adminGroupsList : (SPEL_CONFIG.standaardGroepen || []),
      groups: adminGroupsList,
      groupsList,
      adminGroupsList,
      groupsRevealed,
      groupVisibilityMode,
      groupCustomNames,
      hasGroups: groupsRevealed && adminGroupsList.length > 0,
      hasAssignedGroups: playerGroups.size > 0,
      allPhotos,
      allMessages,
      bonusSolves: bonusSolves.sort((a, b) => (b.ts || 0) - (a.ts || 0)),
      playerScoresMap: playerLookup,
      unlockedCount: unlockOrder.length,
      totalCount: enabledPlayerScores.length,
      nextRank,
      nextPoints,
      debriefingActive: debriefingModeActive,
      groupDebriefExemptions,
      debriefedCount: enabledPlayerScores.filter((p) => p.debriefed).length,
      debriefedPlayersMap,
      reviewedSubmissionsMap,
      hqArrivals: Array.from(hqArrivals.values()).sort((a, b) => a.place - b.place),
      hqArrivalsMap: hqArrivals
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

  // =========================================================================
  // MULTI-BROKER REALTIME CLOUD ENGINE (EMQX + HiveMQ Secure WebSockets)
  // -------------------------------------------------------------------------
  // Speciaal geoptimaliseerd voor 4G/5G in België (Proximus, Telenet, Orange, Base).
  // Gebruikt TLS WebSockets met keepalive (30s) zodat mobiele operators de verbinding
  // nooit droppen, en retained state snapshots zodat telefoons binnen 30ms up-to-date zijn.
  // =========================================================================
  const MQTT_BROKERS = [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://broker.hivemq.com:8884/mqtt"
  ];
  const MQTT_BASE_TOPIC = `ksa/erfpacht/2026/${SPEL_CONFIG.cloudChannel || "operatie_erfpacht"}`;
  const TOPIC_EVENTS = `${MQTT_BASE_TOPIC}/events`;
  const TOPIC_STATE = `${MQTT_BASE_TOPIC}/state`;
  const TOPIC_REQ = `${MQTT_BASE_TOPIC}/req`;
  const TOPIC_GPS = `${MQTT_BASE_TOPIC}/gps`;

  // =========================================================================
  // LIVE GPS AGENT TRACKER ENGINE (Realtime Veldcoördinaten via MQTT)
  // =========================================================================
  const agentGpsPositions = new Map(); // playerId -> gps object
  const gpsListeners = new Set();
  let gpsWatchId = null;
  let lastGpsSendTs = 0;
  let activeTrackingPlayerId = null;
  let activeTrackingPlayerName = null;

  function ingestGpsPing(data) {
    if (!data || !data.playerId || typeof data.lat !== "number" || typeof data.lng !== "number") return;
    const existing = agentGpsPositions.get(data.playerId);
    if (existing && existing.ts && data.ts && data.ts < existing.ts) return;

    agentGpsPositions.set(data.playerId, {
      ...data,
      receivedAt: Date.now()
    });
    notifyGpsListeners();
  }

  function notifyGpsListeners() {
    const list = Array.from(agentGpsPositions.values());
    gpsListeners.forEach((fn) => {
      try { fn(list); } catch (_) {}
    });
  }

  function startLiveGpsTracking(playerId, playerName) {
    if (typeof window === "undefined" || !navigator.geolocation) {
      console.warn("Geen geolocatie ondersteuning in deze browser.");
      return false;
    }

    activeTrackingPlayerId = playerId;
    activeTrackingPlayerName = playerName;

    stopLiveGpsTracking();

    const options = {
      enableHighAccuracy: true,
      maximumAge: 8000,
      timeout: 15000
    };

    const handlePos = (position) => {
      if (!position || !position.coords) return;
      const now = Date.now();
      // Throttle naar maximaal 1 ping per 10 seconden om batterij en mobiele data te sparen
      if (now - lastGpsSendTs < 10000) return;
      lastGpsSendTs = now;

      const currentState = computeScoreState();
      const pInfo = currentState.playerScoresMap.get(playerId);
      const groupId = pInfo ? (pInfo.groupId || pInfo.adminGroupId || null) : null;
      const groupName = pInfo ? (pInfo.groupName || pInfo.adminGroupName || null) : null;
      const groupColor = pInfo ? (pInfo.groupColor || pInfo.adminGroupColor || "#38bdf8") : "#38bdf8";

      const ping = {
        type: "gps_ping",
        playerId,
        playerName: playerName || (pInfo ? pInfo.naam : playerId),
        dossierNr: pInfo ? pInfo.dossierNr : "??",
        groupId,
        groupName,
        groupColor,
        lat: Number(position.coords.latitude.toFixed(6)),
        lng: Number(position.coords.longitude.toFixed(6)),
        accuracy: Math.round(position.coords.accuracy || 0),
        heading: position.coords.heading,
        speed: position.coords.speed,
        ts: now
      };

      ingestGpsPing(ping);

      // Realtime live broadcast naar Beamer en HQ Dashboard via MQTT WebSockets
      if (mqttClient && mqttClient.connected) {
        try {
          mqttClient.publish(TOPIC_GPS, JSON.stringify(ping), { qos: 0 });
        } catch (_) {}
      }
    };

    const handleErr = (err) => {
      console.warn("GPS tracking status:", err.message);
    };

    try {
      navigator.geolocation.getCurrentPosition(handlePos, handleErr, options);
      gpsWatchId = navigator.geolocation.watchPosition(handlePos, handleErr, options);
      return true;
    } catch (e) {
      console.warn("GPS watchPosition start mislukt:", e);
      return false;
    }
  }

  function stopLiveGpsTracking() {
    if (gpsWatchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
    }
  }

  let mqttClient = null;
  let currentBrokerIdx = 0;
  let myClientId = "agt_" + Math.random().toString(16).substring(2, 10);
  let isConnecting = false;
  let syncStatus = "connecting"; // "connected" | "connecting" | "offline"
  const syncStatusListeners = new Set();

  function updateSyncStatus(status) {
    if (syncStatus === status) return;
    syncStatus = status;
    syncStatusListeners.forEach((fn) => {
      try { fn(status); } catch (_) {}
    });
    if (typeof document !== "undefined") {
      const dots = document.querySelectorAll(".status-dot, #statusDot, .live-pulse-dot");
      dots.forEach((dot) => {
        if (status === "connected") {
          dot.style.background = "#10b981";
          dot.classList.remove("offline");
        } else if (status === "connecting") {
          dot.style.background = "#f59e0b";
        } else {
          dot.style.background = "#ef4444";
          dot.classList.add("offline");
        }
      });
    }
  }

  function broadcastStateRequest() {
    if (mqttClient && mqttClient.connected) {
      try {
        mqttClient.publish(TOPIC_REQ, JSON.stringify({ from: myClientId, ts: Date.now() }), { qos: 0 });
      } catch (e) {}
    }
  }

  function publishCurrentStateSnapshot() {
    if (mqttClient && mqttClient.connected) {
      try {
        const eventsList = Array.from(eventsMap.values());
        if (eventsList.length === 0) return;
        const snapshot = {
          events: eventsList,
          from: myClientId,
          ts: Date.now()
        };
        mqttClient.publish(TOPIC_STATE, JSON.stringify(snapshot), { qos: 1, retain: true });
      } catch (e) {}
    }
  }

  function ensureMqttScript() {
    if (typeof window === "undefined" || typeof window.mqtt !== "undefined") return;
    if (document.getElementById("mqtt-script-loader")) return;
    const s = document.createElement("script");
    s.id = "mqtt-script-loader";
    const isSub =
      window.location.pathname.includes("/spelers/") ||
      window.location.pathname.includes("\\spelers\\");
    s.src = isSub ? "../js/mqtt.min.js" : "js/mqtt.min.js";
    s.onload = () => connectMqtt();
    document.head.appendChild(s);
  }

  const pendingOutboxEvents = [];

  function flushOutbox() {
    if (!mqttClient || !mqttClient.connected) return;
    let sentAny = false;
    while (pendingOutboxEvents.length > 0) {
      const item = pendingOutboxEvents.shift();
      try {
        mqttClient.publish(TOPIC_EVENTS, JSON.stringify(item), { qos: 1 });
        sentAny = true;
      } catch (err) {
        console.warn("Outbox flush fout:", err);
        pendingOutboxEvents.unshift(item);
        break;
      }
    }
    if (sentAny || eventsMap.size > 0) {
      publishCurrentStateSnapshot();
    }
  }

  function connectMqtt() {
    if (typeof window === "undefined") return;
    if (typeof window.mqtt === "undefined") {
      ensureMqttScript();
      return;
    }
    if (mqttClient && mqttClient.connected) {
      updateSyncStatus("connected");
      flushOutbox();
      return;
    }
    if (isConnecting) return;
    isConnecting = true;

    const brokerUrl = MQTT_BROKERS[currentBrokerIdx];
    updateSyncStatus("connecting");

    try {
      mqttClient = window.mqtt.connect(brokerUrl, {
        clientId: myClientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 3000,
        keepalive: 30 // Houdt 4G verbindingen actief tegen carrier NAT-timeouts
      });

      mqttClient.on("connect", () => {
        isConnecting = false;
        updateSyncStatus("connected");

        mqttClient.subscribe([TOPIC_EVENTS, TOPIC_STATE, TOPIC_REQ, TOPIC_GPS], { qos: 1 }, (err) => {
          if (!err) {
            broadcastStateRequest();
            flushOutbox();
            if (eventsMap.size > 0) {
              publishCurrentStateSnapshot();
            }
          }
        });
      });

      mqttClient.on("message", (topic, payloadBuffer) => {
        try {
          const payloadStr = payloadBuffer.toString();
          const data = JSON.parse(payloadStr);

          if (topic === TOPIC_EVENTS) {
            if (data && data.eventId) {
              if (ingestRawEvent(data)) {
                notifyListeners();
                publishCurrentStateSnapshot();
              }
            }
          } else if (topic === TOPIC_STATE) {
            if (data && Array.isArray(data.events)) {
              let changed = false;
              for (const ev of data.events) {
                if (ingestRawEvent(ev)) changed = true;
              }
              if (changed) notifyListeners();
            }
          } else if (topic === TOPIC_REQ) {
            if (data && data.from !== myClientId && eventsMap.size > 0) {
              publishCurrentStateSnapshot();
            }
          } else if (topic === TOPIC_GPS) {
            if (data && data.playerId && typeof data.lat === "number" && typeof data.lng === "number") {
              ingestGpsPing(data);
            }
          }
        } catch (err) {
          console.warn("Fout bij verwerken realtime MQTT pakket:", err);
        }
      });

      mqttClient.on("error", (err) => {
        console.warn("MQTT wolk wissel:", brokerUrl, err);
        isConnecting = false;
        currentBrokerIdx = (currentBrokerIdx + 1) % MQTT_BROKERS.length;
        updateSyncStatus("connecting");
      });

      mqttClient.on("offline", () => {
        isConnecting = false;
        updateSyncStatus("offline");
      });

      mqttClient.on("reconnect", () => {
        updateSyncStatus("connecting");
      });
    } catch (err) {
      isConnecting = false;
      setTimeout(connectMqtt, 3000);
    }
  }

  function startRealtimeSync() {
    if (isSyncing) return;
    isSyncing = true;
    loadLocalCache();
    notifyListeners();
    connectMqtt();
    fetchCloudHistory();

    const fbUrl = getFirebaseUrl();
    if (fbUrl) {
      if (!pollInterval) {
        pollInterval = setInterval(fetchCloudHistory, 3000);
      }
      return;
    }

    // Achtergrond heartbeat / polling backup (elke 6s voor 100% zekere live sync op 4G)
    if (!pollInterval) {
      pollInterval = setInterval(() => {
        if (!mqttClient || !mqttClient.connected) {
          connectMqtt();
        }
        fetchCloudHistory();
      }, 6000);
    }

    // Luister ook naar tab focus / wake om direct verbinding te herstellen
    if (typeof window !== "undefined") {
      window.addEventListener("focus", () => {
        connectMqtt();
        fetchCloudHistory();
        flushOutbox();
      });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          connectMqtt();
          fetchCloudHistory();
          flushOutbox();
        }
      });
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

    // 1. Live broadcast via MQTT WebSockets (met outbox wachtrij voor als 4G even hapert)
    pendingOutboxEvents.push(ev);
    if (mqttClient && mqttClient.connected) {
      flushOutbox();
    } else {
      connectMqtt();
    }

    // 2. Achtergrond fallback (ntfy / firebase)
    const fbUrl = getFirebaseUrl();
    try {
      if (fbUrl) {
        fetch(`${fbUrl}/events.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ev)
        }).catch(() => {});
      } else {
        fetch(`https://ntfy.sh/${encodeURIComponent(SPEL_CONFIG.cloudChannel)}`, {
          method: "POST",
          body: JSON.stringify(ev)
        }).catch(() => {});
      }
    } catch (_) {}

    return computeScoreState();
  }

  async function recordUnlock(playerId) {
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

    // 1. Lokale voorbewerking:
    // Foto's worden op het toestel snel verkleind naar ~150KB JPEG voor razendsnelle mobiele verzending
    if (!isVideo) {
      try {
        const compressed = await compressImageFile(file, 900, 0.78);
        blob = compressed.blob;
        finalPhotoUrl = compressed.dataUrl;
      } catch (_) {
        blob = file;
      }
    }

    // 2. Primaire Media Cloud: Litterbox API (Ondersteunt tot 1 GB per bestand, anoniem, 24u retentie)
    if (blob) {
      try {
        const ext = isVideo
          ? ((file.name && file.name.split(".").pop()) || "mp4")
          : "jpg";
        const filename = `bewijs_${playerId}_${locationId || "algemeen"}_${Date.now()}.${ext}`;

        const fd = new FormData();
        fd.append("reqtype", "fileupload");
        fd.append("time", "24h");
        fd.append("fileToUpload", blob, filename);

        const litterRes = await fetch(
          "https://litterbox.catbox.moe/resources/internals/api.php",
          {
            method: "POST",
            body: fd
          }
        );

        if (litterRes.ok) {
          const respText = (await litterRes.text()).trim();
          if (respText.startsWith("http")) {
            finalPhotoUrl = respText;
          }
        }
      } catch (errLitter) {
        console.warn("Litterbox upload niet gelukt, probeert secundaire fallback:", errLitter);
      }
    }

    // 3. Secundaire Media Fallback: ntfy media kanaal (voor bestanden < 15MB)
    const fbUrl = getFirebaseUrl();
    if (!fbUrl && blob && (!finalPhotoUrl || finalPhotoUrl.startsWith("data:"))) {
      try {
        const ext = isVideo
          ? ((file.name && file.name.split(".").pop()) || "mp4")
          : "jpg";
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
        console.warn("Ntfy media fallback waarschuwing:", e);
      }
    }

    // 4. Veilige doorgifte naar HQ:
    // Als video niet extern kon worden geüpload (bv. 4G weggevallen), stuur de melding veilig door
    // zónder gigantische dataUrl in het JSON-event, zodat HQ de inzending altijd ontvangt!
    let finalCaption = (caption || "").trim();
    if (isVideo && (!finalPhotoUrl || finalPhotoUrl.startsWith("data:"))) {
      finalPhotoUrl = "";
      finalCaption = `[VIDEO OP TOESTEL AGENT] ${finalCaption}`.trim();
    }

    return publishEvent({
      type: "photo",
      mediaType: isVideo ? "video" : "image",
      playerId,
      locationId: locationId || "",
      locationName: locationName || "",
      photoUrl: finalPhotoUrl,
      caption: finalCaption
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

  const FINAL_RECALL_TEXT =
    "KEER ONMIDDELLIJK TERUG NAAR HQ, TENZIJ JULLIE NOG BONUSOPDRACHTEN WILLEN VOLTOOIEN. HOE EERDER JE AANKOMT, HOE MEER PUNTEN JE KRIJGT MAAR MISSCHIEN IS HET DAT NIET WAARD EN VERDIEN JE NET MEER PUNTEN DOOR NOG BONUSOPDRACHTEN UIT TE VOEREN... DIE AFWEGING IS AAN JULLIE. TIP: ALLE BONUSPUNTEN OPGETELD ZIJN SOWIESO MEER WAARD DAN DE PUNTEN DIE JE VERDIENT MET EERST TE ZIJN. SUCCES.";

  /**
   * Stuur de dramatische finale recall pop-up naar alle leden van een groep:
   * "KEER ONMIDDELLIJK TERUG NAAR HQ, TENZIJ JULLIE NOG BONUSOPDRACHTEN WILLEN VOLTOOIEN..."
   */
  async function recallGroupToHQ(groupId, customMessage) {
    const state = computeScoreState();
    const grp = (state.adminGroupsList || state.groupsList || []).find(
      (g) => normalizeGroupId(g.id) === normalizeGroupId(groupId)
    );
    if (!grp) return state;

    await postBoardMessage({
      targetType: "group",
      targetId: grp.id,
      text: customMessage || FINAL_RECALL_TEXT,
      category: "alert",
      locationId: "hq",
      locationName: "Hoofdkwartier (Kapucijnenstraat 7)"
    });

    return computeScoreState();
  }

  /**
   * Onthul de volgende locatie voor een specifieke groep en stuur een schermvullende alert
   * naar alle leden van die groep:
   * "GOED WERK. VOLGENDE LOCATIE ONTGRENDELD. CHECK JULLIE PERSOONLIJKE FILES OM TE KIJKEN NAAR WAAR JULLIE MOETEN."
   * Als de groep al bij de 6e locatie is, activeert dit automatisch de finale recall.
   */
  async function revealNextLocationForGroup(groupId, customMessage) {
    const state = computeScoreState();
    const grp = (state.adminGroupsList || state.groupsList || []).find(
      (g) => normalizeGroupId(g.id) === normalizeGroupId(groupId)
    );
    if (!grp) return state;

    const curStep = grp.revealedStepCount || 1;
    if (curStep >= 6) {
      return recallGroupToHQ(groupId, customMessage);
    }

    const nextStep = Math.min(6, curStep + 1);
    const nextLoc = (grp.orderedLocations || []).find((l) => l.stepNr === nextStep);

    // 1. Publiceer event om de progressie in de cloud/state op te slaan
    await publishEvent({
      type: "set_group_revealed_step",
      groupId: grp.id,
      stepNumber: nextStep,
      locationId: nextLoc ? nextLoc.id : null,
      locationName: nextLoc ? nextLoc.naam : ""
    });

    // 2. Publiceer een duidelijke pop-up melding specifiek voor alle leden van deze groep
    const msgText =
      customMessage ||
      "GOED WERK. VOLGENDE LOCATIE ONTGRENDELD. CHECK JULLIE PERSOONLIJKE FILES OM TE KIJKEN NAAR WAAR JULLIE MOETEN.";
    await postBoardMessage({
      targetType: "group",
      targetId: grp.id,
      text: msgText,
      category: "alert",
      locationId: nextLoc ? nextLoc.id : null,
      locationName: nextLoc ? nextLoc.naam : ""
    });

    return computeScoreState();
  }

  /**
   * Keur een ingezonden opdracht (foto/video/opdracht) goed, ken de punten toe
   * én stuur direct de bevestigingsmelding naar de leden:
   * bv. "OPDRACHT SUCCESVOL: +50 PUNTEN VOOR HONDENFOTO"
   */
  async function awardSubmissionPoints({
    groupId = null,
    playerId = null,
    points = 35,
    taskName = "Opdracht",
    notificationText = "",
    eventId = null
  }) {
    const pts = Number(points) || 0;
    const cleanTask = String(taskName || "Opdracht").trim();
    const notifyMsg =
      notificationText ||
      `OPDRACHT SUCCESVOL: +${pts} PUNTEN VOOR ${cleanTask.toUpperCase()}`;

    if (groupId) {
      await addGroupBonusPoints(groupId, pts, `Opdracht goedgekeurd (${cleanTask})`);
      await postBoardMessage({
        targetType: "group",
        targetId: groupId,
        category: "alert",
        text: notifyMsg
      });
    } else if (playerId) {
      await addBonusPoints(playerId, pts, `Opdracht goedgekeurd (${cleanTask})`);
      await postBoardMessage({
        targetType: "player",
        targetId: playerId,
        category: "alert",
        text: notifyMsg
      });
    }

    if (eventId) {
      await publishEvent({
        type: "review_submission",
        targetEventId: eventId,
        awardedPoints: pts,
        label: `✓ +${pts} PT (${cleanTask})`,
        reviewedAt: Date.now()
      });
    }

    return computeScoreState();
  }

  /**
   * Stel het aantal onthulde locaties in voor een groep (1..6)
   */
  async function setGroupRevealedStep(groupId, stepNumber) {
    const step = Math.min(6, Math.max(1, Number(stepNumber) || 1));
    await publishEvent({
      type: "set_group_revealed_step",
      groupId,
      stepNumber: step
    });
    return computeScoreState();
  }

  /**
   * Onthul direct alle 6 locaties voor een groep (bv. nood-override of leiding2026)
   */
  async function unlockAllLocationsForGroup(groupId) {
    return setGroupRevealedStep(groupId, 6);
  }

  /**
   * Geef bonuspunten aan elk lid van een specifiek team tegelijk.
   */
  async function addGroupBonusPoints(groupId, delta, reason = "Team bonus") {
    const state = computeScoreState();
    const grp = (state.adminGroupsList || state.groupsList || []).find(
      (g) => g.id === groupId || normalizeGroupId(g.id) === normalizeGroupId(groupId)
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
   * Registreer de officiële fysieke aankomst van een groep op HQ.
   * Kent automatisch de aankomstpunten toe (1e: +100, 2e: +75, 3e: +50, 4e: +30, 5e: +15),
   * stuurt een live broadcast naar alle veldagenten en slaat de ranking vast.
   */
  async function registerHqArrival({ groupId, place, points }) {
    const pts = Number(points) || 0;
    const rank = Number(place) || 1;
    const rankLabel = rank === 1 ? "1e PLEK 🥇" : rank === 2 ? "2e PLEK 🥈" : rank === 3 ? "3e PLEK 🥉" : `${rank}e PLEK`;
    const normG = normalizeGroupId(groupId);
    const reason = `Aankomst HQ (${rankLabel}: +${pts} PT)`;

    await addGroupBonusPoints(normG, pts, reason);
    await postBoardMessage({
      targetType: "all",
      category: "alert",
      locationId: "hq",
      locationName: "Hoofdkwartier (Kapucijnenstraat 7)",
      text: `🏁 GROEP AANKOMST OP HQ // ${rankLabel}!\nTeam ${normG.toUpperCase()} is zojuist binnengekomen op HQ en verdient +${pts} aankomstpunten!`
    });

    await publishEvent({
      type: "hq_arrival",
      groupId: normG,
      place: rank,
      points: pts,
      ts: Date.now()
    });

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

  /**
   * Valideer een bonusraadsel en stuur het antwoord live door naar HQ met toekenning van bonuspunten.
   */
  async function submitBonusRiddle(playerId, riddleId, rawAnswer) {
    const configRiddle = (SPEL_CONFIG.bonusRiddles || []).find((r) => r.id === riddleId);
    if (!configRiddle) {
      return { success: false, message: "Onbekend raadsel." };
    }
    const cleanAnswer = String(rawAnswer || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanExpected = String(configRiddle.codewoord || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    if (cleanAnswer !== cleanExpected) {
      return {
        success: false,
        message: "❌ ONJUIST WOORD: De interceptie kon niet geverifieerd worden. Controleer je T9-toetsaanslagen en probeer opnieuw!"
      };
    }

    const state = computeScoreState();
    const speler = SPEL_CONFIG.spelers.find((s) => s.id === playerId);
    const spelerNaam = speler ? speler.naam : playerId;
    const playerInfo = state.playerScoresMap.get(playerId);
    const groupId = playerInfo ? (playerInfo.adminGroupId || playerInfo.groupId || null) : null;

    // Check of dit raadsel al correct is opgelost door deze speler of groep
    const alreadySolved = (state.bonusSolves || []).some(
      (s) =>
        (s.playerId === playerId || (groupId && s.groupId === groupId)) &&
        s.riddleId === riddleId &&
        s.status === "correct"
    );

    if (!alreadySolved) {
      // 1. Registreer submission event
      await publishEvent({
        type: "bonus_submission",
        playerId,
        playerName: spelerNaam,
        groupId,
        riddleId,
        answer: cleanAnswer,
        status: "correct",
        reward: configRiddle.punten || 75
      });

      // 2. Ken bonuspunten toe
      await addBonusPoints(
        playerId,
        configRiddle.punten || 75,
        `⭐ Bonusopdracht Burner-Phone SMS ontcijferd ('${configRiddle.codewoord}')`
      );
    }

    return {
      success: true,
      alreadySolved,
      reward: configRiddle.punten || 75,
      codewoord: configRiddle.codewoord
    };
  }

  async function setDebriefingMode(active) {
    return publishEvent({
      type: "set_debriefing_mode",
      active: Boolean(active),
      ts: Date.now()
    });
  }

  async function setGroupDebriefExemption(groupId, exempt = true) {
    const normG = normalizeGroupId(groupId);
    return publishEvent({
      type: "set_group_debrief_exemption",
      groupId: normG,
      exempt: Boolean(exempt),
      ts: Date.now()
    });
  }

  async function recordPlayerDebrief(playerId, enteredCode) {
    const sp = SPEL_CONFIG.spelers.find((s) => s.id === playerId);
    if (!sp) return { success: false, reason: "Speler niet gevonden in dossierregister." };

    const expected = String(sp.code).trim().toLowerCase();
    const entered = String(enteredCode || "").trim().toLowerCase();
    const master = String(SPEL_CONFIG.masterCode || "leiding2026").trim().toLowerCase();

    if (entered !== expected && entered !== master) {
      return { success: false, reason: "Verkeerde 4-cijferige agentencode. Controleer je kaartje/dossier." };
    }

    // Stop GPS tracking voor deze agent
    stopLiveGpsTracking();

    await publishEvent({
      type: "player_debrief",
      playerId,
      ts: Date.now()
    });

    return { success: true };
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
    startLiveGpsTracking,
    stopLiveGpsTracking,
    onGpsPositionChange: (cb) => {
      gpsListeners.add(cb);
      try { cb(Array.from(agentGpsPositions.values())); } catch (_) {}
      return () => gpsListeners.delete(cb);
    },
    getLiveAgentPositions: () => Array.from(agentGpsPositions.values()),
    ingestGpsPing,
    getOrderedLocationsForGroup,
    recordUnlock,
    unlockLocation,
    revealNextLocationForGroup,
    setGroupRevealedStep,
    unlockAllLocationsForGroup,
    recallGroupToHQ,
    awardSubmissionPoints,
    registerHqArrival,
    FINAL_RECALL_TEXT,
    addBonusPoints,
    addGroupBonusPoints,
    revokePlayerUnlock,
    resetAllScores,
    setDebriefingMode,
    setGroupDebriefExemption,
    recordPlayerDebrief,
    setAllGroups,
    assignPlayerGroup,
    renameGroup,
    setGroupsVisibilityMode,
    setPlayerDisabled,
    setDisabledPlayers,
    uploadPlayerPhoto,
    deletePlayerPhoto,
    openPhotoLightbox,
    submitBonusRiddle,
    postBoardMessage,
    deleteBoardMessage,
    getSyncStatus: () => syncStatus,
    onSyncStatusChange: (cb) => {
      syncStatusListeners.add(cb);
      try { cb(syncStatus); } catch (_) {}
      return () => syncStatusListeners.delete(cb);
    },
    refresh: () => {
      broadcastStateRequest();
      fetchCloudHistory();
    },
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

  if (typeof document !== "undefined") {
    // Zorg dat bij ontwaken van gsm (scherm aan, tabblad openen) direct wordt gesynchroniseerd
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        ScoreService.refresh();
      }
    });

    window.addEventListener("focus", () => {
      ScoreService.refresh();
    });

    window.addEventListener("online", () => {
      ScoreService.refresh();
    });
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = ScoreService;
}
