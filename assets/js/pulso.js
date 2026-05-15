// ============================================================================
// SCALEx PORTAL · RITMO · EL PULSO (reunión diaria)
// ============================================================================
// Pilar 4 · Ritmo · Herramienta 2
//
// La página decide su estado al cargar:
//   · sin config            → Onboarding (pantalla completa, una sola vez)
//   · día sin Pulso         → vista "no_pulso" (no es strike)
//   · Pulso programado      → vista "antes" (cuenta regresiva + botón play)
//   · Pulso en curso        → vista "en_curso" (3 bloques + impulsos)
//   · Pulso cerrado hoy     → vista "cerrado" (resumen + reabrir)
//   · Pulso cerrado ayer+   → vista "cerrado" (inmutable, sin reabrir)
//
// Auto-save por bloque (mismo patrón del Ritual Semanal v2).
// Strikes derivados de pulsos omitidos (decisión P1=B).
// Reabrir solo el mismo día calendario (decisión P-C).
//
// Depende de: scalex-sql-16-ritmo-pulsos.sql
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
const DIAS_LABELS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_LARGOS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']

let state = {
  org: null,
  profile: null,
  config: null,            // ritmo_pulsos_config
  circulo: [],             // ritmo_circulo[]
  pulsoHoy: null,          // ritmo_pulsos (puede ser null si hoy no es día de Pulso)
  semanaActual: null,      // ritmo_semanas (para el "X / Y" del objetivo semanal)
  strip: [],               // strip de la semana
  strikes: null,           // resumen de strikes
  impulsos: [],            // ritmo_tareas con origen='impulso' del día actual
  saveTimers: {},          // debounce por campo
  cronoTimer: null,        // intervalo del cronómetro en vivo
  preplayTimer: null       // intervalo de la cuenta regresiva
}

// ────────────────────────────────────────────────────────────────────────────
// SUPABASE — LOADS
// ────────────────────────────────────────────────────────────────────────────

async function loadConfig(orgId) {
  const { data, error } = await supabase
    .from('ritmo_pulsos_config').select('*')
    .eq('organizacion_id', orgId).maybeSingle()
  if (error) { console.error('[pulso] config', error); return null }
  return data
}

async function loadCirculo(orgId) {
  const { data, error } = await supabase
    .from('ritmo_circulo').select('*')
    .eq('organizacion_id', orgId).eq('activo', true)
    .order('orden', { ascending: true })
  if (error) { console.error('[pulso] circulo', error); return [] }
  return data || []
}

async function marcarOmitidos(orgId) {
  // Lazy cleanup: marca como omitidos los pulsos viejos sin cerrar
  const { error } = await supabase.rpc('ritmo_marcar_omitidos', {
    p_organizacion_id: orgId
  })
  if (error) console.error('[pulso] marcar omitidos', error)
}

async function loadPulsoDeHoy(orgId) {
  const { data, error } = await supabase
    .rpc('ritmo_pulso_de_hoy', { p_organizacion_id: orgId })
  if (error) { console.error('[pulso] pulso de hoy', error); return null }
  // setof: si no hay día de Pulso devuelve [] o null
  const row = Array.isArray(data) ? data[0] : data
  if (!row || !row.id) return null
  return row
}

async function loadStrip(orgId) {
  const { data, error } = await supabase
    .rpc('ritmo_strip_semana', { p_organizacion_id: orgId })
  if (error) { console.error('[pulso] strip', error); return [] }
  return data || []
}

async function loadStrikes(orgId) {
  const { data, error } = await supabase
    .rpc('ritmo_strikes_recientes', { p_organizacion_id: orgId, p_dias: 30 })
  if (error) { console.error('[pulso] strikes', error); return null }
  const row = Array.isArray(data) ? data[0] : data
  return row || null
}

async function loadSemanaActual(orgId) {
  const { data, error } = await supabase
    .rpc('ritmo_semana_en_curso', { p_organizacion_id: orgId })
  if (error) { console.error('[pulso] semana', error); return null }
  const row = Array.isArray(data) ? data[0] : data
  if (!row || !row.id) return null
  return row
}

async function loadImpulsosDelDia(semanaId, pulsoId) {
  if (!semanaId || !pulsoId) return []
  const { data, error } = await supabase
    .from('ritmo_tareas').select('*')
    .eq('semana_id', semanaId)
    .eq('origen_pulso_id', pulsoId)
    .order('created_at', { ascending: true })
  if (error) { console.error('[pulso] impulsos', error); return [] }
  return data || []
}

