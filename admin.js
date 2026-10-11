/* =============================================================
   Punto y Banca 2.0 — Panel de estadísticas (admin)
   ============================================================= */
(function () {
  "use strict";

  const $ = (sel, root = document) => (root || document).querySelector(sel);
  const SESSION_KEY = "pyb:v1:admin:session";

  /* ---------- Sesión ---------- */
  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
    } catch (e) {
      return null;
    }
  }
  function setSession(s) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  }
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function storeTokens(data) {
    setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (Number(data.expires_in || 3600) - 30) * 1000
    });
  }

  async function currentToken() {
    const s = getSession();
    if (!s) return null;
    if (s.access_token && Date.now() < (s.expires_at || 0)) return s.access_token;
    if (s.refresh_token) {
      try {
        const data = await PYBAPI.refresh(s.refresh_token);
        storeTokens(data);
        return data.access_token;
      } catch (e) {
        clearSession();
        return null;
      }
    }
    return null;
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
    }, 2800);
  }

  /* ---------- Vistas ---------- */
  function showLogin(msg) {
    $("#loginView").hidden = false;
    $("#dashView").hidden = true;
    $("#btnLogout").hidden = true;
    $("#btnReload").hidden = true;
    $("#btnExport").hidden = true;
    if (msg) $("#loginMsg").textContent = msg;
  }
  function showDash() {
    $("#loginView").hidden = true;
    $("#dashView").hidden = false;
    $("#btnLogout").hidden = false;
    $("#btnReload").hidden = false;
    $("#btnExport").hidden = false;
  }

  /* ---------- Cálculos ---------- */
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
  function pct(x, total) {
    return total ? Math.round((x / total) * 100) : 0;
  }
  function shortId(id) {
    return id ? String(id).slice(0, 8) : "—";
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
  }
  function dayKey(iso) {
    return (iso || "").slice(0, 10) || "—";
  }

  /* ---------- Render ---------- */
  let currentRows = [];

  function render(rows) {
    currentRows = rows;
    renderKpis(rows);
    renderDeviceTable(rows);
    renderDayBars(rows);
    renderBoardsTable(rows);
  }

  function renderKpis(rows) {
    const totalBoards = rows.length;
    const totalPasses = rows.reduce((s, r) => s + (r.passes || 0), 0);
    const cp = rows.reduce((s, r) => s + (r.count_p || 0), 0);
    const cb = rows.reduce((s, r) => s + (r.count_b || 0), 0);
    const ca = rows.reduce((s, r) => s + (r.count_a || 0), 0);
    // Racha más larga tomando cada tablero por separado (no se encadenan tableros distintos).
    let longest = { side: null, len: 0 };
    for (const r of rows) {
      const st = streaks(Array.isArray(r.sequence) ? r.sequence : []);
      if (st.longest.len > longest.len) longest = st.longest;
    }
    const devices = new Set(rows.map((r) => r.device_id)).size;

    const kpi = (label, value, sub) =>
      `<div class="kpi"><span class="kpi-label">${label}</span><span class="kpi-value">${value}</span>${sub ? `<span class="kpi-sub">${sub}</span>` : ""}</div>`;

    $("#kpis").innerHTML = [
      kpi("Tableros", totalBoards),
      kpi("Dispositivos", devices),
      kpi("Pases totales", totalPasses),
      kpi("Punto", `${pct(cp, totalPasses)}%`, `${cp} pases`),
      kpi("Banca", `${pct(cb, totalPasses)}%`, `${cb} pases`),
      kpi("Ancar", `${pct(ca, totalPasses)}%`, `${ca} pases`),
      kpi("Racha máx. Punto", longest.side === "P" ? "×" + longest.len : "—"),
      kpi("Racha máx. Banca", longest.side === "B" ? "×" + longest.len : "—")
    ].join("");
  }

  function renderDeviceTable(rows) {
    const map = new Map();
    for (const r of rows) {
      const k = r.device_id || "—";
      if (!map.has(k)) map.set(k, { boards: 0, passes: 0, p: 0, b: 0, a: 0 });
      const g = map.get(k);
      g.boards++;
      g.passes += r.passes || 0;
      g.p += r.count_p || 0;
      g.b += r.count_b || 0;
      g.a += r.count_a || 0;
    }
    const list = Array.from(map.entries()).sort((x, y) => y[1].passes - x[1].passes);

    let html =
      "<thead><tr><th>Dispositivo</th><th>Tableros</th><th>Pases</th><th>P%</th><th>B%</th><th>A%</th></tr></thead><tbody>";
    if (!list.length) html += '<tr><td colspan="6" class="empty">Sin datos todavía.</td></tr>';
    for (const [id, g] of list) {
      html += `<tr>
        <td class="mono" title="${id}">${shortId(id)}</td>
        <td>${g.boards}</td>
        <td>${g.passes}</td>
        <td>${pct(g.p, g.passes)}%</td>
        <td>${pct(g.b, g.passes)}%</td>
        <td>${pct(g.a, g.passes)}%</td>
      </tr>`;
    }
    html += "</tbody>";
    $("#deviceTable").innerHTML = html;
  }

  function renderDayBars(rows) {
    const map = new Map();
    for (const r of rows) {
      const k = dayKey(r.created_at);
      if (!map.has(k)) map.set(k, { boards: 0, passes: 0 });
      const g = map.get(k);
      g.boards++;
      g.passes += r.passes || 0;
    }
    const list = Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-14);
    const max = list.reduce((m, e) => Math.max(m, e[1].passes), 1);

    if (!list.length) {
      $("#dayBars").innerHTML = '<p class="empty">Sin datos todavía.</p>';
      return;
    }
    $("#dayBars").innerHTML = list
      .map(([day, g]) => {
        const w = Math.max(4, Math.round((g.passes / max) * 100));
        return `<div class="bar-row">
          <span class="bar-day">${day.slice(5)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${w}%"></span></span>
          <span class="bar-val">${g.passes}</span>
        </div>`;
      })
      .join("");
  }

  function renderBoardsTable(rows) {
    const list = rows.slice(0, 60);
    let html =
      "<thead><tr><th>Fecha</th><th>Dispositivo</th><th>Pases</th><th>P</th><th>B</th><th>A</th><th>Racha</th></tr></thead><tbody>";
    if (!list.length) html += '<tr><td colspan="7" class="empty">Sin datos todavía.</td></tr>';
    for (const r of list) {
      const st = streaks(Array.isArray(r.sequence) ? r.sequence : []);
      const racha = st.longest.side ? `${st.longest.side} ×${st.longest.len}` : "—";
      html += `<tr>
        <td>${fmtDate(r.created_at)}</td>
        <td class="mono" title="${r.device_id}">${shortId(r.device_id)}</td>
        <td>${r.passes || 0}</td>
        <td>${r.count_p || 0}</td>
        <td>${r.count_b || 0}</td>
        <td>${r.count_a || 0}</td>
        <td>${racha}</td>
      </tr>`;
    }
    html += "</tbody>";
    $("#boardsTable").innerHTML = html;
  }

  /* ---------- Export CSV ---------- */
  function exportCsv() {
    const header = ["created_at", "device_id", "passes", "count_p", "count_b", "count_a", "sequence"];
    const lines = [header.join(",")];
    for (const r of currentRows) {
      const seq = Array.isArray(r.sequence) ? r.sequence.join(" ") : "";
      lines.push(
        [
          r.created_at || "",
          r.device_id || "",
          r.passes || 0,
          r.count_p || 0,
          r.count_b || 0,
          r.count_a || 0,
          `"${seq}"`
        ].join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `punto-y-banca_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- Datos ---------- */
  async function loadData() {
    const token = await currentToken();
    if (!token) {
      showLogin();
      return;
    }
    showDash();
    try {
      let rows;
      try {
        rows = await PYBAPI.getBoards(token, { order: "created_at.desc", limit: 5000 });
      } catch (e) {
        if (e.status === 401) {
          clearSession();
          const t2 = await currentToken();
          if (!t2) throw e;
          rows = await PYBAPI.getBoards(t2, { order: "created_at.desc", limit: 5000 });
        } else {
          throw e;
        }
      }
      render(Array.isArray(rows) ? rows : []);
      if (!rows.length) toast("Todavía no hay tableros archivados.");
    } catch (e) {
      toast("Error al cargar: " + e.message, "warn");
    }
  }

  /* ---------- Eventos ---------- */
  function wire() {
    $("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      $("#loginMsg").textContent = "";
      const btn = $("#loginBtn");
      btn.disabled = true;
      btn.textContent = "Ingresando…";
      try {
        const data = await PYBAPI.signIn($("#email").value.trim(), $("#password").value);
        storeTokens(data);
        await loadData();
      } catch (err) {
        $("#loginMsg").textContent = "No se pudo ingresar: " + err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = "Ingresar";
      }
    });

    $("#btnLogout").addEventListener("click", async () => {
      const s = getSession();
      if (s) await PYBAPI.signOut(s.access_token);
      clearSession();
      showLogin("Sesión cerrada.");
    });

    $("#btnReload").addEventListener("click", loadData);
    $("#btnExport").addEventListener("click", exportCsv);
  }

  /* ---------- Init ---------- */
  function init() {
    wire();
    if (!PYBAPI.enabled()) {
      showLogin("Supabase no está configurado. Completá config.js para usar las estadísticas.");
      $("#loginBtn").disabled = true;
      return;
    }
    loadData();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
