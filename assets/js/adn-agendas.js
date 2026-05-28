// adn-agendas.js — SCALEx Portal · ADN · Módulo compartido de Agendas 7/30/90
// Renderiza y gestiona las agendas interactivas desde adn_agendas (Supabase)

import { supabase } from '/assets/js/supabase-client.js'
import { AGENDAS_PASO_0, RECTORES, AGENDA_PASO_2_RECTOR_TEMPLATE } from '/assets/js/adn-piramides-rectores-catalogo.js'

// ──────────────────────────────────────────────
// CONFIGURACIÓN DE HORIZONTES Y PASOS
// ──────────────────────────────────────────────
const HORIZONTE_CONFIG = {
  '7_dias':  { label: '7 días',  color: '#ec4899', icon: 'calendar' },
  '30_dias': { label: '30 días', color: '#f59e0b', icon: 'calendar-days' },
  '90_dias': { label: '90 días', color: '#14b8a6', icon: 'calendar-range' }
}

const PASO_CONFIG = {
  'paso_0':        { label: 'P0 · Pirámide',     color: '#ec4899' },
  'paso_1':        { label: 'P1 · Personalidad', color: '#7c3aed' },
  'paso_2_rector': { label: 'P2 · Rectores',     color: '#0ea5e9' }
}

// ──────────────────────────────────────────────
// INYECCIÓN DE CSS (una sola vez)
// ──────────────────────────────────────────────
let stylesInjected = false

