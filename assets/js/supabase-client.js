// ============================================================================
// SCALEx PORTAL — Cliente Supabase compartido
// ============================================================================
// Importa este archivo en CUALQUIER página del portal así:
//   <script type="module" src="/assets/js/supabase-client.js"></script>
// O directamente en otro JS:
//   import { supabase, getSession, getUser } from './supabase-client.js'
// ============================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// ────────────────────────────────────────────────────────────────────────────
// Configuración
// ────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://rlwkbgcxlbzmspffmibw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsd2tiZ2N4bGJ6bXNwZmZtaWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDk5OTAsImV4cCI6MjA5MzY4NTk5MH0.vE5pGNwEixG6l71n7LSt4lusdnzcYV6U_np5k6gNiQA'

// ────────────────────────────────────────────────────────────────────────────
// Cliente único (singleton) compartido por todo el portal
// ────────────────────────────────────────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,    // detecta el token del magic link en la URL
    storage: window.localStorage,
    storageKey: 'scalex-auth'
  }
})

// ────────────────────────────────────────────────────────────────────────────
// Helpers de sesión
// ────────────────────────────────────────────────────────────────────────────
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) console.error('[supabase] getSession error', error)
  return data?.session || null
}

export async function getUser() {
  const session = await getSession()
  return session?.user || null
}

export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = '/portal/login.html'
}

// ────────────────────────────────────────────────────────────────────────────
// Helper: organización activa del usuario
// Asume que el user es miembro de al menos una org (caso normal).
// Si tiene varias, devuelve la primera. Después agregaremos selector.
// ────────────────────────────────────────────────────────────────────────────
export async function getMyOrganization() {
  const user = await getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('miembros_organizacion')
    .select(`
      organizacion_id,
      rol_en_org,
      cargo,
      organizaciones (
        id, nombre, nombre_corto, sector, tipo, logo_url
      )
    `)
    .eq('user_id', user.id)
    .eq('estado', 'activo')
    .limit(1)
    .single()

  if (error) {
    console.error('[supabase] getMyOrganization error', error)
    return null
  }

  return {
    membership_id: data.organizacion_id,
    rol: data.rol_en_org,
    cargo: data.cargo,
    ...data.organizaciones
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Helper: perfil del usuario actual
// ────────────────────────────────────────────────────────────────────────────
export async function getMyProfile() {
  const user = await getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('[supabase] getMyProfile error', error)
    return null
  }
  return data
}

// ────────────────────────────────────────────────────────────────────────────
// Disponible global por si algún script inline lo necesita
// ────────────────────────────────────────────────────────────────────────────
window.SCALEx = window.SCALEx || {}
window.SCALEx.supabase = supabase
window.SCALEx.getSession = getSession
window.SCALEx.getUser = getUser
window.SCALEx.getMyOrganization = getMyOrganization
window.SCALEx.getMyProfile = getMyProfile
window.SCALEx.signOut = signOut
