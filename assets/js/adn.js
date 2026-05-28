// adn.js — SCALEx Portal · Hub ADN Empresarial

import { supabase, getMyProfile, getMyOrganization } from '/assets/js/supabase-client.js'

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const perfil = await getMyProfile()
  if (!perfil) return

  const org = await getMyOrganization()
  if (!org) return

  await cargarEstadoSesion(org.id, perfil.id)
})

// ──────────────────────────────────────────────
// CARGAR ESTADO DE LA SESIÓN ADN
// ──────────────────────────────────────────────
async function cargarEstadoSesion(orgId, consultorId) {
  // Obtener o crear la sesión activa
  const { data: sesionId, error: errSesion } = await supabase.rpc('adn_sesion_activa', {
    p_organizacion_id: orgId,
    p_consultor_id: consultorId
  })

  if (errSesion) {
    console.error('❌ adn_sesion_activa:', errSesion.message)
    return
  }

  if (!sesionId) {
    console.warn('⚠️ No se pudo obtener sesión ADN')
    return
  }

  // Guardar sesionId para uso global
  window.__adnSesionId = sesionId

  // Leer la sesión completa
  const { data: sesion, error: errRead } = await supabase
    .from('adn_sesiones')
    .select('*')
    .eq('id', sesionId)
    .maybeSingle()

  if (errRead) {
    console.error('❌ adn_sesiones read:', errRead.message)
    return
  }

  if (!sesion) return

  // Renderizar estado de los 4 pasos
  renderEstado(sesion)
}

// ──────────────────────────────────────────────
// RENDER DE ESTADOS
// ──────────────────────────────────────────────
function renderEstado(sesion) {
  const p0 = sesion.paso_0_completado === true
  const p1 = sesion.paso_1_completado === true
  const p2 = sesion.paso_2_completado === true

  // Calcular % de progreso (3 pasos reales, P3 es visualización)
  const completados = [p0, p1, p2].filter(Boolean).length
  const pct = Math.round((completados / 3) * 100)
  document.getElementById('prog-fill').style.width = pct + '%'
  document.getElementById('prog-pct').textContent = pct + '%'

  // ── Paso 0 ──
  if (p0) {
    setCardDone('card-0', 'num-0', 'badge-0', 'P0')
    if (sesion.tipo_piramide) {
      const nombres = { cerrada: 'Pirámide Cerrada', transicion: 'Pirámide en Transición', abierta: 'Pirámide Abierta', invertida: 'Pirámide Invertida' }
      document.getElementById('result-0-val').textContent = nombres[sesion.tipo_piramide] || sesion.tipo_piramide
      document.getElementById('result-0').style.display = 'flex'
    }
  } else {
    setCardActive('card-0', 'num-0', 'badge-0', 'P0')
  }

  // ── Paso 1 ──
  if (p0) {
    // Desbloqueado
    if (p1) {
      setCardDone('card-1', 'num-1', 'badge-1', 'P1')
      if (sesion.nombre_hibrido) {
        document.getElementById('result-1-val').textContent = sesion.nombre_hibrido
        document.getElementById('result-1').style.display = 'flex'
      }
    } else {
      setCardActive('card-1', 'num-1', 'badge-1', 'P1')
    }
    unlockCard('card-1')
  }

  // ── Paso 2 ──
  if (p1) {
    if (p2) {
      setCardDone('card-2', 'num-2', 'badge-2', 'P2')
      // Contar rectores con año
      contarRectoresActivos(window.__adnSesionId)
    } else {
      setCardActive('card-2', 'num-2', 'badge-2', 'P2')
    }
    unlockCard('card-2')
  }

  // ── Paso 3 (visualización) — se desbloquea cuando el paso 2 está completo ──
  if (p2) {
    setCardActive('card-3', 'num-3', 'badge-3', 'P3')
    unlockCard('card-3')
  }

  lucide.createIcons()
}

// ──────────────────────────────────────────────
// HELPERS DE ESTADO DE CARDS
// ──────────────────────────────────────────────
function setCardDone(cardId, numId, badgeId, label) {
  const card = document.getElementById(cardId)
  card.classList.remove('locked', 'active')
  card.classList.add('completed')

  const num = document.getElementById(numId)
  num.className = 'step-num done'
  num.textContent = '✓'

  const badge = document.getElementById(badgeId)
  badge.className = 'step-status-badge done'
  badge.textContent = 'Completado'
}

function setCardActive(cardId, numId, badgeId, label) {
  const card = document.getElementById(cardId)
  card.classList.remove('locked', 'completed')
  card.classList.add('active')

  const num = document.getElementById(numId)
  num.className = 'step-num active'
  num.textContent = label

  const badge = document.getElementById(badgeId)
  badge.className = 'step-status-badge active'
  badge.textContent = 'En curso'
}

function unlockCard(cardId) {
  const card = document.getElementById(cardId)
  card.classList.remove('locked')
  card.style.pointerEvents = ''
  card.style.opacity = ''
}

// ──────────────────────────────────────────────
// CONTAR RECTORES ACTIVOS (Paso 2)
// ──────────────────────────────────────────────
async function contarRectoresActivos(sesionId) {
  const { data, error } = await supabase
    .from('adn_rectores')
    .select('id, anio_construccion')
    .eq('sesion_id', sesionId)

  if (error) return

  const conAnio = (data || []).filter(r => r.anio_construccion).length
  const total = (data || []).length
  if (total > 0) {
    document.getElementById('result-2-val').textContent = `${conAnio}/${total} con año asignado`
    document.getElementById('result-2').style.display = 'flex'
    lucide.createIcons()
  }
}
