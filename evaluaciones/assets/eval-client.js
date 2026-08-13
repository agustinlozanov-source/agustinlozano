// ============================================================================
// SCALEx · Evaluaciones — Cliente Supabase (aislado del portal)
// ============================================================================
// Sección independiente: NO reusa la sesión del portal (persistSession: false).
// Solo llama a las 2 funciones RPC públicas (eval_iniciar / eval_calificar).
// La anon key es pública por diseño; las respuestas correctas viven detrás de
// RLS + funciones SECURITY DEFINER en Postgres.
// ============================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://rlwkbgcxlbzmspffmibw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsd2tiZ2N4bGJ6bXNwZmZtaWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDk5OTAsImV4cCI6MjA5MzY4NTk5MH0.vE5pGNwEixG6l71n7LSt4lusdnzcYV6U_np5k6gNiQA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
})

export async function evalCatalogo() {
  const { data, error } = await supabase.rpc('eval_catalogo')
  if (error) throw error
  return data || []
}

export async function evalIniciar({ nombre, email, empresa, evaluacionId }) {
  const { data, error } = await supabase.rpc('eval_iniciar', {
    p_nombre: nombre, p_email: email, p_empresa: empresa, p_evaluacion_id: evaluacionId
  })
  if (error) throw error
  return data
}

export async function evalCalificar({ intentoId, respuestas }) {
  const { data, error } = await supabase.rpc('eval_calificar', {
    p_intento_id: intentoId, p_respuestas: respuestas
  })
  if (error) throw error
  return data
}

// Usadas por /resultados (acceso abierto por decisión del dueño).
export async function evalResultadosLista() {
  const { data, error } = await supabase.rpc('eval_resultados_lista')
  if (error) throw error
  return data || []
}

export async function evalResultados(evaluacionId) {
  const args = evaluacionId ? { p_evaluacion_id: evaluacionId } : {}
  const { data, error } = await supabase.rpc('eval_resultados', args)
  if (error) throw error
  return data
}
