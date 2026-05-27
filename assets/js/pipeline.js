// pipeline.js — SCALEx Portal Pipeline/CRM
// Requiere: supabase-client.js, auth-guard.js, lucide

import { supabase, getMyProfile } from '/assets/js/supabase-client.js'

// ──────────────────────────────────────────────
// ESTADO GLOBAL
// ──────────────────────────────────────────────
let perfil = null
let prospectos = []         // todos los prospectos del consultor
let prospectoActual = null  // ficha abierta en modal
let interacciones = []      // interacciones del prospecto actual
let autoSaveTimer = null
let filtroVencidas = false

const ETAPAS = ['sin_contactar', 'conversacion_iniciada', 'reunion_agendada', 'en_propuesta', 'cuenta_activa']
const PILAR_KEYS = { Reflejo: 'reflejo', ADN: 'adn', Vector: 'vector', Ritmo: 'ritmo', Flujo: 'flujo' }
const TIPO_ICON = { nota: 'file-text', mensaje: 'message-square', llamada: 'phone', reunion: 'video', propuesta: 'send' }

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  perfil = await getMyProfile()
  if (!perfil) return

  // Inicializar fecha de hoy en form-interaccion
  const intFecha = document.getElementById('int-fecha')
  if (intFecha) intFecha.value = hoy()

  // Búsqueda en tiempo real
  const search = document.getElementById('search-input')
  if (search) search.addEventListener('input', () => renderKanban())

  await cargarProspectos()
  await cargarMetricas()

  // Suscripción realtime
  supabase
    .channel('pipeline-prospectos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'prospectos' }, () => {
      cargarProspectos()
    })
    .subscribe()
})

// ──────────────────────────────────────────────
// DATA
// ──────────────────────────────────────────────
async function cargarProspectos() {
  const { data, error } = await supabase
    .from('prospectos')
    .select('*')
    .eq('consultor_id', perfil.id)
    .neq('etapa', 'descartado')
    .order('orden', { ascending: true })

  if (error) { console.error(error); return }
  prospectos = data || []
  renderKanban()
}

async function cargarMetricas() {
  const { data, error } = await supabase.rpc('pipeline_metricas_consultor')
  if (error || !data || data.length === 0) return
  const m = data[0]
  setText('stat-sin-contactar', m.sin_contactar ?? 0)
  setText('stat-conversacion', m.conversacion_iniciada ?? 0)
  setText('stat-reunion', m.reunion_agendada ?? 0)
  setText('stat-propuesta', m.en_propuesta ?? 0)
  setText('stat-activos', m.cuenta_activa ?? 0)
}

async function cargarInteracciones(prospectoId) {
  const { data, error } = await supabase
    .from('prospectos_interacciones')
    .select('*')
    .eq('prospecto_id', prospectoId)
    .order('fecha', { ascending: false })

  if (error) { console.error(error); return }
  interacciones = data || []
  renderBitacora()
}

// ──────────────────────────────────────────────
// RENDER KANBAN
// ──────────────────────────────────────────────
function renderKanban() {
  const query = (document.getElementById('search-input')?.value || '').toLowerCase().trim()
  const hoyStr = hoy()

  for (const etapa of ETAPAS) {
    const container = document.getElementById(`cards-${etapa}`)
    const countEl = document.getElementById(`count-${etapa}`)
    if (!container) continue

    let lista = prospectos.filter(p => p.etapa === etapa)

    // Filtro búsqueda
    if (query) {
      lista = lista.filter(p =>
        (p.empresa_nombre || '').toLowerCase().includes(query) ||
        (p.contacto_nombre || '').toLowerCase().includes(query)
      )
    }

    // Filtro vencidas
    if (filtroVencidas) {
      lista = lista.filter(p => p.proxima_accion_fecha && p.proxima_accion_fecha < hoyStr)
    }

    if (countEl) countEl.textContent = lista.length

    if (lista.length === 0) {
      container.innerHTML = '<div class="kanban-empty">Sin prospectos</div>'
    } else {
      container.innerHTML = lista.map(p => renderCardHTML(p, hoyStr)).join('')
    }
  }

  // Re-init lucide para los nuevos íconos
  lucide.createIcons()
}

