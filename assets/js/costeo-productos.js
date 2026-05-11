// SCALEx PORTAL - Costeo - Productos
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
    style: 'currency', currency,
    maximumFractionDigits: amount < 1 ? 4 : 2
  }).format(amount)
}

const parseAmount = (str) => {
  if (str === null || str === undefined) return 0
  const cleaned = String(str).replace(/[^0-9.,-]/g, '').replace(/,/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

const fmtNum = (n, dec = 2) => {
  if (n === null || n === undefined || isNaN(n)) return '0'
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: dec }).format(n)
}

let state = {
  org: null,
  profile: null,
  productos: [],
  recursos: [],
  componentes: [],
  componentesCostos: {},      // map id -> costo total
  productosCostos: {},        // map id -> {recursos_directos, componentes, gastos_fijos, costo_total, utilidad, margen_pct, precio_venta}
  gastosFijos: null,
  filterSearch: '',
  filterMargin: 'todos',      // todos | rentables | alerta | perdida
  editingId: null,
  builderRecursos: [],
  builderComponentes: []
}

const UNIDADES_COMUNES = [
  { value: 'gr', label: 'gr (gramos)', grupo: 'Peso' },
  { value: 'kg', label: 'kg (kilogramos)', grupo: 'Peso' },
  { value: 'lb', label: 'lb (libras)', grupo: 'Peso' },
  { value: 'ml', label: 'ml (mililitros)', grupo: 'Volumen' },
  { value: 'lt', label: 'lt (litros)', grupo: 'Volumen' },
  { value: 'hora', label: 'hora', grupo: 'Tiempo' },
  { value: 'min', label: 'minuto', grupo: 'Tiempo' },
  { value: 'unidad', label: 'unidad', grupo: 'Cantidad' },
  { value: 'pieza', label: 'pieza', grupo: 'Cantidad' },
  { value: 'paquete', label: 'paquete', grupo: 'Cantidad' },
  { value: 'porcion', label: 'porcion', grupo: 'Cantidad' },
  { value: 'metro', label: 'metro', grupo: 'Longitud' },
  { value: 'cm', label: 'cm', grupo: 'Longitud' }
]

async function loadProductos() {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('organizacion_id', state.org.id)
    .order('nombre', { ascending: true })
  if (error) { console.error('[productos] load', error); return [] }
  return data || []
}

async function loadRecursos() {
  const { data, error } = await supabase
    .from('recursos')
    .select('*')
    .eq('organizacion_id', state.org.id)
    .eq('activo', true)
    .order('nombre', { ascending: true })
  if (error) { console.error('[recursos] load', error); return [] }
  return data || []
}

async function loadComponentes() {
  const { data, error } = await supabase
    .from('componentes')
    .select('*')
    .eq('organizacion_id', state.org.id)
    .eq('activo', true)
    .order('nombre', { ascending: true })
  if (error) { console.error('[componentes] load', error); return [] }
  return data || []
}

async function loadGastosFijos() {
  const { data, error } = await supabase
    .from('gastos_fijos_costeo')
    .select('*')
    .eq('organizacion_id', state.org.id)
    .maybeSingle()
  if (error) console.error('[gastos] load', error)
  return data
}

async function loadProductoDetalle(id) {
  const [{ data: recursos }, { data: comps }] = await Promise.all([
    supabase.from('producto_recursos')
      .select('*, recursos(*)')
      .eq('producto_id', id)
      .order('orden'),
    supabase.from('producto_componentes')
      .select('*, componente:componentes!componente_id(*)')
      .eq('producto_id', id)
      .order('orden')
  ])
  return {
    recursos: recursos || [],
    componentes: comps || []
  }
}

async function loadCostoComponente(id) {
  const { data, error } = await supabase.rpc('costo_componente', { p_componente_id: id })
  if (error) { console.error('[costo_componente]', error); return 0 }
  return parseFloat(data || 0)
}

async function loadCostoProducto(id) {
  const { data, error } = await supabase.rpc('costo_producto', { p_producto_id: id })
  if (error) { console.error('[costo_producto]', error); return null }
  return data
}

async function loadTodosLosCostosComponentes() {
  const promises = state.componentes.map(async c => {
    const costo = await loadCostoComponente(c.id)
    return { id: c.id, costo }
  })
  const results = await Promise.all(promises)
  state.componentesCostos = {}
  results.forEach(r => { state.componentesCostos[r.id] = r.costo })
}

