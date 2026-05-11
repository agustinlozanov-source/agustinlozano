// SCALEx PORTAL - Costeo - Componentes (con recursividad)
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
  return new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: dec
  }).format(n)
}

let state = {
  org: null,
  profile: null,
  componentes: [],
  recursos: [],
  componentesCostos: {},     // map id -> costo total (calculado en server)
  filterSearch: '',
  editingId: null,
  detailId: null,            // si esta abierto el detalle de un componente
  // builder
  builderRecursos: [],       // [{recurso_id, cantidad, unidad}]
  builderComponentes: [],    // [{componente_hijo_id, cantidad, unidad}]
  miniModalType: null,       // 'recurso' | 'comp'
  miniModalIdx: null
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
  { value: 'cm', label: 'cm (centimetros)', grupo: 'Longitud' }
]

async function loadComponentes() {
  const { data, error } = await supabase
    .from('componentes')
    .select('*')
    .eq('organizacion_id', state.org.id)
    .order('nombre', { ascending: true })
  if (error) { console.error('[componentes] load', error); return [] }
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

async function loadComponenteDetalle(id) {
  const [{ data: recursos }, { data: subs }] = await Promise.all([
    supabase.from('componente_recursos')
      .select('*, recursos(*)')
      .eq('componente_id', id)
      .order('orden', { ascending: true }),
    supabase.from('componente_componentes')
      .select('*, componente_hijo:componentes!componente_hijo_id(*)')
      .eq('componente_padre_id', id)
      .order('orden', { ascending: true })
  ])

  return {
    recursos: recursos || [],
    subcomponentes: subs || []
  }
}

async function loadCostoComponente(id) {
  // Llama a la funcion SQL
  const { data, error } = await supabase.rpc('costo_componente', { p_componente_id: id })
  if (error) { console.error('[costo_componente] error', error); return 0 }
  return parseFloat(data || 0)
}

async function loadTodosLosCostos() {
  // Carga el costo de cada componente
  const promises = state.componentes.map(async c => {
    const costo = await loadCostoComponente(c.id)
    return { id: c.id, costo }
  })
  const results = await Promise.all(promises)
  state.componentesCostos = {}
  results.forEach(r => { state.componentesCostos[r.id] = r.costo })
}

async function crearComponente(payload, recursos, subcomponentes) {
  // 1. Crear el componente
  const { data: comp, error: e1 } = await supabase
    .from('componentes')
    .insert({
      organizacion_id: state.org.id,
      nombre: payload.nombre,
      categoria: payload.categoria || null,
      descripcion: payload.descripcion || null,
      rendimiento_cantidad: payload.rendimiento_cantidad,
      rendimiento_unidad: payload.rendimiento_unidad,
      minutos_produccion: payload.minutos_produccion || 0,
      notas: payload.notas || null,
      activo: true,
      created_by: state.profile?.id
    })
    .select('*')
    .single()

  if (e1) { console.error('[crearComponente]', e1); return null }

  // 2. Insertar recursos
  if (recursos.length > 0) {
    const recRows = recursos.map((r, idx) => ({
      componente_id: comp.id,
      recurso_id: r.recurso_id,
      cantidad: r.cantidad,
      unidad: r.unidad,
      orden: idx
    }))
    const { error: e2 } = await supabase.from('componente_recursos').insert(recRows)
    if (e2) console.error('[componente_recursos insert]', e2)
  }

  // 3. Insertar sub-componentes
  if (subcomponentes.length > 0) {
    const subRows = subcomponentes.map((s, idx) => ({
      componente_padre_id: comp.id,
      componente_hijo_id: s.componente_hijo_id,
      cantidad: s.cantidad,
      unidad: s.unidad,
      orden: idx
    }))
    const { error: e3 } = await supabase.from('componente_componentes').insert(subRows)
    if (e3) console.error('[componente_componentes insert]', e3)
  }

  return comp
}

async function updateComponente(id, payload, recursos, subcomponentes) {
  // 1. Actualizar metadata
  const { data: comp, error: e1 } = await supabase
    .from('componentes')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (e1) { console.error('[updateComponente]', e1); return null }

  // 2. Borrar relaciones viejas y reescribir (simple, seguro)
  await supabase.from('componente_recursos').delete().eq('componente_id', id)
  await supabase.from('componente_componentes').delete().eq('componente_padre_id', id)

  if (recursos.length > 0) {
    const recRows = recursos.map((r, idx) => ({
      componente_id: id,
      recurso_id: r.recurso_id,
      cantidad: r.cantidad,
      unidad: r.unidad,
      orden: idx
    }))
    await supabase.from('componente_recursos').insert(recRows)
  }

  if (subcomponentes.length > 0) {
    const subRows = subcomponentes.map((s, idx) => ({
      componente_padre_id: id,
      componente_hijo_id: s.componente_hijo_id,
      cantidad: s.cantidad,
      unidad: s.unidad,
      orden: idx
    }))
    await supabase.from('componente_componentes').insert(subRows)
  }

  return comp
}

async function deleteComponente(id) {
  const { error } = await supabase.from('componentes').delete().eq('id', id)
  if (error) { console.error('[deleteComponente]', error); return false }
  return true
}

function renderHeader() {
  const avatar = initials((state.profile?.nombre || '') + ' ' + (state.profile?.apellido || ''))
  $$('.user-avatar').forEach(el => el.textContent = avatar)
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getFilteredComponentes() {
  let list = state.componentes.filter(c => c.activo)
  if (state.filterSearch) {
    const q = state.filterSearch.toLowerCase()
    list = list.filter(c =>
      (c.nombre || '').toLowerCase().includes(q) ||
      (c.categoria || '').toLowerCase().includes(q) ||
      (c.descripcion || '').toLowerCase().includes(q)
    )
  }
  return list
}

function renderList() {
  const wrap = $('#comp-list')
  if (!wrap) return

  const list = getFilteredComponentes()

  if (list.length === 0) {
    if (state.componentes.length === 0) {
      wrap.innerHTML = '<div class="empty-state"><i data-lucide="layers"></i><h3>Aun no tienes componentes</h3><p>Los componentes son bloques reutilizables (salsa base, plantilla de propuesta, sub-ensamble). Crea el primero con el boton de arriba.</p></div>'
    } else {
      wrap.innerHTML = '<div class="empty-state"><i data-lucide="search"></i><h3>Sin resultados</h3></div>'
    }
    if (window.lucide) lucide.createIcons()
    updateCounter()
    return
  }

  wrap.innerHTML = list.map(c => {
    const costo = state.componentesCostos[c.id] || 0
    const costoUnit = c.rendimiento_cantidad > 0 ? costo / c.rendimiento_cantidad : 0

    return '<div class="comp-card" data-id="' + c.id + '">' +
      '<div class="comp-card-icon"><i data-lucide="layers"></i></div>' +
      '<div class="comp-card-body">' +
        '<div class="comp-card-name">' + escapeHtml(c.nombre) + '</div>' +
        (c.categoria ? '<div class="comp-card-meta">' + escapeHtml(c.categoria) + '</div>' : '') +
        '<div class="comp-card-meta">' +
          '<span class="meta-item"><i data-lucide="package"></i> Rinde ' + fmtNum(c.rendimiento_cantidad) + ' ' + escapeHtml(c.rendimiento_unidad) + '</span>' +
          (c.minutos_produccion ? ' <span class="meta-item"><i data-lucide="clock"></i> ' + c.minutos_produccion + ' min</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="comp-card-cost">' +
        '<div class="comp-cost-total">' + fmtMoney(costo) + '</div>' +
        '<div class="comp-cost-unit">' + fmtMoney(costoUnit) + ' / ' + escapeHtml(c.rendimiento_unidad) + '</div>' +
      '</div>' +
      '<div class="comp-card-actions">' +
        '<button class="icon-btn" data-action="edit" data-id="' + c.id + '" title="Editar"><i data-lucide="edit-2"></i></button>' +
        '<button class="icon-btn" data-action="delete" data-id="' + c.id + '" title="Eliminar"><i data-lucide="trash-2"></i></button>' +
      '</div>' +
    '</div>'
  }).join('')

  wrap.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const action = btn.dataset.action
      const id = btn.dataset.id
      if (action === 'edit') openEditModal(id)
      else if (action === 'delete') confirmDelete(id)
    })
  })

  if (window.lucide) lucide.createIcons()
  updateCounter()
}

