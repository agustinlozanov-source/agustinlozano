# SCALEx Portal · Bloque B — Dashboard conectado a BD

Adapta `dashboard.html` con auth-guard + carga datos reales del OPSP y Rituales desde Supabase.

---

## 📁 Archivos en este bloque

```
agustinlozano.com/
│
├── portal/
│   └── dashboard.html               ← REEMPLAZAR (versión nueva con guard + IDs)
│
└── assets/
    └── js/
        └── dashboard.js             ← NUEVO
```

**Solo 2 archivos, ambos en rutas que ya tienes creadas del Bloque A.**

---

## 🚀 Pasos de integración

### 1. Reemplaza `portal/dashboard.html`

Si ya tenías el dashboard del primer entregable (`scalex-dashboard-v01.html`), **bórralo** y pon esta nueva versión. Cambios principales:
- ✅ `auth-guard.js` activado en el `<head>`
- ✅ IDs en cada elemento dinámico (`#topbar-greeting`, `#kpi-opsp-percent`, etc.)
- ✅ Skeletons de carga mientras llegan los datos
- ✅ Sidebar con links reales (`/portal/opsp.html`, `/portal/rituales.html`)
- ✅ Botones de logout funcionales (sidebar + topbar)
- ✅ KPI cards son `<a>` con link a la página correspondiente

### 2. Agrega `assets/js/dashboard.js`

Es el script que carga datos de Supabase y los inyecta. Importa el cliente compartido del Bloque A.

### 3. Push a Netlify

```bash
git add portal/dashboard.html assets/js/dashboard.js
git commit -m "feat: dashboard real conectado a Supabase (Bloque B)"
git push
```

---

## ✅ Cómo probar

1. Ve a `https://agustinlozano.com/portal/login.html`
2. Login con magic link
3. Te lleva a `/portal/dashboard.html`
4. Deberías ver:
   - **Greeting con tu nombre real** ("¡Hola, Agustín! 👋")
   - **Empresa real** ("Scaling Master LATAM SA de CV")
   - **Avatar con tus iniciales** (AL)
   - **KPI OPSP completado** con porcentaje calculado real
   - **Rocas del Q1** con responsables (Agustín, Gumaro, Jessica, etc.)
   - **Vector Audaz** con tu BHAG completo
   - **Promesa de Marca** parseada en 3 puntos numerados
   - **Factor X** con `$83KD` (ingresos por empleado)
   - **Próxima sesión del Consejo** (22 ene 2026)
   - **Rituales** (Contrato sin firmar, Consejo activo con pago pendiente)

### 🐛 Si ves cosas raras

**"Cargando..." que nunca termina:**
- Abre DevTools (F12) → Console
- Busca errores en rojo
- Pega el error si no entiendes

**"Sin organización asignada":**
- El user actual no está en `miembros_organizacion`
- Verifica con: `SELECT * FROM miembros_organizacion;` en Supabase
- Si está vacío, el seed no corrió bien — vuelve a correrlo

**Greeting dice "usuario" en lugar de tu nombre:**
- El perfil no tiene `nombre` lleno
- Verifica en Supabase: `SELECT id, email, nombre, apellido FROM perfiles;`
- Si falta, corre: `UPDATE perfiles SET nombre = 'Agustín', apellido = 'Lozano' WHERE email = 'hola@agustinlozano.com';`

---

## 🧠 Cómo funciona internamente

```
[carga dashboard.html]
  ↓
[auth-guard.js verifica sesión]
  ↓ OK
[lucide crea iconos]
  ↓
[dashboard.js arranca]
  ↓
  ├─ getMyProfile()      → tabla `perfiles`
  ├─ getMyOrganization() → join `miembros_organizacion` ↔ `organizaciones`
  ├─ loadOPSP(orgId)     → tabla `opsp` (3 columnas JSONB)
  ├─ loadContrato(orgId) → tabla `contratos` (estado dueño)
  └─ loadConsejo(orgId)  → tabla `consejos` + miembros + sesiones + pagos
  ↓
[render funciones populan el DOM con IDs]
  ↓
[lucide.createIcons() re-pinta iconos en elementos dinámicos]
```

Todas las queries pasan por **RLS automáticamente** — solo ves datos de orgs donde
eres miembro activo. No hace falta filtrar manualmente.

---

## 🎨 Cálculo del progreso del OPSP

Por ahora se calcula así:
- **Estrategia:** % de los 9 elementos clave llenados (propósito, BHAG, factor X, promesa, ADN, vector 3-5, etc.)
- **Año:** % de los 6 elementos clave (ingresos, margen, acciones anuales, etc.)
- **Trimestre:** % de los 7 elementos (rocas, tema, rituales, celebración, etc.)
- **Total:** promedio de los 3

Esto NO es perfecto (un campo escrito con "x" cuenta igual que uno bien llenado),
pero es suficiente para una métrica visual orientativa. En el futuro puede afinarse
con validaciones más estrictas.

---

## 📝 Notas para Copilot

- **Cliente Supabase:** importa de `/assets/js/supabase-client.js`
- **Helpers disponibles:**
  - `getMyProfile()` → `{id, email, nombre, apellido, rol_global, ...}`
  - `getMyOrganization()` → `{id, nombre, nombre_corto, sector, rol, cargo, ...}`
  - `signOut()` → cierra sesión y redirige a login
- **Patrón de fetch:** siempre con `.single()` o `.maybeSingle()` cuando esperas 1 resultado
- **Errors:** siempre catch + console.error, nunca throw silencioso
- **Skeletons:** clase `.skeleton` con dimensiones via inline `style`
- **IDs dinámicos:** todos prefijados con su contexto (ej: `#kpi-opsp-percent`, `#vector-audaz-text`)

---

## ✅ Lista de verificación final

- [ ] `portal/dashboard.html` reemplazado
- [ ] `assets/js/dashboard.js` agregado
- [ ] Push a producción
- [ ] Login → dashboard muestra datos reales
- [ ] Botones de logout funcionan (sidebar + topbar dropdown)
- [ ] Click en KPI cards lleva a OPSP/Rituales (todavía 404, normal)
- [ ] Toggle dark/light persiste al recargar (gracias a localStorage)

Cuando todo eso funcione, avisa para arrancar el **Bloque C: OPSP con auto-save real**.
