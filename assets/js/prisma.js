// ============================================================================
// SCALEx PORTAL - PRISMA - Perfil de Resultados Integrados
// ============================================================================
// Pilar 1 - Reflejo - Herramienta 3 (la integracion)
// 3 estados: sin-requisitos / listo-para-generar / resultado
// ============================================================================

import {
  supabase,
  getMyProfile,
  getMyOrganization,
  signOut
} from './supabase-client.js'

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => Array.from(document.querySelectorAll(sel))

const initials = (name) => {
  if (!name) return '..'
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase()
}

// ─────────────────────────────────────────────────────────────────────
// PERFILES PRISMA (textos del manuscrito SCALEx)
// ─────────────────────────────────────────────────────────────────────
const PRISMA_PERFILES = {
  lider_estrategico: {
    codigo: 'lider_estrategico',
    nombre: 'Lider Estrategico',
    color: 'green',
    icono: 'star',
    descripcion_corta: 'Listo para escalar con vision y control',
    descripcion_larga: 'Estas listo para escalar. Tu vision es clara, tomas decisiones estrategicas y tu empresa puede crecer sin depender exclusivamente de ti. El reto ahora es expandir manteniendo el control.',
    estrategia: 'Expansion controlada',
    urgencia: 'Optimizar y escalar'
  },
  lider_estancado: {
    codigo: 'lider_estancado',
    nombre: 'Lider Estancado',
    color: 'amber',
    icono: 'pause-circle',
    descripcion_corta: 'Operacion solida pero sin crecimiento',
    descripcion_larga: 'Tienes orden y procesos, pero la empresa no esta creciendo financieramente. Hay que revisar modelo de negocio, propuesta de valor y donde estan los cuellos de botella reales para la rentabilidad.',
    estrategia: 'Revisar modelo de negocio',
    urgencia: 'Romper el techo financiero'
  },
  lider_agotado: {
    codigo: 'lider_agotado',
    nombre: 'Lider Agotado',
    color: 'amber',
    icono: 'battery-low',
    descripcion_corta: 'Crece, pero a costa de tu energia',
    descripcion_larga: 'La empresa esta creciendo pero el equipo y los procesos no estan listos. Tu sigues siendo el cuello de botella y la presion se va a sentir cada vez mas. Hay que delegar y estructurar antes de que colapses tu o la operacion.',
    estrategia: 'Delegar y estructurar urgente',
    urgencia: 'Evitar el colapso'
  },
  lider_supervivencia: {
    codigo: 'lider_supervivencia',
    nombre: 'Lider en Supervivencia',
    color: 'red',
    icono: 'flame',
    descripcion_corta: 'Atrapado, sin estructura ni vision clara',
    descripcion_larga: 'Tu empresa esta atrapada en modo supervivencia. Faltan los fundamentos: vision clara, procesos, control financiero. La buena noticia: estas viendo esto. El primer paso es decidir tomar las riendas estructuradamente.',
    estrategia: 'Reestructurar desde la base',
    urgencia: 'Detener el sangrado'
  }
}

// Mapeo de codigos PIE y MAPE a nombres legibles
const PIE_PERFIL_NOMBRES = {
  'lider_estrategico': 'Lider Estrategico',
  'lider_transicion': 'Lider en Transicion',
  'lider_operativo': 'Lider Operativo',
  'lider_reactivo': 'Lider Reactivo'
}
const MAPE_CUADRANTE_NOMBRES = {
  'crecimiento_escalable': 'Crecimiento Escalable',
  'crecimiento_fragil': 'Crecimiento Fragil',
  'financiero_estancado': 'Financiero Estancado',
  'zona_estancamiento': 'Zona de Estancamiento'
}

let state = {
  org: null,
  profile: null,
  requisitos: null,
  ultimoSnapshot: null,
  historial: [],
  vistaActual: 'loading'  // loading | sin-requisitos | listo | resultado
}

