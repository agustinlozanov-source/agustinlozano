// ============================================================================
// SCALEx PORTAL — Cliente Supabase v2 (multi-org)
// ============================================================================
// Versión 2: agrega soporte para múltiples organizaciones por usuario.
// Cambios vs v1:
//   - getMyOrganizations() (plural) → devuelve todas las orgs del user
//   - getMyOrganization()           → devuelve la org ACTIVA (de localStorage)
//   - setActiveOrganization(orgId)  → cambia la org activa
// ============================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// ────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://rlwkbgcxlbzmspffmibw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsd2tiZ2N4bGJ6bXNwZmZtaWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDk5OTAsImV4cCI6MjA5MzY4NTk5MH0.vE5pGNwEixG6l71n7LSt4lusdnzcYV6U_np5k6gNiQA'

const ACTIVE_ORG_KEY = 'scalex-active-org'

// ────────────────────────────────────────────────────────────────────────────
// Cliente único
// ────────────────────────────────────────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'scalex-auth'
  }
})

// ────────────────────────────────────────────────────────────────────────────
// Sesión / User
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
  localStorage.removeItem(ACTIVE_ORG_KEY)
  await supabase.auth.signOut()
  window.location.href = '/portal/login.html'
}

// ────────────────────────────────────────────────────────────────────────────
// Perfil
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
// Organizaciones (PLURAL — todas las del user)
// ────────────────────────────────────────────────────────────────────────────
export async function getMyOrganizations() {
  const user = await getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('miembros_organizacion')
    .select(`
      organizacion_id,
      rol_en_org,
      cargo,
      organizaciones (
        id, nombre, nombre_corto, sector, tipo, logo_url, estado
      )
    `)
    .eq('user_id', user.id)
    .eq('estado', 'activo')

  if (error) {
    console.error('[supabase] getMyOrganizations error', error)
    return []
  }

  // Aplanar y filtrar orgs activas
  return (data || [])
    .filter(m => m.organizaciones && m.organizaciones.estado === 'activa')
    .map(m => ({
      ...m.organizaciones,
      rol: m.rol_en_org,
      cargo: m.cargo
    }))
    // Ordenar: dueño primero, después consultor, después miembro
    .sort((a, b) => {
      const order = { dueno: 0, admin: 1, consultor: 2, miembro: 3, invitado: 4 }
      return (order[a.rol] || 9) - (order[b.rol] || 9)
    })
}

// ────────────────────────────────────────────────────────────────────────────
// Org ACTIVA — la que está siendo vista actualmente
// Se guarda el id en localStorage. Si no hay nada guardado, usa la primera.
// ────────────────────────────────────────────────────────────────────────────
export async function getMyOrganization() {
  const orgs = await getMyOrganizations()
  if (orgs.length === 0) return null

  const savedId = localStorage.getItem(ACTIVE_ORG_KEY)
  let active = orgs.find(o => o.id === savedId)

  // Si la guardada ya no existe (ej: removed), o no hay guardada → primera
  if (!active) {
    active = orgs[0]
    localStorage.setItem(ACTIVE_ORG_KEY, active.id)
  }

  return active
}

export function setActiveOrganization(orgId) {
  localStorage.setItem(ACTIVE_ORG_KEY, orgId)
  // Disparar evento para que páginas escuchen el cambio
  window.dispatchEvent(new CustomEvent('scalex:org-changed', { detail: { orgId } }))
}

export function getActiveOrganizationId() {
  return localStorage.getItem(ACTIVE_ORG_KEY)
}

// ────────────────────────────────────────────────────────────────────────────
// Helper: ¿el user actual es admin global?
// ────────────────────────────────────────────────────────────────────────────
export async function isGlobalAdmin() {
  const profile = await getMyProfile()
  return profile?.rol_global === 'admin'
}

// ────────────────────────────────────────────────────────────────────────────
// Disponible global
// ────────────────────────────────────────────────────────────────────────────
window.SCALEx = window.SCALEx || {}
Object.assign(window.SCALEx, {
  supabase,
  getSession,
  getUser,
  getMyProfile,
  getMyOrganization,
  getMyOrganizations,
  setActiveOrganization,
  getActiveOrganizationId,
  isGlobalAdmin,
  signOut
})
