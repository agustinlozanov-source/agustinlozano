// ============================================================================
// SCALEx · Ejercicio GC — panel del facilitador
// ============================================================================
// Lee en vivo con la anon key (igual que el participante) y dispara las
// acciones privilegiadas (sintetizar / reiniciar) contra la función Netlify,
// que verifica el token secreto pasado por la URL (?k=...).
// ============================================================================
import { getSesion, getRespuestas, getVotos, suscribir, FN_URL } from '/ejercicio-gc/assets/gc-client.js'

const $ = (s) => document.querySelector(s)
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n }
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]))

const TOKEN = new URLSearchParams(location.search).get('k') || ''
const state = { sesion: null, respuestas: [], votos: [] }

const showErr = (m) => { const e = $('#err'); e.textContent = m; e.classList.remove('hidden'); setTimeout(() => e.classList.add('hidden'), 5000) }
const ERRS = {
  no_autorizado: 'Token inválido. Revisa el enlace del facilitador.',
  pocas_respuestas: 'Se necesitan al menos 2 respuestas para sintetizar.',
  anthropic: 'La IA no respondió. Revisa la API key en Netlify e intenta de nuevo.',
  parse: 'La IA devolvió un formato inesperado. Intenta sintetizar de nuevo.',
  sintesis_incompleta: 'No se generaron 3 opciones. Intenta de nuevo.',
}

async function fn(action) {
  const res = await fetch(FN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: TOKEN, action, sesion: 'gobierno-corporativo' }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok && data.ok, data }
}

async function recargar() {
  const [s, r, v] = await Promise.all([getSesion(), getRespuestas(), getVotos()])
  if (s) state.sesion = s
  state.respuestas = r; state.votos = v
  render()
}

function render() {
  const s = state.sesion; if (!s) return
  const c = state.respuestas.length
  $('#resp-count').textContent = c
  $('#resp-count2').textContent = c
  const sintesis = Array.isArray(s.sintesis) ? s.sintesis : []
  $('#estado-badge').innerHTML = sintesis.length
    ? '<span class="badge voting">Votación activa</span>'
    : '<span class="badge collecting">Recibiendo respuestas</span>'

  $('#btn-sintetizar').classList.toggle('hidden', sintesis.length > 0)
  $('#btn-sintetizar').disabled = c < 2
  $('#btn-sintetizar').textContent = c < 2 ? 'Sintetizar (faltan respuestas)' : `Sintetizar ${c} respuestas en 3 opciones`

  // Lista de respuestas
  const lista = $('#lista'); lista.innerHTML = ''
  state.respuestas.forEach(r => {
    const card = el('div', 'card')
    card.appendChild(el('div', 'name', esc(r.nombre)))
    card.appendChild(el('p', 'text', esc(r.texto)))
    lista.appendChild(card)
  })

  // Resultados de votación
  const box = $('#resultados')
  if (sintesis.length) {
    box.classList.remove('hidden')
    const conteo = {}; state.votos.forEach(v => { conteo[v.opcion] = (conteo[v.opcion] || 0) + 1 })
    const total = state.votos.length
    let max = -1; for (const v of Object.values(conteo)) if (v > max) max = v
    const cont = $('#opciones-res'); cont.innerHTML = ''
    sintesis.forEach(opt => {
      const count = conteo[opt.label] || 0
      const pct = total > 0 ? Math.round((count / total) * 100) : 0
      const isWin = total > 0 && count === max
      const card = el('div', 'vote-card disabled' + (isWin ? ' winner' : ''))
      card.appendChild(el('div', 'vlabel', esc(opt.label)))
      card.appendChild(el('p', 'vtext', esc(opt.text)))
      const bar = el('div', 'bar'); const fill = el('div', 'fill', ''); fill.style.width = pct + '%'; bar.appendChild(fill)
      card.appendChild(bar)
      card.appendChild(el('div', 'pct', `${count} ${count === 1 ? 'voto' : 'votos'} · ${pct}%`))
      cont.appendChild(card)
    })
    const tot = el('div', 'counter', `${total} ${total === 1 ? 'voto total' : 'votos totales'}`)
    cont.appendChild(tot)
  } else {
    box.classList.add('hidden')
  }
}

function bind() {
  $('#btn-sintetizar').addEventListener('click', async () => {
    const b = $('#btn-sintetizar'); b.disabled = true; b.textContent = 'Sintetizando con IA…'
    $('#msg').textContent = ''
    const { ok, data } = await fn('synthesize')
    if (!ok) { showErr(ERRS[data?.error] || 'No se pudo sintetizar.'); b.disabled = false; render(); return }
    await recargar()
  })
  $('#btn-reset').addEventListener('click', async () => {
    if (!confirm('¿Reiniciar el ejercicio? Se borran todas las respuestas y votos.')) return
    const { ok, data } = await fn('reset')
    if (!ok) return showErr(ERRS[data?.error] || 'No se pudo reiniciar.')
    $('#msg').textContent = 'Ejercicio reiniciado.'
    await recargar()
  })
}

async function init() {
  if (!TOKEN) { $('#noauth').classList.remove('hidden'); return }
  $('#panel').classList.remove('hidden')
  bind()
  try { await recargar() } catch (e) { console.error(e); showErr('No se pudo cargar.') }
  suscribir(() => recargar())
  setInterval(recargar, 6000)
}
init()
