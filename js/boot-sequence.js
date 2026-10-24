/**
 * OPERATIE ERFPACHT // CINEMATIC BOOT SEQUENCE & BIOMETRIC SCANNER
 * ------------------------------------------------------------------
 * Draait eenmalig wanneer een agent de site voor de allereerste keer bezoekt.
 * Toont een officiële CIA / Mil-Spec terminal opstartprocedure en vereist
 * een biometrische vingerafdrukscan op het scherm om toegang te verlenen.
 */

(() => {
  const BOOT_KEY = "jb_boot_sequence_completed";

  // Sla over indien al voltooid of als we op het HQ Gamemaster dashboard zitten
  if (typeof window === "undefined") return;
  if (window.location.pathname.includes("hq-dashboard")) return;
  if (localStorage.getItem(BOOT_KEY) === "true") return;

  function initBootSequence() {
    if (document.getElementById("jb-boot-overlay")) return;

    // Voorkom scrollen tijdens boot
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Zorg ervoor dat het mobiele toetsenbord nooit kan openen tijdens de boot/vingerafdruk scan
    if (document.activeElement && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }
    const preventFocusOutside = (e) => {
      if (overlay && overlay.parentNode && e.target && !overlay.contains(e.target)) {
        if (typeof e.target.blur === "function") e.target.blur();
      }
    };
    document.addEventListener("focusin", preventFocusOutside, true);

    const overlay = document.createElement("div");
    overlay.id = "jb-boot-overlay";
    overlay.className = "boot-overlay";
    overlay.setAttribute("tabindex", "-1");
    overlay.style.touchAction = "none";

    overlay.innerHTML = `
      <div class="boot-box">
        <div class="boot-header">
          <div class="boot-dots">
            <span class="boot-dot red"></span>
            <span class="boot-dot amber"></span>
            <span class="boot-dot green"></span>
          </div>
          <div class="boot-title">TERMINAL // OPERATIE ERFPACHT v2.4</div>
          <button type="button" class="boot-skip-btn" id="boot-skip-btn">OVERSLAAN &rarr;</button>
        </div>

        <div class="boot-logs" id="boot-terminal-logs"></div>

        <div class="boot-scanner-section" id="boot-scanner-section" style="display: none;">
          <div class="boot-scanner-status" id="boot-scanner-status">
            PLAATS EN HOUD JE VINGER OP DE SCANNER
          </div>
          <div class="boot-pad-wrap" id="boot-pad-wrap">
            <div class="boot-pad-center">
              <div class="boot-laser"></div>
              <svg class="boot-fp-svg" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <!-- 1. Buitenste contour boog -->
                <path d="M 50 8 C 25 8 13 26 13 49 C 13 74 21 95 31 110" />
                <path d="M 50 8 C 75 8 87 26 87 49 C 87 74 79 95 69 110" />
                
                <!-- 2. Buitenste secundaire kam -->
                <path d="M 50 15 C 29 15 19 31 19 51 C 19 71 26 89 35 104" />
                <path d="M 50 15 C 71 15 81 31 81 51 C 81 71 74 89 65 104" />

                <!-- 3. Middelkam met natuurlijke flow -->
                <path d="M 50 22 C 33 22 25 36 25 53 C 25 68 31 84 39 97" />
                <path d="M 50 22 C 67 22 75 36 75 53 C 75 68 69 84 61 97" />

                <!-- 4. Karakteristieke lus met minutia onderbreking -->
                <path d="M 50 29 C 37 29 31 41 31 55 C 31 67 36 78 43 89" />
                <path d="M 50 29 C 63 29 69 41 69 55 C 69 67 64 78 57 89" />

                <!-- 5. Binnenste dermale lus -->
                <path d="M 50 36 C 41 36 37 46 37 57 C 37 66 41 74 47 82" />
                <path d="M 50 36 C 59 36 63 46 63 57 C 63 66 59 74 53 82" />

                <!-- 6. Whorl centrum / loop -->
                <path d="M 50 43 C 45 43 43 51 43 59 C 43 65 46 70 49 74" />
                <path d="M 50 43 C 55 43 57 51 57 59 C 57 64 55 68 52 71" />

                <!-- 7. Forensische kern stip / whorl centrum -->
                <path d="M 50 50 C 48 50 47 53 47 58 C 47 61 48 63 50 64 C 51 63 53 61 53 58 C 53 53 52 50 50 50 Z" />

                <!-- 8. Dermal Ridge Minutiae (Vertakkingen & Eilandjes) -->
                <path d="M 16 38 C 16 29 20 22 26 16" />
                <path d="M 84 38 C 84 29 80 22 74 16" />

                <path d="M 22 75 C 24 83 28 90 33 97" />
                <path d="M 78 75 C 76 83 72 90 67 97" />

                <path d="M 28 61 C 28 67 30 73 34 79" />
                <path d="M 72 61 C 72 67 70 73 66 79" />

                <!-- 9. Basis triradius / delta patronen -->
                <path d="M 45 107 C 47 103 48 99 49 95" />
                <path d="M 55 107 C 53 103 52 99 51 95" />
                <path d="M 40 115 C 43 111 45 107 47 103" />
                <path d="M 60 115 C 57 111 55 107 53 103" />
              </svg>
            </div>
            <svg class="boot-progress-svg" viewBox="0 0 140 140">
              <circle class="boot-progress-track" cx="70" cy="70" r="62" />
              <circle class="boot-progress-bar" id="boot-progress-bar" cx="70" cy="70" r="62" />
            </svg>
          </div>
          <div class="boot-hint">BIOMETRISCHE IDENTIFICATIE // HOUD SCHERM INGEDRUKT</div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const logsContainer = document.getElementById("boot-terminal-logs");
    const scannerSection = document.getElementById("boot-scanner-section");
    const padWrap = document.getElementById("boot-pad-wrap");
    const scannerStatus = document.getElementById("boot-scanner-status");
    const progressBar = document.getElementById("boot-progress-bar");
    const skipBtn = document.getElementById("boot-skip-btn");

    // Audio & Haptic Context
    let audioCtx = null;
    let scanOsc = null;
    let scanGain = null;

    function getAudioCtx() {
      if (!audioCtx) {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (AudioClass) audioCtx = new AudioClass();
      }
      return audioCtx;
    }

    function playBeep(freq = 880, duration = 0.04, gainLvl = 0.03) {
      try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(gainLvl, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (_) {}
    }

    function finishBoot() {
      document.removeEventListener("focusin", preventFocusOutside, true);
      localStorage.setItem(BOOT_KEY, "true");
      overlay.classList.add("is-exiting");
      document.body.style.overflow = origOverflow;
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 700);
    }

    if (skipBtn) {
      skipBtn.addEventListener("click", finishBoot);
    }

    // Console Berichtenreeks
    const logMessages = [
      { text: "INITIALIZING SECURE SYSTEM ENCLAVE...", delay: 280, ok: true },
      { text: "ESTABLISHING MIL-SAT UPLINK: SENTINEL-4B... [148.925 MHz]", delay: 520, ok: true },
      { text: "GEOLOCATION VERIFIED: SECTOR 2200 // HERENTALS [OK]", delay: 480, ok: true },
      { text: "ESTABLISHING QUANTUM-SAFE ENCRYPTED TUNNEL (AES-256)...", delay: 540, ok: true },
      { text: "DOWNLOADING AGENT CREDENTIALS (26 FIELD REPOSITORIES)... [100%]", delay: 620, ok: true },
      { text: "DECRYPTING MISSION FILE: OPERATIE ERFPACHT (DEADLINE 22u00)...", delay: 560, ok: true },
      { text: "MANDATORY BIOMETRIC CLEARANCE LEVEL-4 REQUIRED.", delay: 420, warn: true }
    ];

    let currentLogIndex = 0;
    function printNextLog() {
      if (currentLogIndex >= logMessages.length) {
        // Toon de interactieve vingerafdruk scanner
        setTimeout(() => {
          if (scannerSection) {
            scannerSection.style.display = "flex";
            playBeep(988, 0.12, 0.05);
          }
        }, 300);
        return;
      }

      const item = logMessages[currentLogIndex];
      const lineEl = document.createElement("div");
      lineEl.className = "boot-log-line";

      const timeCode = `[00:00:0${currentLogIndex + 1}]`;
      const statusClass = item.ok ? "boot-log-ok" : item.warn ? "boot-log-warn" : "";
      const statusBadge = item.ok ? "✓ " : item.warn ? "⚠ " : "> ";

      lineEl.innerHTML = `
        <span class="boot-log-time">${timeCode}</span>
        <span class="${statusClass}">${statusBadge}${item.text}</span>
      `;
      logsContainer.appendChild(lineEl);
      logsContainer.scrollTop = logsContainer.scrollHeight;

      playBeep(item.warn ? 520 : 700 + currentLogIndex * 60, 0.04, 0.025);

      currentLogIndex++;
      setTimeout(printNextLog, item.delay);
    }

    // Start logs na 250ms
    setTimeout(printNextLog, 250);

    // ==========================================
    // VINGERAFDRUK SCANNER INTERACTIE
    // ==========================================
    let isPressed = false;
    let isCompleted = false;
    let scanStartTime = 0;
    let scanInterval = null;
    const SCAN_DURATION_MS = 2000; // 2.0 seconden vasthouden
    const TRACK_CIRCUMFERENCE = 390;

    function startScan(e) {
      if (isCompleted) return;
      if (e) {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopPropagation === "function") e.stopPropagation();
      }
      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }
      isPressed = true;
      scanStartTime = Date.now();

      padWrap.classList.add("is-active");
      scannerStatus.textContent = "DERMALE PATRONEN SCANNEN... BEWAAR CONTACT";
      scannerStatus.className = "boot-scanner-status scanning";

      // Start opklimmende scanner-audio
      try {
        const ctx = getAudioCtx();
        if (ctx) {
          scanOsc = ctx.createOscillator();
          scanGain = ctx.createGain();
          scanOsc.type = "sine";
          scanOsc.frequency.setValueAtTime(320, ctx.currentTime);
          scanOsc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 2.0);
          scanGain.gain.setValueAtTime(0.04, ctx.currentTime);
          scanOsc.connect(scanGain);
          scanGain.connect(ctx.destination);
          scanOsc.start();
        }
      } catch (_) {}

      // Start subtiele vibratie-puls op mobiel
      try {
        if (navigator.vibrate) navigator.vibrate([60, 40, 60, 40, 60, 40]);
      } catch (_) {}

      clearInterval(scanInterval);
      scanInterval = setInterval(() => {
        if (!isPressed) return;
        const elapsed = Date.now() - scanStartTime;
        const progress = Math.min(1, elapsed / SCAN_DURATION_MS);
        const offset = TRACK_CIRCUMFERENCE - TRACK_CIRCUMFERENCE * progress;
        progressBar.style.strokeDashoffset = String(offset);

        if (progress >= 1) {
          completeScan();
        }
      }, 25);
    }

    function cancelScan() {
      if (isCompleted || !isPressed) return;
      isPressed = false;
      clearInterval(scanInterval);

      padWrap.classList.remove("is-active");
      progressBar.style.strokeDashoffset = String(TRACK_CIRCUMFERENCE);

      // Stop audio
      try {
        if (scanOsc) {
          scanOsc.stop();
          scanOsc.disconnect();
          scanOsc = null;
        }
      } catch (_) {}

      // Negatieve fout-toon & status
      playBeep(240, 0.15, 0.05);
      scannerStatus.textContent = "⚠️ SCAN ONDERBROKEN // HOUD JE VINGER LANGER INGEDRUKT";
      scannerStatus.className = "boot-scanner-status failed";
    }

    function completeScan() {
      isCompleted = true;
      isPressed = false;
      clearInterval(scanInterval);

      padWrap.classList.remove("is-active");
      padWrap.classList.add("is-granted");
      progressBar.style.strokeDashoffset = "0";

      // Stop scan audio
      try {
        if (scanOsc) {
          scanOsc.stop();
          scanOsc.disconnect();
          scanOsc = null;
        }
      } catch (_) {}

      // Speel triomfantelijke clearance-akkoorden (C - E - G - High C)
      try {
        const ctx = getAudioCtx();
        if (ctx) {
          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
            gain.gain.setValueAtTime(0.08, ctx.currentTime + idx * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + idx * 0.1);
            osc.stop(ctx.currentTime + idx * 0.1 + 0.4);
          });
        }
      } catch (_) {}

      // Mobiele haptische succes-buzz
      try {
        if (navigator.vibrate) navigator.vibrate([100, 50, 220]);
      } catch (_) {}

      scannerStatus.textContent = "✅ BIOMETRISCHE IDENTIFICATIE GESLAAGD // LEVEL-4 TOEGEKEND";
      scannerStatus.className = "boot-scanner-status success";

      const finalLine = document.createElement("div");
      finalLine.className = "boot-log-line";
      finalLine.innerHTML = `
        <span class="boot-log-time">[00:00:08]</span>
        <span class="boot-log-ok" style="font-size: 0.84rem; font-weight: 800;">★ WELKOM AGENT. OPERATIE ERFPACHT IS ACTIEF.</span>
      `;
      logsContainer.appendChild(finalLine);
      logsContainer.scrollTop = logsContainer.scrollHeight;

      // Na 900ms sluit de intro met een soepele fade-out
      setTimeout(finishBoot, 950);
    }

    // Touch events voor mobiel (smartphones & tablets) met strikte ghost-click & virtual keyboard blokkade
    const onPadTouchStart = (e) => {
      if (e) {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopPropagation === "function") e.stopPropagation();
      }
      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }
      startScan(e);
    };

    const onPadTouchEnd = (e) => {
      if (e) {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopPropagation === "function") e.stopPropagation();
      }
      cancelScan();
    };

    padWrap.addEventListener("touchstart", onPadTouchStart, { passive: false });
    padWrap.addEventListener("touchend", onPadTouchEnd, { passive: false });
    padWrap.addEventListener("touchcancel", onPadTouchEnd, { passive: false });

    overlay.addEventListener("touchstart", (e) => {
      if (e.target.tagName !== "BUTTON" && e.target.tagName !== "A") {
        if (document.activeElement && typeof document.activeElement.blur === "function") {
          document.activeElement.blur();
        }
      }
    }, { passive: true });

    // Muis events voor desktop
    padWrap.addEventListener("mousedown", startScan);
    padWrap.addEventListener("mouseup", cancelScan);
    padWrap.addEventListener("mouseleave", cancelScan);
  }

  // Helper om te testen in de browser console: window.replayBootIntro()
  window.replayBootIntro = () => {
    localStorage.removeItem(BOOT_KEY);
    window.location.reload();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBootSequence);
  } else {
    initBootSequence();
  }
})();
