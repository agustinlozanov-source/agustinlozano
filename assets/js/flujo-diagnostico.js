// ════════════════════════════════════════════════════════════════════════════
// SCALEx · flujo-diagnostico.js — Diagnóstico Financiero (PRISMA del Flujo)
// ════════════════════════════════════════════════════════════════════════════

import { supabase, getMyProfile, getMyOrganization } from '/assets/js/supabase-client.js'
import {
  VARIABLES_DIAGNOSTICO, UMBRALES_INDICES, MATRICES, VEREDICTOS, AGENDAS_DIAGNOSTICO,
  calcularMUN, calcularCCE, calcularCrecimiento, sumarComponentes, calcularIndices, evaluarIndice
} from '/assets/js/flujo-diagnostico-catalogo.js'

// ── Estado global ────────────────────────────────────────────────────────────
let state = {
  orgId: null,
  consultorId: null,
  diagnosticoId: null,
  paso: 0,           // 0=bienvenida, 1-8=variables, 9=resultado
  valores: {},       // { fcn, im, mun, gfm, gfm_items, cce, cce_tipo, pt, pt_items, ci, cc, ...sub-componentes }
  autosaveTimer: null,
  guardandoEstado: 'idle', // idle | saving | saved | error
  diagnosticoData: null,   // resultado completo del RPC
  historial: []
}

// ── DOM helpers ──────────────────────────────────────────────────────────────
const $p0 = () => document.getElementById('pantalla-0')
const $pc = () => document.getElementById('pantalla-captura')
const $pr = () => document.getElementById('pantalla-resultado')

function mostrarPantalla(id) {
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('visible'))
  const el = document.getElementById(id)
  if (el) el.classList.add('visible')
}

function setSave(estado, texto = '') {
  state.guardandoEstado = estado
  const ind = document.getElementById('save-indicator')
  const txt = document.getElementById('save-text')
  if (!ind) return
  ind.className = `save-indicator ${estado}`
  const iconos = { idle: 'check', saving: 'loader-2', saved: 'check-circle', error: 'x-circle' }
  ind.innerHTML = `<i data-lucide="${iconos[estado] || 'check'}"></i><span>${texto}</span>`
  lucide.createIcons({ nodes: [ind] })
}

function fmt(num, dec = 2) {
  if (num == null || isNaN(num)) return '—'
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: dec }).format(num)
}
function fmtMoneda(num) {
  if (num == null || isNaN(num)) return '—'
  return '$' + new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(num)
}
function fmtPct(num) {
  if (num == null || isNaN(num)) return '—'
  return (num >= 0 ? '+' : '') + fmt(num, 1) + '%'
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  const perfil = await getMyProfile()
  if (!perfil) return

  const org = await getMyOrganization()
  if (!org) {
    renderBienvenidaError('No se encontró la organización activa. Regresa al Dashboard y selecciona una organización.')
    return
  }

  state.consultorId = perfil.id
  state.orgId = org.id

  // Cargar diagnóstico activo + historial
  await cargarEstadoInicial()
}

async function cargarEstadoInicial() {
  try {
    const { data, error } = await supabase.rpc('flujo_diagnostico_activo', {
      p_organizacion_id: state.orgId
    })

    if (error) console.warn('flujo_diagnostico_activo:', error.message)

    const { data: hist } = await supabase.rpc('flujo_historial_diagnosticos', {
      p_organizacion_id: state.orgId
    })

    state.historial = hist || []

    if (data && data.estado === 'en_progreso') {
      // Hay diagnóstico en curso: restaurar
      state.diagnosticoId = data.id
      state.valores = data.variables_snapshot || {}
      renderBienvenida(data)
    } else if (data && data.estado === 'completado') {
      state.diagnosticoData = data
      renderBienvenidaConResultado(data)
    } else {
      renderBienvenida(null)
    }
  } catch (e) {
    console.error(e)
    renderBienvenida(null)
  }
}

