import { supabase, getMyProfile, getMyOrganization } from '/assets/js/supabase-client.js'

// ─────────────────────────────────────────────
// ESTADO GLOBAL
// ─────────────────────────────────────────────
const state = {
  orgId: null,
  perfil: null,
  stats: null,
  tendencia: [],       // 30 días desde RPC
  historial: [],       // todos los días cargados
  historialPage: 0,
  historialPageSize: 30,
  saldoInicial: 0,     // del día en formulario
  ingDesglosado: false,
  egrDesglosado: false,
  guardando: false,
}

// ─────────────────────────────────────────────
// HELPERS DOM
// ─────────────────────────────────────────────
const $ = id => document.getElementById(id)
function fmt(n) {
  if (n == null || isNaN(n)) return '$—'
  return '$' + Number(n).toLocaleString('es-MX', { maximumFractionDigits: 0 })
}
function fmtNum(n) {
  if (n == null || isNaN(n)) return 0
  return Number(n)
}
function fechaHoy() {
  const d = new Date()
  return d.toISOString().split('T')[0]
}
function fechaLabel(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${parseInt(d)} ${meses[parseInt(m)-1]} ${y}`
}

function setSave(estado, texto) {
  const el = $('save-indicator')
  const txt = $('save-text')
  el.className = 'save-indicator ' + estado
  txt.textContent = texto
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
async function init() {
  try {
    const [perfil, org] = await Promise.all([getMyProfile(), getMyOrganization()])
    state.perfil = perfil
    state.orgId = org?.id || org?.organizacion_id
    if (!state.orgId) { console.error('No se encontró org'); return }

    // fecha hoy en input
    const inputFecha = $('input-fecha')
    inputFecha.value = fechaHoy()
    inputFecha.max = fechaHoy()
    // max 30 días atrás
    const minDate = new Date()
    minDate.setDate(minDate.getDate() - 30)
    inputFecha.min = minDate.toISOString().split('T')[0]

    inputFecha.addEventListener('change', () => cargarFormulario(inputFecha.value))

    // calcular saldo final en vivo
    $('input-ingresos').addEventListener('input', calcularSaldoFinal)
    $('input-egresos').addEventListener('input', calcularSaldoFinal)

    // botones desglosar
    $('btn-desglosar-ing').addEventListener('click', () => toggleDesglosar('ing'))
    $('btn-desglosar-egr').addEventListener('click', () => toggleDesglosar('egr'))
    $('btn-add-ing').addEventListener('click', () => agregarComponente('ing'))
    $('btn-add-egr').addEventListener('click', () => agregarComponente('egr'))

    // guardar
    $('btn-guardar').addEventListener('click', guardarDia)

    // historial toggle
    $('historial-toggle').addEventListener('click', toggleHistorial)
    $('pag-prev').addEventListener('click', () => renderHistorialPage(state.historialPage - 1))
    $('pag-next').addEventListener('click', () => renderHistorialPage(state.historialPage + 1))

    // config modal
    $('btn-config').addEventListener('click', abrirConfig)
    $('btn-config-cerrar').addEventListener('click', () => $('modal-config').classList.remove('visible'))
    $('btn-config-guardar').addEventListener('click', guardarConfig)
    $('btn-recalcular').addEventListener('click', recalcularCadena)

    // radio umbral
    document.querySelectorAll('input[name="umbral-tipo"]').forEach(r => {
      r.addEventListener('change', () => {
        const manual = r.value === 'manual'
        $('umbral-manual-wrap').style.display = manual ? 'block' : 'none'
        document.querySelectorAll('.radio-option').forEach(el => el.classList.remove('selected'))
        r.closest('.radio-option').classList.add('selected')
      })
    })

    // Cargar todo en paralelo
    await Promise.all([
      cargarStats(),
      cargarTendencia(),
      cargarHistorial(),
    ])

    // Verificar setup: ¿tiene días o config?
    await verificarSetup()

    // Cargar formulario de hoy
    await cargarFormulario(fechaHoy())

    lucide.createIcons()
  } catch (err) {
    console.error('init error:', err)
  }
}

// ─────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────
async function cargarStats() {
  try {
    const { data, error } = await supabase.rpc('flujo_caja_stats', { p_org_id: state.orgId })
    if (error) { console.warn('stats error:', error.message); return }
    state.stats = data
    renderStats(data)
  } catch (e) {
    console.warn('cargarStats:', e.message)
  }
}

function renderStats(d) {
  if (!d) return
  const saldo = $('stat-saldo')
  saldo.className = 'stat-value'
  saldo.style = ''
  saldo.textContent = fmt(d.saldo_hoy)

  const prom7 = $('stat-promedio7')
  prom7.className = 'stat-value'
  prom7.style = ''
  prom7.textContent = fmt(d.promedio_7_dias)

  const tend = $('stat-tendencia')
  tend.className = 'stat-value'
  tend.style = ''
  const pct = d.tendencia_pct
  if (pct != null) {
    const pos = pct >= 0
    tend.textContent = (pos ? '↗ +' : '↘ ') + pct.toFixed(1) + '%'
    tend.classList.add(pos ? 'green' : 'red')
    $('stat-tendencia-sub').textContent = 'vs 7 días anteriores'
  } else {
    tend.textContent = '—'
  }

  // Banner alerta
  const banner = $('alert-banner')
  const estado = d.estado_alerta
  if (!estado || estado === 'sano') {
    banner.classList.remove('visible', 'atencion', 'alerta')
  } else if (estado === 'atencion') {
    banner.classList.add('visible', 'atencion')
    banner.classList.remove('alerta')
    $('alert-title').textContent = 'Atención'
    $('alert-desc').textContent = 'Tu saldo cayó más del 20% en la última semana.'
  } else if (estado === 'alerta') {
    banner.classList.add('visible', 'alerta')
    banner.classList.remove('atencion')
    $('alert-title').textContent = 'Alerta financiera'
    $('alert-desc').textContent = `Tu saldo está por debajo del mínimo recomendado (${fmt(d.umbral_alerta)}).`
  }

  lucide.createIcons()
}

// ─────────────────────────────────────────────
// VERIFICAR SETUP
// ─────────────────────────────────────────────
async function verificarSetup() {
  // Si no hay días en historial y stats dice saldo_hoy null → pedir setup
  const sinDias = state.historial.length === 0
  const sinStats = !state.stats || state.stats.saldo_hoy == null
  if (sinDias && sinStats) {
    mostrarModalSetup()
  }
}

function mostrarModalSetup() {
  $('modal-setup').classList.add('visible')
  const btnSetup = $('btn-setup-guardar')
  btnSetup.onclick = async () => {
    const saldo = parseFloat($('setup-saldo').value)
    if (!saldo || saldo < 0) { $('setup-saldo').focus(); return }
    btnSetup.disabled = true
    try {
      await supabase.rpc('flujo_caja_set_saldo_inicial', { p_org_id: state.orgId, p_saldo: saldo })
      $('modal-setup').classList.remove('visible')
      state.saldoInicial = saldo
      $('input-saldo-inicial').value = saldo.toLocaleString('es-MX', { maximumFractionDigits: 0 })
      calcularSaldoFinal()
    } catch (e) {
      console.error('setup saldo:', e)
    }
    btnSetup.disabled = false
  }
  lucide.createIcons()
}

// ─────────────────────────────────────────────
// FORMULARIO
// ─────────────────────────────────────────────
async function cargarFormulario(fecha) {
  // Buscar en tendencia si existe ese día
  const diaExistente = state.tendencia.find(d => d.fecha === fecha)
  if (diaExistente) {
    // Pre-llenar con datos guardados
    $('input-saldo-inicial').value = fmtNum(diaExistente.saldo_inicial).toLocaleString('es-MX', {maximumFractionDigits:0})
    $('input-ingresos').value = fmtNum(diaExistente.ingresos_total)
    $('input-egresos').value = fmtNum(diaExistente.egresos_total)
    $('input-notas').value = diaExistente.notas || ''
    state.saldoInicial = fmtNum(diaExistente.saldo_inicial)
    $('saldo-inicial-hint').textContent = 'cargado del registro guardado'

    // Si tiene componentes, desglosar
    if (diaExistente.ingresos_componentes?.length > 0) {
      if (!state.ingDesglosado) toggleDesglosar('ing')
      renderComponentes('ing', diaExistente.ingresos_componentes)
    }
    if (diaExistente.egresos_componentes?.length > 0) {
      if (!state.egrDesglosado) toggleDesglosar('egr')
      renderComponentes('egr', diaExistente.egresos_componentes)
    }
  } else {
    // Formulario vacío, buscar saldo_inicial del día anterior
    $('input-ingresos').value = ''
    $('input-egresos').value = ''
    $('input-notas').value = ''
    limpiarComponentes('ing')
    limpiarComponentes('egr')

    const saldoPrev = await obtenerSaldoAnterior(fecha)
    state.saldoInicial = saldoPrev
    $('input-saldo-inicial').value = saldoPrev > 0
      ? saldoPrev.toLocaleString('es-MX', { maximumFractionDigits: 0 })
      : ''
    $('saldo-inicial-hint').textContent = saldoPrev > 0 ? 'viene del saldo final del día anterior' : 'ingresa el saldo inicial manualmente'
  }
  calcularSaldoFinal()
}

async function obtenerSaldoAnterior(fecha) {
  // Buscar en tendencia el día anterior con saldo_final
  if (state.tendencia.length === 0) return 0
  const sorted = [...state.tendencia]
    .filter(d => d.fecha < fecha && d.saldo_final != null)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
  return sorted.length > 0 ? fmtNum(sorted[0].saldo_final) : 0
}

function calcularSaldoFinal() {
  const si = state.saldoInicial || 0
  let ing = 0, egr = 0

  if (state.ingDesglosado) {
    document.querySelectorAll('#ing-componentes .monto-input').forEach(el => {
      ing += parseFloat(el.value) || 0
    })
    $('input-ingresos').value = ing || ''
  } else {
    ing = parseFloat($('input-ingresos').value) || 0
  }

  if (state.egrDesglosado) {
    document.querySelectorAll('#egr-componentes .monto-input').forEach(el => {
      egr += parseFloat(el.value) || 0
    })
    $('input-egresos').value = egr || ''
  } else {
    egr = parseFloat($('input-egresos').value) || 0
  }

  const final = si + ing - egr
  const el = $('saldo-final-display')
  el.textContent = fmt(final)
  el.className = 'saldo-final-value' + (final >= 0 ? ' positive' : ' negative')
}

// ─────────────────────────────────────────────
// COMPONENTES (DRAFT LOCAL)
// ─────────────────────────────────────────────
function toggleDesglosar(tipo) {
  const esIng = tipo === 'ing'
  const flag = esIng ? 'ingDesglosado' : 'egrDesglosado'
  const listaId = tipo + '-componentes'
  const addWrapId = tipo + '-add-wrap'
  const btnId = 'btn-desglosar-' + tipo
  const mainVal = parseFloat(esIng ? $('input-ingresos').value : $('input-egresos').value) || 0

  state[flag] = !state[flag]

  if (state[flag]) {
    $(listaId).style.display = 'flex'
    $(addWrapId).style.display = 'block'
    $(btnId).innerHTML = '<i data-lucide="x"></i> Colapsar'
    // Si ya había un monto, crear un componente draft con ese monto
    if (mainVal > 0 && $(listaId).children.length === 0) {
      agregarComponente(tipo, '', mainVal)
    } else if ($(listaId).children.length === 0) {
      agregarComponente(tipo)
    }
  } else {
    // Sumar componentes al campo principal
    let total = 0
    document.querySelectorAll(`#${listaId} .monto-input`).forEach(el => { total += parseFloat(el.value) || 0 })
    if (esIng) $('input-ingresos').value = total || ''
    else $('input-egresos').value = total || ''

    $(listaId).style.display = 'none'
    $(addWrapId).style.display = 'none'
    $(btnId).innerHTML = '<i data-lucide="plus"></i> Desglosar'
  }
  calcularSaldoFinal()
  lucide.createIcons()
}

