// ============================================================================
// SCALEx PORTAL - VECTOR TRIMESTRE - Detalle de un Round
// ============================================================================
// Pilar 3 - Vector
// URL: /portal/vector-trimestre.html?id=<trimestre-id>
// Componentes: titulo+desc editables / Factor X / Indicadores con mediciones
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

const ESTADO_LABELS = {
  pendiente: 'PENDIENTE',
  activo: 'EN CURSO',
  completado: 'COMPLETADO'
}

const SEMAFORO_LABELS = {
  verde_alto: 'VERDE ALTO',
  verde_bajo: 'VERDE BAJO',
  amarillo: 'AMARILLO',
  rojo: 'ROJO',
  sin_medir: 'SIN MEDIR'
}

let state = {
  org: null,
  profile: null,
  trimestreId: null,
  trimestre: null,
  vector: null,
  trimestresHermanos: [],   // todos los rounds del mismo vector (navegacion)
  factorX: null,
  indicadores: [],
  medicionesPorIndicador: {},  // { indicadorId: [mediciones...] }
  expandedIndicadores: {},     // { id: true/false }
  editingIndicador: null,
  saving: false
}

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function getTrimestreIdFromURL() {
  const params = new URLSearchParams(window.location.search)
  return params.get('id')
}

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

function formatFechaMini(d) {
  if (!d) return ''
  const date = new Date(d + 'T12:00:00')
  return date.getDate() + ' ' + MESES_ES[date.getMonth()]
}

function calcularSemanaDelAnio(fechaStr) {
  if (!fechaStr) return null
  const date = new Date(fechaStr + 'T12:00:00')
  const start = new Date(date.getFullYear(), 0, 1)
  const diff = (date - start) / (1000 * 60 * 60 * 24)
  return 'sem ' + Math.ceil((diff + start.getDay() + 1) / 7)
}

// Calcular el semáforo en JS antes de guardar
function calcularSemaforo(valor, umbrales, direccion) {
  const v = parseFloat(valor)
  if (isNaN(v)) return 'rojo'

  const va = parseFloat(umbrales.verde_alto)
  const vb = parseFloat(umbrales.verde_bajo)
  const am = parseFloat(umbrales.amarillo)

  if (direccion === 'mayor_es_mejor') {
    if (v >= va) return 'verde_alto'
    if (v >= vb) return 'verde_bajo'
    if (v >= am) return 'amarillo'
    return 'rojo'
  } else {
    // menor_es_mejor
    if (v <= va) return 'verde_alto'
    if (v <= vb) return 'verde_bajo'
    if (v <= am) return 'amarillo'
    return 'rojo'
  }
}

function getSemaforoActual(indicadorId) {
  const mediciones = state.medicionesPorIndicador[indicadorId]
  if (!mediciones || mediciones.length === 0) return 'sin_medir'
  return mediciones[0].semaforo  // la primera es la más reciente
}

function getValorActual(indicadorId) {
  const mediciones = state.medicionesPorIndicador[indicadorId]
  if (!mediciones || mediciones.length === 0) return null
  return mediciones[0]
}

// ────────────────────────────────────────────────────────────────────────────
// SUPABASE - LOADS
// ────────────────────────────────────────────────────────────────────────────

async function loadTrimestre(trimestreId) {
  const { data, error } = await supabase
    .from('vector_trimestres')
    .select('*, vector_estrategicos(id, meta, nombre, fecha_inicio)')
    .eq('id', trimestreId)
    .single()

  if (error) {
    console.error('[trim] load error', error)
    return null
  }
  return data
}

async function loadTrimestresHermanos(vectorId) {
  const { data, error } = await supabase
    .from('vector_trimestres')
    .select('id, numero, titulo, estado')
    .eq('vector_id', vectorId)
    .order('numero', { ascending: true })

  if (error) return []
  return data || []
}

async function loadFactorX(trimestreId) {
  const { data, error } = await supabase
    .from('vector_factor_x')
    .select('*')
    .eq('trimestre_id', trimestreId)
    .maybeSingle()

  if (error) {
    console.error('[factorx] load error', error)
    return null
  }
  return data
}

