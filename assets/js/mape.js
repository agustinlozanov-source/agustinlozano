// ============================================================================
// SCALEx PORTAL - MAPE - Matriz de Posicionamiento Empresarial
// ============================================================================
// Pilar 1 - Reflejo - Herramienta 2
// Flujo: intro -> evaluacion (2 ejes de 6 indicadores) -> resultado
// ============================================================================

import {
  supabase,
  getMyProfile,
  getMyOrganization,
  signOut
} from './supabase-client.js'

import {
  MAPE_VERSION,
  MAPE_ESCALA_LIKERT,
  MAPE_EJES,
  MAPE_INDICADORES,
  MAPE_CUADRANTES,
  getCuadrante,
  getIndicadoresByEje,
  getEjeByCodigo,
  normalizarRespuesta,
  getPosicionMatriz
} from './mape-questions.js'

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
  vista: 'intro',
  ejeActual: 0,           // 0=financiero, 1=operativo
  respuestas: {},          // { 'financiero_1': { raw: '18', score: 75 }, ... }
  resultado: null,
  historial: [],
  saving: false
}

// ────────────────────────────────────────────────────────────────────────────
// SUPABASE
// ────────────────────────────────────────────────────────────────────────────

async function iniciarOReanudarEvaluacion(orgId) {
  const { data: evalId, error } = await supabase.rpc('mape_iniciar_evaluacion', {
    p_org_id: orgId
  })
  if (error) {
    console.error('[mape] iniciar error', error)
    return null
  }
  return evalId
}

async function loadRespuestasExistentes(evalId) {
  const { data, error } = await supabase
    .from('mape_respuestas')
    .select('indicador_codigo, raw_value, score_0_100')
    .eq('evaluacion_id', evalId)

  if (error) {
    console.error('[mape] load respuestas error', error)
    return {}
  }

  const map = {}
  ;(data || []).forEach(r => {
    map[r.indicador_codigo] = {
      raw: r.raw_value,
      score: r.score_0_100
    }
  })
  return map
}

async function loadHistorial(orgId) {
  const { data, error } = await supabase
    .from('mape_evaluaciones')
    .select('*')
    .eq('organizacion_id', orgId)
    .eq('usuario_id', state.profile?.id)
    .eq('estado', 'completada')
    .order('completada_en', { ascending: false })
    .limit(10)

  if (error) {
    console.error('[mape] historial error', error)
    return []
  }
  return data || []
}

async function guardarRespuesta(evalId, indicador, rawValue, score) {
  const { error } = await supabase
    .from('mape_respuestas')
    .upsert({
      evaluacion_id: evalId,
      indicador_codigo: indicador.codigo,
      eje: indicador.eje,
      tipo: indicador.tipo,
      raw_value: String(rawValue),
      score_0_100: Math.round(score),
      orden: indicador.orden
    }, { onConflict: 'evaluacion_id,indicador_codigo' })

  if (error) {
    console.error('[mape] guardar respuesta error', error)
    return false
  }
  return true
}

