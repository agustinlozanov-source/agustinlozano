// SCALEx PORTAL - Costeo - Recursos (catalogo)
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

const fmtNum = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '0'
  return new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: n < 1 ? 4 : 2
  }).format(n)
}

let state = {
  org: null,
  profile: null,
  recursos: [],
  filterCategoria: 'todos',
  filterSearch: '',
  editingId: null,
  showInactive: false
}

const UNIDADES_COMUNES = [
  // peso
  { value: 'gr', label: 'gr (gramos)', grupo: 'Peso' },
  { value: 'kg', label: 'kg (kilogramos)', grupo: 'Peso' },
  { value: 'lb', label: 'lb (libras)', grupo: 'Peso' },
  // volumen
  { value: 'ml', label: 'ml (mililitros)', grupo: 'Volumen' },
  { value: 'lt', label: 'lt (litros)', grupo: 'Volumen' },
  // tiempo
  { value: 'hora', label: 'hora', grupo: 'Tiempo' },
  { value: 'min', label: 'minuto', grupo: 'Tiempo' },
  { value: 'dia', label: 'dia', grupo: 'Tiempo' },
  // cantidad
  { value: 'unidad', label: 'unidad', grupo: 'Cantidad' },
  { value: 'pieza', label: 'pieza', grupo: 'Cantidad' },
  { value: 'paquete', label: 'paquete', grupo: 'Cantidad' },
  { value: 'caja', label: 'caja', grupo: 'Cantidad' },
  // longitud
  { value: 'metro', label: 'metro', grupo: 'Longitud' },
  { value: 'cm', label: 'cm (centimetros)', grupo: 'Longitud' },
  // area
  { value: 'm2', label: 'metro cuadrado', grupo: 'Area' }
]

const CATEGORIAS_DEFAULT = [
  'Materias primas',
  'Personal',
  'Servicios externos',
  'Suministros',
  'Otros'
]

async function loadRecursos() {
  const { data, error } = await supabase
    .from('recursos')
    .select('*')
    .eq('organizacion_id', state.org.id)
    .order('categoria', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) {
    console.error('[recursos] load error', error)
    return []
  }
  return data || []
}

async function crearRecurso(payload) {
  const { data, error } = await supabase
    .from('recursos')
    .insert({
      organizacion_id: state.org.id,
      nombre: payload.nombre,
      categoria: payload.categoria || null,
      descripcion: payload.descripcion || null,
      costo_compra: payload.costo_compra,
      unidad_compra: payload.unidad_compra,
      cantidad_compra: payload.cantidad_compra,
      proveedor: payload.proveedor || null,
      notas: payload.notas || null,
      activo: true,
      created_by: state.profile?.id
    })
    .select('*')
    .single()

  if (error) {
    console.error('[recursos] create error', error)
    return null
  }
  return data
}

async function updateRecurso(id, payload) {
  const { data, error } = await supabase
    .from('recursos')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[recursos] update error', error)
    return null
  }
  return data
}

async function deleteRecurso(id) {
  const { error } = await supabase
    .from('recursos')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[recursos] delete error', error)
    return false
  }
  return true
}

function renderHeader() {
  const avatar = initials((state.profile?.nombre || '') + ' ' + (state.profile?.apellido || ''))
  $$('.user-avatar').forEach(el => el.textContent = avatar)
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getCategorias() {
  const cats = new Set()
  state.recursos.forEach(r => { if (r.categoria) cats.add(r.categoria) })
  CATEGORIAS_DEFAULT.forEach(c => cats.add(c))
  return Array.from(cats).sort()
}

function getFilteredRecursos() {
  let list = state.recursos

  if (!state.showInactive) {
    list = list.filter(r => r.activo)
  }

  if (state.filterCategoria !== 'todos') {
    list = list.filter(r => r.categoria === state.filterCategoria)
  }

  if (state.filterSearch) {
    const q = state.filterSearch.toLowerCase()
    list = list.filter(r =>
      (r.nombre || '').toLowerCase().includes(q) ||
      (r.proveedor || '').toLowerCase().includes(q) ||
      (r.descripcion || '').toLowerCase().includes(q)
    )
  }

  return list
}

function renderFilters() {
  const cats = getCategorias()
  const wrap = $('#filter-chips')
  if (!wrap) return

  const counts = {}
  state.recursos.filter(r => state.showInactive || r.activo).forEach(r => {
    const c = r.categoria || 'Sin categoria'
    counts[c] = (counts[c] || 0) + 1
  })

  const total = state.recursos.filter(r => state.showInactive || r.activo).length

  let html = '<button class="filter-chip ' + (state.filterCategoria === 'todos' ? 'active' : '') + '" data-cat="todos">Todos <span class="chip-count">' + total + '</span></button>'

  cats.forEach(cat => {
    const count = counts[cat] || 0
    if (count === 0 && !state.recursos.some(r => r.categoria === cat)) return
    html += '<button class="filter-chip ' + (state.filterCategoria === cat ? 'active' : '') + '" data-cat="' + escapeHtml(cat) + '">' + escapeHtml(cat) + ' <span class="chip-count">' + count + '</span></button>'
  })

  wrap.innerHTML = html

  wrap.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filterCategoria = btn.dataset.cat
      renderFilters()
      renderTable()
    })
  })
}