// ── PANTALLA 0 — BIENVENIDA ───────────────────────────────────────────────────
function renderBienvenida(diagActivo) {
  const el = $p0()
  if (!el) return

  let activoHtml = ''
  if (diagActivo) {
    const pct = Math.round(((diagActivo.variables_capturadas || 0) / 8) * 100)
    activoHtml = `
      <div class="diag-activo-card">
        <div class="diag-activo-header">
          <div class="diag-activo-icon" style="background:var(--amber-light)">
            <i data-lucide="activity" style="color:var(--amber)"></i>
          </div>
          <div class="diag-activo-meta">
            <h3>Diagnóstico en progreso</h3>
            <span>${diagActivo.variables_capturadas || 0} de 8 variables capturadas (${pct}%)</span>
          </div>
        </div>
        <div style="margin-top:8px;">
          <div style="height:5px;background:var(--surface);border-radius:99px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#ff9500,#ff3b30);border-radius:99px;transition:width .4s ease;"></div>
          </div>
        </div>
      </div>`
  }

  let historialHtml = ''
  if (state.historial.length > 0) {
    const items = state.historial.slice(0, 5).map(h => {
      const color = h.veredicto || 'ambar'
      const fecha = h.completado_en ? new Date(h.completado_en).toLocaleDateString('es-MX', { day:'numeric', month:'short', year:'numeric' }) : '—'
      const label = VEREDICTOS[h.veredicto]?.nombre || h.veredicto || '—'
      return `<div class="historial-item">
        <div class="historial-dot ${color}"></div>
        <div class="historial-item-meta">
          <div class="historial-item-label">Diagnóstico PRISMA</div>
          <div class="historial-item-fecha">${fecha}</div>
        </div>
        <span class="historial-item-veredicto ${color}">${label}</span>
      </div>`
    }).join('')
    historialHtml = `
      <div style="margin-top:16px;">
        <div class="historial-title">Historial</div>
        <div class="historial-list">${items}</div>
      </div>`
  }

  const btnContinuar = diagActivo
    ? `<button class="btn btn-primary" id="btn-continuar">
        <i data-lucide="play"></i> Continuar diagnóstico
       </button>`
    : ''
  const btnNuevo = diagActivo
    ? `<button class="btn btn-secondary" id="btn-nuevo-diag">
        <i data-lucide="plus"></i> Nuevo diagnóstico
       </button>`
    : `<button class="btn btn-primary" id="btn-nuevo-diag">
        <i data-lucide="play"></i> Iniciar diagnóstico
       </button>`

  el.innerHTML = `
    <div class="bienvenida-hero">
      <div class="bienvenida-icon">
        <i data-lucide="bar-chart-3"></i>
      </div>
      <div class="bienvenida-text">
        <h1>La PRISMA del Flujo</h1>
        <p>8 variables financieras. 3 índices clave. 3 matrices diagnósticas. Un veredicto claro sobre la salud financiera de tu empresa — y una agenda de acción inmediata.</p>
      </div>
    </div>
    ${activoHtml}
    <div class="bienvenida-actions">
      ${btnContinuar}
      ${btnNuevo}
    </div>
    ${historialHtml}
  `

  lucide.createIcons({ nodes: [el] })

  document.getElementById('btn-nuevo-diag')?.addEventListener('click', iniciarNuevoDiagnostico)
  if (diagActivo) {
    document.getElementById('btn-continuar')?.addEventListener('click', () => {
      const varIdx = diagActivo.variables_capturadas || 0
      navegarAVariable(Math.min(varIdx + 1, 8))
    })
  }

  mostrarPantalla('pantalla-0')
}

function renderBienvenidaConResultado(data) {
  const el = $p0()
  if (!el) return
  const v = VEREDICTOS[data.veredicto] || VEREDICTOS.estresado
  const fecha = data.completado_en ? new Date(data.completado_en).toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' }) : '—'

  el.innerHTML = `
    <div class="bienvenida-hero">
      <div class="bienvenida-icon">
        <i data-lucide="bar-chart-3"></i>
      </div>
      <div class="bienvenida-text">
        <h1>La PRISMA del Flujo</h1>
        <p>Último diagnóstico completado el <strong>${fecha}</strong>. Puedes ver el resultado o iniciar un nuevo diagnóstico.</p>
      </div>
    </div>
    <div class="diag-activo-card">
      <div class="diag-activo-header">
        <div class="diag-activo-icon" style="background:var(--${v.color}-light)">
          <i data-lucide="${v.icono}" style="color:var(--${v.color})"></i>
        </div>
        <div class="diag-activo-meta">
          <h3>Diagnóstico completado</h3>
          <span>${fecha}</span>
        </div>
      </div>
      <div class="veredicto-banner ${v.color}" style="margin-top:10px;">
        <i data-lucide="${v.icono}"></i>
        <div class="veredicto-banner-text">
          <strong>${v.nombre}</strong>
          <p>${v.descripcion}</p>
        </div>
      </div>
    </div>
    <div class="bienvenida-actions">
      <button class="btn btn-primary" id="btn-ver-resultado">
        <i data-lucide="eye"></i> Ver resultado completo
      </button>
      <button class="btn btn-secondary" id="btn-nuevo-diag">
        <i data-lucide="plus"></i> Nuevo diagnóstico
      </button>
    </div>
  `

  lucide.createIcons({ nodes: [el] })
  document.getElementById('btn-ver-resultado')?.addEventListener('click', () => renderResultado(data))
  document.getElementById('btn-nuevo-diag')?.addEventListener('click', iniciarNuevoDiagnostico)
  mostrarPantalla('pantalla-0')
}

