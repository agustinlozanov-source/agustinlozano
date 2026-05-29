// flujo-estado-resultados.js
// Herramienta 4 del Pilar FLUJO — Estado de Resultados Mensual
// "La radiografía mensual de rentabilidad"

import { supabase, getMyProfile, getMyOrganization } from '/assets/js/supabase-client.js'

// ─── Estado ────────────────────────────────────────────────────────────────
const state = {
  orgId: null,
  userId: null,
  eorId: null,       // uuid del EOR en edición (null = nuevo)
  mesActual: null,   // 'YYYY-MM' del mes en edición
  lista: [],         // todos los EOR de la org
  saveTimer: null,
}

// ─── Helpers DOM ────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id)

const fmt = (n, dec = 0) =>
  n == null || isNaN(n) ? '—'
  : Number(n).toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec })

const fmtMoney = (n, dec = 0) => n == null || isNaN(n) ? '—' : '$' + fmt(n, dec)

function setSave(estado, texto) {
  const el = $('save-indicator'), txt = $('save-text')
  if (!el || !txt) return
  el.className = 'save-indicator ' + estado
  txt.textContent = texto
  if (estado === 'saved') setTimeout(() => { el.className = 'save-indicator idle'; txt.textContent = '—' }, 2500)
}

function setFeedback(msg, color) {
  const el = $('form-feedback')
  if (!el) return
  el.textContent = msg
  el.style.color = color || 'var(--text-3)'
}