async function loadTodosLosCostosProductos() {
  const promises = state.productos.map(async p => {
    const breakdown = await loadCostoProducto(p.id)
    return { id: p.id, breakdown }
  })
  const results = await Promise.all(promises)
  state.productosCostos = {}
  results.forEach(r => {
    if (r.breakdown) state.productosCostos[r.id] = r.breakdown
  })
}

async function crearProducto(payload, recursos, componentes) {
  const { data: prod, error: e1 } = await supabase
    .from('productos')
    .insert({
      organizacion_id: state.org.id,
      nombre: payload.nombre,
      categoria: payload.categoria || null,
      descripcion: payload.descripcion || null,
      sku: payload.sku || null,
      precio_venta: payload.precio_venta,
      notas: payload.notas || null,
      activo: true,
      created_by: state.profile?.id
    })
    .select('*').single()

  if (e1) { console.error('[crearProducto]', e1); return null }

  if (recursos.length > 0) {
    const rows = recursos.map((r, idx) => ({
      producto_id: prod.id,
      recurso_id: r.recurso_id,
      cantidad: r.cantidad,
      unidad: r.unidad,
      orden: idx
    }))
    const { error: e2 } = await supabase.from('producto_recursos').insert(rows)
    if (e2) console.error('[producto_recursos]', e2)
  }

  if (componentes.length > 0) {
    const rows = componentes.map((c, idx) => ({
      producto_id: prod.id,
      componente_id: c.componente_id,
      cantidad: c.cantidad,
      unidad: c.unidad,
      orden: idx
    }))
    const { error: e3 } = await supabase.from('producto_componentes').insert(rows)
    if (e3) console.error('[producto_componentes]', e3)
  }

  return prod
}

async function updateProducto(id, payload, recursos, componentes) {
  const { data: prod, error: e1 } = await supabase
    .from('productos')
    .update(payload)
    .eq('id', id)
    .select('*').single()

  if (e1) { console.error('[updateProducto]', e1); return null }

  await supabase.from('producto_recursos').delete().eq('producto_id', id)
  await supabase.from('producto_componentes').delete().eq('producto_id', id)

  if (recursos.length > 0) {
    const rows = recursos.map((r, idx) => ({
      producto_id: id,
      recurso_id: r.recurso_id,
      cantidad: r.cantidad,
      unidad: r.unidad,
      orden: idx
    }))
    await supabase.from('producto_recursos').insert(rows)
  }
  if (componentes.length > 0) {
    const rows = componentes.map((c, idx) => ({
      producto_id: id,
      componente_id: c.componente_id,
      cantidad: c.cantidad,
      unidad: c.unidad,
      orden: idx
    }))
    await supabase.from('producto_componentes').insert(rows)
  }

  return prod
}

async function deleteProducto(id) {
  const { error } = await supabase.from('productos').delete().eq('id', id)
  if (error) { console.error('[deleteProducto]', error); return false }
  return true
}