// ────────────────────────────────────────────────────────────────────────────
// SUPABASE
// ────────────────────────────────────────────────────────────────────────────

async function loadRequisitos(orgId) {
  const { data, error } = await supabase.rpc('prisma_requisitos', { p_org_id: orgId })
  if (error) {
    console.error('[prisma] requisitos error', error)
    return null
  }
  return data
}

async function loadHistorial(orgId) {
  const { data, error } = await supabase
    .from('prisma_snapshots')
    .select('*')
    .eq('organizacion_id', orgId)
    .eq('usuario_id', state.profile?.id)
    .order('generado_en', { ascending: false })
    .limit(10)

  if (error) {
    console.error('[prisma] historial error', error)
    return []
  }
  return data || []
}

async function generarPrisma(pieId, mapeId) {
  const { data, error } = await supabase.rpc('prisma_generar', {
    p_pie_eval_id: pieId,
    p_mape_eval_id: mapeId
  })
  if (error) {
    console.error('[prisma] generar error', error)
    return null
  }
  return data
}

async function loadSnapshotCompleto(snapshotId) {
  const { data, error } = await supabase
    .from('prisma_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single()
  if (error) {
    console.error('[prisma] load snapshot error', error)
    return null
  }
  return data
}

async function guardarNotas(snapshotId, notas) {
  const { error } = await supabase
    .from('prisma_snapshots')
    .update({ notas_consultor: notas })
    .eq('id', snapshotId)
  return !error
}

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatFecha(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric'
  })
}

function cambiarVista(nueva) {
  state.vistaActual = nueva
  $$('.view').forEach(v => v.classList.remove('active'))
  const el = $('#view-' + nueva)
  if (el) el.classList.add('active')
  if (window.lucide) lucide.createIcons()
  const content = $('.content')
  if (content) content.scrollTop = 0
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: SIN REQUISITOS
// ────────────────────────────────────────────────────────────────────────────

function renderSinRequisitos() {
  const req = state.requisitos
  const piePill = $('#req-pie-pill')
  const mapePill = $('#req-mape-pill')

  if (req.tiene_pie) {
    piePill.classList.add('done')
    piePill.querySelector('.req-pill-status').innerHTML = '<i data-lucide="check-circle"></i><span>Completado: ' + (PIE_PERFIL_NOMBRES[req.pie_perfil] || req.pie_perfil) + '</span>'
    piePill.querySelector('.req-pill-action').style.display = 'none'
  } else {
    piePill.classList.remove('done')
    piePill.querySelector('.req-pill-status').innerHTML = '<i data-lucide="circle"></i><span>Pendiente de completar</span>'
    piePill.querySelector('.req-pill-action').style.display = 'inline-flex'
  }

  if (req.tiene_mape) {
    mapePill.classList.add('done')
    mapePill.querySelector('.req-pill-status').innerHTML = '<i data-lucide="check-circle"></i><span>Completado: ' + (MAPE_CUADRANTE_NOMBRES[req.mape_cuadrante] || req.mape_cuadrante) + '</span>'
    mapePill.querySelector('.req-pill-action').style.display = 'none'
  } else {
    mapePill.classList.remove('done')
    mapePill.querySelector('.req-pill-status').innerHTML = '<i data-lucide="circle"></i><span>Pendiente de completar</span>'
    mapePill.querySelector('.req-pill-action').style.display = 'inline-flex'
  }
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: LISTO PARA GENERAR
// ────────────────────────────────────────────────────────────────────────────

function renderListo() {
  const req = state.requisitos
  $('#listo-pie-fecha').textContent = formatFecha(req.pie_fecha)
  $('#listo-pie-perfil').textContent = PIE_PERFIL_NOMBRES[req.pie_perfil] || req.pie_perfil

  $('#listo-mape-fecha').textContent = formatFecha(req.mape_fecha)
  $('#listo-mape-cuadrante').textContent = MAPE_CUADRANTE_NOMBRES[req.mape_cuadrante] || req.mape_cuadrante

  // Si ya hay historial, mostrarlo
  if (state.historial.length > 0) {
    $('#listo-historial-wrap').style.display = 'block'
    renderHistorial()
  } else {
    $('#listo-historial-wrap').style.display = 'none'
  }
}

function renderHistorial() {
  const wrap = $('#listo-historial-list')
  if (!wrap) return

  wrap.innerHTML = state.historial.map(s => {
    const perfil = PRISMA_PERFILES[s.perfil_prisma]
    return '<div class="hist-item" data-id="' + s.id + '">' +
      '<div class="hist-icon ' + (perfil?.color || 'green') + '"><i data-lucide="' + (perfil?.icono || 'star') + '"></i></div>' +
      '<div class="hist-body">' +
        '<div class="hist-perfil">' + escapeHtml(perfil?.nombre || s.perfil_prisma) + '</div>' +
        '<div class="hist-fecha">' + formatFecha(s.generado_en) + '</div>' +
      '</div>' +
      '<button class="btn btn-ghost btn-sm" data-id="' + s.id + '"><i data-lucide="eye"></i><span>Ver</span></button>' +
    '</div>'
  }).join('')

  // Listeners
  wrap.querySelectorAll('[data-id]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = btn.dataset.id
      const snap = await loadSnapshotCompleto(id)
      if (snap) {
        state.ultimoSnapshot = snap
        renderResultado()
        cambiarVista('resultado')
      }
    })
  })
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: RESULTADO
// ────────────────────────────────────────────────────────────────────────────

