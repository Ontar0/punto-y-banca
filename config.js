/* =============================================================
   Punto y Banca 2.0 — Configuración
   -------------------------------------------------------------
   Completá estos dos valores con los de TU proyecto de Supabase.
   Los encontrás en:  Supabase → Project Settings → API

   Mientras estén vacíos, la app funciona igual (tablero, stats
   locales, QR) pero NO archiva tableros en la nube.
   ============================================================= */
window.PYB_CONFIG = {
  // Ejemplo: "https://abcdefghijklmnop.supabase.co"
  SUPABASE_URL: "",

  // Clave "anon public". Es pública: puede estar en el frontend.
  SUPABASE_ANON_KEY: "",

  // Nombre de la tabla donde se archivan los tableros.
  TABLE: "boards"
};
