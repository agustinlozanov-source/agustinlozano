// SCALEx PORTAL - Costeo - Gastos Fijos
import {
  supabase,
  getMyProfile,
  getMyOrganization,
  signOut
} from './supabase-client.js'

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => Array.from(document.querySelectorAll(sel))

const initials = (name) => {
  if (!name) return '..'
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase()
}

const fmtMoney = (amount, currency = 'MXN') => {
  if (amount === null || amount === undefined || isNaN(amount)) return '$ 0'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(amount)
}

const parseAmount = (str) => {
  if (str === null || str === undefined) return 0
  const cleaned = String(str).replace(/[^0-9.,-]/g, '').replace(/,/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

let state = {
  org: null, profile: null, gastosRecord: null,
  conceptos: [], unidadesEstimadas: 100, moneda: 'MXN'
}

let saveTimer = null
let isSaving = false

const CONCEPTOS_DEFAULT = [
  { nombre: 'Renta del local' },
  { nombre: 'Nomina total' },
  { nombre: 'Energia electrica' },
  { nombre: 'Gas' },
  { nombre: 'Agua' },
  { nombre: 'Internet y telefonia' },
  { nombre: 'Software y suscripciones' }
]

const ICON_MAP = {
  'renta': 'building', 'local': 'building', 'alquiler': 'building',
  'nomina': 'users', 'sueldo': 'users', 'salario': 'users', 'personal': 'users',
  'energia': 'zap', 'electricidad': 'zap', 'luz': 'zap',
  'gas': 'flame', 'agua': 'droplet',
  'internet': 'wifi', 'telefon': 'wifi',
  'software': 'monitor', 'suscripcion': 'monitor',
  'mantenimiento': 'wrench',
  'publicidad': 'megaphone', 'marketing': 'megaphone',
  'transporte': 'truck',
  'banco': 'landmark', 'comision': 'landmark',
  'seguro': 'shield', 'limpieza': 'sparkles',
  'oficina': 'briefcase', 'impuesto': 'receipt'
}

const getIcon = (nombre) => {
  const lower = (nombre || '').toLowerCase()
  for (const [keyword, icon] of Object.entries(ICON_MAP)) {
    if (lower.includes(keyword)) return icon
  }
  return 'circle-dollar-sign'
}

async function loadGastosFijos(orgId) {
  const { data, error } = await supabase
    .from('gastos_fijos_costeo')
    .select('*')
    .eq('organizacion_id', orgId)
    .maybeSingle()
  if (error) console.error('[costeo-gastos] load error', error)
  return data
}

async function createGastosFijosInicial(orgId) {
  const conceptosObj = {}
  CONCEPTOS_DEFAULT.forEach(c => { conceptosObj[c.nombre] = 0 })

  const { data, error } = await supabase
    .from('gastos_fijos_costeo')
    .insert({
      organizacion_id: orgId,
      conceptos: conceptosObj,
      unidades_estimadas_mes: 100,
      moneda: 'MXN',
      created_by: state.profile?.id
    })
    .select('*')
    .single()
  if (error) { console.error('[costeo-gastos] create error', error); return null }
  return data
}

function jsonbToArray(jsonb) {
  if (!jsonb || typeof jsonb !== 'object') return []
  return Object.entries(jsonb).map(([nombre, monto], idx) => ({
    id: 'c-' + idx + '-' + Date.now(),
    nombre, monto: parseAmount(monto)
  }))
}

function arrayToJsonb(arr) {
  const out = {}
  arr.forEach(c => {
    if (c.nombre && c.nombre.trim()) out[c.nombre.trim()] = c.monto || 0
  })
  return out
}

function renderHeader() {
  const avatar = initials((state.profile?.nombre || '') + ' ' + (state.profile?.apellido || ''))
  $$('.user-avatar').forEach(el => el.textContent = avatar)
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderConceptos() {
  const wrap = $('#conceptos-list')
  if (!wrap) return

  if (state.conceptos.length === 0) {
    wrap.innerHTML = '<div class="empty-state">Sin conceptos todavia. Agrega el primero abajo.</div>'
  } else {
    wrap.innerHTML = state.conceptos.map(c => {
      const monto = c.monto > 0 ? c.monto.toLocaleString('es-MX') : ''
      return '<div class="input-row" data-id="' + c.id + '">' +
        '<div class="input-label-wrap">' +
          '<i data-lucide="' + getIcon(c.nombre) + '"></i>' +
          '<input type="text" class="input-nombre" value="' + escapeHtml(c.nombre) + '" placeholder="Concepto" data-field="nombre" data-id="' + c.id + '" />' +
        '</div>' +
        '<input type="text" class="input-monto" value="' + monto + '" placeholder="0" data-field="monto" data-id="' + c.id + '" inputmode="numeric" />' +
        '<span class="unit">' + state.moneda + ' / mes</span>' +
        '<button class="row-delete" data-id="' + c.id + '" title="Eliminar"><i data-lucide="x"></i></button>' +
      '</div>'
    }).join('')
  }

  wrap.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', onConceptInput)
    if (input.classList.contains('input-monto')) input.addEventListener('blur', onMontoBlur)
  })

  wrap.querySelectorAll('.row-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      deleteConcepto(btn.dataset.id)
    })
  })

  renderTotal()
  if (window.lucide) lucide.createIcons()
}