function agregarComponente(tipo, label = '', monto = '') {
  const listaId = tipo + '-componentes'
  const id = 'draft-' + Date.now() + '-' + Math.random().toString(36).slice(2,7)
  const row = document.createElement('div')
  row.className = 'componente-row'
  row.dataset.id = id
  row.innerHTML = `
    <input type="text" class="form-input label-input" placeholder="Descripción" value="${label}">
    <input type="number" class="form-input monto-input" placeholder="0" min="0" step="1" value="${monto}">
    <button class="btn-remove-comp" data-id="${id}"><i data-lucide="x"></i></button>
  `
  row.querySelector('.monto-input').addEventListener('input', calcularSaldoFinal)
  row.querySelector('.btn-remove-comp').addEventListener('click', () => {
    row.remove()
    calcularSaldoFinal()
  })
  $(listaId).appendChild(row)
  lucide.createIcons()
}

function renderComponentes(tipo, componentes) {
  const listaId = tipo + '-componentes'
  $(listaId).innerHTML = ''
  componentes.forEach(c => {
    agregarComponente(tipo, c.label || c.descripcion || '', c.monto || c.valor || 0)
  })
}

function limpiarComponentes(tipo) {
  $(tipo + '-componentes').innerHTML = ''
  const flag = tipo === 'ing' ? 'ingDesglosado' : 'egrDesglosado'
  if (state[flag]) toggleDesglosar(tipo)
}

