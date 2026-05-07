# SCALEx Portal · Bloque A — Login funcional

Setup de autenticación del portal. Después de pegar estos archivos en tu repo,
los usuarios pueden hacer login con magic link y acceder a páginas protegidas.

---

## 📁 Archivos en este bloque

```
agustinlozano.com/                   ← raíz de tu repo
│
├── netlify.toml                     ← NUEVO (o merge con el actual)
│
├── portal/                          ← carpeta nueva
│   └── login.html                   ← NUEVO
│
└── assets/
    └── js/                          ← carpeta nueva
        ├── supabase-client.js       ← NUEVO
        └── auth-guard.js            ← NUEVO
```

---

## 🚀 Pasos de integración

### 1. Crear las carpetas en tu repo

```bash
mkdir -p portal assets/js
```

### 2. Copiar los archivos

Coloca cada archivo en su ruta exacta:

| Archivo | Destino |
|---|---|
| `supabase-client.js` | `assets/js/supabase-client.js` |
| `auth-guard.js` | `assets/js/auth-guard.js` |
| `login.html` | `portal/login.html` |
| `netlify.toml` | raíz del repo |

### 3. Configurar Supabase Auth

⚠️ **CRÍTICO — sin esto el magic link no funcionará en producción:**

Entra a Supabase Dashboard → **Authentication** → **URL Configuration** y configura:

**Site URL:**
```
https://agustinlozano.com
```

**Redirect URLs (agrega estas 3):**
```
https://agustinlozano.com/portal/dashboard.html
https://agustinlozano.com/portal/**
http://localhost:**
```

La última (`localhost`) es solo si vas a probar local con un servidor estático.
Las primeras dos son obligatorias para producción.

### 4. (Opcional) Personalizar el email del magic link

Supabase Dashboard → **Authentication** → **Email Templates** → **Magic Link**

Personaliza el HTML para que diga "SCALEx Portal" en lugar del default
y mantenga la identidad visual.

### 5. Deploy a Netlify

```bash
git add .
git commit -m "feat: add SCALEx portal authentication (Bloque A)"
git push
```

Netlify hace el deploy automáticamente.

---

## ✅ Cómo probar que funciona

### Prueba local

Si tienes un servidor estático local (ej: `python -m http.server` o `npx serve`):

```bash
cd /ruta/a/agustinlozano.com
npx serve .
```

Abre `http://localhost:3000/portal/login.html` y mete tu email.

### Prueba en producción

1. Ve a `https://agustinlozano.com/portal/` (debe redirigir a `/portal/login.html`)
2. Mete tu email (`hola@agustinlozano.com`)
3. Click en "Enviar link mágico"
4. Debe aparecer "Revisa tu correo"
5. Abre tu Gmail/correo, deberías ver email de Supabase con un botón
6. Click en el botón → te lleva a `/portal/dashboard.html`

### Verificar que el guard funciona

Abre **una pestaña incógnito** y ve directo a `https://agustinlozano.com/portal/dashboard.html`.

Como NO hay sesión, debe redirigirte automáticamente a `/portal/login.html?next=/portal/dashboard.html`.

---

## 🛡️ Cómo proteger una página del portal

Para CUALQUIER página dentro de `/portal/` que requiera login, agrega ESTAS DOS LÍNEAS
en el `<head>` (ANTES de cualquier otro script):

```html
<script type="module" src="/assets/js/auth-guard.js"></script>
```

Eso es todo. El guard:
- Oculta el body al cargar
- Verifica sesión activa con Supabase
- Si no hay sesión → redirige a `/portal/login.html`
- Si hay sesión → muestra la página normalmente

---

## 🔓 Cómo agregar logout

En cualquier página del portal, para el botón "Cerrar sesión":

```html
<button onclick="window.SCALEx.signOut()">Cerrar sesión</button>
```

(El cliente Supabase expone helpers en `window.SCALEx` para uso desde HTML normal.)

---

## 🔌 Cómo usar Supabase desde tus páginas

Después del Bloque A, cualquier página del portal puede usar Supabase así:

```html
<script type="module">
  import { supabase, getMyOrganization, getMyProfile } from '/assets/js/supabase-client.js'

  // Obtener la organización del usuario actual
  const org = await getMyOrganization()
  console.log('Mi org:', org.nombre)

  // Leer el OPSP de mi organización
  const { data: opsp, error } = await supabase
    .from('opsp')
    .select('*')
    .eq('organizacion_id', org.id)
    .single()

  console.log('Mi OPSP:', opsp)
</script>
```

El RLS de Supabase garantiza que solo veas los datos de las orgs donde eres miembro.

---

## 🐛 Troubleshooting

### "El magic link no llega a mi correo"

1. Revisa la carpeta de Spam
2. Verifica que el email exista en Supabase: Dashboard → Authentication → Users
3. Verifica que `shouldCreateUser: false` esté funcionando (el código lo trae así para
   evitar registros no autorizados — solo emails ya creados pueden hacer login)

### "Click el link y me lleva a una página de error"

Verifica que en Supabase Auth → URL Configuration tengas:
- Site URL: `https://agustinlozano.com`
- Redirect URLs incluyen `https://agustinlozano.com/portal/**`

### "Hago login pero el guard me regresa al login"

Limpia localStorage:
```js
localStorage.clear()
```
Y vuelve a intentar. Puede ser sesión vieja corrupta.

### "Funciona en local pero no en producción"

Casi siempre es el Site URL en Supabase. Verifica que apunte a producción.

---

## 📝 Para Copilot

Si necesitas que Copilot agregue features sobre esta base, contexto:

- **Stack:** HTML estático puro + Supabase JS v2 vía ESM CDN
- **Auth:** Magic link con `signInWithOtp` y `shouldCreateUser: false`
- **Persistencia:** localStorage con key `scalex-auth`
- **Cliente:** singleton exportado en `/assets/js/supabase-client.js`
- **Patrón global:** `window.SCALEx.*` para acceso desde inline scripts
- **Organización del usuario:** se obtiene con `getMyOrganization()`, devuelve la primera org activa donde el user es miembro
- **RLS:** todas las queries pasan por Row Level Security automáticamente

Cuando Copilot tenga que hacer un `select`/`insert`/`update`, NO hace falta filtrar
por `user_id` ni `organizacion_id` manualmente — el RLS lo filtra. Solo hay que
cumplir los constraints (ej: insert a `opsp` requiere que el user sea `dueno` o `admin` de la org).

---

## ✅ Cuando termines este bloque

Verifica que tienes funcionando:

- [ ] `https://agustinlozano.com/portal/` redirige a `/portal/login.html`
- [ ] Login con magic link envía email
- [ ] Click en el link te lleva a `/portal/dashboard.html`
- [ ] (Por ahora `dashboard.html` no existe → te dará 404, eso es esperado)
- [ ] Pestaña incógnita en `/portal/dashboard.html` redirige a login
- [ ] `localStorage` tiene una entrada `scalex-auth`

Cuando todo esto funcione, avísale a Claude para arrancar el **Bloque B**:
adaptar `dashboard.html` con el guard + cargar datos reales del OPSP.
