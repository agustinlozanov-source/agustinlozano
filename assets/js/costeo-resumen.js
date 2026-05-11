// SCALEx PORTAL - Costeo - Resumen y Punto de equilibrio
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

const fmtMoney = (amount, decimales = 0) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '$ 0'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN',
    maximumFractionDigits: decimales
  }).format(amount)
}

const fmtNum = (n, dec = 0) => {
  if (n === null || n === undefined || isNaN(n)) return '0'
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: dec }).format(n)
}

const fmtPct = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '0%'
  return fmtNum(n, 1) + '%'
}

let state = {
  org: null,
  profile: null,
  gastosFijos: null,
  productos: [],
  productosCostos: {},
  // Simulador
  sim: {
    activo: false,
    precios: 0,        // % cambio en precios (-20 a +20)
    gastos: 0,         // % cambio en gastos fijos
    insumos: 0         // % cambio en costos directos
  }
}

async function loadAllData(orgId) {
  const [gastos, productos] = await Promise.all([
    supabase.from('gastos_fijos_costeo').select('*').eq('organizacion_id', orgId).maybeSingle(),
    supabase.from('productos').select('*').eq('organizacion_id', orgId).eq('activo', true).order('nombre')
  ])

  state.gastosFijos = gastos.data
  state.productos = productos.data || []

  // Cargar costos de cada producto
  const promises = state.productos.map(async p => {
    const { data, error } = await supabase.rpc('costo_producto', { p_producto_id: p.id })
    if (error) { console.error('costo_producto', error); return { id: p.id, b: null } }
    return { id: p.id, b: data }
  })
  const results = await Promise.all(promises)
  state.productosCostos = {}
  results.forEach(r => { if (r.b) state.productosCostos[r.id] = r.b })
}

// CALCULOS
function getTotalGastosFijos() {
  if (!state.gastosFijos) return 0
  const conceptos = state.gastosFijos.conceptos || {}
  const total = Object.values(conceptos).reduce((s, v) => s + parseFloat(v || 0), 0)
  return total * (1 + state.sim.gastos / 100)
}

function getUnidadesEstimadas() {
  return state.gastosFijos?.unidades_estimadas_mes || 1
}

function getProductoData(p) {
  const breakdown = state.productosCostos[p.id]
  if (!breakdown) return null

  const recursos = parseFloat(breakdown.recursos_directos || 0)
  const componentes = parseFloat(breakdown.componentes || 0)
  const gastosFijosOrig = parseFloat(breakdown.gastos_fijos || 0)

  // Aplicar simulacion
  const costoDirecto = (recursos + componentes) * (1 + state.sim.insumos / 100)
  const gastosFijos = gastosFijosOrig * (1 + state.sim.gastos / 100)
  const costoTotal = costoDirecto + gastosFijos
  const precio = parseFloat(breakdown.precio_venta || p.precio_venta || 0) * (1 + state.sim.precios / 100)
  const utilidad = precio - costoTotal
  const margenPct = precio > 0 ? (utilidad / precio) * 100 : 0

  return {
    nombre: p.nombre,
    categoria: p.categoria,
    recursos, componentes, gastosFijos, costoDirecto, costoTotal,
    precio, utilidad, margenPct,
    contribucionUnit: precio - costoDirecto  // sin gastos fijos
  }
}

function getMarginClass(pct) {
  if (pct >= 30) return 'good'
  if (pct >= 10) return 'warn'
  if (pct >= 0) return 'low'
  return 'bad'
}

function calcularPuntoEquilibrio() {
  const totalGastos = getTotalGastosFijos()
  if (totalGastos === 0 || state.productos.length === 0) return null

  // Margen de contribucion promedio (% del precio que queda despues de costo directo)
  let sumaMargenContribucionPct = 0
  let sumaPrecios = 0
  let productosValidos = 0
  let mejorProducto = null
  let peorProducto = null

  state.productos.forEach(p => {
    const d = getProductoData(p)
    if (!d || d.precio <= 0) return
    const mcPct = (d.contribucionUnit / d.precio) * 100
    sumaMargenContribucionPct += mcPct
    sumaPrecios += d.precio
    productosValidos++

    if (!mejorProducto || d.margenPct > mejorProducto.margenPct) mejorProducto = d
    if (!peorProducto || d.margenPct < peorProducto.margenPct) peorProducto = d
  })

  if (productosValidos === 0) return null

  const mcPromedio = sumaMargenContribucionPct / productosValidos
  const precioPromedio = sumaPrecios / productosValidos

  // Ventas requeridas en pesos para cubrir gastos fijos
  const ventasMinimas = mcPromedio > 0 ? totalGastos / (mcPromedio / 100) : 0
  // Unidades aproximadas
  const unidadesMinimas = precioPromedio > 0 ? ventasMinimas / precioPromedio : 0

  return {
    totalGastos,
    mcPromedio,
    precioPromedio,
    ventasMinimas,
    unidadesMinimas,
    mejorProducto,
    peorProducto,
    productosValidos
  }
}