async function loadIndicadores(trimestreId) {
  const { data, error } = await supabase
    .from('vector_indicadores_criticos')
    .select('*')
    .eq('trimestre_id', trimestreId)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[ind] load error', error)
    return []
  }
  return data || []
}

async function loadMediciones(indicadorIds) {
  if (indicadorIds.length === 0) return {}

  const { data, error } = await supabase
    .from('vector_mediciones')
    .select('*')
    .in('indicador_id', indicadorIds)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[med] load error', error)
    return {}
  }

  const map = {}
  ;(data || []).forEach(m => {
    if (!map[m.indicador_id]) map[m.indicador_id] = []
    map[m.indicador_id].push(m)
  })
  return map
}

// ────────────────────────────────────────────────────────────────────────────
// SUPABASE - WRITES
// ────────────────────────────────────────────────────────────────────────────

async function actualizarTrimestre(payload) {
  const { error } = await supabase
    .from('vector_trimestres')
    .update(payload)
    .eq('id', state.trimestreId)
  return !error
}

async function upsertFactorX(payload) {
  // Buscar si existe
  if (state.factorX) {
    const { data, error } = await supabase
      .from('vector_factor_x')
      .update(payload)
      .eq('id', state.factorX.id)
      .select('*')
      .single()
    if (error) { console.error('[factorx] update', error); return null }
    return data
  } else {
    const { data, error } = await supabase
      .from('vector_factor_x')
      .insert({
        ...payload,
        trimestre_id: state.trimestreId,
        organizacion_id: state.org.id
      })
      .select('*')
      .single()
    if (error) { console.error('[factorx] insert', error); return null }
    return data
  }
}

async function crearIndicador(payload) {
  const { data, error } = await supabase
    .from('vector_indicadores_criticos')
    .insert({
      ...payload,
      trimestre_id: state.trimestreId,
      organizacion_id: state.org.id
    })
    .select('*')
    .single()
  if (error) { console.error('[ind] crear', error); return null }
  return data
}

async function actualizarIndicador(id, payload) {
  const { data, error } = await supabase
    .from('vector_indicadores_criticos')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) { console.error('[ind] update', error); return null }
  return data
}

async function eliminarIndicador(id) {
  const { error } = await supabase
    .from('vector_indicadores_criticos')
    .delete()
    .eq('id', id)
  return !error
}

async function crearMedicion(payload) {
  const { data, error } = await supabase
    .from('vector_mediciones')
    .insert({
      ...payload,
      organizacion_id: state.org.id,
      capturado_por: state.profile.id
    })
    .select('*')
    .single()
  if (error) { console.error('[med] crear', error); return null }
  return data
}

async function eliminarMedicion(id) {
  const { error } = await supabase
    .from('vector_mediciones')
    .delete()
    .eq('id', id)
  return !error
}

// ────────────────────────────────────────────────────────────────────────────
// RENDER HERO
// ────────────────────────────────────────────────────────────────────────────

function renderHero() {
  const t = state.trimestre
  const v = state.vector

  $('#hero-round-num').textContent = 'ROUND ' + t.numero + ' · Q' + t.trimestre_anio + ' ' +
    new Date(t.fecha_inicio + 'T12:00:00').getFullYear()
  $('#hero-fechas').textContent = formatFechaCorta(t.fecha_inicio) + ' – ' + formatFechaCorta(t.fecha_fin)

  const estadoBadge = $('#hero-estado-badge')
  estadoBadge.textContent = ESTADO_LABELS[t.estado] || t.estado
  estadoBadge.className = 'round-hero-estado-badge estado-' + t.estado

  // Title editable
  $('#hero-titulo').value = t.titulo || ''
  $('#hero-titulo').placeholder = 'Define el título de este round (ej: Atraer nuevos clientes)'

  // Descripción editable
  $('#hero-descripcion').value = t.descripcion || ''
  $('#hero-descripcion').placeholder = 'Describe la temática y enfoque de este trimestre...'

  // Botones de navegación entre rounds
  const idx = state.trimestresHermanos.findIndex(h => h.id === state.trimestreId)
  const prev = idx > 0 ? state.trimestresHermanos[idx - 1] : null
  const next = idx < state.trimestresHermanos.length - 1 ? state.trimestresHermanos[idx + 1] : null

  const btnPrev = $('#btn-nav-prev')
  const btnNext = $('#btn-nav-next')

  if (prev) {
    btnPrev.style.display = 'inline-flex'
    btnPrev.href = '/portal/vector-trimestre.html?id=' + prev.id
    $('#btn-nav-prev-label').textContent = 'R' + prev.numero
  } else {
    btnPrev.style.display = 'none'
  }

  if (next) {
    btnNext.style.display = 'inline-flex'
    btnNext.href = '/portal/vector-trimestre.html?id=' + next.id
    $('#btn-nav-next-label').textContent = 'R' + next.numero
  } else {
    btnNext.style.display = 'none'
  }

  // Link al tablero
  $('#link-tablero').href = '/portal/vector-norte.html'

  if (window.lucide) lucide.createIcons()
}

