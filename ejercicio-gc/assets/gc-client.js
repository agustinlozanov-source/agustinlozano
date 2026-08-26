// ============================================================================
// SCALEx · Ejercicio GC — cliente Supabase (anon + realtime), aislado del portal
// ============================================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://rlwkbgcxlbzmspffmibw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsd2tiZ2N4bGJ6bXNwZmZtaWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDk5OTAsImV4cCI6MjA5MzY4NTk5MH0.vE5pGNwEixG6l71n7LSt4lusdnzcYV6U_np5k6gNiQA'

export const SESION = 'gobierno-corporativo'
export const FN_URL = '/.netlify/functions/gc-facilitator'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

export async function getSesion() {
  const { data } = await supabase.from('gc_sesiones').select('*').eq('id', SESION).single()
  return data
}
export async function getRespuestas() {
  const { data } = await supabase.from('gc_respuestas').select('*').eq('sesion_id', SESION).order('creado_en', { ascending: true })
  return data || []
}
export async function getVotos() {
  const { data } = await supabase.from('gc_votos').select('*').eq('sesion_id', SESION)
  return data || []
}
export async function enviarRespuesta({ participanteId, nombre, texto }) {
  return supabase.from('gc_respuestas').insert({ sesion_id: SESION, participante_id: participanteId, nombre, texto })
}
export async function enviarVoto({ participanteId, opcion }) {
  return supabase.from('gc_votos').insert({ sesion_id: SESION, participante_id: participanteId, opcion })
}

// Suscripción realtime a las 3 tablas; onChange se llama en cualquier cambio.
export function suscribir(onChange) {
  const filtro = `sesion_id=eq.${SESION}`
  return supabase.channel('gc-' + Math.random().toString(36).slice(2))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gc_respuestas', filter: filtro }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gc_votos', filter: filtro }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gc_sesiones', filter: `id=eq.${SESION}` }, onChange)
    .subscribe()
}

export function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