function renderBienvenidaError(msg) {
  const el = $p0()
  if (!el) return
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;flex:1;padding:40px;">
      <div style="text-align:center;max-width:440px;">
        <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
        <div style="font-size:15px;color:var(--text-2);line-height:1.6">${msg}</div>
        <a href="/portal/dashboard.html" class="btn btn-secondary" style="margin-top:20px;display:inline-flex;">
          <i data-lucide="arrow-left"></i> Ir al Dashboard
        </a>
      </div>
    </div>`
  lucide.createIcons({ nodes: [el] })
  mostrarPantalla('pantalla-0')
}

// ── INICIAR NUEVO DIAGNÓSTICO ─────────────────────────────────────────────────
async function iniciarNuevoDiagnostico() {
  const btn = document.getElementById('btn-nuevo-diag')
  if (btn) { btn.disabled = true; btn.textContent = 'Iniciando...' }

  try {
    const { data, error } = await supabase.rpc('flujo_iniciar_diagnostico', {
      p_organizacion_id: state.orgId,
      p_consultor_id: state.consultorId
    })
    if (error) throw error
    state.diagnosticoId = data
    state.valores = {}
    navegarAVariable(1)
  } catch (e) {
    console.error(e)
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="play"></i> Iniciar diagnóstico' }
    lucide.createIcons({ nodes: [btn] })
    alert('Error al iniciar el diagnóstico: ' + e.message)
  }
}

// ── PANTALLAS 1–8 — CAPTURA ───────────────────────────────────────────────────
function navegarAVariable(num) {
  state.paso = num
  renderVariable(num)
  mostrarPantalla('pantalla-captura')
  $pc()?.scrollTo({ top: 0, behavior: 'smooth' })
}

function renderVariable(num) {
  const v = VARIABLES_DIAGNOSTICO[num - 1]
  if (!v) return
  const pct = Math.round((num / 8) * 100)
  const el = $pc()
  if (!el) return

  el.innerHTML = `
    <!-- Progress -->
    <div class="captura-progress">
      <span class="captura-progress-label">Variable</span>
      <div class="captura-progress-track">
        <div class="captura-progress-fill" style="width:${pct}%"></div>
      </div>
      <span class="captura-progress-num">${num} / 8</span>
    </div>

    <!-- Header -->
    <div class="variable-header">
      <div class="variable-num">Variable ${num} de 8</div>
      <div class="variable-nombre">${v.nombre}</div>
      <span class="variable-abrev">${v.abreviacion}</span>
      <p class="variable-desc">${v.descripcion}</p>
      <div class="variable-explicacion">${v.explicacion}</div>
    </div>

    <!-- Inputs dinámicos -->
    <div id="inputs-variable"></div>

    <!-- Resultado en vivo -->
    ${v.formula_display ? renderResultadoVivoTemplate(v) : ''}

    <!-- Notas consultor -->
    <div class="notas-wrap">
      <div class="notas-label"><i data-lucide="pencil-line"></i> Notas del consultor (opcional)</div>
      <textarea class="notas-input" id="notas-consultor" placeholder="Observaciones privadas sobre esta variable...">${state.valores[`notas_${v.codigo}`] || ''}</textarea>
    </div>

    <!-- Navegación -->
    <div class="nav-btns">
      <button class="btn btn-secondary" id="btn-prev">
        <i data-lucide="arrow-left"></i> ${num === 1 ? 'Cancelar' : 'Anterior'}
      </button>
      <button class="btn btn-primary" id="btn-next">
        ${num === 8 ? 'Ver resultado' : 'Siguiente'} <i data-lucide="${num === 8 ? 'sparkles' : 'arrow-right'}"></i>
      </button>
    </div>
  `

  lucide.createIcons({ nodes: [el] })

  // Renderizar inputs según tipo
  const inputsEl = document.getElementById('inputs-variable')
  if (v.tipo === 'simple') renderInputsSimple(v, inputsEl)
  else if (v.tipo === 'compuesta') renderInputsCompuesta(v, inputsEl)
  else if (v.tipo === 'lista_componentes') renderInputsLista(v, inputsEl)
  else if (v.tipo === 'compuesta_condicional') renderInputsCCE(v, inputsEl)

  // Notas autosave
  document.getElementById('notas-consultor')?.addEventListener('input', (e) => {
    state.valores[`notas_${v.codigo}`] = e.target.value
    scheduleAutosave()
  })

  // Navegación
  document.getElementById('btn-prev')?.addEventListener('click', () => {
    if (num === 1) {
      mostrarPantalla('pantalla-0')
    } else {
      navegarAVariable(num - 1)
    }
  })

  document.getElementById('btn-next')?.addEventListener('click', () => {
    if (!validarVariable(v)) return
    calcularVariable(v)
    scheduleAutosave()
    if (num === 8) {
      completarDiagnostico()
    } else {
      navegarAVariable(num + 1)
    }
  })
}

function renderResultadoVivoTemplate(v) {
  return `
    <div class="resultado-vivo" id="resultado-vivo">
      <div class="resultado-vivo-label">Resultado calculado</div>
      <div class="resultado-vivo-formula">${v.formula_display}</div>
      <div class="resultado-vivo-valor nil" id="resultado-vivo-valor">—</div>
    </div>`
}

// ── INPUTS POR TIPO ───────────────────────────────────────────────────────────

function renderInputsSimple(v, el) {
  const comp = v.componentes[0]
  const val = state.valores[comp.codigo] ?? ''
  el.innerHTML = `
    <div class="componente-wrap">
      <div class="componente-label">${comp.label}</div>
      <div class="componente-ayuda">${comp.ayuda}</div>
      <div class="input-prefix-wrap">
        <span class="input-prefix">$</span>
        <input type="number" class="componente-input" id="inp-${comp.codigo}"
          placeholder="0" min="0" value="${val}" inputmode="decimal">
      </div>
      ${comp.ejemplos ? renderEjemplos(comp.ejemplos) : ''}
    </div>`
  document.getElementById(`inp-${comp.codigo}`)?.addEventListener('input', (e) => {
    state.valores[comp.codigo] = parseFloat(e.target.value) || 0
    actualizarResultadoVivo(v)
    scheduleAutosave()
  })
}

function renderInputsCompuesta(v, el) {
  el.innerHTML = v.componentes.map(comp => {
    const val = state.valores[comp.codigo] ?? ''
    const isMoney = comp.tipo_input === 'moneda'
    const prefix = isMoney ? '<span class="input-prefix">$</span>' : ''
    const wrapClass = isMoney ? 'input-prefix-wrap' : ''
    const paddingStyle = isMoney ? '' : ''
    return `
      <div class="componente-wrap">
        <div class="componente-label">${comp.label}</div>
        <div class="componente-ayuda">${comp.ayuda}</div>
        <div class="${wrapClass}">
          ${prefix}
          <input type="number" class="componente-input" id="inp-${comp.codigo}"
            placeholder="0" min="0" value="${val}" inputmode="decimal">
        </div>
        ${comp.ejemplos ? renderEjemplos(comp.ejemplos) : ''}
      </div>`
  }).join('')
  v.componentes.forEach(comp => {
    document.getElementById(`inp-${comp.codigo}`)?.addEventListener('input', (e) => {
      state.valores[comp.codigo] = parseFloat(e.target.value) || 0
      actualizarResultadoVivo(v)
      scheduleAutosave()
    })
  })
}

function renderInputsLista(v, el) {
  const clave = v.codigo === 'gfm' ? 'gfm_items' : 'pt_items'
  if (!state.valores[clave]) {
    // Prellenar con sugeridos vacíos
    state.valores[clave] = v.componentes_sugeridos.map(s => ({ label: s.label, monto: '' }))
  }

  function renderLista() {
    const items = state.valores[clave]
    const total = sumarComponentes(items)
    el.innerHTML = `
      <div class="componente-wrap">
        <div class="componente-ayuda">${v.explicacion}</div>
        <div class="lista-componentes" id="lista-${v.codigo}">
          ${items.map((item, i) => `
            <div class="lista-fila" data-idx="${i}">
              <input type="text" placeholder="Concepto" value="${item.label || ''}"
                class="fila-label" data-idx="${i}">
              <div class="input-prefix-wrap" style="position:relative;">
                <span class="input-prefix">$</span>
                <input type="number" placeholder="0" value="${item.monto || ''}"
                  class="componente-input monto-input fila-monto" data-idx="${i}"
                  min="0" inputmode="decimal" style="padding-left:24px;">
              </div>
              <button class="btn-eliminar-fila" data-idx="${i}">
                <i data-lucide="x"></i>
              </button>
            </div>`).join('')}
        </div>
        <button class="btn-add-fila" id="btn-add-fila">
          <i data-lucide="plus"></i> Agregar concepto
        </button>
        <div class="resultado-vivo activo" style="margin-top:14px;">
          <div class="resultado-vivo-label">Total ${v.abreviacion}</div>
          <div class="resultado-vivo-formula">${v.formula_display}</div>
          <div class="resultado-vivo-valor" id="total-lista">${fmtMoneda(total)}</div>
        </div>
      </div>`

    lucide.createIcons({ nodes: [el] })

    // Eventos label
    el.querySelectorAll('.fila-label').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx)
        state.valores[clave][idx].label = e.target.value
        scheduleAutosave()
      })
    })
    // Eventos monto
    el.querySelectorAll('.fila-monto').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx)
        state.valores[clave][idx].monto = parseFloat(e.target.value) || ''
        const tot = sumarComponentes(state.valores[clave])
        state.valores[v.codigo] = tot
        const totEl = document.getElementById('total-lista')
        if (totEl) totEl.textContent = fmtMoneda(tot)
        scheduleAutosave()
      })
    })
    // Eliminar fila
    el.querySelectorAll('.btn-eliminar-fila').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx)
        state.valores[clave].splice(idx, 1)
        renderLista()
      })
    })
    // Agregar fila
    document.getElementById('btn-add-fila')?.addEventListener('click', () => {
      state.valores[clave].push({ label: '', monto: '' })
      renderLista()
      // Foco en el nuevo label
      const filas = el.querySelectorAll('.fila-label')
      filas[filas.length - 1]?.focus()
    })
  }

  renderLista()
}

function renderInputsCCE(v, el) {
  const tipoSeleccionado = state.valores['cce_tipo'] || null
  const optsHtml = v.pregunta_detonante.opciones.map(opt => `
    <label class="radio-opt ${tipoSeleccionado === opt.codigo ? 'selected' : ''}" data-codigo="${opt.codigo}">
      <input type="radio" name="cce-tipo" value="${opt.codigo}">
      <div class="radio-dot"></div>
      <span class="radio-opt-label">${opt.label}</span>
    </label>`).join('')

  el.innerHTML = `
    <div class="componente-wrap">
      <div class="pregunta-detonante">
        <p>${v.pregunta_detonante.pregunta}</p>
        <div class="radio-opts" id="radio-tipo-cce">${optsHtml}</div>
      </div>
      <div id="cce-componentes"></div>
    </div>`

  lucide.createIcons({ nodes: [el] })

  // Selección tipo
  el.querySelectorAll('.radio-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      el.querySelectorAll('.radio-opt').forEach(o => o.classList.remove('selected'))
      opt.classList.add('selected')
      state.valores['cce_tipo'] = opt.dataset.codigo
      renderCCEComponentes(v, document.getElementById('cce-componentes'))
      scheduleAutosave()
    })
  })

  if (tipoSeleccionado) {
    renderCCEComponentes(v, document.getElementById('cce-componentes'))
  }
}

function renderCCEComponentes(v, el) {
  const tipo = state.valores['cce_tipo']
  if (!el || !tipo) return

  const compsVisibles = v.componentes.filter(c => {
    if (!c.solo_si) return true
    return c.solo_si.includes(tipo)
  })

  el.innerHTML = compsVisibles.map(comp => {
    const val = state.valores[comp.codigo] ?? ''
    return `
      <div class="componente-wrap">
        <div class="componente-label">${comp.label}</div>
        <div class="componente-ayuda">${comp.ayuda}</div>
        <div class="input-suffix-wrap">
          <input type="number" class="componente-input" id="inp-${comp.codigo}"
            placeholder="0" min="0" value="${val}" inputmode="decimal">
          <span class="input-suffix">días</span>
        </div>
        ${comp.ayuda_calculo ? `<div style="font-size:11.5px;color:var(--text-4);margin-top:5px;font-style:italic;">${comp.ayuda_calculo}</div>` : ''}
        ${comp.ejemplos ? renderEjemplos(comp.ejemplos) : ''}
      </div>`
  }).join('')

  // Resultado en vivo para CCE
  el.innerHTML += `
    <div class="resultado-vivo" id="resultado-vivo">
      <div class="resultado-vivo-label">CCE calculado</div>
      <div class="resultado-vivo-formula">${v.formula_display}</div>
      <div class="resultado-vivo-valor nil" id="resultado-vivo-valor">—</div>
    </div>`

  compsVisibles.forEach(comp => {
    document.getElementById(`inp-${comp.codigo}`)?.addEventListener('input', (e) => {
      state.valores[comp.codigo] = parseFloat(e.target.value)
      actualizarResultadoVivo(v)
      scheduleAutosave()
    })
  })

  // Recalcular si ya hay valores
  actualizarResultadoVivo(v)
}

function renderEjemplos(ejemplos) {
  return `
    <div class="ejemplos-wrap">
      <div class="ejemplos-label">Ejemplos</div>
      ${ejemplos.map(e => `<div class="ejemplo-item">${e}</div>`).join('')}
    </div>`
}

// ── CÁLCULO EN VIVO ───────────────────────────────────────────────────────────
function actualizarResultadoVivo(v) {
  const el = document.getElementById('resultado-vivo-valor')
  if (!el) return

  let resultado = null

  if (v.codigo === 'mun') {
    resultado = calcularMUN(
      state.valores['mun_ingresos_mes'],
      state.valores['mun_utilidad_neta']
    )
    if (resultado != null) {
      el.className = 'resultado-vivo-valor'
      el.textContent = fmtPct(resultado)
    }
  } else if (v.codigo === 'cce') {
    const tipo = state.valores['cce_tipo']
    const inv = state.valores['cce_dias_inventario'] ?? 0
    const cobro = state.valores['cce_dias_cobro']
    const pago = state.valores['cce_dias_pago']
    if (cobro != null && pago != null && tipo) {
      resultado = calcularCCE(inv, cobro, pago, tipo)
      if (resultado != null) {
        el.className = 'resultado-vivo-valor'
        el.textContent = fmt(resultado, 0) + ' días'
      }
    }
  } else if (v.codigo === 'ci') {
    resultado = calcularCrecimiento(
      state.valores['ci_ingresos_anterior'],
      state.valores['ci_ingresos_actual']
    )
    if (resultado != null) {
      el.className = 'resultado-vivo-valor'
      el.textContent = fmtPct(resultado)
    }
  } else if (v.codigo === 'cc') {
    resultado = calcularCrecimiento(
      state.valores['cc_costos_anterior'],
      state.valores['cc_costos_actual']
    )
    if (resultado != null) {
      el.className = 'resultado-vivo-valor'
      el.textContent = fmtPct(resultado)
    }
  }

  if (resultado == null) {
    el.className = 'resultado-vivo-valor nil'
    el.textContent = '—'
  }
}

// ── CALCULAR VARIABLE (persistir en state.valores) ────────────────────────────
function calcularVariable(v) {
  if (v.codigo === 'mun') {
    state.valores.mun = calcularMUN(
      state.valores['mun_ingresos_mes'],
      state.valores['mun_utilidad_neta']
    )
  } else if (v.codigo === 'cce') {
    const tipo = state.valores['cce_tipo'] || 'servicios'
    const inv = state.valores['cce_dias_inventario'] ?? 0
    state.valores.cce = calcularCCE(inv, state.valores['cce_dias_cobro'], state.valores['cce_dias_pago'], tipo)
  } else if (v.codigo === 'gfm') {
    state.valores.gfm = sumarComponentes(state.valores['gfm_items'])
  } else if (v.codigo === 'pt') {
    state.valores.pt = sumarComponentes(state.valores['pt_items'])
  } else if (v.codigo === 'ci') {
    state.valores.ci = calcularCrecimiento(
      state.valores['ci_ingresos_anterior'],
      state.valores['ci_ingresos_actual']
    )
  } else if (v.codigo === 'cc') {
    state.valores.cc = calcularCrecimiento(
      state.valores['cc_costos_anterior'],
      state.valores['cc_costos_actual']
    )
  }
  // FCN e IM ya están directamente en state.valores
}

// ── VALIDACIÓN ────────────────────────────────────────────────────────────────
function validarVariable(v) {
  if (v.tipo === 'simple') {
    const val = state.valores[v.componentes[0].codigo]
    if (val == null || val === '' || isNaN(val)) {
      resaltarError(document.querySelector('.componente-input'))
      return false
    }
  } else if (v.tipo === 'compuesta') {
    for (const comp of v.componentes) {
      const val = state.valores[comp.codigo]
      if (val == null || val === '' || isNaN(val)) {
        resaltarError(document.getElementById(`inp-${comp.codigo}`))
        return false
      }
    }
  } else if (v.tipo === 'compuesta_condicional') {
    if (!state.valores['cce_tipo']) {
      alert('Selecciona el tipo de empresa.')
      return false
    }
    const tipo = state.valores['cce_tipo']
    const necesitaInv = tipo !== 'servicios'
    if (necesitaInv && (state.valores['cce_dias_inventario'] == null || isNaN(state.valores['cce_dias_inventario']))) {
      return false
    }
    if (state.valores['cce_dias_cobro'] == null || state.valores['cce_dias_pago'] == null) {
      return false
    }
  }
  // lista_componentes: siempre permitir avanzar (puede haber 0 items)
  return true
}

function resaltarError(inp) {
  if (!inp) return
  inp.style.borderColor = 'var(--red)'
  inp.focus()
  setTimeout(() => { inp.style.borderColor = '' }, 2000)
}

// ── AUTOSAVE ──────────────────────────────────────────────────────────────────
function scheduleAutosave() {
  clearTimeout(state.autosaveTimer)
  setSave('saving', 'Guardando...')
  state.autosaveTimer = setTimeout(autosave, 900)
}

async function autosave() {
  if (!state.diagnosticoId) {
    setSave('saved', 'Guardado')
    setTimeout(() => setSave('idle', ''), 2000)
    return
  }
  try {
    const { error } = await supabase
      .from('flujo_diagnosticos')
      .update({
        variables_snapshot: state.valores,
        variables_capturadas: state.paso,
        updated_at: new Date().toISOString()
      })
      .eq('id', state.diagnosticoId)

    // Si la tabla no tiene esas columnas (400) lo ignoramos silenciosamente
    if (error && error.code !== '42703' && error.details?.includes('400') === false) {
      console.warn('autosave warn:', error.message)
    }
  } catch (e) {
    // Autosave falla silenciosamente — los datos se guardan al completar
    console.warn('autosave silenciado:', e?.message)
  }
  setSave('saved', 'Guardado')
  setTimeout(() => setSave('idle', ''), 2000)
}

// ── COMPLETAR DIAGNÓSTICO ─────────────────────────────────────────────────────
async function completarDiagnostico() {
  setSave('saving', 'Calculando...')
  const btn = document.getElementById('btn-next')
  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2"></i> Calculando...' }

  try {
    // 1. Guardar snapshot final
    await autosave()

    // 2. Llamar RPC completar
    const { data, error } = await supabase.rpc('flujo_completar_diagnostico', {
      p_diagnostico_id: state.diagnosticoId
    })
    if (error) throw error

    state.diagnosticoData = data
    setSave('saved', 'Completado')

    renderResultado(data)
    mostrarPantalla('pantalla-resultado')
    $pr()?.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {
    console.error(e)
    setSave('error', 'Error')
    // Calcular localmente como fallback
    renderResultadoLocal()
    mostrarPantalla('pantalla-resultado')
  }
}

// ── RENDER RESULTADO (desde RPC o local) ──────────────────────────────────────
function renderResultado(data) {
  // Obtener índices calculados
  let indices, veredictoKey

  if (data && data.indices && typeof data.indices === 'object' && Object.keys(data.indices).length > 0) {
    indices = data.indices
    veredictoKey = data.veredicto
  } else {
    // Calcular local — usar variables_snapshot si viene del RPC, si no usar state.valores
    const src = (data && data.variables_snapshot) ? data.variables_snapshot : state.valores
    const d = {
      fcn: src.fcn, im: src.im, mun: src.mun, gfm: src.gfm,
      cce: src.cce, pt: src.pt, ci: src.ci, cc: src.cc
    }
    indices = calcularIndices(d)
    const evaluaciones = {
      iaf: evaluarIndice('iaf', indices.iaf),
      iafi: evaluarIndice('iafi', indices.iafi),
      ie: evaluarIndice('ie', indices.ie)
    }
    veredictoKey = data?.veredicto || determinarVeredictoLocal(evaluaciones)
  }

  const veredicto = VEREDICTOS[veredictoKey] || VEREDICTOS.estresado
  const el = $pr()
  if (!el) return

  el.innerHTML = `
    <div class="resultado-wrap">
      <!-- VEREDICTO GLOBAL -->
      ${renderVeredictoGlobal(veredicto)}

      <!-- 3 ÍNDICES -->
      <div class="indices-section">
        <h3>Los 3 Índices Financieros</h3>
        <div class="indices-grid">
          ${renderIndiceCard('iaf', indices.iaf)}
          ${renderIndiceCard('iafi', indices.iafi)}
          ${renderIndiceCard('ie', indices.ie)}
        </div>
      </div>

      <!-- 3 MATRICES -->
      <div class="matrices-section">
        <h3>Las 3 Matrices Diagnósticas</h3>
        <div class="matrices-grid">
          ${renderMatrizCard('matriz1', indices)}
          ${renderMatrizCard('matriz2', indices)}
          ${renderMatrizCard('matriz3', indices)}
        </div>
      </div>

      <!-- AGENDA -->
      <div class="agenda-section">
        <h3>Agenda de Acción</h3>
        ${renderAgendaCards(veredictoKey)}
      </div>

      <!-- ACCIONES FINALES -->
      <div class="resultado-actions">
        <button class="btn btn-secondary" id="btn-nuevo-desde-resultado">
          <i data-lucide="plus"></i> Nuevo diagnóstico
        </button>
        <a href="/portal/flujo.html" class="btn btn-secondary">
          <i data-lucide="arrow-left"></i> Volver al Hub
        </a>
      </div>
    </div>
  `

  lucide.createIcons({ nodes: [el] })
  document.getElementById('btn-nuevo-desde-resultado')?.addEventListener('click', () => {
    mostrarPantalla('pantalla-0')
    renderBienvenida(null)
    state.diagnosticoId = null
    state.valores = {}
    state.paso = 0
  })

  mostrarPantalla('pantalla-resultado')
  $pr()?.scrollTo({ top: 0, behavior: 'smooth' })
}

function renderResultadoLocal() {
  const d = {
    fcn: state.valores.fcn, im: state.valores.im,
    mun: state.valores.mun, gfm: state.valores.gfm,
    cce: state.valores.cce, pt: state.valores.pt,
    ci: state.valores.ci, cc: state.valores.cc
  }
  const indices = calcularIndices(d)
  const ev = {
    iaf: evaluarIndice('iaf', indices.iaf),
    iafi: evaluarIndice('iafi', indices.iafi),
    ie: evaluarIndice('ie', indices.ie)
  }
  const veredictoKey = determinarVeredictoLocal(ev)
  renderResultado({ indices, veredicto: veredictoKey })
}

function determinarVeredictoLocal(ev) {
  const colores = Object.values(ev).filter(Boolean).map(e => e.color)
  if (colores.some(c => c === 'rojo')) return 'en_coma'
  if (colores.some(c => c === 'ambar')) return 'estresado'
  return 'sano'
}

// ── RENDERS PARCIALES ─────────────────────────────────────────────────────────

function renderVeredictoGlobal(veredicto) {
  return `
    <div class="veredicto-global ${veredicto.color}">
      <div class="veredicto-global-icon">
        <i data-lucide="${veredicto.icono}"></i>
      </div>
      <div class="veredicto-global-body">
        <h2>${veredicto.titulo}</h2>
        <p>${veredicto.descripcion}</p>
        <div class="veredicto-siguiente">
          <strong>Siguiente paso:</strong> ${veredicto.siguiente_paso}
        </div>
      </div>
    </div>`
}

function renderIndiceCard(codigo, valor) {
  const meta = UMBRALES_INDICES[codigo]
  const ev = evaluarIndice(codigo, valor)
  const color = ev ? ev.color : 'nil'
  const label = ev ? ev.label : '—'
  const interp = ev ? ev.interpretacion : 'No se pudo calcular con los datos disponibles.'

  let valorStr = '—'
  if (valor != null && !isNaN(valor)) {
    if (codigo === 'iaf') valorStr = fmt(valor, 2)
    else if (codigo === 'iafi') valorStr = fmt(valor, 1) + ' días'
    else if (codigo === 'ie') valorStr = fmt(valor, 2) + 'x'
  }

  return `
    <div class="indice-card">
      <div class="indice-apodo">${meta.apodo}</div>
      <div class="indice-nombre">${meta.nombre}</div>
      <div class="indice-valor ${color}">${valorStr}</div>
      ${color !== 'nil' ? `<span class="indice-label ${color}">${label}</span>` : ''}
      <div class="indice-formula">${meta.formula_display}</div>
      <div class="indice-interpretacion">${interp}</div>
    </div>`
}

function renderMatrizCard(clave, indices) {
  const m = MATRICES[clave]

  // Determinar cuadrante activo
  let cuadranteKey = null
  if (clave === 'matriz1') {
    const fcn = state.valores.fcn || 0
    const gfm = state.valores.gfm || 0
    const mun = state.valores.mun || 0
    const altaLiquidez = gfm > 0 ? (fcn / gfm) >= 1 : false
    const altoMargen = mun >= 15
    if (altaLiquidez && altoMargen) cuadranteKey = 'sano'
    else if (!altaLiquidez && altoMargen) cuadranteKey = 'liquidez'
    else if (altaLiquidez && !altoMargen) cuadranteKey = 'riesgo'
    else cuadranteKey = 'crisis'
  } else if (clave === 'matriz2') {
    const cce = state.valores.cce ?? 30
    const pt = state.valores.pt || 0
    const im = state.valores.im || 1
    const endeudamiento = pt / im
    const altaDeuda = endeudamiento >= 6  // 6+ meses de ingresos en deuda
    const lentoConv = cce >= 45
    if (!lentoConv && !altaDeuda) cuadranteKey = 'crecimiento_saludable'
    else if (!lentoConv && altaDeuda) cuadranteKey = 'riesgo_financiero'
    else if (lentoConv && !altaDeuda) cuadranteKey = 'riesgo_liquidez'
    else cuadranteKey = 'peligro_colapso'
  } else if (clave === 'matriz3') {
    const ci = state.valores.ci ?? 0
    const cc = state.valores.cc ?? 0
    const altoCI = ci >= 10
    const altoCC = cc >= 10
    if (altoCI && !altoCC) cuadranteKey = 'escalabilidad_positiva'
    else if (altoCI && altoCC) cuadranteKey = 'crecimiento_deficiente'
    else if (!altoCI && !altoCC) cuadranteKey = 'crecimiento_insostenible'
    else cuadranteKey = 'recesion'
  }

  const cuadranteActivo = cuadranteKey ? m.cuadrantes[cuadranteKey] : null

  // SVG del cuadrante
  const svgHtml = renderCuadranteSVG(clave, cuadranteKey)

  return `
    <div class="matriz-card">
      <div class="matriz-titulo">${m.nombre}</div>
      <div class="matriz-apodo">${m.apodo}</div>
      ${svgHtml}
      ${cuadranteActivo ? `
        <div class="matriz-cuadrante-nombre ${cuadranteActivo.color}">${cuadranteActivo.nombre}</div>
        <div class="matriz-cuadrante-desc">${cuadranteActivo.descripcion}</div>
        <div class="matriz-cuadrante-accion">▶ ${cuadranteActivo.accion}</div>
      ` : '<div style="font-size:12px;color:var(--text-4)">No hay suficientes datos para posicionar en la matriz.</div>'}
    </div>`
}

function renderCuadranteSVG(clave, cuadranteKey) {
  const cuadrantePosicion = {
    sano: 'TR', liquidez: 'TL', riesgo: 'BR', crisis: 'BL',
    crecimiento_saludable: 'TR', riesgo_financiero: 'BR', riesgo_liquidez: 'TL', peligro_colapso: 'BL',
    escalabilidad_positiva: 'TR', crecimiento_deficiente: 'BR', crecimiento_insostenible: 'TL', recesion: 'BL'
  }
  const cuadranteColorVar = {
    sano: 'green', liquidez: 'amber', riesgo: 'amber', crisis: 'red',
    crecimiento_saludable: 'green', riesgo_financiero: 'amber', riesgo_liquidez: 'amber', peligro_colapso: 'red',
    escalabilidad_positiva: 'green', crecimiento_deficiente: 'amber', crecimiento_insostenible: 'amber', recesion: 'red'
  }

  const pos = cuadrantePosicion[cuadranteKey]
  const colorName = cuadranteColorVar[cuadranteKey] || 'amber'
  const m = MATRICES[clave]

  // Cada celda: TL TR / BL BR
  const celdas = ['TL', 'TR', 'BL', 'BR']
  const celdasHtml = celdas.map(c => {
    const esActivo = c === pos && cuadranteKey
    const dot = esActivo ? `<div class="mq-dot mq-dot-${colorName}"></div>` : ''
    return `<div class="mq-cell ${esActivo ? `mq-cell-${colorName}` : ''}">  ${dot}</div>`
  }).join('')

  return `
    <div class="mq-wrap">
      <div class="mq-eje-y">${m.eje_y.label} ↑</div>
      <div class="mq-grid">${celdasHtml}</div>
      <div class="mq-eje-x">${m.eje_x.label} →</div>
    </div>`
}

function renderAgendaCards(veredictoKey) {
  const agenda = AGENDAS_DIAGNOSTICO[veredictoKey] || AGENDAS_DIAGNOSTICO.estresado
  const horizontes = [
    { key: '7_dias', label: '7 días', color: 'var(--red)', bg: 'var(--red-light)' },
    { key: '30_dias', label: '30 días', color: 'var(--amber)', bg: 'var(--amber-light)' },
    { key: '90_dias', label: '90 días', color: 'var(--green)', bg: 'var(--green-light)' }
  ]
  return `
    <div class="agenda-grid">
      ${horizontes.map(h => `
        <div class="agenda-card">
          <div class="agenda-card-top">
            <span class="agenda-horizonte-badge" style="background:${h.bg};color:${h.color}">
              <i data-lucide="clock" style="width:11px;height:11px;"></i> ${h.label}
            </span>
            <label class="agenda-check-wrap">
              <input type="checkbox" id="chk-${h.key}">
              <div class="agenda-check-box"></div>
            </label>
          </div>
          <div class="agenda-card-body">
            <div class="agenda-contenido" id="agenda-txt-${h.key}">${agenda[h.key] || '—'}</div>
          </div>
        </div>`).join('')}
    </div>`
}

// Checkboxes tachado
document.addEventListener('change', (e) => {
  if (e.target?.type === 'checkbox' && e.target.id?.startsWith('chk-')) {
    const key = e.target.id.replace('chk-', '')
    const txt = document.getElementById(`agenda-txt-${key}`)
    if (txt) txt.classList.toggle('tachado', e.target.checked)
  }
})

// ── ARRANCAR ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init)