async function completarEvaluacion(evalId) {
  await supabase
    .from('mape_evaluaciones')
    .update({ cuestionario_version: MAPE_VERSION })
    .eq('id', evalId)

  const { data, error } = await supabase.rpc('mape_calcular_cuadrante', {
    p_evaluacion_id: evalId,
    p_min_indicadores: 12
  })

  if (error) {
    console.error('[mape] calcular cuadrante error', error)
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
  const total = MAPE_INDICADORES.length
  const respondidas = getRespuestasCount()
  return { total, respondidas, pct: Math.round((respondidas / total) * 100) }
}

function getEjeProgreso(ejeCodigo) {
  const indicadores = getIndicadoresByEje(ejeCodigo)
  const respondidos = indicadores.filter(i => state.respuestas[i.codigo] !== undefined).length
  return { total: indicadores.length, respondidos, completo: respondidos === indicadores.length }
}

function todasRespondidas() {
  return MAPE_INDICADORES.every(i => state.respuestas[i.codigo] !== undefined)
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
// INTRO
// ────────────────────────────────────────────────────────────────────────────

function renderIntro() {
  const wrap = $('#intro-historial')
  if (!wrap) return

  if (state.historial.length === 0) {
    wrap.style.display = 'none'
    return
  }

  wrap.style.display = 'flex'
  const ultima = state.historial[0]
  const cuad = MAPE_CUADRANTES[ultima.cuadrante]
  const fecha = new Date(ultima.completada_en).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  $('#hist-fecha').textContent = fecha
  $('#hist-cuadrante').textContent = cuad?.nombre || '-'
  $('#hist-puntajes').textContent = 'F: ' + ultima.puntaje_financiero + ' / O: ' + ultima.puntaje_operativo
  $('#hist-count').textContent = state.historial.length + ' evaluacion' + (state.historial.length !== 1 ? 'es' : '') + ' previa' + (state.historial.length !== 1 ? 's' : '')
}

// ────────────────────────────────────────────────────────────────────────────
// EVALUACION
// ────────────────────────────────────────────────────────────────────────────

function renderEval() {
  const eje = MAPE_EJES[state.ejeActual]
  const indicadores = getIndicadoresByEje(eje.codigo)
  const progreso = getProgreso()

  // Header
  $('#eval-eje-num').textContent = 'EJE ' + eje.numero + ' DE 2 - ' + eje.titulo.toUpperCase()
  $('#eval-eje-titulo').textContent = eje.pregunta
  $('#eval-eje-desc').textContent = eje.descripcion
  const iconEl = $('#eval-eje-icon')
  if (iconEl) {
    iconEl.innerHTML = '<i data-lucide="' + eje.icono + '"></i>'
  }

  // Progress
  $('#eval-progress-fill').style.width = progreso.pct + '%'
  $('#eval-progress-eje').textContent = (state.ejeActual + 1)
  $('#eval-progress-actual').textContent = eje.titulo
  $('#eval-progress-resp').textContent = progreso.respondidas
  $('#eval-progress-total').textContent = progreso.total

  // Preguntas
  const wrap = $('#eval-questions')
  wrap.innerHTML = indicadores.map(ind => renderIndicador(ind)).join('')

  // Listeners segun tipo
  attachListeners()

  // Navegacion
  const btnPrev = $('#eval-btn-prev')
  const btnNext = $('#eval-btn-next')

  btnPrev.disabled = state.ejeActual === 0
  btnPrev.style.visibility = state.ejeActual === 0 ? 'hidden' : 'visible'

  const esUltimoEje = state.ejeActual === MAPE_EJES.length - 1
  const ejeProg = getEjeProgreso(eje.codigo)

  if (esUltimoEje) {
    btnNext.innerHTML = '<span>Ver resultado</span><i data-lucide="sparkles"></i>'
    btnNext.disabled = !todasRespondidas()
  } else {
    const siguiente = MAPE_EJES[state.ejeActual + 1]
    btnNext.innerHTML = '<span>Siguiente eje: ' + siguiente.titulo + '</span><i data-lucide="arrow-right"></i>'
    btnNext.disabled = !ejeProg.completo
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

function renderIndicador(ind) {
  const respuesta = state.respuestas[ind.codigo]
  const rawValue = respuesta ? respuesta.raw : ''

  let bodyHtml = ''

  if (ind.tipo === 'likert') {
    const opciones = MAPE_ESCALA_LIKERT.map(e => {
      const selected = parseInt(rawValue) === e.valor ? 'selected' : ''
      return '<button type="button" class="eval-option ' + selected + '" data-codigo="' + ind.codigo + '" data-valor="' + e.valor + '">' +
        '<div class="eval-option-num">' + e.valor + '</div>' +
        '<div class="eval-option-label">' + escapeHtml(e.label) + '</div>' +
      '</button>'
    }).join('')
    bodyHtml = '<div class="eval-options">' + opciones + '</div>'

  } else if (ind.tipo === 'numerico') {
    bodyHtml = '<div class="eval-input-row">' +
      '<input type="number" class="eval-input-num" data-codigo="' + ind.codigo + '" ' +
        'placeholder="' + (ind.placeholder || '0') + '" value="' + escapeHtml(rawValue) + '" ' +
        (ind.min !== undefined ? 'min="' + ind.min + '" ' : '') +
        (ind.max !== undefined ? 'max="' + ind.max + '" ' : '') +
        'step="any" />' +
      '<span class="eval-input-suffix">' + escapeHtml(ind.suffix || '') + '</span>' +
    '</div>'
    if (ind.hint) {
      bodyHtml += '<div class="eval-hint">' + escapeHtml(ind.hint) + '</div>'
    }

  } else if (ind.tipo === 'selector') {
    const opciones = ind.opciones.map(o => {
      const selected = rawValue === o.codigo ? 'selected' : ''
      return '<button type="button" class="eval-button ' + selected + '" data-codigo="' + ind.codigo + '" data-opcion="' + o.codigo + '">' +
        escapeHtml(o.label) +
      '</button>'
    }).join('')
    bodyHtml = '<div class="eval-buttons">' + opciones + '</div>'
  }

  return '<div class="eval-question ' + ind.tipo + '" data-codigo="' + ind.codigo + '">' +
    '<div class="eval-question-text">' + escapeHtml(ind.texto) + '</div>' +
    bodyHtml +
  '</div>'
}

function attachListeners() {
  // Likert
  $$('.eval-question.likert .eval-option').forEach(btn => {
    btn.addEventListener('click', () => onLikertSelect(btn))
  })

  // Numerico (debounced)
  $$('.eval-question.numerico .eval-input-num').forEach(input => {
    let timeout = null
    input.addEventListener('input', () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => onNumericoChange(input), 600)
    })
    input.addEventListener('blur', () => {
      clearTimeout(timeout)
      onNumericoChange(input)
    })
  })

  // Selector
  $$('.eval-question.selector .eval-button').forEach(btn => {
    btn.addEventListener('click', () => onSelectorClick(btn))
  })
}

async function onLikertSelect(btn) {
  const codigo = btn.dataset.codigo
  const valor = parseInt(btn.dataset.valor)
  const ind = MAPE_INDICADORES.find(i => i.codigo === codigo)
  if (!ind) return

  // UI optimistic
  const wrap = btn.closest('.eval-options')
  wrap.querySelectorAll('.eval-option').forEach(o => o.classList.remove('selected'))
  btn.classList.add('selected')

  const score = normalizarRespuesta(ind, valor)
  state.respuestas[codigo] = { raw: String(valor), score }
  state.saving = true
  renderEval()

  const ok = await guardarRespuesta(state.evaluacionId, ind, valor, score)
  state.saving = false

  if (!ok) showToast('Error al guardar', 'error')
  renderEval()
}

async function onNumericoChange(input) {
  const codigo = input.dataset.codigo
  const valor = input.value.trim()
  const ind = MAPE_INDICADORES.find(i => i.codigo === codigo)
  if (!ind) return

  if (valor === '') {
    // No guardar vacios, removerlos del state
    if (state.respuestas[codigo]) {
      delete state.respuestas[codigo]
      renderEval()
    }
    return
  }

  const score = normalizarRespuesta(ind, valor)
  state.respuestas[codigo] = { raw: valor, score }
  state.saving = true
  renderEval()

  const ok = await guardarRespuesta(state.evaluacionId, ind, valor, score)
  state.saving = false

  if (!ok) showToast('Error al guardar', 'error')
  renderEval()
}

async function onSelectorClick(btn) {
  const codigo = btn.dataset.codigo
  const opcionCodigo = btn.dataset.opcion
  const ind = MAPE_INDICADORES.find(i => i.codigo === codigo)
  if (!ind) return

  const wrap = btn.closest('.eval-buttons')
  wrap.querySelectorAll('.eval-button').forEach(b => b.classList.remove('selected'))
  btn.classList.add('selected')

  const score = normalizarRespuesta(ind, opcionCodigo)
  state.respuestas[codigo] = { raw: opcionCodigo, score }
  state.saving = true
  renderEval()

  const ok = await guardarRespuesta(state.evaluacionId, ind, opcionCodigo, score)
  state.saving = false

  if (!ok) showToast('Error al guardar', 'error')
  renderEval()
}

function siguienteEje() {
  if (state.ejeActual < MAPE_EJES.length - 1) {
    state.ejeActual++
    renderEval()
  }
}

function anteriorEje() {
  if (state.ejeActual > 0) {
    state.ejeActual--
    renderEval()
  }
}

async function completar() {
  if (!todasRespondidas()) {
    showToast('Completa todos los indicadores', 'error')
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

  state.historial = await loadHistorial(state.org.id)
}

// ────────────────────────────────────────────────────────────────────────────
// RESULTADO
// ────────────────────────────────────────────────────────────────────────────

function renderResultado() {
  if (!state.resultado) return

  const r = state.resultado
  const cuad = MAPE_CUADRANTES[r.cuadrante] || MAPE_CUADRANTES.zona_estancamiento

  // Hero
  $('#result-cuadrante').textContent = cuad.nombre
  $('#result-puntaje-fin').textContent = r.puntaje_financiero + ' / 100'
  $('#result-puntaje-op').textContent = r.puntaje_operativo + ' / 100'
  $('#result-desc').textContent = cuad.descripcion_larga

  // Matriz con punto
  renderMatrizResultado(r.puntaje_financiero, r.puntaje_operativo, r.cuadrante)

  // Desglose por eje
  renderEjeBreakdown(r.puntaje_financiero, r.puntaje_operativo)

  // Recomendaciones
  renderRecomendaciones(cuad)

  if (window.lucide) lucide.createIcons()
}

function renderMatrizResultado(puntajeFin, puntajeOp, cuadranteActivo) {
  // Activar el cuadrante correspondiente
  $$('.matriz-result-cell').forEach(c => {
    c.classList.remove('active')
    const q = c.dataset.cuadrante
    if (q === cuadranteActivo) c.classList.add('active')
  })

  // Posicionar el punto
  const pos = getPosicionMatriz(puntajeFin, puntajeOp)
  const dot = $('#matriz-dot')
  if (dot) {
    dot.style.top = pos.top + '%'
    dot.style.left = pos.left + '%'
  }
}

function renderEjeBreakdown(puntajeFin, puntajeOp) {
  const wrap = $('#result-breakdown')
  const ejes = [
    {
      nombre: 'Crecimiento financiero',
      valor: puntajeFin,
      color: puntajeFin >= 70 ? 'green' : puntajeFin >= 50 ? 'amber' : 'red'
    },
    {
      nombre: 'Capacidad operativa',
      valor: puntajeOp,
      color: puntajeOp >= 70 ? 'green' : puntajeOp >= 50 ? 'amber' : 'red'
    }
  ]

  wrap.innerHTML = ejes.map(e =>
    '<div class="axis-block">' +
      '<div class="axis-block-header">' +
        '<span class="axis-block-name">' + e.nombre + '</span>' +
        '<span class="axis-block-value">' + e.valor + ' / 100</span>' +
      '</div>' +
      '<div class="axis-block-bar"><div class="axis-block-bar-fill ' + e.color + '" style="width:' + e.valor + '%"></div></div>' +
    '</div>'
  ).join('')
}

function renderRecomendaciones(cuad) {
  const wrap = $('#result-reco')
  let html = ''

  // Riesgo principal (si aplica) como warning
  if (cuad.riesgo_principal) {
    html += '<li class="reco-item warning">' +
      '<div class="reco-icon"><i data-lucide="alert-triangle"></i></div>' +
      '<div class="reco-text"><strong>Riesgo principal:</strong> ' + escapeHtml(cuad.riesgo_principal) + '</div>' +
    '</li>'
  }

  // Acciones del cuadrante
  cuad.acciones.forEach(accion => {
    html += '<li class="reco-item">' +
      '<div class="reco-icon"><i data-lucide="check"></i></div>' +
      '<div class="reco-text">' + escapeHtml(accion) + '</div>' +
    '</li>'
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

    const avatar = initials((profile?.nombre || '') + ' ' + (profile?.apellido || ''))
    $$('.user-avatar').forEach(el => el.textContent = avatar)

    state.historial = await loadHistorial(org.id)
    renderIntro()

    // Listeners
    $('#btn-empezar').addEventListener('click', async () => {
      const evalId = await iniciarOReanudarEvaluacion(org.id)
      if (!evalId) {
        showToast('Error al iniciar evaluacion', 'error')
        return
      }
      state.evaluacionId = evalId
      state.respuestas = await loadRespuestasExistentes(evalId)

      // Empezar en el primer eje incompleto
      let primero = 0
      for (let i = 0; i < MAPE_EJES.length; i++) {
        const prog = getEjeProgreso(MAPE_EJES[i].codigo)
        if (!prog.completo) { primero = i; break }
      }
      state.ejeActual = primero

      renderEval()
      cambiarVista('eval')
    })

    $('#eval-btn-prev').addEventListener('click', anteriorEje)
    $('#eval-btn-next').addEventListener('click', () => {
      const esUltimo = state.ejeActual === MAPE_EJES.length - 1
      if (esUltimo) completar()
      else siguienteEje()
    })

    $('#btn-volver-intro').addEventListener('click', () => {
      cambiarVista('intro')
      renderIntro()
    })

    $('#btn-nueva-eval').addEventListener('click', async () => {
      const { data, error } = await supabase
        .from('mape_evaluaciones')
        .insert({
          organizacion_id: org.id,
          usuario_id: profile.id,
          estado: 'en_progreso',
          cuestionario_version: MAPE_VERSION
        })
        .select('id')
        .single()

      if (error) {
        showToast('Error al crear nueva evaluacion', 'error')
        return
      }

      state.evaluacionId = data.id
      state.respuestas = {}
      state.ejeActual = 0
      state.resultado = null

      renderEval()
      cambiarVista('eval')
    })

    if (window.lucide) lucide.createIcons()

  } catch (err) {
    console.error('[mape] init error:', err)
  }
}

init()