function injectStyles() {
  if (stylesInjected) return
  stylesInjected = true
  const style = document.createElement('style')
  style.id = 'adn-agendas-styles'
  style.textContent = `
/* ── ADN Agendas Shared Styles ── */
.agendas-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 4px;
}
@media (max-width: 760px) {
  .agendas-grid { grid-template-columns: 1fr; }
}
.agenda-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  transition: opacity 0.25s, border-color 0.25s;
}
.agenda-card.completada {
  opacity: 0.5;
  border-color: var(--green, #00c853);
}
.agenda-card-top {
  padding: 9px 12px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
}
.agenda-horizonte-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 50px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  letter-spacing: 0.2px;
}
.agenda-horizonte-badge svg { width: 11px; height: 11px; }
.agenda-check-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}
.agenda-check-wrap input[type=checkbox] { display: none; }
.agenda-check-box {
  width: 17px;
  height: 17px;
  border-radius: 5px;
  border: 1.5px solid var(--border-strong, #555);
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
}
.agenda-check-wrap input:checked + .agenda-check-box {
  background: var(--green, #00c853);
  border-color: var(--green, #00c853);
}
.agenda-check-wrap input:checked + .agenda-check-box::after {
  content: '';
  display: block;
  width: 10px;
  height: 10px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M1.5 6l3 3 6-6' stroke='white' stroke-width='1.8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
}
.agenda-card-body { padding: 12px 14px; }
.agenda-contenido {
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.55;
  transition: color 0.2s;
}
.agenda-contenido.tachado {
  text-decoration: line-through;
  color: var(--text-4);
}
.agendas-empty {
  font-size: 12.5px;
  color: var(--text-4);
  text-align: center;
  padding: 28px 0;
}
/* Hub: columnas por horizonte */
.agendas-hub-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
@media (max-width: 900px) {
  .agendas-hub-grid { grid-template-columns: 1fr; }
}
.agendas-hub-col { display: flex; flex-direction: column; gap: 10px; }
.agendas-hub-col-header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 14px;
  border-radius: 10px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid;
  margin-bottom: 2px;
}
.agendas-hub-col-header svg { width: 13px; height: 13px; }
.agenda-card-paso-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.4px;
  padding: 2px 7px;
  border-radius: 4px;
  margin-bottom: 5px;
  font-family: 'Plus Jakarta Sans', sans-serif;
}
/* Sección wrapper */
.agenda-section-wrap {
  margin-top: 28px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--bg-card);
  overflow: hidden;
}
.agenda-section-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 12px;
}
.agenda-section-header-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(236,72,153,0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.agenda-section-header-icon svg { width: 15px; height: 15px; color: #ec4899; }
.agenda-section-header-text { flex: 1; }
.agenda-section-header-text h3 {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 2px;
}
.agenda-section-header-text p { font-size: 11.5px; color: var(--text-3); margin: 0; }
.agenda-pending-count {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 50px;
  background: rgba(236,72,153,0.12);
  color: #ec4899;
  white-space: nowrap;
}
.agenda-section-body { padding: 20px; }
/* Mapa tab scroll */
.agendas-tab-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px;
}
/* Notes */
.agenda-notes-toggle {
  display: inline-flex; align-items: center; gap: 4px;
  margin-top: 8px; padding: 2px 0;
  background: none; border: none; cursor: pointer;
  font-size: 11px; color: var(--text-4); transition: color 0.15s;
}
.agenda-notes-toggle:hover { color: var(--text-2); }
.agenda-notes-toggle svg { width: 11px; height: 11px; }
.agenda-notes-input {
  width: 100%; margin-top: 6px; padding: 8px 10px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 7px; color: var(--text-2); font-size: 12px;
  line-height: 1.5; resize: none; font-family: inherit;
  transition: border-color 0.15s; box-sizing: border-box; min-height: 60px;
}
.agenda-notes-input:focus { outline: none; border-color: var(--pink); }
.agenda-notes-saved {
  font-size: 10px; color: var(--green,#00c853); margin-top: 3px;
  opacity: 0; transition: opacity 0.3s;
}
.agenda-notes-saved.show { opacity: 1; }
/* Regen button */
.agenda-regen-btn {
  display: inline-flex; align-items: center; gap: 7px; margin-top: 14px;
  padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 13px;
  font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif;
  background: var(--surface); border: 1px solid var(--border);
  color: var(--text-2); transition: all 0.2s;
}
.agenda-regen-btn:hover { border-color: var(--pink); color: var(--pink); }
.agenda-regen-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.agenda-regen-btn svg { width: 14px; height: 14px; }
`
  document.head.appendChild(style)
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
function esc(v) {
  return String(v || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderCard(agenda) {
  const h = HORIZONTE_CONFIG[agenda.horizonte] || HORIZONTE_CONFIG['7_dias']
  const isDone = agenda.estado === 'completada'
  return `
    <div class="agenda-card${isDone ? ' completada' : ''}" data-agenda-id="${agenda.id}" data-notas="${esc(agenda.notas_consultor || '')}">
      <div class="agenda-card-top">
        <span class="agenda-horizonte-badge" style="background:${h.color}22;color:${h.color}">
          <i data-lucide="${h.icon}"></i> ${h.label}
        </span>
        <label class="agenda-check-wrap" title="${isDone ? 'Marcar pendiente' : 'Marcar completada'}">
          <input type="checkbox" class="agenda-check" data-id="${agenda.id}"${isDone ? ' checked' : ''}>
          <span class="agenda-check-box"></span>
        </label>
      </div>
      <div class="agenda-card-body">
        <div class="agenda-contenido${isDone ? ' tachado' : ''}">${esc(agenda.contenido)}</div>
      </div>
    </div>`
}

function wireCheckboxes(containerEl) {
  containerEl.querySelectorAll('.agenda-check').forEach(cb => {
    cb.addEventListener('change', async () => {
      const id = cb.dataset.id
      const isDone = cb.checked
      const card = cb.closest('.agenda-card')
      card.classList.toggle('completada', isDone)
      const body = card.querySelector('.agenda-contenido')
      if (body) body.classList.toggle('tachado', isDone)
      await supabase
        .from('adn_agendas')
        .update({ estado: isDone ? 'completada' : 'pendiente' })
        .eq('id', id)
    })
  })
}

const _notesTimers = {}
function wireNotesInputs(containerEl) {
  containerEl.querySelectorAll('.agenda-card[data-agenda-id]').forEach(card => {
    const id = card.dataset.agendaId
    const body = card.querySelector('.agenda-card-body')
    if (!body || body.querySelector('.agenda-notes-toggle')) return

    const existingNotes = card.dataset.notas || ''
    const wrap = document.createElement('div')
    wrap.innerHTML = `
      <button class="agenda-notes-toggle" type="button">
        <i data-lucide="pencil-line"></i>
        <span>${existingNotes ? 'Ver nota' : 'Agregar nota'}</span>
      </button>
      <textarea class="agenda-notes-input" placeholder="Notas del consultor…" style="display:none">${esc(existingNotes)}</textarea>
      <div class="agenda-notes-saved">Guardado ✓</div>`
    body.appendChild(wrap)

    const toggleBtn = wrap.querySelector('.agenda-notes-toggle')
    const textarea = wrap.querySelector('.agenda-notes-input')
    const savedEl = wrap.querySelector('.agenda-notes-saved')

    if (existingNotes) textarea.style.display = 'block'

    toggleBtn.addEventListener('click', () => {
      const visible = textarea.style.display !== 'none'
      textarea.style.display = visible ? 'none' : 'block'
      if (!visible) textarea.focus()
    })

    textarea.addEventListener('input', () => {
      clearTimeout(_notesTimers[id])
      _notesTimers[id] = setTimeout(async () => {
        await supabase.from('adn_agendas').update({ notas_consultor: textarea.value }).eq('id', id)
        savedEl.classList.add('show')
        setTimeout(() => savedEl.classList.remove('show'), 2000)
        const span = toggleBtn.querySelector('span')
        if (span) span.textContent = textarea.value.trim() ? 'Ver nota' : 'Agregar nota'
      }, 800)
    })
  })
}

// ──────────────────────────────────────────────
// RENDER AGENDAS — un paso (P0 o P1 o P2)
// ──────────────────────────────────────────────
export async function renderAgendas(sesionId, paso, containerEl) {
  injectStyles()
  containerEl.innerHTML = '<div class="agendas-empty">Cargando…</div>'

  const { data: agendas, error } = await supabase
    .from('adn_agendas')
    .select('*')
    .eq('sesion_id', sesionId)
    .eq('paso', paso)
    .order('horizonte')

  if (error || !agendas || agendas.length === 0) {
    containerEl.innerHTML = '<div class="agendas-empty">No hay agendas generadas para este paso.</div>'
    return
  }

  containerEl.innerHTML = `<div class="agendas-grid">${agendas.map(renderCard).join('')}</div>`
  wireCheckboxes(containerEl)
  wireNotesInputs(containerEl)
  if (window.lucide) lucide.createIcons()
}

// ──────────────────────────────────────────────
// RENDER AGENDAS HUB — todas, agrupadas por horizonte
// ──────────────────────────────────────────────
export async function renderAgendasHub(sesionId, containerEl, sesion = null) {
  injectStyles()

  const { data: agendas, error } = await supabase
    .from('adn_agendas')
    .select('*')
    .eq('sesion_id', sesionId)
    .order('horizonte')

  if (error || !agendas || agendas.length === 0) {
    const canRegen = sesion && (
      sesion.paso_0_estado === 'completado' ||
      sesion.paso_1_estado === 'completado' ||
      sesion.paso_2_estado === 'completado'
    )
    containerEl.innerHTML = `
      <div class="agenda-section-wrap">
        <div class="agenda-section-header">
          <div class="agenda-section-header-icon"><i data-lucide="calendar-check"></i></div>
          <div class="agenda-section-header-text">
            <h3>Agenda ADN · 7 / 30 / 90 días</h3>
            <p>${canRegen ? 'Sesión completada pero sin agendas. Pulsá para generarlas.' : 'Las acciones se generan automáticamente al completar cada paso.'}</p>
          </div>
        </div>
        <div class="agenda-section-body">
          <div class="agendas-empty">
            ${canRegen
              ? `Los pasos están completados pero las agendas aún no fueron generadas.<br><button class="agenda-regen-btn" type="button"><i data-lucide="refresh-cw"></i> Regenerar agendas</button>`
              : 'Completa al menos el Paso 0 para ver tu agenda de implementación.'
            }
          </div>
        </div>
      </div>`
    if (canRegen) {
      containerEl.querySelector('.agenda-regen-btn')?.addEventListener('click', () =>
        regenerarAgendasSesion(sesionId, sesion, containerEl)
      )
    }
    if (window.lucide) lucide.createIcons()
    return
  }

  // Agrupar por horizonte
  const grupos = { '7_dias': [], '30_dias': [], '90_dias': [] }
  agendas.forEach(a => { if (grupos[a.horizonte]) grupos[a.horizonte].push(a) })

  const pendienteTotal = agendas.filter(a => a.estado !== 'completada').length

  const colHTML = (horizonte) => {
    const h = HORIZONTE_CONFIG[horizonte]
    const items = grupos[horizonte]
    if (items.length === 0) {
      return `
      <div class="agendas-hub-col">
        <div class="agendas-hub-col-header" style="background:${h.color}11;color:${h.color};border-color:${h.color}33">
          <i data-lucide="${h.icon}"></i> ${h.label}
        </div>
        <div class="agendas-empty">Sin acciones todavía.</div>
      </div>`
    }
    return `
      <div class="agendas-hub-col">
        <div class="agendas-hub-col-header" style="background:${h.color}11;color:${h.color};border-color:${h.color}33">
          <i data-lucide="${h.icon}"></i> ${h.label}
        </div>
        ${items.map(a => {
          const paso = PASO_CONFIG[a.paso] || { label: a.paso, color: '#888' }
          const isDone = a.estado === 'completada'
          return `
            <div class="agenda-card${isDone ? ' completada' : ''}" data-agenda-id="${a.id}" data-notas="${esc(a.notas_consultor || '')}">
              <div class="agenda-card-top">
                <span class="agenda-card-paso-badge" style="background:${paso.color}22;color:${paso.color}">${paso.label}</span>
                <label class="agenda-check-wrap" title="${isDone ? 'Marcar pendiente' : 'Marcar completada'}">
                  <input type="checkbox" class="agenda-check" data-id="${a.id}"${isDone ? ' checked' : ''}>
                  <span class="agenda-check-box"></span>
                </label>
              </div>
              <div class="agenda-card-body">
                <div class="agenda-contenido${isDone ? ' tachado' : ''}">${esc(a.contenido)}</div>
              </div>
            </div>`
        }).join('')}
      </div>`
  }

  containerEl.innerHTML = `
    <div class="agenda-section-wrap">
      <div class="agenda-section-header">
        <div class="agenda-section-header-icon"><i data-lucide="calendar-check"></i></div>
        <div class="agenda-section-header-text">
          <h3>Agenda ADN · 7 / 30 / 90 días</h3>
          <p>Acciones concretas por horizonte para implementar el diagnóstico.</p>
        </div>
        ${pendienteTotal > 0 ? `<span class="agenda-pending-count">${pendienteTotal} pendiente${pendienteTotal > 1 ? 's' : ''}</span>` : `<span class="agenda-pending-count" style="background:rgba(0,200,83,0.1);color:var(--green,#00c853)">✓ Todo completado</span>`}
      </div>
      <div class="agenda-section-body">
        <div class="agendas-hub-grid">
          ${colHTML('7_dias')}
          ${colHTML('30_dias')}
          ${colHTML('90_dias')}
        </div>
      </div>
    </div>`

  wireCheckboxes(containerEl)
  wireNotesInputs(containerEl)
  if (window.lucide) lucide.createIcons()
}

// ──────────────────────────────────────────────
// REGENERAR AGENDAS — para sesiones completadas sin agendas
// ──────────────────────────────────────────────
export async function regenerarAgendasSesion(sesionId, sesionData, containerEl) {
  const btn = containerEl?.querySelector('.agenda-regen-btn')
  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader"></i> Regenerando…'; lucide.createIcons() }

  const sesion = sesionData || (await supabase.from('adn_sesiones').select('*').eq('id', sesionId).maybeSingle()).data
  if (!sesion) return

  const filas = []

  // Paso 0
  if (sesion.paso_0_estado === 'completado' && sesion.paso_0_tipo_piramide) {
    const ag = AGENDAS_PASO_0[sesion.paso_0_tipo_piramide]
    if (ag) filas.push(
      { sesion_id: sesionId, paso: 'paso_0', horizonte: '7_dias',  contenido: ag['7_dias']  },
      { sesion_id: sesionId, paso: 'paso_0', horizonte: '30_dias', contenido: ag['30_dias'] },
      { sesion_id: sesionId, paso: 'paso_0', horizonte: '90_dias', contenido: ag['90_dias'] }
    )
  }

  // Paso 1
  if (sesion.paso_1_estado === 'completado' && sesion.paso_1_nombre_hibrido) {
    const n = sesion.paso_1_nombre_hibrido
    filas.push(
      { sesion_id: sesionId, paso: 'paso_1', horizonte: '7_dias',  contenido: `Comparte el resultado del Perfil de Personalidad (${n}) con el equipo directivo. Reacción y resonancia.` },
      { sesion_id: sesionId, paso: 'paso_1', horizonte: '30_dias', contenido: `Identifica 1-2 iniciativas concretas que activen los rasgos secundarios del perfil ${n}.` },
      { sesion_id: sesionId, paso: 'paso_1', horizonte: '90_dias', contenido: `Revisión: ¿cómo ha evolucionado el perfil ${n}? ¿Qué rasgos se han fortalecido o debilitado? Conectar con el Mapa ADN del Paso 2.` }
    )
  }

  // Paso 2 — rectores año 1
  const filasRectores = []
  if (sesion.paso_2_estado === 'completado') {
    const { data: rdata } = await supabase
      .from('adn_paso2_rectores')
      .select('id, rector_codigo, ano_construccion, estado_actual')
      .eq('sesion_id', sesionId)
      .eq('ano_construccion', 1)
      .neq('estado_actual', 'operativo')
    for (const r of rdata || []) {
      const info = RECTORES.find(rec => rec.codigo === r.rector_codigo)
      const nombre = info?.nombre || r.rector_codigo
      filasRectores.push(
        { sesion_id: sesionId, paso: 'paso_2_rector', horizonte: '7_dias',  contenido: `[${nombre}] ${AGENDA_PASO_2_RECTOR_TEMPLATE['7_dias']}`,  referencia_id: r.id },
        { sesion_id: sesionId, paso: 'paso_2_rector', horizonte: '30_dias', contenido: `[${nombre}] ${AGENDA_PASO_2_RECTOR_TEMPLATE['30_dias']}`, referencia_id: r.id },
        { sesion_id: sesionId, paso: 'paso_2_rector', horizonte: '90_dias', contenido: `[${nombre}] ${AGENDA_PASO_2_RECTOR_TEMPLATE['90_dias']}`, referencia_id: r.id }
      )
    }
  }

  // Borrar todas las agendas existentes de esta sesión y reinsertar
  const todasFilas = [...filas, ...filasRectores]
  if (todasFilas.length === 0) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="refresh-cw"></i> Sin datos para generar'; lucide.createIcons() }
    return
  }

  await supabase.from('adn_agendas').delete().eq('sesion_id', sesionId)
  const { error } = await supabase.from('adn_agendas').insert(todasFilas)
  if (error) {
    console.error('❌ regenerarAgendasSesion:', error.message)
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="refresh-cw"></i> Reintentar'; lucide.createIcons() }
    return
  }

  if (containerEl) await renderAgendasHub(sesionId, containerEl, sesion)
}