function renderCardHTML(p, hoyStr) {
  const pilares = parsePilares(p.pilares_diagnostico)
  const pilaresHTML = pilares.map(pilar => {
    const cls = pilar.toLowerCase().replace('ó', 'o').replace('é', 'e')
    const map = { reflejo: 'reflejo', adn: 'adn', vector: 'vector', ritmo: 'ritmo', flujo: 'flujo' }
    const key = Object.keys(map).find(k => pilar.toLowerCase().includes(k)) || ''
    return `<span class="pilar-chip ${key}">${pilar}</span>`
  }).join('')

  const vencida = p.proxima_accion_fecha && p.proxima_accion_fecha < hoyStr
  const accionHTML = p.proxima_accion
    ? `<span class="card-accion ${vencida ? 'vencida' : ''}">
        <i data-lucide="${vencida ? 'alert-circle' : 'arrow-right'}"></i>
        ${p.proxima_accion}${p.proxima_accion_fecha ? ` · ${formatFecha(p.proxima_accion_fecha)}` : ''}
       </span>`
    : `<span class="card-accion"><i data-lucide="minus"></i> Sin acción</span>`

  return `
    <div class="prospect-card" draggable="true"
         data-id="${p.id}"
         onclick="abrirModalFicha('${p.id}')"
         ondragstart="onDragStart(event, '${p.id}')">
      <div class="card-empresa">${escHtml(p.empresa_nombre || '—')}</div>
      <div class="card-contacto">${escHtml(p.contacto_nombre || '')}${p.contacto_puesto ? ` · ${escHtml(p.contacto_puesto)}` : ''}</div>
      ${pilares.length ? `<div class="card-pilares">${pilaresHTML}</div>` : ''}
      <div class="card-footer">
        ${accionHTML}
        <span class="card-interacciones">
          <i data-lucide="message-square"></i> ${p.interacciones_count ?? 0}
        </span>
      </div>
    </div>`
}

// ──────────────────────────────────────────────
// DRAG & DROP
// ──────────────────────────────────────────────
let draggingId = null

window.onDragStart = function(e, id) {
  draggingId = id
  setTimeout(() => {
    const el = document.querySelector(`[data-id="${id}"]`)
    if (el) el.classList.add('dragging')
  }, 0)
}

window.onDragOver = function(e) {
  e.preventDefault()
  const col = e.currentTarget
  col.classList.add('drag-over')
}

window.onDragLeave = function(e) {
  e.currentTarget.classList.remove('drag-over')
}

window.onDrop = async function(e) {
  e.preventDefault()
  const col = e.currentTarget
  col.classList.remove('drag-over')
  if (!draggingId) return

  const nuevaEtapa = col.getAttribute('data-etapa')
  const p = prospectos.find(x => x.id === draggingId)
  if (!p || p.etapa === nuevaEtapa) { draggingId = null; return }

  // Optimistic update
  const etapaAnterior = p.etapa
  p.etapa = nuevaEtapa
  renderKanban()

  const { error } = await supabase.rpc('prospecto_mover', {
    p_prospecto_id: draggingId,
    p_nueva_etapa: nuevaEtapa,
    p_nuevo_orden: 999
  })

  if (error) {
    toast('Error al mover prospecto', 'error')
    p.etapa = etapaAnterior
    renderKanban()
  } else {
    cargarMetricas()
    // Si el modal está abierto, actualizar etapa
    if (prospectoActual?.id === draggingId) {
      prospectoActual.etapa = nuevaEtapa
    }
  }

  const el = document.querySelector(`[data-id="${draggingId}"]`)
  if (el) el.classList.remove('dragging')
  draggingId = null
}

// ──────────────────────────────────────────────
// MODAL FICHA
// ──────────────────────────────────────────────
window.abrirModalNuevo = function() {
  prospectoActual = null
  interacciones = []
  resetModal()
  document.getElementById('modal-title').textContent = 'Nuevo prospecto'
  document.getElementById('btn-descartar').style.display = 'none'
  document.getElementById('btn-convertir').style.display = 'none'
  abrirModal()
}

