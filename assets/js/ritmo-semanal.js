// ============================================================================
// SCALEx PORTAL · RITMO · RITUAL SEMANAL v2
// ============================================================================
// Pilar 4 · Ritmo · Herramienta 1
//
// REDISEÑO v2 (mayo 2026) — cambios respecto a v1:
//   1. No hay pestañas. La página decide su estado:
//      · sin semanas      → Onboarding (pantalla completa, una sola vez)
//      · con semanas      → vista La Semana en curso
//      · sin semana hoy   → empty state (entre vectores)
//   2. Banner protagonista arriba: pendiente (ámbar) / completado (verde).
//   3. Indicadores de guardado permanentes por campo (no toasts).
//   4. Cierre del ritual = acto explícito ("Cerrar el ritual de esta semana").
//   5. Historial colapsable abajo, en la misma vista.
//   6. Botón Admin en topbar para regenerar (con confirm explícito).
//
// Depende de: scalex-sql-13-ritmo-semanas.sql + scalex-sql-14-ritmo-semanas-fix.sql
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
  { v: 1, label: 'Lunes (recomendado)' },
  { v: 2, label: 'Martes' },
  { v: 3, label: 'Miércoles' },
  { v: 4, label: 'Jueves' },
  { v: 5, label: 'Viernes' },
  { v: 6, label: 'Sábado' },
  { v: 7, label: 'Domingo' }
]

// Cuántas rondas estima el horizonte (solo para mostrar en el botón del onboarding)
function estimarRondas(desde, hasta) {
  if (!desde || !hasta) return 156
  const d1 = new Date(desde + 'T12:00:00')
  const d2 = new Date(hasta + 'T12:00:00')
  return Math.max(1, Math.floor((d2 - d1) / (7 * 24 * 60 * 60 * 1000)) + 1)
}

let state = {
  org: null,
  profile: null,
  config: null,
  vector: null,
  semanaActual: null,
  tareas: [],
  historial: [],
  conteoHistorial: {},     // { semanaId: { total, hechas } }
  filtroTareas: 'todas',
  saveTimers: {}           // timers por campo para el indicador
}

// ────────────────────────────────────────────────────────────────────────────
// SUPABASE — LOADS
// ────────────────────────────────────────────────────────────────────────────

async function loadConfig(orgId) {
  const { data, error } = await supabase
    .from('ritmo_config').select('*')
    .eq('organizacion_id', orgId).maybeSingle()
  if (error) { console.error('[ritmo] config', error); return null }
  return data
}

async function loadVectorActivo(orgId) {
  const { data, error } = await supabase
    .from('vector_estrategicos')
    .select('id, meta, nombre, fecha_inicio, fecha_fin')
    .eq('organizacion_id', orgId).eq('estado', 'activo').maybeSingle()
  if (error) { console.error('[ritmo] vector', error); return null }
  return data
}

async function loadTieneSemanas(orgId) {
  const { data, error } = await supabase
    .rpc('ritmo_org_tiene_semanas', { p_organizacion_id: orgId })
  if (error) { console.error('[ritmo] tiene semanas', error); return false }
  return !!data
}

async function loadSemanaEnCurso(orgId) {
  const { data, error } = await supabase
    .rpc('ritmo_semana_en_curso', { p_organizacion_id: orgId })
  if (error) { console.error('[ritmo] semana en curso', error); return null }
  // La RPC puede devolver un row vacio (objeto con id=null) en lugar de null.
  // Validar explicitamente que tenga id real, si no, no hay semana en curso.
  const row = Array.isArray(data) ? data[0] : data
  if (!row || !row.id) return null
  return row
}

async function loadSemanaConRound(semanaId) {
  if (!semanaId) {
    console.error('[ritmo] load semana llamado sin id')
    return null
  }
  const { data, error } = await supabase
    .from('ritmo_semanas')
    .select('*, vector_trimestres(numero, anio, trimestre_anio)')
    .eq('id', semanaId).single()
  if (error) { console.error('[ritmo] load semana', error); return null }
  return data
}

