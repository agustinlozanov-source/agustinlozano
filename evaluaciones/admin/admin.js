// ============================================================================
// SCALEx · Superadmin de Evaluaciones
// ============================================================================
// Usa la sesión del PORTAL (supabase-client.js compartido). Todas las RPC
// admin_* verifican en el servidor que el usuario sea admin del portal.
// ============================================================================
import { supabase } from '/assets/js/supabase-client.js'

const $ = (s, r = document) => r.querySelector(s)
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n }
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]))
const clean = (s) => String(s ?? '').replace(/[*`]/g, '').trim()

async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data
}

const ERRORES = {
  no_autorizado: 'No tienes permisos de administrador.',
  faltan_campos: 'Faltan campos obligatorios (programa, año, módulo, bloque, título).',
  combinacion_duplicada: 'Ya existe una evaluación con ese Programa/Año/Módulo/Bloque.',
  evaluacion_con_intentos: 'No se puede editar: esta evaluación ya tiene intentos registrados.',
  evaluacion_sin_preguntas: 'No se puede publicar una evaluación sin preguntas.',
  debe_haber_1_correcta: 'Cada pregunta debe tener exactamente una opción correcta.',
  opciones_insuficientes: 'Cada pregunta necesita al menos 2 opciones.',
  enunciado_vacio: 'Hay una pregunta sin enunciado.',
  sin_preguntas: 'No se detectaron preguntas.',
  evaluacion_inexistente: 'La evaluación no existe.',
  pregunta_inexistente: 'La pregunta no existe.'
}
const msgError = (e) => ERRORES[e] || ('Error: ' + e)

// ── Estado ────────────────────────────────────────────────────────────────────
const state = { taxonomia: null, evalId: null, intentos: 0, preguntas: [], preview: null }

// ── Init ──────────────────────────────────────────────────────────────────────
;(async () => {
  try {
    const admin = await rpc('eval_is_admin')
    $('#loading').classList.add('hidden')
    if (!admin) { $('#noauth').classList.remove('hidden'); return }
    bind()
    await loadTaxonomia()
    await showList()
  } catch (ex) {
    console.error(ex)
    $('#loading').innerHTML = '<p class="err-msg">No se pudo cargar. Revisa tu sesión e inténtalo de nuevo.</p>'
  }
})()

function bind() {
  $('#btn-nueva').addEventListener('click', () => showEditor(null))
  $('#btn-refresh').addEventListener('click', showList)
  $('#btn-volver').addEventListener('click', showList)
  $('#btn-detalle-volver').addEventListener('click', showList)
  $('#btn-detalle-editar').addEventListener('click', () => showEditor(detalleId))
  $('#btn-guardar-eval').addEventListener('click', guardarEvaluacion)
  $('#btn-add-preg').addEventListener('click', () => abrirFormPregunta(null))
  $('#btn-importar').addEventListener('click', abrirImportador)
  $('#btn-cancel-import').addEventListener('click', () => $('#import-panel').classList.add('hidden'))
  $('#btn-preview').addEventListener('click', previewImport)
  $('#btn-do-import').addEventListener('click', hacerImport)
  $('#pf-add-op').addEventListener('click', () => agregarOpcionRow('', false))
  $('#pf-guardar').addEventListener('click', guardarPregunta)
  $('#pf-cancelar').addEventListener('click', () => $('#preg-form-panel').classList.add('hidden'))
  $('#fmt-ejemplo').textContent = EJEMPLO_FORMATO
}

async function loadTaxonomia() {
  const t = await rpc('admin_taxonomia')
  if (!t?.ok) return
  state.taxonomia = t
  const fill = (id, arr) => { $(id).innerHTML = (arr || []).map(v => `<option value="${esc(String(v))}"></option>`).join('') }
  fill('#dl-programas', t.programas); fill('#dl-anios', t.anios)
  fill('#dl-modulos', t.modulos); fill('#dl-bloques', t.bloques); fill('#dl-temas', t.temas)
}

// ── Vista LISTA ─────────────────────────────────────────────────────────────
async function showList() {
  $('#view-editor').classList.add('hidden')
  $('#view-detalle').classList.add('hidden')
  $('#view-list').classList.remove('hidden')
  const res = await rpc('admin_list_evaluaciones')
  const cont = $('#lista-cont')
  if (!res?.ok) { cont.innerHTML = `<div class="err-msg">${esc(msgError(res?.error))}</div>`; return }
  const evs = res.evaluaciones
  if (!evs.length) { cont.innerHTML = '<div class="empty" style="padding:30px;text-align:center;color:var(--gris)">Todavía no hay evaluaciones. Crea la primera.</div>'; return }

  cont.innerHTML = evs.map(e => `
    <div class="eval-card">
      <div class="ec-main">
        <div class="ec-title">${esc(e.titulo)}</div>
        <div class="ec-tax">${esc(e.programa)} · ${e.anio} · ${esc(e.modulo)} · ${esc(e.bloque)}</div>
        <div class="ec-badges">
          ${e.publicada ? '<span class="badge pub">Publicada</span>' : '<span class="badge draft">Borrador</span>'}
          ${e.activa ? '' : '<span class="badge off">inactiva</span>'}
          <span class="badge off">${e.preguntas} preg.</span>
          <span class="badge off">${e.intentos} intento(s)</span>
        </div>
      </div>
      <div class="ec-actions">
        <button class="btn sm ghost" data-act="ver" data-id="${e.id}">👁 Ver</button>
        <button class="btn sm" data-act="edit" data-id="${e.id}">✎ Editar</button>
        <button class="btn sm link" data-act="pub" data-id="${e.id}" data-pub="${e.publicada}">${e.publicada ? 'Despublicar' : 'Publicar'}</button>
        <button class="btn sm danger" data-act="del" data-id="${e.id}" data-int="${e.intentos}">🗑 Eliminar</button>
      </div>
    </div>`).join('')

  cont.querySelectorAll('button[data-act]').forEach(b => b.addEventListener('click', () => accionLista(b.dataset)))
}

async function accionLista(d) {
  const id = Number(d.id)
  if (d.act === 'ver') return showDetalle(id)
  if (d.act === 'edit') return showEditor(id)
  if (d.act === 'pub') {
    const r = await rpc('admin_set_publicada', { p_id: id, p_publicada: d.pub !== 'true' })
    if (!r?.ok) alert(msgError(r?.error))
    return showList()
  }
  if (d.act === 'del') {
    const extra = Number(d.int) > 0 ? `\n\nOJO: tiene ${d.int} intento(s); se borrarán también sus respuestas.` : ''
    if (!confirm('¿Borrar esta evaluación y todas sus preguntas?' + extra)) return
    const r = await rpc('admin_delete_evaluacion', { p_id: id })
    if (!r?.ok) alert(msgError(r?.error))
    return showList()
  }
}

// ── Vista DETALLE (solo lectura) ─────────────────────────────────────────────
let detalleId = null
async function showDetalle(id) {
  detalleId = id
  $('#view-list').classList.add('hidden'); $('#view-editor').classList.add('hidden')
  $('#view-detalle').classList.remove('hidden')
  const cont = $('#detalle-cont')
  cont.innerHTML = '<p class="sub">Cargando…</p>'
  const res = await rpc('admin_get_evaluacion', { p_id: id })
  if (!res?.ok) { cont.innerHTML = `<div class="err-msg">${esc(msgError(res?.error))}</div>`; return }
  const e = res.evaluacion
  cont.innerHTML = `
    <h2 style="margin-bottom:2px;">${esc(e.titulo)}</h2>
    <p class="sub" style="margin-bottom:8px;">${esc(e.programa)} · ${e.anio} · ${esc(e.modulo)} · ${esc(e.bloque)}</p>
    <div class="ec-badges" style="margin-bottom:12px;">
      ${e.publicada ? '<span class="badge pub">Publicada</span>' : '<span class="badge draft">Borrador</span>'}
      ${e.activa ? '' : '<span class="badge off">inactiva</span>'}
      <span class="badge off">Umbral ${e.umbral}</span>
      <span class="badge off">${e.max_intentos} reintento(s)</span>
      <span class="badge off">${res.intentos} enviado(s)</span>
    </div>
    ${e.descripcion ? `<p class="sub">${esc(e.descripcion)}</p>` : ''}
    <h3 style="margin:16px 0 0;">Preguntas (${res.preguntas.length})</h3>
    <div id="detalle-preg"></div>`
  const pc = $('#detalle-preg')
  res.preguntas.forEach((p, i) => {
    const card = el('div', 'preg-card')
    const top = el('div', 'top')
    top.appendChild(el('span', 'num', `#${i + 1}`))
    top.appendChild(el('span', 'meta', `${esc(p.tema || '—')} · ${esc(p.tipo)}`))
    card.appendChild(top)
    card.appendChild(el('div', 'enun', esc(p.enunciado)))
    const ul = el('ul')
    ;(p.opciones || []).forEach(o => ul.appendChild(el('li', o.correcta ? 'ok' : '', esc(o.texto) + (o.correcta ? ' ✔' : ''))))
    card.appendChild(ul)
    if (p.justificacion) card.appendChild(el('div', 'hint', 'Justificación: ' + esc(p.justificacion)))
    pc.appendChild(card)
  })
}