window.abrirModalFicha = async function(id) {
  const p = prospectos.find(x => x.id === id)
  if (!p) return
  prospectoActual = { ...p }
  resetModal()
  rellenarModal(p)
  document.getElementById('modal-title').textContent = p.empresa_nombre || 'Ficha'
  document.getElementById('btn-descartar').style.display = p.etapa !== 'cuenta_activa' ? 'inline-flex' : 'none'
  const btnConv = document.getElementById('btn-convertir')
  if (p.etapa === 'en_propuesta') {
    btnConv.style.display = 'inline-flex'
    btnConv.disabled = false
  } else if (p.etapa === 'cuenta_activa') {
    btnConv.style.display = 'none'
  } else {
    btnConv.style.display = 'none'
  }
  await cargarInteracciones(id)
  abrirModal()
}

function abrirModal() {
  document.getElementById('modal-overlay').classList.add('open')
  lucide.createIcons()
}

window.cerrarModal = function() {
  document.getElementById('modal-overlay').classList.remove('open')
  prospectoActual = null
  interacciones = []
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
}

window.cerrarModalSiFuera = function(e) {
  if (e.target === document.getElementById('modal-overlay')) cerrarModal()
}

function rellenarModal(p) {
  const campos = [
    'empresa_nombre','sector','tamano','ciudad','pais','sitio_web',
    'contacto_nombre','contacto_puesto','contacto_email','contacto_telefono',
    'contacto_whatsapp','contacto_linkedin','fuente','fuente_detalle',
    'notas_diagnostico','proxima_accion','proxima_accion_fecha'
  ]
  for (const campo of campos) {
    const el = document.querySelector(`[data-field="${campo}"]`)
    if (el) el.value = p[campo] ?? ''
  }

  // Pilares
  const pilares = parsePilares(p.pilares_diagnostico)
  document.querySelectorAll('.pilar-btn').forEach(btn => {
    btn.classList.toggle('active', pilares.includes(btn.getAttribute('data-pilar')))
  })
}

function resetModal() {
  document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => {
    el.value = ''
    if (el.tagName === 'SELECT') el.selectedIndex = 0
  })
  document.querySelectorAll('.pilar-btn').forEach(b => b.classList.remove('active'))
  document.getElementById('bitacora-list').innerHTML =
    '<div style="font-size:12px;color:var(--text-4);text-align:center;padding:12px 0">Sin interacciones registradas</div>'
  ocultarSaveIndicator()
  // Resetear form interacción
  const formInt = document.getElementById('form-interaccion')
  if (formInt) formInt.classList.remove('open')
  const intFecha = document.getElementById('int-fecha')
  if (intFecha) intFecha.value = hoy()
  document.getElementById('int-resumen').value = ''
  document.getElementById('int-detalle').value = ''
}

// ──────────────────────────────────────────────
// AUTO-SAVE
// ──────────────────────────────────────────────
document.addEventListener('input', e => {
  const el = e.target
  if (!el.dataset.field) return
  if (!prospectoActual && !el.closest('#modal-ficha')) return
  scheduleAutoSave()
})

function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => guardarFicha(), 900)
}

async function guardarFicha() {
  const campos = [
    'empresa_nombre','sector','tamano','ciudad','pais','sitio_web',
    'contacto_nombre','contacto_puesto','contacto_email','contacto_telefono',
    'contacto_whatsapp','contacto_linkedin','fuente','fuente_detalle',
    'notas_diagnostico','proxima_accion','proxima_accion_fecha'
  ]

  const payload = {}
  for (const campo of campos) {
    const el = document.querySelector(`[data-field="${campo}"]`)
    if (el) payload[campo] = el.value.trim() || null
  }

  // Pilares
  const pilaresSeleccionados = []
  document.querySelectorAll('.pilar-btn.active').forEach(b => pilaresSeleccionados.push(b.getAttribute('data-pilar')))
  payload.pilares_diagnostico = pilaresSeleccionados.length ? pilaresSeleccionados.join(',') : null

  if (!payload.empresa_nombre) return

  if (prospectoActual) {
    const { error } = await supabase
      .from('prospectos')
      .update(payload)
      .eq('id', prospectoActual.id)

    if (!error) {
      Object.assign(prospectoActual, payload)
      mostrarSaveIndicator()
      // Actualizar en lista local
      const idx = prospectos.findIndex(p => p.id === prospectoActual.id)
      if (idx !== -1) Object.assign(prospectos[idx], payload)
      renderKanban()
    } else {
      toast('Error al guardar', 'error')
    }
  } else {
    // Nuevo prospecto → INSERT
    payload.consultor_id = perfil.id
    payload.etapa = 'sin_contactar'
    payload.orden = 0

    const { data, error } = await supabase
      .from('prospectos')
      .insert(payload)
      .select()
      .single()

    if (!error && data) {
      prospectoActual = data
      prospectos.push(data)
      document.getElementById('modal-title').textContent = data.empresa_nombre
      document.getElementById('btn-descartar').style.display = 'inline-flex'
      mostrarSaveIndicator()
      renderKanban()
      cargarMetricas()
    } else {
      toast('Error al crear prospecto', 'error')
    }
  }
}

