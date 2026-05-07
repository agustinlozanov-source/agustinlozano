// ============================================================================
// SCALEx PORTAL — OPSP JS
// ============================================================================
// Carga el OPSP de la org del usuario, popula los inputs, y guarda cambios
// automáticamente con debounce.
// ============================================================================

import {
  supabase,
  getMyProfile,
  getMyOrganization,
  signOut
} from './supabase-client.js'

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => Array.from(document.querySelectorAll(sel))

const initials = (name) => {
  if (!name) return '··'
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase()
}

const debounce = (fn, ms = 1200) => {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

const fmtRelative = (date) => {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 5) return 'hace un momento'
  if (diff < 60) return `hace ${diff}s`
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  return date.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

// ────────────────────────────────────────────────────────────────────────────
// Estado global
// ────────────────────────────────────────────────────────────────────────────
let state = {
  org: null,
  profile: null,
  opspId: null,
  estrategia: {},
  anual: {},
  trimestral: {},
  lastSaved: null,
  isSaving: false
}

// ────────────────────────────────────────────────────────────────────────────
// Save indicator
// ────────────────────────────────────────────────────────────────────────────
function setSaveStatus(status, message) {
  const indicator = $('#save-indicator')
  const text = $('#save-text')
  if (!indicator || !text) return

  indicator.classList.remove('saving', 'saved', 'error')
  if (status) indicator.classList.add(status)
  text.textContent = message
}

// Cada 30s actualizar el "hace X" si está saved
setInterval(() => {
  if (state.lastSaved && !state.isSaving) {
    setSaveStatus('saved', `Guardado ${fmtRelative(state.lastSaved)}`)
  }
}, 30000)

// ────────────────────────────────────────────────────────────────────────────
// Cargar OPSP del usuario actual
// ────────────────────────────────────────────────────────────────────────────
async function loadOPSP(orgId) {
  const { data, error } = await supabase
    .from('opsp')
    .select('*')
    .eq('organizacion_id', orgId)
    .maybeSingle()

  if (error) {
    console.error('[opsp] loadOPSP error:', error)
    return null
  }

  // Si no existe, crear uno vacío
  if (!data) {
    const { data: newOpsp, error: e2 } = await supabase
      .from('opsp')
      .insert({ organizacion_id: orgId })
      .select('*')
      .single()
    if (e2) {
      console.error('[opsp] create error:', e2)
      return null
    }
    return newOpsp
  }

  return data
}

// ────────────────────────────────────────────────────────────────────────────
// Poblar el DOM con los datos del OPSP
// ────────────────────────────────────────────────────────────────────────────
function populateInputs() {
  const e = state.estrategia
  const a = state.anual
  const t = state.trimestral

  // ─── ESTRATEGIA ───
  setVal('proposito_evolutivo', e.proposito_evolutivo)

  // Factores ADN — 4 columnas con 2 inputs cada una
  const adn = e.factores_adn || {}
  setVal('adn_cultura_1',   adn.cultura?.[0])
  setVal('adn_cultura_2',   adn.cultura?.[1])
  setVal('adn_marketing_1', adn.marketing?.[0])
  setVal('adn_marketing_2', adn.marketing?.[1])
  setVal('adn_legal_1',     adn.legal?.[0])
  setVal('adn_legal_2',     adn.legal?.[1])
  setVal('adn_capital_1',   adn.capital?.[0])
  setVal('adn_capital_2',   adn.capital?.[1])

  setVal('vector_audaz', e.vector_audaz)

  // Vector 3-5
  const v35 = e.vector_3a5 || {}
  setVal('v35_ano',        v35.ano_meta)
  setVal('v35_ingresos',   v35.ingresos)
  setVal('v35_ganancias',  v35.ganancias)
  setVal('v35_efectivo',   v35.efectivo)
  setVal('v35_ecosistema', v35.ecosistema)

  // Acciones 3-5 (5 inputs)
  const acc35 = e.acciones_3a5 || []
  for (let i = 0; i < 5; i++) setVal(`acc35_${i+1}`, acc35[i])

  setVal('factor_x',      e.factor_x)
  setVal('promesa_marca', e.promesa_marca)

  // ─── ANUAL ───
  setVal('a_ano',               a.ano)
  setVal('a_ingresos',          a.ingresos)
  setVal('a_margen',            a.margen_bruto)
  setVal('a_efectivo',          a.efectivo)
  setVal('a_dias_cxc',          a.dias_cxc)
  setVal('a_dias_inventario',   a.dias_inventario)
  setVal('a_ingresos_empleado', a.ingresos_empleado)

  const accAnu = a.acciones_anuales || []
  for (let i = 0; i < 5; i++) setVal(`accA_${i+1}`, accAnu[i])

  // Factores Procesos — 3 columnas
  const fp = a.factores_procesos || {}
  setVal('fp_talento_1',        fp.talento?.[0])
  setVal('fp_talento_2',        fp.talento?.[1])
  setVal('fp_proceso_1',        fp.proceso?.[0])
  setVal('fp_proceso_2',        fp.proceso?.[1])
  setVal('fp_reconocimiento_1', fp.reconocimiento?.[0])
  setVal('fp_reconocimiento_2', fp.reconocimiento?.[1])

  // KPIs anuales (3 KPIs con verde/ámbar/rojo)
  const kpis = a.kpis_anuales || []
  for (let i = 0; i < 3; i++) {
    const k = kpis[i] || {}
    setVal(`kpiA_${i+1}_nombre`, k.nombre)
    setVal(`kpiA_${i+1}_verde`,  k.verde)
    setVal(`kpiA_${i+1}_ambar`,  k.ambar)
    setVal(`kpiA_${i+1}_rojo`,   k.rojo)
  }

  // ─── TRIMESTRAL ───
  setVal('t_trimestre',          t.trimestre)
  setVal('t_ano',                t.ano)
  setVal('t_fecha_limite',       t.fecha_limite)
  setVal('t_ingresos',           t.ingresos_q)
  setVal('t_margen',             t.margen_bruto_q)
  setVal('t_efectivo',           t.efectivo_q)
  setVal('t_ingresos_empleado',  t.ingresos_empleado_q)

  const tema = t.tema || {}
  setVal('t_tema_nombre',     tema.nombre)
  setVal('t_tema_objetivo',   tema.objetivo_critico)
  setVal('t_tema_scoreboard', tema.scoreboard)

  // Rocas tácticas (5 con responsable)
  const rocas = t.rocas_tacticas || []
  for (let i = 0; i < 5; i++) {
    const r = rocas[i] || {}
    setVal(`rocaT_${i+1}_prio`, r.prioridad)
    setVal(`rocaT_${i+1}_resp`, r.responsable)
  }

  // Rituales de responsabilidad (5 con plazo)
  const rits = t.rituales_responsabilidad || []
  for (let i = 0; i < 5; i++) {
    const ri = rits[i] || {}
    setVal(`ritR_${i+1}_kpi`,   ri.kpi)
    setVal(`ritR_${i+1}_plazo`, ri.plazo)
  }

  setVal('t_celebracion', t.celebracion)
  setVal('t_recompensa',  t.recompensa)
}

function setVal(id, value) {
  const el = document.getElementById(id)
  if (!el) return
  el.value = value ?? ''
}

function getVal(id) {
  const el = document.getElementById(id)
  return el ? el.value : ''
}

// ────────────────────────────────────────────────────────────────────────────
// Recolectar valores actuales del DOM y armar los 3 JSONB
// ────────────────────────────────────────────────────────────────────────────
function collectEstrategia() {
  return {
    proposito_evolutivo: getVal('proposito_evolutivo'),
    factores_adn: {
      cultura:   [getVal('adn_cultura_1'),   getVal('adn_cultura_2')],
      marketing: [getVal('adn_marketing_1'), getVal('adn_marketing_2')],
      legal:     [getVal('adn_legal_1'),     getVal('adn_legal_2')],
      capital:   [getVal('adn_capital_1'),   getVal('adn_capital_2')]
    },
    vector_audaz: getVal('vector_audaz'),
    vector_3a5: {
      ano_meta:   parseInt(getVal('v35_ano')) || null,
      ingresos:   getVal('v35_ingresos'),
      ganancias:  getVal('v35_ganancias'),
      efectivo:   getVal('v35_efectivo'),
      ecosistema: getVal('v35_ecosistema')
    },
    acciones_3a5: [1,2,3,4,5].map(i => getVal(`acc35_${i}`)),
    acciones_proposito: state.estrategia.acciones_proposito || ['','','','',''],
    factor_x:      getVal('factor_x'),
    promesa_marca: getVal('promesa_marca')
  }
}

function collectAnual() {
  return {
    ano:               parseInt(getVal('a_ano')) || null,
    ingresos:          getVal('a_ingresos'),
    margen_bruto:      getVal('a_margen'),
    efectivo:          getVal('a_efectivo'),
    dias_cxc:          getVal('a_dias_cxc'),
    dias_inventario:   getVal('a_dias_inventario'),
    ingresos_empleado: getVal('a_ingresos_empleado'),
    acciones_anuales: [1,2,3,4,5].map(i => getVal(`accA_${i}`)),
    factores_procesos: {
      talento:        [getVal('fp_talento_1'),        getVal('fp_talento_2')],
      proceso:        [getVal('fp_proceso_1'),        getVal('fp_proceso_2')],
      reconocimiento: [getVal('fp_reconocimiento_1'), getVal('fp_reconocimiento_2')]
    },
    kpis_anuales: [1,2,3].map(i => ({
      nombre: getVal(`kpiA_${i}_nombre`),
      verde:  getVal(`kpiA_${i}_verde`),
      ambar:  getVal(`kpiA_${i}_ambar`),
      rojo:   getVal(`kpiA_${i}_rojo`)
    }))
  }
}

function collectTrimestral() {
  return {
    trimestre:           getVal('t_trimestre') || 'Q1',
    ano:                 parseInt(getVal('t_ano')) || null,
    fecha_limite:        getVal('t_fecha_limite'),
    ingresos_q:          getVal('t_ingresos'),
    margen_bruto_q:      getVal('t_margen'),
    efectivo_q:          getVal('t_efectivo'),
    ingresos_empleado_q: getVal('t_ingresos_empleado'),
    tema: {
      nombre:           getVal('t_tema_nombre'),
      objetivo_critico: getVal('t_tema_objetivo'),
      scoreboard:       getVal('t_tema_scoreboard')
    },
    rocas_tacticas: [1,2,3,4,5].map(i => ({
      prioridad:   getVal(`rocaT_${i}_prio`),
      responsable: getVal(`rocaT_${i}_resp`)
    })),
    rituales_responsabilidad: [1,2,3,4,5].map(i => ({
      kpi:   getVal(`ritR_${i}_kpi`),
      plazo: getVal(`ritR_${i}_plazo`)
    })),
    celebracion: getVal('t_celebracion'),
    recompensa:  getVal('t_recompensa')
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Auto-save (con debounce)
// ────────────────────────────────────────────────────────────────────────────
async function saveOPSP() {
  if (!state.opspId) return

  state.isSaving = true
  setSaveStatus('saving', 'Guardando...')

  // Recolectar 3 zonas
  const estrategia = collectEstrategia()
  const anual      = collectAnual()
  const trimestral = collectTrimestral()

  // Update con los 3 JSONB en una sola query
  const { error } = await supabase
    .from('opsp')
    .update({
      estrategia,
      anual,
      trimestral,
      ultima_edicion_por: state.profile?.id
    })
    .eq('id', state.opspId)

  state.isSaving = false

  if (error) {
    console.error('[opsp] save error:', error)
    setSaveStatus('error', 'Error al guardar — reintentando...')
    setTimeout(() => saveOPSP(), 3000)
    return
  }

  // Update local state
  state.estrategia = estrategia
  state.anual = anual
  state.trimestral = trimestral
  state.lastSaved = new Date()

  setSaveStatus('saved', `Guardado ${fmtRelative(state.lastSaved)}`)
}

const debouncedSave = debounce(saveOPSP, 1200)

// ────────────────────────────────────────────────────────────────────────────
// Setup auto-save listeners
// ────────────────────────────────────────────────────────────────────────────
function setupAutoSave() {
  document.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', () => {
      setSaveStatus('saving', 'Editando...')
      debouncedSave()
    })
  })
}