function renderHeader() {
  const avatar = initials((state.profile?.nombre || '') + ' ' + (state.profile?.apellido || ''))
  $$('.user-avatar').forEach(el => el.textContent = avatar)
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ─────────────────────────────────────
// KPIs
// ─────────────────────────────────────
function renderKpis() {
  const productosData = state.productos.map(p => getProductoData(p)).filter(d => d)

  const rentables = productosData.filter(d => d.margenPct >= 30).length
  const alerta = productosData.filter(d => d.margenPct >= 0 && d.margenPct < 30).length
  const perdida = productosData.filter(d => d.margenPct < 0).length

  const sumMargen = productosData.reduce((s, d) => s + d.margenPct, 0)
  const margenProm = productosData.length > 0 ? sumMargen / productosData.length : 0

  $('#kpi-margen').textContent = fmtPct(margenProm)
  $('#kpi-rentables').textContent = rentables
  $('#kpi-alerta').textContent = alerta
  $('#kpi-perdida').textContent = perdida

  // Subtitulos
  const total = productosData.length
  $('#kpi-rentables-sub').textContent = total > 0 ? Math.round((rentables / total) * 100) + '% del catalogo' : ''
  $('#kpi-alerta-sub').textContent = 'Margen < 30%'
  $('#kpi-perdida-sub').textContent = 'Precio < costo'
}

// ─────────────────────────────────────
// Ranking de productos
// ─────────────────────────────────────
function renderRanking() {
  const wrap = $('#ranking-list')
  if (!wrap) return

  if (state.productos.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><i data-lucide="shopping-bag"></i><h3>Sin productos todavia</h3><p>Crea productos en la seccion de Productos para ver el ranking de rentabilidad.</p></div>'
    if (window.lucide) lucide.createIcons()
    return
  }

  const productosData = state.productos
    .map(p => getProductoData(p))
    .filter(d => d)
    .sort((a, b) => b.margenPct - a.margenPct)

  const maxMargen = Math.max(...productosData.map(d => Math.abs(d.margenPct)), 1)

  wrap.innerHTML = productosData.map((d, idx) => {
    const pos = idx + 1
    const cls = pos === 1 ? 'gold' : pos === 2 ? 'silver' : pos === 3 ? 'bronze' : ''
    const barWidth = Math.min(100, Math.max(5, (Math.abs(d.margenPct) / maxMargen) * 100))
    const barClass = d.margenPct >= 30 ? 'green' : d.margenPct >= 0 ? 'amber' : 'red'
    const marginClass = getMarginClass(d.margenPct)

    return '<div class="ranking-item ' + cls + '">' +
      '<div class="ranking-num">' + pos + '</div>' +
      '<div class="ranking-body">' +
        '<div class="ranking-name">' + escapeHtml(d.nombre) + '</div>' +
        (d.categoria ? '<div class="ranking-cat">' + escapeHtml(d.categoria) + '</div>' : '') +
      '</div>' +
      '<div class="ranking-numbers">' +
        '<div class="rk-num"><div class="rk-num-label">Precio</div><div class="rk-num-val">' + fmtMoney(d.precio) + '</div></div>' +
        '<div class="rk-num"><div class="rk-num-label">Costo</div><div class="rk-num-val">' + fmtMoney(d.costoTotal) + '</div></div>' +
        '<div class="rk-num"><div class="rk-num-label">Utilidad</div><div class="rk-num-val ' + (d.utilidad >= 0 ? 'pos' : 'neg') + '">' + fmtMoney(d.utilidad) + '</div></div>' +
      '</div>' +
      '<div class="ranking-margin">' +
        '<div class="margin-pill ' + marginClass + '">' + fmtPct(d.margenPct) + '</div>' +
        '<div class="ranking-bar-wrap">' +
          '<div class="ranking-bar ' + barClass + '" style="width:' + barWidth + '%"></div>' +
        '</div>' +
      '</div>' +
    '</div>'
  }).join('')

  if (window.lucide) lucide.createIcons()
}

// ─────────────────────────────────────
// Punto de equilibrio
// ─────────────────────────────────────
function renderEquilibrio() {
  const pe = calcularPuntoEquilibrio()
  const wrap = $('#equilibrio-card')
  if (!wrap) return

  if (!pe) {
    wrap.innerHTML = '<div class="empty-state-small"><i data-lucide="info"></i><p>Necesitas configurar gastos fijos y al menos un producto con precio para calcular el punto de equilibrio.</p></div>'
    if (window.lucide) lucide.createIcons()
    return
  }

  $('#pe-ventas').textContent = fmtMoney(pe.ventasMinimas)
  $('#pe-gastos').textContent = fmtMoney(pe.totalGastos)
  $('#pe-margen-cont').textContent = fmtPct(pe.mcPromedio)
  $('#pe-unidades').textContent = fmtNum(pe.unidadesMinimas, 0)

  // Tabla de unidades por producto
  renderUnidadesPorProducto(pe)
}

function renderUnidadesPorProducto(pe) {
  const tbody = $('#equilibrio-tbody')
  if (!tbody) return

  const productosData = state.productos
    .map(p => getProductoData(p))
    .filter(d => d && d.contribucionUnit > 0)
    .sort((a, b) => b.contribucionUnit - a.contribucionUnit)

  if (productosData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-3);padding:30px;">Sin productos con contribucion positiva</td></tr>'
    return
  }

  tbody.innerHTML = productosData.map(d => {
    const unidadesMes = pe.totalGastos > 0 ? Math.ceil(pe.totalGastos / d.contribucionUnit) : 0
    const unidadesDia = Math.ceil(unidadesMes / 30)

    return '<tr>' +
      '<td><strong>' + escapeHtml(d.nombre) + '</strong></td>' +
      '<td class="num money">' + fmtMoney(d.contribucionUnit) + '</td>' +
      '<td class="num money">' + fmtNum(unidadesMes, 0) + '</td>' +
      '<td class="num money">' + fmtNum(unidadesDia, 0) + '</td>' +
    '</tr>'
  }).join('')
}

