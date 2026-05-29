# SCALEx Portal · ADN — Log de desarrollo y debugging

Historial completo del Pilar ADN: construcción, bugs encontrados y soluciones aplicadas.

---

## 📦 Archivos del pilar

```
portal/
  adn.html                      ← Hub (Step 0–3)
  adn-piramide.html             ← Paso 0
  adn-personalidad.html         ← Paso 1
  adn-mapa.html                 ← Paso 2
  adn-piramide-invertida.html   ← Paso 3

assets/js/
  adn.js                        ← Hub logic
  adn-piramide.js               ← Paso 0 logic
  adn-personalidad.js           ← Paso 1 logic
  adn-mapa.js                   ← Paso 2 logic
  adn-piramide-invertida.js     ← Paso 3 logic
  adn-paso0-catalogo.js         ← 20 tesis de pirámide
  adn-paso1-catalogo.js         ← 28 preguntas + 7 rasgos
  adn-hibridos-catalogo.js      ← 21 híbridos empresariales
  adn-piramides-rectores-catalogo.js ← PIRAMIDES, RECTORES, AGENDAS
```

---

## 🐛 Bug 1 — Constraint `nombre_check` al guardar públicos vacíos

**Commit:** `ef06dfb`

### Síntoma
Al agregar un público nuevo y hacer click en "Guardar" antes de escribir el nombre, Supabase devolvía:

```
ERROR: 23514: new row for relation "adn_paso2_publicos" violates check constraint "adn_paso2_publicos_nombre_check"
```

La constraint en BD es: `length(trim(nombre)) > 0`

### Causa
El botón `guardar()` hacía `INSERT` inmediatamente aunque `nombre` estuviera vacío (string vacío o solo espacios).

### Solución
Patrón **draft local**: al agregar un ítem nuevo se crea solo en memoria con `{ id: 'draft-TIMESTAMP', _draft: true }`. El `INSERT` a Supabase solo ocurre cuando `nombre.trim()` tiene contenido real. La función `eliminarItem()` detecta `id.startsWith('draft-')` para no llamar a `DELETE` en BD.

---

## 🐛 Bug 2 — Botón "Completar Paso 2" siempre inhabilitado

**Commit:** `db64ffb`

### Síntoma
El botón de completar nunca se habilitaba aunque todos los campos estuvieran llenos. La consola mostraba que `rectoresEvaluados` era siempre `0`.

### Causa
Los 6 rectores en `adn-mapa.html` tenían el radio "Ausente" marcado con el atributo `checked` directamente en el HTML. Los radios pre-marcados en HTML **no disparan el evento `change`** al cargar la página, por lo que el contador nunca los contabilizaba. El requisito original era `rectoresEvaluados === 6` para habilitar el botón.

### Solución (dos partes)
1. En `cargarRectores()`: al inicializar, si un rector no existe en BD, se crea en el estado local con `{ estado_actual: 'ausente', _local: true }`. Esto asegura que los 6 siempre están en el estado local desde el inicio.
2. En `verificarCompletable()`: se eliminó el requisito de `rectoresEvaluados === 6`. Los rectores siempre cuentan como evaluados (ausente es un estado válido). El botón ahora solo requiere `1+ público + 1+ diferenciador + 1+ habilitador`.

---

## 🐛 Bug 3 — Progreso del ADN se veía en 0%, sesiones en blanco

**Fecha:** 2026-05-28

### Síntoma
Al entrar a `adn.html` el progreso mostraba 0% y el Paso 0 aparecía "En curso" aunque la sesión real estaba completada con los 3 pasos.

### Diagnóstico
La RPC `adn_sesion_activa` tenía esta lógica:

```sql
-- Buscar sesión no completada
SELECT id FROM adn_sesiones
WHERE organizacion_id = p_organizacion_id
  AND (paso_0_estado <> 'completado'
       OR paso_1_estado <> 'completado'
       OR paso_2_estado <> 'completado')
ORDER BY created_at DESC LIMIT 1;

-- Si no encuentra, CREA UNA NUEVA
INSERT INTO adn_sesiones ...
```

Como la sesión `70b8a66b` estaba **100% completada**, la condición `WHERE` no la encontraba y la RPC creaba una sesión nueva en blanco. Cada vez que se abría `adn.html`, se creaba otra sesión vacía.

En la tabla `adn_sesiones` habían acumulado 4 sesiones en blanco para la misma organización.

### Solución
Se agregó un paso intermedio a la RPC: antes de crear una sesión nueva, buscar la sesión completada más reciente:

