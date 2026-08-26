# Ejercicio interactivo · "¿Qué es Gobierno Corporativo?"

Ejercicio participativo en vivo (Diplomado Anáhuac, Módulo 6, sesión 28–29 ago 2026).
3 fases en tiempo real: **escribir → sintetizar con IA → votar**.

- **Participantes:** `https://app.scalexlatam.com/ejercicio-gc` (enlace que compartís al grupo, mobile-first, sin login)
- **Facilitador (vos):** `https://app.scalexlatam.com/ejercicio-gc/admin?k=TU_TOKEN`

## Arquitectura (stack SCALEx real)

- **Tiempo real → Supabase Realtime.** Tablas `gc_*`; todos ven respuestas, síntesis y votos en vivo. Fallback a polling cada 6 s.
- **Síntesis con IA → función serverless Netlify** (`netlify/functions/gc-facilitator.js`). La `ANTHROPIC_API_KEY` vive **solo del lado servidor**. Usa `claude-opus-5` con *structured outputs* (JSON garantizado).
- **Seguridad:** `anon` puede leer todo y escribir respuestas/votos (RLS), pero **no** puede tocar la síntesis ni el estado — eso solo lo hace la función con la `service_role` key, y solo si el `token` coincide con `FACILITATOR_TOKEN`.
- 1 respuesta y 1 voto por persona (`localStorage` + `unique` en DB).

## Puesta en marcha

### 1. Base de datos (una vez)
En Supabase → SQL Editor, correr [`db/schema.sql`](db/schema.sql). Crea las tablas,
las políticas RLS, activa Realtime y siembra la sesión `gobierno-corporativo`.

### 2. Variables de entorno en Netlify (una vez)
Site settings → **Environment variables** → agregá estas 3 (yo nunca las veo):

| Variable | De dónde sale |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` (secreta) |
| `FACILITATOR_TOKEN` | Una cadena secreta que **vos** elegís (ej. un UUID). Es tu llave del panel. |

Después de agregarlas, hacé un redeploy (o esperá al próximo push) para que la función las tome.

### 3. Deploy
`git push` → Netlify despliega el sitio **y** la función juntos.

## Cómo se usa en clase

1. Compartí `/ejercicio-gc` con el grupo (QR o link). Cada quien escribe su definición.
2. Vos abrís `/ejercicio-gc/admin?k=TU_TOKEN` (logueate/abrilo **antes**, el token queda en la URL).
3. Cuando la mayoría respondió → **"Sintetizar N respuestas en 3 opciones"**. La IA genera 3 definiciones y a todos les aparece la votación automáticamente.
4. El grupo vota; los resultados se ven en vivo (barras + %). La ganadora se resalta.
5. Para reusar con otro grupo → **"Reiniciar ejercicio"** (borra respuestas y votos).

> ⚠️ El token va en la URL: si vas a **compartir pantalla**, abrí el panel en una ventana aparte para no exponer el token.

## Reutilizar para otro ejercicio

El modelo soporta más sesiones: insertá otra fila en `gc_sesiones` con su `pregunta`,
y ajustá el prompt de síntesis en la función. (Para múltiples ejercicios a la vez,
parametrizar `SESION` por URL — hoy hay uno fijo: `gobierno-corporativo`.)

## Archivos

```
ejercicio-gc/
├── index.html                  # participante (form → espera → votación)
├── admin/index.html + gc-admin.js   # panel del facilitador (token en URL)
├── assets/gc-client.js         # Supabase anon + realtime
├── assets/gc.js                # lógica del participante
├── assets/gc.css               # tema oscuro Anáhuac, mobile-first
└── db/schema.sql               # tablas + RLS + realtime + seed
netlify/functions/gc-facilitator.js  # síntesis con IA + reset (server-side)
```
