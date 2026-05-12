// ============================================================================
// SCALEx PORTAL - PIE - Perfil de Impacto Empresarial
// ============================================================================
// Pilar 1 - Reflejo
// Maneja: intro -> evaluacion (4 secciones de 5 preguntas) -> resultado
// ============================================================================

import {
  supabase,
  getMyProfile,
  getMyOrganization,
  signOut
} from './supabase-client.js'

import {
  PIE_VERSION,
  PIE_ESCALA,
  PIE_SECCIONES,
  PIE_PREGUNTAS,
  PIE_PERFILES,
  getPerfilByPuntaje,
  getPreguntasBySeccion
} from './pie-questions.js'

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => Array.from(document.querySelectorAll(sel))

const initials = (name) => {
  if (!name) return '..'
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase()
}

let state = {
  org: null,
  profile: null,
  evaluacionId: null,
  vista: 'intro',         // intro | eval | result
  seccionActual: 0,       // 0..3
  respuestas: {},         // { 'mentalidad_1': 4, 'mentalidad_2': 5, ... }
  resultado: null,        // breakdown despues de calcular
  historial: [],          // evaluaciones previas completadas
  saving: false
}

// ────────────────────────────────────────────────────────────────────────────
// SUPABASE
// ────────────────────────────────────────────────────────────────────────────

async function iniciarOReanudarEvaluacion(orgId) {
  // Llamamos a la funcion SQL que devuelve la evaluacion en_progreso
  // si existe, o crea una nueva
  const { data: evalId, error } = await supabase.rpc('pie_iniciar_evaluacion', {
    p_org_id: orgId
  })

  if (error) {
    console.error('[pie] iniciar error', error)
    return null
  }
  return evalId
}

async function loadRespuestasExistentes(evalId) {
  const { data, error } = await supabase
    .from('pie_respuestas')
    .select('pregunta_codigo, valor')
    .eq('evaluacion_id', evalId)

  if (error) {
    console.error('[pie] load respuestas error', error)
    return {}
  }

  const map = {}
  ;(data || []).forEach(r => {
    map[r.pregunta_codigo] = r.valor
  })
  return map
}

async function loadHistorial(orgId) {
  const { data, error } = await supabase
    .from('pie_evaluaciones')
    .select('*')
    .eq('organizacion_id', orgId)
    .eq('usuario_id', state.profile?.id)
    .eq('estado', 'completada')
    .order('completada_en', { ascending: false })
    .limit(10)

  if (error) {
    console.error('[pie] historial error', error)
    return []
  }
  return data || []
}

async function guardarRespuesta(evalId, pregunta, valor) {
  const seccion = pregunta.split('_')[0]
  const preguntaObj = PIE_PREGUNTAS.find(p => p.codigo === pregunta)
  const orden = preguntaObj?.orden || 0

  const { error } = await supabase
    .from('pie_respuestas')
    .upsert({
      evaluacion_id: evalId,
      pregunta_codigo: pregunta,
      seccion: seccion,
      valor: valor,
      orden: orden
    }, { onConflict: 'evaluacion_id,pregunta_codigo' })

  if (error) {
    console.error('[pie] guardar respuesta error', error)
    return false
  }
  return true
}