// ─────────────────────────────────────────────
// GUARDAR DÍA
// ─────────────────────────────────────────────
async function guardarDia() {
  if (state.guardando) return
  state.guardando = true
  setSave('saving', 'Guardando…')
  $('btn-guardar').disabled = true
  $('form-feedback').textContent = ''

  try {
    const fecha = $('input-fecha').value
    let ingTotal = parseFloat($('input-ingresos').value) || 0
    let egrTotal = parseFloat($('input-egresos').value) || 0

    // Recolectar componentes
    let ingComp = [], egrComp = []
    if (state.ingDesglosado) {
      document.querySelectorAll('#ing-componentes .componente-row').forEach(row => {
        const label = row.querySelector('.label-input').value.trim()
        const monto = parseFloat(row.querySelector('.monto-input').value) || 0
        if (label || monto > 0) ingComp.push({ label, monto })
      })
      ingTotal = ingComp.reduce((s, c) => s + c.monto, 0)
    }
    if (state.egrDesglosado) {
      document.querySelectorAll('#egr-componentes .componente-row').forEach(row => {
        const label = row.querySelector('.label-input').value.trim()
        const monto = parseFloat(row.querySelector('.monto-input').value) || 0
        if (label || monto > 0) egrComp.push({ label, monto })
      })
      egrTotal = egrComp.reduce((s, c) => s + c.monto, 0)
    }

    const notas = $('input-notas').value.trim()

    const { error } = await supabase.rpc('flujo_caja_guardar_dia', {
      p_org_id: state.orgId,
      p_fecha: fecha,
      p_ingresos_total: ingTotal,
      p_egresos_total: egrTotal,
      p_ingresos_componentes: ingComp.length > 0 ? ingComp : null,
      p_egresos_componentes: egrComp.length > 0 ? egrComp : null,
      p_notas: notas || null,
    })

    if (error) throw error

    setSave('saved', 'Guardado')
    $('form-feedback').textContent = '✓ Día guardado correctamente'
    $('form-feedback').style.color = 'var(--green)'

    // Recargar datos para reflejar cambios
    await Promise.all([cargarStats(), cargarTendencia(), cargarHistorial()])
    lucide.createIcons()

    setTimeout(() => {
      setSave('idle', '—')
      $('form-feedback').textContent = ''
    }, 3000)
  } catch (e) {
    console.error('guardarDia:', e)
    setSave('error', 'Error al guardar')
    $('form-feedback').textContent = 'Error: ' + (e.message || 'intenta de nuevo')
    $('form-feedback').style.color = 'var(--red)'
    setTimeout(() => setSave('idle', '—'), 4000)
  }

  state.guardando = false
  $('btn-guardar').disabled = false
}