function updateCounter() {
  const total = state.componentes.filter(c => c.activo).length
  const showing = getFilteredComponentes().length
  const el = $('#count-display')
  if (el) {
    if (state.filterSearch) el.textContent = showing + ' de ' + total
    else el.textContent = total + ' componente' + (total !== 1 ? 's' : '')
  }
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

function renderComponenteOptions(selected, excludeId) {
  let html = '<option value="">Selecciona componente...</option>'
  state.componentes
    .filter(c => c.activo && c.id !== excludeId)
    .forEach(c => {
      const sel = c.id === selected ? 'selected' : ''
      html += '<option value="' + c.id + '" ' + sel + '>' + escapeHtml(c.nombre) + ' (rinde ' + fmtNum(c.rendimiento_cantidad) + ' ' + escapeHtml(c.rendimiento_unidad) + ')</option>'
    })
  html += '<option value="__CREATE_COMP__" style="color:#1aab99;font-weight:700;">+ Crear nuevo sub-componente...</option>'
  return html
}

function openCreateModal() {
  state.editingId = null
  state.builderRecursos = []
  state.builderComponentes = []

  $('#modal-title').textContent = 'Nuevo componente'
  $('#modal-save-btn').innerHTML = '<i data-lucide="check"></i><span>Crear componente</span>'

  $('#input-nombre').value = ''
  $('#input-categoria').value = ''
  $('#input-rendimiento-cantidad').value = '1'
  $('#input-rendimiento-unidad').innerHTML = renderUnidadesOptions('unidad')
  $('#input-minutos').value = '0'
  $('#input-notas').value = ''

  renderBuilder()
  $('#modal-backdrop').classList.add('active')
  if (window.lucide) lucide.createIcons()
  setTimeout(() => $('#input-nombre').focus(), 100)
}

async function openEditModal(id) {
  const c = state.componentes.find(x => x.id === id)
  if (!c) return

  state.editingId = id
  $('#modal-title').textContent = 'Editar componente'
  $('#modal-save-btn').innerHTML = '<i data-lucide="check"></i><span>Guardar cambios</span>'

  $('#input-nombre').value = c.nombre || ''
  $('#input-categoria').value = c.categoria || ''
  $('#input-rendimiento-cantidad').value = c.rendimiento_cantidad || 1
  $('#input-rendimiento-unidad').innerHTML = renderUnidadesOptions(c.rendimiento_unidad)
  $('#input-minutos').value = c.minutos_produccion || 0
  $('#input-notas').value = c.notas || ''

  // Cargar relaciones existentes
  const detalle = await loadComponenteDetalle(id)
  state.builderRecursos = detalle.recursos.map(r => ({
    recurso_id: r.recurso_id,
    cantidad: parseFloat(r.cantidad),
    unidad: r.unidad
  }))
  state.builderComponentes = detalle.subcomponentes.map(s => ({
    componente_hijo_id: s.componente_hijo_id,
    cantidad: parseFloat(s.cantidad),
    unidad: s.unidad
  }))

  renderBuilder()
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
  renderBuilderTotal()
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
      return '<div class="builder-row">' +
        '<select class="form-select sm" data-idx="' + idx + '" data-field="recurso_id">' + renderRecursoOptions(r.recurso_id) + '</select>' +
        '<input type="text" class="form-input sm right" inputmode="decimal" value="' + (r.cantidad || '') + '" placeholder="0" data-idx="' + idx + '" data-field="cantidad" />' +
        '<select class="form-select sm" data-idx="' + idx + '" data-field="unidad">' + renderUnidadesOptions(r.unidad) + '</select>' +
        '<div class="builder-cost">' + fmtMoney(costoTotal) + '</div>' +
        '<button class="icon-btn" data-action="rm-recurso" data-idx="' + idx + '"><i data-lucide="x"></i></button>' +
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

  // Filtrar para excluir el componente que se esta editando (no auto-referencia)
  if (state.builderComponentes.length === 0) {
    wrap.innerHTML = '<div class="builder-empty">Sub-componentes opcionales. Util si tu componente usa otros bloques ya creados (ej: una salsa que usa un sofrito).</div>'
  } else {
    wrap.innerHTML = state.builderComponentes.map((s, idx) => {
      const compHijo = state.componentes.find(x => x.id === s.componente_hijo_id)
      const costoHijo = compHijo ? (state.componentesCostos[compHijo.id] || 0) : 0
      const costoUnitHijo = compHijo && compHijo.rendimiento_cantidad > 0
        ? costoHijo / compHijo.rendimiento_cantidad : 0
      const costoTotal = costoUnitHijo * (s.cantidad || 0)
      return '<div class="builder-row">' +
        '<select class="form-select sm" data-idx="' + idx + '" data-field="componente_hijo_id">' + renderComponenteOptions(s.componente_hijo_id, state.editingId) + '</select>' +
        '<input type="text" class="form-input sm right" inputmode="decimal" value="' + (s.cantidad || '') + '" placeholder="0" data-idx="' + idx + '" data-field="cantidad" />' +
        '<select class="form-select sm" data-idx="' + idx + '" data-field="unidad">' + renderUnidadesOptions(s.unidad) + '</select>' +
        '<div class="builder-cost">' + fmtMoney(costoTotal) + '</div>' +
        '<button class="icon-btn" data-action="rm-comp" data-idx="' + idx + '"><i data-lucide="x"></i></button>' +
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
  if (field === 'componente_hijo_id' && e.target.value === '__CREATE_COMP__') {
    e.target.value = arr[idx].componente_hijo_id || ''
    openMiniModal('comp', idx)
    return
  }

  if (field === 'cantidad') {
    arr[idx][field] = parseAmount(e.target.value)
  } else {
    arr[idx][field] = e.target.value
  }

  // Si cambia el recurso o componente seleccionado, auto-seleccionar su unidad por defecto
  if (field === 'recurso_id' && tipo === 'recurso') {
    const r = state.recursos.find(x => x.id === e.target.value)
    if (r) arr[idx].unidad = r.unidad_compra
  }
  if (field === 'componente_hijo_id' && tipo === 'componente') {
    const c = state.componentes.find(x => x.id === e.target.value)
    if (c) arr[idx].unidad = c.rendimiento_unidad
  }

  renderBuilder()
}

function openMiniModal(type, idx) {
  state.miniModalType = type
  state.miniModalIdx = idx

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
    title.innerHTML = 'Crear sub-componente <span class="mini-badge">Rápido</span>'
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
  state.miniModalType = null
  state.miniModalIdx = null
}

async function saveMiniModal() {
  const type = state.miniModalType
  const idx = state.miniModalIdx
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
      if (!nombre) { $('#mini-input-comp-nombre').focus(); throw new Error('Escribe el nombre del sub-componente') }
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
        state.builderComponentes[idx].componente_hijo_id = data.id
        state.builderComponentes[idx].unidad = data.rendimiento_unidad
      }

      showToast('Sub-componente creado y agregado ✓', 'success')
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

function addBuilderRecurso() {
  state.builderRecursos.push({
    recurso_id: '',
    cantidad: 0,
    unidad: 'gr'
  })
  renderBuilder()
}

function addBuilderComponente() {
  state.builderComponentes.push({
    componente_hijo_id: '',
    cantidad: 0,
    unidad: 'unidad'
  })
  renderBuilder()
}

function renderBuilderTotal() {
  let total = 0

  state.builderRecursos.forEach(r => {
    const recurso = state.recursos.find(x => x.id === r.recurso_id)
    if (!recurso) return
    const costoUnit = recurso.cantidad_compra > 0
      ? recurso.costo_compra / recurso.cantidad_compra : 0
    total += costoUnit * (r.cantidad || 0)
  })

  state.builderComponentes.forEach(s => {
    const compHijo = state.componentes.find(x => x.id === s.componente_hijo_id)
    if (!compHijo) return
    const costoHijo = state.componentesCostos[compHijo.id] || 0
    const costoUnitHijo = compHijo.rendimiento_cantidad > 0
      ? costoHijo / compHijo.rendimiento_cantidad : 0
    total += costoUnitHijo * (s.cantidad || 0)
  })

  const rendimiento = parseAmount($('#input-rendimiento-cantidad').value) || 1
  const porUnidad = total / rendimiento

  $('#preview-total').textContent = fmtMoney(total)
  $('#preview-por-unidad').textContent = fmtMoney(porUnidad) + ' / ' + ($('#input-rendimiento-unidad').value || 'unidad')
}

async function saveComponente(e) {
  e.preventDefault()

  const nombre = $('#input-nombre').value.trim()
  if (!nombre) {
    $('#input-nombre').focus()
    return
  }

  const rendimientoCant = parseAmount($('#input-rendimiento-cantidad').value)
  if (rendimientoCant <= 0) {
    $('#input-rendimiento-cantidad').focus()
    showToast('El rendimiento debe ser mayor a cero', 'error')
    return
  }

  const rendimientoUnit = $('#input-rendimiento-unidad').value
  if (!rendimientoUnit) {
    showToast('Selecciona unidad de rendimiento', 'error')
    return
  }

  // Validar builder
  const recursosValidos = state.builderRecursos.filter(r => r.recurso_id && r.cantidad > 0 && r.unidad)
  const compsValidos = state.builderComponentes.filter(s => s.componente_hijo_id && s.cantidad > 0 && s.unidad)

  if (recursosValidos.length === 0 && compsValidos.length === 0) {
    showToast('Agrega al menos un recurso o sub-componente', 'error')
    return
  }

  const payload = {
    nombre,
    categoria: $('#input-categoria').value.trim() || null,
    rendimiento_cantidad: rendimientoCant,
    rendimiento_unidad: rendimientoUnit,
    minutos_produccion: parseInt($('#input-minutos').value) || 0,
    notas: $('#input-notas').value.trim() || null
  }

  const btn = $('#modal-save-btn')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner"></span><span>Guardando...</span>'

  let result
  if (state.editingId) {
    result = await updateComponente(state.editingId, payload, recursosValidos, compsValidos)
  } else {
    result = await crearComponente(payload, recursosValidos, compsValidos)
  }

  if (!result) {
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="check"></i><span>Reintentar</span>'
    if (window.lucide) lucide.createIcons()
    showToast('Error al guardar', 'error')
    return
  }

  if (state.editingId) {
    const idx = state.componentes.findIndex(x => x.id === state.editingId)
    if (idx >= 0) state.componentes[idx] = result
    showToast('Componente actualizado', 'success')
  } else {
    state.componentes.unshift(result)
    showToast('Componente creado', 'success')
  }

  // Recalcular costos
  await loadTodosLosCostos()

  closeModal()
  renderList()
}

async function confirmDelete(id) {
  const c = state.componentes.find(x => x.id === id)
  if (!c) return

  if (!confirm('Eliminar "' + c.nombre + '"?\n\nSi este componente se usa en otros componentes o productos, NO podras eliminarlo.')) return

  const ok = await deleteComponente(id)
  if (!ok) {
    showToast('No se pudo eliminar. Posiblemente esta en uso.', 'error')
    return
  }

  state.componentes = state.componentes.filter(x => x.id !== id)
  showToast('Componente eliminado', 'success')
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

    const [comps, recs] = await Promise.all([loadComponentes(), loadRecursos()])
    state.componentes = comps
    state.recursos = recs

    if (state.recursos.length === 0) {
      // No hay recursos -> alerta amigable
      $('#alert-no-recursos').style.display = 'block'
    }

    await loadTodosLosCostos()

    $('#search-input').addEventListener('input', (e) => {
      state.filterSearch = e.target.value
      renderList()
    })

    $('#input-rendimiento-cantidad').addEventListener('input', renderBuilderTotal)
    $('#input-rendimiento-unidad').addEventListener('change', renderBuilderTotal)

    $('#modal-form').addEventListener('submit', saveComponente)
    $('#modal-backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') closeModal()
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if ($('#mini-modal-backdrop').classList.contains('active')) {
          closeMiniModal()
        } else if ($('#modal-backdrop').classList.contains('active')) {
          closeModal()
        }
      }
    })

    renderList()

    if (window.lucide) lucide.createIcons()
  } catch (err) {
    console.error('[componentes] init error:', err)
  }
}

init()
