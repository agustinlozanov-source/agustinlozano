# SCALEx · Bloque F — Selector Multi-Org

Permite ver y editar varias organizaciones desde tu mismo login.
Cuando seas miembro de 2+ orgs, aparece un dropdown en el topbar.

---

## 📁 Archivos en este bloque

```
agustinlozano.com/
└── assets/
    └── js/
        ├── supabase-client.js   ← REEMPLAZAR (versión 2)
        └── org-switcher.js       ← NUEVO
```

Y modificación mínima en las 3 páginas existentes (te indico exacto qué pegar).

---

## 🚀 Pasos

### 1. Reemplaza `assets/js/supabase-client.js`

Pega la nueva versión sobre el archivo existente.

**Compatibilidad:** mantiene `getMyOrganization()` (singular) que tu código actual usa.
Solo cambia un detalle interno: ahora devuelve la org **activa** según localStorage,
y respeta el cambio cuando uses el selector.

### 2. Agrega `assets/js/org-switcher.js`

Es nuevo, no reemplaza nada.

### 3. Modifica las 3 páginas (1 minuto cada una)

#### 3.1 — `portal/dashboard.html`

**Encuentra esta línea** (~ línea 410, dentro del topbar):

```html
<div class="topbar-actions">
  <div class="topbar-icon-btn">
    <i data-lucide="bell"></i>
```

**Reemplázala con esto** (agrega un slot ANTES del bell):

```html
<div class="topbar-actions">
  <div id="topbar-org-slot"></div>
  <div class="topbar-icon-btn">
    <i data-lucide="bell"></i>
```

**Y al final, antes de `</body>`**, encuentra:

```html
  <script type="module" src="/assets/js/dashboard.js"></script>
</body>
```

Reemplázalo con:

```html
  <script type="module">
    import { mountOrgSwitcher } from '/assets/js/org-switcher.js'
    mountOrgSwitcher('#topbar-org-slot')
  </script>
  <script type="module" src="/assets/js/dashboard.js"></script>
</body>
```

#### 3.2 — `portal/opsp.html`

**Encuentra** (~ línea 460):

```html
<div class="topbar-actions">
  <div class="save-indicator" id="save-indicator">
```

**Reemplaza con:**

```html
<div class="topbar-actions">
  <div id="topbar-org-slot"></div>
  <div class="save-indicator" id="save-indicator">
```

**Al final**, encuentra:

```html
  <script type="module" src="/assets/js/opsp.js"></script>
</body>
```

Reemplaza con:

```html
  <script type="module">
    import { mountOrgSwitcher } from '/assets/js/org-switcher.js'
    mountOrgSwitcher('#topbar-org-slot')
  </script>
  <script type="module" src="/assets/js/opsp.js"></script>
</body>
```

#### 3.3 — `portal/rituales.html`

**Encuentra** (~ línea 600):

```html
<div class="topbar-title-block">
  <div class="topbar-eyebrow" id="topbar-eyebrow">Pilar 4 · Ritmo</div>
  <div class="topbar-title" id="topbar-title">Rituales de Efectividad</div>
</div>
</div>
```

⚠️ Esa última `</div>` cierra el `<div class="topbar">`. Justo ANTES de esa última línea de cierre, agrega:

```html
<div class="topbar-title-block">
  <div class="topbar-eyebrow" id="topbar-eyebrow">Pilar 4 · Ritmo</div>
  <div class="topbar-title" id="topbar-title">Rituales de Efectividad</div>
</div>
<div id="topbar-org-slot" style="margin-left:auto"></div>
</div>
```

**Al final**, encuentra:

```html
  <script type="module" src="/assets/js/rituales.js"></script>
</body>
```

Reemplaza con:

```html
  <script type="module">
    import { mountOrgSwitcher } from '/assets/js/org-switcher.js'
    mountOrgSwitcher('#topbar-org-slot')
  </script>
  <script type="module" src="/assets/js/rituales.js"></script>
</body>
```

---

## ✅ Cómo probar

### Hoy (con 1 sola org)

1. Login al portal con tu cuenta de SCALEx
2. **No verás el selector** en el topbar — porque solo tienes 1 organización
3. Esto es correcto: el selector solo aparece cuando tienes 2+

### Mañana (después de crear tu primer cliente)

1. Crea cliente con el script SQL que te entregué (`scalex-sql-05-alta-cliente-manual.sql`)
2. Recarga el portal
3. Aparece el selector en el topbar arriba a la derecha:

```
[Scaling Master LATAM ▾]
```

4. Click → dropdown con 2 opciones:

```
✓ Scaling Master LATAM   Dueño
  Constructora Cliente    Consultor
```

5. Click en "Constructora Cliente" → la página se recarga y ves los datos del cliente

6. Vuelves a click → cambias de regreso a SCALEx

---

## 🐛 Troubleshooting

### "No aparece el selector"
- Verifica que tienes 2+ orgs:
  ```sql
  select count(*) from miembros_organizacion where user_id = auth.uid() and estado = 'activo';
  ```
- Debe ser ≥ 2. Si es 1, el selector se oculta a propósito.

### "Al cambiar de org veo error 'Sin organización'"
- Probablemente el RLS no te permite ver la otra org.
- Verifica en `miembros_organizacion` que tu user esté con `rol_en_org = 'consultor'` (o lo que sea) y `estado = 'activo'`.

### "El dashboard sigue mostrando datos de la org vieja"
- Hay caché. Recarga con Ctrl+Shift+R (hard reload).
- Si persiste, abre DevTools → Console → `localStorage.removeItem('scalex-active-org')` y recarga.

---

## 🧠 Cómo funciona

```
Login → leer todas las orgs del user (getMyOrganizations)
   ↓
Si tiene 1 org → no se muestra selector
Si tiene 2+ orgs → aparece dropdown con la org activa
   ↓
Click en otra org → setActiveOrganization(id) guarda en localStorage
   ↓
Página recarga → getMyOrganization() lee localStorage y devuelve la nueva
   ↓
Todo el dashboard / OPSP / Rituales se carga con la nueva org
```

Como `getMyOrganization()` (singular) sigue existiendo y se comporta igual que antes,
**el código de las 3 páginas (dashboard.js, opsp.js, rituales.js) no necesita cambios.**

Solo agregamos 2 cosas a cada HTML:
- Un `<div id="topbar-org-slot"></div>` donde montar el selector
- Un `<script>` que invoca `mountOrgSwitcher`

---

## ✅ Lista de verificación

- [ ] `supabase-client.js` reemplazado
- [ ] `org-switcher.js` agregado
- [ ] `dashboard.html` con slot + script de switcher
- [ ] `opsp.html` con slot + script de switcher
- [ ] `rituales.html` con slot + script de switcher
- [ ] `git push` y deploy en Netlify
- [ ] Pruebas: hoy NO ves selector (1 org), funciona todo igual
- [ ] Mañana al crear cliente: aparece selector y puedes cambiar entre orgs

Cuando termines, avísame para ver el siguiente paso.
