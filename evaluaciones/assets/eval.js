// ============================================================================
// SCALEx · Evaluaciones — Lógica de la evaluación (Módulo 6)
// ============================================================================
import { evalCatalogo, evalIniciar, evalCalificar } from './eval-client.js'

// ── Configuración (ajustable) ────────────────────────────────────────────────
const CONFIG = {
  shuffleOpciones: true,     // randomizar orden de las 4 opciones por pregunta
  shufflePreguntas: false,   // randomizar orden de las 19 preguntas (respeta bloques si false)
  retroPorPregunta: false    // false = mostrar justificaciones al final; true = tras cada envío (no usado en MVP)
}

// Etiquetas para el tag interno `tema` (agrupa preguntas dentro de una evaluación)
const TEMAS = {
  innovacion:    'Innovación',
  automatizacion:'Automatización'
}

// ── Estado ────────────────────────────────────────────────────────────────────
const state = {
  identidad: null,        // {nombre, email, empresa}
  catalogo: [],           // [{id, programa, anio, modulo, bloque, titulo}]
  evaluacionId: null,
  intentoId: null,
  preguntas: [],          // [{id, tema, tipo, orden, enunciado, opciones:[{id,texto}]}]
  respuestas: new Map()   // pregunta_id -> opcion_id
}

// ── Utilidades ───────────────────────────────────────────────────────────────
const $ = (sel, root = document) => root.querySelector(sel)
const el = (tag, cls, html) => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (html != null) n.innerHTML = html
  return n
}
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]))

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Paso 1: Identidad ─────────────────────────────────────────────────────────
function bindIdentidad() {
  const form = $('#form-identidad')
  const err  = $('#identidad-error')

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    err.classList.add('hidden')
    const nombre  = $('#nombre').value.trim()
    const email   = $('#email').value.trim()
    const empresa = $('#empresa').value.trim()
    if (!nombre || !email) return

    state.identidad = { nombre, email, empresa }
    $('#step-identidad').classList.add('hidden')
    $('#step-seleccion').classList.remove('hidden')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    await cargarCatalogo()
  })
}

// ── Paso 2: Selección de la evaluación (cascada) ──────────────────────────────
const selP = () => $('#sel-programa'), selA = () => $('#sel-anio')
const selM = () => $('#sel-modulo'),   selB = () => $('#sel-bloque')

function llenarSelect(sel, valores, placeholder) {
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    valores.map(v => `<option value="${esc(String(v))}">${esc(String(v))}</option>`).join('')
  sel.disabled = valores.length === 0
}
const distinct = (arr) => [...new Set(arr)]

async function cargarCatalogo() {
  const err = $('#seleccion-error')
  err.classList.add('hidden')
  try {
    if (!state.catalogo.length) state.catalogo = await evalCatalogo()
    if (!state.catalogo.length) {
      err.textContent = 'No hay evaluaciones disponibles por ahora.'
      err.classList.remove('hidden')
      return
    }
    llenarSelect(selP(), distinct(state.catalogo.map(e => e.programa)).sort(), 'Elige un programa…')
    ;[selA(), selM(), selB()].forEach(s => { s.innerHTML = ''; s.disabled = true })
    wireCascada()
  } catch (ex) {
    console.error(ex)
    err.textContent = 'No se pudo cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.'
    err.classList.remove('hidden')
  }
}

function wireCascada() {
  const info = $('#seleccion-info'), btn = $('#btn-comenzar')
  const reset = (...sels) => sels.forEach(s => { s.innerHTML = ''; s.disabled = true })
  const filtrar = (pred) => state.catalogo.filter(pred)

  const revisar = () => {
    const p = selP().value, a = selA().value, m = selM().value, b = selB().value
    const match = state.catalogo.find(e =>
      e.programa === p && String(e.anio) === a && e.modulo === m && e.bloque === b)
    state.evaluacionId = match ? match.id : null
    btn.disabled = !match
    if (match) {
      info.innerHTML = `<b>${esc(match.titulo)}</b>`
      info.classList.remove('hidden')
    } else {
      info.classList.add('hidden')
    }
  }

  selP().addEventListener('change', () => {
    const p = selP().value
    reset(selM(), selB()); info.classList.add('hidden'); btn.disabled = true; state.evaluacionId = null
    llenarSelect(selA(), distinct(filtrar(e => e.programa === p).map(e => e.anio))
      .sort((x, y) => y - x), 'Elige el año…')
    revisar()
  })
  selA().addEventListener('change', () => {
    const p = selP().value, a = selA().value
    reset(selB()); info.classList.add('hidden'); btn.disabled = true; state.evaluacionId = null
    llenarSelect(selM(), distinct(filtrar(e => e.programa === p && String(e.anio) === a).map(e => e.modulo)).sort(),
      'Elige el módulo…')
    revisar()
  })
  selM().addEventListener('change', () => {
    const p = selP().value, a = selA().value, m = selM().value
    info.classList.add('hidden'); btn.disabled = true; state.evaluacionId = null
    llenarSelect(selB(), distinct(filtrar(e => e.programa === p && String(e.anio) === a && e.modulo === m).map(e => e.bloque)).sort(),
      'Elige el bloque…')
    revisar()
  })
  selB().addEventListener('change', revisar)
}