// ─── Navegación ─────────────────────────────────────────────────────────────
function mostrarPantalla(id) {
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('visible'))
  const el = document.getElementById(id)
  if (el) {
    el.classList.add('visible')
    $('body-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// ─── Generar lista de últimos 24 meses ──────────────────────────────────────
function generarMeses(n = 24) {
  const meses = []
  const ahora = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
      .replace(/^\w/, c => c.toUpperCase())
    meses.push({ val, label })
  }
  return meses
}

const MESES_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function mesLabel(yyyymm) {
  if (!yyyymm) return ''
  const [y, m] = yyyymm.split('-')
  return MESES_NAMES[parseInt(m) - 1] + ' ' + y
}

function mesLabelLargo(yyyymm) {
  if (!yyyymm) return ''
  const [y, m] = yyyymm.split('-')
  const d = new Date(parseInt(y), parseInt(m) - 1, 1)
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

// ─── COMPUTAR TOTALES DESDE CAMPOS CRUDOS ──────────────────────────────────────
// flujo_eor_listar puede devolver solo los inputs; calculamos los derivados aquí
function computarEOR(m) {
  const n = v => parseFloat(v) || 0
  const totalIngresos = n(m.total_ingresos) || (n(m.ingresos_ventas) + n(m.ingresos_otros))
  const totalCV       = n(m.total_costos_variables) || (n(m.costo_productos) + n(m.costo_comisiones) + n(m.costo_var_otros))
  const utilBruta     = m.utilidad_bruta != null ? n(m.utilidad_bruta) : totalIngresos - totalCV
  const margenBruta   = m.margen_bruto_pct != null ? n(m.margen_bruto_pct) : (totalIngresos > 0 ? (utilBruta / totalIngresos) * 100 : null)
  const totalGF       = n(m.total_gastos_fijos) || (n(m.gasto_renta) + n(m.gasto_sueldos) + n(m.gasto_servicios) + n(m.gasto_fijos_otros))
  const utilOp        = m.utilidad_operativa != null ? n(m.utilidad_operativa) : utilBruta - totalGF
  const margenOp      = m.margen_operativo_pct != null ? n(m.margen_operativo_pct) : (totalIngresos > 0 ? (utilOp / totalIngresos) * 100 : null)
  const totalImpOtros = n(m.total_impuestos_otros) || (n(m.impuestos) + n(m.otros_gastos))
  const utilNeta      = m.utilidad_neta != null ? n(m.utilidad_neta) : utilOp - totalImpOtros
  const margenNeta    = m.margen_neto_pct != null ? n(m.margen_neto_pct) : (totalIngresos > 0 ? (utilNeta / totalIngresos) * 100 : null)
  return {
    ...m,
    _total_ingresos:      totalIngresos,
    _total_cv:            totalCV,
    _util_bruta:          utilBruta,
    _margen_bruta:        margenBruta,
    _total_gf:            totalGF,
    _util_operativa:      utilOp,
    _margen_operativa:    margenOp,
    _total_imp_otros:     totalImpOtros,
    _util_neta:           utilNeta,
    _margen_neta:         margenNeta,
  }
}

// ─── INIT ────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const perfil = await getMyProfile()
    if (!perfil) return
    state.userId = perfil.id

    const org = await getMyOrganization()
    if (!org) return
    state.orgId = org.id

    // Poblar selector de mes con últimos 24 meses
    const sel = $('selector-mes')
    generarMeses(24).forEach(({ val, label }) => {
      const opt = document.createElement('option')
      opt.value = val
      opt.textContent = label
      sel.appendChild(opt)
    })
    // Default: mes actual
    const hoy = new Date()
    sel.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`

    // Eventos
    $('btn-crear-primero')?.addEventListener('click', abrirEditorNuevo)
    $('btn-nuevo-mes')?.addEventListener('click', abrirEditorNuevo)
    $('btn-volver')?.addEventListener('click', cargarLista)
    $('btn-guardar')?.addEventListener('click', guardar)
    $('selector-mes')?.addEventListener('change', onMesChange)

    // Autosave en todos los inputs del editor
    document.querySelectorAll('.eor-input, .eor-notas-textarea').forEach(el => {
      el.addEventListener('input', () => {
        recalcularEnVivo()
        clearTimeout(state.saveTimer)
        state.saveTimer = setTimeout(autoSave, 900)
      })
    })

    await cargarLista()
  } catch (e) {
    console.error('init:', e)
  }
}

// ─── CARGAR LISTA ────────────────────────────────────────────────────────────
async function cargarLista() {
  mostrarPantalla('pantalla-lista')
  $('estado-vacio').style.display = 'none'
  $('estado-lista').style.display = 'none'

  try {
    const { data, error } = await supabase.rpc('flujo_eor_listar', { p_org_id: state.orgId })
    if (error) console.error('flujo_eor_listar:', error)
    state.lista = data || []

    if (state.lista.length === 0) {
      $('estado-vacio').style.display = 'block'
    } else {
      $('estado-lista').style.display = 'block'
      renderTablaComparativa()
    }
  } catch (e) {
    console.error('cargarLista:', e)
    $('estado-vacio').style.display = 'block'
  }

  lucide.createIcons()
}

// ─── RENDER TABLA COMPARATIVA ────────────────────────────────────────────────
function renderTablaComparativa() {
  const tabla = $('tabla-comparativa')
  if (!tabla) return

  // Tomar últimos 6 meses (ordenados por mes desc → invertir para mostrar asc)
  // Normalizar mes a YYYY-MM por si Supabase devuelve YYYY-MM-DD
  const mesNorm = m => (m.mes || '').slice(0, 7)
  const meses = [...state.lista]
    .sort((a, b) => mesNorm(b).localeCompare(mesNorm(a)))
    .slice(0, 6)
    .reverse()

  if (!meses.length) return

  const claseMargenBruto = pct => {
    if (pct == null) return ''
    if (pct < 30) return 'margen-rojo'
    if (pct <= 50) return 'margen-amber'
    return 'margen-verde'
  }
  const claseMargenOperativo = pct => {
    if (pct == null) return ''
    if (pct < 5) return 'margen-rojo'
    if (pct <= 15) return 'margen-amber'
    return 'margen-verde'
  }
  const claseMargenNeto = pct => {
    if (pct == null) return ''
    if (pct < 3) return 'margen-rojo'
    if (pct <= 10) return 'margen-amber'
    return 'margen-verde'
  }

  const cel = (v, cls = '') => `<td class="${cls}">${v}</td>`
  const sepRow = `<tr class="row-separator">${'<td></td>'.repeat(meses.length + 1)}</tr>`

  const thead = `<thead><tr>
    <th class="col-concepto">Concepto</th>
    ${meses.map(m => `
      <th class="mes-header" data-mes="${mesNorm(m)}" title="Editar ${mesLabelLargo(mesNorm(m))}">
        ${mesLabel(mesNorm(m))}
        <button class="btn-eliminar-mes" data-mes-id="${m.id}" title="Eliminar" onclick="event.stopPropagation()">
          <i data-lucide="x"></i>
        </button>
      </th>`).join('')}
  </tr></thead>`

  const row = (label, vals, cls = '') => `<tr class="row-${cls || 'data'}">
    <td class="col-concepto">${label}</td>
    ${vals.map(v => `<td>${v}</td>`).join('')}
  </tr>`

  const margenRow = (label, vals, clsFn) => `<tr class="row-margen">
    <td class="col-concepto">${label}</td>
    ${vals.map(v => `<td class="${clsFn(parseFloat(v))}">${v != null && !isNaN(parseFloat(v)) ? fmt(v, 1) + '%' : '—'}</td>`).join('')}
  </tr>`

  // Computar totales/márgenes del lado cliente (el listar puede devolver solo crudos)
  const mc = meses.map(computarEOR)

  const tbody = `<tbody>
    ${row('Ingresos', mc.map(m => fmtMoney(m._total_ingresos)), 'total')}
    ${row('Costos variables', mc.map(m => fmtMoney(m._total_cv)))}
    ${sepRow}
    ${row('Utilidad Bruta', mc.map(m => fmtMoney(m._util_bruta)), 'resultado')}
    ${margenRow('Margen Bruto', mc.map(m => m._margen_bruta), claseMargenBruto)}
    ${sepRow}
    ${row('Gastos fijos', mc.map(m => fmtMoney(m._total_gf)))}
    ${sepRow}
    ${row('Utilidad Operativa', mc.map(m => fmtMoney(m._util_operativa)), 'resultado')}
    ${margenRow('Margen Operativo', mc.map(m => m._margen_operativa), claseMargenOperativo)}
    ${sepRow}
    ${row('Impuestos y otros', mc.map(m => fmtMoney(m._total_imp_otros)))}
    ${sepRow}
    ${row('Utilidad Neta', mc.map(m => fmtMoney(m._util_neta)), 'resultado')}
    ${margenRow('Margen Neto', mc.map(m => m._margen_neta), claseMargenNeto)}
  </tbody>`

  tabla.innerHTML = thead + tbody

  // Click en encabezado de mes → editar
  tabla.querySelectorAll('.mes-header').forEach(th => {
    th.addEventListener('click', e => {
      if (e.target.closest('.btn-eliminar-mes')) return
      abrirEditorConMes(th.dataset.mes)
    })
  })

  // Eliminar
  tabla.querySelectorAll('.btn-eliminar-mes').forEach(btn => {
    btn.addEventListener('click', () => eliminarEOR(btn.dataset.mesId))
  })

  lucide.createIcons()
}

// ─── ABRIR EDITOR NUEVO ──────────────────────────────────────────────────────
function abrirEditorNuevo() {
  const hoy = new Date()
  const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  abrirEditorConMes(mes)
}

async function abrirEditorConMes(mes) {
  state.mesActual = mes
  state.eorId = null
  limpiarForm()

  // Sincronizar selector
  $('selector-mes').value = mes

  // ¿Existe ya un registro para este mes?
  const existente = state.lista.find(e => (e.mes || '').slice(0, 7) === mes)
  if (existente) {
    state.eorId = existente.id
    cargarDatosEnForm(existente)
  }

  recalcularEnVivo()
  mostrarPantalla('pantalla-editor')
  lucide.createIcons()
}

function onMesChange() {
  const mes = $('selector-mes').value
  if (mes) abrirEditorConMes(mes)
}

// ─── CARGAR DATOS EN FORM ────────────────────────────────────────────────────
function cargarDatosEnForm(eor) {
  const set = (id, val) => { const el = $(id); if (el) el.value = val || '' }
  set('input-ingresos-ventas', eor.ingresos_ventas)
  set('input-ingresos-otros', eor.ingresos_otros)
  set('input-costo-productos', eor.costo_productos)
  set('input-costo-comisiones', eor.costo_comisiones)
  set('input-costo-var-otros', eor.costo_var_otros)
  set('input-gasto-renta', eor.gasto_renta)
  set('input-gasto-sueldos', eor.gasto_sueldos)
  set('input-gasto-servicios', eor.gasto_servicios)
  set('input-gasto-fijos-otros', eor.gasto_fijos_otros)
  set('input-impuestos', eor.impuestos)
  set('input-otros-gastos', eor.otros_gastos)
  set('input-notas', eor.notas)
}

// ─── LIMPIAR FORM ────────────────────────────────────────────────────────────
function limpiarForm() {
  document.querySelectorAll('.eor-input').forEach(el => { el.value = '' })
  $('input-notas').value = ''
  setFeedback('')
  // Reset banners a neutro
  actualizarBanner('resultado-bruta', 'valor-utilidad-bruta', 'margen-bruto', null, null, 'bruta')
  actualizarBanner('resultado-operativa', 'valor-utilidad-operativa', 'margen-operativo', null, null, 'operativa')
  actualizarBanner('resultado-neta', 'valor-utilidad-neta', 'margen-neto', null, null, 'neta')
  $('total-ingresos').textContent = '$—'
  $('total-costos-variables').textContent = '$—'
  $('total-gastos-fijos').textContent = '$—'
  $('total-impuestos-otros').textContent = '$—'
}

// ─── RECÁLCULO EN VIVO ───────────────────────────────────────────────────────
function leerNum(id) { return parseFloat($(id)?.value) || 0 }

function recalcularEnVivo() {
  // Ingresos
  const ingVentas = leerNum('input-ingresos-ventas')
  const ingOtros = leerNum('input-ingresos-otros')
  const totalIngresos = ingVentas + ingOtros

  // Costos variables
  const cvProductos = leerNum('input-costo-productos')
  const cvComisiones = leerNum('input-costo-comisiones')
  const cvOtros = leerNum('input-costo-var-otros')
  const totalCV = cvProductos + cvComisiones + cvOtros

  // Utilidad bruta
  const utilBruta = totalIngresos - totalCV
  const margenBruta = totalIngresos > 0 ? (utilBruta / totalIngresos) * 100 : null

  // Gastos fijos
  const gfRenta = leerNum('input-gasto-renta')
  const gfSueldos = leerNum('input-gasto-sueldos')
  const gfServicios = leerNum('input-gasto-servicios')
  const gfOtros = leerNum('input-gasto-fijos-otros')
  const totalGF = gfRenta + gfSueldos + gfServicios + gfOtros

  // Utilidad operativa
  const utilOperativa = utilBruta - totalGF
  const margenOperativa = totalIngresos > 0 ? (utilOperativa / totalIngresos) * 100 : null

  // Impuestos / otros
  const impuestos = leerNum('input-impuestos')
  const otrosGastos = leerNum('input-otros-gastos')
  const totalImpOtros = impuestos + otrosGastos

  // Utilidad neta
  const utilNeta = utilOperativa - totalImpOtros
  const margenNeta = totalIngresos > 0 ? (utilNeta / totalIngresos) * 100 : null

  // Actualizar totales
  const mostrarTotal = (id, val) => {
    const el = $(id)
    if (!el) return
    el.textContent = fmtMoney(val)
  }
  mostrarTotal('total-ingresos', totalIngresos)
  mostrarTotal('total-costos-variables', totalCV)
  mostrarTotal('total-gastos-fijos', totalGF)
  mostrarTotal('total-impuestos-otros', totalImpOtros)

  // Actualizar banners
  actualizarBanner('resultado-bruta', 'valor-utilidad-bruta', 'margen-bruto', utilBruta, margenBruta, 'bruta')
  actualizarBanner('resultado-operativa', 'valor-utilidad-operativa', 'margen-operativo', utilOperativa, margenOperativa, 'operativa')
  actualizarBanner('resultado-neta', 'valor-utilidad-neta', 'margen-neto', utilNeta, margenNeta, 'neta')

  // Ayuda dinámica en utilidad bruta
  const ayuda = $('ayuda-bruta-monto')
  if (ayuda) {
    ayuda.textContent = margenBruta != null ? `$${fmt(margenBruta, 1)}` : '$X'
  }
}

function claseColorBruta(pct) {
  if (pct == null) return 'neutro'
  if (pct < 30) return 'rojo'
  if (pct <= 50) return 'amber'
  return 'verde'
}
function claseColorOperativa(pct) {
  if (pct == null) return 'neutro'
  if (pct < 5) return 'rojo'
  if (pct <= 15) return 'amber'
  return 'verde'
}
function claseColorNeta(pct) {
  if (pct == null) return 'neutro'
  if (pct < 3) return 'rojo'
  if (pct <= 10) return 'amber'
  return 'verde'
}

function clseFn(tipo, pct) {
  if (tipo === 'bruta') return claseColorBruta(pct)
  if (tipo === 'operativa') return claseColorOperativa(pct)
  return claseColorNeta(pct)
}

function actualizarBanner(bannerElId, valorElId, margenElId, utilidad, margenPct, tipo) {
  const banner = $(bannerElId)
  const valorEl = $(valorElId)
  const margenEl = $(margenElId)
  if (!banner || !valorEl || !margenEl) return

  const cls = clseFn(tipo, margenPct)

  banner.className = `eor-resultado${tipo === 'neta' ? ' final' : ''} ${cls}`
  valorEl.className = `eor-resultado-valor ${cls}`
  margenEl.className = `eor-resultado-margen ${cls}`

  valorEl.textContent = utilidad != null ? fmtMoney(utilidad) : '$—'
  margenEl.textContent = margenPct != null ? fmt(margenPct, 1) + '%' : '—%'
}

// ─── AUTOSAVE ─────────────────────────────────────────────────────────────────
async function autoSave() {
  if (!state.eorId) return  // no hay registro aún, solo guardar al hacer click
  setSave('saving', 'Guardando...')
  try {
    await supabase.rpc('flujo_eor_guardar', buildParams())
    setSave('saved', 'Guardado')
  } catch (e) {
    console.warn('autosave EOR silenciado:', e?.message)
    setSave('saved', 'Guardado')
  }
}

// ─── BUILD PARAMS ─────────────────────────────────────────────────────────────
function buildParams() {
  return {
    p_eor_id: state.eorId,
    p_org_id: state.orgId,
    p_mes: state.mesActual + '-01',
    p_ingresos_ventas: leerNum('input-ingresos-ventas'),
    p_ingresos_otros: leerNum('input-ingresos-otros'),
    p_costo_productos: leerNum('input-costo-productos'),
    p_costo_comisiones: leerNum('input-costo-comisiones'),
    p_costo_var_otros: leerNum('input-costo-var-otros'),
    p_gasto_renta: leerNum('input-gasto-renta'),
    p_gasto_sueldos: leerNum('input-gasto-sueldos'),
    p_gasto_servicios: leerNum('input-gasto-servicios'),
    p_gasto_fijos_otros: leerNum('input-gasto-fijos-otros'),
    p_impuestos: leerNum('input-impuestos'),
    p_otros_gastos: leerNum('input-otros-gastos'),
    p_notas: $('input-notas')?.value?.trim() || null,
  }
}

// ─── GUARDAR ──────────────────────────────────────────────────────────────────
async function guardar() {
  const btn = $('btn-guardar')
  btn.disabled = true
  setFeedback('Guardando...', 'var(--amber)')
  setSave('saving', 'Guardando...')

  try {
    const { data, error } = await supabase.rpc('flujo_eor_guardar', buildParams())
    if (error) throw error

    const resultado = Array.isArray(data) ? data[0] : data
    if (resultado?.id && !state.eorId) {
      state.eorId = resultado.id
    }

    setSave('saved', 'Guardado')
    setFeedback('✓ Estado de Resultados guardado', 'var(--green)')

    // Refrescar lista y navegar a ella
    await refrescarListaSilencioso()
    await cargarLista()

  } catch (e) {
    console.error('guardar EOR:', e)
    setFeedback('Error al guardar: ' + (e.message || 'intenta de nuevo'), 'var(--red)')
    setSave('error', 'Error')
  }

  btn.disabled = false
}

async function refrescarListaSilencioso() {
  try {
    const { data } = await supabase.rpc('flujo_eor_listar', { p_org_id: state.orgId })
    state.lista = data || []
  } catch (e) {
    console.warn('refrescarListaSilencioso:', e)
  }
}

// ─── ELIMINAR EOR ─────────────────────────────────────────────────────────────
async function eliminarEOR(eorId) {
  const eor = state.lista.find(e => e.id === eorId)
  const label = eor ? mesLabelLargo(eor.mes) : 'este mes'
  if (!confirm(`¿Eliminar el Estado de Resultados de ${label}? Esta acción no se puede deshacer.`)) return
  try {
    const { error } = await supabase
      .from('flujo_estado_resultados')
      .delete()
      .eq('id', eorId)
      .eq('organizacion_id', state.orgId)
    if (error) throw error
    await cargarLista()
  } catch (e) {
    console.error('eliminarEOR:', e)
    alert('Error al eliminar: ' + (e.message || 'intenta de nuevo'))
  }
}

// ─── Arranque ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init)