async function loadTareas(semanaId) {
  const { data, error } = await supabase
    .from('ritmo_tareas').select('*')
    .eq('semana_id', semanaId)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) { console.error('[ritmo] tareas', error); return [] }
  return data || []
}

async function loadHistorial(orgId, exceptoId) {
  const { data, error } = await supabase
    .from('ritmo_semanas')
    .select('id, numero_ronda, fecha_inicio, fecha_fin, objetivo, estado, cruza_de_mes')
    .eq('organizacion_id', orgId)
    .lt('fecha_inicio', new Date().toISOString().split('T')[0])
    .order('numero_ronda', { ascending: false })
    .limit(50)
  if (error) { console.error('[ritmo] historial', error); return [] }
  return (data || []).filter(s => s.id !== exceptoId)
}

async function loadConteoTareas(semanaIds) {
  if (!semanaIds.length) return {}
  const { data, error } = await supabase
    .from('ritmo_tareas').select('semana_id, completada')
    .in('semana_id', semanaIds)
  if (error) { console.error('[ritmo] conteo', error); return {} }
  const c = {}
  for (const t of (data || [])) {
    if (!c[t.semana_id]) c[t.semana_id] = { total: 0, hechas: 0 }
    c[t.semana_id].total++
    if (t.completada) c[t.semana_id].hechas++
  }
  return c
}

// ────────────────────────────────────────────────────────────────────────────
// SUPABASE — WRITES
// ────────────────────────────────────────────────────────────────────────────

async function guardarConfig(orgId, diaInicio) {
  const { data, error } = await supabase
    .from('ritmo_config')
    .upsert({ organizacion_id: orgId, dia_inicio_semana: diaInicio })
    .select('*').single()
  if (error) { console.error('[ritmo] guardar config', error); return null }
  return data
}

async function generarSemanas(orgId, desde, hasta, vectorId) {
  const { data, error } = await supabase.rpc('ritmo_generar_semanas', {
    p_organizacion_id: orgId,
    p_fecha_desde: desde,
    p_fecha_hasta: hasta,
    p_vector_id: vectorId || null
  })
  if (error) { console.error('[ritmo] generar', error); return { error } }
  return { creadas: data }
}

async function regenerarSemanas(orgId, desde, hasta, vectorId) {
  const { data, error } = await supabase.rpc('ritmo_regenerar_semanas', {
    p_organizacion_id: orgId,
    p_fecha_desde: desde,
    p_fecha_hasta: hasta,
    p_vector_id: vectorId || null
  })
  if (error) { console.error('[ritmo] regenerar', error); return { error } }
  return { creadas: data }
}

async function guardarRitualParcial(semanaId, payload) {
  // Guarda los campos del ritual SIN cambiar el estado. Borrador en vivo.
  const { data, error } = await supabase
    .from('ritmo_semanas').update(payload).eq('id', semanaId)
    .select('*').single()
  if (error) { console.error('[ritmo] guardar parcial', error); return null }
  return data
}

async function cerrarRitual(semanaId) {
  // ACTO EXPLICITO: pasa el estado a 'completado'. El trigger sella el timestamp.
  const { data, error } = await supabase
    .from('ritmo_semanas').update({ estado: 'completado' }).eq('id', semanaId)
    .select('*').single()
  if (error) { console.error('[ritmo] cerrar ritual', error); return null }
  return data
}

async function reabrirRitual(semanaId) {
  const { data, error } = await supabase
    .from('ritmo_semanas').update({ estado: 'pendiente' }).eq('id', semanaId)
    .select('*').single()
  if (error) { console.error('[ritmo] reabrir ritual', error); return null }
  return data
}

async function crearTarea(payload) {
  const { data, error } = await supabase
    .from('ritmo_tareas').insert(payload).select('*').single()
  if (error) { console.error('[ritmo] crear tarea', error); return null }
  return data
}

