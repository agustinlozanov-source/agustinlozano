// ============================================================================
// SCALEx · Evaluaciones — Lógica de la evaluación (Módulo 6)
// ============================================================================
import { evalIniciar, evalCalificar } from './eval-client.js'

// ── Configuración (ajustable) ────────────────────────────────────────────────
const CONFIG = {
  shuffleOpciones: true,     // randomizar orden de las 4 opciones por pregunta
  shufflePreguntas: false,   // randomizar orden de las 19 preguntas (respeta bloques si false)
  retroPorPregunta: false    // false = mostrar justificaciones al final; true = tras cada envío (no usado en MVP)
}

const BLOQUES = {
  innovacion:    { label: 'Bloque A · Innovación',    orden: 1 },
  automatizacion:{ label: 'Bloque B · Automatización', orden: 2 }
}

// ── Estado ────────────────────────────────────────────────────────────────────
const state = {
  intentoId: null,
  preguntas: [],          // [{id, bloque, tipo, orden, enunciado, opciones:[{id,texto}]}]
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
  const btn  = $('#btn-comenzar')

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    err.classList.add('hidden')
    const nombre  = $('#nombre').value.trim()
    const email   = $('#email').value.trim()
    const empresa = $('#empresa').value.trim()
    if (!nombre || !email) return

    btn.disabled = true
    btn.textContent = 'Cargando…'
    try {
      const res = await evalIniciar({ nombre, email, empresa })
      if (!res.ok) return manejarInicioNoOk(res, err)

      state.intentoId = res.intento_id
      let preguntas = res.cuestionario || []
      // Randomizar opciones (y opcionalmente preguntas)
      preguntas = preguntas.map(p => ({
        ...p,
        opciones: CONFIG.shuffleOpciones ? shuffle(p.opciones) : p.opciones
      }))
      if (CONFIG.shufflePreguntas) preguntas = shuffle(preguntas)
      else preguntas.sort((a, b) => a.orden - b.orden)
      state.preguntas = preguntas

      $('#step-identidad').classList.add('hidden')
      renderCuestionario()
      $('#step-cuestionario').classList.remove('hidden')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (ex) {
      console.error(ex)
      err.textContent = 'No se pudo iniciar la evaluación. Revisa tu conexión e inténtalo de nuevo.'
      err.classList.remove('hidden')
    } finally {
      btn.disabled = false
      btn.textContent = 'Comenzar evaluación'
    }
  })
}

function manejarInicioNoOk(res, err) {
  if (res.error === 'sin_reintentos') {
    const u = res.ultimo || {}
    const nota = u.puntaje != null ? `${u.puntaje}/100` : '—'
    err.innerHTML = `Ya completaste esta evaluación (${res.max_intentos} intento permitido). ` +
                    `Tu resultado registrado: <b>${esc(nota)}</b>.`
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
  let bloqueActual = null

  state.preguntas.forEach((p, idx) => {
    if (!CONFIG.shufflePreguntas && p.bloque !== bloqueActual) {
      bloqueActual = p.bloque
      cont.appendChild(el('div', 'bloque-title', esc(BLOQUES[p.bloque]?.label || p.bloque)))
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
bindEnviar()
