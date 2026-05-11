# SCALEx Portal · Bloque D — Rituales con firma persistente

Última pieza del MVP. Conecta la página de Rituales con Supabase:
firma del Contrato del Dueño persistida en BD, Consejo de Escalabilidad en vivo.

---

## 📁 Archivos en este bloque

```
agustinlozano.com/
│
├── portal/
│   └── rituales.html            ← REEMPLAZAR
│
└── assets/
    └── js/
        └── rituales.js          ← NUEVO
```

---

## 🚀 Pasos de integración

### 1. Reemplaza `portal/rituales.html` con esta versión
Cambios principales vs. el primer entregable:
- ✅ `auth-guard.js` activo
- ✅ IDs en cada elemento dinámico
- ✅ Sidebar y topbar con links reales
- ✅ Botones de logout
- ✅ Datos editables del contrato (nombre, empresa) con auto-save

### 2. Agrega `assets/js/rituales.js`
Maneja:
- Carga del contrato + firmas + consejo + miembros + sesiones + pagos
- 3 vistas (lista / contrato / consejo) con navegación interna
- Canvas de firma manuscrita + persistencia en BD como base64
- Si el contrato ya está firmado, **carga la firma guardada** y bloquea edición
- Auto-save de nombre/empresa del contrato (mientras esté en borrador)
- Vista del Consejo con miembros, sesiones, pagos y historial

### 3. Push a Netlify

```bash
git add portal/rituales.html assets/js/rituales.js
git commit -m "feat: rituales con firma persistente en BD (Bloque D - MVP completo)"
git push
```

---

## ✅ Cómo probar

### Lista de Rituales
1. Login → click en icono `repeat` (sidebar) → vas a `/portal/rituales.html`
2. Deberías ver 3 cards:
   - **Contrato del Dueño** — estado "Por firmar" (ámbar)
   - **Consejo de Escalabilidad** — estado "Activo" (verde) con `2/3 miembros · Próx. 22 ene`
   - **Kick-off** — bloqueado

### Contrato del Dueño (la firma)
3. Click en card de Contrato → entras a la vista del contrato
4. Verifica:
   - Nombre y empresa precargados editables
   - 6 cláusulas + Preámbulo visibles
   - Bloque de firma con tu nombre, cargo, fecha de hoy, lugar
   - Canvas de firma activo (cursor cambia a crosshair)
   - Sidebar derecha: "Listo para firmar" + checklist (1 done, 2 pendientes)

5. **Firma con el mouse o touch** en el canvas
   - Después del primer trazo: check 2 se marca verde, botón "Firmar Contrato" se habilita

6. **(Opcional) prueba el botón "Escribir"** → genera firma estilizada con tu nombre

7. **Click "Firmar Contrato"** (botón gradiente arriba a la derecha)
   - Spinner mientras procesa
   - **Persiste en BD:** firma como dataURL, IP, user-agent, hash, timestamp ISO
   - Aparece sello verde "Contrato firmado · [fecha]"
   - CTA desaparece, inputs se bloquean, canvas se bloquea
   - Check 3 se marca verde, progress bar al 100%

8. **Vuelve al Dashboard** (clic logo arriba izquierda) → la card "Rituales Activos" debería decir "Contrato Activo" (verde)

9. **Recarga la página** del Contrato:
   - La firma sigue ahí (cargada desde BD)
   - Estado: firmado, todos los inputs bloqueados
   - Sello visible con timestamp

### Consejo de Escalabilidad
10. Click "atrás" → click en card de Consejo
11. Verifica:
   - Miembros del Consejo: Eduardo Méndez (Operaciones), Sofía Castillo (Comercial), 1 slot vacío
   - Sesiones: próxima Q1 2026 (22 ene), 2 pasadas (Q3 y Q4 2025)
   - Cuota trimestral: $45,000 MXN · Q1 2026 · Vence el 15 de enero
   - Cuota base: $45,000
   - Historial: Q4 2025, Q3 2025, Q2 2025 — Pagados

---

## 🐛 Troubleshooting

### "Firmo y obtengo error: 'new row violates RLS policy'"
- El user no tiene rol `dueno` en `miembros_organizacion`
- Verifica con: `SELECT user_id, rol_en_org FROM miembros_organizacion;`
- Si no eres dueño: `UPDATE miembros_organizacion SET rol_en_org = 'dueno' WHERE user_id = (SELECT id FROM auth.users WHERE email = 'hola@agustinlozano.com');`