function renderResultado() {
  const s = state.ultimoSnapshot
  if (!s) return

  const perfil = PRISMA_PERFILES[s.perfil_prisma] || PRISMA_PERFILES.lider_supervivencia

  // Hero
  $('#result-perfil-nombre').textContent = perfil.nombre
  $('#result-perfil-desc').textContent = perfil.descripcion_larga
  $('#result-fecha').textContent = formatFecha(s.generado_en)
  const iconEl = $('#result-perfil-icon')
  if (iconEl) {
    iconEl.innerHTML = '<i data-lucide="' + perfil.icono + '"></i>'
  }

  // Color del hero segun perfil
  const hero = $('#result-hero')
  hero.className = 'result-hero ' + (perfil.color || 'green')

  // Origen: PIE + MAPE
  $('#result-pie-perfil').textContent = PIE_PERFIL_NOMBRES[s.pie_perfil] || s.pie_perfil
  $('#result-pie-puntaje').textContent = s.pie_puntaje_total + ' / 100'

  $('#result-mape-cuadrante').textContent = MAPE_CUADRANTE_NOMBRES[s.mape_cuadrante] || s.mape_cuadrante
  $('#result-mape-puntajes').textContent = 'F: ' + s.mape_puntaje_financiero + ' / O: ' + s.mape_puntaje_operativo

  // Estrategia y urgencia (badges)
  $('#result-estrategia').textContent = perfil.estrategia
  $('#result-urgencia').textContent = perfil.urgencia

  // Plan 7-30-90
  $('#plan-7-text').textContent = s.plan_7_dias || '-'
  $('#plan-30-text').textContent = s.plan_30_dias || '-'
  $('#plan-90-text').textContent = s.plan_90_dias || '-'

  // Notas consultor
  const notasEl = $('#result-notas')
  if (notasEl) {
    notasEl.value = s.notas_consultor || ''
  }

  if (window.lucide) lucide.createIcons()
}

async function onGuardarNotas() {
  if (!state.ultimoSnapshot) return
  const notas = $('#result-notas').value
  const ok = await guardarNotas(state.ultimoSnapshot.id, notas)
  if (ok) {
    state.ultimoSnapshot.notas_consultor = notas
    showToast('Notas guardadas', 'success')
  } else {
    showToast('Error al guardar notas', 'error')
  }
}