// ──────────────────────────────────────────────
// PILARES TOGGLE
// ──────────────────────────────────────────────
window.togglePilar = function(btn) {
  btn.classList.toggle('active')
  scheduleAutoSave()
}

// ──────────────────────────────────────────────
// INTERACCIONES (BITÁCORA)
// ──────────────────────────────────────────────
window.toggleFormInteraccion = function() {
  document.getElementById('form-interaccion').classList.toggle('open')
  lucide.createIcons()
}

window.guardarInteraccion = async function() {
  if (!prospectoActual) {
    // Guardar primero el prospecto si es nuevo
    await guardarFicha()
    if (!prospectoActual) { toast('Guarda la ficha primero', 'error'); return }
  }

  const tipo = document.getElementById('int-tipo').value
  const fecha = document.getElementById('int-fecha').value || hoy()
  const resumen = document.getElementById('int-resumen').value.trim()
  const detalle = document.getElementById('int-detalle').value.trim()

  if (!resumen) { toast('El resumen es obligatorio', 'error'); return }

  const { data, error } = await supabase
    .from('prospectos_interacciones')
    .insert({
      prospecto_id: prospectoActual.id,
      consultor_id: perfil.id,
      tipo,
      fecha,
      resumen,
      detalle: detalle || null
    })
    .select()
    .single()

  if (error) { toast('Error al guardar interacción', 'error'); return }

  interacciones.unshift(data)
  renderBitacora()
  // Reset form
  document.getElementById('int-resumen').value = ''
  document.getElementById('int-detalle').value = ''
  document.getElementById('int-fecha').value = hoy()
  document.getElementById('form-interaccion').classList.remove('open')
  toast('Interacción guardada')

  // Actualizar contador en tarjeta
  const p = prospectos.find(x => x.id === prospectoActual.id)
  if (p) { p.interacciones_count = (p.interacciones_count || 0) + 1; renderKanban() }
}

window.eliminarInteraccion = async function(id) {
  const { error } = await supabase
    .from('prospectos_interacciones')
    .delete()
    .eq('id', id)

  if (error) { toast('Error al eliminar', 'error'); return }
  interacciones = interacciones.filter(x => x.id !== id)
  renderBitacora()
  // Actualizar contador
  const p = prospectos.find(x => x.id === prospectoActual?.id)
  if (p && p.interacciones_count > 0) { p.interacciones_count--; renderKanban() }
}

function renderBitacora() {
  const container = document.getElementById('bitacora-list')
  if (!container) return
  if (!interacciones.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--text-4);text-align:center;padding:12px 0">Sin interacciones registradas</div>'
    return
  }
  container.innerHTML = interacciones.map(int => `
    <div class="bitacora-item">
      <div class="bitacora-icon">
        <i data-lucide="${TIPO_ICON[int.tipo] || 'file-text'}"></i>
      </div>
      <div class="bitacora-content">
        <div class="bitacora-top">
          <span class="bitacora-tipo">${int.tipo}</span>
          <span class="bitacora-fecha">${formatFecha(int.fecha)}</span>
        </div>
        <div class="bitacora-resumen">${escHtml(int.resumen)}</div>
        ${int.detalle ? `<div class="bitacora-detalle">${escHtml(int.detalle)}</div>` : ''}
      </div>
      <button class="bitacora-delete" onclick="eliminarInteraccion('${int.id}')">
        <i data-lucide="trash-2"></i>
      </button>
    </div>`).join('')
  lucide.createIcons()
}

