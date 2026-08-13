// ============================================================================
// SCALEx · /resultados — dashboard de resultados de evaluaciones
// ============================================================================
// Acceso ABIERTO (decisión del dueño). Lee vía RPC eval_resultados() con la
// anon key. Exporta a .xlsx nativo con SheetJS (CDN).
// ============================================================================
import { evalResultados } from '/evaluaciones/assets/eval-client.js'

const $ = (s, r = document) => r.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]))

const state = { data: null, sortP: { key: 'enviado_en', dir: -1 }, sortQ: { key: 'pct_acierto', dir: 1 } }

const fmtFecha = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
         ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}
const nombreBloque = (b) => ({ innovacion: 'Innovación', automatizacion: 'Automatización' }[b] || b)

// ── Carga ─────────────────────────────────────────────────────────────────────
async function cargar() {
  try {
    const data = await evalResultados()
    state.data = data
    render()
  } catch (ex) {
    console.error(ex)
    $('#app').innerHTML = `<div class="err-msg">No se pudieron cargar los resultados. Revisa la conexión e inténtalo de nuevo.</div>`
  }
}

function ordenar(arr, { key, dir }) {
  return arr.slice().sort((a, b) => {
    let x = a[key], y = b[key]
    if (x == null) x = ''
    if (y == null) y = ''
    if (typeof x === 'string' && typeof y === 'string') return x.localeCompare(y) * dir
    return (x > y ? 1 : x < y ? -1 : 0) * dir
  })
}

function render() {
  const { resumen, participantes, preguntas } = state.data
  const r = resumen || { participantes: 0, aprobados: 0, reprobados: 0, promedio: 0 }

  $('#app').innerHTML = `
    <div class="cards">
      <div class="stat"><div class="lbl">Participantes</div><div class="val">${r.participantes}</div></div>
      <div class="stat ok"><div class="lbl">Aprobados</div><div class="val">${r.aprobados}</div></div>
      <div class="stat err"><div class="lbl">No aprobados</div><div class="val">${r.reprobados}</div></div>
      <div class="stat"><div class="lbl">Promedio</div><div class="val">${Number(r.promedio).toFixed(1)}</div></div>
    </div>

    <div class="card">
      <h2>Participantes</h2>
      <p class="sub">Última nota de cada persona. Clic en un encabezado para ordenar.</p>
      ${participantes.length ? `<div class="table-scroll"><table id="tp"></table></div>`
        : `<div class="empty">Aún no hay evaluaciones enviadas.</div>`}
    </div>

    <div class="card">
      <h2>Analítica por pregunta</h2>
      <p class="sub">% de acierto del grupo. Las más bajas señalan qué concepto quedó flojo.</p>
      ${preguntas.length ? `<div class="table-scroll"><table id="tq"></table></div>`
        : `<div class="empty">Sin respuestas todavía.</div>`}
    </div>

    <p class="footnote">Datos en vivo desde Supabase · página de acceso abierto (no enlazada, noindex).</p>
  `
  if (participantes.length) renderParticipantes()
  if (preguntas.length) renderPreguntas()
  $('#btn-export').disabled = !participantes.length && !preguntas.length
}

function th(cols, sort, prefix) {
  return '<thead><tr>' + cols.map(c =>
    `<th data-k="${c.k}" data-t="${prefix}">${esc(c.t)}${sort.key === c.k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</th>`
  ).join('') + '</tr></thead>'
}

function renderParticipantes() {
  const cols = [
    { k: 'nombre', t: 'Nombre' }, { k: 'email', t: 'Email' }, { k: 'empresa', t: 'Empresa' },
    { k: 'puntaje', t: 'Puntaje' }, { k: 'aprobado', t: 'Estado' },
    { k: 'intentos', t: 'Intentos' }, { k: 'enviado_en', t: 'Enviado' }
  ]
  const rows = ordenar(state.data.participantes, state.sortP)
  $('#tp').innerHTML = th(cols, state.sortP, 'p') + '<tbody>' + rows.map(p => `
    <tr>
      <td>${esc(p.nombre)}</td>
      <td>${esc(p.email)}</td>
      <td>${esc(p.empresa || '—')}</td>
      <td><b>${Number(p.puntaje).toFixed(2)}</b></td>
      <td><span class="pill ${p.aprobado ? 'ok' : 'err'}">${p.aprobado ? 'Aprobado' : 'No aprob.'}</span></td>
      <td>${p.intentos}</td>
      <td>${esc(fmtFecha(p.enviado_en))}</td>
    </tr>`).join('') + '</tbody>'
  bindSort('#tp', 'p')
}

