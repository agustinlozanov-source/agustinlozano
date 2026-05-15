// ============================================================================
// SCALEx PORTAL - RITMO · RITUAL SEMANAL - Setup + La semana + Historial
// ============================================================================
// Pilar 4 - Ritmo · Herramienta 1
// Vistas: loading / setup (no hay semanas generadas) / semana (en curso) / historial
// Depende de: scalex-sql-13-ritmo-semanas.sql
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
const DIAS_SEMANA = [
  { v: 1, label: 'Lunes' },
  { v: 2, label: 'Martes' },
  { v: 3, label: 'Miércoles' },
  { v: 4, label: 'Jueves' },
  { v: 5, label: 'Viernes' },
  { v: 6, label: 'Sábado' },
  { v: 7, label: 'Domingo' }
]

let state = {
  org: null,
  profile: null,
  config: null,            // ritmo_config
  vector: null,            // vector activo (puede ser null)
  semanaActual: null,      // la semana en curso (ritmo_semanas)
  tareas: [],              // tareas de la semana actual
  historial: [],           // semanas pasadas
  filtroTareas: 'todas',   // todas | plan | impulso
  vista: 'loading'         // loading | setup | semana | historial
}

// ────────────────────────────────────────────────────────────────────────────
// SUPABASE - LOADS
// ────────────────────────────────────────────────────────────────────────────

async function loadConfig(orgId) {
  const { data, error } = await supabase
    .from('ritmo_config')
    .select('*')
    .eq('organizacion_id', orgId)
    .maybeSingle()
  if (error) {
    console.error('[ritmo] load config error', error)
    return null
  }
  return data
}

async function loadVectorActivo(orgId) {
  const { data, error } = await supabase
    .from('vector_estrategicos')
    .select('id, meta, nombre, fecha_inicio, fecha_fin')
    .eq('organizacion_id', orgId)
    .eq('estado', 'activo')
    .maybeSingle()
  if (error) {
    console.error('[ritmo] load vector error', error)
    return null
  }
  return data
}

async function loadSemanaEnCurso(orgId) {
  const { data, error } = await supabase
    .rpc('ritmo_semana_en_curso', { p_organizacion_id: orgId })
  if (error) {
    console.error('[ritmo] semana en curso error', error)
    return null
  }
  // la RPC devuelve un row (o null)
  if (Array.isArray(data)) return data[0] || null
  return data || null
}

async function loadSemanaConRound(semanaId) {
  // Trae la semana + datos del round del Vector (si está vinculada)
  const { data, error } = await supabase
    .from('ritmo_semanas')
    .select('*, vector_trimestres(numero, anio, trimestre_anio)')
    .eq('id', semanaId)
    .single()
  if (error) {
    console.error('[ritmo] load semana error', error)
    return null
  }
  return data
}

async function loadTareas(semanaId) {
  const { data, error } = await supabase
    .from('ritmo_tareas')
    .select('*')
    .eq('semana_id', semanaId)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    console.error('[ritmo] load tareas error', error)
    return []
  }
  return data || []
}

async function loadHistorial(orgId, exceptoId) {
  let query = supabase
    .from('ritmo_semanas')
    .select('id, numero_ronda, fecha_inicio, fecha_fin, objetivo, estado, cruza_de_mes')
    .eq('organizacion_id', orgId)
    .order('numero_ronda', { ascending: false })
    .limit(30)
  const { data, error } = await query
  if (error) {
    console.error('[ritmo] load historial error', error)
    return []
  }
  return (data || []).filter(s => s.id !== exceptoId)
}

// Conteo de tareas hechas/total por semana (para el historial)
async function loadConteoTareas(semanaIds) {
  if (!semanaIds.length) return {}
  const { data, error } = await supabase
    .from('ritmo_tareas')
    .select('semana_id, completada')
    .in('semana_id', semanaIds)
  if (error) {
    console.error('[ritmo] conteo tareas error', error)
    return {}
  }
  const conteo = {}
  for (const t of (data || [])) {
    if (!conteo[t.semana_id]) conteo[t.semana_id] = { total: 0, hechas: 0 }
    conteo[t.semana_id].total++
    if (t.completada) conteo[t.semana_id].hechas++
  }
  return conteo
}

