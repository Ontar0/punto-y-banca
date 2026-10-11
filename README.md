# Punto y Banca 2.0 🎴

Marcador web para un sabot de **Punto y Banca (Baccarat)**, con archivado de tableros en la nube
y un panel de estadísticas para el administrador.

Hecho con **HTML + CSS + JavaScript puro** (sin build, sin dependencias de npm).
Se publica tal cual en **GitHub Pages**.

---

## ✨ Funciones

- Tablero de **90 pases** (3 bloques × 30) con animaciones sutiles.
- Botones `P` / `B` / `A` + **atajos de teclado** (`P`, `B`, `A`, `Retroceso` = deshacer).
- **Teclado numérico propio (0–9)** para anotar el puntaje de cada pase (sin `prompt`).
- **Guardado automático** local (no se pierde al recargar).
- **“Nuevo tablero”** archiva el tablero anterior en **Supabase** y empieza uno nuevo.
- **Resiliente a cortes:** si no hay conexión, el envío se encola y se reintenta al reconectar.
- **ID de dispositivo** (UUID) para agrupar los tableros por jugador.
- **Botón QR** para compartir el enlace con los jugadores.
- **Panel admin** con login: KPIs, ranking por dispositivo, evolución por día y export a CSV.
- Modo **claro/oscuro**, diseño responsive y accesibilidad (`prefers-reduced-motion`, `aria-*`).

---

## 📁 Estructura

```
punto-y-banca/
├── index.html      → app del jugador
├── admin.html      → panel de estadísticas (admin)
├── styles.css      → estilos de ambas páginas
├── app.js          → lógica del jugador
├── admin.js        → login + estadísticas
├── config.js       → config de Supabase (¡lo tenés que completar!)
├── supabase.js     → cliente REST mínimo (fetch, sin librerías)
├── qrcode.min.js   → generador de QR (local, offline)
├── schema.sql      → tabla + políticas para pegar en Supabase
└── README.md
```

---

## 🚀 Uso local rápido

Sin configurar nada, ya funciona el tablero (los datos quedan solo en tu navegador):

```bash
cd punto-y-banca
python3 -m http.server 8080
# abrí http://localhost:8080
```

> Nota: abrir `index.html` con doble clic también funciona, pero se recomienda un servidor
> local para que el botón QR y el guardado se comporten igual que en producción.

---

## ☁️ Conectar Supabase (para estadísticas y archivado)

### 1. Crear el proyecto
1. Entrá a <https://supabase.com> y creá un proyecto (plan gratis).
2. Andá a **Project Settings → API** y copiá:
   - **Project URL** → `SUPABASE_URL`
   - **anon public key** → `SUPABASE_ANON_KEY`

### 2. Crear la tabla
1. En Supabase, abrí **SQL Editor → New query**.
2. Pegá todo el contenido de **`schema.sql`** y presioná **Run**.

### 3. Completar `config.js`
```js
window.PYB_CONFIG = {
  SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
  SUPABASE_ANON_KEY: "TU-ANON-KEY",
  TABLE: "boards"
};
```

### 4. Crear tu usuario administrador
1. En Supabase: **Authentication → Users → Add user**.
2. Poné tu email y una contraseña (marcá *Auto Confirm User*).
3. Con ese email y contraseña entrás a `admin.html`.

---

## 🌐 Publicar en GitHub Pages

```bash
cd punto-y-banca
git init
git add .
git commit -m "Punto y Banca 2.0"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/punto-y-banca.git
git push -u origin main
```

Luego en GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch →
Branch: `main` / root → Save**.

Quedará online en `https://TU-USUARIO.github.io/punto-y-banca/`.

- El **link del jugador** es la raíz (`…/punto-y-banca/`) → ese es el que va en el **QR**.
- El **panel admin** es `…/punto-y-banca/admin.html` → guardalo solo para vos.

---

## 🔐 Cómo funciona el acceso

| Quién | Puede | Cómo |
|---|---|---|
| **Jugadores** (por QR) | **Escribir** tableros | Sin clave (rol anónimo) |
| **Vos (admin)** | **Leer** todos los datos | Login con tu email/contraseña |

Las reglas (en `schema.sql`) garantizan que los jugadores **no puedan leer** nada:
solo pueden insertar. Vos, autenticado, sos el único que lee.

> ⚠️ **Importante:** cualquiera con el link del jugador puede **escribir** en la base
> (así lo elegiste, sin clave para jugadores). Si en el futuro querés restringirlo,
> se puede agregar un PIN compartido o exigir login a los jugadores.

### Límites a tener en cuenta
- El **ID de dispositivo** no es una identidad confiable: si el jugador borra los datos
  del navegador (o usa modo incógnito), se genera un ID nuevo.
- Los tableros quedan **privados por dispositivo** mientras juegan; recién se suben al
  tocar **“Nuevo tablero”**.

---

## 🛠️ Personalización

- **Colores / tema:** variables CSS al inicio de `styles.css` (`:root` y `body.dark`).
- **Tamaño del sabot:** constante `SABOT` en `app.js` (y la grilla de 30 filas × 3 bloques).
- **Fuente:** Montserrat vía Google Fonts en los `<head>`.

---

## 📄 Licencia

Uso libre. Hecho con cariño para la mesa. ♥