function renderTotal() {
  const total = state.conceptos.reduce((sum, c) => sum + (c.monto || 0), 0)
  const totalEl = $('#total-gastos-display')
  if (totalEl) totalEl.textContent = fmtMoney(total, state.moneda)

  const unidades = state.unidadesEstimadas || 1
  const porUnidad = total / unidades
  const prorEl = $('#prorrateo-display')
  if (prorEl) prorEl.textContent = fmtMoney(porUnidad, state.moneda)

  const countEl = $('#count-conceptos')
  if (countEl) countEl.textContent = state.conceptos.length
}

function renderUnidadesEstimadas() {
  const inp = $('#unidades-estimadas')
  if (inp) inp.value = state.unidadesEstimadas
  renderTotal()
}

function onConceptInput(e) {
  const id = e.target.dataset.id
  const field = e.target.dataset.field
  const concepto = state.conceptos.find(c => c.id === id)
  if (!concepto) return

  if (field === 'nombre') {
    concepto.nombre = e.target.value
    const iconEl = e.target.closest('.input-row').querySelector('.input-label-wrap i')
    if (iconEl) {
      iconEl.setAttribute('data-lucide', getIcon(concepto.nombre))
      if (window.lucide) lucide.createIcons()
    }
  } else if (field === 'monto') {
    concepto.monto = parseAmount(e.target.value)
    renderTotal()
  }
  scheduleSave()
}

function onMontoBlur(e) {
  const val = parseAmount(e.target.value)
  e.target.value = val > 0 ? val.toLocaleString('es-MX') : ''
}

function onUnidadesInput(e) {
  const val = parseInt(e.target.value) || 1
  state.unidadesEstimadas = Math.max(1, val)
  renderTotal()
  scheduleSave()
}

function addConcepto() {
  state.conceptos.push({
    id: 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2,6),
    nombre: '', monto: 0
  })
  renderConceptos()
  setTimeout(() => {
    const inputs = document.querySelectorAll('.input-nombre')
    if (inputs.length > 0) inputs[inputs.length - 1].focus()
  }, 50)
  scheduleSave()
}

function deleteConcepto(id) {
  state.conceptos = state.conceptos.filter(c => c.id !== id)
  renderConceptos()
  scheduleSave()
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  showSaveStatus('editing')
  saveTimer = setTimeout(doSave, 1200)
}

async function doSave() {
  if (isSaving || !state.gastosRecord) return
  isSaving = true
  showSaveStatus('saving')

  const conceptosObj = arrayToJsonb(state.conceptos)

  const { error } = await supabase
    .from('gastos_fijos_costeo')
    .update({
      conceptos: conceptosObj,
      unidades_estimadas_mes: state.unidadesEstimadas
    })
    .eq('id', state.gastosRecord.id)

  isSaving = false

  if (error) {
    console.error('[costeo-gastos] save error', error)
    showSaveStatus('error')
    return
  }
  showSaveStatus('saved')
}

function showSaveStatus(status) {
  const el = $('#save-indicator')
  if (!el) return

  const states = {
    editing: { text: 'Editando...',      cls: 'editing', icon: 'pencil' },
    saving:  { text: 'Guardando...',     cls: 'saving',  icon: 'loader-2' },
    saved:   { text: 'Guardado',         cls: 'saved',   icon: 'check-circle' },
    error:   { text: 'Error al guardar', cls: 'error',   icon: 'alert-circle' }
  }

  const s = states[status]
  el.className = 'save-indicator ' + s.cls
  el.innerHTML = '<i data-lucide="' + s.icon + '"></i><span>' + s.text + '</span>'
  if (window.lucide) lucide.createIcons()
}

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
window.addConcepto = addConcepto

async function init() {
  try {
    const [profile, org] = await Promise.all([
      getMyProfile(),
      getMyOrganization()
    ])

    state.profile = profile
    state.org = org

    if (!org) {
      $('.content').innerHTML = '<div class="empty-state-big"><h2>Sin organizacion asignada</h2><p>Contacta a Agustin.</p></div>'
      return
    }

    renderHeader()

    let gastosRecord = await loadGastosFijos(org.id)
    if (!gastosRecord) {
      gastosRecord = await createGastosFijosInicial(org.id)
    }

    if (!gastosRecord) {
      $('#conceptos-list').innerHTML = '<div class="empty-state">No se pudo cargar la informacion.</div>'
      return
    }

    state.gastosRecord = gastosRecord
    state.conceptos = jsonbToArray(gastosRecord.conceptos)
    state.unidadesEstimadas = gastosRecord.unidades_estimadas_mes || 100
    state.moneda = gastosRecord.moneda || 'MXN'

    if (state.conceptos.length === 0) {
      state.conceptos = CONCEPTOS_DEFAULT.map((c, idx) => ({
        id: 'c-' + idx + '-' + Date.now(),
        nombre: c.nombre, monto: 0
      }))
    }

    const ue = $('#unidades-estimadas')
    if (ue) ue.addEventListener('input', onUnidadesInput)

    renderConceptos()
    renderUnidadesEstimadas()
    showSaveStatus('saved')

    if (window.lucide) lucide.createIcons()

  } catch (err) {
    console.error('[costeo-gastos] init error:', err)
  }
}

init()