// Auto-save de título y descripción
function setupHeroAutoSave() {
  let timTitulo
  $('#hero-titulo').addEventListener('input', () => {
    clearTimeout(timTitulo)
    timTitulo = setTimeout(async () => {
      const titulo = $('#hero-titulo').value.trim() || null
      const ok = await actualizarTrimestre({ titulo })
      if (ok) showToast('Título guardado', 'success')
    }, 800)
  })

  let timDesc
  $('#hero-descripcion').addEventListener('input', () => {
    clearTimeout(timDesc)
    timDesc = setTimeout(async () => {
      const descripcion = $('#hero-descripcion').value.trim() || null
      const ok = await actualizarTrimestre({ descripcion })
      if (ok) showToast('Descripción guardada', 'success')
    }, 1200)
  })
}

// ────────────────────────────────────────────────────────────────────────────
// RENDER FACTOR X
// ────────────────────────────────────────────────────────────────────────────

function renderFactorX() {
  $('#factorx-complemento').value = state.factorX?.complemento || ''
  $('#factorx-meta').value = state.factorX?.meta_descripcion || ''
  $('#factorx-resultado').value = state.factorX?.resultado_real || ''
}

function setupFactorXAutoSave() {
  let timComp
  $('#factorx-complemento').addEventListener('input', () => {
    clearTimeout(timComp)
    timComp = setTimeout(saveFactorX, 800)
  })

  let timMeta
  $('#factorx-meta').addEventListener('input', () => {
    clearTimeout(timMeta)
    timMeta = setTimeout(saveFactorX, 1000)
  })

  let timRes
  $('#factorx-resultado').addEventListener('input', () => {
    clearTimeout(timRes)
    timRes = setTimeout(saveFactorX, 1000)
  })
}

async function saveFactorX() {
  const complemento = $('#factorx-complemento').value.trim()
  const meta = $('#factorx-meta').value.trim() || null
  const resultado = $('#factorx-resultado').value.trim() || null

  if (!complemento) {
    // Si no hay complemento y existe registro, no borramos automáticamente
    // (mejor pedir explícitamente). Por ahora, ignoramos guardar.
    return
  }

  const payload = {
    complemento,
    meta_descripcion: meta,
    resultado_real: resultado
  }

  const result = await upsertFactorX(payload)
  if (result) {
    state.factorX = result
    showToast('Factor X guardado', 'success')
  }
}

// ────────────────────────────────────────────────────────────────────────────
// RENDER INDICADORES
// ────────────────────────────────────────────────────────────────────────────

function renderIndicadores() {
  const wrap = $('#indicadores-wrap')

  if (state.indicadores.length === 0) {
    wrap.innerHTML = '<div class="indicadores-empty">' +
      '<i data-lucide="activity"></i>' +
      '<p>Aún no has definido indicadores críticos para este round.</p>' +
      '<p class="hint">Los indicadores son las métricas semanales o mensuales que sostienen tu Factor X.</p>' +
    '</div>'
    renderBtnAdd()
    if (window.lucide) lucide.createIcons()
    return
  }

  wrap.innerHTML = state.indicadores.map(ind => renderIndicadorCard(ind)).join('')
  attachIndicadorListeners()
  renderBtnAdd()
  if (window.lucide) lucide.createIcons()
}

