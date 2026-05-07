// ============================================================================
// SCALEx PORTAL — Dashboard JS
// ============================================================================
// Carga datos reales de Supabase y los inyecta en el dashboard.html.
// Usa el cliente compartido en /assets/js/supabase-client.js
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

const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d.getDate()} ${meses[d.getMonth()]}`
}

const fmtDateLong = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${dias[d.getDay()]} · ${d.getDate()} ${meses[d.getMonth()]}`
}

const fmtTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2,'0')
  const mm = String(d.getMinutes()).padStart(2,'0')
  return `${hh}:${mm}`
}

// ────────────────────────────────────────────────────────────────────────────
// Cargar OPSP de la organización activa
// ────────────────────────────────────────────────────────────────────────────
async function loadOPSP(orgId) {
  const { data, error } = await supabase
    .from('opsp')
    .select('*')
    .eq('organizacion_id', orgId)
    .single()

  if (error) {
    console.error('[dashboard] loadOPSP error:', error)
    return null
  }
  return data
}

// ────────────────────────────────────────────────────────────────────────────
// Cargar Contrato del Dueño
// ────────────────────────────────────────────────────────────────────────────
async function loadContrato(orgId) {
  const { data, error } = await supabase
    .from('contratos')
    .select('*')
    .eq('organizacion_id', orgId)
    .eq('tipo', 'dueno')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) console.error('[dashboard] loadContrato error:', error)
  return data
}