function renderHeader() {
  const avatar = initials((state.profile?.nombre || '') + ' ' + (state.profile?.apellido || ''))
  $$('.user-avatar').forEach(el => el.textContent = avatar)
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getMarginClass(pct) {
  if (pct >= 30) return 'good'
  if (pct >= 10) return 'warn'
  if (pct >= 0) return 'low'
  return 'bad'
}

function getFilteredProductos() {
  let list = state.productos.filter(p => p.activo)

  if (state.filterMargin !== 'todos') {
    list = list.filter(p => {
      const b = state.productosCostos[p.id]
      if (!b) return state.filterMargin === 'sin-datos'
      const pct = parseFloat(b.margen_pct || 0)
      if (state.filterMargin === 'rentables') return pct >= 30
      if (state.filterMargin === 'alerta')    return pct >= 0 && pct < 30
      if (state.filterMargin === 'perdida')   return pct < 0
      return true
    })
  }

  if (state.filterSearch) {
    const q = state.filterSearch.toLowerCase()
    list = list.filter(p =>
      (p.nombre || '').toLowerCase().includes(q) ||
      (p.categoria || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q)
    )
  }
  return list
}

function renderList() {
  const wrap = $('#prod-list')
  if (!wrap) return

  const list = getFilteredProductos()

  if (list.length === 0) {
    if (state.productos.length === 0) {
      wrap.innerHTML = '<div class="empty-state"><i data-lucide="shopping-bag"></i><h3>Aun no tienes productos</h3><p>Los productos son lo que vendes. Cada uno tiene su receta (recursos + componentes) y su precio. Crea el primero arriba.</p></div>'
    } else {
      wrap.innerHTML = '<div class="empty-state"><i data-lucide="search"></i><h3>Sin resultados con esos filtros</h3></div>'
    }
    if (window.lucide) lucide.createIcons()
    updateCounter()
    return
  }

  wrap.innerHTML = list.map(p => {
    const b = state.productosCostos[p.id]
    const costoTotal = b ? parseFloat(b.costo_total) : 0
    const utilidad = b ? parseFloat(b.utilidad) : 0
    const margenPct = b ? parseFloat(b.margen_pct) : 0
    const marginCls = getMarginClass(margenPct)

    return '<div class="prod-card" data-id="' + p.id + '">' +
      '<div class="prod-icon"><i data-lucide="shopping-bag"></i></div>' +
      '<div class="prod-body">' +
        '<div class="prod-name">' + escapeHtml(p.nombre) + '</div>' +
        '<div class="prod-meta">' +
          (p.categoria ? '<span class="meta-item">' + escapeHtml(p.categoria) + '</span>' : '') +
          (p.sku ? ' <span class="meta-item">SKU: ' + escapeHtml(p.sku) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="prod-numbers">' +
        '<div class="num-block">' +
          '<div class="num-label">Precio</div>' +
          '<div class="num-value precio">' + fmtMoney(p.precio_venta) + '</div>' +
        '</div>' +
        '<div class="num-block">' +
          '<div class="num-label">Costo</div>' +
          '<div class="num-value">' + fmtMoney(costoTotal) + '</div>' +
        '</div>' +
        '<div class="num-block">' +
          '<div class="num-label">Utilidad</div>' +
          '<div class="num-value ' + (utilidad >= 0 ? 'pos' : 'neg') + '">' + fmtMoney(utilidad) + '</div>' +
        '</div>' +
        '<div class="num-block">' +
          '<div class="num-label">Margen</div>' +
          '<div class="margin-pill ' + marginCls + '">' + fmtNum(margenPct, 1) + '%</div>' +
        '</div>' +
      '</div>' +
      '<div class="prod-actions">' +
        '<button class="icon-btn" data-action="view" data-id="' + p.id + '" title="Ver receta"><i data-lucide="layers"></i></button>' +
        '<button class="icon-btn" data-action="edit" data-id="' + p.id + '" title="Editar"><i data-lucide="edit-2"></i></button>' +
        '<button class="icon-btn" data-action="delete" data-id="' + p.id + '" title="Eliminar"><i data-lucide="trash-2"></i></button>' +
      '</div>' +
    '</div>'
  }).join('')

  wrap.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const action = btn.dataset.action
      const id = btn.dataset.id
      if (action === 'edit' || action === 'view') openEditModal(id)
      else if (action === 'delete') confirmDelete(id)
    })
  })

  if (window.lucide) lucide.createIcons()
  updateCounter()
}

function updateCounter() {
  const total = state.productos.filter(p => p.activo).length
  const showing = getFilteredProductos().length
  const el = $('#count-display')
  if (el) {
    if (state.filterSearch || state.filterMargin !== 'todos') {
      el.textContent = showing + ' de ' + total
    } else {
      el.textContent = total + ' producto' + (total !== 1 ? 's' : '')
    }
  }

  // KPIs
  const rentables = state.productos.filter(p => {
    const b = state.productosCostos[p.id]
    return b && parseFloat(b.margen_pct) >= 30
  }).length
  const enAlerta = state.productos.filter(p => {
    const b = state.productosCostos[p.id]
    return b && parseFloat(b.margen_pct) < 30 && parseFloat(b.margen_pct) >= 0
  }).length
  const perdida = state.productos.filter(p => {
    const b = state.productosCostos[p.id]
    return b && parseFloat(b.margen_pct) < 0
  }).length

  // Margen promedio
  const validos = state.productos.filter(p => state.productosCostos[p.id])
  const sumMargen = validos.reduce((s, p) => s + parseFloat(state.productosCostos[p.id].margen_pct || 0), 0)
  const promedio = validos.length > 0 ? sumMargen / validos.length : 0

  const el1 = $('#kpi-promedio')
  if (el1) el1.textContent = fmtNum(promedio, 1) + '%'
  const el2 = $('#kpi-rentables')
  if (el2) el2.textContent = rentables
  const el3 = $('#kpi-alerta')
  if (el3) el3.textContent = enAlerta
  const el4 = $('#kpi-perdida')
  if (el4) el4.textContent = perdida
}