function renderTable() {
  const wrap = $('#recursos-tbody')
  if (!wrap) return

  const list = getFilteredRecursos()

  if (list.length === 0) {
    if (state.recursos.length === 0) {
      wrap.innerHTML = '<tr><td colspan="6"><div class="empty-state-table"><i data-lucide="package"></i><h3>Aun no tienes recursos</h3><p>Agrega el primero con el boton "Nuevo recurso" arriba.</p></div></td></tr>'
    } else {
      wrap.innerHTML = '<tr><td colspan="6"><div class="empty-state-table"><i data-lucide="search"></i><h3>Sin resultados</h3><p>Prueba con otra busqueda o quita filtros.</p></div></td></tr>'
    }
    if (window.lucide) lucide.createIcons()
    updateCounter()
    return
  }

  wrap.innerHTML = list.map(r => {
    const costoUnit = r.cantidad_compra > 0 ? r.costo_compra / r.cantidad_compra : 0
    const cat = r.categoria || ''
    const catSlug = (cat.toLowerCase().replace(/[^a-z0-9]/g, '-')) || 'sin'

    return '<tr data-id="' + r.id + '" class="' + (r.activo ? '' : 'inactive') + '">' +
      '<td><span class="cat-pill cat-' + catSlug + '">' + escapeHtml(cat || 'Sin categoria') + '</span></td>' +
      '<td>' +
        '<div class="cell-main">' + escapeHtml(r.nombre) + '</div>' +
        (r.proveedor ? '<div class="cell-sub">' + escapeHtml(r.proveedor) + '</div>' : '') +
      '</td>' +
      '<td class="money">' + fmtMoney(r.costo_compra) + '</td>' +
      '<td class="num">' + fmtNum(r.cantidad_compra) + ' ' + escapeHtml(r.unidad_compra) + '</td>' +
      '<td class="money strong">' + fmtMoney(costoUnit) + '<span class="unit-small">/ ' + escapeHtml(r.unidad_compra) + '</span></td>' +
      '<td>' +
        '<div class="row-actions">' +
          '<button class="icon-btn" data-action="edit" data-id="' + r.id + '" title="Editar"><i data-lucide="edit-2"></i></button>' +
          '<button class="icon-btn" data-action="delete" data-id="' + r.id + '" title="Eliminar"><i data-lucide="trash-2"></i></button>' +
        '</div>' +
      '</td>' +
    '</tr>'
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
  const total = state.recursos.filter(r => r.activo).length
  const showing = getFilteredRecursos().length
  const el = $('#count-display')
  if (el) {
    if (state.filterCategoria === 'todos' && !state.filterSearch) {
      el.textContent = total + ' recurso' + (total !== 1 ? 's' : '')
    } else {
      el.textContent = showing + ' de ' + total
    }
  }
}

function renderUnidadesOptions(selected) {
  const grupos = {}
  UNIDADES_COMUNES.forEach(u => {
    if (!grupos[u.grupo]) grupos[u.grupo] = []
    grupos[u.grupo].push(u)
  })

  let html = '<option value="">Selecciona unidad...</option>'
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

function renderCategoriasOptions(selected) {
  const cats = getCategorias()
  let html = '<option value="">Sin categoria</option>'
  cats.forEach(c => {
    const sel = c === selected ? 'selected' : ''
    html += '<option value="' + escapeHtml(c) + '" ' + sel + '>' + escapeHtml(c) + '</option>'
  })
  return html
}

function openCreateModal() {
  state.editingId = null
  $('#modal-title').textContent = 'Nuevo recurso'
  $('#modal-save-btn').innerHTML = '<i data-lucide="check"></i><span>Crear recurso</span>'

  $('#input-nombre').value = ''
  $('#input-categoria').innerHTML = renderCategoriasOptions(null)
  $('#input-categoria-nueva').value = ''
  $('#input-costo').value = ''
  $('#input-cantidad').value = '1'
  $('#input-unidad').innerHTML = renderUnidadesOptions('unidad')
  $('#input-proveedor').value = ''
  $('#input-descripcion').value = ''

  updateCostoUnit()
  $('#modal-backdrop').classList.add('active')
  if (window.lucide) lucide.createIcons()
  setTimeout(() => $('#input-nombre').focus(), 100)
}

function openEditModal(id) {
  const r = state.recursos.find(x => x.id === id)
  if (!r) return

  state.editingId = id
  $('#modal-title').textContent = 'Editar recurso'
  $('#modal-save-btn').innerHTML = '<i data-lucide="check"></i><span>Guardar cambios</span>'

  $('#input-nombre').value = r.nombre || ''
  $('#input-categoria').innerHTML = renderCategoriasOptions(r.categoria)
  $('#input-categoria-nueva').value = ''
  $('#input-costo').value = r.costo_compra || ''
  $('#input-cantidad').value = r.cantidad_compra || 1
  $('#input-unidad').innerHTML = renderUnidadesOptions(r.unidad_compra)
  $('#input-proveedor').value = r.proveedor || ''
  $('#input-descripcion').value = r.descripcion || ''

  updateCostoUnit()
  $('#modal-backdrop').classList.add('active')
  if (window.lucide) lucide.createIcons()
}

function closeModal() {
  $('#modal-backdrop').classList.remove('active')
  state.editingId = null
}

function updateCostoUnit() {
  const costo = parseAmount($('#input-costo').value)
  const cantidad = parseAmount($('#input-cantidad').value) || 1
  const unidad = $('#input-unidad').value || 'unidad'
  const por = costo / cantidad
  $('#preview-costo-unit').textContent = fmtMoney(por) + ' / ' + unidad
}

async function saveRecurso(e) {
  e.preventDefault()

  const nombre = $('#input-nombre').value.trim()
  if (!nombre) {
    $('#input-nombre').focus()
    return
  }

  const costo = parseAmount($('#input-costo').value)
  if (costo <= 0) {
    $('#input-costo').focus()
    showToast('Ingresa un costo de compra valido', 'error')
    return
  }

  const cantidad = parseAmount($('#input-cantidad').value)
  if (cantidad <= 0) {
    $('#input-cantidad').focus()
    showToast('La cantidad debe ser mayor a cero', 'error')
    return
  }

  const unidad = $('#input-unidad').value
  if (!unidad) {
    $('#input-unidad').focus()
    showToast('Selecciona una unidad', 'error')
    return
  }

  // Si llenaron "nueva categoria", esa gana sobre el select
  const catNueva = $('#input-categoria-nueva').value.trim()
  const categoria = catNueva || $('#input-categoria').value || null

  const payload = {
    nombre,
    categoria,
    costo_compra: costo,
    cantidad_compra: cantidad,
    unidad_compra: unidad,
    proveedor: $('#input-proveedor').value.trim() || null,
    descripcion: $('#input-descripcion').value.trim() || null
  }

  const btn = $('#modal-save-btn')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner"></span><span>Guardando...</span>'

  let result
  if (state.editingId) {
    result = await updateRecurso(state.editingId, payload)
  } else {
    result = await crearRecurso(payload)
  }

  btn.disabled = false

  if (!result) {
    btn.innerHTML = '<i data-lucide="check"></i><span>Reintentar</span>'
    if (window.lucide) lucide.createIcons()
    showToast('Error al guardar', 'error')
    return
  }

  // Actualizar state
  if (state.editingId) {
    const idx = state.recursos.findIndex(x => x.id === state.editingId)
    if (idx >= 0) state.recursos[idx] = result
    showToast('Recurso actualizado', 'success')
  } else {
    state.recursos.unshift(result)
    showToast('Recurso creado', 'success')
  }

  closeModal()
  renderFilters()
  renderTable()
}

async function confirmDelete(id) {
  const r = state.recursos.find(x => x.id === id)
  if (!r) return

  if (!confirm('Eliminar "' + r.nombre + '"?\n\nSi este recurso se usa en componentes o productos, NO podras eliminarlo.')) return

  const ok = await deleteRecurso(id)
  if (!ok) {
    showToast('No se pudo eliminar. Posiblemente esta en uso.', 'error')
    return
  }

  state.recursos = state.recursos.filter(x => x.id !== id)
  showToast('Recurso eliminado', 'success')
  renderFilters()
  renderTable()
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

async function init() {
  try {
    const [profile, org] = await Promise.all([getMyProfile(), getMyOrganization()])
    state.profile = profile
    state.org = org

    if (!org) {
      $('.content').innerHTML = '<div class="empty-state-big"><h2>Sin organizacion asignada</h2><p>Contacta a Agustin.</p></div>'
      return
    }

    renderHeader()

    state.recursos = await loadRecursos()

    // Listeners
    $('#search-input').addEventListener('input', (e) => {
      state.filterSearch = e.target.value
      renderTable()
    })

    $('#input-costo').addEventListener('input', updateCostoUnit)
    $('#input-cantidad').addEventListener('input', updateCostoUnit)
    $('#input-unidad').addEventListener('change', updateCostoUnit)

    $('#modal-form').addEventListener('submit', saveRecurso)
    $('#modal-backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') closeModal()
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#modal-backdrop').classList.contains('active')) {
        closeModal()
      }
    })

    renderFilters()
    renderTable()

    if (window.lucide) lucide.createIcons()
  } catch (err) {
    console.error('[recursos] init error:', err)
  }
}

init()