async function completarEvaluacion(evalId) {
  // Actualizar la version del cuestionario primero
  await supabase
    .from('pie_evaluaciones')
    .update({ cuestionario_version: PIE_VERSION })
    .eq('id', evalId)

  // Llamar a la funcion que calcula y persiste
  const { data, error } = await supabase.rpc('pie_calcular_perfil', {
    p_evaluacion_id: evalId
  })

  if (error) {
    console.error('[pie] calcular perfil error', error)
    return null
  }
  return data
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

function getRespuestasCount() {
  return Object.keys(state.respuestas).length
}

function getProgreso() {
  const total = PIE_PREGUNTAS.length
  const respondidas = getRespuestasCount()
  return { total, respondidas, pct: Math.round((respondidas / total) * 100) }
}

function getSeccionProgreso(seccionCodigo) {
  const preguntas = getPreguntasBySeccion(seccionCodigo)
  const respondidas = preguntas.filter(p => state.respuestas[p.codigo] !== undefined).length
  return { total: preguntas.length, respondidas, completa: respondidas === preguntas.length }
}

function todasRespondidas() {
  return PIE_PREGUNTAS.every(p => state.respuestas[p.codigo] !== undefined)
}

// ────────────────────────────────────────────────────────────────────────────
// VISTAS
// ────────────────────────────────────────────────────────────────────────────

function cambiarVista(nueva) {
  state.vista = nueva
  $$('.view').forEach(v => v.classList.remove('active'))
  const el = $('#view-' + nueva)
  if (el) el.classList.add('active')
  if (window.lucide) lucide.createIcons()
  // Scroll up
  const content = $('.content')
  if (content) content.scrollTop = 0
}

// ─── INTRO ───────────────────────────────────────────────────────────
function renderIntro() {
  // Mostrar historial si hay
  const wrap = $('#intro-historial')
  if (!wrap) return

  if (state.historial.length === 0) {
    wrap.style.display = 'none'
    return
  }

  wrap.style.display = 'block'
  const ultima = state.historial[0]
  const perfil = PIE_PERFILES[ultima.perfil]
  const fecha = new Date(ultima.completada_en).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  $('#hist-fecha').textContent = fecha
  $('#hist-perfil').textContent = perfil?.nombre || '-'
  $('#hist-puntaje').textContent = ultima.puntaje_total + ' / 100'
  $('#hist-count').textContent = state.historial.length + ' evaluacion' + (state.historial.length !== 1 ? 'es' : '') + ' previa' + (state.historial.length !== 1 ? 's' : '')
}

// ─── EVALUACION ──────────────────────────────────────────────────────
function renderEval() {
  const seccion = PIE_SECCIONES[state.seccionActual]
  const preguntas = getPreguntasBySeccion(seccion.codigo)
  const progreso = getProgreso()

  // Header
  $('#eval-seccion-num').textContent = 'SECCION ' + seccion.numero + ' - ' + seccion.titulo.toUpperCase()
  $('#eval-seccion-titulo').textContent = seccion.pregunta
  $('#eval-seccion-desc').textContent = seccion.descripcion

  // Progress
  $('#eval-progress-fill').style.width = progreso.pct + '%'
  $('#eval-progress-seccion').textContent = (state.seccionActual + 1)
  $('#eval-progress-preguntas').textContent = progreso.respondidas
  $('#eval-progress-total').textContent = progreso.total

  // Preguntas
  const wrap = $('#eval-questions')
  wrap.innerHTML = preguntas.map(p => {
    const respuesta = state.respuestas[p.codigo]
    const opciones = PIE_ESCALA.map(e => {
      const selected = respuesta === e.valor ? 'selected' : ''
      return '<button type="button" class="eval-option ' + selected + '" data-codigo="' + p.codigo + '" data-valor="' + e.valor + '">' +
        '<div class="eval-option-num">' + e.valor + '</div>' +
        '<div class="eval-option-label">' + e.label + '</div>' +
      '</button>'
    }).join('')

    return '<div class="eval-question" data-codigo="' + p.codigo + '">' +
      '<div class="eval-question-text">"' + escapeHtml(p.texto) + '"</div>' +
      '<div class="eval-options">' + opciones + '</div>' +
    '</div>'
  }).join('')

  // Listeners en opciones
  wrap.querySelectorAll('.eval-option').forEach(btn => {
    btn.addEventListener('click', onSelectOption)
  })

  // Navegacion
  const btnPrev = $('#eval-btn-prev')
  const btnNext = $('#eval-btn-next')

  btnPrev.disabled = state.seccionActual === 0
  btnPrev.style.visibility = state.seccionActual === 0 ? 'hidden' : 'visible'

  const esUltimaSeccion = state.seccionActual === PIE_SECCIONES.length - 1
  const seccionProg = getSeccionProgreso(seccion.codigo)

  if (esUltimaSeccion) {
    btnNext.innerHTML = '<span>Ver resultado</span><i data-lucide="sparkles"></i>'
    btnNext.disabled = !todasRespondidas()
  } else {
    btnNext.innerHTML = '<span>Seccion siguiente</span><i data-lucide="arrow-right"></i>'
    btnNext.disabled = !seccionProg.completa
  }

  // Save indicator
  const saveInd = $('#eval-save')
  if (saveInd) {
    if (state.saving) {
      saveInd.innerHTML = '<div class="dot saving"></div><span>Guardando...</span>'
    } else {
      saveInd.innerHTML = '<div class="dot saved"></div><span>Respuestas guardadas</span>'
    }
  }

  if (window.lucide) lucide.createIcons()
}

async function onSelectOption(e) {
  const btn = e.currentTarget
  const codigo = btn.dataset.codigo
  const valor = parseInt(btn.dataset.valor)

  // UI optimistic
  const wrap = btn.closest('.eval-options')
  wrap.querySelectorAll('.eval-option').forEach(o => o.classList.remove('selected'))
  btn.classList.add('selected')

  state.respuestas[codigo] = valor
  state.saving = true
  renderEval() // re-render para actualizar progreso y boton

  // Persistir
  const ok = await guardarRespuesta(state.evaluacionId, codigo, valor)
  state.saving = false

  if (!ok) {
    showToast('Error al guardar', 'error')
  }

  renderEval()
}

function siguienteSeccion() {
  if (state.seccionActual < PIE_SECCIONES.length - 1) {
    state.seccionActual++
    renderEval()
  }
}

function anteriorSeccion() {
  if (state.seccionActual > 0) {
    state.seccionActual--
    renderEval()
  }
}

async function completar() {
  if (!todasRespondidas()) {
    showToast('Completa todas las preguntas', 'error')
    return
  }

  $('#eval-btn-next').disabled = true
  $('#eval-btn-next').innerHTML = '<div class="spinner"></div><span>Calculando...</span>'

  const breakdown = await completarEvaluacion(state.evaluacionId)

  if (!breakdown) {
    showToast('Error al completar evaluacion', 'error')
    $('#eval-btn-next').disabled = false
    return
  }

  state.resultado = breakdown
  renderResultado()
  cambiarVista('result')

  // Refrescar historial
  state.historial = await loadHistorial(state.org.id)
}

// ─── RESULTADO ───────────────────────────────────────────────────────
function renderResultado() {
  if (!state.resultado) return

  const r = state.resultado
  const perfil = PIE_PERFILES[r.perfil] || PIE_PERFILES.lider_reactivo

  // Hero
  $('#result-perfil').textContent = perfil.nombre
  $('#result-score').textContent = r.puntaje_total
  $('#result-desc').textContent = perfil.descripcion_larga

  // Meter (posicion del puntaje sobre 100)
  $('#result-meter-fill').style.width = Math.max(2, r.puntaje_total) + '%'

  // Radar
  renderRadar({
    mentalidad: r.puntaje_mentalidad,
    decisiones: r.puntaje_decisiones,
    delegacion: r.puntaje_delegacion,
    vision: r.puntaje_vision
  })

  // Desglose
  renderSecciones({
    mentalidad: r.puntaje_mentalidad,
    decisiones: r.puntaje_decisiones,
    delegacion: r.puntaje_delegacion,
    vision: r.puntaje_vision
  })

  // Recomendaciones (las del perfil, pero priorizadas por seccion mas baja)
  renderRecomendaciones(perfil, r)

  if (window.lucide) lucide.createIcons()
}

function renderRadar(scores) {
  // Radar SVG con 4 ejes (un valor por seccion, 0-25)
  const max = 25
  const center = 120
  const radius = 90

  // 4 puntos cardinales: arriba (mentalidad), derecha (decisiones), abajo (delegacion), izquierda (vision)
  const angles = [-Math.PI/2, 0, Math.PI/2, Math.PI]
  const seccionesOrder = ['mentalidad','decisiones','delegacion','vision']

  // Puntos de la forma (valor del usuario)
  const userPoints = seccionesOrder.map((s, i) => {
    const v = scores[s] / max
    const x = center + Math.cos(angles[i]) * radius * v
    const y = center + Math.sin(angles[i]) * radius * v
    return x.toFixed(1) + ',' + y.toFixed(1)
  }).join(' ')

  // Capas del grid (25%, 50%, 75%, 100%)
  const grids = [0.25, 0.5, 0.75, 1].map(scale => {
    return seccionesOrder.map((s, i) => {
      const x = center + Math.cos(angles[i]) * radius * scale
      const y = center + Math.sin(angles[i]) * radius * scale
      return x.toFixed(1) + ',' + y.toFixed(1)
    }).join(' ')
  })

  // Ejes
  const ejes = seccionesOrder.map((s, i) => {
    const x = center + Math.cos(angles[i]) * radius
    const y = center + Math.sin(angles[i]) * radius
    return '<line x1="' + center + '" y1="' + center + '" x2="' + x + '" y2="' + y + '" stroke="var(--border)" stroke-width="0.5"/>'
  }).join('')

  // Labels
  const labels = [
    { x: center, y: center - radius - 12, text: 'MENTALIDAD' },
    { x: center + radius + 12, y: center, text: 'DECISIONES' },
    { x: center, y: center + radius + 18, text: 'DELEGACION' },
    { x: center - radius - 12, y: center, text: 'VISION' }
  ].map(l => '<text x="' + l.x + '" y="' + l.y + '" text-anchor="middle" font-size="9" font-family="Plus Jakarta Sans" fill="var(--text-2)" font-weight="700">' + l.text + '</text>').join('')

  // Puntos del usuario
  const dots = seccionesOrder.map((s, i) => {
    const v = scores[s] / max
    const x = center + Math.cos(angles[i]) * radius * v
    const y = center + Math.sin(angles[i]) * radius * v
    return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" fill="#1aab99"/>'
  }).join('')

  const svg = '<svg class="radar-svg" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">' +
    '<defs>' +
      '<linearGradient id="gradRadar" x1="0%" y1="0%" x2="100%" y2="100%">' +
        '<stop offset="0%" stop-color="#1aab99" stop-opacity="0.4"/>' +
        '<stop offset="100%" stop-color="#3533cd" stop-opacity="0.4"/>' +
      '</linearGradient>' +
    '</defs>' +
    grids.map(g => '<polygon points="' + g + '" fill="none" stroke="var(--border-strong)" stroke-width="0.8" opacity="0.5"/>').join('') +
    ejes +
    '<polygon points="' + userPoints + '" fill="url(#gradRadar)" stroke="#1aab99" stroke-width="2"/>' +
    dots +
    labels +
  '</svg>'

  $('#result-radar').innerHTML = svg
}

function renderSecciones(scores) {
  const wrap = $('#result-secciones')
  const secciones = [
    { codigo: 'mentalidad', nombre: 'Mentalidad empresarial', valor: scores.mentalidad },
    { codigo: 'decisiones', nombre: 'Toma de decisiones', valor: scores.decisiones },
    { codigo: 'delegacion', nombre: 'Delegacion y liderazgo', valor: scores.delegacion },
    { codigo: 'vision', nombre: 'Vision y estrategia', valor: scores.vision }
  ]

  wrap.innerHTML = secciones.map(s => {
    const pct = (s.valor / 25) * 100
    const cls = pct >= 70 ? 'good' : pct >= 50 ? 'warn' : 'bad'
    return '<div class="section-score-row">' +
      '<span class="section-score-label">' + s.nombre + '</span>' +
      '<span class="section-score-value">' + s.valor + ' / 25</span>' +
      '<div class="section-score-bar"><div class="section-score-bar-fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
    '</div>'
  }).join('')
}

function renderRecomendaciones(perfil, r) {
  // Priorizar acciones del perfil pero mencionar la dimension mas baja
  const scores = [
    { codigo: 'mentalidad', nombre: 'Mentalidad empresarial', valor: r.puntaje_mentalidad },
    { codigo: 'decisiones', nombre: 'Toma de decisiones', valor: r.puntaje_decisiones },
    { codigo: 'delegacion', nombre: 'Delegacion y liderazgo', valor: r.puntaje_delegacion },
    { codigo: 'vision', nombre: 'Vision y estrategia', valor: r.puntaje_vision }
  ].sort((a,b) => a.valor - b.valor)

  const masBaja = scores[0]

  const wrap = $('#result-reco')
  let html = ''

  // Primera reco: la mas urgente (basada en la dimension mas baja)
  html += '<li class="reco-item"><div class="reco-icon"><i data-lucide="target"></i></div>' +
    '<div class="reco-text"><strong>Tu dimension mas baja es "' + masBaja.nombre + '" (' + masBaja.valor + '/25).</strong> Es donde mas espacio tienes para crecer y donde mas impacto generara mejorar.</div></li>'

  // Acciones del perfil
  perfil.acciones.forEach(accion => {
    html += '<li class="reco-item"><div class="reco-icon"><i data-lucide="check"></i></div>' +
      '<div class="reco-text">' + escapeHtml(accion) + '</div></li>'
  })

  wrap.innerHTML = html
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

    // Header avatar
    const avatar = initials((profile?.nombre || '') + ' ' + (profile?.apellido || ''))
    $$('.user-avatar').forEach(el => el.textContent = avatar)

    // Cargar historial primero
    state.historial = await loadHistorial(org.id)

    // Renderizar intro
    renderIntro()

    // Listeners
    $('#btn-empezar').addEventListener('click', async () => {
      // Iniciar o reanudar evaluacion
      const evalId = await iniciarOReanudarEvaluacion(org.id)
      if (!evalId) {
        showToast('Error al iniciar evaluacion', 'error')
        return
      }
      state.evaluacionId = evalId

      // Cargar respuestas existentes (si reanuda)
      state.respuestas = await loadRespuestasExistentes(evalId)

      // Empezar en la primera seccion incompleta
      let primeraIncompleta = 0
      for (let i = 0; i < PIE_SECCIONES.length; i++) {
        const prog = getSeccionProgreso(PIE_SECCIONES[i].codigo)
        if (!prog.completa) {
          primeraIncompleta = i
          break
        }
      }
      state.seccionActual = primeraIncompleta

      renderEval()
      cambiarVista('eval')
    })

    $('#eval-btn-prev').addEventListener('click', anteriorSeccion)
    $('#eval-btn-next').addEventListener('click', () => {
      const esUltima = state.seccionActual === PIE_SECCIONES.length - 1
      if (esUltima) {
        completar()
      } else {
        siguienteSeccion()
      }
    })

    $('#btn-volver-intro').addEventListener('click', () => {
      cambiarVista('intro')
      renderIntro()
    })

    $('#btn-nueva-eval').addEventListener('click', async () => {
      // Forzar nueva evaluacion: crear directamente
      const { data, error } = await supabase
        .from('pie_evaluaciones')
        .insert({
          organizacion_id: org.id,
          usuario_id: profile.id,
          estado: 'en_progreso',
          cuestionario_version: PIE_VERSION
        })
        .select('id')
        .single()

      if (error) {
        showToast('Error al crear nueva evaluacion', 'error')
        return
      }

      state.evaluacionId = data.id
      state.respuestas = {}
      state.seccionActual = 0
      state.resultado = null

      renderEval()
      cambiarVista('eval')
    })

    if (window.lucide) lucide.createIcons()

  } catch (err) {
    console.error('[pie] init error:', err)
  }
}

init()
