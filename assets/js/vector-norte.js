// ============================================================================
// SCALEx PORTAL - VECTOR NORTE - Setup + Tablero de los 12 rounds
// ============================================================================
// Pilar 3 - Vector
// Vistas: loading / setup (no hay vector) / tablero (vector activo)
// ============================================================================

import {
  supabase,
  getMyProfile,
  getMyOrganization,
  signOut
} from './supabase-client.js'

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => Array.from(document.querySelectorAll(sel))

const MESES_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

let state = {
  org: null,
  profile: null,
  vector: null,           // vector activo
  trimestres: [],          // los 12 rounds
  vista: 'loading'         // loading | setup | tablero
}

// ────────────────────────────────────────────────────────────────────────────
// SUPABASE
// ────────────────────────────────────────────────────────────────────────────

async function loadVectorActivo(orgId) {
  const { data, error } = await supabase
    .from('vector_estrategicos')
    .select('*')
    .eq('organizacion_id', orgId)
    .eq('estado', 'activo')
    .maybeSingle()

  if (error) {
    console.error('[vector] load activo error', error)
    return null
  }
  return data
}

async function loadTrimestres(vectorId) {
  const { data, error } = await supabase
    .from('vector_trimestres')
    .select('*, vector_factor_x(complemento, meta_descripcion)')
    .eq('vector_id', vectorId)
    .order('numero', { ascending: true })

  if (error) {
    console.error('[vector] load trimestres error', error)
    return []
  }
  return data || []
}

async function crearVector(payload) {
  const { data, error } = await supabase
    .from('vector_estrategicos')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    console.error('[vector] crear error', error)
    return { error }
  }
  return { data }
}

async function actualizarVector(id, payload) {
  const { data, error } = await supabase
    .from('vector_estrategicos')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[vector] actualizar error', error)
    return null
  }
  return data
}

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatFechaCorta(d) {
  if (!d) return ''
  const date = new Date(d + 'T12:00:00')
  return date.getDate() + ' ' + MESES_ES[date.getMonth()] + ' ' + date.getFullYear()
}

function getAnioCalendar(fechaStr) {
  if (!fechaStr) return ''
  return new Date(fechaStr + 'T12:00:00').getFullYear()
}

function getQuarterLabel(trimestreAnio, fechaInicio) {
  const anio = getAnioCalendar(fechaInicio)
  return 'Q' + trimestreAnio + ' ' + anio
}

