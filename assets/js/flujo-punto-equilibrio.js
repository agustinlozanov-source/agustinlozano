// flujo-punto-equilibrio.js
// Herramienta 6 del Pilar FLUJO — Punto de Equilibrio
// ¿Cuánto necesito vender para no perder?

import { supabase, getMyProfile, getMyOrganization } from '/assets/js/supabase-client.js'

// ─── Estado ────────────────────────────────────────────────────────────────
const state = {
  orgId: null,
  userId: null,
  peId: null,          // uuid del PE en edición (null = nuevo)
  lista: [],           // todos los PEs de la org
  productos: [],       // productos del Costeo (de sugerencias)
  gfm: null,           // gastos fijos mensuales sugeridos del diagnóstico
  precioBloqueado: false,
  costoBloqueado: false,
  saveTimer: null,
  ultimoResultado: null,
}

// ─── Helpers DOM ───────────────────────────────────────────────────────────
const $ = id => document.getElementById(id)
const fmt = n => n == null ? '—' : Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const fmtMoney = n => n == null ? '—' : '$' + fmt(n)

function setSave(estado, texto) {
  const el = $('save-indicator')
  const txt = $('save-text')
  if (!el || !txt) return
  el.className = 'save-indicator ' + estado
  txt.textContent = texto
  if (estado === 'saved') {
    setTimeout(() => { el.className = 'save-indicator idle'; txt.textContent = '—' }, 2500)
  }
}

function setFeedback(msg, color) {
  const el = $('form-feedback')
  if (!el) return
  el.textContent = msg
  el.style.color = color || 'var(--text-3)'
}