async function toggleTarea(tareaId, completada) {
  const { data, error } = await supabase
    .from('ritmo_tareas').update({ completada }).eq('id', tareaId)
    .select('*').single()
  if (error) { console.error('[ritmo] toggle', error); return null }
  return data
}

async function eliminarTarea(tareaId) {
  const { error } = await supabase.from('ritmo_tareas').delete().eq('id', tareaId)
  return !error
}

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
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

function fechaConDiaSemana(d) {
  if (!d) return ''
  const date = new Date(d + 'T12:00:00')
  const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
  return dias[date.getDay()] + ' ' + date.getDate() + ' de ' + MESES_ES[date.getMonth()]
}

function tiempoRelativo(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60000) return 'hace un momento'
  if (ms < 3600000) return 'hace ' + Math.floor(ms/60000) + ' min'
  if (ms < 86400000) return 'hace ' + Math.floor(ms/3600000) + ' h'
  return 'hace ' + Math.floor(ms/86400000) + ' días'
}

function cambiarVista(nueva) {
  $$('.view').forEach(v => v.classList.remove('active'))
  const el = $('#view-' + nueva)
  if (el) el.classList.add('active')
  if (window.lucide) lucide.createIcons()
  const content = $('.content')
  if (content) content.scrollTop = 0
}

// ────────────────────────────────────────────────────────────────────────────
// INDICADOR DE GUARDADO POR CAMPO
// ────────────────────────────────────────────────────────────────────────────

const SAVE_STATES = {
  empty:  { cls: '',         text: 'Sin guardar' },
  saving: { cls: 'saving',   text: 'Escribiendo...' },
  saved:  { cls: 'saved',    text: '' },  // se calcula con tiempoRelativo
  error:  { cls: 'error',    text: 'Error al guardar' }
}