function renderIndicadorCard(ind) {
  const semaforo = getSemaforoActual(ind.id)
  const valorActual = getValorActual(ind.id)
  const expanded = state.expandedIndicadores[ind.id]
  const mediciones = state.medicionesPorIndicador[ind.id] || []

  let cls = 'indicador-card semaforo-' + semaforo.replace('_', '-')
  if (expanded) cls += ' expanded'

  const valorDisplay = valorActual ? valorActual.valor : '—'
  const fechaDisplay = valorActual ? 'Última: ' + valorDisplay + ' (' + formatFechaMini(valorActual.fecha) + ')' : 'Primera medición pendiente'

  let html = '<div class="' + cls + '" data-id="' + ind.id + '">' +
    '<div class="indicador-head" data-action="toggle" data-id="' + ind.id + '">' +
      '<div class="indicador-semaforo-big">' +
        '<span class="indicador-semaforo-num">' + valorDisplay + '</span>' +
      '</div>' +
      '<div class="indicador-body">' +
        '<div class="indicador-titulo">' + escapeHtml(ind.nombre) + '</div>' +
        '<div class="indicador-meta-line">' +
          (ind.responsable_nombre ? '<span class="indicador-meta-pill"><i data-lucide="user"></i>' + escapeHtml(ind.responsable_nombre) + '</span>' : '') +
          '<span class="indicador-meta-pill"><i data-lucide="repeat"></i>' + (ind.frecuencia === 'diaria' ? 'Diaria' : ind.frecuencia === 'mensual' ? 'Mensual' : 'Semanal') + '</span>' +
          '<span class="indicador-meta-pill"><i data-lucide="' + (ind.direccion === 'mayor_es_mejor' ? 'trending-up' : 'trending-down') + '"></i>' + (ind.direccion === 'mayor_es_mejor' ? 'Mayor es mejor' : 'Menor es mejor') + '</span>' +
          (ind.unidad ? '<span class="indicador-meta-pill"><i data-lucide="hash"></i>' + escapeHtml(ind.unidad) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="indicador-estado">' +
        '<span class="indicador-estado-label">' + SEMAFORO_LABELS[semaforo] + '</span>' +
        '<span class="indicador-estado-sub">' + fechaDisplay + '</span>' +
      '</div>' +
      '<button class="indicador-chevron" data-action="toggle" data-id="' + ind.id + '"><i data-lucide="chevron-down"></i></button>' +
    '</div>' +
    '<div class="indicador-content">' +
      '<div class="indicador-content-inner">' +
        renderUmbralesBlock(ind) +
        renderMedicionesBlock(ind, mediciones) +
      '</div>' +
      '<div class="indicador-content-actions">' +
        '<button class="btn-mini" data-action="edit" data-id="' + ind.id + '"><i data-lucide="edit-2"></i>Editar</button>' +
        '<button class="btn-mini danger" data-action="delete" data-id="' + ind.id + '"><i data-lucide="trash-2"></i>Eliminar</button>' +
      '</div>' +
    '</div>' +
  '</div>'

  return html
}

function renderUmbralesBlock(ind) {
  const u = ind.umbrales || {}
  const dirSimbolo = ind.direccion === 'mayor_es_mejor' ? '≥' : '≤'
  const unidad = ind.unidad ? ' ' + ind.unidad : ''

  return '<div class="umbrales-block">' +
    '<div class="block-title">Umbrales</div>' +
    '<div class="umbrales-list">' +
      '<div class="umbral-row verde-alto"><div class="umbral-label"><div class="umbral-dot"></div>Verde alto</div><div class="umbral-value">' + dirSimbolo + ' ' + u.verde_alto + unidad + '</div></div>' +
      '<div class="umbral-row verde-bajo"><div class="umbral-label"><div class="umbral-dot"></div>Verde bajo</div><div class="umbral-value">' + dirSimbolo + ' ' + u.verde_bajo + unidad + '</div></div>' +
      '<div class="umbral-row amarillo"><div class="umbral-label"><div class="umbral-dot"></div>Amarillo</div><div class="umbral-value">' + dirSimbolo + ' ' + u.amarillo + unidad + '</div></div>' +
      '<div class="umbral-row rojo"><div class="umbral-label"><div class="umbral-dot"></div>Rojo</div><div class="umbral-value">' + (ind.direccion === 'mayor_es_mejor' ? '<' : '>') + ' ' + u.amarillo + unidad + '</div></div>' +
    '</div>' +
  '</div>'
}

function renderMedicionesBlock(ind, mediciones) {
  let html = '<div class="mediciones-block">' +
    '<div class="block-title">Mediciones recientes</div>' +
    '<div class="mediciones-add" data-stop>' +
      '<input type="number" step="any" class="mediciones-input" data-id="' + ind.id + '" placeholder="Nuevo valor" />' +
      '<input type="date" class="mediciones-fecha" data-id="' + ind.id + '" value="' + new Date().toISOString().split('T')[0] + '" />' +
      '<button class="btn-add-medicion" data-action="add-medicion" data-id="' + ind.id + '"><i data-lucide="plus"></i>Registrar</button>' +
    '</div>'

  if (mediciones.length === 0) {
    html += '<div class="mediciones-empty">Sin mediciones aún</div>'
  } else {
    html += '<div class="mediciones-list">'
    mediciones.slice(0, 10).forEach(m => {
      html += '<div class="medicion-row">' +
        '<div class="medicion-dot ' + m.semaforo.replace('_', '-') + '"></div>' +
        '<div class="medicion-fecha">' + formatFechaMini(m.fecha) + ' <span class="medicion-fecha-sub">(' + calcularSemanaDelAnio(m.fecha) + ')</span></div>' +
        '<div class="medicion-valor">' + m.valor + '</div>' +
        '<button class="medicion-del" data-action="del-medicion" data-id="' + m.id + '" data-stop><i data-lucide="trash-2"></i></button>' +
      '</div>'
    })
    html += '</div>'

    if (mediciones.length > 10) {
      html += '<div class="mediciones-mas">+ ' + (mediciones.length - 10) + ' mediciones anteriores</div>'
    }
  }

  html += '</div>'
  return html
}

function renderBtnAdd() {
  const wrap = $('#indicadores-wrap')
  // Remover botón existente si está
  const existente = wrap.querySelector('.btn-add-indicador')
  if (existente) existente.remove()

  const btn = document.createElement('button')
  btn.className = 'btn-add-indicador'
  btn.innerHTML = '<i data-lucide="plus"></i><span>Agregar indicador crítico</span>'
  btn.addEventListener('click', () => openIndicadorModal(null))
  wrap.appendChild(btn)
}

function attachIndicadorListeners() {
  $$('[data-action="toggle"]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-stop]')) return
      if (e.target.closest('[data-action]') && e.target.closest('[data-action]') !== el) return
      const action = el.dataset.action
      if (action === 'toggle') {
        const id = el.dataset.id
        state.expandedIndicadores[id] = !state.expandedIndicadores[id]
        renderIndicadores()
      }
    })
  })

  $$('[data-action="edit"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      const ind = state.indicadores.find(i => i.id === el.dataset.id)
      if (ind) openIndicadorModal(ind)
    })
  })

  $$('[data-action="delete"]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation()
      const ind = state.indicadores.find(i => i.id === el.dataset.id)
      if (!ind) return
      if (!confirm('Eliminar "' + ind.nombre + '"? Se borrarán también todas sus mediciones.')) return

      const ok = await eliminarIndicador(el.dataset.id)
      if (ok) {
        state.indicadores = state.indicadores.filter(i => i.id !== el.dataset.id)
        delete state.medicionesPorIndicador[el.dataset.id]
        renderIndicadores()
        showToast('Indicador eliminado', 'success')
      } else {
        showToast('Error al eliminar', 'error')
      }
    })
  })

  $$('[data-action="add-medicion"]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation()
      await onAddMedicion(el.dataset.id)
    })
  })

  $$('[data-action="del-medicion"]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation()
      if (!confirm('Eliminar esta medición?')) return
      const ok = await eliminarMedicion(el.dataset.id)
      if (ok) {
        // Buscar y remover de state
        for (const indId in state.medicionesPorIndicador) {
          state.medicionesPorIndicador[indId] = state.medicionesPorIndicador[indId].filter(m => m.id !== el.dataset.id)
        }
        renderIndicadores()
        showToast('Medición eliminada', 'success')
      } else {
        showToast('Error al eliminar', 'error')
      }
    })
  })

  // Enter en mediciones input registra
  $$('.mediciones-input').forEach(el => {
    el.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onAddMedicion(el.dataset.id)
      }
    })
  })
}