function renderUnidadesOptions(selected) {
  const grupos = {}
  UNIDADES_COMUNES.forEach(u => {
    if (!grupos[u.grupo]) grupos[u.grupo] = []
    grupos[u.grupo].push(u)
  })
  let html = '<option value="">Unidad...</option>'
  for (const grupo of Object.keys(grupos)) {
    html += '<optgroup label="' + grupo + '">'
    grupos[grupo].forEach(u => {
      const sel = u.value === selected ? 'selected' : ''
      html += '<option value="' + u.value + '" ' + sel + '>' + u.label + '</option>'
    })
    html += '</optgroup>'
  }
  return html
}

function renderRecursoOptions(selected) {
  let html = '<option value="">Selecciona recurso...</option>'
  state.recursos.forEach(r => {
    const sel = r.id === selected ? 'selected' : ''
    html += '<option value="' + r.id + '" ' + sel + '>' + escapeHtml(r.nombre) + ' (' + escapeHtml(r.unidad_compra) + ')</option>'
  })
  html += '<option value="__CREATE_RECURSO__" style="color:#1aab99;font-weight:700;">+ Crear nuevo recurso...</option>'
  return html
}

function renderComponenteOptions(selected) {
  let html = '<option value="">Selecciona componente...</option>'
  state.componentes.forEach(c => {
    const sel = c.id === selected ? 'selected' : ''
    html += '<option value="' + c.id + '" ' + sel + '>' + escapeHtml(c.nombre) + ' (rinde ' + fmtNum(c.rendimiento_cantidad) + ' ' + escapeHtml(c.rendimiento_unidad) + ')</option>'
  })
  html += '<option value="__CREATE_COMP__" style="color:#1aab99;font-weight:700;">+ Crear nuevo componente...</option>'
  return html
}

function openCreateModal() {
  state.editingId = null
  state.builderRecursos = []
  state.builderComponentes = []

  $('#modal-title').textContent = 'Nuevo producto'
  $('#modal-save-btn').innerHTML = '<i data-lucide="check"></i><span>Crear producto</span>'

  $('#input-nombre').value = ''
  $('#input-categoria').value = ''
  $('#input-sku').value = ''
  $('#input-precio').value = ''
  $('#input-descripcion').value = ''

  renderBuilder()
  updatePreview()
  $('#modal-backdrop').classList.add('active')
  if (window.lucide) lucide.createIcons()
  setTimeout(() => $('#input-nombre').focus(), 100)
}

async function openEditModal(id) {
  const p = state.productos.find(x => x.id === id)
  if (!p) return

  state.editingId = id
  $('#modal-title').textContent = 'Editar producto'
  $('#modal-save-btn').innerHTML = '<i data-lucide="check"></i><span>Guardar cambios</span>'

  $('#input-nombre').value = p.nombre || ''
  $('#input-categoria').value = p.categoria || ''
  $('#input-sku').value = p.sku || ''
  $('#input-precio').value = p.precio_venta || ''
  $('#input-descripcion').value = p.descripcion || ''

  const detalle = await loadProductoDetalle(id)
  state.builderRecursos = detalle.recursos.map(r => ({
    recurso_id: r.recurso_id,
    cantidad: parseFloat(r.cantidad),
    unidad: r.unidad
  }))
  state.builderComponentes = detalle.componentes.map(c => ({
    componente_id: c.componente_id,
    cantidad: parseFloat(c.cantidad),
    unidad: c.unidad
  }))

  renderBuilder()
  updatePreview()
  $('#modal-backdrop').classList.add('active')
  if (window.lucide) lucide.createIcons()
}

function closeModal() {
  $('#modal-backdrop').classList.remove('active')
  state.editingId = null
  state.builderRecursos = []
  state.builderComponentes = []
}

function renderBuilder() {
  renderBuilderRecursos()
  renderBuilderComponentes()
  updatePreview()
}

function hintTiempo(cantidad, unidad) {
  if (!cantidad || isNaN(cantidad)) return ''
  if (unidad === 'hora') {
    if (cantidad < 1) {
      const mins = Math.round(cantidad * 60)
      return '= ' + mins + ' minuto' + (mins !== 1 ? 's' : '')
    }
    const horas = Math.floor(cantidad)
    const mins = Math.round((cantidad - horas) * 60)
    if (mins === 0) return ''
    return '= ' + horas + 'h ' + mins + 'min'
  }
  if (unidad === 'min' && cantidad >= 60) {
    const h = Math.floor(cantidad / 60)
    const m = Math.round(cantidad % 60)
    return '= ' + h + 'h' + (m > 0 ? ' ' + m + 'min' : '')
  }
  return ''
}