function tiempoRelativo(fecha) {
  if (!fecha) return ''
  const d = new Date(fecha)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} días`
}

function claseMargen(pct) {
  if (pct == null || isNaN(pct)) return ''
  if (pct <= 10) return 'rojo'
  if (pct <= 25) return 'amber'
  return 'verde'
}

// ─── Navegación de pantallas ────────────────────────────────────────────────
function mostrarPantalla(id) {
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('visible'))
  const el = document.getElementById(id)
  if (el) {
    el.classList.add('visible')
    $('body-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// ─── INIT ───────────────────────────────────────────────────────────────────
async function init() {
  try {
    const perfil = await getMyProfile()
    if (!perfil) return
    state.userId = perfil.id

    const org = await getMyOrganization()
    if (!org) return
    state.orgId = org.id

    // Eventos globales
    $('btn-crear-primero')?.addEventListener('click', abrirEditorNuevo)
    $('btn-nuevo-calculo')?.addEventListener('click', abrirEditorNuevo)
    $('btn-volver')?.addEventListener('click', () => {
      state.peId = null
      cargarLista()
    })
    $('btn-calcular')?.addEventListener('click', calcularYGuardar)
    $('slider-margen')?.addEventListener('input', e => {
      $('slider-valor-display').textContent = e.target.value + '%'
    })
    $('selector-producto')?.addEventListener('change', onProductoChange)
    $('input-precio-venta')?.addEventListener('input', actualizarMargenEnVivo)
    $('input-costo-variable')?.addEventListener('input', actualizarMargenEnVivo)
    $('btn-desbloquear-precio')?.addEventListener('click', () => desbloquearCampo('precio'))
    $('btn-desbloquear-costo')?.addEventListener('click', () => desbloquearCampo('costo'))
    $('btn-usar-gfm')?.addEventListener('click', usarGFM)

    // Autosave con debounce en campos del form
    const camposAutoSave = ['input-nombre', 'input-costos-fijos', 'input-precio-venta', 'input-costo-variable', 'input-notas']
    camposAutoSave.forEach(id => {
      $(id)?.addEventListener('input', () => {
        clearTimeout(state.saveTimer)
        state.saveTimer = setTimeout(autoSave, 900)
      })
    })

    await cargarLista()
  } catch (e) {
    console.error('init error:', e)
  }
}

// ─── CARGAR LISTA ───────────────────────────────────────────────────────────
async function cargarLista() {
  mostrarPantalla('pantalla-lista')
  $('estado-vacio').style.display = 'none'
  $('estado-lista').style.display = 'none'

  try {
    const { data, error } = await supabase.rpc('flujo_pe_listar', { p_org_id: state.orgId })
    if (error) { console.error('flujo_pe_listar:', error); }
    state.lista = data || []

    if (state.lista.length === 0) {
      $('estado-vacio').style.display = 'block'
    } else {
      $('estado-lista').style.display = 'block'
      renderLista()
    }
  } catch (e) {
    console.error('cargarLista:', e)
    $('estado-vacio').style.display = 'block'
  }

  lucide.createIcons()
}

function renderLista() {
  const grid = $('pe-grid')
  if (!grid) return
  grid.innerHTML = state.lista.map(pe => renderPECard(pe)).join('')

  grid.querySelectorAll('[data-btn-editar]').forEach(btn => {
    btn.addEventListener('click', () => abrirEditorEditar(btn.dataset.btnEditar))
  })
  grid.querySelectorAll('[data-btn-eliminar]').forEach(btn => {
    btn.addEventListener('click', () => eliminarPE(btn.dataset.btnEliminar))
  })
  lucide.createIcons()
}

function renderPECard(pe) {
  const margenPct = pe.margen_unitario_pct != null ? Number(pe.margen_unitario_pct) : null
  const esNegativo = margenPct != null && margenPct <= 0
  const clasePeligro = esNegativo ? ' peligro' : ''
  const claseM = claseMargen(margenPct)

  const alertaHtml = esNegativo ? `
    <div class="alerta-peligro">
      <i data-lucide="alert-triangle"></i>
      <span>⚠️ Este producto pierde dinero con cada venta. No hay punto de equilibrio posible — el precio es menor al costo.</span>
    </div>` : ''

  const resultadosHtml = !esNegativo ? `
    <div class="pe-card-body">
      <div class="pe-resultado-bloque">
        <div class="pe-resultado-label">Para no perder</div>
        <div class="pe-resultado-valor">${fmt(pe.pe_unidades)} uds</div>
        <div class="pe-resultado-sub">${fmtMoney(pe.pe_pesos)} en ventas</div>
      </div>
      <div class="pe-resultado-bloque">
        <div class="pe-resultado-label">Con margen ${pe.margen_seguridad_pct || 15}%</div>
        <div class="pe-resultado-valor">${fmt(pe.pe_seguro_unidades)} uds</div>
        <div class="pe-resultado-sub">${fmtMoney(pe.pe_seguro_pesos)}</div>
      </div>
    </div>` : ''

  return `
    <div class="pe-card${clasePeligro}">
      <div class="pe-card-header">
        <div class="pe-card-nombre">
          <div class="pe-card-icon"><i data-lucide="scale"></i></div>
          <div>
            <div class="pe-card-nombre-text">${pe.nombre || 'Sin nombre'}</div>
            ${pe.producto_nombre ? `<div class="pe-card-producto">Producto: ${pe.producto_nombre}</div>` : ''}
          </div>
        </div>
        <div class="pe-card-actions">
          <button class="btn-card-action" data-btn-editar="${pe.id}" title="Editar"><i data-lucide="pencil"></i></button>
          <button class="btn-card-action danger" data-btn-eliminar="${pe.id}" title="Eliminar"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
      ${resultadosHtml}
      ${alertaHtml}
      <div class="pe-card-footer">
        ${margenPct != null ? `
          <span class="pe-margen-badge ${claseM}">
            <i data-lucide="percent" style="width:11px;height:11px"></i>
            Margen ${fmt(margenPct)}%
          </span>` : '<span></span>'}
        <span class="pe-fecha">${tiempoRelativo(pe.actualizado_en || pe.creado_en)}</span>
      </div>
    </div>`
}

// ─── CARGAR SUGERENCIAS ──────────────────────────────────────────────────────
async function cargarSugerencias() {
  try {
    const { data, error } = await supabase.rpc('flujo_pe_sugerencias', { p_org_id: state.orgId })
    if (error) { console.warn('flujo_pe_sugerencias:', error); return }

    const resp = data?.[0] || data || {}
    state.gfm = resp.gfm_sugerido || null
    state.productos = resp.productos || []

    // GFM pill
    if (state.gfm && state.gfm > 0) {
      $('gfm-pill-wrap').style.display = 'block'
      $('gfm-pill-label').textContent = `Usar ${fmtMoney(state.gfm)} del Diagnóstico`
    } else {
      $('gfm-pill-wrap').style.display = 'none'
    }

    // Poblar selector de productos
    const sel = $('selector-producto')
    if (!sel) return
    // Limpiar opciones excepto la primera
    while (sel.options.length > 1) sel.remove(1)
    state.productos.forEach(p => {
      const opt = document.createElement('option')
      opt.value = p.id
      opt.textContent = `${p.nombre} — $${fmt(p.precio_venta)}`
      opt.dataset.precio = p.precio_venta
      opt.dataset.costo = p.costo_variable
      sel.appendChild(opt)
    })
  } catch (e) {
    console.warn('cargarSugerencias:', e)
  }
}

// ─── ABRIR EDITOR NUEVO ──────────────────────────────────────────────────────
async function abrirEditorNuevo() {
  state.peId = null
  state.precioBloqueado = false
  state.costoBloqueado = false
  limpiarForm()
  $('editor-titulo').textContent = 'Nuevo cálculo'
  mostrarPantalla('pantalla-editor')
  $('seccion-resultado').style.display = 'none'
  await cargarSugerencias()
  lucide.createIcons()
}

// ─── ABRIR EDITOR EDITAR ─────────────────────────────────────────────────────
async function abrirEditorEditar(peId) {
  const pe = state.lista.find(p => p.id === peId)
  if (!pe) return

  state.peId = peId
  state.precioBloqueado = false
  state.costoBloqueado = false
  limpiarForm()
  $('editor-titulo').textContent = 'Editar cálculo'
  mostrarPantalla('pantalla-editor')

  await cargarSugerencias()

  // Poblar form con datos del PE
  $('input-nombre').value = pe.nombre || ''
  $('input-costos-fijos').value = pe.costos_fijos || ''
  $('input-precio-venta').value = pe.precio_venta || ''
  $('input-costo-variable').value = pe.costo_variable || ''
  $('input-notas').value = pe.notas || ''
  $('slider-margen').value = pe.margen_seguridad_pct || 15
  $('slider-valor-display').textContent = (pe.margen_seguridad_pct || 15) + '%'

  // Seleccionar producto si tiene
  if (pe.producto_id) {
    const sel = $('selector-producto')
    sel.value = pe.producto_id
    // Si el producto está en el selector, bloquear campos
    if (sel.value === pe.producto_id) {
      bloquearCampoDesde('precio', pe.precio_venta)
      bloquearCampoDesde('costo', pe.costo_variable)
    }
  }

  actualizarMargenEnVivo()

  // Si tiene resultado previo, mostrarlo
  if (pe.pe_unidades != null) {
    state.ultimoResultado = pe
    $('seccion-resultado').style.display = 'block'
    renderResultado(pe)
  }

  lucide.createIcons()
}

// ─── LIMPIAR FORM ────────────────────────────────────────────────────────────
function limpiarForm() {
  $('input-nombre').value = ''
  $('input-costos-fijos').value = ''
  $('input-precio-venta').value = ''
  $('input-costo-variable').value = ''
  $('input-notas').value = ''
  $('slider-margen').value = 15
  $('slider-valor-display').textContent = '15%'
  $('selector-producto').value = ''
  $('seccion-resultado').style.display = 'none'
  $('precio-desde-costeo').style.display = 'none'
  $('costo-desde-costeo').style.display = 'none'
  $('input-precio-venta').disabled = false
  $('input-costo-variable').disabled = false
  $('margen-en-vivo-valor').textContent = '—'
  $('margen-en-vivo-valor').className = 'margen-en-vivo-valor'
  setFeedback('')
}

// ─── CAMBIO DE PRODUCTO ──────────────────────────────────────────────────────
function onProductoChange() {
  const sel = $('selector-producto')
  const opt = sel.options[sel.selectedIndex]

  if (!sel.value) {
    // Manual
    desbloquearCampo('precio')
    desbloquearCampo('costo')
    return
  }

  const precio = opt.dataset.precio
  const costo = opt.dataset.costo

  if (precio != null) {
    $('input-precio-venta').value = precio
    bloquearCampoDesde('precio', precio)
  }
  if (costo != null) {
    $('input-costo-variable').value = costo
    bloquearCampoDesde('costo', costo)
  }

  actualizarMargenEnVivo()
}

function bloquearCampoDesde(tipo, valor) {
  if (tipo === 'precio') {
    state.precioBloqueado = true
    $('input-precio-venta').value = valor || ''
    $('input-precio-venta').disabled = true
    $('precio-desde-costeo').style.display = 'flex'
  } else {
    state.costoBloqueado = true
    $('input-costo-variable').value = valor || ''
    $('input-costo-variable').disabled = true
    $('costo-desde-costeo').style.display = 'flex'
  }
}

function desbloquearCampo(tipo) {
  if (tipo === 'precio') {
    state.precioBloqueado = false
    $('input-precio-venta').disabled = false
    $('precio-desde-costeo').style.display = 'none'
  } else {
    state.costoBloqueado = false
    $('input-costo-variable').disabled = false
    $('costo-desde-costeo').style.display = 'none'
  }
}

// ─── MARGEN EN VIVO ──────────────────────────────────────────────────────────
function actualizarMargenEnVivo() {
  const precio = parseFloat($('input-precio-venta').value) || 0
  const costo = parseFloat($('input-costo-variable').value) || 0
  const el = $('margen-en-vivo-valor')

  if (!precio) {
    el.textContent = '—'
    el.className = 'margen-en-vivo-valor'
    return
  }

  const margenUnit = precio - costo
  const margenPct = precio > 0 ? (margenUnit / precio) * 100 : 0
  const clase = claseMargen(margenPct)

  el.textContent = `$${fmt(margenUnit)} por unidad (${fmt(margenPct)}%)`
  el.className = 'margen-en-vivo-valor ' + clase
}

// ─── USAR GFM ────────────────────────────────────────────────────────────────
function usarGFM() {
  if (state.gfm) {
    $('input-costos-fijos').value = state.gfm
    $('input-costos-fijos').focus()
  }
}

// ─── AUTOSAVE ────────────────────────────────────────────────────────────────
async function autoSave() {
  if (!state.peId) return // No autosave en nuevo (solo al calcular)
  setSave('saving', 'Guardando...')
  try {
    const params = buildParams()
    await supabase.rpc('flujo_pe_guardar', params)
    setSave('saved', 'Guardado')
  } catch (e) {
    console.warn('autosave PE silenciado:', e?.message)
    setSave('saved', 'Guardado')
  }
}

// ─── CONSTRUIR PARAMS ────────────────────────────────────────────────────────
function buildParams() {
  return {
    p_pe_id: state.peId,
    p_org_id: state.orgId,
    p_nombre: $('input-nombre').value.trim() || 'Sin nombre',
    p_producto_id: $('selector-producto').value || null,
    p_costos_fijos: parseFloat($('input-costos-fijos').value) || 0,
    p_precio_venta: parseFloat($('input-precio-venta').value) || 0,
    p_costo_variable: parseFloat($('input-costo-variable').value) || 0,
    p_margen_seguridad: parseInt($('slider-margen').value) || 15,
    p_notas: $('input-notas').value.trim() || null,
  }
}

// ─── CALCULAR Y GUARDAR ──────────────────────────────────────────────────────
async function calcularYGuardar() {
  const btn = $('btn-calcular')
  btn.disabled = true
  setFeedback('Calculando...', 'var(--amber)')
  setSave('saving', 'Guardando...')

  try {
    const params = buildParams()

    // Validaciones básicas
    if (!params.p_costos_fijos && !params.p_precio_venta) {
      setFeedback('⚠️ Completa al menos costos fijos y precio de venta.', 'var(--red)')
      btn.disabled = false
      setSave('idle', '—')
      return
    }

    const { data, error } = await supabase.rpc('flujo_pe_guardar', params)
    if (error) throw error

    const resultado = Array.isArray(data) ? data[0] : data
    if (!resultado) throw new Error('Sin respuesta del servidor')

    // Guardar ID generado para ediciones posteriores
    if (!state.peId && resultado.id) {
      state.peId = resultado.id
    }

    state.ultimoResultado = resultado

    setSave('saved', 'Guardado')
    setFeedback('✓ Guardado correctamente', 'var(--green)')

    // Mostrar resultado
    $('seccion-resultado').style.display = 'block'
    renderResultado(resultado)
    $('body-scroll')?.scrollTo({ top: $('seccion-resultado').offsetTop - 20, behavior: 'smooth' })

    // Refrescar lista en background
    refrescarListaSilencioso()

  } catch (e) {
    console.error('calcularYGuardar:', e)
    setFeedback('Error al guardar: ' + (e.message || 'intenta de nuevo'), 'var(--red)')
    setSave('error', 'Error')
  }

  btn.disabled = false
  lucide.createIcons()
}

async function refrescarListaSilencioso() {
  try {
    const { data } = await supabase.rpc('flujo_pe_listar', { p_org_id: state.orgId })
    state.lista = data || []
  } catch (e) {
    console.warn('refrescarListaSilencioso:', e)
  }
}

// ─── RENDERIZAR RESULTADO ────────────────────────────────────────────────────
function renderResultado(pe) {
  const wrap = $('resultado-wrap')
  if (!wrap) return

  const margenPct = parseFloat(pe.margen_unitario_pct) || 0
  const margenUnit = parseFloat(pe.margen_unitario) || 0
  const esNegativo = margenPct <= 0

  if (esNegativo) {
    const precio = parseFloat(pe.precio_venta) || 0
    const costo = parseFloat(pe.costo_variable) || 0
    wrap.innerHTML = `
      <div class="banner-peligro">
        <div class="banner-peligro-header">
          <i data-lucide="alert-triangle"></i>
          <h3>Este producto pierde con cada venta</h3>
        </div>
        <p>Tu costo variable (${fmtMoney(costo)}) es mayor o igual a tu precio (${fmtMoney(precio)}).</p>
        <p>No hay punto de equilibrio posible. Necesitas:</p>
        <ul>
          <li>Subir el precio de venta, o</li>
          <li>Reducir el costo variable.</li>
        </ul>
        <p style="margin-top:10px;font-size:12.5px;opacity:.7">Hasta que el margen unitario sea positivo, no hay manera de cubrir tus costos fijos.</p>
      </div>`
    lucide.createIcons()
    return
  }

  const peUds = fmt(pe.pe_unidades)
  const pePesos = fmtMoney(pe.pe_pesos)
  const segUds = fmt(pe.pe_seguro_unidades)
  const segPesos = fmtMoney(pe.pe_seguro_pesos)
  const margenSegPct = pe.margen_seguridad_pct || 15
  const claseM = claseMargen(margenPct)

  // Escenarios
  const base = parseFloat(pe.pe_unidades) || 0
  const escConservador = Math.ceil(base * 1.20)
  const escAmbicioso = Math.ceil(base * 1.50)
  const precio = parseFloat(pe.precio_venta) || 0

  wrap.innerHTML = `
    <!-- NIVEL 1: PE BASE -->
    <div class="resultado-nivel principal">
      <div class="resultado-nivel-label">
        <i data-lucide="target"></i>
        Punto de Equilibrio base
      </div>
      <div class="resultado-main-number">${peUds}</div>
      <div class="resultado-main-label">unidades al mes para no perder</div>
      <div class="resultado-dinero">= ${pePesos} en ventas</div>
      <div class="resultado-margen-row">
        <span class="resultado-margen-label">Margen por unidad</span>
        <span class="resultado-margen-valor ${claseM}">${fmtMoney(margenUnit)} · ${fmt(margenPct)}%</span>
      </div>
    </div>

    <!-- NIVEL 2: CON MARGEN DE SEGURIDAD -->
    <div class="resultado-nivel">
      <div class="resultado-nivel-label">
        <i data-lucide="shield-check"></i>
        Con margen de seguridad (${margenSegPct}%)
      </div>
      <div class="resultado-seguro-number">${segUds} unidades</div>
      <div class="resultado-seguro-sub">= ${segPesos}</div>
      <div class="resultado-margen-row">
        <span class="resultado-margen-label" style="font-size:13px;color:var(--text-3)">Este es tu objetivo realista mes a mes.</span>
      </div>
    </div>

    <!-- NIVEL 3: ESCENARIOS -->
    <div>
      <div style="font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text-3);margin-bottom:12px">Escenarios</div>
      <div class="escenarios-grid">
        <div class="escenario-card">
          <div class="escenario-nombre">Conservador</div>
          <div class="escenario-unidades">${fmt(escConservador)}</div>
          <div class="escenario-sub">unidades</div>
          <div class="escenario-pesos">${fmtMoney(escConservador * precio)}</div>
          <div class="escenario-desc">PE × 1.20 — Te da margen para imprevistos</div>
        </div>
        <div class="escenario-card" style="border-color:var(--amber)">
          <div class="escenario-nombre" style="color:var(--amber)">Base</div>
          <div class="escenario-unidades" style="color:var(--amber)">${peUds}</div>
          <div class="escenario-sub">unidades</div>
          <div class="escenario-pesos">${pePesos}</div>
          <div class="escenario-desc">Tu mínimo para no perder</div>
        </div>
        <div class="escenario-card">
          <div class="escenario-nombre">Ambicioso</div>
          <div class="escenario-unidades">${fmt(escAmbicioso)}</div>
          <div class="escenario-sub">unidades</div>
          <div class="escenario-pesos">${fmtMoney(escAmbicioso * precio)}</div>
          <div class="escenario-desc">PE × 1.50 — Para crecer real</div>
        </div>
      </div>
    </div>`

  lucide.createIcons()
}

// ─── ELIMINAR PE ─────────────────────────────────────────────────────────────
async function eliminarPE(peId) {
  const pe = state.lista.find(p => p.id === peId)
  const nombre = pe?.nombre || 'este cálculo'

  if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return

  try {
    const { error } = await supabase
      .from('flujo_punto_equilibrio')
      .delete()
      .eq('id', peId)
      .eq('organizacion_id', state.orgId)

    if (error) throw error
    await cargarLista()
  } catch (e) {
    console.error('eliminarPE:', e)
    alert('Error al eliminar: ' + (e.message || 'intenta de nuevo'))
  }
}

// ─── Arranque ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init)
