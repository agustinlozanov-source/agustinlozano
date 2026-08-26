// ============================================================================
// SCALEx · Ejercicio GC — participante (tiempo real)
// ============================================================================
import { getSesion, getRespuestas, getVotos, enviarRespuesta, enviarVoto, suscribir, nuevoId } from './gc-client.js'

const $ = (s) => document.querySelector(s)
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n }
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]))

const LS = { pid: 'gc:pid', submitted: 'gc:submitted', vote: 'gc:vote' }
function pid() {
  let v = localStorage.getItem(LS.pid)
  if (!v) { v = nuevoId(); localStorage.setItem(LS.pid, v) }
  return v
}

const state = { sesion: null, respuestas: [], votos: [] }
const showErr = (m) => { const e = $('#err'); e.textContent = m; e.classList.remove('hidden'); setTimeout(() => e.classList.add('hidden'), 4000) }
const show = (id) => ['#step-form', '#step-wait', '#step-vote'].forEach(s => $(s).classList.toggle('hidden', s !== id))

// ── Carga + realtime ──────────────────────────────────────────────────────────
async function recargar() {
  const [s, r, v] = await Promise.all([getSesion(), getRespuestas(), getVotos()])
  if (s) state.sesion = s
  state.respuestas = r
  state.votos = v
  render()
}

async function init() {
  try { await recargar() } catch (e) { console.error(e); showErr('No se pudo cargar. Revisa tu conexión.') }
  suscribir(() => recargar())
  // Fallback por si realtime no llega (redes restrictivas)
  setInterval(recargar, 6000)
}

// ── Render según estado ─────────────────────────────────────────────────────
function render() {
  const s = state.sesion
  if (!s) return
  $('#h-title').textContent = s.titulo
  $('#h-sub').textContent = s.subtitulo || ''
  $('#pregunta').textContent = s.pregunta
  document.title = s.titulo

  const sintesis = Array.isArray(s.sintesis) ? s.sintesis : []
  const yaEnvie = localStorage.getItem(LS.submitted) === s.id

  if (sintesis.length > 0) { show('#step-vote'); renderVote(sintesis) }
  else if (yaEnvie) { show('#step-wait'); renderWait() }
  else { show('#step-form'); renderForm() }
}

// ── Estado 1: formulario ────────────────────────────────────────────────────
let formBound = false
function renderForm() {
  const n = $('#nombre'), t = $('#texto'), b = $('#btn-enviar')
  const upd = () => { b.disabled = !(n.value.trim() && t.value.trim()) }
  if (!formBound) {
    formBound = true
    n.addEventListener('input', upd); t.addEventListener('input', upd)
    b.addEventListener('click', enviar)
  }
  upd()
  const c = state.respuestas.length
  $('#counter-form').textContent = c ? `${c} ${c === 1 ? 'respuesta recibida' : 'respuestas recibidas'}` : ''
}

async function enviar() {
  const nombre = $('#nombre').value.trim(), texto = $('#texto').value.trim()
  if (!nombre || !texto) return
  const b = $('#btn-enviar'); b.disabled = true; b.textContent = 'Enviando…'
  try {
    const { error } = await enviarRespuesta({ participanteId: pid(), nombre, texto })
    if (error && error.code !== '23505') throw error   // 23505 = ya envió (unique)
    localStorage.setItem(LS.submitted, state.sesion.id)
    await recargar()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {
    console.error(e); showErr('No se pudo enviar. Intenta de nuevo.')
    b.disabled = false; b.textContent = 'Enviar mi definición'
  }
}

// ── Estado 2: esperando ─────────────────────────────────────────────────────
function renderWait() {
  const c = state.respuestas.length
  $('#counter-wait').textContent = `${c} ${c === 1 ? 'respuesta' : 'respuestas'} hasta ahora`
  const cont = $('#lista-wait'); cont.innerHTML = ''
  state.respuestas.forEach(r => {
    const card = el('div', 'card')
    card.appendChild(el('div', 'name', esc(r.nombre)))
    card.appendChild(el('p', 'text', esc(r.texto)))
    cont.appendChild(card)
  })
}

// ── Estado 3: votación ──────────────────────────────────────────────────────
function renderVote(sintesis) {
  $('#vote-intro').textContent = `La IA sintetizó las ${state.respuestas.length} respuestas del grupo en 3 definiciones.`
  const miVoto = localStorage.getItem(LS.vote)
  const conteo = {}
  state.votos.forEach(v => { conteo[v.opcion] = (conteo[v.opcion] || 0) + 1 })
  const total = state.votos.length
  const ganador = ganadora(conteo)

  const cont = $('#opciones'); cont.innerHTML = ''
  sintesis.forEach(opt => {
    const count = conteo[opt.label] || 0
    const pct = total > 0 ? Math.round((count / total) * 100) : 0
    const sel = miVoto === opt.label
    const isWinner = miVoto && ganador === opt.label
    const card = el('div', 'vote-card' + (sel ? ' sel' : '') + (isWinner ? ' winner' : '') + (miVoto ? ' disabled' : ''))
    card.appendChild(el('div', 'vlabel', esc(opt.label)))
    card.appendChild(el('p', 'vtext', esc(opt.text)))
    if (miVoto) {
      const bar = el('div', 'bar'); bar.appendChild(el('div', 'fill', '')); bar.querySelector('.fill').style.width = pct + '%'
      card.appendChild(bar)
      card.appendChild(el('div', 'pct', `${count} ${count === 1 ? 'voto' : 'votos'} · ${pct}%`))
    } else {
      card.addEventListener('click', () => votar(opt.label))
    }
    cont.appendChild(card)
  })

  const cc = $('#counter-vote')
  if (miVoto) { cc.classList.remove('hidden'); cc.textContent = `${total} ${total === 1 ? 'voto total' : 'votos totales'}` }
  else cc.classList.add('hidden')

  // Respuestas originales (colapsable)
  const orig = $('#respuestas-orig'); orig.innerHTML = ''
  if (state.respuestas.length) {
    const det = el('details', 'collapse')
    det.appendChild(el('summary', '', `Ver las ${state.respuestas.length} respuestas originales del grupo`))
    const wrap = el('div', 'mt')
    state.respuestas.forEach(r => {
      const card = el('div', 'card')
      card.appendChild(el('div', 'name', esc(r.nombre)))
      card.appendChild(el('p', 'text', esc(r.texto)))
      wrap.appendChild(card)
    })
    det.appendChild(wrap); orig.appendChild(det)
  }
}

function ganadora(conteo) {
  let lbl = null, max = -1
  for (const [k, v] of Object.entries(conteo)) if (v > max) { max = v; lbl = k }
  return lbl
}

async function votar(opcion) {
  if (localStorage.getItem(LS.vote)) return
  localStorage.setItem(LS.vote, opcion)
  try {
    const { error } = await enviarVoto({ participanteId: pid(), opcion })
    if (error && error.code !== '23505') throw error
    await recargar()
  } catch (e) { console.error(e); showErr('No se pudo registrar tu voto.') }
}

init()