function renderBuilderRecursos() {
  const wrap = $('#builder-recursos')
  if (!wrap) return

  if (state.builderRecursos.length === 0) {
    wrap.innerHTML = '<div class="builder-empty">Aun no agregaste recursos directos. Click en + para agregar uno.</div>'
  } else {
    wrap.innerHTML = state.builderRecursos.map((r, idx) => {
      const recurso = state.recursos.find(x => x.id === r.recurso_id)
      const costoUnit = recurso && recurso.cantidad_compra > 0
        ? recurso.costo_compra / recurso.cantidad_compra : 0
      const costoTotal = costoUnit * (r.cantidad || 0)
      const hint = hintTiempo(r.cantidad, r.unidad)
      return '<div class="builder-row">' +
        '<select class="form-select sm" data-idx="' + idx + '" data-field="recurso_id">' + renderRecursoOptions(r.recurso_id) + '</select>' +
        '<input type="text" class="form-input sm right" inputmode="decimal" step="any" value="' + (r.cantidad || '') + '" placeholder="0" data-idx="' + idx + '" data-field="cantidad" />' +
        '<select class="form-select sm" data-idx="' + idx + '" data-field="unidad">' + renderUnidadesOptions(r.unidad) + '</select>' +
        '<div class="builder-cost">' + fmtMoney(costoTotal) + '</div>' +
        '<button class="icon-btn" data-action="rm-recurso" data-idx="' + idx + '"><i data-lucide="x"></i></button>' +
        (hint ? '<div class="hint-conversion">' + hint + '</div>' : '') +
      '</div>'
    }).join('')
  }

  wrap.querySelectorAll('select, input').forEach(el => {
    el.addEventListener('change', (e) => onBuilderInput(e, 'recurso'))
    if (el.tagName === 'INPUT') el.addEventListener('input', (e) => onBuilderInput(e, 'recurso'))
  })
  wrap.querySelectorAll('[data-action="rm-recurso"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx)
      state.builderRecursos.splice(idx, 1)
      renderBuilder()
    })
  })

  if (window.lucide) lucide.createIcons()
}

function renderBuilderComponentes() {
  const wrap = $('#builder-componentes')
  if (!wrap) return

  if (state.builderComponentes.length === 0) {
    wrap.innerHTML = '<div class="builder-empty">Agrega componentes ya creados (sub-recetas, modulos reutilizables). Ahorra trabajo y mantiene consistencia.</div>'
  } else {
    wrap.innerHTML = state.builderComponentes.map((s, idx) => {
      const comp = state.componentes.find(x => x.id === s.componente_id)
      const costo = comp ? (state.componentesCostos[comp.id] || 0) : 0
      const costoUnitHijo = comp && comp.rendimiento_cantidad > 0 ? costo / comp.rendimiento_cantidad : 0
      const costoTotal = costoUnitHijo * (s.cantidad || 0)
      const hint = hintTiempo(s.cantidad, s.unidad)
      return '<div class="builder-row">' +
        '<select class="form-select sm" data-idx="' + idx + '" data-field="componente_id">' + renderComponenteOptions(s.componente_id) + '</select>' +
        '<input type="text" class="form-input sm right" inputmode="decimal" step="any" value="' + (s.cantidad || '') + '" placeholder="0" data-idx="' + idx + '" data-field="cantidad" />' +
        '<select class="form-select sm" data-idx="' + idx + '" data-field="unidad">' + renderUnidadesOptions(s.unidad) + '</select>' +
        '<div class="builder-cost">' + fmtMoney(costoTotal) + '</div>' +
        '<button class="icon-btn" data-action="rm-comp" data-idx="' + idx + '"><i data-lucide="x"></i></button>' +
        (hint ? '<div class="hint-conversion">' + hint + '</div>' : '') +
      '</div>'
    }).join('')
  }

  wrap.querySelectorAll('select, input').forEach(el => {
    el.addEventListener('change', (e) => onBuilderInput(e, 'componente'))
    if (el.tagName === 'INPUT') el.addEventListener('input', (e) => onBuilderInput(e, 'componente'))
  })
  wrap.querySelectorAll('[data-action="rm-comp"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx)
      state.builderComponentes.splice(idx, 1)
      renderBuilder()
    })
  })

  if (window.lucide) lucide.createIcons()
}