// ────────────────────────────────────────────────────────────────────────────
// SUPABASE — WRITES
// ────────────────────────────────────────────────────────────────────────────

async function guardarConfig(orgId, payload) {
  const { data, error } = await supabase
    .from('ritmo_pulsos_config')
    .upsert({ organizacion_id: orgId, ...payload })
    .select('*').single()
  if (error) { console.error('[pulso] guardar config', error); return null }
  return data
}

async function reemplazarCirculo(orgId, personas) {
  // Borra y re-inserta el círculo (más simple que diff). Se hace 1 vez en onboarding.
  await supabase.from('ritmo_circulo').delete().eq('organizacion_id', orgId)
  if (!personas.length) return []
  const rows = personas.map((p, i) => ({
    organizacion_id: orgId,
    nombre: p.nombre,
    rol_descripcion: p.rol_descripcion || null,
    orden: i + 1
  }))
  const { data, error } = await supabase.from('ritmo_circulo').insert(rows).select('*')
  if (error) { console.error('[pulso] insertar circulo', error); return [] }
  return data || []
}

async function iniciarPulso(pulsoId) {
  const { data, error } = await supabase.rpc('ritmo_iniciar_pulso', { p_pulso_id: pulsoId })
  if (error) { console.error('[pulso] iniciar', error); return null }
  return data
}

async function cerrarPulso(pulsoId) {
  const { data, error } = await supabase.rpc('ritmo_cerrar_pulso', { p_pulso_id: pulsoId })
  if (error) { console.error('[pulso] cerrar', error); return null }
  return data
}

async function reabrirPulso(pulsoId) {
  const { data, error } = await supabase.rpc('ritmo_reabrir_pulso', { p_pulso_id: pulsoId })
  if (error) {
    console.error('[pulso] reabrir', error)
    return { error: error.message || 'No se pudo reabrir' }
  }
  return { data }
}

async function actualizarBloques(pulsoId, payload) {
  const { data, error } = await supabase
    .from('ritmo_pulsos').update(payload).eq('id', pulsoId)
    .select('*').single()
  if (error) { console.error('[pulso] actualizar bloques', error); return null }
  return data
}

async function crearImpulso(payload) {
  const { data, error } = await supabase
    .from('ritmo_tareas').insert(payload).select('*').single()
  if (error) { console.error('[pulso] crear impulso', error); return null }
  return data
}

async function eliminarImpulso(id) {
  const { error } = await supabase.from('ritmo_tareas').delete().eq('id', id)
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
  return DIAS_LARGOS[date.getDay()] + ' ' + date.getDate() + ' de ' + MESES_ES[date.getMonth()]
}

function formatHHMM(timeStr) {
  // "07:55" → "07:55" (sanity check)
  if (!timeStr) return '00:00'
  return timeStr.substring(0, 5)
}

function calcularSegundosHastaPactada(horaPactada, ahora) {
  // ahora: Date local. horaPactada: "HH:MM"
  const [h, m] = horaPactada.split(':').map(Number)
  const objetivo = new Date(ahora)
  objetivo.setHours(h, m, 0, 0)
  return Math.floor((objetivo - ahora) / 1000)
}

function formatDuracion(segundos) {
  if (segundos < 0) segundos = 0
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
}

function formatDeltaMin(deltaMin) {
  if (deltaMin == null) return ''
  if (deltaMin === 0) return 'puntual'
  if (deltaMin > 0) return '+' + deltaMin + ' min'
  return deltaMin + ' min'
}

function deltaClass(deltaMin) {
  if (deltaMin == null) return ''
  if (deltaMin < -1) return 'adelantado'
  if (deltaMin <= 1) return 'ontime'
  return 'tarde'
}

function debounce(fn, ms) {
  let t
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms) }
}

