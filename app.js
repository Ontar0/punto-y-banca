/* =============================================================
   Punto y Banca — Lógica del jugador
   ============================================================= */
(function () {
  "use strict";

  /* ---------- Constantes ---------- */
  const SABOT = 90;
  const KEY_STATE = "pyb:v1:state";
  const KEY_DEVICE = "pyb:v1:device";
  const KEY_OUTBOX = "pyb:v1:outbox";
  const KEY_THEME = "pyb:v1:theme";

  const $ = (sel, root = document) => (root || document).querySelector(sel);

  /* ---------- Utilidades ---------- */
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getDeviceId() {
    let id = localStorage.getItem(KEY_DEVICE);
    if (!id) {
      id = uuid();
      localStorage.setItem(KEY_DEVICE, id);
    }
    return id;
  }

  /* ---------- Estado ---------- */
  const state = { hands: [] }; // hands[n] = { winner:'P'|'B'|'A', scoreP:'', scoreB:'' }

  function persist() {
    localStorage.setItem(KEY_STATE, JSON.stringify(state));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(KEY_STATE);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.hands)) state.hands = parsed.hands;
    } catch (e) {
      console.warn("No se pudo leer el estado:", e);
    }
  }

  function counts() {
    let p = 0, b = 0, a = 0;
    for (const h of state.hands) {
      if (h.winner === "P") p++;
      else if (h.winner === "B") b++;
      else a++;
    }
    return { p, b, a, passes: state.hands.length };
  }

  // Rachas ignorando los ancares (convención del juego).
  function streaks(seq) {
    let run = { side: null, len: 0 };
    let longest = { side: null, len: 0 };
    for (const v of seq) {
      if (v === "A") continue;
      if (v === run.side) run.len++;
      else run = { side: v, len: 1 };
      if (run.len > longest.len) longest = { side: run.side, len: run.len };
    }
    return { current: run, longest };
  }

  function streakLabel(s) {
    if (!s || !s.side || !s.len) return "—";
    return `${s.side === "P" ? "Punto" : "Banca"} ×${s.len}`;
  }

  /* ---------- Tablero ---------- */
  const boardEl = $("#board");
  const cellMap = new Map(); // "P1" -> elemento
  const ckey = (side, n) => side + n;
  const cellEl = (side, n) => cellMap.get(ckey(side, n));

  function buildBoard() {
    const frag = document.createDocumentFragment();
    for (let row = 0; row < 30; row++) {
      for (let block = 0; block < 3; block++) {
        const n = block * 30 + row + 1;
        frag.appendChild(makeCell("P", n));
        frag.appendChild(makeCell("B", n));
      }
    }
    boardEl.appendChild(frag);
  }

  function makeCell(side, n) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.dataset.side = side;
    cell.dataset.n = String(n);
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `Pase ${n} · ${side === "P" ? "Punto" : "Banca"}`);
    const score = document.createElement("span");
    score.className = "cell-score";
    cell.appendChild(score);
    cellMap.set(ckey(side, n), cell);
    return cell;
  }

  function playPop(el) {
    el.classList.remove("pop");
    void el.offsetWidth; // forzar reflow para reiniciar la animación
    el.classList.add("pop");
    el.addEventListener("animationend", () => el.classList.remove("pop"), { once: true });
  }

  function renderCell(side, n, animate) {
    const el = cellEl(side, n);
    if (!el) return;
    const hand = state.hands[n - 1];
    const scoreEl = el.querySelector(".cell-score");
    el.classList.remove("filled", "p", "b", "tie");

    if (hand && (hand.winner === side || hand.winner === "A")) {
      el.classList.add("filled");
      if (hand.winner === "A") el.classList.add("tie");
      else el.classList.add(side === "P" ? "p" : "b");
      const sc = side === "P" ? hand.scoreP : hand.scoreB;
      scoreEl.textContent = sc ? sc : "";
      el.setAttribute("aria-label", `Pase ${n} · ${side === "P" ? "Punto" : "Banca"}${sc ? " · " + sc : ""}`);
    } else {
      scoreEl.textContent = "";
    }
    if (animate) playPop(el);
  }

  function renderBoard() {
    for (let n = 1; n <= SABOT; n++) {
      renderCell("P", n, false);
      renderCell("B", n, false);
    }
  }

  /* ---------- Registro ---------- */
  function record(winner) {
    if (state.hands.length >= SABOT) {
      toast("No hay más espacio en este sabot.", "warn");
      return;
    }
    state.hands.push({ winner, scoreP: "", scoreB: "" });
    persist();
    const n = state.hands.length;
    renderCell("P", n, true);
    renderCell("B", n, true);
    updateCounters();
    updateMiniStats();
  }

  function undo() {
    const n = state.hands.length;
    if (!n) {
      toast("Aún no pasó nada.");
      return;
    }
    const p = cellEl("P", n);
    const b = cellEl("B", n);
    p.classList.add("fade");
    b.classList.add("fade");
    state.hands.pop();
    persist();
    setTimeout(() => {
      p.classList.remove("fade");
      b.classList.remove("fade");
      renderCell("P", n, false);
      renderCell("B", n, false);
    }, 170);
    updateCounters();
    updateMiniStats();
  }

  async function newBoard() {
    if (!state.hands.length) {
      toast("El tablero ya está vacío.");
      return;
    }
    const c = counts();
    const ok = await confirmDialog(
      "Archivar tablero",
      `Se guardará este tablero (${c.passes} pases) y se empezará uno nuevo. ¿Continuar?`
    );
    if (!ok) return;

    const payload = buildPayload(); // antes de limpiar
    const list = outboxGet();
    list.push(payload);
    outboxSet(list);

    state.hands = [];
    persist();
    renderBoard();
    updateCounters();
    updateMiniStats();
    toast("Tablero archivado. ¡Nueva mano!");
    flushOutbox();
  }

  async function resetBoard() {
    if (!state.hands.length) {
      toast("El tablero ya está vacío.");
      return;
    }
    const ok = await confirmDialog("Borrar tablero", "Se borrará el tablero actual SIN guardarlo. ¿Continuar?");
    if (!ok) return;
    state.hands = [];
    persist();
    renderBoard();
    updateCounters();
    updateMiniStats();
    toast("Tablero borrado.");
  }

  /* ---------- Contadores y mini estadísticas ---------- */
  function updateCounters() {
    const c = counts();
    $("#cPases").textContent = c.passes;
    $("#cPunto").textContent = c.p;
    $("#cBanca").textContent = c.b;
    $("#cAncar").textContent = c.a;
  }

  function updateMiniStats() {
    const c = counts();
    const total = c.passes;
    const pct = (x) => (total ? Math.round((x / total) * 100) : 0);
    const st = streaks(state.hands.map((h) => h.winner));
    $("#miniStats").innerHTML = `
      <div class="ms-row"><span class="ms-key">Total pases</span><span class="ms-val">${total} / ${SABOT}</span></div>
      <div class="ms-row"><span class="ms-key">Punto</span><span class="ms-val">${pct(c.p)}%</span></div>
      <div class="ms-row"><span class="ms-key">Banca</span><span class="ms-val">${pct(c.b)}%</span></div>
      <div class="ms-row"><span class="ms-key">Ancar</span><span class="ms-val">${pct(c.a)}%</span></div>
      <div class="ms-bar" aria-hidden="true">
        <span style="width:${pct(c.p)}%;background:var(--p)"></span>
        <span style="width:${pct(c.b)}%;background:var(--b)"></span>
        <span style="width:${pct(c.a)}%;background:var(--a)"></span>
      </div>
      <div class="ms-row"><span class="ms-key">Racha actual</span><span class="ms-val">${streakLabel(st.current)}</span></div>
      <div class="ms-row"><span class="ms-key">Racha más larga</span><span class="ms-val">${streakLabel(st.longest)}</span></div>
    `;
  }

  /* ---------- Archivado / sincronización ---------- */
  function outboxGet() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY_OUTBOX)) || [];
      return raw.map((item) => {
        const nowIso = new Date().toISOString();
        if (!item.updated_at) item.updated_at = item.created_at || nowIso;
        if (typeof item.retry_count !== "number") item.retry_count = 0;
        if (item.failed) delete item.failed;
        if (item.last_error) delete item.last_error;
        return item;
      });
    } catch (e) {
      return [];
    }
  }
  function outboxSet(v) {
    localStorage.setItem(KEY_OUTBOX, JSON.stringify(v));
    updateSyncBadge();
  }

  function buildPayload() {
    const nowIso = new Date().toISOString();
    const sequenceRaw = state.hands.map((h) => h.winner);
    const sequence = sequenceRaw.filter((v) => v === "P" || v === "B" || v === "A");
    let count_p = 0,
      count_b = 0,
      count_a = 0;
    for (let i = 0; i < sequence.length; i++) {
      const v = sequence[i];
      if (v === "P") count_p++;
      else if (v === "B") count_b++;
      else if (v === "A") count_a++;
    }
    let passes = sequence.length;
    if (passes < 0) passes = 0;
    if (passes !== sequence.length) passes = sequence.length;
    return {
      device_id: getDeviceId(),
      created_at: nowIso,
      updated_at: nowIso,
      retry_count: 0,
      passes: passes,
      count_p: count_p,
      count_b: count_b,
      count_a: count_a,
      sequence: sequence,
    };
  }

  async function flushOutbox() {
    const list = outboxGet();
    if (!list.length) {
      updateSyncBadge();
      return;
    }
    if (!window.PYBAPI || !PYBAPI.enabled()) {
      updateSyncBadge();
      return;
    }
    const nowIso = new Date().toISOString();
    const remaining = [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (item && item.failed) {
        remaining.push(item);
        continue;
      }
      let attempts = 0;
      let lastErr = null;
      while (attempts <= 5) {
        try {
          await PYBAPI.insertBoard(item);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e && e.message ? e.message : String(e);
          attempts++;
          if (attempts <= 5) {
            const backoff = Math.min(1000 * Math.pow(2, attempts - 1), 10000);
            await new Promise((r) => setTimeout(r, backoff));
          }
        }
      }
      if (lastErr === null) {
        // éxito: no lo agregamos a remaining
        continue;
      }
      if (item.retry_count >= 5) {
        const failedItem = Object.assign({}, item, {
          retry_count: item.retry_count + 1,
          updated_at: nowIso,
          failed: true,
          last_error: lastErr,
        });
        remaining.push(failedItem);
        continue;
      }
      const retryItem = Object.assign({}, item, {
        retry_count: (item.retry_count || 0) + 1,
        updated_at: nowIso,
        last_error: lastErr,
      });
      remaining.push(retryItem);
    }
    outboxSet(remaining);
    if (!remaining.length) toast("Datos sincronizados con la nube.");
    else toast("Sin conexión: se reintentará automáticamente.", "warn");
  }

  function updateSyncBadge() {
    const badge = $("#syncBadge");
    if (!badge) return;
    const n = outboxGet().length;
    if (!n) {
      badge.hidden = true;
      return;
    }
    badge.hidden = false;
    badge.textContent = n === 1 ? "1 tablero pendiente" : `${n} tableros pendientes`;
    badge.title = window.PYBAPI && PYBAPI.enabled()
      ? "Tableros por subir a la nube"
      : "Nube no configurada: se guardarán localmente";
  }

  /* ---------- Teclado numérico ---------- */
  const keypad = { side: null, n: null, value: "" };

  function buildKeypad() {
    const grid = $("#keypadGrid");
    grid.innerHTML = "";
    for (let d = 1; d <= 9; d++) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = d;
      b.addEventListener("click", () => keypadDigit(d));
      grid.appendChild(b);
    }
    const zero = document.createElement("button");
    zero.type = "button";
    zero.textContent = "0";
    zero.className = "zero";
    zero.addEventListener("click", () => keypadDigit(0));
    grid.appendChild(zero);
  }

  function openKeypad(side, n) {
    const hand = state.hands[n - 1];
    if (!hand) return;
    if (!(hand.winner === side || hand.winner === "A")) return;
    keypad.side = side;
    keypad.n = n;
    keypad.value = (side === "P" ? hand.scoreP : hand.scoreB) || "";
    $("#keypadTitle").textContent = `Pase ${n} · ${side === "P" ? "Punto" : "Banca"}`;
    renderKeypadDisplay();
    openModal("#keypadModal");
  }

  function renderKeypadDisplay() {
    $("#keypadValue").textContent = keypad.value === "" ? "—" : keypad.value;
  }
  function keypadDigit(d) {
    keypad.value = String(d);
    renderKeypadDisplay();
  }
  function keypadClear() {
    keypad.value = "";
    renderKeypadDisplay();
  }
  function keypadOk() {
    const hand = state.hands[keypad.n - 1];
    if (hand) {
      if (keypad.side === "P") hand.scoreP = keypad.value;
      else hand.scoreB = keypad.value;
      persist();
      renderCell(keypad.side, keypad.n, false);
      const scoreEl = cellEl(keypad.side, keypad.n).querySelector(".cell-score");
      if (keypad.value) {
        scoreEl.classList.remove("enter");
        void scoreEl.offsetWidth;
        scoreEl.classList.add("enter");
      }
    }
    closeModal("#keypadModal");
  }

  /* ---------- Modales ---------- */
  function openModal(sel) {
    const m = $(sel);
    if (m) m.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal(sel) {
    const m = $(sel);
    if (m) m.hidden = true;
    document.body.style.overflow = "";
  }

  let confirmResolve = null;
  function confirmDialog(title, body) {
    $("#confirmTitle").textContent = title;
    $("#confirmBody").textContent = body;
    openModal("#confirmModal");
    return new Promise((resolve) => {
      confirmResolve = resolve;
    });
  }
  function closeConfirm(val) {
    closeModal("#confirmModal");
    if (confirmResolve) {
      confirmResolve(val);
      confirmResolve = null;
    }
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg, type) {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "toast" + (type ? " " + type : "");
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.hidden = true;
    }, 2600);
  }

  /* ---------- Tema ---------- */
  function applyTheme(theme) {
    document.body.classList.toggle("dark", theme === "dark");
    const btn = $("#btnTheme");
    if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
  }
  function toggleTheme() {
    const dark = !document.body.classList.contains("dark");
    localStorage.setItem(KEY_THEME, dark ? "dark" : "light");
    applyTheme(dark ? "dark" : "light");
  }

  /* ---------- Reglas y ayuda ---------- */
  const RULES_TEXT =
    "TABLA DEL PUNTO\n" +
    "0, 1, 2, 3, 4  → pide carta\n" +
    "5              → a voluntad\n" +
    "6, 7           → planta\n" +
    "8, 9           → pase definido\n\n" +
    "TABLA DE LA BANCA\n" +
    "0, 1, 2  → pide carta\n" +
    "3        → planta con 8\n" +
    "4        → planta con 1, 8, 9, 0\n" +
    "5        → planta con 1, 2, 3, 8, 9, 0\n" +
    "6        → pide con 6 y 7\n" +
    "7        → planta\n" +
    "8, 9     → pase definido\n\n" +
    "Con 5 la banca, habiendo plantado el punto, la banca PIDE carta.";

  const HELP_TEXT =
    "Esta app sirve para anotar los pases de un sabot de Punto y Banca.\n\n" +
    "• Botones P / B / A (o teclas P, B, A): registran la suerte ganadora de cada pase. Se anotan de forma secuencial, sin poder saltear un pase.\n" +
    "• Tocá un casillero marcado para anotar el puntaje con el teclado numérico.\n" +
    "• ↶ (o la tecla Retroceso) retrocede un pase.\n" +
    "• “Nuevo tablero” archiva el actual en la nube y empieza uno nuevo.\n" +
    "• “Reset” borra el actual SIN guardarlo.\n\n" +
    "Los tableros se guardan automáticamente: si no hay conexión, se reintenta el envío al reconectar.";

  function showInfo(title, text) {
    $("#infoTitle").textContent = title;
    $("#infoBody").textContent = text;
    openModal("#infoModal");
  }

  /* ---------- Wake Lock ---------- */
  let wakeLock = null;
  async function requestWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
    } catch (e) {
      /* ignorar */
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestWakeLock();
  });

  /* ---------- Eventos ---------- */
  function wireEvents() {
    $("#btnP").addEventListener("click", () => record("P"));
    $("#btnB").addEventListener("click", () => record("B"));
    $("#btnA").addEventListener("click", () => record("A"));
    $("#btnBack").addEventListener("click", undo);
    $("#btnNew").addEventListener("click", newBoard);
    $("#btnReset").addEventListener("click", resetBoard);
    $("#btnRules").addEventListener("click", () => showInfo("Reglas de naipes", RULES_TEXT));
    $("#btnHelp").addEventListener("click", () => showInfo("Ayuda", HELP_TEXT));
    $("#btnTheme").addEventListener("click", toggleTheme);

    $("#keypadOk").addEventListener("click", keypadOk);
    $("#keypadClear").addEventListener("click", keypadClear);

    $("#confirmYes").addEventListener("click", () => closeConfirm(true));
    $("#confirmNo").addEventListener("click", () => closeConfirm(false));

    boardEl.addEventListener("click", (e) => {
      const c = e.target.closest(".cell");
      if (!c || !c.classList.contains("filled")) return;
      openKeypad(c.dataset.side, Number(c.dataset.n));
    });

    // Cerrar modales con click en el fondo o con [data-close]
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target !== modal) return;
        if (modal.id === "confirmModal") closeConfirm(false);
        else closeModal("#" + modal.id);
      });
    });
    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal("#" + btn.closest(".modal").id));
    });

    // Atajos de teclado
    document.addEventListener("keydown", (e) => {
      if (!$("#keypadModal").hidden) {
        if (/^[0-9]$/.test(e.key)) {
          keypadDigit(Number(e.key));
          e.preventDefault();
        } else if (e.key === "Backspace" || e.key === "Delete") {
          keypadClear();
          e.preventDefault();
        } else if (e.key === "Enter") {
          keypadOk();
          e.preventDefault();
        } else if (e.key === "Escape") {
          closeModal("#keypadModal");
        }
        return;
      }
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      const anyModalOpen = ["#infoModal", "#confirmModal"].some((s) => !$(s).hidden);
      if (anyModalOpen) {
        if (e.key === "Escape") ["#infoModal"].forEach((s) => closeModal(s));
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "p") record("P");
      else if (k === "b") record("B");
      else if (k === "a") record("A");
      else if (e.key === "Backspace") {
        e.preventDefault();
        undo();
      }
    });

    window.addEventListener("online", flushOutbox);
    window.addEventListener("focus", flushOutbox);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) flushOutbox();
    });
  }

  /* ---------- Init ---------- */
  function init() {
    getDeviceId();
    buildBoard();
    buildKeypad();
    loadState();
    applyTheme(localStorage.getItem(KEY_THEME) || "light");
    renderBoard();
    updateCounters();
    updateMiniStats();
    updateSyncBadge();
    wireEvents();
    requestWakeLock();
    flushOutbox();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