// ─────────────────────────────────────
// SIMULADOR
// ─────────────────────────────────────
function renderSimulator() {
  $('#sim-precios-val').textContent = (state.sim.precios >= 0 ? '+' : '') + state.sim.precios + '%'
  $('#sim-gastos-val').textContent = (state.sim.gastos >= 0 ? '+' : '') + state.sim.gastos + '%'
  $('#sim-insumos-val').textContent = (state.sim.insumos >= 0 ? '+' : '') + state.sim.insumos + '%'

  $('#sim-precios-slider').value = state.sim.precios
  $('#sim-gastos-slider').value = state.sim.gastos
  $('#sim-insumos-slider').value = state.sim.insumos
}

function applySim() {
  renderKpis()
  renderRanking()
  renderEquilibrio()
  renderSimulator()
}

function resetSim() {
  state.sim.precios = 0
  state.sim.gastos = 0
  state.sim.insumos = 0
  applySim()
}

// ─────────────────────────────────────
// Listeners
// ─────────────────────────────────────
function attachListeners() {
  $('#sim-precios-slider').addEventListener('input', (e) => {
    state.sim.precios = parseInt(e.target.value)
    applySim()
  })
  $('#sim-gastos-slider').addEventListener('input', (e) => {
    state.sim.gastos = parseInt(e.target.value)
    applySim()
  })
  $('#sim-insumos-slider').addEventListener('input', (e) => {
    state.sim.insumos = parseInt(e.target.value)
    applySim()
  })
  $('#sim-reset').addEventListener('click', resetSim)
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

async function init() {
  try {
    const [profile, org] = await Promise.all([getMyProfile(), getMyOrganization()])
    state.profile = profile
    state.org = org

    if (!org) {
      $('.content').innerHTML = '<div class="empty-state-big"><h2>Sin organizacion asignada</h2></div>'
      return
    }

    renderHeader()
    await loadAllData(org.id)

    // Si no hay datos suficientes
    if (state.productos.length === 0) {
      $('#alert-no-data').style.display = 'flex'
    }
    if (!state.gastosFijos || Object.keys(state.gastosFijos.conceptos || {}).length === 0) {
      $('#alert-no-gastos').style.display = 'flex'
    }

    attachListeners()
    applySim()

    if (window.lucide) lucide.createIcons()
  } catch (err) {
    console.error('[resumen] init error:', err)
  }
}

init()