function onBuilderInput(e, tipo) {
  const idx = parseInt(e.target.dataset.idx)
  const field = e.target.dataset.field
  const arr = tipo === 'recurso' ? state.builderRecursos : state.builderComponentes
  if (!arr[idx]) return

  // Detectar "Crear nuevo"
  if (field === 'recurso_id' && e.target.value === '__CREATE_RECURSO__') {
    e.target.value = arr[idx].recurso_id || ''
    openMiniModal('recurso', idx)
    return
  }
  if (field === 'componente_id' && e.target.value === '__CREATE_COMP__') {
    e.target.value = arr[idx].componente_id || ''
    openMiniModal('comp', idx)
    return
  }

  if (field === 'cantidad') {
    arr[idx][field] = parseAmount(e.target.value)
    updatePreview()
    return  // nunca re-renderizar la fila por cantidad
  } else {
    arr[idx][field] = e.target.value
  }

  if (field === 'recurso_id' && tipo === 'recurso') {
    const r = state.recursos.find(x => x.id === e.target.value)
    if (r) arr[idx].unidad = r.unidad_compra
  }
  if (field === 'componente_id' && tipo === 'componente') {
    const c = state.componentes.find(x => x.id === e.target.value)
    if (c) arr[idx].unidad = c.rendimiento_unidad
  }

  renderBuilder()
}

function addBuilderRecurso() {
  state.builderRecursos.push({
    recurso_id: '',
    cantidad: 0,
    unidad: 'unidad'
  })
  renderBuilder()
}

function addBuilderComponente() {
  state.builderComponentes.push({
    componente_id: '',
    cantidad: 0,
    unidad: 'unidad'
  })
  renderBuilder()
}

function calcularCostosLocal() {
  let totalRecursos = 0
  state.builderRecursos.forEach(r => {
    const recurso = state.recursos.find(x => x.id === r.recurso_id)
    if (!recurso) return
    const costoUnit = recurso.cantidad_compra > 0 ? recurso.costo_compra / recurso.cantidad_compra : 0
    totalRecursos += costoUnit * (r.cantidad || 0)
  })

  let totalComponentes = 0
  state.builderComponentes.forEach(s => {
    const comp = state.componentes.find(x => x.id === s.componente_id)
    if (!comp) return
    const costoComp = state.componentesCostos[comp.id] || 0
    const costoUnitHijo = comp.rendimiento_cantidad > 0 ? costoComp / comp.rendimiento_cantidad : 0
    totalComponentes += costoUnitHijo * (s.cantidad || 0)
  })

  // Gastos fijos prorrateados
  let totalGastosFijos = 0
  if (state.gastosFijos) {
    const conceptos = state.gastosFijos.conceptos || {}
    const sumGastos = Object.values(conceptos).reduce((s, v) => s + parseFloat(v || 0), 0)
    const unidades = state.gastosFijos.unidades_estimadas_mes || 1
    totalGastosFijos = sumGastos / unidades
  }

  const costoTotal = totalRecursos + totalComponentes + totalGastosFijos
  const precio = parseAmount($('#input-precio').value)
  const utilidad = precio - costoTotal
  const margenPct = precio > 0 ? (utilidad / precio) * 100 : 0

  return {
    recursos: totalRecursos,
    componentes: totalComponentes,
    gastosFijos: totalGastosFijos,
    costoTotal,
    precio,
    utilidad,
    margenPct
  }
}

function updatePreview() {
  const c = calcularCostosLocal()

  const elR = $('#preview-recursos')
  const elC = $('#preview-componentes')
  const elG = $('#preview-fijos')
  const elT = $('#preview-total')
  const elU = $('#preview-utilidad')
  const elM = $('#preview-margen')

  if (elR) elR.textContent = fmtMoney(c.recursos)
  if (elC) elC.textContent = fmtMoney(c.componentes)
  if (elG) elG.textContent = fmtMoney(c.gastosFijos)
  if (elT) elT.textContent = fmtMoney(c.costoTotal)
  if (elU) {
    elU.textContent = fmtMoney(c.utilidad)
    elU.className = 'preview-utilidad ' + (c.utilidad >= 0 ? 'pos' : 'neg')
  }
  if (elM) {
    elM.textContent = fmtNum(c.margenPct, 1) + '%'
    elM.className = 'margin-pill ' + getMarginClass(c.margenPct)
  }
}