// ────────────────────────────────────────────────────────────────────────────
// Render header
// ────────────────────────────────────────────────────────────────────────────
function renderHeader() {
  const empresa = state.org?.nombre || '—'
  const titleEl = $('#topbar-title')
  if (titleEl) titleEl.textContent = `OPSP — ${empresa}`

  const avatar = initials(`${state.profile?.nombre || ''} ${state.profile?.apellido || ''}`)
  $$('.user-avatar').forEach(el => el.textContent = avatar)
}

// ────────────────────────────────────────────────────────────────────────────
// Vista Completa (modal con datos en vivo)
// ────────────────────────────────────────────────────────────────────────────
window.openFullView = function() {
  const e = collectEstrategia()
  const a = collectAnual()
  const t = collectTrimestral()

  const empresa = state.org?.nombre || '—'
  const trimestre = t.trimestre || 'Q1'
  const ano = t.ano || new Date().getFullYear()

  $('#full-body').innerHTML = `
    <div class="opsp-full">
      <div class="opsp-full-header">
        <div class="opsp-full-empresa">${empresa}</div>
        <div class="opsp-full-doc">One Page Strategic Plan · OPSP · ${trimestre} ${ano}</div>
      </div>

      <div class="opsp-full-section">
        <div class="opsp-full-section-title">🌟 Propósito · Vector Audaz · Vectores</div>
        <div class="opsp-full-row">
          <div class="opsp-full-cell">
            <div class="opsp-full-cell-label">Propósito Evolutivo</div>
            <div>${escapeHtml(e.proposito_evolutivo) || '—'}</div>
          </div>
          <div class="opsp-full-cell">
            <div class="opsp-full-cell-label">Vector Audaz</div>
            <div>${escapeHtml(e.vector_audaz) || '—'}</div>
          </div>
          <div class="opsp-full-cell">
            <div class="opsp-full-cell-label">Vector 3-5 años</div>
            <div class="opsp-full-cell-value">${e.vector_3a5.ano_meta || '—'} · ${escapeHtml(e.vector_3a5.ingresos) || '—'} ingresos · ${escapeHtml(e.vector_3a5.ganancias) || '—'} ganancias</div>
          </div>
          <div class="opsp-full-cell">
            <div class="opsp-full-cell-label">Vector Anual</div>
            <div class="opsp-full-cell-value">${a.ano || '—'} · ${escapeHtml(a.ingresos) || '—'} · ${escapeHtml(a.margen_bruto) || '—'} margen</div>
          </div>
        </div>
      </div>

      <div class="opsp-full-section">
        <div class="opsp-full-section-title">🧬 Factores ADN · 4 categorías</div>
        <div class="opsp-full-row">
          ${['cultura','marketing','legal','capital'].map(cat => `
            <div class="opsp-full-cell">
              <div class="opsp-full-cell-label">${cat.charAt(0).toUpperCase() + cat.slice(1)}</div>
              <ol class="opsp-full-list">
                ${(e.factores_adn[cat] || []).filter(Boolean).map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li style="opacity:0.5;">Sin definir</li>'}
              </ol>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="opsp-full-section">
        <div class="opsp-full-section-title">⚡ Acciones · Trimestre · Rituales</div>
        <div class="opsp-full-row">
          <div class="opsp-full-cell">
            <div class="opsp-full-cell-label">Acciones Vector 3-5</div>
            <ol class="opsp-full-list">
              ${e.acciones_3a5.filter(Boolean).map(s => `<li>${escapeHtml(s)}</li>`).join('') || '<li style="opacity:0.5;">Sin definir</li>'}
            </ol>
          </div>
          <div class="opsp-full-cell">
            <div class="opsp-full-cell-label">Acciones Anuales</div>
            <ol class="opsp-full-list">
              ${a.acciones_anuales.filter(Boolean).map(s => `<li>${escapeHtml(s)}</li>`).join('') || '<li style="opacity:0.5;">Sin definir</li>'}
            </ol>
          </div>
          <div class="opsp-full-cell">
            <div class="opsp-full-cell-label">Rocas Tácticas ${trimestre}</div>
            <ol class="opsp-full-list">
              ${t.rocas_tacticas.filter(r => r.prioridad).map(r =>
                `<li>${escapeHtml(r.prioridad)}${r.responsable ? ` <span style="opacity:0.6">→ ${escapeHtml(r.responsable)}</span>` : ''}</li>`
              ).join('') || '<li style="opacity:0.5;">Sin definir</li>'}
            </ol>
          </div>
          <div class="opsp-full-cell">
            <div class="opsp-full-cell-label">Rituales de Responsabilidad</div>
            <ol class="opsp-full-list">
              ${t.rituales_responsabilidad.filter(r => r.kpi).map(r =>
                `<li>${escapeHtml(r.kpi)}${r.plazo ? ` <span style="opacity:0.6">(${escapeHtml(r.plazo)})</span>` : ''}</li>`
              ).join('') || '<li style="opacity:0.5;">Sin definir</li>'}
            </ol>
          </div>
        </div>
      </div>

      <div class="opsp-full-section">
        <div class="opsp-full-section-title">🔥 ${trimestre} ${ano} · Tema · Promesa · Factor X</div>
        <div class="opsp-full-row">
          <div class="opsp-full-cell">
            <div class="opsp-full-cell-label">Tema del Trimestre</div>
            <div class="opsp-full-cell-value">${escapeHtml(t.tema.nombre) || '—'}</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:4px">Hasta ${escapeHtml(t.fecha_limite) || '—'}</div>
          </div>
          <div class="opsp-full-cell">
            <div class="opsp-full-cell-label">Promesa de Marca</div>
            <div>${escapeHtml(e.promesa_marca) || '—'}</div>
          </div>
          <div class="opsp-full-cell">
            <div class="opsp-full-cell-label">Factor X</div>
            <div class="opsp-full-cell-value">${escapeHtml(e.factor_x) || '—'}</div>
          </div>
          <div class="opsp-full-cell">
            <div class="opsp-full-cell-label">Celebración + Recompensa</div>
            <div>${escapeHtml(t.celebracion) || '—'} · ${escapeHtml(t.recompensa) || '—'}</div>
          </div>
        </div>
      </div>
    </div>
  `

  $('#full-modal').classList.add('open')
}

window.closeFullView = function() {
  $('#full-modal').classList.remove('open')
}

function escapeHtml(s) {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ESC para cerrar modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeFullView()
})

// ────────────────────────────────────────────────────────────────────────────
// Tabs
// ────────────────────────────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'))
      tab.classList.add('active')
      document.getElementById('pane-' + tab.dataset.tab).classList.add('active')
    })
  })
}

// ────────────────────────────────────────────────────────────────────────────
// Guía Divertida (panel lateral)
// ────────────────────────────────────────────────────────────────────────────
const GUIDES = {
  'proposito': {
    eyebrow: 'Estrategia',
    title: 'Propósito Evolutivo',
    text: '¿Por qué existe tu empresa más allá de ganar dinero? Imagina que eres un superhéroe: ¿cuál es tu verdadera misión en el mundo?',
    tip: 'Si tu propósito no emociona ni a tu equipo ni a ti, vuelve a escribirlo. Un buen propósito te da escalofríos al leerlo en voz alta.'
  },
  'adn': {
    eyebrow: 'Estrategia',
    title: 'Factores ADN (Propulsión)',
    text: 'Estos son los 8 elementos que TIENEN que estar bien para que tu empresa pueda escalar. Cuatro categorías (Cultura, Marketing, Legal, Capital) y dos prioridades por cada una. Si uno cojea, todo cojea.',
    tip: 'Piensa en cada celda como un cimiento. Si tienes uno débil, el edificio entero se tambalea cuando crezcas.'
  },
  'vector-audaz': {
    eyebrow: 'Estrategia',
    title: 'Vector Audaz (BHAG®)',
    text: 'Tu Big Hairy Audacious Goal. Es ese objetivo tan grande que da miedo... pero también emoción. Como decir que vas a llegar a Marte con una bicicleta eléctrica. ¿Qué sueño te mantiene despierto por las noches (de emoción, no de estrés)?',
    tip: 'Un buen BHAG combina números específicos + horizonte de 10-25 años + algo que parece imposible hoy.'
  },
  'vector-3a5': {
    eyebrow: 'Estrategia',
    title: 'Vector a 3-5 años',
    text: '¿Dónde quieres estar en 3 a 5 años si todo sale bien? Aquí te pones ambicioso sin caer en la fantasía. Es tu mapa del tesoro: ingresos, ganancias, efectivo y el ecosistema en el que viven tus números.',
    tip: 'Si tus números a 3-5 años son los mismos que los de este año pero "un poquito más", no es un Vector. Es una proyección floja.'
  },
  'acciones-3a5': {
    eyebrow: 'Estrategia',
    title: 'Impulsos Estratégicos',
    text: 'Los grandes movimientos que te acercan a tu meta audaz. Como en el ajedrez, son las piezas clave que mueves para ganar la partida. Solo 5: si pones más, dejan de ser estratégicas.',
    tip: 'Cada impulso debe poder defenderse con esta pregunta: "Si NO hago esto en 3-5 años, ¿igual llego al BHAG?". Si la respuesta es sí, no es estratégico.'
  },
  'factor-x': {
    eyebrow: 'Estrategia',
    title: 'Factor X (Profit per X)',
    text: '¿Cuál es tu unidad mágica de eficiencia? Es como preguntarse: ¿por cada X (cliente, proyecto, empleado, licencia), cuánta ganancia saco?',
    tip: 'No es ingreso por X, es UTILIDAD por X. La diferencia importa: una empresa puede facturar mucho y ganar poco.'
  },
  'promesa-marca': {
    eyebrow: 'Estrategia',
    title: 'Promesa de Marca',
    text: '¿Qué juramentos haces al cliente y tienes que cumplir sí o sí, o te cancelan como si fueras un mal reality show? Idealmente 2-3 promesas medibles, con plazos claros.',
    tip: 'Una buena promesa de marca tiene: número específico + plazo + consecuencia si no cumples. Sin las tres, es marketing.'
  },
  'vector-anual': {
    eyebrow: 'Año',
    title: 'Objetivos Anuales',
    text: 'Este año, ¿qué debes lograr sí o sí para que el brindis de diciembre no sea puro llanto y excusas? Tus números de aterrizaje: ingresos, margen, efectivo, días de CxC e inventario.',
    tip: 'Tus objetivos anuales deben ser un "puente lógico" entre donde estás hoy y tu Vector 3-5 años. Si no conectan, algo está mal.'
  },
  'acciones-anual': {
    eyebrow: 'Año',
    title: 'Acciones para el Año',
    text: 'Las 5 acciones que vas a ejecutar este año para acercarte al Vector 3-5. No son tareas operativas, son movimientos que cambian el juego.',
    tip: 'Si una de estas acciones podría hacerla cualquier empleado júnior, no es una acción anual. Es una tarea trimestral.'
  },
  'factores-procesos': {
    eyebrow: 'Año',
    title: 'Factores Procesos (Propulsión)',
    text: 'Si los Factores ADN son los cimientos de la empresa, estos son los engranajes que mueven la operación: Talento, Proceso y Reconocimiento. Sin estos, la estrategia se queda en PowerPoint.',
    tip: 'Talento = la gente correcta. Proceso = lo que hace todo medible. Reconocimiento = lo que mantiene la motivación. Los tres importan.'
  },
  'kpi-anual': {
    eyebrow: 'Año',
    title: 'Métricas Críticas + Semáforos',
    text: 'Son los numeritos que te dicen si vas por buen camino o directo al precipicio. No más de tres, ¡los más importantes! Cada uno con sus tres rangos: verde (todo bien), ámbar (atención), rojo (alarma).',
    tip: 'Los semáforos NO son metas. Son zonas. El verde es "saludable", no "ideal". Si tu rojo lo aceptas como normal, recalibra.'
  },
  'rocas-trimestre': {
    eyebrow: 'Trimestre',
    title: 'Metas Financieras Trimestrales',
    text: '¿Cuánto debes vender, ganar y ahorrar este trimestre para no terminar comiendo sopa instantánea? Son las "rocas grandes" del trimestre: ingresos, margen, efectivo, productividad por persona.',
    tip: 'Una buena regla: tus rocas trimestrales deben sumar el 25-30% de tu meta anual, no el 8% del primer trimestre y 50% del último.'
  },
  'tematica': {
    eyebrow: 'Trimestre',
    title: 'Tema Trimestral',
    text: 'Una temática divertida que une al equipo. Como darle nombre al trimestre: "Operación Impacto", "Modo Turbo", "ALL IN / CALL". Con premio incluido, claro. Esto NO es decoración: es lo que mantiene al equipo enfocado y motivado durante 90 días.',
    tip: 'El nombre debe ser memorable y la fecha límite específica. Si nadie en el equipo se acuerda del nombre del trimestre en la semana 6, fallaste.'
  },
  'rocas-tacticas': {
    eyebrow: 'Trimestre',
    title: 'Responsabilidad del Equipo',
    text: '¿Quién hace qué y para cuándo? Aquí no hay espacio para el "yo pensé que lo hacía otro". Cada roca táctica tiene UN responsable con nombre y apellido (no "marketing" o "el equipo").',
    tip: 'Si una persona aparece en más de 2 rocas, está sobrecargada. Si nadie aparece en una roca, no es responsabilidad de nadie y no se hará.'
  },
  'rituales-resp': {
    eyebrow: 'Trimestre',
    title: 'Rituales de tu Responsabilidad',
    text: 'Tus compromisos personales como dueño/líder. No son tareas operativas: son las disciplinas que TÚ vas a sostener para que la empresa pueda escalar. Cada uno con su KPI y su plazo (diario, mensual, trimestral, multi-anual).',
    tip: 'Estos rituales son innegociables. El día que digas "no tengo tiempo para mi ritual", ese día empieza la decadencia de tu empresa.'
  },
  'celebracion': {
    eyebrow: 'Trimestre',
    title: 'Celebración del Trimestre',
    text: '¿Cómo van a celebrar si logran las Rocas? El cómo importa: una pizza fría en la oficina NO es celebrar. Una experiencia compartida fuera del trabajo SÍ.',
    tip: 'La celebración debe ser proporcional al esfuerzo. Si las Rocas son ambiciosas, la celebración también.'
  },
  'recompensa': {
    eyebrow: 'Trimestre',
    title: 'Recompensa',
    text: 'A diferencia de la celebración (grupal), la recompensa puede ser individual o experiencial. Es ese "premio gordo" que motiva durante los 90 días.',
    tip: 'La mejor recompensa NO es dinero. Son experiencias memorables que construyen historia compartida con el equipo y la familia.'
  }
}

window.showGuide = function(key) {
  const guide = GUIDES[key]
  if (!guide) return

  if (window.innerWidth <= 1100) {
    $('#guide-panel').classList.add('open')
  }

  document.querySelectorAll('.section').forEach(s => s.classList.remove('focused'))
  const activeSection = document.querySelector(`.section[data-guide="${key}"]`)
  if (activeSection) {
    activeSection.classList.add('focused')
    activeSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  $('#guide-content').innerHTML = `
    <div class="guide-section-title">${guide.eyebrow}</div>
    <div class="guide-section-name">${guide.title}</div>
    <div class="guide-text">${guide.text}</div>
    <div class="guide-tip">
      <div class="guide-tip-title">💡 Tip</div>
      <div class="guide-tip-text">${guide.tip}</div>
    </div>
  `
}

window.toggleGuide = function() {
  $('#guide-panel').classList.toggle('open')
}

// ────────────────────────────────────────────────────────────────────────────
// Theme toggle
// ────────────────────────────────────────────────────────────────────────────
window.toggleTheme = function() {
  const html = document.documentElement
  const next = html.dataset.theme === 'dark' ? 'light' : 'dark'
  html.dataset.theme = next
  localStorage.setItem('scalex-theme', next)
  const icon = document.getElementById('theme-icon')
  if (icon) {
    icon.setAttribute('data-lucide', next === 'dark' ? 'sun' : 'moon')
    lucide.createIcons()
  }
}
const savedTheme = localStorage.getItem('scalex-theme')
if (savedTheme) document.documentElement.dataset.theme = savedTheme

window.logout = signOut

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────
async function init() {
  try {
    setSaveStatus('saving', 'Cargando...')

    const [profile, org] = await Promise.all([
      getMyProfile(),
      getMyOrganization()
    ])

    state.profile = profile
    state.org = org

    if (!org) {
      setSaveStatus('error', 'Sin organización')
      $('.tab-content').innerHTML = `
        <div style="text-align:center; padding:60px 20px;">
          <h2 style="font-family:'Plus Jakarta Sans',sans-serif; font-size:22px; margin-bottom:12px;">Sin organización asignada</h2>
          <p style="color:var(--text-3);">Contacta a Agustín.</p>
        </div>
      `
      return
    }

    renderHeader()

    // Cargar OPSP
    const opsp = await loadOPSP(org.id)
    if (!opsp) {
      setSaveStatus('error', 'Error cargando OPSP')
      return
    }

    state.opspId      = opsp.id
    state.estrategia  = opsp.estrategia  || {}
    state.anual       = opsp.anual       || {}
    state.trimestral  = opsp.trimestral  || {}
    state.lastSaved   = opsp.updated_at ? new Date(opsp.updated_at) : new Date()

    populateInputs()
    setupAutoSave()
    setupTabs()

    setSaveStatus('saved', `Guardado ${fmtRelative(state.lastSaved)}`)

    lucide.createIcons()

  } catch (err) {
    console.error('[opsp] init error:', err)
    setSaveStatus('error', 'Error al cargar')
  }
}

init()
