# SCALEx Portal · FLUJO — Log de desarrollo y debugging

Historial completo del Pilar Flujo: construcción, bugs encontrados y soluciones aplicadas.

---

## 📦 Archivos del pilar

```
portal/
  flujo.html                    ← Hub del pilar (7 herramientas)
  flujo-diagnostico.html        ← Diagnóstico Financiero (PRISMA del Flujo)

assets/js/
  flujo.js                      ← Hub logic
  flujo-diagnostico.js          ← Diagnóstico logic (captura + resultado)
  flujo-diagnostico-catalogo.js ← 8 variables, 3 índices, 3 matrices, veredictos, agendas
```

---

## 🏗️ Construcción inicial

**Commits:** `9b68420`

### Estructura construida

- **`flujo.html`**: Hub con 7 herramienta-cards. Diagnóstico y Costeo disponibles, 5 "Próximamente".
- **`flujo.js`**: Llama `flujo_diagnostico_activo(p_organizacion_id)`. Si hay veredicto, muestra banner de color en `#veredicto-diag` y cambia badge a "Completado".
- **`flujo-diagnostico.html`**: 3 pantallas en un solo HTML: `#pantalla-0` (bienvenida/historial), `#pantalla-captura` (variables 1–8), `#pantalla-resultado` (veredicto + índices + matrices + agenda).
- **`flujo-diagnostico.js`**: Flujo goteo de 8 variables con 4 tipos de input (`simple`, `compuesta`, `lista_componentes`, `compuesta_condicional`). Autosave 900ms. Cálculo en vivo. RPCs `flujo_iniciar_diagnostico` y `flujo_completar_diagnostico`. Resultado con 3 índices + 3 matrices 2×2 + agenda 7/30/90.
- **Sidebar actualizado** en todos los portales: `costeo.html` → `flujo.html`, ícono `calculator` → `coins`, title → "Flujo Financiero".

### RPCs utilizadas

| RPC | Parámetros | Descripción |
|---|---|---|
| `flujo_diagnostico_activo` | `p_organizacion_id` | Devuelve diagnóstico activo o más reciente completado |
| `flujo_historial_diagnosticos` | `p_organizacion_id` | Devuelve tabla de diagnósticos completados |
| `flujo_iniciar_diagnostico` | `p_organizacion_id`, `p_consultor_id` | Crea nuevo diagnóstico, devuelve uuid |
| `flujo_completar_diagnostico` | `p_diagnostico_id` | Calcula y persiste resultado, devuelve diagnóstico completo |

---

## 🐛 Bug 1 — Pantalla en blanco al abrir el Diagnóstico

**Commit:** `1f58ee7`

### Síntoma
Al dar clic en "La PRISMA del Flujo" desde el Hub, la pantalla aparecía completamente en blanco. La consola mostraba:

```
MessageNotSentError (flujo-diagnostico:1)
Uncaught (in promise) RegisterClientLocalizationsError:
  "Could not establish connection. Receiving end does not exist."
```

### Causa
`flujo-diagnostico.js` creaba su propio cliente Supabase con credenciales hardcodeadas de un proyecto diferente:

```javascript
// ❌ Incorrecto
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
const SUPABASE_URL = 'https://jxhyzmvgwmhxevjlfbcm.supabase.co'  // proyecto viejo
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
```

Nunca podía autenticar ni cargar datos, por lo que `getSession()` no devolvía nada y el `init()` terminaba silenciosamente sin renderizar.

### Solución
Reemplazar el cliente propio por el cliente compartido del portal:

```javascript
// ✅ Correcto
import { supabase, getMyProfile, getMyOrganization } from '/assets/js/supabase-client.js'
```

Y actualizar `init()` para usar `getMyProfile()` y `getMyOrganization()` en lugar de leer `auth.getSession()` + `localStorage` manualmente.

---

## 🐛 Bug 2 — "Error al guardar" en topbar al capturar variables

**Commit:** `76ffc8e`

### Síntoma
Al tipear cualquier valor en los inputs de las variables (FCN, IM, etc.), el indicador del topbar mostraba "Error al guardar" en rojo. La consola mostraba:

```
autosave: { Object }  ← Error 400
Failed to load resource: the server responded with a status of 400
```

### Causa
El autosave hacía `UPDATE flujo_diagnosticos SET variables_snapshot=..., variables_capturadas=...` pero esas columnas no existen en la tabla real de Supabase. Cada tecla disparaba un 400 y bloqueaba el flujo visualmente.

### Solución
Hacer el autosave silencioso — si la tabla no tiene esas columnas, falla en `console.warn` sin mostrar error al usuario. Los datos se persisten definitivamente cuando el usuario completa las 8 variables y ejecuta el RPC `flujo_completar_diagnostico`.

```javascript
// autosave silencioso
try {
  await supabase.from('flujo_diagnosticos').update({ ... }).eq('id', state.diagnosticoId)
} catch (e) {
  console.warn('autosave silenciado:', e?.message)  // no bloquea
}
setSave('saved', 'Guardado')  // siempre mostrar guardado
```

> **Nota SQL**: Si se quiere autosave real, agregar columnas en Supabase:
> ```sql
> ALTER TABLE flujo_diagnosticos
>   ADD COLUMN IF NOT EXISTS variables_snapshot jsonb,
>   ADD COLUMN IF NOT EXISTS variables_capturadas int DEFAULT 0;
> ```