// ────────────────────────────────────────────────────────────────────────────
// SUPABASE - WRITES
// ────────────────────────────────────────────────────────────────────────────

async function guardarConfig(orgId, diaInicio) {
  const { data, error } = await supabase
    .from('ritmo_config')
    .upsert({ organizacion_id: orgId, dia_inicio_semana: diaInicio })
    .select('*')
    .single()
  if (error) {
    console.error('[ritmo] guardar config error', error)
    return null
  }
  return data
}

async function generarSemanas(orgId, desde, hasta, vectorId) {
  const { data, error } = await supabase.rpc('ritmo_generar_semanas', {
    p_organizacion_id: orgId,
    p_fecha_desde: desde,
    p_fecha_hasta: hasta,
    p_vector_id: vectorId || null
  })
  if (error) {
    console.error('[ritmo] generar semanas error', error)
    return { error }
  }
  return { creadas: data }
}

async function guardarRitual(semanaId, payload) {
  const { data, error } = await supabase
    .from('ritmo_semanas')
    .update(payload)
    .eq('id', semanaId)
    .select('*')
    .single()
  if (error) {
    console.error('[ritmo] guardar ritual error', error)
    return null
  }
  return data
}

async function crearTarea(payload) {
  const { data, error } = await supabase
    .from('ritmo_tareas')
    .insert(payload)
    .select('*')
    .single()
  if (error) {
    console.error('[ritmo] crear tarea error', error)
    return null
  }
  return data
}

async function toggleTarea(tareaId, completada) {
  const { data, error } = await supabase
    .from('ritmo_tareas')
    .update({ completada })
    .eq('id', tareaId)
    .select('*')
    .single()
  if (error) {
    console.error('[ritmo] toggle tarea error', error)
    return null
  }
  return data
}

async function eliminarTarea(tareaId) {
  const { error } = await supabase
    .from('ritmo_tareas')
    .delete()
    .eq('id', tareaId)
  if (error) {
    console.error('[ritmo] eliminar tarea error', error)
    return false
  }
  return true
}

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fechaCorta(d) {
  if (!d) return ''
  const date = new Date(d + 'T12:00:00')
  return date.getDate() + ' ' + MESES_ES[date.getMonth()]
}

function fechaLarga(d) {
  if (!d) return ''
  const date = new Date(d + 'T12:00:00')
  return date.getDate() + ' ' + MESES_ES[date.getMonth()] + ' ' + date.getFullYear()
}