function cambiarVista(nueva) {
  $$('.view').forEach(v => v.classList.remove('active'))
  const el = $('#view-' + nueva)
  if (el) el.classList.add('active')
  if (window.lucide) lucide.createIcons()
  const content = $('.content')
  if (content) content.scrollTop = 0

  // Limpiar timers de vistas anteriores
  if (state.cronoTimer && nueva !== 'en_curso') {
    clearInterval(state.cronoTimer); state.cronoTimer = null
  }
  if (state.preplayTimer && nueva !== 'antes') {
    clearInterval(state.preplayTimer); state.preplayTimer = null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// INDICADOR DE GUARDADO POR BLOQUE
// ────────────────────────────────────────────────────────────────────────────

function setSaveIndicator(indicatorId, status) {
  const el = $('#' + indicatorId)
  if (!el) return
  const isMini = el.classList.contains('mini')
  let text = 'Sin guardar'
  let cls = ''
  if (status === 'saving') { cls = 'saving'; text = 'Escribiendo...' }
  if (status === 'saved')  { cls = 'saved';  text = 'Guardado' }
  if (status === 'error')  { cls = 'error';  text = 'Error' }
  el.className = 'save-indicator ' + cls + (isMini ? ' mini' : '')
  el.innerHTML = '<span class="save-indicator-dot"></span><span>' + text + '</span>'
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: ONBOARDING (sin config)
// ────────────────────────────────────────────────────────────────────────────

function renderOnboarding() {
  // Poblar días con default Lun-Vie
  $$('.dia-chip').forEach(chip => {
    chip.classList.remove('active')
    const dia = parseInt(chip.dataset.dia, 10)
    if ([1,2,3,4,5].includes(dia)) chip.classList.add('active')
  })

  // Poblar zona horaria sugerida
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const sel = $('#onb-tz')
    if (sel) {
      // Si la opción existe la selecciona, si no la agrega
      let found = false
      Array.from(sel.options).forEach(opt => { if (opt.value === tz) { opt.selected = true; found = true } })
      if (!found) {
        const opt = document.createElement('option')
        opt.value = tz; opt.text = tz + ' (auto)'
        opt.selected = true
        sel.appendChild(opt)
      }
    }
  } catch (e) {}

  // Listener para chips de días
  $$('.dia-chip').forEach(chip => {
    if (!chip.dataset.bound) {
      chip.addEventListener('click', () => chip.classList.toggle('active'))
      chip.dataset.bound = '1'
    }
  })

  // Listener para agregar persona
  const btnAdd = $('#btn-add-circulo')
  if (btnAdd && !btnAdd.dataset.bound) {
    btnAdd.addEventListener('click', () => agregarFilaCirculo())
    btnAdd.dataset.bound = '1'
  }

  // Listener del botón generar
  const btnAct = $('#btn-activar-pulso')
  if (btnAct && !btnAct.dataset.bound) {
    btnAct.addEventListener('click', onActivarPulso)
    btnAct.dataset.bound = '1'
  }
}

function agregarFilaCirculo(nombre, rolDesc) {
  const cont = $('#circulo-list')
  if (!cont) return
  const div = document.createElement('div')
  div.className = 'rol-row'
  div.innerHTML =
    '<div class="rol-icon"><i data-lucide="user"></i></div>' +
    '<input class="rol-input rol-nombre" placeholder="Nombre" value="' + escapeHtml(nombre || '') + '">' +
    '<input class="rol-input rol-desc" placeholder="Rol (opcional)" value="' + escapeHtml(rolDesc || '') + '">' +
    '<button class="rol-del" title="Quitar"><i data-lucide="x"></i></button>'
  cont.appendChild(div)
  div.querySelector('.rol-del').addEventListener('click', () => div.remove())
  if (window.lucide) lucide.createIcons()
}

async function onActivarPulso() {
  const hora = $('#onb-hora').value
  if (!/^[0-2][0-9]:[0-5][0-9]$/.test(hora)) {
    alert('Define una hora válida (formato HH:MM, ej: 07:55)')
    return
  }
  const dias = $$('.dia-chip.active').map(c => parseInt(c.dataset.dia, 10)).sort()
  if (!dias.length) {
    alert('Marca al menos un día con Pulso')
    return
  }

  // Recolectar círculo
  const personas = $$('#circulo-list .rol-row').map(row => ({
    nombre: row.querySelector('.rol-nombre').value.trim(),
    rol_descripcion: row.querySelector('.rol-desc').value.trim() || null
  })).filter(p => p.nombre)

  if (personas.length < 3) {
    alert('El círculo del Pulso necesita al menos 3 personas. Agrega más antes de activar.')
    return
  }

  const tz = $('#onb-tz').value
  const ventana = parseInt($('#onb-ventana').value, 10) || 10

  const btn = $('#btn-activar-pulso')
  btn.disabled = true
  const orig = btn.innerHTML
  btn.innerHTML = '<div class="spinner-sm"></div><span>Activando...</span>'

  const config = await guardarConfig(state.org.id, {
    hora_pactada: hora,
    dias_con_pulso: dias,
    zona_horaria: tz,
    ventana_play_min: ventana
  })

  if (!config) {
    btn.disabled = false
    btn.innerHTML = orig
    if (window.lucide) lucide.createIcons()
    alert('No se pudo guardar la configuración')
    return
  }

  const circuloGuardado = await reemplazarCirculo(state.org.id, personas)
  if (!circuloGuardado.length) {
    btn.disabled = false
    btn.innerHTML = orig
    if (window.lucide) lucide.createIcons()
    alert('No se pudo guardar el círculo')
    return
  }

  state.config = config
  state.circulo = circuloGuardado

  await cargarYDecidirVista()
}

// ────────────────────────────────────────────────────────────────────────────
// HEADER DEL DÍA (chips de contexto)
// ────────────────────────────────────────────────────────────────────────────

function renderDayHeader() {
  const cont = $('#day-meta-container')
  if (!cont) return
  const hoy = new Date()
  const fechaTxt = DIAS_LARGOS[hoy.getDay()] + ' ' + hoy.getDate() + ' de ' + MESES_ES[hoy.getMonth()]

  let html = '<span class="day-chip"><i data-lucide="calendar"></i> ' + escapeHtml(fechaTxt) + '</span>'

  if (state.semanaActual) {
    html += '<span class="day-chip ronda"><i data-lucide="git-commit"></i> Ronda ' +
      state.semanaActual.numero_ronda + '</span>'
    if (state.semanaActual.objetivo) {
      const obj = state.semanaActual.objetivo.length > 60
        ? state.semanaActual.objetivo.substring(0, 60) + '…'
        : state.semanaActual.objetivo
      html += '<span class="day-chip objetivo"><i data-lucide="target"></i> Objetivo: ' +
        escapeHtml(obj) + '</span>'
    }
  }
  cont.innerHTML = html
  if (window.lucide) lucide.createIcons()
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: ANTES DEL PULSO
// ────────────────────────────────────────────────────────────────────────────

function renderAntes() {
  if (!state.pulsoHoy || !state.config) return

  $('#preplay-hora').textContent = formatHHMM(state.pulsoHoy.hora_pactada)
  renderRolesHoy()
  renderStrip()

  // Cuenta regresiva en vivo
  if (state.preplayTimer) clearInterval(state.preplayTimer)
  state.preplayTimer = setInterval(tickPreplay, 1000)
  tickPreplay()
}

function tickPreplay() {
  if (!state.pulsoHoy || !state.config) return
  const ahora = new Date()
  const segundosHasta = calcularSegundosHastaPactada(state.pulsoHoy.hora_pactada, ahora)
  const ventanaSeg = (state.config.ventana_play_min || 10) * 60

  const horaAhora = ahora.getHours().toString().padStart(2,'0') + ':' +
                    ahora.getMinutes().toString().padStart(2,'0')

  const lblCuenta = $('#preplay-cuenta')
  const btn = $('#btn-start-pulso')

  if (segundosHasta > ventanaSeg) {
    // Aún falta mucho
    const min = Math.ceil(segundosHasta / 60)
    lblCuenta.innerHTML = 'Faltan <strong>' + min + ' min</strong> · son las ' + horaAhora
    btn.disabled = true
  } else if (segundosHasta > 0) {
    // Dentro de la ventana de play
    const min = Math.ceil(segundosHasta / 60)
    lblCuenta.innerHTML = 'Listos · faltan <strong>' + min + ' min</strong> · son las ' + horaAhora
    btn.disabled = false
  } else {
    // Hora pactada o después
    const minTarde = Math.floor(-segundosHasta / 60)
    if (minTarde === 0) {
      lblCuenta.innerHTML = '<strong>Es la hora</strong> · son las ' + horaAhora
    } else {
      lblCuenta.innerHTML = 'Pasaron <strong>' + minTarde + ' min</strong> de la hora pactada · son las ' + horaAhora
    }
    btn.disabled = false
  }
}

async function onStartPulso() {
  const btn = $('#btn-start-pulso')
  btn.disabled = true
  const updated = await iniciarPulso(state.pulsoHoy.id)
  if (!updated) {
    btn.disabled = false
    alert('No se pudo iniciar el Pulso')
    return
  }
  state.pulsoHoy = updated
  await renderEnCurso()
  cambiarVista('en_curso')
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: EN CURSO
// ────────────────────────────────────────────────────────────────────────────

async function renderEnCurso() {
  if (!state.pulsoHoy) return

  // Banner: horas y delta
  const horaPactada = formatHHMM(state.pulsoHoy.hora_pactada)
  $('#live-hora-pactada').textContent = horaPactada

  if (state.pulsoHoy.hora_real_inicio) {
    const inicio = new Date(state.pulsoHoy.hora_real_inicio)
    const hh = inicio.getHours().toString().padStart(2,'0') + ':' +
               inicio.getMinutes().toString().padStart(2,'0')
    $('#live-hora-inicio').textContent = hh
  }
  const delta = state.pulsoHoy.delta_minutos
  const deltaEl = $('#live-delta')
  if (delta != null) {
    deltaEl.textContent = formatDeltaMin(delta)
    deltaEl.className = 'live-delta ' + deltaClass(delta)
    deltaEl.style.display = 'inline-block'
  } else {
    deltaEl.style.display = 'none'
  }

  renderRolesHoy()

  // Bloques (texto previo)
  $('#bloque-avanzo').value = state.pulsoHoy.lo_que_avanzo || ''
  $('#bloque-numero').value = state.pulsoHoy.numero_de_hoy || ''
  $('#bloque-traba').value  = state.pulsoHoy.lo_que_traba || ''

  // Indicadores
  ['save-avanzo','save-numero','save-traba'].forEach(id => {
    const inputId = id.replace('save-', 'bloque-')
    setSaveIndicator(id, ($('#'+inputId).value ? 'saved' : ''))
  })

  // Contexto del objetivo semanal
  renderNumeroContext()

  // Impulsos del día
  state.impulsos = await loadImpulsosDelDia(
    state.semanaActual?.id,
    state.pulsoHoy.id
  )
  renderImpulsos()

  // Cronómetro vivo
  if (state.cronoTimer) clearInterval(state.cronoTimer)
  state.cronoTimer = setInterval(tickCronometro, 1000)
  tickCronometro()
}

function tickCronometro() {
  if (!state.pulsoHoy?.hora_real_inicio) return
  const inicio = new Date(state.pulsoHoy.hora_real_inicio)
  const ahora = new Date()
  const seg = Math.floor((ahora - inicio) / 1000)
  const el = $('#live-crono')
  if (el) el.textContent = formatDuracion(seg)
}

function renderNumeroContext() {
  const cont = $('#numero-context')
  if (!cont) return
  if (state.semanaActual?.objetivo) {
    cont.innerHTML =
      '<i data-lucide="target" style="width:14px;height:14px;color:var(--indigo);"></i>' +
      '<span>Objetivo semanal: <strong>' + escapeHtml(state.semanaActual.objetivo) + '</strong></span>'
    cont.style.display = 'flex'
    if (window.lucide) lucide.createIcons()
  } else {
    cont.style.display = 'none'
  }
}

// ── Auto-save de los 3 bloques ──

const CAMPOS_BLOQUE = [
  { input: 'bloque-avanzo', column: 'lo_que_avanzo', indicator: 'save-avanzo' },
  { input: 'bloque-numero', column: 'numero_de_hoy', indicator: 'save-numero' },
  { input: 'bloque-traba',  column: 'lo_que_traba',  indicator: 'save-traba'  }
]

function attachBloquesAutoSave() {
  CAMPOS_BLOQUE.forEach(c => {
    const el = $('#' + c.input)
    if (!el || el.dataset.boundSave) return
    el.dataset.boundSave = '1'
    el.addEventListener('input', () => {
      setSaveIndicator(c.indicator, 'saving')
      clearTimeout(state.saveTimers[c.input])
      state.saveTimers[c.input] = setTimeout(async () => {
        if (!state.pulsoHoy) return
        const payload = {}
        payload[c.column] = (el.value || '').trim() || null
        const updated = await actualizarBloques(state.pulsoHoy.id, payload)
        if (updated) {
          state.pulsoHoy = { ...state.pulsoHoy, ...updated }
          setSaveIndicator(c.indicator, 'saved')
        } else {
          setSaveIndicator(c.indicator, 'error')
        }
      }, 900)
    })
  })
}

// ── Impulsos del día ──

function renderImpulsos() {
  const cont = $('#impulsos-list')
  if (!cont) return
  if (!state.impulsos.length) {
    cont.innerHTML =
      '<div style="font-size:11.5px;color:var(--text-4);font-style:italic;padding:6px 0;">Aún no hay impulsos. Los acuerdos catalizadores del Pulso aparecen aquí.</div>'
    return
  }
  cont.innerHTML = state.impulsos.map(imp =>
    '<div class="impulso-row">' +
      '<div class="impulso-row-icon"><i data-lucide="zap"></i></div>' +
      '<div class="impulso-row-text">' + escapeHtml(imp.titulo) + '</div>' +
      '<div class="impulso-row-meta">' +
        (imp.responsable ? escapeHtml(imp.responsable) + ' · ' : '') +
        (imp.fecha_objetivo ? fechaCorta(imp.fecha_objetivo) : 'hoy') +
      '</div>' +
      '<button class="impulso-del" data-id="' + imp.id + '" title="Quitar"><i data-lucide="x"></i></button>' +
    '</div>'
  ).join('')

  cont.querySelectorAll('.impulso-del').forEach(btn => {
    btn.addEventListener('click', () => onEliminarImpulso(btn.dataset.id))
  })

  if (window.lucide) lucide.createIcons()
}

async function onAgregarImpulso() {
  const input = $('#impulso-input')
  const titulo = input.value.trim()
  if (!titulo) { input.focus(); return }
  if (!state.pulsoHoy || !state.semanaActual) {
    alert('No hay semana en curso para asociar este impulso. Crea el Ritual Semanal primero.')
    return
  }

  const respInput = $('#impulso-responsable')
  const responsable = respInput?.value.trim() || null

  const hoy = new Date().toISOString().split('T')[0]

  const impulso = await crearImpulso({
    organizacion_id: state.org.id,
    semana_id: state.semanaActual.id,
    titulo,
    responsable,
    fecha_objetivo: hoy,
    origen: 'impulso',
    origen_pulso_id: state.pulsoHoy.id,
    orden: state.impulsos.length
  })
  if (!impulso) {
    alert('No se pudo crear el impulso')
    return
  }
  state.impulsos.push(impulso)
  input.value = ''
  if (respInput) respInput.value = ''
  renderImpulsos()
}

async function onEliminarImpulso(id) {
  const ok = await eliminarImpulso(id)
  if (!ok) return
  state.impulsos = state.impulsos.filter(i => i.id !== id)
  renderImpulsos()
}

// ── Cerrar el Pulso ──

async function onCerrarPulso() {
  if (!state.pulsoHoy) return
  const btn = $('#btn-cerrar-pulso')
  btn.disabled = true
  const updated = await cerrarPulso(state.pulsoHoy.id)
  btn.disabled = false
  if (!updated) {
    alert('No se pudo cerrar el Pulso')
    return
  }
  state.pulsoHoy = updated
  await renderCerrado()
  cambiarVista('cerrado')
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: CERRADO
// ────────────────────────────────────────────────────────────────────────────

async function renderCerrado() {
  if (!state.pulsoHoy) return

  // Stats del header
  const dur = state.pulsoHoy.duracion_segundos
    ? formatDuracion(state.pulsoHoy.duracion_segundos)
    : '—'
  $('#done-title').textContent = 'Pulso cerrado · duró ' + dur

  const delta = state.pulsoHoy.delta_minutos
  const horaInicio = state.pulsoHoy.hora_real_inicio
    ? new Date(state.pulsoHoy.hora_real_inicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : '—'
  $('#done-text').textContent =
    'Inició ' + horaInicio + ' (' + formatDeltaMin(delta) + ' de la hora pactada)'

  // Recargar impulsos del día
  state.impulsos = await loadImpulsosDelDia(state.semanaActual?.id, state.pulsoHoy.id)
  $('#done-stat-impulsos').textContent = state.impulsos.length
  $('#done-stat-numero').textContent = state.pulsoHoy.numero_de_hoy || '—'

  // Resumen de bloques
  $('#resumen-avanzo').textContent = state.pulsoHoy.lo_que_avanzo || '— sin notas —'
  $('#resumen-numero').textContent = state.pulsoHoy.numero_de_hoy || '—'
  $('#resumen-traba').textContent  = state.pulsoHoy.lo_que_traba || '— sin notas —'

  // Contexto del número vs objetivo
  const ctxEl = $('#resumen-numero-context')
  if (state.semanaActual?.objetivo) {
    ctxEl.innerHTML = '<span class="resumen-bloque-numero-sub">objetivo: ' +
      escapeHtml(state.semanaActual.objetivo) + '</span>'
    ctxEl.style.display = 'inline'
  } else {
    ctxEl.style.display = 'none'
  }

  // Botón reabrir: solo si la fecha del pulso es hoy
  const hoyIso = new Date().toISOString().split('T')[0]
  const btnReabrir = $('#btn-reabrir-pulso')
  if (btnReabrir) {
    if (state.pulsoHoy.fecha === hoyIso) {
      btnReabrir.style.display = 'inline-flex'
    } else {
      btnReabrir.style.display = 'none'
    }
  }

  renderStrip()
}

async function onReabrirPulso() {
  if (!confirm('¿Reabrir el Pulso? Volverás a la vista en curso para editar los bloques.')) return
  const res = await reabrirPulso(state.pulsoHoy.id)
  if (res.error) {
    alert(res.error)
    return
  }
  state.pulsoHoy = res.data
  await renderEnCurso()
  cambiarVista('en_curso')
}

// ────────────────────────────────────────────────────────────────────────────
// ROLES DEL DÍA
// ────────────────────────────────────────────────────────────────────────────

function renderRolesHoy() {
  if (!state.pulsoHoy) return
  const dirige = state.circulo.find(p => p.id === state.pulsoHoy.rol_dirige_id)
  const apunta = state.circulo.find(p => p.id === state.pulsoHoy.rol_apuntador_id)
  const tiempo = state.circulo.find(p => p.id === state.pulsoHoy.rol_tiempo_id)

  $$('.roles-hoy-container').forEach(cont => {
    cont.innerHTML =
      rolCardHTML('Dirige hoy', 'megaphone', dirige) +
      rolCardHTML('Apunta hoy', 'edit-3', apunta) +
      rolCardHTML('Facilita el tiempo', 'timer', tiempo)
  })
  if (window.lucide) lucide.createIcons()
}

function rolCardHTML(label, icon, persona) {
  return '<div class="rol-card">' +
    '<div class="rol-card-icon"><i data-lucide="' + icon + '"></i></div>' +
    '<div class="rol-card-info">' +
      '<div class="rol-card-label">' + label + '</div>' +
      '<div class="rol-card-name">' + escapeHtml(persona?.nombre || '— sin asignar —') + '</div>' +
    '</div>' +
  '</div>'
}

// ────────────────────────────────────────────────────────────────────────────
// STRIP DE LA SEMANA
// ────────────────────────────────────────────────────────────────────────────

function renderStrip() {
  $$('.pulsos-strip-container').forEach(cont => {
    if (!state.strip.length) {
      cont.innerHTML = '<div style="font-size:12px;color:var(--text-4);text-align:center;padding:8px;">Sin datos de la semana</div>'
      return
    }
    cont.innerHTML = state.strip.map(d => {
      const date = new Date(d.fecha + 'T12:00:00')
      const dayLabel = DIAS_LABELS[d.dia_iso] || '—'
      const num = date.getDate()
      let cls = 'pulso-day'
      let txt = '—'
      switch (d.estado_dia) {
        case 'hecho':         cls += ' done';         txt = 'Hecho'; break
        case 'strike':        cls += ' strike';       txt = 'Strike'; break
        case 'en_curso':      cls += ' en-curso';     txt = 'En curso'; break
        case 'hoy':           cls += ' today';        txt = 'Hoy'; break
        case 'futuro':                                txt = '—'; break
        case 'no_laborable':  cls += ' no-laborable'; txt = 'Libre'; break
      }
      return '<div class="' + cls + '">' +
        '<div class="pulso-day-dia">' + dayLabel + '</div>' +
        '<div class="pulso-day-num">' + num + '</div>' +
        '<div class="pulso-day-status">' + txt + '</div>' +
      '</div>'
    }).join('')
  })

  // Resumen de strikes
  if (state.strikes) {
    $$('.strikes-summary-container').forEach(cont => {
      const total = state.strikes.strikes_7d || 0
      let cls = 'strikes-summary'
      let msg
      if (total === 0) {
        msg = '<strong>0 strikes</strong> en los últimos 7 días — el latido sostenido'
      } else if (total === 1) {
        cls += ' warn'
        msg = '<strong>1 strike</strong> esta semana · 2 más y el sistema marca alerta'
      } else if (total === 2) {
        cls += ' warn'
        msg = '<strong>2 strikes</strong> esta semana · 1 más y el sistema marca alerta'
      } else {
        cls += ' crit'
        msg = '<strong>' + total + ' strikes</strong> en 7 días · algo de fondo está mal'
      }
      cont.innerHTML = '<div class="' + cls + '">' +
        '<i data-lucide="alert-triangle"></i><span>' + msg + '</span>' +
      '</div>'
    })
  }

  if (window.lucide) lucide.createIcons()
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: DÍA SIN PULSO
// ────────────────────────────────────────────────────────────────────────────

function renderNoPulso() {
  if (!state.config) return
  const hoy = new Date()
  const dow = ((hoy.getDay() + 6) % 7) + 1  // ISO: 1=lun..7=dom
  const horaTxt = formatHHMM(state.config.hora_pactada)

  // Próximo día con Pulso
  let prox = null
  for (let i = 1; i <= 14; i++) {
    const fecha = new Date(hoy)
    fecha.setDate(hoy.getDate() + i)
    const proxDow = ((fecha.getDay() + 6) % 7) + 1
    if (state.config.dias_con_pulso.includes(proxDow)) {
      prox = fecha
      break
    }
  }

  const lblProx = $('#nopulso-proximo')
  if (prox && lblProx) {
    const proxTxt = DIAS_LARGOS[prox.getDay()] + ' ' + prox.getDate() + ' a las ' + horaTxt
    lblProx.innerHTML = 'Siguiente Pulso: <strong style="margin-left:4px;">' +
      escapeHtml(proxTxt) + '</strong>'
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CARGAR Y DECIDIR VISTA
// ────────────────────────────────────────────────────────────────────────────

async function cargarYDecidirVista() {
  // Si no hay config → Onboarding
  if (!state.config) {
    renderOnboarding()
    cambiarVista('onboarding')
    return
  }

  // Cleanup: marcar omitidos pendientes
  await marcarOmitidos(state.org.id)

  // Cargar todo en paralelo
  const [pulso, strip, strikes, semana] = await Promise.all([
    loadPulsoDeHoy(state.org.id),
    loadStrip(state.org.id),
    loadStrikes(state.org.id),
    loadSemanaActual(state.org.id)
  ])
  state.pulsoHoy = pulso
  state.strip = strip
  state.strikes = strikes
  state.semanaActual = semana

  renderDayHeader()

  // Decisión de vista
  if (!pulso) {
    renderNoPulso()
    cambiarVista('no_pulso')
    return
  }

  switch (pulso.estado) {
    case 'programado':
      renderAntes()
      cambiarVista('antes')
      break
    case 'en_curso':
      await renderEnCurso()
      cambiarVista('en_curso')
      break
    case 'cerrado':
      await renderCerrado()
      cambiarVista('cerrado')
      break
    default:
      renderNoPulso()
      cambiarVista('no_pulso')
  }
}

// ────────────────────────────────────────────────────────────────────────────
// LISTENERS GLOBALES
// ────────────────────────────────────────────────────────────────────────────

function setupListeners() {
  // Botones de las vistas activas
  $('#btn-start-pulso')?.addEventListener('click', onStartPulso)
  $('#btn-cerrar-pulso')?.addEventListener('click', onCerrarPulso)
  $('#btn-reabrir-pulso')?.addEventListener('click', onReabrirPulso)

  // Impulsos
  $('#btn-add-impulso')?.addEventListener('click', onAgregarImpulso)
  $('#impulso-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onAgregarImpulso()
  })

  // Auto-save de los bloques
  attachBloquesAutoSave()

  // Config (en topbar)
  $('#btn-config-pulso')?.addEventListener('click', () => {
    if (confirm('Para reconfigurar el Pulso (hora, días, círculo), tendremos que borrar tu config actual. Los Pulsos históricos no se pierden. ¿Continuar?')) {
      onResetConfig()
    }
  })
}

async function onResetConfig() {
  // Borra solo la config y el círculo (los pulsos quedan como histórico).
  await supabase.from('ritmo_circulo').delete().eq('organizacion_id', state.org.id)
  await supabase.from('ritmo_pulsos_config').delete().eq('organizacion_id', state.org.id)
  state.config = null
  state.circulo = []
  renderOnboarding()
  cambiarVista('onboarding')
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

    // Cargar config + círculo
    const [config, circulo] = await Promise.all([
      loadConfig(org.id),
      loadCirculo(org.id)
    ])
    state.config = config
    state.circulo = circulo

    setupListeners()
    await cargarYDecidirVista()

    if (window.lucide) lucide.createIcons()
  } catch (err) {
    console.error('[pulso] init error', err)
  }
}

init()