---

## 🐛 Bug 3 — Matrices 2×2 invisibles en modo Light

**Commit:** `1691d73`

### Síntoma
En modo Light las 3 matrices diagnósticas desaparecían — fondos y bordes de los cuadrantes se volvían invisibles sobre fondo blanco.

### Causa
Las matrices se renderizaban como SVG con colores hardcodeados pensados solo para dark mode:

```javascript
// ❌ Solo funciona en dark
fill="rgba(255,255,255,0.04)"   // transparente sobre blanco = invisible
stroke="rgba(255,255,255,0.1)"  // transparente sobre blanco = invisible
fill="rgba(255,255,255,0.4)"    // texto transparente sobre blanco = invisible
```

### Solución
Reemplazar el SVG por un **CSS grid 2×2** que usa variables del tema (`--border-strong`, `--surface`, `--border`), que se adaptan automáticamente a dark y light mode:

```html
<div class="mq-grid">
  <div class="mq-cell mq-cell-green">   <!-- celda activa usa rgba(0,200,83,0.14) -->
    <div class="mq-dot mq-dot-green"></div>
  </div>
  <div class="mq-cell"></div>  <!-- inactiva usa var(--surface) y var(--border-strong) -->
  ...
</div>
```

---

## 🐛 Bug 4 — Botón "Ver resultado completo" no respondía

**Commit:** `4cf90ef`

### Síntoma
Al entrar a la página con un diagnóstico ya completado, la pantalla de bienvenida mostraba correctamente el veredicto y el botón "Ver resultado completo". Al hacer clic, no pasaba nada.

### Causa (dos problemas encadenados)

**Problema 1:** `renderResultado(data)` construía el HTML del resultado pero nunca llamaba `mostrarPantalla('pantalla-resultado')`. El switch de pantalla solo existía en el flujo de `completarDiagnostico()`, no dentro de `renderResultado` mismo.

**Problema 2:** Cuando `data` venía del RPC `flujo_diagnostico_activo`, no tenía el campo `data.indices` (los índices no están precalculados en ese RPC). El fallback calculaba local usando `state.valores` que estaba vacío porque no se había capturado nada en esta sesión de navegación.

### Solución

1. Mover `mostrarPantalla` dentro de `renderResultado`:
```javascript
function renderResultado(data) {
  // ... renderizar HTML ...
  mostrarPantalla('pantalla-resultado')  // ← siempre al final
  $pr()?.scrollTo({ top: 0, behavior: 'smooth' })
}
```

2. Usar `variables_snapshot` del objeto RPC para recalcular índices cuando no vienen precalculados:
```javascript
const src = (data && data.variables_snapshot) ? data.variables_snapshot : state.valores
const d = { fcn: src.fcn, im: src.im, mun: src.mun, ... }
indices = calcularIndices(d)
veredictoKey = data?.veredicto || determinarVeredictoLocal(evaluaciones)
```

---

## 🐛 Bug 5 — Card "Calculadora de Costos" abría la misma página

**Commit:** `11745c7`

### Síntoma
Al hacer clic en la card "Calculadora de Costos" en el Hub de Flujo, no pasaba nada — la URL no cambiaba.

### Causa
El reemplazo masivo de sidebar `costeo.html → flujo.html` que se hizo para actualizar los links del sidebar también tocó el `href` del card de Costeo dentro de `flujo.html`, dejándolo apuntando a sí mismo:

```html
<!-- ❌ Se quedó apuntando a sí mismo -->
<a href="/portal/flujo.html" class="herramienta-card">
```

### Solución
Restaurar el link correcto en el único card que lo necesitaba:

```html
<!-- ✅ Correcto -->
<a href="/portal/costeo.html" class="herramienta-card">
```

> **Lección**: Al hacer `sed` masivo para actualizar links de sidebar, usar un `grep -v` más específico que excluya no solo el archivo destino (`flujo.html`) sino también los links que no son de sidebar.

---

## ✅ Estado final

| Archivo | Estado | Commit |
|---|---|---|
| `portal/flujo.html` | ✅ Funcional | `9b68420` |
| `assets/js/flujo.js` | ✅ Funcional | `9b68420` |
| `portal/flujo-diagnostico.html` | ✅ Funcional | `9b68420` |
| `assets/js/flujo-diagnostico.js` | ✅ Funcional | `4cf90ef` |
| `assets/js/flujo-diagnostico-catalogo.js` | ✅ Copiado | `9b68420` |
| Sidebar todos los portales | ✅ Actualizado | `9b68420` |

---

## 📋 SQL útil para mantenimiento

```sql
-- Ver todos los diagnósticos de una organización
SELECT id, estado, veredicto, iniciado_en, completado_en
FROM flujo_diagnosticos
WHERE organizacion_id = '<org_id>'
ORDER BY iniciado_en DESC;

-- Limpiar diagnósticos en progreso acumulados
DELETE FROM flujo_diagnosticos
WHERE organizacion_id = '<org_id>'
  AND estado = 'en_progreso';

-- Agregar columnas para autosave (si se quiere persistencia entre sesiones)
ALTER TABLE flujo_diagnosticos
  ADD COLUMN IF NOT EXISTS variables_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS variables_capturadas int DEFAULT 0;

-- Ver código de las RPCs
SELECT proname, pg_get_functiondef(oid)
FROM pg_proc
WHERE proname LIKE 'flujo_%';
```