// ────────────────────────────────────────────────────────────────────────────
// GENERAR PRISMA
// ────────────────────────────────────────────────────────────────────────────

async function onGenerar() {
  const btn = $('#btn-generar')
  btn.disabled = true
  btn.innerHTML = '<div class="spinner"></div><span>Generando PRISMA...</span>'

  const result = await generarPrisma(state.requisitos.pie_id, state.requisitos.mape_id)

  if (!result) {
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="sparkles"></i><span>Generar mi PRISMA</span>'
    if (window.lucide) lucide.createIcons()
    showToast('Error al generar PRISMA', 'error')
    return
  }

  // Cargar el snapshot completo
  const snap = await loadSnapshotCompleto(result.id)
  if (snap) {
    state.ultimoSnapshot = snap
    state.historial = await loadHistorial(state.org.id)
    renderResultado()
    cambiarVista('resultado')
  }
}

// ────────────────────────────────────────────────────────────────────────────
// UI
// ────────────────────────────────────────────────────────────────────────────

function showToast(message, type = 'info') {
  const t = $('#toast')
  if (!t) return
  t.className = 'toast ' + type + ' show'
  t.textContent = message
  setTimeout(() => t.classList.remove('show'), 2500)
}

window.toggleTheme = function() {
  const html = document.documentElement
  const next = html.dataset.theme === 'dark' ? 'light' : 'dark'
  html.dataset.theme = next
  localStorage.setItem('scalex-theme', next)
  const icon = $('#theme-icon')
  if (icon) {
    icon.setAttribute('data-lucide', next === 'dark' ? 'sun' : 'moon')
    if (window.lucide) lucide.createIcons()
  }
}

const savedTheme = localStorage.getItem('scalex-theme')
if (savedTheme) document.documentElement.dataset.theme = savedTheme

window.logout = signOut

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────

async function init() {
  try {
    const [profile, org] = await Promise.all([
      getMyProfile(),
      getMyOrganization()
    ])

    state.profile = profile
    state.org = org

    if (!org) {
      $('.content').innerHTML = '<div class="empty-state-big"><h2>Sin organizacion asignada</h2><p>Contacta a Agustin.</p></div>'
      return
    }

    const avatar = initials((profile?.nombre || '') + ' ' + (profile?.apellido || ''))
    $$('.user-avatar').forEach(el => el.textContent = avatar)

    // Cargar requisitos e historial
    const [requisitos, historial] = await Promise.all([
      loadRequisitos(org.id),
      loadHistorial(org.id)
    ])

    state.requisitos = requisitos
    state.historial = historial

    // Decidir vista inicial
    if (historial.length > 0) {
      // Tiene snapshots previos: mostrar el ultimo como resultado
      state.ultimoSnapshot = historial[0]
      renderResultado()
      cambiarVista('resultado')
    } else if (requisitos && requisitos.puede_generar) {
      // Tiene PIE y MAPE pero nunca ha generado PRISMA
      renderListo()
      cambiarVista('listo')
    } else {
      // Falta PIE o MAPE
      renderSinRequisitos()
      cambiarVista('sin-requisitos')
    }

    // Listeners
    $('#btn-generar')?.addEventListener('click', onGenerar)
    $('#btn-generar-nuevo')?.addEventListener('click', async () => {
      // Recargar requisitos primero
      state.requisitos = await loadRequisitos(org.id)
      if (state.requisitos && state.requisitos.puede_generar) {
        renderListo()
        cambiarVista('listo')
      } else {
        renderSinRequisitos()
        cambiarVista('sin-requisitos')
      }
    })

    // Notas: autosave debounced
    const notasEl = $('#result-notas')
    if (notasEl) {
      let timeout
      notasEl.addEventListener('input', () => {
        clearTimeout(timeout)
        timeout = setTimeout(onGuardarNotas, 1200)
      })
    }

    if (window.lucide) lucide.createIcons()

  } catch (err) {
    console.error('[prisma] init error:', err)
  }
}

init()