async function saveProducto(e) {
  e.preventDefault()

  const nombre = $('#input-nombre').value.trim()
  if (!nombre) { $('#input-nombre').focus(); return }

  const precio = parseAmount($('#input-precio').value)
  if (precio < 0) {
    $('#input-precio').focus()
    showToast('El precio no puede ser negativo', 'error')
    return
  }

  const recursosValidos = state.builderRecursos.filter(r => r.recurso_id && r.cantidad > 0 && r.unidad)
  const compsValidos = state.builderComponentes.filter(s => s.componente_id && s.cantidad > 0 && s.unidad)

  if (recursosValidos.length === 0 && compsValidos.length === 0) {
    showToast('Agrega al menos un recurso o componente', 'error')
    return
  }

  const payload = {
    nombre,
    categoria: $('#input-categoria').value.trim() || null,
    sku: $('#input-sku').value.trim() || null,
    precio_venta: precio,
    descripcion: $('#input-descripcion').value.trim() || null
  }

  const btn = $('#modal-save-btn')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner"></span><span>Guardando...</span>'

  let result
  if (state.editingId) {
    result = await updateProducto(state.editingId, payload, recursosValidos, compsValidos)
  } else {
    result = await crearProducto(payload, recursosValidos, compsValidos)
  }

  if (!result) {
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="check"></i><span>Reintentar</span>'
    if (window.lucide) lucide.createIcons()
    showToast('Error al guardar', 'error')
    return
  }

  if (state.editingId) {
    const idx = state.productos.findIndex(x => x.id === state.editingId)
    if (idx >= 0) state.productos[idx] = result
    showToast('Producto actualizado', 'success')
  } else {
    state.productos.unshift(result)
    showToast('Producto creado', 'success')
  }

  // Recalcular costos del producto via SQL
  const breakdown = await loadCostoProducto(result.id)
  if (breakdown) state.productosCostos[result.id] = breakdown

  closeModal()
  renderList()
}

async function confirmDelete(id) {
  const p = state.productos.find(x => x.id === id)
  if (!p) return
  if (!confirm('Eliminar "' + p.nombre + '"?')) return

  const ok = await deleteProducto(id)
  if (!ok) {
    showToast('No se pudo eliminar', 'error')
    return
  }
  state.productos = state.productos.filter(x => x.id !== id)
  delete state.productosCostos[id]
  showToast('Producto eliminado', 'success')
  renderList()
}