// ── Vista EDITOR ────────────────────────────────────────────────────────────
async function showEditor(id) {
  $('#view-list').classList.add('hidden')
  $('#view-detalle').classList.add('hidden')
  $('#view-editor').classList.remove('hidden')
  $('#editor-error').classList.add('hidden'); $('#editor-ok').classList.add('hidden')
  $('#import-panel').classList.add('hidden'); $('#preg-form-panel').classList.add('hidden')
  state.evalId = null; state.intentos = 0; state.preguntas = []

  const set = (sel, v) => { $(sel).value = v ?? '' }
  if (!id) {
    $('#editor-titulo').textContent = 'Nueva evaluación'
    $('#editor-estado').textContent = ''
    ;['#f-programa','#f-modulo','#f-bloque','#f-titulo','#f-descripcion'].forEach(s => set(s, ''))
    set('#f-anio', new Date().getFullYear()); set('#f-umbral', 70); set('#f-intentos', 1)
    $('#f-publicada').checked = false; $('#f-activa').checked = true
    $('#bloque-preguntas').classList.add('hidden')
    return
  }

  const res = await rpc('admin_get_evaluacion', { p_id: id })
  if (!res?.ok) { $('#editor-error').textContent = msgError(res?.error); $('#editor-error').classList.remove('hidden'); return }
  const e = res.evaluacion
  state.evalId = e.id; state.intentos = res.intentos; state.preguntas = res.preguntas
  $('#editor-titulo').textContent = 'Editar evaluación'
  $('#editor-estado').innerHTML = e.publicada ? '<span class="badge pub">Publicada</span>' : '<span class="badge draft">Borrador</span>'
  set('#f-programa', e.programa); set('#f-anio', e.anio); set('#f-modulo', e.modulo); set('#f-bloque', e.bloque)
  set('#f-titulo', e.titulo); set('#f-descripcion', e.descripcion); set('#f-umbral', e.umbral); set('#f-intentos', e.max_intentos)
  $('#f-publicada').checked = e.publicada; $('#f-activa').checked = e.activa
  mostrarPreguntas()
}