// ─────────────────────────────────────────────
// TENDENCIA (30 días) + GRÁFICA
// ─────────────────────────────────────────────
async function cargarTendencia() {
  try {
    const { data, error } = await supabase.rpc('flujo_caja_tendencia', {
      p_org_id: state.orgId,
      p_dias: 30,
    })
    if (error) { console.warn('tendencia error:', error.message); return }
    state.tendencia = data || []
    renderGrafica(state.tendencia)
  } catch (e) {
    console.warn('cargarTendencia:', e.message)
  }
}

function renderGrafica(datos) {
  const wrap = $('grafica-wrap')
  const empty = $('grafica-empty')
  const tooltip = $('grafica-tooltip')

  // Filtrar solo días con saldo_final
  const pts = (datos || []).filter(d => d.saldo_final != null).sort((a, b) => a.fecha.localeCompare(b.fecha))

  if (pts.length < 2) {
    empty.style.display = 'flex'
    return
  }
  empty.style.display = 'none'

  const W = wrap.clientWidth || 600
  const H = 200
  const pad = { top: 20, right: 20, bottom: 36, left: 56 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom

  const valores = pts.map(d => d.saldo_final)
  const minVal = Math.min(...valores)
  const maxVal = Math.max(...valores)
  const rango = maxVal - minVal || 1
  const umbral = state.stats?.umbral_alerta

  // Determinar color de línea
  const tend = state.stats?.tendencia_pct
  let lineColor = '#ff9500' // ámbar plana
  if (tend != null) {
    lineColor = tend > 2 ? '#00c853' : tend < -2 ? '#ff3b30' : '#ff9500'
  }

  function xOf(i) { return pad.left + (i / (pts.length - 1)) * innerW }
  function yOf(v) { return pad.top + innerH - ((v - minVal) / rango) * innerH }

  // Construir puntos del path
  const pathPts = pts.map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(d.saldo_final).toFixed(1)}`)

  // Área bajo la curva
  const areaPath = pathPts.join(' ') +
    ` L${xOf(pts.length-1).toFixed(1)},${(pad.top + innerH).toFixed(1)}` +
    ` L${pad.left.toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`

  // Ejes Y — 4 ticks
  let yTicks = ''
  for (let t = 0; t <= 3; t++) {
    const v = minVal + (rango * t / 3)
    const y = yOf(v).toFixed(1)
    yTicks += `<line x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}" stroke="var(--border)" stroke-dasharray="4,4"/>`
    const label = v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'k' : v.toFixed(0)
    yTicks += `<text x="${pad.left - 6}" y="${parseFloat(y)+4}" text-anchor="end" font-size="10" fill="var(--text-3)">${label}</text>`
  }

  // Ejes X — fechas cada ~7 días
  let xTicks = ''
  const step = Math.max(1, Math.floor(pts.length / 5))
  pts.forEach((d, i) => {
    if (i % step === 0 || i === pts.length - 1) {
      const x = xOf(i).toFixed(1)
      const [, m, dd] = d.fecha.split('-')
      const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
      xTicks += `<text x="${x}" y="${H - 8}" text-anchor="middle" font-size="10" fill="var(--text-3)">${parseInt(dd)} ${meses[parseInt(m)-1]}</text>`
    }
  })

  // Línea umbral
  let umbralLine = ''
  if (umbral != null && umbral >= minVal && umbral <= maxVal * 1.2) {
    const yU = yOf(umbral).toFixed(1)
    umbralLine = `<line x1="${pad.left}" y1="${yU}" x2="${W - pad.right}" y2="${yU}" stroke="#ff3b30" stroke-width="1.5" stroke-dasharray="5,4" opacity="0.7"/>
    <text x="${W - pad.right + 4}" y="${parseFloat(yU)+4}" font-size="9" fill="#ff3b30" opacity="0.8">umbral</text>`
  }

  // Puntos hover
  let circles = ''
  pts.forEach((d, i) => {
    circles += `<circle class="grafica-pt" cx="${xOf(i).toFixed(1)}" cy="${yOf(d.saldo_final).toFixed(1)}" r="4" fill="${lineColor}" stroke="var(--bg-card)" stroke-width="2" data-i="${i}" opacity="0" style="cursor:crosshair"/>`
  })

  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
    <defs>
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${lineColor}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${lineColor}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${yTicks}
    <path d="${areaPath}" fill="url(#areaGrad)"/>
    <path d="${pathPts.join(' ')}" fill="none" stroke="${lineColor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${umbralLine}
    ${circles}
    ${xTicks}
  </svg>`

  // Limpiar SVG previo
  const prevSvg = wrap.querySelector('svg')
  if (prevSvg) prevSvg.remove()
  wrap.insertAdjacentHTML('afterbegin', svg)

  // Hover
  wrap.querySelectorAll('.grafica-pt').forEach(circle => {
    const i = parseInt(circle.dataset.i)
    circle.addEventListener('mouseenter', (e) => {
      const d = pts[i]
      circle.setAttribute('opacity', '1')
      tooltip.style.display = 'block'
      tooltip.innerHTML = `<strong>${fechaLabel(d.fecha)}</strong><br>
        Saldo: <strong>${fmt(d.saldo_final)}</strong><br>
        Ingresos: ${fmt(d.ingresos_total)} · Egresos: ${fmt(d.egresos_total)}
        ${d.notas ? `<br><em style="color:var(--text-3)">${d.notas}</em>` : ''}`
    })
    circle.addEventListener('mousemove', (e) => {
      const rect = wrap.getBoundingClientRect()
      let left = e.clientX - rect.left + 12
      let top = e.clientY - rect.top - 10
      const tw = tooltip.offsetWidth
      if (left + tw > rect.width) left = left - tw - 24
      tooltip.style.left = left + 'px'
      tooltip.style.top = top + 'px'
    })
    circle.addEventListener('mouseleave', () => {
      circle.setAttribute('opacity', '0')
      tooltip.style.display = 'none'
    })
  })
}

// ─────────────────────────────────────────────
// HISTORIAL
// ─────────────────────────────────────────────
async function cargarHistorial() {
  try {
    const { data, error } = await supabase.rpc('flujo_caja_tendencia', {
      p_org_id: state.orgId,
      p_dias: 365,  // hasta 1 año para historial completo
    })
    if (error) { console.warn('historial error:', error.message); return }
    state.historial = (data || []).sort((a, b) => b.fecha.localeCompare(a.fecha))
    renderHistorialPage(0)
  } catch (e) {
    console.warn('cargarHistorial:', e.message)
  }
}

function renderHistorialPage(page) {
  const total = state.historial.length
  const ps = state.historialPageSize
  const pages = Math.ceil(total / ps)
  page = Math.max(0, Math.min(page, pages - 1))
  state.historialPage = page

  const slice = state.historial.slice(page * ps, (page + 1) * ps)
  const tbody = $('historial-tbody')
  tbody.innerHTML = ''

  slice.forEach(d => {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td class="td-fecha">${fechaLabel(d.fecha)}</td>
      <td>${fmt(d.saldo_inicial)}</td>
      <td class="td-monto pos">${fmt(d.ingresos_total)}</td>
      <td class="td-monto neg">${fmt(d.egresos_total)}</td>
      <td class="td-saldo">${fmt(d.saldo_final)}</td>
      <td class="td-notas">${d.notas || '—'}</td>
    `
    tr.addEventListener('click', () => {
      $('input-fecha').value = d.fecha
      cargarFormulario(d.fecha)
      // scroll up al formulario
      $('body-scroll').scrollTo({ top: $('seccion-form').offsetTop - 20, behavior: 'smooth' })
    })
    tbody.appendChild(tr)
  })

  $('pag-info').textContent = total > 0 ? `Mostrando ${page*ps+1}–${Math.min((page+1)*ps,total)} de ${total}` : 'Sin registros'
  $('pag-prev').disabled = page === 0
  $('pag-next').disabled = page >= pages - 1
}