function setSaveIndicator(indicatorId, status, isoTime) {
  const el = $('#' + indicatorId)
  if (!el) return
  const s = SAVE_STATES[status] || SAVE_STATES.empty
  el.className = 'save-indicator ' + s.cls + (el.classList.contains('mini') ? ' mini' : '')
  let text = s.text
  if (status === 'saved') {
    text = 'Guardado · ' + tiempoRelativo(isoTime || new Date().toISOString())
  } else if (status === 'saved' && el.classList.contains('mini')) {
    text = 'Guardado'
  }
  el.innerHTML = '<span class="save-indicator-dot"></span><span>' + text + '</span>'
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: ONBOARDING (primera vez, sin semanas generadas)
// ────────────────────────────────────────────────────────────────────────────

function renderOnboarding() {
  // Poblar el select del día de inicio
  const sel = $('#onb-dia-inicio')
  if (sel && !sel.options.length) {
    sel.innerHTML = DIAS_SEMANA.map(d =>
      '<option value="' + d.v + '"' + (d.v === 1 ? ' selected' : '') + '>' + d.label + '</option>'
    ).join('')
  }

  // Prefill de fechas
  let desde, hasta
  if (state.vector) {
    desde = state.vector.fecha_inicio
    hasta = state.vector.fecha_fin
    $('#onb-vector-info').style.display = 'flex'
    $('#onb-vector-meta').textContent = state.vector.meta
    $('#onb-vector-fechas').textContent =
      fechaLarga(state.vector.fecha_inicio) + ' → ' + fechaLarga(state.vector.fecha_fin)
    $('#onb-desde').readOnly = true
    $('#onb-hasta').readOnly = true
    $('#onb-sin-vector-info').style.display = 'none'
  } else {
    const hoy = new Date()
    desde = hoy.toISOString().split('T')[0]
    const en3 = new Date(hoy.getFullYear() + 3, hoy.getMonth(), hoy.getDate())
    hasta = en3.toISOString().split('T')[0]
    $('#onb-vector-info').style.display = 'none'
    $('#onb-sin-vector-info').style.display = 'flex'
    $('#onb-desde').readOnly = false
    $('#onb-hasta').readOnly = false
  }

  $('#onb-desde').value = desde
  $('#onb-hasta').value = hasta
  actualizarBotonRondas()

  $('#onb-desde').addEventListener('input', actualizarBotonRondas)
  $('#onb-hasta').addEventListener('input', actualizarBotonRondas)
}

function actualizarBotonRondas() {
  const n = estimarRondas($('#onb-desde').value, $('#onb-hasta').value)
  const btnText = $('#btn-onb-generar-text')
  if (btnText) btnText.textContent = 'Generar mis ' + n + ' rondas'
}

async function onGenerarPrimerVez() {
  const desde = $('#onb-desde').value
  const hasta = $('#onb-hasta').value
  const diaInicio = parseInt($('#onb-dia-inicio').value, 10)

  if (!desde || !hasta) return
  if (hasta <= desde) return

  const btn = $('#btn-onb-generar')
  btn.disabled = true
  const originalHTML = btn.innerHTML
  btn.innerHTML = '<div class="spinner-sm"></div><span>Generando rondas...</span>'

  // Guardar config
  await guardarConfig(state.org.id, diaInicio)

  // Generar (la RPC es idempotente, si ya hubiera semanas devuelve 0)
  const res = await generarSemanas(
    state.org.id, desde, hasta, state.vector ? state.vector.id : null
  )

  if (res.error || !res.creadas) {
    btn.disabled = false
    btn.innerHTML = originalHTML
    if (window.lucide) lucide.createIcons()
    alert('No se pudieron generar las semanas. Si ya tienes semanas previas, usa Admin → Regenerar.')
    return
  }

  // Cargar la semana en curso y mostrarla
  await cargarYRenderSemana()
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: LA SEMANA (corazón)
// ────────────────────────────────────────────────────────────────────────────

async function cargarYRenderSemana() {
  const semanaCurso = await loadSemanaEnCurso(state.org.id)

  if (!semanaCurso) {
    renderEmptyEntreVectores()
    cambiarVista('empty')
    return
  }

  const semanaFull = await loadSemanaConRound(semanaCurso.id)
  state.semanaActual = semanaFull || semanaCurso
  state.tareas = await loadTareas(state.semanaActual.id)

  // Historial (en paralelo, no bloqueante)
  loadHistorial(state.org.id, state.semanaActual.id).then(async hist => {
    state.historial = hist
    state.conteoHistorial = await loadConteoTareas(hist.map(s => s.id))
    renderHistorial()
  })

  renderSemana()
  cambiarVista('semana')
}

function renderSemana() {
  const s = state.semanaActual
  if (!s) return

  // Chips arriba
  const chipRound = $('#chip-round')
  if (s.vector_trimestres) {
    const r = s.vector_trimestres
    chipRound.style.display = 'inline-flex'
    chipRound.querySelector('.chip-text').textContent =
      'Round ' + r.numero + ' · Q' + r.trimestre_anio + ' Año ' + r.anio
  } else {
    chipRound.style.display = 'none'
  }
  $('#chip-ronda .chip-text').textContent = 'Ronda ' + s.numero_ronda
  $('#chip-fechas .chip-text').textContent =
    fechaCorta(s.fecha_inicio) + ' – ' + fechaCorta(s.fecha_fin)
  $('#chip-cruza').style.display = s.cruza_de_mes ? 'inline-flex' : 'none'

  // Banner protagonista — depende del estado del ritual
  renderBanner()

  // Objetivo + 4 preguntas
  $('#objetivo-textarea').value = s.objetivo || ''
  $('#ritual-retos').value = s.ritual_retos || ''
  $('#ritual-actividades').value = s.ritual_actividades || ''
  $('#ritual-metricas').value = s.ritual_metricas || ''
  $('#ritual-ajustes').value = s.ritual_ajustes || ''

  // Indicadores iniciales: si hay contenido + ritual ya cerrado, "Guardado"
  ;['save-objetivo','save-retos','save-actividades','save-metricas','save-ajustes']
    .forEach(id => {
      const inputId = id.replace('save-', 'ritual-').replace('ritual-objetivo','objetivo-textarea')
      const valor = $('#' + inputId)?.value
      if (valor && s.updated_at) {
        setSaveIndicator(id, 'saved', s.updated_at)
      } else {
        setSaveIndicator(id, 'empty')
      }
    })

  // Link al round del Vector
  const roundLink = $('#round-link')
  if (s.vector_round_id) {
    roundLink.style.display = 'inline-flex'
    roundLink.href = '/portal/vector-trimestre.html?id=' + s.vector_round_id
  } else {
    roundLink.style.display = 'none'
  }

  renderTareas()
}

function renderBanner() {
  const s = state.semanaActual
  const banner = $('#ritual-banner')
  const cierre = $('#cierre-card')

  if (s.estado === 'completado' || s.estado === 'cerrada') {
    // Banner verde tranquilo
    banner.className = 'ritual-banner done'
    banner.innerHTML =
      '<div class="ritual-banner-icon"><i data-lucide="check"></i></div>' +
      '<div class="ritual-banner-body">' +
        '<div class="ritual-banner-title">Ritual completado el ' +
          fechaConDiaSemana((s.ritual_completado_en || '').split('T')[0]) + '</div>' +
        '<div class="ritual-banner-text">La semana corre del ' +
          fechaCorta(s.fecha_inicio) + ' al ' + fechaCorta(s.fecha_fin) + '.</div>' +
      '</div>' +
      '<div class="ritual-banner-btn-wrap">' +
        '<button class="btn btn-ghost btn-sm" id="btn-reabrir-ritual">' +
          '<i data-lucide="rotate-ccw"></i> Reabrir</button>' +
      '</div>'
    $('#btn-reabrir-ritual')?.addEventListener('click', onReabrirRitual)

    // Cierre escondido
    if (cierre) cierre.style.display = 'none'
    // Tareas visibles
    $('#tareas-section').style.display = 'block'
  } else {
    // Banner ámbar protagonista
    banner.className = 'ritual-banner pending'
    banner.innerHTML =
      '<div class="ritual-banner-icon"><i data-lucide="clipboard-list"></i></div>' +
      '<div class="ritual-banner-body">' +
        '<div class="ritual-banner-title">Tienes el ritual semanal pendiente</div>' +
        '<div class="ritual-banner-text">Tómate 15 minutos para responder las 4 preguntas y fijar el objetivo de los próximos 7 días. Es el acto que abre tu semana.</div>' +
      '</div>' +
      '<div class="ritual-banner-btn-wrap">' +
        '<button class="btn btn-primary large" id="btn-scroll-ritual">' +
          '<i data-lucide="arrow-down"></i> Hacer el ritual</button>' +
      '</div>'
    $('#btn-scroll-ritual')?.addEventListener('click', () => {
      $('#objetivo-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })

    if (cierre) cierre.style.display = 'flex'
    // Tareas escondidas hasta cerrar el ritual
    $('#tareas-section').style.display = 'none'
  }

  if (window.lucide) lucide.createIcons()
}

// ────────────────────────────────────────────────────────────────────────────
// AUTO-GUARDADO POR CAMPO (con indicador permanente)
// ────────────────────────────────────────────────────────────────────────────

const CAMPOS_RITUAL = [
  { input: 'objetivo-textarea', column: 'objetivo',           indicator: 'save-objetivo'     },
  { input: 'ritual-retos',      column: 'ritual_retos',       indicator: 'save-retos'        },
  { input: 'ritual-actividades',column: 'ritual_actividades', indicator: 'save-actividades'  },
  { input: 'ritual-metricas',   column: 'ritual_metricas',    indicator: 'save-metricas'     },
  { input: 'ritual-ajustes',    column: 'ritual_ajustes',     indicator: 'save-ajustes'      }
]

function attachAutoSave() {
  CAMPOS_RITUAL.forEach(c => {
    const el = $('#' + c.input)
    if (!el) return
    el.addEventListener('input', () => {
      setSaveIndicator(c.indicator, 'saving')
      clearTimeout(state.saveTimers[c.input])
      state.saveTimers[c.input] = setTimeout(async () => {
        if (!state.semanaActual) return
        const payload = {}
        payload[c.column] = (el.value || '').trim() || null
        const updated = await guardarRitualParcial(state.semanaActual.id, payload)
        if (updated) {
          state.semanaActual = { ...state.semanaActual, ...updated }
          setSaveIndicator(c.indicator, 'saved', updated.updated_at)
        } else {
          setSaveIndicator(c.indicator, 'error')
        }
      }, 900)
    })
  })
}

// ────────────────────────────────────────────────────────────────────────────
// CIERRE EXPLÍCITO DEL RITUAL
// ────────────────────────────────────────────────────────────────────────────

async function onCerrarRitual() {
  if (!state.semanaActual) return

  // Validación mínima: que al menos el objetivo esté escrito
  const objetivo = $('#objetivo-textarea').value.trim()
  if (!objetivo) {
    alert('Antes de cerrar el ritual, escribe el objetivo de esta semana.')
    $('#objetivo-textarea').focus()
    return
  }

  const btn = $('#btn-cerrar-ritual')
  btn.disabled = true
  const orig = btn.innerHTML
  btn.innerHTML = '<div class="spinner-sm"></div><span>Cerrando...</span>'

  const updated = await cerrarRitual(state.semanaActual.id)
  btn.disabled = false
  btn.innerHTML = orig
  if (window.lucide) lucide.createIcons()

  if (!updated) {
    alert('No se pudo cerrar el ritual. Reintenta.')
    return
  }

  state.semanaActual = { ...state.semanaActual, ...updated }
  renderBanner()
  // Scroll al banner para que vea la confirmación
  $('#ritual-banner')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function onReabrirRitual() {
  if (!confirm('¿Reabrir el ritual de esta semana? Podrás editar las respuestas de nuevo.')) return
  const updated = await reabrirRitual(state.semanaActual.id)
  if (updated) {
    state.semanaActual = { ...state.semanaActual, ...updated }
    renderBanner()
  }
}

// ────────────────────────────────────────────────────────────────────────────
// TAREAS (solo visibles tras cerrar el ritual)
// ────────────────────────────────────────────────────────────────────────────

function renderTareas() {
  const cont = $('#tarea-list')
  if (!cont) return

  let tareas = state.tareas
  if (state.filtroTareas === 'plan')    tareas = tareas.filter(t => t.origen === 'plan')
  if (state.filtroTareas === 'impulso') tareas = tareas.filter(t => t.origen === 'impulso')

  const total = state.tareas.length
  const hechas = state.tareas.filter(t => t.completada).length
  const countEl = $('#tareas-count')
  if (countEl) {
    countEl.textContent = total + (total === 1 ? ' tarea · ' : ' tareas · ') + hechas + ' hechas'
  }

  if (!tareas.length) {
    cont.innerHTML = '<div class="tarea-empty">' +
      (state.filtroTareas === 'impulso'
        ? 'Aún no hay impulsos del día. Surgirán del Pulso (la reunión diaria).'
        : state.filtroTareas === 'plan'
          ? 'Aún no hay tareas del plan. Agrega la primera abajo.'
          : 'Aún no hay tareas esta semana. Agrega la primera abajo.') +
      '</div>'
    return
  }

  cont.innerHTML = tareas.map(t => {
    const esImpulso = t.origen === 'impulso'
    return '<div class="tarea-card ' + (esImpulso ? 'is-impulso' : 'is-plan') +
      (t.completada ? ' completed' : '') + '">' +
      '<div class="tarea-check' + (t.completada ? ' done' : '') +
        '" data-action="toggle" data-id="' + t.id + '">' +
        '<i data-lucide="check"></i>' +
      '</div>' +
      '<div class="tarea-body">' +
        '<div class="tarea-top">' +
          '<span class="tarea-tag ' + (esImpulso ? 'impulso' : 'plan') + '">' +
            (esImpulso ? 'Impulso del día' : 'Del plan') + '</span>' +
          '<span class="tarea-title">' + escapeHtml(t.titulo) + '</span>' +
        '</div>' +
        '<div class="tarea-meta">' +
          (t.responsable ? '<span class="tarea-meta-item"><i data-lucide="user"></i> ' +
            escapeHtml(t.responsable) + '</span>' : '') +
          (t.fecha_objetivo ? '<span class="tarea-meta-item"><i data-lucide="calendar"></i> ' +
            fechaCorta(t.fecha_objetivo) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<button class="tarea-del" data-action="del" data-id="' + t.id + '" title="Eliminar">' +
        '<i data-lucide="trash-2"></i></button>' +
    '</div>'
  }).join('')

  if (window.lucide) lucide.createIcons()
}

async function onAgregarTarea() {
  const input = $('#add-tarea-input')
  const titulo = input.value.trim()
  if (!titulo) { input.focus(); return }
  if (!state.semanaActual) return

  const nueva = await crearTarea({
    organizacion_id: state.org.id,
    semana_id: state.semanaActual.id,
    titulo, origen: 'plan',
    orden: state.tareas.length
  })
  if (!nueva) return
  state.tareas.push(nueva)
  input.value = ''
  renderTareas()
}

async function onToggleTarea(tareaId) {
  const t = state.tareas.find(x => x.id === tareaId)
  if (!t) return
  const nuevo = !t.completada
  t.completada = nuevo  // optimista
  renderTareas()
  const r = await toggleTarea(tareaId, nuevo)
  if (!r) {
    t.completada = !nuevo
    renderTareas()
  }
}

async function onEliminarTarea(tareaId) {
  const ok = await eliminarTarea(tareaId)
  if (!ok) return
  state.tareas = state.tareas.filter(t => t.id !== tareaId)
  renderTareas()
}

// ────────────────────────────────────────────────────────────────────────────
// HISTORIAL COLAPSABLE
// ────────────────────────────────────────────────────────────────────────────

function renderHistorial() {
  const list = $('#historial-list')
  const sub = $('#historial-subtitle')
  if (!list) return

  const count = state.historial.length
  const completadas = state.historial.filter(s => s.estado === 'completado' || s.estado === 'cerrada').length

  if (sub) {
    if (count === 0) {
      sub.textContent = 'Aún no hay rondas anteriores. Tu primera ronda es la semana en curso.'
    } else {
      sub.textContent = completadas + ' rondas completadas — el músculo que llevas construido'
    }
  }

  if (!count) {
    list.innerHTML = ''
    return
  }

  list.innerHTML = state.historial.map(s => {
    const c = state.conteoHistorial[s.id]
    let stat
    if (s.estado === 'pendiente') {
      stat = '<span class="hist-stat pending"><i data-lucide="circle-dashed"></i> Sin ritual</span>'
    } else if (c && c.total > 0) {
      stat = '<span class="hist-stat"><i data-lucide="check-circle-2"></i> ' +
        c.hechas + '/' + c.total + ' tareas</span>'
    } else {
      stat = '<span class="hist-stat"><i data-lucide="check-circle-2"></i> Ritual hecho</span>'
    }
    return '<div class="hist-row">' +
      '<div class="hist-week">Ronda ' + s.numero_ronda + '</div>' +
      '<div class="hist-obj">' +
        (s.objetivo ? escapeHtml(s.objetivo) :
          '<span style="color:var(--text-4)">Sin objetivo definido</span>') +
        '<div class="hist-fechas">' + fechaCorta(s.fecha_inicio) + ' – ' +
          fechaCorta(s.fecha_fin) +
          (s.cruza_de_mes ? ' · cruza de mes' : '') + '</div>' +
      '</div>' +
      stat +
    '</div>'
  }).join('')

  if (window.lucide) lucide.createIcons()
}

function setupHistorialToggle() {
  const toggle = $('#historial-toggle')
  if (!toggle || toggle.dataset.bound) return
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('open')
    if (window.lucide) lucide.createIcons()
  })
  toggle.dataset.bound = '1'
}

// ────────────────────────────────────────────────────────────────────────────
// EMPTY STATE (entre vectores)
// ────────────────────────────────────────────────────────────────────────────

function renderEmptyEntreVectores() {
  // Por si en algún punto no hay semana que cubra hoy (entre vectores, error de horizonte)
  // La vista #view-empty ya está en el HTML.
}

// ────────────────────────────────────────────────────────────────────────────
// ADMIN: REGENERAR (con confirm)
// ────────────────────────────────────────────────────────────────────────────

async function onAdminRegenerar() {
  const ok = confirm(
    'ATENCIÓN: Regenerar las semanas borrará TODAS tus semanas actuales y sus tareas.\n\n' +
    'Esto solo se usa si configuraste mal el horizonte o el día de inicio.\n\n' +
    '¿Continuar?'
  )
  if (!ok) return

  // Pedir nuevas fechas (con prefill del horizonte actual)
  const desdeActual = state.semanaActual?.fecha_inicio
    || state.vector?.fecha_inicio
    || new Date().toISOString().split('T')[0]
  const desde = prompt('Fecha de inicio (YYYY-MM-DD):', desdeActual)
  if (!desde) return
  const hastaDefault = state.vector?.fecha_fin
    || new Date(new Date().getFullYear() + 3, 0, 1).toISOString().split('T')[0]
  const hasta = prompt('Fecha de fin (YYYY-MM-DD):', hastaDefault)
  if (!hasta) return

  const res = await regenerarSemanas(
    state.org.id, desde, hasta, state.vector ? state.vector.id : null
  )
  if (res.error) {
    alert('No se pudieron regenerar las semanas. Revisa la consola.')
    return
  }
  alert('Listo: ' + res.creadas + ' semanas regeneradas.')
  // Reset y recarga
  state.semanaActual = null
  state.tareas = []
  await cargarYRenderSemana()
}

// ────────────────────────────────────────────────────────────────────────────
// TEMA + LOGOUT
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
// LISTENERS
// ────────────────────────────────────────────────────────────────────────────

function setupListeners() {
  // Onboarding
  $('#btn-onb-generar')?.addEventListener('click', onGenerarPrimerVez)

  // Cerrar ritual
  $('#btn-cerrar-ritual')?.addEventListener('click', onCerrarRitual)

  // Tareas: agregar
  $('#btn-add-tarea')?.addEventListener('click', onAgregarTarea)
  $('#add-tarea-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onAgregarTarea()
  })

  // Tareas: filtros
  $$('.tareas-filter button').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tareas-filter button').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      state.filtroTareas = btn.dataset.filtro
      renderTareas()
    })
  })

  // Tareas: toggle/eliminar por delegación
  $('#tarea-list')?.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action="toggle"]')
    if (t) return onToggleTarea(t.dataset.id)
    const d = e.target.closest('[data-action="del"]')
    if (d) return onEliminarTarea(d.dataset.id)
  })

  // Auto-save de los 5 campos
  attachAutoSave()

  // Admin
  $('#btn-admin')?.addEventListener('click', onAdminRegenerar)

  // Historial toggle
  setupHistorialToggle()
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
      loadConfig(org.id), loadVectorActivo(org.id)
    ])
    state.config = config
    state.vector = vector

    // Decisión: ¿tiene semanas generadas?
    const tieneSemanas = await loadTieneSemanas(org.id)

    setupListeners()

    if (!tieneSemanas) {
      // Onboarding (una sola vez)
      renderOnboarding()
      cambiarVista('onboarding')
    } else {
      // Cargar y mostrar la semana
      await cargarYRenderSemana()
    }

    if (window.lucide) lucide.createIcons()
  } catch (err) {
    console.error('[ritmo-semanal v2] init error:', err)
  }
}

init()