function cambiarVista(nueva) {
  state.vista = nueva
  $$('.view').forEach(v => v.classList.remove('active'))
  const el = $('#view-' + nueva)
  if (el) el.classList.add('active')
  if (window.lucide) lucide.createIcons()
  const content = $('.content')
  if (content) content.scrollTop = 0
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: SETUP
// ────────────────────────────────────────────────────────────────────────────

function initSetup() {
  // Fecha de inicio por defecto: primer día del próximo trimestre
  const hoy = new Date()
  const mesActual = hoy.getMonth()
  const trimestreActual = Math.floor(mesActual / 3)
  const mesProximoTri = (trimestreActual + 1) * 3
  const anio = hoy.getFullYear() + (mesProximoTri >= 12 ? 1 : 0)
  const mes = mesProximoTri % 12
  const fechaProx = new Date(anio, mes, 1)
  const isoStr = fechaProx.toISOString().split('T')[0]

  $('#setup-fecha-inicio').value = isoStr
  actualizarLabelsAnios(isoStr)

  $('#setup-fecha-inicio').addEventListener('change', (e) => {
    actualizarLabelsAnios(e.target.value)
  })
}

function actualizarLabelsAnios(fechaInicio) {
  if (!fechaInicio) return
  const anioBase = new Date(fechaInicio + 'T12:00:00').getFullYear()
  $('#setup-anio-1-label').textContent = 'AÑO 1 · ' + anioBase
  $('#setup-anio-2-label').textContent = 'AÑO 2 · ' + (anioBase + 1)
  $('#setup-anio-3-label').textContent = 'AÑO 3 · ' + (anioBase + 2)
}

async function onCrearVector() {
  const meta = $('#setup-meta').value.trim()
  const nombre = $('#setup-nombre').value.trim() || null
  const fechaInicio = $('#setup-fecha-inicio').value
  const planAnio1 = $('#setup-anio-1').value.trim() || null
  const planAnio2 = $('#setup-anio-2').value.trim() || null
  const planAnio3 = $('#setup-anio-3').value.trim() || null

  if (!meta) {
    showToast('La meta es obligatoria', 'error')
    $('#setup-meta').focus()
    return
  }

  if (!fechaInicio) {
    showToast('Define una fecha de inicio', 'error')
    return
  }

  const btn = $('#btn-crear-vector')
  btn.disabled = true
  btn.innerHTML = '<div class="spinner"></div><span>Creando vector...</span>'

  const anioBase = new Date(fechaInicio + 'T12:00:00').getFullYear()
  const fechaFin = (anioBase + 3) + '-' + fechaInicio.substring(5)

  const { data, error } = await crearVector({
    organizacion_id: state.org.id,
    creado_por: state.profile.id,
    meta: meta,
    nombre: nombre,
    plan_anio_1: planAnio1,
    plan_anio_2: planAnio2,
    plan_anio_3: planAnio3,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin
  })

  if (error) {
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="check"></i><span>Crear Vector</span>'
    if (window.lucide) lucide.createIcons()
    showToast('Error al crear vector: ' + (error.message || 'desconocido'), 'error')
    return
  }

  // Recargar todo
  state.vector = data
  state.trimestres = await loadTrimestres(data.id)
  renderTablero()
  cambiarVista('tablero')
  showToast('Vector creado · 12 rounds generados', 'success')
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: TABLERO
// ────────────────────────────────────────────────────────────────────────────

function renderTablero() {
  const v = state.vector
  const trims = state.trimestres

  // Hero
  $('#tablero-eyebrow').textContent = (v.nombre || 'Vector activo') + ' · ' +
    getAnioCalendar(v.fecha_inicio) + '-' + getAnioCalendar(v.fecha_fin)
  $('#tablero-meta').textContent = v.meta

  // Round activo
  const activo = trims.find(t => t.estado === 'activo')
  const completados = trims.filter(t => t.estado === 'completado').length
  const pct = Math.round((completados / 12) * 100)

  if (activo) {
    $('#tablero-meta-round').innerHTML = '<strong>Round ' + activo.numero + '</strong> · activo'
    $('#tablero-meta-anio').innerHTML = '<strong>Año ' + activo.anio + '</strong> · en curso'
  } else if (completados === 12) {
    $('#tablero-meta-round').innerHTML = '<strong>Completado</strong>'
    $('#tablero-meta-anio').innerHTML = '<strong>3 años</strong> · completados'
  } else {
    $('#tablero-meta-round').innerHTML = '<strong>Sin round activo</strong>'
    $('#tablero-meta-anio').innerHTML = '<strong>Por iniciar</strong>'
  }

  $('#tablero-progress-text').textContent = completados + ' de 12 rounds completados'
  $('#tablero-progress-pct').textContent = pct + '%'
  $('#tablero-progress-fill').style.width = pct + '%'

  // Timeline
  renderTimeline()

  // Plan anual (3 cards)
  renderPlanAnual()

  // Round activo destacado (Factor X)
  renderRoundActivo()

  // Grid de 12 rounds
  renderRoundsGrid()

  if (window.lucide) lucide.createIcons()
}

function renderTimeline() {
  const wrap = $('#tablero-timeline-marks')
  wrap.innerHTML = state.trimestres.map(t => {
    let cls = ''
    if (t.estado === 'completado') cls = 'completado'
    else if (t.estado === 'activo') cls = 'activo'
    return '<div class="timeline-mark ' + cls + '">' +
      '<div class="timeline-dot"></div>' +
      '<div class="timeline-num">R' + t.numero + '</div>' +
    '</div>'
  }).join('')

  const completados = state.trimestres.filter(t => t.estado === 'completado').length
  const fillPct = (completados / 12) * 100
  $('#tablero-timeline-fill').style.width = fillPct + '%'
}

function renderPlanAnual() {
  const wrap = $('#tablero-plan-anual')
  const v = state.vector
  const anioBase = getAnioCalendar(v.fecha_inicio)

  const anios = [
    {
      num: 1, anio: anioBase,
      plan: v.plan_anio_1,
      rounds: state.trimestres.filter(t => t.anio === 1)
    },
    {
      num: 2, anio: anioBase + 1,
      plan: v.plan_anio_2,
      rounds: state.trimestres.filter(t => t.anio === 2)
    },
    {
      num: 3, anio: anioBase + 2,
      plan: v.plan_anio_3,
      rounds: state.trimestres.filter(t => t.anio === 3)
    }
  ]

  wrap.innerHTML = anios.map(a => {
    const completados = a.rounds.filter(r => r.estado === 'completado').length
    const tieneActivo = a.rounds.some(r => r.estado === 'activo')
    const todosCompletados = completados === 4
    const todosPendientes = a.rounds.every(r => r.estado === 'pendiente')

    let cls = ''
    let badge = 'FUTURO'
    if (tieneActivo) { cls = 'activo'; badge = 'EN CURSO' }
    else if (todosCompletados) { cls = 'completado'; badge = 'COMPLETADO' }
    else if (completados > 0) { cls = 'completado'; badge = 'AVANCE PARCIAL' }
    else if (todosPendientes) { cls = ''; badge = 'FUTURO' }

    const activo = a.rounds.find(r => r.estado === 'activo')

    return '<div class="anio-card-view ' + cls + '">' +
      '<span class="anio-badge">' + badge + '</span>' +
      '<div class="anio-num-big">AÑO ' + a.num + ' · ' + a.anio + '</div>' +
      '<div class="anio-titulo">' + (a.plan ? escapeHtml(a.plan.split('\n')[0]) : '<span style="opacity:0.5">Sin plan definido</span>') + '</div>' +
      (a.plan && a.plan.includes('\n') ? '<div class="anio-desc">' + escapeHtml(a.plan.split('\n').slice(1).join(' ')) + '</div>' : '') +
      '<div class="anio-stats">' +
        '<span><strong>' + completados + '/4</strong> rounds</span>' +
        (activo ? '<span><strong>R' + activo.numero + '</strong> activo</span>' : '<span>R' + a.rounds[0].numero + '–R' + a.rounds[3].numero + '</span>') +
      '</div>' +
    '</div>'
  }).join('')
}

function renderRoundActivo() {
  const activo = state.trimestres.find(t => t.estado === 'activo')
  const wrap = $('#tablero-round-activo-wrap')

  if (!activo) {
    wrap.style.display = 'none'
    return
  }

  wrap.style.display = 'block'

  $('#round-activo-titulo').textContent = activo.titulo || 'Trimestre sin título'
  $('#round-activo-num').textContent = 'R' + activo.numero
  $('#round-activo-fecha').textContent = formatFechaCorta(activo.fecha_inicio) + ' → ' + formatFechaCorta(activo.fecha_fin)

  // Factor X (puede venir vacío)
  const fx = activo.vector_factor_x && activo.vector_factor_x[0]
  if (fx && fx.complemento) {
    $('#round-activo-factorx-value').textContent = 'Utilidad por ' + fx.complemento
    $('#round-activo-factorx-meta').textContent = fx.meta_descripcion || 'Define la meta concreta del trimestre'
    $('#round-activo-factorx-block').classList.remove('vacio')
  } else {
    $('#round-activo-factorx-value').textContent = 'Factor X sin definir'
    $('#round-activo-factorx-meta').textContent = 'Entra al detalle del round para definir tu Factor X y los indicadores críticos.'
    $('#round-activo-factorx-block').classList.add('vacio')
  }

  // Link al detalle
  $('#round-activo-link').href = '/portal/vector-trimestre.html?id=' + activo.id
}

function renderRoundsGrid() {
  const wrap = $('#tablero-rounds-grid')

  wrap.innerHTML = state.trimestres.map(t => {
    let cls = 'round-card'
    if (t.estado === 'activo') cls += ' activo'
    else if (t.estado === 'completado') cls += ' completado'
    if (!t.titulo) cls += ' round-card-empty'

    const fx = t.vector_factor_x && t.vector_factor_x[0]
    const factorxText = fx && fx.complemento ? 'Factor X: Utilidad por ' + fx.complemento : 'Factor X sin definir'

    let estadoBadge = ''
    if (t.estado === 'activo') estadoBadge = '<span class="round-status activo"><i data-lucide="zap"></i>En curso</span>'
    else if (t.estado === 'completado') estadoBadge = '<span class="round-status completado"><i data-lucide="check"></i>Completado</span>'
    else estadoBadge = '<span class="round-status pendiente">Pendiente</span>'

    return '<a href="/portal/vector-trimestre.html?id=' + t.id + '" class="' + cls + '">' +
      '<div class="round-head">' +
        '<div class="round-num">R' + t.numero + '</div>' +
        '<div class="round-fecha">' + getQuarterLabel(t.trimestre_anio, t.fecha_inicio) + '</div>' +
      '</div>' +
      '<div class="round-titulo">' + (t.titulo ? escapeHtml(t.titulo) : 'Sin definir') + '</div>' +
      '<div class="round-factorx">' + factorxText + '</div>' +
      '<div class="round-bottom">' + estadoBadge + '</div>' +
    '</a>'
  }).join('')

  if (window.lucide) lucide.createIcons()
}

// ────────────────────────────────────────────────────────────────────────────
// UI
// ────────────────────────────────────────────────────────────────────────────

function showToast(message, type = 'info') {
  const t = $('#toast')
  if (!t) return
  t.className = 'toast ' + type + ' show'
  t.textContent = message
  setTimeout(() => t.classList.remove('show'), 3000)
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
    const [profile, org] = await Promise.all([getMyProfile(), getMyOrganization()])
    state.profile = profile
    state.org = org

    if (!org) {
      $('.content').innerHTML = '<div class="empty-state-big"><h2>Sin organización asignada</h2></div>'
      return
    }

    // Cargar vector activo
    state.vector = await loadVectorActivo(org.id)

    if (state.vector) {
      // Hay vector activo: cargar trimestres y mostrar tablero
      state.trimestres = await loadTrimestres(state.vector.id)
      renderTablero()
      cambiarVista('tablero')
    } else {
      // No hay vector: mostrar setup
      initSetup()
      cambiarVista('setup')
    }

    // Listeners
    $('#btn-crear-vector')?.addEventListener('click', onCrearVector)

    if (window.lucide) lucide.createIcons()

  } catch (err) {
    console.error('[vector-norte] init error:', err)
  }
}

init()