function bindSeleccion() {
  $('#btn-atras').addEventListener('click', () => {
    $('#step-seleccion').classList.add('hidden')
    $('#step-identidad').classList.remove('hidden')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })

  $('#btn-comenzar').addEventListener('click', async () => {
    if (!state.evaluacionId) return
    const err = $('#seleccion-error'), btn = $('#btn-comenzar')
    err.classList.add('hidden')
    btn.disabled = true
    const prev = btn.textContent
    btn.textContent = 'Cargando…'
    try {
      const res = await evalIniciar({ ...state.identidad, evaluacionId: state.evaluacionId })
      if (!res.ok) { manejarInicioNoOk(res, err); btn.disabled = false; btn.textContent = prev; return }

      state.intentoId = res.intento_id
      let preguntas = (res.cuestionario || []).map(p => ({
        ...p, opciones: CONFIG.shuffleOpciones ? shuffle(p.opciones) : p.opciones
      }))
      if (CONFIG.shufflePreguntas) preguntas = shuffle(preguntas)
      else preguntas.sort((a, b) => a.orden - b.orden)
      state.preguntas = preguntas

      $('#eval-titulo').textContent = res.evaluacion?.titulo || 'Evaluación'
      $('#p-count').textContent = `0 / ${preguntas.length}`
      $('#step-seleccion').classList.add('hidden')
      renderCuestionario()
      $('#step-cuestionario').classList.remove('hidden')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (ex) {
      console.error(ex)
      err.textContent = 'No se pudo iniciar la evaluación. Revisa tu conexión e inténtalo de nuevo.'
      err.classList.remove('hidden')
      btn.disabled = false
      btn.textContent = prev
    }
  })
}

function manejarInicioNoOk(res, err) {
  if (res.error === 'sin_reintentos') {
    const u = res.ultimo || {}
    const nota = u.puntaje != null ? `${u.puntaje}/100` : '—'
    err.innerHTML = `Ya completaste esta evaluación (${res.max_intentos} intento permitido). ` +
                    `Tu resultado registrado: <b>${esc(nota)}</b>.`
  } else if (res.error === 'evaluacion_no_disponible') {
    err.textContent = 'Esa evaluación ya no está disponible. Elige otra.'
  } else if (res.error === 'email_requerido') {
    err.textContent = 'El correo es obligatorio.'
  } else if (res.error === 'nombre_requerido') {
    err.textContent = 'El nombre es obligatorio.'
  } else {
    err.textContent = 'No se pudo iniciar la evaluación.'
  }
  err.classList.remove('hidden')
}

// ── Paso 2: Cuestionario ──────────────────────────────────────────────────────
function renderCuestionario() {
  const cont = $('#preguntas')
  cont.innerHTML = ''
  let temaActual = null

  state.preguntas.forEach((p, idx) => {
    if (!CONFIG.shufflePreguntas && p.tema && p.tema !== temaActual) {
      temaActual = p.tema
      cont.appendChild(el('div', 'bloque-title', esc(TEMAS[p.tema] || p.tema)))
    }

    const q = el('div', 'q')
    q.dataset.pregunta = p.id

    const head = el('div', 'qhead')
    head.appendChild(el('span', 'num', `#${idx + 1}`))
    head.appendChild(el('span', 'tag', esc(p.tipo)))
    q.appendChild(head)
    q.appendChild(el('div', 'enunciado', esc(p.enunciado)))

    const ops = el('div', 'opciones')
    p.opciones.forEach(o => {
      const label = el('label', 'op')
      label.dataset.opcion = o.id
      const input = el('input')
      input.type = 'radio'
      input.name = `p${p.id}`
      input.value = o.id
      input.addEventListener('change', () => onSelect(p.id, o.id, ops, label))
      label.appendChild(input)
      label.appendChild(el('span', 'txt', esc(o.texto)))
      ops.appendChild(label)
    })
    q.appendChild(ops)
    cont.appendChild(q)
  })

  updateProgress()
}

function onSelect(preguntaId, opcionId, opsEl, labelEl) {
  state.respuestas.set(preguntaId, opcionId)
  opsEl.querySelectorAll('.op').forEach(l => l.classList.remove('sel'))
  labelEl.classList.add('sel')
  updateProgress()
}

function updateProgress() {
  const total = state.preguntas.length
  const done = state.respuestas.size
  $('#p-count').textContent = `${done} / ${total}`
  $('#p-bar').style.width = `${total ? (done / total) * 100 : 0}%`
  $('#btn-enviar').disabled = done < total
  $('#faltan').textContent = done < total ? `Faltan ${total - done} por responder` : '¡Todo listo para enviar!'
}

function bindEnviar() {
  const btn = $('#btn-enviar')
  const err = $('#cuestionario-error')
  btn.addEventListener('click', async () => {
    if (state.respuestas.size < state.preguntas.length) return
    err.classList.add('hidden')
    btn.disabled = true
    btn.textContent = 'Calificando…'
    try {
      const respuestas = [...state.respuestas.entries()].map(([pregunta_id, opcion_id]) => ({ pregunta_id, opcion_id }))
      const res = await evalCalificar({ intentoId: state.intentoId, respuestas })
      if (!res.ok) {
        err.textContent = res.error === 'intento_ya_enviado'
          ? 'Este intento ya fue enviado.'
          : 'No se pudo calificar la evaluación.'
        err.classList.remove('hidden')
        btn.disabled = false
        btn.textContent = 'Enviar evaluación'
        return
      }
      renderResultado(res)
      $('#step-cuestionario').classList.add('hidden')
      $('#step-resultado').classList.remove('hidden')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (ex) {
      console.error(ex)
      err.textContent = 'Error de conexión al calificar. Inténtalo de nuevo.'
      err.classList.remove('hidden')
      btn.disabled = false
      btn.textContent = 'Enviar evaluación'
    }
  })
}

// ── Paso 3: Resultado + retroalimentación ─────────────────────────────────────
function renderResultado(res) {
  const box = $('#score')
  box.className = `score ${res.aprobado ? 'aprob' : 'reprob'}`
  box.innerHTML = `
    <div class="lbl">${res.aprobado ? 'Aprobado' : 'No aprobado'}</div>
    <div class="big">${res.puntaje}</div>
    <div class="lbl">de 100</div>
    <div class="meta">${res.correctas} de ${res.total} correctas · umbral ${res.umbral}</div>
  `

  // Mapa id-opción -> texto (desde el cuestionario que ya tenemos en memoria)
  const textoOpcion = new Map()
  state.preguntas.forEach(p => p.opciones.forEach(o => textoOpcion.set(o.id, o.texto)))
  const enunciadoPorId = new Map(state.preguntas.map(p => [p.id, p.enunciado]))

  const cont = $('#retro')
  cont.innerHTML = ''
  ;(res.detalle || []).forEach((d, idx) => {
    const q = el('div', 'q')
    const head = el('div', 'qhead')
    head.appendChild(el('span', 'num', `#${idx + 1}`))
    head.appendChild(el('span', 'tag', d.correcta ? '✔ Correcta' : '✗ Revisar'))
    q.appendChild(head)
    q.appendChild(el('div', 'enunciado', esc(d.enunciado || enunciadoPorId.get(d.pregunta_id) || '')))

    const elegida = d.opcion_elegida_id
    const correcta = d.opcion_correcta_id

    const wrap = el('div', 'opciones')
    // Tu respuesta
    if (elegida != null) {
      const li = el('label', `op ${d.correcta ? 'correcta' : 'incorrecta'}`)
      li.appendChild(el('span', 'txt', `<b>Tu respuesta:</b> ${esc(textoOpcion.get(elegida) || '—')}`))
      li.appendChild(el('span', 'mark', d.correcta ? '✔' : '✗'))
      wrap.appendChild(li)
    }
    // Respuesta correcta (si te equivocaste)
    if (!d.correcta && correcta != null) {
      const li = el('label', 'op correcta')
      li.appendChild(el('span', 'txt', `<b>Correcta:</b> ${esc(textoOpcion.get(correcta) || '—')}`))
      li.appendChild(el('span', 'mark', '✔'))
      wrap.appendChild(li)
    }
    q.appendChild(wrap)
    q.appendChild(el('div', 'justif', `<b>Por qué:</b> ${esc(d.justificacion)}`))
    cont.appendChild(q)
  })
}

// ── Init ──────────────────────────────────────────────────────────────────────
bindIdentidad()
bindSeleccion()
bindEnviar()