function renderPreguntas() {
  const cols = [
    { k: 'id', t: '#' }, { k: 'bloque', t: 'Bloque' }, { k: 'tipo', t: 'Tipo' },
    { k: 'enunciado', t: 'Pregunta' }, { k: 'respuestas', t: 'Resp.' },
    { k: 'aciertos', t: 'Aciertos' }, { k: 'pct_acierto', t: '% Acierto' }
  ]
  const rows = ordenar(state.data.preguntas, state.sortQ)
  $('#tq').innerHTML = th(cols, state.sortQ, 'q') + '<tbody>' + rows.map(q => {
    const pct = q.pct_acierto == null ? null : Number(q.pct_acierto)
    const cls = pct == null ? '' : pct >= 70 ? 'hi' : pct >= 50 ? 'mid' : 'lo'
    return `<tr>
      <td>${q.id}</td>
      <td>${esc(nombreBloque(q.bloque))}</td>
      <td>${esc(q.tipo)}</td>
      <td class="enunciado">${esc(q.enunciado)}</td>
      <td>${q.respuestas}</td>
      <td>${q.aciertos}</td>
      <td><div class="bar-cell"><span>${pct == null ? '—' : pct.toFixed(0) + '%'}</span>
        <div class="track"><div class="fill ${cls}" style="width:${pct || 0}%"></div></div></div></td>
    </tr>`
  }).join('') + '</tbody>'
  bindSort('#tq', 'q')
}

function bindSort(sel, prefix) {
  $(sel).querySelectorAll('th').forEach(th => th.addEventListener('click', () => {
    const k = th.dataset.k
    const st = prefix === 'p' ? state.sortP : state.sortQ
    if (st.key === k) st.dir *= -1; else { st.key = k; st.dir = 1 }
    prefix === 'p' ? renderParticipantes() : renderPreguntas()
  }))
}

// ── Exportar a Excel (.xlsx) ────────────────────────────────────────────────────
async function exportarExcel() {
  const btn = $('#btn-export')
  btn.disabled = true
  const prev = btn.textContent
  btn.textContent = 'Generando…'
  try {
    const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs')
    const wb = XLSX.utils.book_new()

    const p = (state.data.participantes || []).map(x => ({
      Nombre: x.nombre, Email: x.email, Empresa: x.empresa || '',
      Puntaje: Number(x.puntaje), Estado: x.aprobado ? 'Aprobado' : 'No aprobado',
      Intentos: x.intentos, Enviado: fmtFecha(x.enviado_en)
    }))
    const wsP = XLSX.utils.json_to_sheet(p)
    wsP['!cols'] = [{ wch: 26 }, { wch: 30 }, { wch: 24 }, { wch: 9 }, { wch: 13 }, { wch: 9 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, wsP, 'Participantes')

    const q = (state.data.preguntas || []).map(x => ({
      '#': x.id, Bloque: nombreBloque(x.bloque), Tipo: x.tipo, Pregunta: x.enunciado,
      Respuestas: x.respuestas, Aciertos: x.aciertos, '% Acierto': x.pct_acierto
    }))
    const wsQ = XLSX.utils.json_to_sheet(q)
    wsQ['!cols'] = [{ wch: 4 }, { wch: 16 }, { wch: 11 }, { wch: 70 }, { wch: 11 }, { wch: 10 }, { wch: 11 }]
    XLSX.utils.book_append_sheet(wb, wsQ, 'Analítica')

    const hoy = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `resultados-modulo6-${hoy}.xlsx`)
  } catch (ex) {
    console.error(ex)
    alert('No se pudo generar el Excel. Revisa tu conexión e inténtalo de nuevo.')
  } finally {
    btn.textContent = prev
    btn.disabled = false
  }
}

// ── Init ────────────────────────────────────────────────────────────────────────
$('#btn-refresh').addEventListener('click', cargar)
$('#btn-export').addEventListener('click', exportarExcel)
cargar()
