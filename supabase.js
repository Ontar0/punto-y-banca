/* =============================================================
   Punto y Banca — Cliente mínimo de Supabase (REST, sin librerías)
   -------------------------------------------------------------
   Usa fetch directo contra la API REST (PostgREST) y Auth.
   - Los jugadores (anon) solo pueden INSERTAR.
   - El admin (autenticado) puede LEER.
   ============================================================= */
(function () {
  "use strict";

  const cfg = window.PYB_CONFIG || {};
  const base = (cfg.SUPABASE_URL || "").replace(/\/+$/, "");
  const anon = cfg.SUPABASE_ANON_KEY || "";
  const table = cfg.TABLE || "boards";

  function enabled() {
    return Boolean(base && anon);
  }

  function headers(extra) {
    return Object.assign(
      {
        apikey: anon,
        "Content-Type": "application/json"
      },
      extra || {}
    );
  }

  async function parse(res) {
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = text;
    }
    if (!res.ok) {
      const msg =
        (data && (data.message || data.error_description || data.msg || data.error)) ||
        `Error ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  /* ---------- Escritura (jugador / anónimo) ---------- */
  async function insertBoard(payload) {
    if (!enabled()) throw new Error("Supabase no está configurado.");
    const res = await fetch(`${base}/rest/v1/${table}`, {
      method: "POST",
      headers: headers({
        Authorization: `Bearer ${anon}`,
        Prefer: "return=minimal"
      }),
      body: JSON.stringify(payload)
    });
    return parse(res);
  }

  /* ---------- Lectura (admin autenticado) ---------- */
  async function getBoards(accessToken, opts) {
    if (!enabled()) throw new Error("Supabase no está configurado.");
    const o = opts || {};
    const params = new URLSearchParams();
    params.set("select", "*");
    params.set("order", o.order || "created_at.desc");
    params.set("limit", String(o.limit || 2000));
    const res = await fetch(`${base}/rest/v1/${table}?${params.toString()}`, {
      method: "GET",
      headers: headers({ Authorization: `Bearer ${accessToken}` })
    });
    return parse(res);
  }

  /* ---------- Autenticación (admin) ---------- */
  async function signIn(email, password) {
    if (!enabled()) throw new Error("Supabase no está configurado.");
    const res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ email, password })
    });
    return parse(res);
  }

  async function refresh(refreshToken) {
    if (!enabled()) throw new Error("Supabase no está configurado.");
    const res = await fetch(`${base}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    return parse(res);
  }

  async function signOut(accessToken) {
    if (!enabled()) return;
    try {
      await fetch(`${base}/auth/v1/logout`, {
        method: "POST",
        headers: headers({ Authorization: `Bearer ${accessToken}` })
      });
    } catch (e) {
      /* ignorar */
    }
  }

  window.PYBAPI = {
    enabled,
    insertBoard,
    getBoards,
    signIn,
    refresh,
    signOut
  };
})();