function showToast(message, type = 'info') {
  const toast = $('#toast')
  if (!toast) return
  toast.className = 'toast ' + type + ' show'
  toast.textContent = message
  setTimeout(() => toast.classList.remove('show'), 2500)
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
window.openCreateModal = openCreateModal
window.closeModal = closeModal
window.addBuilderRecurso = addBuilderRecurso
window.addBuilderComponente = addBuilderComponente
window.closeMiniModal = closeMiniModal
window.saveMiniModal = saveMiniModal

// ── Mini-modal ──────────────────────────────────────────────────────────────

let miniModalType = null
let miniModalIdx = null

function openMiniModal(type, idx) {
  miniModalType = type
  miniModalIdx = idx

  const title = $('#mini-modal-title')
  if (type === 'recurso') {
    title.innerHTML = 'Crear recurso <span class="mini-badge">Rápido</span>'
    $('#mini-fields-recurso').style.display = 'block'
    $('#mini-fields-comp').style.display = 'none'
    $('#mini-input-nombre').value = ''
    $('#mini-input-costo').value = ''
    $('#mini-input-cantidad-compra').value = ''
    $('#mini-input-unidad-compra').innerHTML = renderUnidadesOptions('gr')
  } else {
    title.innerHTML = 'Crear componente <span class="mini-badge">Rápido</span>'
    $('#mini-fields-recurso').style.display = 'none'
    $('#mini-fields-comp').style.display = 'block'
    $('#mini-input-comp-nombre').value = ''
    $('#mini-input-comp-rend-cant').value = '1'
    $('#mini-input-comp-rend-unidad').innerHTML = renderUnidadesOptions('unidad')
  }

  $('#mini-modal-backdrop').classList.add('active')
  if (window.lucide) lucide.createIcons()
  setTimeout(() => {
    const focusEl = type === 'recurso' ? $('#mini-input-nombre') : $('#mini-input-comp-nombre')
    focusEl?.focus()
  }, 80)
}

function closeMiniModal() {
  $('#mini-modal-backdrop').classList.remove('active')
  miniModalType = null
  miniModalIdx = null
}

async function saveMiniModal() {
  const type = miniModalType
  const idx = miniModalIdx
  const btn = $('#mini-modal-save-btn')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner"></span><span>Creando...</span>'

  try {
    if (type === 'recurso') {
      const nombre = $('#mini-input-nombre').value.trim()
      if (!nombre) { $('#mini-input-nombre').focus(); throw new Error('Escribe el nombre del recurso') }
      const costo = parseAmount($('#mini-input-costo').value)
      const cantCompra = parseAmount($('#mini-input-cantidad-compra').value)
      const unidad = $('#mini-input-unidad-compra').value
      if (!unidad) throw new Error('Selecciona una unidad de compra')

      const { data, error } = await supabase.from('recursos').insert({
        organizacion_id: state.org.id,
        nombre,
        costo_compra: costo || 0,
        cantidad_compra: cantCompra > 0 ? cantCompra : 1,
        unidad_compra: unidad,
        activo: true,
        created_by: state.profile?.id
      }).select('*').single()

      if (error) throw error

      state.recursos.push(data)
      state.recursos.sort((a, b) => a.nombre.localeCompare(b.nombre))

      if (idx !== null && state.builderRecursos[idx]) {
        state.builderRecursos[idx].recurso_id = data.id
        state.builderRecursos[idx].unidad = data.unidad_compra
      }

      showToast('Recurso creado y agregado ✓', 'success')

    } else {
      const nombre = $('#mini-input-comp-nombre').value.trim()
      if (!nombre) { $('#mini-input-comp-nombre').focus(); throw new Error('Escribe el nombre del componente') }
      const rendCant = parseAmount($('#mini-input-comp-rend-cant').value)
      if (rendCant <= 0) throw new Error('El rendimiento debe ser mayor a cero')
      const rendUnidad = $('#mini-input-comp-rend-unidad').value
      if (!rendUnidad) throw new Error('Selecciona una unidad de rendimiento')

      const { data, error } = await supabase.from('componentes').insert({
        organizacion_id: state.org.id,
        nombre,
        rendimiento_cantidad: rendCant,
        rendimiento_unidad: rendUnidad,
        minutos_produccion: 0,
        activo: true,
        created_by: state.profile?.id
      }).select('*').single()

      if (error) throw error

      state.componentes.push(data)
      state.componentes.sort((a, b) => a.nombre.localeCompare(b.nombre))
      state.componentesCostos[data.id] = 0

      if (idx !== null && state.builderComponentes[idx]) {
        state.builderComponentes[idx].componente_id = data.id
        state.builderComponentes[idx].unidad = data.rendimiento_unidad
      }

      showToast('Componente creado y agregado ✓', 'success')
    }

    closeMiniModal()
    renderBuilder()

  } catch (err) {
    console.error('[saveMiniModal]', err)
    showToast(err.message || 'Error al crear', 'error')
  } finally {
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="check"></i><span>Crear y agregar</span>'
    if (window.lucide) lucide.createIcons()
  }
}

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

    const [prods, recs, comps, gastos] = await Promise.all([
      loadProductos(),
      loadRecursos(),
      loadComponentes(),
      loadGastosFijos()
    ])

    state.productos = prods
    state.recursos = recs
    state.componentes = comps
    state.gastosFijos = gastos

    await loadTodosLosCostosComponentes()
    await loadTodosLosCostosProductos()

    if (state.recursos.length === 0 && state.componentes.length === 0) {
      $('#alert-no-base').style.display = 'flex'
    }

    $('#search-input').addEventListener('input', (e) => {
      state.filterSearch = e.target.value
      renderList()
    })

    $$('#filter-chips .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('#filter-chips .filter-chip').forEach(c => c.classList.remove('active'))
        chip.classList.add('active')
        state.filterMargin = chip.dataset.filter
        renderList()
      })
    })

    $('#input-precio').addEventListener('input', updatePreview)

    $('#modal-form').addEventListener('submit', saveProducto)
    $('#modal-backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') closeModal()
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#modal-backdrop').classList.contains('active')) {
        closeModal()
      }
    })

    renderList()

    if (window.lucide) lucide.createIcons()
  } catch (err) {
    console.error('[productos] init error:', err)
  }
}

init()
