# SCALEx Portal · Bloque C — OPSP con auto-save real

`portal/opsp.html` ahora carga datos reales de Supabase, los inyecta en cada input,
y guarda cambios automáticamente con debounce de 1.2s después de que dejas de escribir.

---

## 📁 Archivos en este bloque

```
agustinlozano.com/
│
├── portal/
│   └── opsp.html                ← REEMPLAZAR
│
└── assets/
    └── js/
        └── opsp.js              ← NUEVO
```

---

## 🚀 Pasos de integración

### 1. Reemplaza `portal/opsp.html`
Si ya tenías el opsp del primer entregable, bórralo y pon esta nueva versión.
Cambios principales:
- ✅ `auth-guard.js` activo en el `<head>`
- ✅ IDs en cada input (más de 60 hooks dinámicos)
- ✅ Sidebar con links reales
- ✅ Botón de logout funcional
- ✅ Indicador de save dinámico (saving/saved/error)

### 2. Agrega `assets/js/opsp.js`
Maneja:
- Carga del OPSP de la org actual
- Populate de los 3 JSONB en los inputs
- Auto-save con debounce de 1.2s
- Vista Completa con datos en vivo (no hardcoded)
- Guía Divertida (17 secciones)
- Tabs y navegación

### 3. Push a Netlify

```bash
git add portal/opsp.html assets/js/opsp.js
git commit -m "feat: OPSP con auto-save real (Bloque C)"
git push
```

---

## ✅ Cómo probar

1. Login en `https://agustinlozano.com/portal/login.html`
2. Click en el icono del mapa (sidebar izquierda) → vas a `/portal/opsp.html`
3. Deberías ver:
   - **Topbar:** "OPSP — Scaling Master LATAM SA de CV"
   - **Indicador verde:** "Guardado hace X min"
   - **Tab Estrategia activa** con tu Propósito Evolutivo, Vector Audaz, Factor X
   - **Factores ADN llenos** (4 columnas con 2 inputs cada una)
   - **Vector 3-5 años:** 2027 / 10MDD / 3.5MDD / 2.3MDD
   - **Acciones 3-5 años:** las 5 que vienen del seed

4. **Cambia un texto** en cualquier campo:
   - Indicador cambia a "Editando..." (ámbar)
   - Esperas 1.2s
   - Indicador cambia a "Guardando..." (ámbar)
   - Después: "Guardado hace un momento" (verde)

5. **Recarga la página (F5):**
   - Tu cambio sigue ahí

6. **Prueba los otros 2 tabs:**
   - **Año** — KPIs anuales con los 3 semáforos llenos
   - **Trimestre** — Tema "ALL IN / CALL", 5 rocas con responsables, 5 rituales, celebración y recompensa

7. **Click "Vista completa"** (arriba a la derecha):
   - Modal con el OPSP completo en una página
   - Todos los datos provienen del estado actual (no del DB, así ves edits sin guardar)
   - Botón "Imprimir" funcional

8. **Click los `?`** de cualquier sección:
   - Panel lateral derecho actualiza con la guía divertida + tip
   - Sección se resalta con borde teal

---

## 🐛 Troubleshooting

### "Indicador queda en 'Cargando...' para siempre"
- DevTools (F12) → Console → busca errores
- Verifica que tu user esté en `miembros_organizacion`
- Si no hay OPSP para esa org, el script crea uno vacío automáticamente — debería funcionar

### "Edito y no guarda"
- Verifica el indicador: ¿pasa por "Guardando" → "Guardado"?
- Si dice "Error": problema de RLS. Verifica que tienes rol `dueno` en `miembros_organizacion`
- Console errors → péguenmelos

### "Vista Completa muestra todo vacío"
- La vista lee del DOM (no de la BD), así que muestra lo que tienes escrito en este momento
- Si está vacío, es porque los inputs están vacíos
- Recarga primero para confirmar que la carga funcionó

### "Auto-save guarda DEMASIADO frecuente o lento"
- Default: 1.2s después de dejar de escribir
- Para cambiar: edita la línea `const debouncedSave = debounce(saveOPSP, 1200)` en opsp.js

---

## 🧠 Cómo funciona el auto-save

```
Usuario escribe en cualquier input
  ↓
Event 'input' → setSaveStatus('saving', 'Editando...')
  ↓
debouncedSave() → espera 1200ms sin más eventos
  ↓
saveOPSP():
  ├─ Recolecta los 3 JSONB del DOM (collectEstrategia, collectAnual, collectTrimestral)
  ├─ Update en Supabase con los 3 campos JSONB
  ├─ Si OK: setSaveStatus('saved', 'Guardado hace un momento')
  └─ Si error: setSaveStatus('error') + retry en 3s
```

**Eficiencia:** un solo UPDATE por escribir 50 caracteres en cualquier campo, en lugar de 50 updates individuales.

---

## 📝 Notas para Copilot

- **Estado global:** `state` con `org`, `profile`, `opspId`, los 3 JSONB
- **Helpers de id:** todos los inputs tienen IDs predecibles. Patrón: `prefix_seccion_indice`
  - `proposito_evolutivo`, `vector_audaz`, `factor_x`, `promesa_marca`
  - `adn_{cultura|marketing|legal|capital}_{1|2}`
  - `v35_{ano|ingresos|ganancias|efectivo|ecosistema}`
  - `acc35_{1..5}`, `accA_{1..5}`
  - `a_{ano|ingresos|margen|efectivo|...}`
  - `fp_{talento|proceso|reconocimiento}_{1|2}`
  - `kpiA_{1..3}_{nombre|verde|ambar|rojo}`
  - `t_{trimestre|ano|fecha_limite|...}`
  - `t_tema_{nombre|objetivo|scoreboard}`
  - `rocaT_{1..5}_{prio|resp}`
  - `ritR_{1..5}_{kpi|plazo}`
  - `t_celebracion`, `t_recompensa`

- **Guía Divertida:** objeto `GUIDES` con keys que matchean el `data-guide` de cada `.section`

- **Vista Completa:** función `openFullView()` recolecta el DOM en vivo, NO lee de BD

---

## ✅ Lista de verificación final

- [ ] `portal/opsp.html` reemplazado
- [ ] `assets/js/opsp.js` agregado
- [ ] Push a producción
- [ ] OPSP carga datos reales (Vector Audaz visible al instante)
- [ ] Editas → "Guardando" → "Guardado"
- [ ] Recargas → tu edit persiste
- [ ] Los 3 tabs muestran datos correctos
- [ ] Vista Completa muestra todo bien
- [ ] Guía Divertida funciona en las 17 secciones
- [ ] Tema dark/light persiste
- [ ] Logout funciona

Cuando todo eso funcione, **avisas para arrancar el Bloque D: Rituales con firma persistente**.