function leerFormEval() {
  const p = {
    programa: $('#f-programa').value.trim(), anio: $('#f-anio').value,
    modulo: $('#f-modulo').value.trim(), bloque: $('#f-bloque').value.trim(),
    titulo: $('#f-titulo').value.trim(), descripcion: $('#f-descripcion').value.trim(),
    umbral: $('#f-umbral').value, max_intentos: $('#f-intentos').value,
    publicada: $('#f-publicada').checked, activa: $('#f-activa').checked
  }
  if (state.evalId) p.id = state.evalId
  return p
}

async function guardarEvaluacion() {
  const err = $('#editor-error'), ok = $('#editor-ok'), btn = $('#btn-guardar-eval')
  err.classList.add('hidden'); ok.classList.add('hidden')
  btn.disabled = true
  try {
    const res = await rpc('admin_upsert_evaluacion', { p: leerFormEval() })
    if (!res?.ok) { err.textContent = msgError(res?.error); err.classList.remove('hidden'); return }
    state.evalId = res.id
    ok.textContent = 'Evaluación guardada.'; ok.classList.remove('hidden')
    $('#editor-titulo').textContent = 'Editar evaluación'
    // recargar para traer preguntas/intentos actualizados
    const full = await rpc('admin_get_evaluacion', { p_id: res.id })
    if (full?.ok) { state.intentos = full.intentos; state.preguntas = full.preguntas; mostrarPreguntas() }
    await loadTaxonomia()
  } catch (ex) { console.error(ex); err.textContent = 'Error al guardar.'; err.classList.remove('hidden') }
  finally { btn.disabled = false }
}