// ──────────────────────────────────────────────
// DESCARTAR / CONVERTIR
// ──────────────────────────────────────────────
window.descartarProspecto = function() {
  if (!prospectoActual) return
  abrirConfirm(
    '¿Descartar prospecto?',
    `"${prospectoActual.empresa_nombre || 'Este prospecto'}" pasará a estado Descartado y desaparecerá del tablero. Esto se puede revertir desde la base de datos.`,
    async () => {
      const { error } = await supabase
        .from('prospectos')
        .update({ etapa: 'descartado' })
        .eq('id', prospectoActual.id)

      if (error) { toast('Error al descartar', 'error'); return }
      prospectos = prospectos.filter(p => p.id !== prospectoActual.id)
      renderKanban()
      cargarMetricas()
      cerrarModal()
      toast('Prospecto descartado')
    }
  )
}

window.convertirEnCuenta = function() {
  if (!prospectoActual) return
  abrirConfirm(
    '¿Convertir en cuenta activa?',
    `"${prospectoActual.empresa_nombre}" se convertirá en una organización dentro de SCALEx. Esta acción no se puede deshacer fácilmente.`,
    async () => {
      const { error } = await supabase.rpc('prospecto_convertir_a_cuenta', {
        p_prospecto_id: prospectoActual.id,
        p_organizacion_nombre: prospectoActual.empresa_nombre
      })

      if (error) { toast('Error al convertir: ' + error.message, 'error'); return }

      // Refrescar
      await cargarProspectos()
      cargarMetricas()
      cerrarModal()
      toast('¡Cuenta activa creada! 🎉')
    }
  )
}

// ──────────────────────────────────────────────
// FILTRO VENCIDAS
// ──────────────────────────────────────────────
window.toggleFiltroVencidas = function() {
  filtroVencidas = !filtroVencidas
  const btn = document.getElementById('btn-vencidas')
  if (btn) btn.classList.toggle('active', filtroVencidas)
  renderKanban()
}

// ──────────────────────────────────────────────
// CONFIRM DIALOG
// ──────────────────────────────────────────────
let confirmCallback = null

function abrirConfirm(titulo, cuerpo, callback) {
  document.getElementById('confirm-title').textContent = titulo
  document.getElementById('confirm-body').textContent = cuerpo
  confirmCallback = callback
  document.getElementById('confirm-overlay').classList.add('open')
}

window.cerrarConfirm = function() {
  document.getElementById('confirm-overlay').classList.remove('open')
  confirmCallback = null
}

document.getElementById('confirm-ok-btn')?.addEventListener('click', () => {
  cerrarConfirm()
  if (confirmCallback) confirmCallback()
})

// ──────────────────────────────────────────────
// TOAST
// ──────────────────────────────────────────────
function toast(msg, tipo = 'success') {
  const container = document.getElementById('toast-container')
  if (!container) return
  const t = document.createElement('div')
  t.className = `toast ${tipo}`
  const icon = tipo === 'success' ? 'check-circle' : 'alert-circle'
  t.innerHTML = `<i data-lucide="${icon}"></i>${msg}`
  container.appendChild(t)
  lucide.createIcons()
  setTimeout(() => t.remove(), 3500)
}

// ──────────────────────────────────────────────
// SAVE INDICATOR
// ──────────────────────────────────────────────
function mostrarSaveIndicator() {
  const el = document.getElementById('save-indicator')
  if (!el) return
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 2500)
}

function ocultarSaveIndicator() {
  document.getElementById('save-indicator')?.classList.remove('show')
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
function hoy() {
  return new Date().toISOString().slice(0, 10)
}

function formatFecha(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function parsePilares(str) {
  if (!str) return []
  return str.split(',').map(s => s.trim()).filter(Boolean)
}

function setText(id, val) {
  const el = document.getElementById(id)
  if (el) el.textContent = val
}