function toggleHistorial() {
  const toggle = $('historial-toggle')
  const body = $('historial-body')
  const open = body.classList.toggle('open')
  toggle.classList.toggle('open', open)
  lucide.createIcons()
}

// ─────────────────────────────────────────────
// MODAL CONFIGURACIÓN
// ─────────────────────────────────────────────
function abrirConfig() {
  // Prellenar con stats actuales
  if (state.stats) {
    const esAuto = !state.stats.umbral_es_manual
    const radioAuto = $('radio-auto')
    const radioManual = $('radio-manual')
    if (esAuto) {
      radioAuto.checked = true
      $('radio-auto-label').classList.add('selected')
      $('radio-manual-label').classList.remove('selected')
      $('umbral-manual-wrap').style.display = 'none'
    } else {
      radioManual.checked = true
      $('radio-manual-label').classList.add('selected')
      $('radio-auto-label').classList.remove('selected')
      $('umbral-manual-wrap').style.display = 'block'
      $('config-umbral').value = state.stats.umbral_alerta || ''
    }
  } else {
    // default: automático
    $('radio-auto').checked = true
    $('radio-auto-label').classList.add('selected')
    $('radio-manual-label').classList.remove('selected')
    $('umbral-manual-wrap').style.display = 'none'
  }
  $('modal-config').classList.add('visible')
  lucide.createIcons()
}