### "Cargo el contrato firmado y no se ve la firma"
- Verifica en Supabase: `SELECT id, signature_data FROM contrato_firmas WHERE contrato_id = '...';`
- Si `signature_data` es `null`, hubo error al guardar — vuelve a firmar
- Si está `data:image/png;base64,...`, debería pintarse — abre DevTools, revisa errores

### "El consejo no muestra los datos del seed"
- Verifica: `SELECT * FROM consejos;` — debe tener 1 row
- `SELECT * FROM consejo_miembros;` — debe tener 2 rows
- Si está vacío, el seed no corrió — vuelve a correrlo

### "Auto-save de nombre/empresa no funciona"
- Solo aplica si el contrato está en estado `borrador`
- Una vez firmado, los inputs quedan disabled y no editan

### "IP del firmante sale como null en la BD"
- Es normal — depende de si `api.ipify.org` no está bloqueado por adblocker
- No es crítico para el MVP, los demás campos de auditoría sí se guardan

---

## 🧠 Cómo funciona la firma persistente

```
Usuario firma en el canvas
  ↓
Click "Firmar Contrato"
  ↓
1. canvas.toDataURL() → "data:image/png;base64,..."  (la firma como imagen base64)
2. crypto.subtle.digest('SHA-256', contractText) → hash del documento
3. fetch ipify.org → IP pública del cliente
4. INSERT en contrato_firmas con:
   - signature_data (la base64)
   - ip_address (inet de PostgreSQL)
   - user_agent
   - signed_at_iso
   - hash_documento
5. UPDATE contratos:
   - estado = 'firmado'
   - signed_at = now()
   - expires_at = now() + 12 months
   - clausulas_snapshot = {version, texto}
  ↓
UI: sello verde + bloqueo de edición
```

**Por qué esto es legalmente "razonable":**
- Las firmas son inmutables (RLS no permite UPDATE/DELETE)
- Hay un hash del documento al momento de firmar (si alguien intenta cambiar las cláusulas después, no coinciden)
- IP + user-agent + timestamp ISO = trazabilidad
- Un dataURL base64 es la firma misma, no una referencia que pueda perderse

**Limitaciones:**
- No es una firma electrónica certificada (eso requiere DocuSign / FIEL / autoridad certificadora)
- Para uso interno de SCALEx con clientes que confían en la metodología, es suficiente
- Si algún cliente exige firma legal vinculante en el futuro, integramos DocuSign

---

## 📝 Notas para Copilot

- **Estado global:** `state` con `org`, `profile`, `contrato`, `consejo`, `miembros`, `sesiones`, `pagos`
- **Cargas iniciales en paralelo:** `Promise.all([loadContrato, loadConsejoData])`
- **3 vistas en una página:** `view-list`, `view-contrato`, `view-consejo`. Cambian con `showView(name)`
- **Canvas de firma:** se inicializa solo cuando se entra a la vista contrato y solo si está en borrador
- **Captura de firma:** `canvas.toDataURL('image/png')` → string base64 que va directo a Supabase
- **Hashing:** `crypto.subtle.digest('SHA-256', ...)` para auditoría del documento

---

## ✅ Lista de verificación final

- [ ] `portal/rituales.html` reemplazado
- [ ] `assets/js/rituales.js` agregado
- [ ] Push a producción
- [ ] Lista muestra 3 cards con estado real
- [ ] Click Contrato → vista del contrato
- [ ] Firmas con mouse/touch
- [ ] Click "Firmar Contrato" → sello verde aparece
- [ ] Recargas → la firma persiste
- [ ] Volver al Dashboard → card de Contrato dice "Activo"
- [ ] Click Consejo → miembros, sesiones, pago pendiente, historial
- [ ] DevTools sin errores

---

## 🎉 MVP COMPLETO

Cuando esto pase, tendrás:

✅ **Login con magic link** — funcional, sin contraseñas  
✅ **Dashboard real** — datos del OPSP, Rituales, Consejo  
✅ **OPSP editable** — auto-save, vista completa, guía contextual  
✅ **Contrato del Dueño** — firma manuscrita persistida con metadata legal  
✅ **Consejo de Escalabilidad** — miembros, sesiones, pagos visualizados  
✅ **Multi-organización ready** — schema soporta consultores y múltiples orgs  
✅ **RLS completo** — seguridad por usuario en todas las tablas  
✅ **Dark/light theme** — persistente entre páginas  
✅ **Mobile responsive** — funciona en teléfono incluyendo el canvas de firma

**Siguiente:** retomar el plan del LIBRO SCALEx (parking lot) o agregar las funcionalidades restantes del portal según prioridad. Tú eliges.
