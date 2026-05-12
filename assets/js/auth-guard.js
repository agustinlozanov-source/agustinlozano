// ============================================================================
// SCALEx PORTAL — Auth Guard
// ============================================================================
// Protege cualquier página del portal. Si no hay sesión activa, redirige a login.
//
// Cómo usar: agrega ESTE script ANTES de cualquier otro script del portal:
//   <script type="module" src="/assets/js/auth-guard.js"></script>
//
// Ejecuta DE INMEDIATO al cargar la página, sin esperar DOMContentLoaded,
// para evitar que el usuario vea contenido protegido por una fracción de segundo.
// ============================================================================

import { supabase } from './supabase-client.js'

// Oculta el body hasta verificar la sesión (evita flash de contenido)
document.documentElement.style.visibility = 'hidden'

;(async () => {
  try {
    // 1. Verificar si hay sesión
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      // No hay sesión → redirige al login conservando la URL deseada
      const next = encodeURIComponent(window.location.pathname + window.location.search)
      window.location.replace(`/portal/login.html?next=${next}`)
      return
    }

    // 2. Sesión OK → mostrar contenido
    document.documentElement.style.visibility = 'visible'

    // 3. Escuchar cambios de sesión (logout en otra pestaña, expiración, etc.)
    supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'SIGNED_OUT' || !sess) {
        window.location.replace('/portal/login.html')
      }
    })

  } catch (err) {
    console.error('[auth-guard] error verificando sesión:', err)
    document.documentElement.style.visibility = 'visible'
  }
})()