async function onAddMedicion(indicadorId) {
  const input = document.querySelector('.mediciones-input[data-id="' + indicadorId + '"]')
  const fechaInput = document.querySelector('.mediciones-fecha[data-id="' + indicadorId + '"]')

  const valor = parseFloat(input.value)
  const fecha = fechaInput.value || new Date().toISOString().split('T')[0]

  if (isNaN(valor)) {
    showToast('Ingresa un número válido', 'error')
    input.focus()
    return
  }

  const ind = state.indicadores.find(i => i.id === indicadorId)
  if (!ind) return

  const semaforo = calcularSemaforo(valor, ind.umbrales, ind.direccion)

  const medicion = await crearMedicion({
    indicador_id: indicadorId,
    valor: valor,
    semaforo: semaforo,
    fecha: fecha
  })

  if (!medicion) {
    showToast('Error al registrar', 'error')
    return
  }

  // Agregar a state (al inicio = más reciente)
  if (!state.medicionesPorIndicador[indicadorId]) {
    state.medicionesPorIndicador[indicadorId] = []
  }
  state.medicionesPorIndicador[indicadorId].unshift(medicion)
  // Re-ordenar por fecha
  state.medicionesPorIndicador[indicadorId].sort((a, b) => {
    if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha)
    return b.created_at.localeCompare(a.created_at)
  })

  input.value = ''
  renderIndicadores()
  showToast('Medición registrada · ' + SEMAFORO_LABELS[semaforo], 'success')
}