// ── Preguntas ────────────────────────────────────────────────────────────────
function mostrarPreguntas() {
  $('#bloque-preguntas').classList.remove('hidden')
  const bloqueado = state.intentos > 0
  const notice = $('#preg-notice')
  if (bloqueado) {
    notice.innerHTML = `<div class="notice">Esta evaluación ya tiene <b>${state.intentos}</b> intento(s). Las preguntas están bloqueadas para no alterar resultados ya emitidos.<br>
      <button id="btn-reset-intentos" class="btn danger sm" style="margin-top:10px;">Borrar intentos y desbloquear edición</button></div>`
    $('#btn-reset-intentos').addEventListener('click', resetIntentos)
  } else {
    notice.innerHTML = ''
  }
  $('#btn-add-preg').disabled = bloqueado
  $('#btn-importar').disabled = bloqueado
  $('#preg-count').textContent = `${state.preguntas.length} pregunta(s)`
  renderListaPreguntas(bloqueado)
}

async function resetIntentos() {
  if (!confirm(`Se borrarán ${state.intentos} intento(s) y TODAS sus respuestas de esta evaluación. No se puede deshacer.\n\n¿Continuar?`)) return
  const r = await rpc('admin_reset_intentos', { p_evaluacion_id: state.evalId })
  if (!r?.ok) return alert(msgError(r?.error))
  await recargarPreguntas()
}

function renderListaPreguntas(bloqueado) {
  const cont = $('#preg-lista')
  cont.innerHTML = ''
  state.preguntas.forEach((p, i) => {
    const card = el('div', 'preg-card')
    const top = el('div', 'top')
    top.appendChild(el('span', 'num', `#${i + 1}`))
    top.appendChild(el('span', 'meta', `${esc(p.tema || '—')} · ${esc(p.tipo)}`))
    card.appendChild(top)
    card.appendChild(el('div', 'enun', esc(p.enunciado)))
    const ul = el('ul')
    ;(p.opciones || []).forEach(o => ul.appendChild(el('li', o.correcta ? 'ok' : '', esc(o.texto) + (o.correcta ? ' ✔' : ''))))
    card.appendChild(ul)
    if (p.justificacion) card.appendChild(el('div', 'hint', 'Justificación: ' + esc(p.justificacion)))
    if (!bloqueado) {
      const act = el('div', 'actions')
      const be = el('button', 'btn link sm', 'Editar'); be.addEventListener('click', () => abrirFormPregunta(p))
      const bd = el('button', 'btn link sm', 'Borrar'); bd.style.color = 'var(--err)'
      bd.addEventListener('click', () => borrarPregunta(p.id))
      act.append(be, bd); card.appendChild(act)
    }
    cont.appendChild(card)
  })
}