function hoyISO() {
  return new Date().toISOString().split('T')[0]
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

function showToast(msg, tipo) {
  const t = $('#toast')
  if (!t) return
  t.textContent = msg
  t.className = 'toast show' + (tipo ? ' ' + tipo : '')
  setTimeout(() => { t.className = 'toast' }, 2800)
}

// debounce simple para auto-guardado
function debounce(fn, ms) {
  let timer = null
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: SETUP
// ────────────────────────────────────────────────────────────────────────────

function initSetup() {
  // Poblar el selector de día de inicio de semana
  const sel = $('#setup-dia-inicio')
  if (sel) {
    sel.innerHTML = DIAS_SEMANA.map(d =>
      '<option value="' + d.v + '"' + (d.v === 1 ? ' selected' : '') + '>' + d.label + '</option>'
    ).join('')
  }

  // Si hay vector activo, mostramos sus fechas y prellenamos
  if (state.vector) {
    $('#setup-con-vector').style.display = 'block'
    $('#setup-sin-vector').style.display = 'none'
    $('#setup-vector-meta').textContent = state.vector.meta
    $('#setup-vector-fechas').textContent =
      fechaLarga(state.vector.fecha_inicio) + ' → ' + fechaLarga(state.vector.fecha_fin)
    $('#setup-desde').value = state.vector.fecha_inicio
    $('#setup-hasta').value = state.vector.fecha_fin
  } else {
    $('#setup-con-vector').style.display = 'none'
    $('#setup-sin-vector').style.display = 'block'
    // default: desde hoy, 1 año adelante
    const hoy = new Date()
    const enUnAnio = new Date(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate())
    $('#setup-desde').value = hoy.toISOString().split('T')[0]
    $('#setup-hasta').value = enUnAnio.toISOString().split('T')[0]
  }

  $('#btn-generar-semanas')?.addEventListener('click', onGenerarSemanas)
}

async function onGenerarSemanas() {
  const desde = $('#setup-desde').value
  const hasta = $('#setup-hasta').value
  const diaInicio = parseInt($('#setup-dia-inicio').value, 10)

  if (!desde || !hasta) {
    showToast('Define las fechas de inicio y fin', 'error')
    return
  }
  if (hasta <= desde) {
    showToast('La fecha de fin debe ser posterior al inicio', 'error')
    return
  }

  const btn = $('#btn-generar-semanas')
  btn.disabled = true
  btn.innerHTML = '<div class="spinner"></div><span>Generando semanas...</span>'

  // 1. Guardar la config (día de inicio de semana)
  const config = await guardarConfig(state.org.id, diaInicio)
  if (!config) {
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="play"></i><span>Generar las semanas</span>'
    if (window.lucide) lucide.createIcons()
    showToast('No se pudo guardar la configuración', 'error')
    return
  }
  state.config = config

  // 2. Generar las semanas vía RPC
  const res = await generarSemanas(
    state.org.id, desde, hasta, state.vector ? state.vector.id : null
  )
  if (res.error) {
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="play"></i><span>Generar las semanas</span>'
    if (window.lucide) lucide.createIcons()
    showToast('Error al generar las semanas', 'error')
    return
  }

  showToast(res.creadas + ' semanas generadas', 'success')

  // 3. Recargar y pasar a la vista de la semana en curso
  await cargarSemanaYDecorar()
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: LA SEMANA EN CURSO
// ────────────────────────────────────────────────────────────────────────────

async function cargarSemanaYDecorar() {
  const semanaCurso = await loadSemanaEnCurso(state.org.id)

  if (!semanaCurso) {
    // No hay semana que cubra hoy. Puede ser que el horizonte ya pasó
    // o que aún no empieza. Mostramos setup de nuevo con aviso.
    cambiarVista('setup')
    initSetup()
    showToast('No hay una semana en curso para hoy', 'error')
    return
  }

  // Cargar la semana completa (con datos del round) + sus tareas
  const semanaFull = await loadSemanaConRound(semanaCurso.id)
  state.semanaActual = semanaFull || semanaCurso
  state.tareas = await loadTareas(state.semanaActual.id)

  renderSemana()
  cambiarVista('semana')
}

function renderSemana() {
  const s = state.semanaActual
  if (!s) return

  // ── Chips de contexto ──
  // Round del Vector (si está vinculada)
  const chipRound = $('#semana-chip-round')
  if (s.vector_trimestres) {
    const r = s.vector_trimestres
    chipRound.style.display = 'inline-flex'
    chipRound.querySelector('.chip-text').textContent =
      'Round ' + r.numero + ' · Q' + r.trimestre_anio + ' Año ' + r.anio
  } else {
    chipRound.style.display = 'none'
  }

  $('#semana-chip-ronda').querySelector('.chip-text').textContent =
    'Ronda ' + s.numero_ronda
  $('#semana-chip-fechas').querySelector('.chip-text').textContent =
    fechaCorta(s.fecha_inicio) + ' – ' + fechaCorta(s.fecha_fin)

  // Aviso de cruce de mes
  const avisoMes = $('#semana-aviso-mes')
  if (s.cruza_de_mes) {
    avisoMes.style.display = 'flex'
    const dIni = new Date(s.fecha_inicio + 'T12:00:00')
    const dFin = new Date(s.fecha_fin + 'T12:00:00')
    avisoMes.querySelector('.aviso-text').textContent =
      'Esta semana cruza de mes: cierras ' + MESES_ES[dIni.getMonth()] +
      ' y arrancas ' + MESES_ES[dFin.getMonth()] + '.'
  } else {
    avisoMes.style.display = 'none'
  }

  // Estado del ritual
  const statusEl = $('#semana-status')
  if (s.estado === 'completado' || s.estado === 'cerrada') {
    statusEl.className = 'semana-status done'
    statusEl.innerHTML = '<span class="dot"></span> Ritual completado'
  } else {
    statusEl.className = 'semana-status pending'
    statusEl.innerHTML = '<span class="dot"></span> Ritual pendiente'
  }

  // ── Objetivo de la semana ──
  $('#objetivo-input').value = s.objetivo || ''

  // ── Las 4 preguntas ──
  $('#ritual-retos').value = s.ritual_retos || ''
  $('#ritual-actividades').value = s.ritual_actividades || ''
  $('#ritual-metricas').value = s.ritual_metricas || ''
  $('#ritual-ajustes').value = s.ritual_ajustes || ''

  // ── Link al round del Vector ──
  const roundLink = $('#round-link')
  if (s.vector_round_id) {
    roundLink.style.display = 'inline-flex'
    roundLink.href = '/portal/vector-trimestre.html?id=' + s.vector_round_id
  } else {
    roundLink.style.display = 'none'
  }

  renderTareas()
}

function renderTareas() {
  const cont = $('#tarea-list')
  const filtro = state.filtroTareas
  let tareas = state.tareas
  if (filtro === 'plan') tareas = tareas.filter(t => t.origen === 'plan')
  if (filtro === 'impulso') tareas = tareas.filter(t => t.origen === 'impulso')

  // Conteo en el título
  const total = state.tareas.length
  const hechas = state.tareas.filter(t => t.completada).length
  $('#tareas-count').textContent = total + (total === 1 ? ' tarea · ' : ' tareas · ') + hechas + ' hechas'

  if (!tareas.length) {
    cont.innerHTML = '<div class="tarea-empty">' +
      (filtro === 'impulso'
        ? 'Aún no hay impulsos del día. Surgirán del Pulso (la reunión diaria).'
        : filtro === 'plan'
          ? 'Aún no hay tareas del plan. Agrega la primera abajo.'
          : 'Aún no hay tareas esta semana. Agrega la primera abajo.') +
      '</div>'
    return
  }

  cont.innerHTML = tareas.map(t => {
    const esImpulso = t.origen === 'impulso'
    return '<div class="tarea-card ' + (esImpulso ? 'is-impulso' : 'is-plan') +
      (t.completada ? ' completed' : '') + '" data-id="' + t.id + '">' +
      '<div class="tarea-check' + (t.completada ? ' done' : '') + '" data-action="toggle" data-id="' + t.id + '">' +
        '<i data-lucide="check"></i>' +
      '</div>' +
      '<div class="tarea-body">' +
        '<div class="tarea-top">' +
          '<span class="tarea-tag ' + (esImpulso ? 'impulso' : 'plan') + '">' +
            (esImpulso ? 'Impulso del día' : 'Del plan') + '</span>' +
          '<span class="tarea-title">' + escapeHtml(t.titulo) + '</span>' +
        '</div>' +
        '<div class="tarea-meta">' +
          (t.responsable
            ? '<span class="tarea-meta-item"><i data-lucide="user"></i> <strong>' +
              escapeHtml(t.responsable) + '</strong></span>' : '') +
          (t.fecha_objetivo
            ? '<span class="tarea-meta-item"><i data-lucide="calendar"></i> ' +
              fechaCorta(t.fecha_objetivo) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<button class="tarea-del" data-action="del" data-id="' + t.id + '" title="Eliminar">' +
        '<i data-lucide="trash-2"></i></button>' +
    '</div>'
  }).join('')

  if (window.lucide) lucide.createIcons()
}

// Auto-guardado del objetivo y las 4 preguntas
const guardarRitualDebounced = debounce(async () => {
  if (!state.semanaActual) return
  const payload = {
    objetivo: $('#objetivo-input').value.trim() || null,
    ritual_retos: $('#ritual-retos').value.trim() || null,
    ritual_actividades: $('#ritual-actividades').value.trim() || null,
    ritual_metricas: $('#ritual-metricas').value.trim() || null,
    ritual_ajustes: $('#ritual-ajustes').value.trim() || null
  }
  // Si hay objetivo y el ritual estaba pendiente, lo marcamos completado
  if (payload.objetivo && state.semanaActual.estado === 'pendiente') {
    payload.estado = 'completado'
  }
  const updated = await guardarRitual(state.semanaActual.id, payload)
  if (updated) {
    state.semanaActual = { ...state.semanaActual, ...updated }
    // refrescar el badge de estado
    const statusEl = $('#semana-status')
    if (updated.estado === 'completado' || updated.estado === 'cerrada') {
      statusEl.className = 'semana-status done'
      statusEl.innerHTML = '<span class="dot"></span> Ritual completado'
    }
    showToast('Guardado', 'success')
  }
}, 900)

async function onAgregarTarea() {
  const input = $('#add-tarea-input')
  const titulo = input.value.trim()
  if (!titulo) {
    input.focus()
    return
  }
  if (!state.semanaActual) return

  const nueva = await crearTarea({
    organizacion_id: state.org.id,
    semana_id: state.semanaActual.id,
    titulo: titulo,
    origen: 'plan',
    orden: state.tareas.length
  })
  if (!nueva) {
    showToast('No se pudo agregar la tarea', 'error')
    return
  }
  state.tareas.push(nueva)
  input.value = ''
  renderTareas()
  showToast('Tarea agregada', 'success')
}

async function onToggleTarea(tareaId) {
  const tarea = state.tareas.find(t => t.id === tareaId)
  if (!tarea) return
  const nuevoEstado = !tarea.completada
  // optimista
  tarea.completada = nuevoEstado
  renderTareas()
  const updated = await toggleTarea(tareaId, nuevoEstado)
  if (!updated) {
    // revertir
    tarea.completada = !nuevoEstado
    renderTareas()
    showToast('No se pudo actualizar', 'error')
  }
}

async function onEliminarTarea(tareaId) {
  const ok = await eliminarTarea(tareaId)
  if (!ok) {
    showToast('No se pudo eliminar', 'error')
    return
  }
  state.tareas = state.tareas.filter(t => t.id !== tareaId)
  renderTareas()
  showToast('Tarea eliminada', 'success')
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: HISTORIAL
// ────────────────────────────────────────────────────────────────────────────

async function cargarHistorial() {
  const exceptoId = state.semanaActual ? state.semanaActual.id : null
  state.historial = await loadHistorial(state.org.id, exceptoId)
  const conteo = await loadConteoTareas(state.historial.map(s => s.id))
  renderHistorial(conteo)
}

function renderHistorial(conteo) {
  const cont = $('#historial-list')
  if (!state.historial.length) {
    cont.innerHTML = '<div class="tarea-empty">Aún no hay rondas anteriores. ' +
      'Tu primera ronda es la semana en curso.</div>'
    return
  }

  cont.innerHTML = state.historial.map(s => {
    const c = conteo[s.id]
    let statHtml
    if (s.estado === 'pendiente') {
      statHtml = '<span class="semana-hist-stat pending">' +
        '<i data-lucide="circle-dashed"></i> Sin ritual</span>'
    } else if (c && c.total > 0) {
      statHtml = '<span class="semana-hist-stat">' +
        '<i data-lucide="check-circle-2"></i> ' + c.hechas + '/' + c.total + ' tareas</span>'
    } else {
      statHtml = '<span class="semana-hist-stat">' +
        '<i data-lucide="check-circle-2"></i> Ritual hecho</span>'
    }

    return '<div class="semana-hist-row">' +
      '<div class="semana-hist-week">Ronda ' + s.numero_ronda + '</div>' +
      '<div class="semana-hist-obj">' +
        (s.objetivo ? escapeHtml(s.objetivo)
          : '<span style="color:var(--text-4)">Sin objetivo definido</span>') +
        '<div class="semana-hist-fechas">' + fechaCorta(s.fecha_inicio) + ' – ' +
          fechaCorta(s.fecha_fin) +
          (s.cruza_de_mes ? ' · cruza de mes' : '') + '</div>' +
      '</div>' +
      statHtml +
    '</div>'
  }).join('')

  if (window.lucide) lucide.createIcons()
}

// ────────────────────────────────────────────────────────────────────────────
// NAV ENTRE VISTAS (switcher)
// ────────────────────────────────────────────────────────────────────────────

function setupSwitcher() {
  $$('.view-switcher button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const target = btn.dataset.view
      $$('.view-switcher button').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')

      if (target === 'semana') {
        if (state.semanaActual) {
          cambiarVista('semana')
        } else {
          await cargarSemanaYDecorar()
        }
      } else if (target === 'historial') {
        cambiarVista('historial')
        await cargarHistorial()
      } else {
        cambiarVista(target)
      }
    })
  })
}

// ────────────────────────────────────────────────────────────────────────────
// TEMA
// ────────────────────────────────────────────────────────────────────────────

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
// LISTENERS DE LA VISTA SEMANA (delegación)
// ────────────────────────────────────────────────────────────────────────────

function setupSemanaListeners() {
  // auto-guardado del ritual
  ;['#objetivo-input', '#ritual-retos', '#ritual-actividades',
    '#ritual-metricas', '#ritual-ajustes'].forEach(sel => {
    const el = $(sel)
    if (el) el.addEventListener('input', guardarRitualDebounced)
  })

  // agregar tarea
  $('#btn-add-tarea')?.addEventListener('click', onAgregarTarea)
  $('#add-tarea-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onAgregarTarea()
  })

  // filtros de tareas
  $$('.tareas-filter button').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tareas-filter button').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      state.filtroTareas = btn.dataset.filtro
      renderTareas()
    })
  })

  // delegación: toggle / eliminar tareas
  $('#tarea-list')?.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('[data-action="toggle"]')
    if (toggleBtn) {
      onToggleTarea(toggleBtn.dataset.id)
      return
    }
    const delBtn = e.target.closest('[data-action="del"]')
    if (delBtn) {
      onEliminarTarea(delBtn.dataset.id)
      return
    }
  })
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────