async function guardarConfig() {
  const esManual = $('radio-manual').checked
  const umbral = esManual ? parseFloat($('config-umbral').value) || null : null
  const saldoInicial = parseFloat($('config-saldo-inicial').value) || null

  try {
    const promises = []
    if (umbral !== null || !esManual) {
      promises.push(supabase.rpc('flujo_caja_set_umbral', {
        p_org_id: state.orgId,
        p_umbral: umbral || 0,
        p_es_automatico: !esManual,
      }))
    }
    if (saldoInicial != null) {
      promises.push(supabase.rpc('flujo_caja_set_saldo_inicial', {
        p_org_id: state.orgId,
        p_saldo: saldoInicial,
      }))
    }
    await Promise.all(promises)
    $('modal-config').classList.remove('visible')
    await Promise.all([cargarStats(), cargarTendencia()])
    lucide.createIcons()
  } catch (e) {
    console.error('guardarConfig:', e)
  }
}

async function recalcularCadena() {
  if (!state.historial.length) return
  const fechaDesde = state.historial[state.historial.length - 1]?.fecha
  if (!fechaDesde) return
  try {
    $('btn-recalcular').disabled = true
    $('btn-recalcular').textContent = 'Recalculando…'
    await supabase.rpc('flujo_caja_recalcular_desde', {
      p_org_id: state.orgId,
      p_fecha_desde: fechaDesde,
    })
    await Promise.all([cargarStats(), cargarTendencia(), cargarHistorial()])
    $('btn-recalcular').disabled = false
    $('btn-recalcular').innerHTML = '<i data-lucide="refresh-cw"></i> Recalcular cadena desde el inicio'
    lucide.createIcons()
  } catch (e) {
    console.error('recalcular:', e)
    $('btn-recalcular').disabled = false
  }
}

// ─────────────────────────────────────────────
// ARRANQUE
// ─────────────────────────────────────────────
init()