let editandoPreguntaId = null
function abrirFormPregunta(p) {
  editandoPreguntaId = p?.id || null
  $('#preg-form-panel').classList.remove('hidden')
  $('#import-panel').classList.add('hidden')
  $('#pf-error').classList.add('hidden')
  $('#pf-enunciado').value = p?.enunciado || ''
  $('#pf-tema').value = p?.tema || ''
  $('#pf-tipo').value = p?.tipo || 'concepto'
  $('#pf-justif').value = p?.justificacion || ''
  const cont = $('#pf-opciones'); cont.innerHTML = ''
  const ops = p?.opciones?.length ? p.opciones : [{ texto: '', correcta: true }, { texto: '', correcta: false }, { texto: '', correcta: false }, { texto: '', correcta: false }]
  ops.forEach(o => agregarOpcionRow(o.texto, o.correcta))
  $('#preg-form-panel').scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function agregarOpcionRow(texto, correcta) {
  const cont = $('#pf-opciones')
  const row = el('div', 'op-row')
  const radio = el('input'); radio.type = 'radio'; radio.name = 'pf-correcta'; radio.checked = !!correcta
  const txt = el('input'); txt.type = 'text'; txt.value = texto || ''; txt.placeholder = 'Texto de la opción'
  const rm = el('button', 'rm', '✕'); rm.type = 'button'
  rm.addEventListener('click', () => { if (cont.querySelectorAll('.op-row').length > 2) row.remove() })
  row.append(radio, txt, rm)
  cont.appendChild(row)
}

function leerFormPregunta() {
  const opciones = [...$('#pf-opciones').querySelectorAll('.op-row')].map(r => ({
    texto: r.querySelector('input[type=text]').value.trim(),
    correcta: r.querySelector('input[type=radio]').checked
  })).filter(o => o.texto !== '')
  const p = {
    tema: $('#pf-tema').value.trim(), tipo: $('#pf-tipo').value,
    enunciado: $('#pf-enunciado').value.trim(), justificacion: $('#pf-justif').value.trim(), opciones
  }
  if (editandoPreguntaId) p.id = editandoPreguntaId
  return p
}

async function guardarPregunta() {
  const err = $('#pf-error'); err.classList.add('hidden')
  const p = leerFormPregunta()
  if (!p.enunciado) { err.textContent = 'Falta el enunciado.'; err.classList.remove('hidden'); return }
  if (p.opciones.length < 2) { err.textContent = 'Agrega al menos 2 opciones con texto.'; err.classList.remove('hidden'); return }
  if (p.opciones.filter(o => o.correcta).length !== 1) { err.textContent = 'Marca exactamente una opción correcta.'; err.classList.remove('hidden'); return }
  const btn = $('#pf-guardar'); btn.disabled = true
  try {
    const res = await rpc('admin_upsert_pregunta', { p_evaluacion_id: state.evalId, p })
    if (!res?.ok) { err.textContent = msgError(res?.error); err.classList.remove('hidden'); return }
    $('#preg-form-panel').classList.add('hidden')
    await recargarPreguntas()
  } catch (ex) { console.error(ex); err.textContent = 'Error al guardar la pregunta.'; err.classList.remove('hidden') }
  finally { btn.disabled = false }
}

async function borrarPregunta(id) {
  if (!confirm('¿Borrar esta pregunta?')) return
  const res = await rpc('admin_delete_pregunta', { p_pregunta_id: id })
  if (!res?.ok) return alert(msgError(res?.error))
  await recargarPreguntas()
}

async function recargarPreguntas() {
  const full = await rpc('admin_get_evaluacion', { p_id: state.evalId })
  if (full?.ok) { state.intentos = full.intentos; state.preguntas = full.preguntas; mostrarPreguntas() }
}

// ── Importador ───────────────────────────────────────────────────────────────
function abrirImportador() {
  $('#import-panel').classList.remove('hidden')
  $('#preg-form-panel').classList.add('hidden')
  $('#imp-text').value = ''
  $('#import-msg').className = 'hidden'; $('#import-msg').innerHTML = ''
  $('#btn-do-import').disabled = true
  state.preview = null
  $('#import-panel').scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function previewImport() {
  const msg = $('#import-msg')
  let qs
  try { qs = parseImport($('#imp-text').value) }
  catch (ex) { msg.className = 'err-msg'; msg.textContent = 'No se pudo interpretar el texto: ' + ex.message; $('#btn-do-import').disabled = true; return }

  const errs = validar(qs)
  if (errs.length) {
    msg.className = 'err-msg'
    msg.innerHTML = `Se detectaron ${qs.length} pregunta(s), pero hay problemas:<ul>${errs.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`
    $('#btn-do-import').disabled = true
    return
  }
  state.preview = qs
  msg.className = 'ok-msg'
  msg.innerHTML = `✔ ${qs.length} pregunta(s) válidas. Al reemplazar se borran las preguntas actuales de esta evaluación.`
  $('#btn-do-import').disabled = false
}

async function hacerImport() {
  if (!state.preview) return
  const msg = $('#import-msg'), btn = $('#btn-do-import')
  btn.disabled = true
  try {
    const res = await rpc('admin_importar_preguntas', { p_evaluacion_id: state.evalId, p_preguntas: state.preview, p_reemplazar: true })
    if (!res?.ok) { msg.className = 'err-msg'; msg.textContent = msgError(res?.error); return }
    $('#import-panel').classList.add('hidden')
    await recargarPreguntas()
  } catch (ex) { console.error(ex); msg.className = 'err-msg'; msg.textContent = 'Error al importar.' }
  finally { btn.disabled = false }
}

function validar(qs) {
  const e = []
  if (!Array.isArray(qs) || !qs.length) { e.push('No se detectaron preguntas.'); return e }
  qs.forEach((q, i) => {
    const n = i + 1
    if (!q.enunciado) e.push(`Pregunta ${n}: sin enunciado.`)
    if (!Array.isArray(q.opciones) || q.opciones.length < 2) e.push(`Pregunta ${n}: necesita al menos 2 opciones.`)
    else if (q.opciones.filter(o => o.correcta).length !== 1) e.push(`Pregunta ${n}: debe tener exactamente 1 correcta.`)
  })
  return e
}

// ── Parsers ──────────────────────────────────────────────────────────────────
function parseImport(text) {
  const t = (text || '').trim()
  if (!t) return []
  if (t.startsWith('[') || t.startsWith('{')) return parseJSON(t)
  return parseMarkdown(t)
}

function parseJSON(t) {
  const data = JSON.parse(t)
  const arr = Array.isArray(data) ? data : (data.preguntas || [])
  return arr.map(q => ({
    tema: q.tema ?? q.bloque ?? null,
    tipo: q.tipo || 'concepto',
    enunciado: String(q.enunciado ?? '').trim(),
    justificacion: String(q.justificacion ?? '').trim(),
    opciones: (q.opciones || []).map(o => ({
      texto: String(o.texto ?? o.text ?? '').trim(),
      correcta: !!(o.correcta ?? o.es_correcta ?? o.correct)
    }))
  }))
}

function parseMarkdown(text) {
  const blocks = text.split(/\n(?=\s*\*{0,2}\s*P\d+\b)/)
  const out = []
  for (const raw of blocks) {
    const b = raw.trim()
    if (!/\bP\d+\b/.test((b.split('\n')[0] || ''))) continue
    const tema = (b.match(/(?:tema|bloque)\s*:\s*([^\s`·|*]+)/i) || [])[1] || null
    const tipo = clean((b.match(/tipo\s*:\s*([a-záéíóú]+)/i) || [])[1] || 'concepto')
    let enun = (b.match(/\*{0,2}Enunciado:?\*{0,2}\s*(.+)/i) || [])[1] || ''
    const opts = []
    const re = /^\s*[-*]?\s*([a-h])\)\s*(.+?)\s*$/gim
    let m; while ((m = re.exec(b))) opts.push({ letra: m[1].toLowerCase(), texto: clean(m[2]) })
    const corr = clean((b.match(/\*{0,2}Correcta:?\*{0,2}\s*([a-h])/i) || [])[1] || '').toLowerCase()
    const justif = clean((b.match(/\*{0,2}Justificaci[oó]n:?\*{0,2}\s*([\s\S]+?)(?=\n\s*-{3,}|\s*$)/i) || [])[1] || '')
    out.push({
      tema, tipo, enunciado: clean(enun), justificacion: justif,
      opciones: opts.map(o => ({ texto: o.texto, correcta: o.letra === corr }))
    })
  }
  return out
}

const EJEMPLO_FORMATO = `── JSON ──
[
  {
    "tema": "innovacion", "tipo": "concepto",
    "enunciado": "¿Pregunta?",
    "justificacion": "Por qué la correcta es correcta.",
    "opciones": [
      {"texto": "Opción A", "correcta": false},
      {"texto": "Opción B", "correcta": true}
    ]
  }
]

── Markdown ──
**P1** · tema: innovacion · tipo: concepto
**Enunciado:** ¿Pregunta?
- a) Opción A
- b) Opción B
**Correcta:** b
**Justificación:** Por qué B es correcta.`