// ────────────────────────────────────────────────────────────────────────────
// MODAL INDICADOR
// ────────────────────────────────────────────────────────────────────────────

function openIndicadorModal(indicador) {
  state.editingIndicador = indicador

  $('#modal-titulo').textContent = indicador ? 'Editar indicador' : 'Nuevo indicador crítico'
  $('#modal-submit-text').textContent = indicador ? 'Guardar cambios' : 'Crear indicador'

  $('#ind-nombre').value = indicador?.nombre || ''
  $('#ind-responsable').value = indicador?.responsable_nombre || ''
  $('#ind-frecuencia').value = indicador?.frecuencia || 'semanal'
  $('#ind-direccion').value = indicador?.direccion || 'mayor_es_mejor'
  $('#ind-unidad').value = indicador?.unidad || ''

  const u = indicador?.umbrales || {}
  $('#ind-verde-alto').value = u.verde_alto ?? ''
  $('#ind-verde-bajo').value = u.verde_bajo ?? ''
  $('#ind-amarillo').value = u.amarillo ?? ''
  $('#ind-rojo').value = u.rojo ?? ''

  $('#modal-backdrop').classList.add('active')
  setTimeout(() => {
    $('#ind-nombre').focus()
    if (window.lucide) lucide.createIcons()
  }, 50)
}

function closeModal() {
  $('#modal-backdrop').classList.remove('active')
  state.editingIndicador = null
}