async function init() {
  try {
    const [profile, org] = await Promise.all([getMyProfile(), getMyOrganization()])
    state.profile = profile
    state.org = org

    if (!org) {
      $('.content').innerHTML =
        '<div class="empty-state-big"><h2>Sin organización asignada</h2></div>'
      return
    }

    // Cargar config + vector en paralelo
    const [config, vector] = await Promise.all([
      loadConfig(org.id),
      loadVectorActivo(org.id)
    ])
    state.config = config
    state.vector = vector

    // ¿Ya hay semanas generadas? Buscamos la semana en curso.
    const semanaCurso = await loadSemanaEnCurso(org.id)

    if (semanaCurso) {
      // Hay semanas: cargar la actual y mostrarla
      const semanaFull = await loadSemanaConRound(semanaCurso.id)
      state.semanaActual = semanaFull || semanaCurso
      state.tareas = await loadTareas(state.semanaActual.id)
      renderSemana()
      cambiarVista('semana')
      // marcar el switcher en "semana"
      $$('.view-switcher button').forEach(b => b.classList.remove('active'))
      const btnSemana = $$('.view-switcher button').find(b => b.dataset.view === 'semana')
      if (btnSemana) btnSemana.classList.add('active')
    } else {
      // No hay semanas todavía: setup
      initSetup()
      cambiarVista('setup')
      $$('.view-switcher button').forEach(b => b.classList.remove('active'))
      const btnSetup = $$('.view-switcher button').find(b => b.dataset.view === 'setup')
      if (btnSetup) btnSetup.classList.add('active')
    }

    setupSwitcher()
    setupSemanaListeners()

    if (window.lucide) lucide.createIcons()

  } catch (err) {
    console.error('[ritmo-semanal] init error:', err)
  }
}

init()