```sql
CREATE OR REPLACE FUNCTION public.adn_sesion_activa(...)
...
  -- 1. Buscar sesión incompleta (comportamiento original)
  -- 2. Si no hay, devolver la más reciente completada  ← NUEVO
  -- 3. Si no hay ninguna, crear nueva
```

Además se eliminaron las sesiones vacías acumuladas:

```sql
DELETE FROM adn_sesiones 
WHERE organizacion_id = '90112e54-...'
  AND paso_0_estado = 'no_iniciado'
  AND paso_1_estado = 'no_iniciado'
  AND paso_2_estado = 'no_iniciado';
```

---

## 🐛 Bug 4 — Paso 3 sin sidebar y contenido cortado

**Commit:** `907a630`

### Síntoma
Al entrar a `adn-piramide-invertida.html`:
- El sidebar no aparecía
- El contenido se cortaba verticalmente

### Causa (dos problemas)

**Sidebar:** El HTML tenía `<div id="sidebar-mount"></div>` — un div vacío esperando que `portal-shell.js` lo poblara. Pero `portal-shell.js` **no crea** el sidebar desde cero, solo inyecta items adicionales en una estructura ya existente (busca `.sidebar-nav` y `.sidebar-bottom`).

**Contenido cortado:** El `.shell` no tenía `height:calc(100vh - 32px)` declarado, y el topbar usaba una estructura diferente (`topbar-left`/`topbar-right`) en lugar de la estándar (`topbar-title-block`/`topbar-actions`).

### Solución
1. Reemplazar el `<div id="sidebar-mount">` por la estructura real del sidebar (igual que `adn-mapa.html`):
   ```html
   <nav class="sidebar">
     <a href="..." class="sidebar-logo">...</a>
     <div class="sidebar-nav" id="sidebar-nav">...</div>
     <div class="sidebar-bottom" id="sidebar-bottom"></div>
   </nav>
   ```
2. Agregar `height:calc(100vh - 32px)` al CSS del `.shell`
3. Unificar el topbar con la estructura estándar: `topbar-back`, `topbar-title-block`, `topbar-actions`

---

## 🔍 Notas de esquema (columnas reales en Supabase)

Varias columnas tienen nombres distintos a los asumidos inicialmente:

| Tabla | Columna asumida | Columna real |
|---|---|---|
| `adn_sesiones` | `org_id` | `organizacion_id` |
| `adn_paso2_rectores` | `rector_clave` | `rector_codigo` |
| `adn_sesiones` | — | `iniciada_en`, `completada_en` (en lugar de `created_at` para estado) |

El JS de `adn-mapa.js` ya usa `rector_codigo` y `organizacion_id` correctamente desde el commit `248869a`.

---

## ✅ Estado final

| Paso | Archivo | Estado | Commit |
|---|---|---|---|
| Hub | `adn.html` + `adn.js` | ✅ Funcional | `0160281` |
| Paso 0 | `adn-piramide.html` + `adn-piramide.js` | ✅ Funcional | `5d35b28` |
| Paso 1 | `adn-personalidad.html` + `adn-personalidad.js` | ✅ Funcional | `fa7aaba` |
| Paso 2 | `adn-mapa.html` + `adn-mapa.js` | ✅ Funcional | `db64ffb` |
| Paso 3 | `adn-piramide-invertida.html` + `adn-piramide-invertida.js` | ✅ Funcional | `907a630` |
| RPC `adn_sesion_activa` | Supabase SQL | ✅ Corregida | — |

---

## 📋 SQL útil para mantenimiento

```sql
-- Ver todas las sesiones ADN de una organización
SELECT id, paso_0_estado, paso_1_estado, paso_2_estado, iniciada_en, completada_en
FROM adn_sesiones
WHERE organizacion_id = '<org_id>'
ORDER BY created_at DESC;

-- Limpiar sesiones en blanco acumuladas
DELETE FROM adn_sesiones 
WHERE organizacion_id = '<org_id>'
  AND paso_0_estado = 'no_iniciado'
  AND paso_1_estado = 'no_iniciado'
  AND paso_2_estado = 'no_iniciado';

-- Ver datos completos de una sesión
SELECT 'sesion' as t, paso_0_tipo_piramide, paso_0_puntaje, paso_1_nombre_hibrido FROM adn_sesiones WHERE id = '<sesion_id>'
UNION ALL
SELECT 'p0_respuestas', COUNT(*)::text, null, null FROM adn_paso0_respuestas WHERE sesion_id = '<sesion_id>'
UNION ALL
SELECT 'p1_respuestas', COUNT(*)::text, null, null FROM adn_paso1_respuestas WHERE sesion_id = '<sesion_id>';

-- Ver código de la RPC (para auditar lógica)
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'adn_sesion_activa';
```
