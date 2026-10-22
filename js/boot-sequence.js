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

    const overlay = document.createElement("div");
    overlay.id = "jb-boot-overlay";
    overlay.className = "boot-overlay";

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
              <svg class="boot-fp-svg" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 15 C30 15 15 30 15 50 C15 75 25 95 35 110" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M50 25 C36 25 25 36 25 50 C25 72 32 88 42 105" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M50 35 C42 35 35 42 35 50 C35 65 40 82 48 95" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M50 45 C47 45 44 47 44 50 C44 60 48 72 52 82" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M50 15 C70 15 85 30 85 50 C85 75 75 95 65 110" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M50 25 C64 25 75 36 75 50 C75 72 68 88 58 105" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M50 35 C58 35 65 42 65 50 C65 65 60 82 52 95" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M50 45 C53 45 56 47 56 50 C56 60 52 72 48 82" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M50 55 C49 55 48 57 48 60 C48 70 51 78 50 85" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
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
      if (e) e.preventDefault();
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

    // Touch events voor mobiel (smartphones & tablets)
    padWrap.addEventListener("touchstart", startScan, { passive: false });
    padWrap.addEventListener("touchend", cancelScan);
    padWrap.addEventListener("touchcancel", cancelScan);

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