async function submitIndicador(e) {
  e.preventDefault()

  const nombre = $('#ind-nombre').value.trim()
  if (!nombre) {
    showToast('El nombre es obligatorio', 'error')
    $('#ind-nombre').focus()
    return
  }

  const verdAlto = parseFloat($('#ind-verde-alto').value)
  const verdBajo = parseFloat($('#ind-verde-bajo').value)
  const amarillo = parseFloat($('#ind-amarillo').value)
  const rojo = parseFloat($('#ind-rojo').value)

  if (isNaN(verdAlto) || isNaN(verdBajo) || isNaN(amarillo) || isNaN(rojo)) {
    showToast('Define los 4 umbrales del semáforo', 'error')
    return
  }

  const direccion = $('#ind-direccion').value

  // Validacion de orden segun direccion
  if (direccion === 'mayor_es_mejor') {
    if (!(verdAlto >= verdBajo && verdBajo >= amarillo && amarillo >= rojo)) {
      showToast('En "mayor es mejor": verde alto ≥ verde bajo ≥ amarillo ≥ rojo', 'error')
      return
    }
  } else {
    if (!(verdAlto <= verdBajo && verdBajo <= amarillo && amarillo <= rojo)) {
      showToast('En "menor es mejor": verde alto ≤ verde bajo ≤ amarillo ≤ rojo', 'error')
      return
    }
  }

  const payload = {
    nombre: nombre,
    responsable_nombre: $('#ind-responsable').value.trim() || null,
    frecuencia: $('#ind-frecuencia').value,
    direccion: direccion,
    unidad: $('#ind-unidad').value.trim() || null,
    umbrales: {
      verde_alto: verdAlto,
      verde_bajo: verdBajo,
      amarillo: amarillo,
      rojo: rojo
    }
  }

  const btn = $('#modal-submit-btn')
  btn.disabled = true

  let result
  if (state.editingIndicador) {
    result = await actualizarIndicador(state.editingIndicador.id, payload)
    if (result) {
      const idx = state.indicadores.findIndex(i => i.id === state.editingIndicador.id)
      if (idx >= 0) state.indicadores[idx] = result
    }
  } else {
    result = await crearIndicador({ ...payload, orden: state.indicadores.length })
    if (result) {
      state.indicadores.push(result)
      state.medicionesPorIndicador[result.id] = []
      state.expandedIndicadores[result.id] = true
    }
  }

  btn.disabled = false

  if (!result) {
    showToast('Error al guardar', 'error')
    return
  }

  closeModal()
  renderIndicadores()
  showToast(state.editingIndicador ? 'Indicador actualizado' : 'Indicador creado', 'success')
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
window.closeModal = closeModal

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────

async function init() {
  state.trimestreId = getTrimestreIdFromURL()

  if (!state.trimestreId) {
    $('.content').innerHTML = '<div class="empty-state-big"><h2>Trimestre no encontrado</h2><p style="margin-top:8px"><a href="/portal/vector-norte.html" style="color:var(--teal)">Volver al tablero</a></p></div>'
    return
  }

  try {
    const [profile, org] = await Promise.all([getMyProfile(), getMyOrganization()])
    state.profile = profile
    state.org = org

    if (!org) {
      $('.content').innerHTML = '<div class="empty-state-big"><h2>Sin organización asignada</h2></div>'
      return
    }

    // Cargar el trimestre
    state.trimestre = await loadTrimestre(state.trimestreId)
    if (!state.trimestre) {
      $('.content').innerHTML = '<div class="empty-state-big"><h2>Trimestre no encontrado</h2><p style="margin-top:8px"><a href="/portal/vector-norte.html" style="color:var(--teal)">Volver al tablero</a></p></div>'
      return
    }

    state.vector = state.trimestre.vector_estrategicos

    // Cargar hermanos (para navegación)
    state.trimestresHermanos = await loadTrimestresHermanos(state.vector.id)

    // Cargar Factor X
    state.factorX = await loadFactorX(state.trimestreId)

    // Cargar indicadores
    state.indicadores = await loadIndicadores(state.trimestreId)

    // Cargar mediciones de todos los indicadores
    state.medicionesPorIndicador = await loadMediciones(state.indicadores.map(i => i.id))

    // Mostrar contenido
    $('#view-loading').classList.remove('active')
    $('#view-main').classList.add('active')

    renderHero()
    renderFactorX()
    renderIndicadores()

    // Setup autosave
    setupHeroAutoSave()
    setupFactorXAutoSave()

    // Modal
    $('#modal-form')?.addEventListener('submit', submitIndicador)
    $('#modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') closeModal()
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#modal-backdrop').classList.contains('active')) {
        closeModal()
      }
    })

    if (window.lucide) lucide.createIcons()

  } catch (err) {
    console.error('[vector-trimestre] init error:', err)
  }
}

init()