// ────────────────────────────────────────────────────────────────────────────
// Cargar Consejo + miembros + próxima sesión + pago pendiente
// ────────────────────────────────────────────────────────────────────────────
async function loadConsejo(orgId) {
  const { data: consejo, error: e1 } = await supabase
    .from('consejos')
    .select('*')
    .eq('organizacion_id', orgId)
    .maybeSingle()

  if (e1 || !consejo) return { consejo: null, miembros: [], proximaSesion: null, pagoPendiente: null }

  const [{ data: miembros }, { data: sesiones }, { data: pagos }] = await Promise.all([
    supabase.from('consejo_miembros').select('*').eq('consejo_id', consejo.id).eq('estado', 'activo'),
    supabase.from('consejo_sesiones').select('*').eq('consejo_id', consejo.id).eq('estado', 'programada').order('fecha_programada', { ascending: true }).limit(1),
    supabase.from('consejo_pagos').select('*').eq('consejo_id', consejo.id).eq('estado', 'pendiente').order('fecha_vencimiento', { ascending: true }).limit(1)
  ])

  return {
    consejo,
    miembros: miembros || [],
    proximaSesion: sesiones?.[0] || null,
    pagoPendiente: pagos?.[0] || null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Calcular progreso del OPSP (qué tan completo está)
// ────────────────────────────────────────────────────────────────────────────
function calcOPSPProgress(opsp) {
  if (!opsp) return { total: 0, estrategia: 0, anual: 0, trimestral: 0 }

  const e = opsp.estrategia || {}
  const a = opsp.anual || {}
  const t = opsp.trimestral || {}

  const isFilled = (v) => {
    if (v === null || v === undefined) return false
    if (typeof v === 'string') return v.trim().length > 0
    if (typeof v === 'number') return true
    if (Array.isArray(v)) return v.some(item => isFilled(item))
    if (typeof v === 'object') return Object.values(v).some(isFilled)
    return false
  }

  // Estrategia: 9 elementos clave
  const estrategiaItems = [
    e.proposito_evolutivo,
    e.vector_audaz,
    e.factor_x,
    e.promesa_marca,
    e.factores_adn?.cultura,
    e.factores_adn?.marketing,
    e.vector_3a5?.ingresos,
    e.acciones_3a5,
    e.acciones_proposito
  ]
  const estrategiaScore = estrategiaItems.filter(isFilled).length / estrategiaItems.length

  // Anual: 6 elementos clave
  const anualItems = [
    a.ingresos, a.margen_bruto, a.efectivo,
    a.acciones_anuales, a.factores_procesos, a.kpis_anuales
  ]
  const anualScore = anualItems.filter(isFilled).length / anualItems.length

  // Trimestral: 7 elementos clave
  const trimestralItems = [
    t.ingresos_q, t.tema?.nombre, t.tema?.objetivo_critico,
    t.rocas_tacticas, t.rituales_responsabilidad,
    t.celebracion, t.recompensa
  ]
  const trimestralScore = trimestralItems.filter(isFilled).length / trimestralItems.length

  const total = (estrategiaScore + anualScore + trimestralScore) / 3

  return {
    total: Math.round(total * 100),
    estrategia: Math.round(estrategiaScore * 100),
    anual: Math.round(anualScore * 100),
    trimestral: Math.round(trimestralScore * 100)
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Determinar trimestre actual
// ────────────────────────────────────────────────────────────────────────────
function getCurrentQuarter() {
  const now = new Date()
  const m = now.getMonth() + 1
  const q = m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4'
  return { trimestre: q, ano: now.getFullYear() }
}

// ────────────────────────────────────────────────────────────────────────────
// Render: Greeting + Avatar + Empresa
// ────────────────────────────────────────────────────────────────────────────
function renderUserHeader(profile, org) {
  const nombre = profile?.nombre || 'usuario'
  const avatar = initials(`${profile?.nombre || ''} ${profile?.apellido || ''}`)

  $('#topbar-greeting').textContent = `¡Hola, ${nombre}! 👋`
  $('#topbar-empresa').textContent = org?.nombre || '—'
  $$('.user-avatar').forEach(el => el.textContent = avatar)
}

// ────────────────────────────────────────────────────────────────────────────
// Render: Eyebrow del trimestre
// ────────────────────────────────────────────────────────────────────────────
function renderEyebrow() {
  const { trimestre, ano } = getCurrentQuarter()
  $('#page-eyebrow').textContent = `Dashboard · ${trimestre} ${ano}`
}

// ────────────────────────────────────────────────────────────────────────────
// Render: KPI cards superiores
// ────────────────────────────────────────────────────────────────────────────
function renderKPIs(opsp, contrato, consejoData) {
  const progress = calcOPSPProgress(opsp)
  const t = opsp?.trimestral || {}

  // KPI 1: OPSP Completado
  $('#kpi-opsp-percent').textContent = `${progress.total}%`
  $('#kpi-opsp-sub').textContent = `Estrategia ${progress.estrategia}% · Año ${progress.anual}% · Trim ${progress.trimestral}%`

  // KPI 2: Rocas del Trimestre
  const rocas = t.rocas_tacticas || []
  const rocasCount = rocas.filter(r => r.prioridad).length
  $('#kpi-rocas-count').textContent = String(rocasCount)
  $('#kpi-rocas-sub').textContent = rocasCount > 0
    ? `${rocasCount} prioridades activas`
    : 'Sin rocas configuradas'

  // KPI 3: Rituales activos
  const rituales = []
  if (contrato?.estado === 'firmado') rituales.push('Contrato')
  else if (contrato) rituales.push('Contrato (por firmar)')
  if (consejoData.consejo?.estado === 'activo') rituales.push('Consejo')

  $('#kpi-rituales-count').textContent = String(rituales.length)
  $('#kpi-rituales-sub').textContent = rituales.length > 0
    ? rituales.join(' · ')
    : 'Activa rituales para escalar'

  // KPI 4: Próxima sesión
  if (consejoData.proximaSesion) {
    $('#kpi-sesion-fecha').textContent = fmtDate(consejoData.proximaSesion.fecha_programada)
    $('#kpi-sesion-sub').textContent = `${fmtTime(consejoData.proximaSesion.fecha_programada)} · ${consejoData.proximaSesion.titulo.substring(0, 30)}`
  } else {
    $('#kpi-sesion-fecha').textContent = '—'
    $('#kpi-sesion-sub').textContent = 'Sin sesiones programadas'
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Render: Vector Audaz card
// ────────────────────────────────────────────────────────────────────────────
function renderVectorAudaz(opsp) {
  const e = opsp?.estrategia || {}
  $('#vector-audaz-text').textContent = e.vector_audaz || 'Aún no has definido tu Vector Audaz. Ve al OPSP y define hacia dónde vas en 10-25 años.'

  const v3a5 = e.vector_3a5 || {}
  $('#vector-horizonte').textContent = v3a5.ano_meta || '—'
  $('#vector-ingresos').textContent = v3a5.ingresos || '—'
  $('#vector-ganancias').textContent = v3a5.ganancias || '—'
}

// ────────────────────────────────────────────────────────────────────────────
// Render: Rocas del Trimestre con responsables
// ────────────────────────────────────────────────────────────────────────────
function renderRocas(opsp) {
  const rocas = (opsp?.trimestral?.rocas_tacticas || []).filter(r => r.prioridad)
  const list = $('#rocas-list')

  if (rocas.length === 0) {
    list.innerHTML = '<div style="font-size:13px; color:var(--text-3); padding:12px 0;">Sin rocas tácticas. Configúralas en el OPSP del trimestre.</div>'
    return
  }

  // Como no tenemos progreso real por roca aún, mostramos % mockeado por orden
  // Esto se conectará a una tabla `roca_avance` en futuro
  const mockProgress = [78, 45, 92, 62, 18]
  const semaforos = ['green', 'amber', 'green', 'amber', 'red']

  list.innerHTML = rocas.map((r, i) => {
    const pct = mockProgress[i] || 50
    const sem = semaforos[i] || 'amber'
    return `
      <div class="roca-item">
        <div class="roca-icon ${sem}">${i + 1}</div>
        <div class="roca-content">
          <div class="roca-title">${r.prioridad}</div>
          <div class="roca-meta">
            <div class="roca-progress"><div class="roca-progress-fill ${sem}" style="width:${pct}%"></div></div>
            <span class="roca-percent">${pct}%</span>
          </div>
          ${r.responsable ? `<div style="font-size:11px;color:var(--text-3);margin-top:4px;">→ ${r.responsable}</div>` : ''}
        </div>
      </div>
    `
  }).join('')
}

// ────────────────────────────────────────────────────────────────────────────
// Render: OPSP progress ring
// ────────────────────────────────────────────────────────────────────────────
function renderOPSPRing(opsp) {
  const p = calcOPSPProgress(opsp)
  const ring = $('#opsp-ring-fill')
  const circ = 2 * Math.PI * 42  // r=42
  const offset = circ - (p.total / 100) * circ

  ring.setAttribute('stroke-dasharray', circ.toFixed(2))
  ring.setAttribute('stroke-dashoffset', offset.toFixed(2))

  $('#opsp-ring-percent').textContent = `${p.total}%`
  $('#opsp-info-estrategia').textContent = `${p.estrategia}%`
  $('#opsp-info-anual').textContent = `${p.anual}%`
  $('#opsp-info-trimestral').textContent = `${p.trimestral}%`
}

// ────────────────────────────────────────────────────────────────────────────
// Render: Lista de Rituales activos
// ────────────────────────────────────────────────────────────────────────────
function renderRitualesActivos(contrato, consejoData) {
  const list = $('#rituales-list')
  const items = []

  // Contrato del Dueño
  const contratoEstado = contrato?.estado === 'firmado'
    ? { label: 'Firmado · Vigente', badge: 'green', text: 'Activo' }
    : contrato
      ? { label: 'Sin firmar · Pendiente', badge: 'amber', text: 'Por firmar' }
      : { label: 'No iniciado', badge: 'gray', text: 'Inactivo' }

  items.push(`
    <div class="ritual-item">
      <div class="ritual-icon"><i data-lucide="file-signature"></i></div>
      <div class="ritual-content">
        <div class="ritual-name">Contrato del Dueño</div>
        <div class="ritual-status">${contratoEstado.label}</div>
      </div>
      <span class="ritual-badge ${contratoEstado.badge}">${contratoEstado.text}</span>
    </div>
  `)

  // Consejo
  if (consejoData.consejo?.estado === 'activo') {
    const proxFecha = consejoData.proximaSesion ? fmtDate(consejoData.proximaSesion.fecha_programada) : 'sin programar'
    const pagoLabel = consejoData.pagoPendiente
      ? { badge: 'amber', text: 'Pago pendiente' }
      : { badge: 'green', text: 'Activo' }

    items.push(`
      <div class="ritual-item">
        <div class="ritual-icon"><i data-lucide="users"></i></div>
        <div class="ritual-content">
          <div class="ritual-name">Consejo de Escalabilidad</div>
          <div class="ritual-status">${consejoData.miembros.length}/3 miembros · Próx. ${proxFecha}</div>
        </div>
        <span class="ritual-badge ${pagoLabel.badge}">${pagoLabel.text}</span>
      </div>
    `)
  }

  // Kick-off (placeholder)
  items.push(`
    <div class="ritual-item">
      <div class="ritual-icon"><i data-lucide="rocket"></i></div>
      <div class="ritual-content">
        <div class="ritual-name">Kick-off de Trimestre</div>
        <div class="ritual-status">Próximamente</div>
      </div>
      <span class="ritual-badge gray">Próximo</span>
    </div>
  `)

  list.innerHTML = items.join('')
  lucide.createIcons()
}

// ────────────────────────────────────────────────────────────────────────────
// Render: Próxima sesión
// ────────────────────────────────────────────────────────────────────────────
function renderProximaSesion(consejoData) {
  const sesion = consejoData.proximaSesion
  const card = $('#proxima-sesion-card')

  if (!sesion) {
    card.innerHTML = `
      <div style="font-size:13px; color:var(--text-3); padding:12px 0;">
        No tienes sesiones programadas.<br/>
        <a href="/portal/rituales.html" style="color:var(--teal);font-weight:600;">Agenda una con el Consejo →</a>
      </div>
    `
    return
  }

  const dur = sesion.duracion_min || 90
  const horaFin = (() => {
    const d = new Date(sesion.fecha_programada)
    d.setMinutes(d.getMinutes() + dur)
    return fmtTime(d.toISOString())
  })()

  card.innerHTML = `
    <div class="session-card">
      <div class="session-date">${fmtDateLong(sesion.fecha_programada)}</div>
      <div class="session-title">${sesion.titulo}</div>
      <div class="session-time">
        <i data-lucide="clock"></i>
        ${fmtTime(sesion.fecha_programada)} — ${horaFin} · Consejo de Escalabilidad
      </div>
    </div>
  `
  lucide.createIcons()
}

// ────────────────────────────────────────────────────────────────────────────
// Render: Promesa de Marca
// ────────────────────────────────────────────────────────────────────────────
function renderPromesaMarca(opsp) {
  const promesa = opsp?.estrategia?.promesa_marca || ''
  const list = $('#promesa-list')

  if (!promesa.trim()) {
    list.innerHTML = '<div style="font-size:13px; color:var(--text-3);">Define tu Promesa de Marca en el OPSP.</div>'
    $('#promesa-count').textContent = '0 compromisos'
    $('#promesa-quote').style.display = 'none'
    return
  }

  // Parsear formato: "1. xxxx | 2. xxxx | 3. xxxx (frase final)"
  const parts = promesa.split(/\d+\.\s/).filter(p => p.trim())
  const items = parts.slice(0, 3).map(p => p.split('|')[0].split('(')[0].trim()).filter(Boolean)
  const closingMatch = promesa.match(/\(([^)]+)\)/)
  const closing = closingMatch ? closingMatch[1] : null

  list.innerHTML = items.map((text, i) => `
    <div class="promesa-item">
      <div class="promesa-num">${i + 1}</div>
      <div class="promesa-text">${text}</div>
    </div>
  `).join('')

  $('#promesa-count').textContent = `${items.length} compromiso${items.length !== 1 ? 's' : ''}`

  if (closing) {
    $('#promesa-quote').textContent = `"${closing}"`
    $('#promesa-quote').style.display = 'block'
  } else {
    $('#promesa-quote').style.display = 'none'
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Render: Factor X
// ────────────────────────────────────────────────────────────────────────────
function renderFactorX(opsp) {
  const factorX = opsp?.estrategia?.factor_x || ''
  const ingresoEmp = opsp?.anual?.ingresos_empleado || '—'

  $('#factor-x-value').textContent = ingresoEmp
  $('#factor-x-label').textContent = factorX || 'Define tu Factor X en el OPSP'
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────
async function init() {
  try {
    // 1. Renderizar header del trimestre (no requiere data)
    renderEyebrow()

    // 2. Cargar perfil y org en paralelo
    const [profile, org] = await Promise.all([
      getMyProfile(),
      getMyOrganization()
    ])

    if (!org) {
      $('.content').innerHTML = `
        <div style="text-align:center; padding:60px 20px;">
          <h2 style="font-family:'Plus Jakarta Sans',sans-serif; font-size:22px; margin-bottom:12px;">Sin organización asignada</h2>
          <p style="color:var(--text-3); margin-bottom:24px;">No estás asociado a ninguna organización todavía.</p>
          <p style="font-size:13px; color:var(--text-3);">Contacta a Agustín para que te asigne a una org.</p>
        </div>
      `
      return
    }

    renderUserHeader(profile, org)

    // 3. Cargar OPSP, contrato y consejo en paralelo
    const [opsp, contrato, consejoData] = await Promise.all([
      loadOPSP(org.id),
      loadContrato(org.id),
      loadConsejo(org.id)
    ])

    // 4. Render todo
    renderKPIs(opsp, contrato, consejoData)
    renderVectorAudaz(opsp)
    renderRocas(opsp)
    renderOPSPRing(opsp)
    renderRitualesActivos(contrato, consejoData)
    renderProximaSesion(consejoData)
    renderPromesaMarca(opsp)
    renderFactorX(opsp)

    // 5. Re-render lucide icons (porque inyectamos algunos dinámicamente)
    lucide.createIcons()

  } catch (err) {
    console.error('[dashboard] init error:', err)
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Theme toggle (compartido con otras páginas)
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

// Aplicar tema guardado al cargar
const savedTheme = localStorage.getItem('scalex-theme')
if (savedTheme) document.documentElement.dataset.theme = savedTheme

// Logout global
window.logout = signOut

// Arrancar
init()
