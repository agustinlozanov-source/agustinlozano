import { supabase, getMyProfile, getMyOrganization } from '/assets/js/supabase-client.js'

// ─── Estado ────────────────────────────────────────────────────────────────
const state = {
  orgId: null,
  datos: null,
}

// ─── Helpers de fecha ──────────────────────────────────────────────────────
function isoSemana(fecha = new Date()) {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return { anio: d.getUTCFullYear(), semana: Math.ceil((((d - yearStart) / 86400000) + 1) / 7) }
}

function anioActual() { return new Date().getFullYear() }

// Retorna los últimos 7 días como array { fecha, diaSemana }
// índice 0 = hace 6 días, índice 6 = hoy
function ultimos7Dias() {
  const dias = []
  const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const hoy = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoy)
    d.setDate(hoy.getDate() - i)
    dias.push({ fecha: d, label: labels[d.getDay()], esHoy: i === 0 })
  }
  return dias
}

function fechaISO(d) {
  return d.toISOString().slice(0, 10)
}

// ─── Helpers de UI ─────────────────────────────────────────────────────────
function nivelClase(nivel) {
  if (!nivel) return 'ok'
  const n = nivel.toLowerCase()
  if (n === 'alerta') return 'alerta'
  if (n.includes('aten')) return 'atencion'
  return 'ok'
}

function nivelLabel(nivel) {
  if (!nivel) return 'OK'
  const n = nivel.toLowerCase()
  if (n === 'alerta') return 'ALERTA'
  if (n.includes('aten')) return 'ATENCIÓN'
  return 'OK'
}

function estadoGeneralClase(estado) {
  if (!estado) return 'alerta'
  const e = estado.toLowerCase()
  if (e === 'sano') return 'sano'
  if (e.includes('aten')) return 'atencion'
  return 'alerta'
}

function estadoGeneralLabel(estado) {
  if (!estado) return 'ALERTA'
  const e = estado.toLowerCase()
  if (e === 'sano') return 'SANO'
  if (e.includes('aten')) return 'ATENCIÓN'
  return 'ALERTA'
}

function estadoGeneralColor(clase) {
  if (clase === 'sano') return '#00c853'
  if (clase === 'atencion') return '#ff9500'
  return '#ff3b30'
}

function progresoBg(pct) {
  if (pct >= 80) return '#00c853'
  if (pct >= 50) return '#ff9500'
  return '#ff3b30'
}

// ─── Carga principal ───────────────────────────────────────────────────────
async function cargarEstado() {
  const { data, error } = await supabase.rpc('flujo_rutina_estado', { p_org_id: state.orgId })
  if (error) {
    console.error('flujo_rutina_estado:', error)
    return null
  }
  // El RPC devuelve un array con un solo objeto
  const result = Array.isArray(data) ? data[0] : data
  console.log('[flujo_rutina_estado] respuesta raw:', result)
  return result
}

async function init() {
  try {
    const profile = await getMyProfile()
    const org = await getMyOrganization()
    if (!profile || !org) return
    state.orgId = org.id

    document.getElementById('btn-refresh').addEventListener('click', async () => {
      mostrarLoading(true)
      state.datos = await cargarEstado()
      renderTodo()
      mostrarLoading(false)
    })

    state.datos = await cargarEstado()
    renderTodo()
    mostrarLoading(false)
  } catch (err) {
    console.error('init flujo-rutina:', err)
    mostrarLoading(false)
  }
}

function mostrarLoading(visible) {
  document.getElementById('loading-state').style.display = visible ? 'flex' : 'none'
  const contenido = document.getElementById('contenido-rutina')
  contenido.style.display = visible ? 'none' : 'flex'
  contenido.style.flexDirection = 'column'
  contenido.style.gap = '20px'
}

// ─── Render principal ──────────────────────────────────────────────────────
function renderTodo() {
  const d = state.datos || {}
  const contenido = document.getElementById('contenido-rutina')

  const pct = Math.round(d.cumplimiento_pct_30_dias ?? 0)
  const egClase = estadoGeneralClase(d.estado_general)
  const egLabel = estadoGeneralLabel(d.estado_general)
  const egColor = estadoGeneralColor(egClase)
  const progBg = progresoBg(pct)

  contenido.innerHTML = `
    ${renderResumen(egClase, egLabel, egColor, pct, progBg)}
    ${renderCardDiario(d)}
    ${renderCardSemanal(d)}
    ${renderCardMensual(d)}
    ${renderCardTrimestral(d)}
    ${renderCardAnual(d)}
  `

  // Eventos de botones marcables
  const btnMarcarSemanal = document.getElementById('btn-marcar-semanal')
  if (btnMarcarSemanal) btnMarcarSemanal.addEventListener('click', accionMarcarSemanal)

  const btnDesmarcarSemanal = document.getElementById('btn-desmarcar-semanal')
  if (btnDesmarcarSemanal) btnDesmarcarSemanal.addEventListener('click', accionDesmarcarSemanal)

  const btnMarcarAnual = document.getElementById('btn-marcar-anual')
  if (btnMarcarAnual) btnMarcarAnual.addEventListener('click', accionMarcarAnual)

  const btnDesmarcarAnual = document.getElementById('btn-desmarcar-anual')
  if (btnDesmarcarAnual) btnDesmarcarAnual.addEventListener('click', accionDesmarcarAnual)

  lucide.createIcons()
}

// ─── Header Resumen ────────────────────────────────────────────────────────
function renderResumen(egClase, egLabel, egColor, pct, progBg) {
  return `
    <div class="resumen-header ${egClase}">
      <div class="resumen-left">
        <div class="resumen-label">Estado general del sistema</div>
        <div class="resumen-estado">
          <div class="resumen-estado-text" style="color:${egColor}">${egLabel}</div>
          <span class="nivel-badge ${egClase === 'sano' ? 'ok' : egClase}">${egLabel}</span>
        </div>
      </div>
      <div class="resumen-right">
        <div class="cumplimiento-label">Cumplimiento últimos 30 días</div>
        <div class="cumplimiento-row">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width:${pct}%;background:${progBg}"></div>
          </div>
          <div class="cumplimiento-pct" style="color:${progBg}">${pct}%</div>
        </div>
      </div>
    </div>
  `
}

// ─── Card 1: Diario ────────────────────────────────────────────────────────
function renderCardDiario(d) {
  const nivel = nivelClase(d.diario_alerta_nivel)
  const label = nivelLabel(d.diario_alerta_nivel)
  const hoyCap = !!d.diario_hoy_capturado
  const diasCap = d.diario_dias_capturados_7 ?? 0
  const racha = d.diario_racha_actual ?? 0

  // Construir dots de los últimos 7 días
  // diario_dias_capturados_7 es un número; no tenemos el mapa día a día,
  // así que mostramos los "últimos 7" inferidos: los últimos diasCap días como OK, el resto según si es pasado
  const dias = ultimos7Dias()
  // Estimamos que los días capturados son los más recientes
  const dotsHtml = dias.map((dia, idx) => {
    const esPasado = !dia.esHoy && idx < 6
    // Si hoy está capturado, asumimos el más reciente OK
    // Para días anteriores, distribuimos los diasCap desde el más reciente
    const totalCapturados = hoyCap ? diasCap : Math.max(0, diasCap)
    const desdeHoy = 6 - idx // 0 = hoy, 1 = ayer, ...
    const estaCapturado = desdeHoy < totalCapturados || (desdeHoy === 0 && hoyCap)
    let dotClase = 'futuro'
    if (estaCapturado) dotClase = 'ok'
    else if (esPasado || dia.esHoy) dotClase = 'pendiente-pasado'
    const hoyClass = dia.esHoy ? ' hoy' : ''
    const icono = estaCapturado ? '✓' : (dotClase === 'futuro' ? '—' : '✕')
    return `<div class="semana-dot-wrap">
      <div class="semana-dot ${dotClase}${hoyClass}">${icono}</div>
      <div class="dia-label">${dia.label}</div>
    </div>`
  }).join('')

  const alertaHtml = (nivel === 'alerta' || nivel === 'atencion') && !hoyCap
    ? `<div class="alerta-row"><i data-lucide="alert-triangle"></i> Llevas ${7 - diasCap} días sin capturar el flujo de caja</div>`
    : ''

  const btnHtml = hoyCap
    ? `<a href="/portal/flujo-caja.html" class="btn-ghost"><i data-lucide="external-link"></i> Ver Flujo de Caja</a>`
    : `<a href="/portal/flujo-caja.html" class="btn-primary"><i data-lucide="arrow-right"></i> Ir al Flujo de Caja Diario</a>`

  return `
    <div class="horizonte-card borde-${nivel}">
      <div class="horizonte-header">
        <div class="horizonte-title-row">
          <div class="horizonte-icon" style="background:rgba(255,149,0,0.1)">
            <i data-lucide="calendar" style="color:#ff9500"></i>
          </div>
          <div class="horizonte-title-block">
            <div class="horizonte-freq">Diario</div>
            <div class="horizonte-nombre">Flujo de Caja</div>
          </div>
        </div>
        <span class="nivel-badge ${nivel}">${label}</span>
      </div>
      <div class="horizonte-body">
        <div class="estado-hoy ${hoyCap ? 'capturado' : 'pendiente'}">
          <i data-lucide="${hoyCap ? 'check-circle' : 'circle'}"></i>
          Hoy: ${hoyCap ? 'Capturado' : 'Pendiente'}
        </div>
        <div>
          <div class="info-row" style="margin-bottom:8px">Últimos 7 días</div>
          <div class="semana-dots">${dotsHtml}</div>
        </div>
        <div class="racha-row">
          <i data-lucide="flame"></i>
          <span>Racha: <strong>${racha}</strong> días consecutivos</span>
        </div>
        ${alertaHtml}
      </div>
      <div class="horizonte-actions">${btnHtml}</div>
    </div>
  `
}

// ─── Card 2: Semanal ───────────────────────────────────────────────────────
function renderCardSemanal(d) {
  const nivel = nivelClase(d.semanal_alerta_nivel)
  const label = nivelLabel(d.semanal_alerta_nivel)
  const hecha = !!d.semanal_esta_semana_hecha
  const diasDesde = d.semanal_dias_desde_ultima ?? null

  const estadoHtml = hecha
    ? `<div class="estado-hoy capturado"><i data-lucide="check-circle"></i> Esta semana: Completa</div>`
    : `<div class="estado-hoy pendiente"><i data-lucide="clock"></i> Esta semana: Pendiente</div>`

  const diasDesdeHtml = !hecha && diasDesde !== null
    ? `<div class="info-row">Última revisión: hace <span>${diasDesde} días</span></div>`
    : ''

  const alertaHtml = !hecha && (nivel === 'alerta' || nivel === 'atencion')
    ? `<div class="alerta-row"><i data-lucide="alert-triangle"></i> Han pasado ${diasDesde ?? '?'} días desde tu última revisión semanal</div>`
    : ''

  const checklistHtml = `
    <div class="checklist">
      <div class="checklist-item"><i data-lucide="check"></i> Total de ingresos y gastos de la semana</div>
      <div class="checklist-item"><i data-lucide="check"></i> Variación vs semana anterior</div>
      <div class="checklist-item"><i data-lucide="check"></i> Facturas pendientes por cobrar y por pagar</div>
      <div class="checklist-item"><i data-lucide="check"></i> Gastos no presupuestados</div>
    </div>
  `

  const btnsHtml = hecha
    ? `<button class="btn-ghost danger" id="btn-desmarcar-semanal"><i data-lucide="x"></i> Desmarcar</button>`
    : `<button class="btn-primary green" id="btn-marcar-semanal"><i data-lucide="check"></i> Marcar revisión semanal completa</button>`

  return `
    <div class="horizonte-card borde-${nivel}">
      <div class="horizonte-header">
        <div class="horizonte-title-row">
          <div class="horizonte-icon" style="background:rgba(0,200,83,0.1)">
            <i data-lucide="bar-chart-2" style="color:#00c853"></i>
          </div>
          <div class="horizonte-title-block">
            <div class="horizonte-freq">Semanal</div>
            <div class="horizonte-nombre">Ventas, Cobranzas, Pagos</div>
          </div>
        </div>
        <span class="nivel-badge ${nivel}">${label}</span>
      </div>
      <div class="horizonte-body">
        ${estadoHtml}
        ${diasDesdeHtml}
        ${alertaHtml}
        ${checklistHtml}
      </div>
      <div class="horizonte-actions">${btnsHtml}</div>
    </div>
  `
}

// ─── Card 3: Mensual ───────────────────────────────────────────────────────
function renderCardMensual(d) {
  const nivel = nivelClase(d.mensual_alerta_nivel)
  const label = nivelLabel(d.mensual_alerta_nivel)
  const hecho = !!d.mensual_mes_anterior_hecho
  const diasDesde = d.mensual_dias_desde_cierre ?? null

  const estadoHtml = hecho
    ? `<div class="estado-hoy capturado"><i data-lucide="check-circle"></i> Mes anterior: Completado</div>`
    : `<div class="estado-hoy pendiente"><i data-lucide="clock"></i> Mes anterior: Pendiente</div>`

  const diasHtml = diasDesde !== null
    ? `<div class="info-row">Días desde cierre del mes: <span>${diasDesde}</span></div>`
    : ''

  const alertaHtml = !hecho && (nivel === 'alerta' || nivel === 'atencion')
    ? `<div class="alerta-row"><i data-lucide="alert-triangle"></i> El Estado de Resultados del mes anterior aún no se ha cerrado. Llevas ${diasDesde ?? '?'} días.</div>`
    : ''

  return `
    <div class="horizonte-card borde-${nivel}">
      <div class="horizonte-header">
        <div class="horizonte-title-row">
          <div class="horizonte-icon" style="background:rgba(53,51,205,0.1)">
            <i data-lucide="clipboard" style="color:#3533cd"></i>
          </div>
          <div class="horizonte-title-block">
            <div class="horizonte-freq">Mensual</div>
            <div class="horizonte-nombre">Estado de Resultados</div>
          </div>
        </div>
        <span class="nivel-badge ${nivel}">${label}</span>
      </div>
      <div class="horizonte-body">
        ${estadoHtml}
        ${diasHtml}
        ${alertaHtml}
      </div>
      <div class="horizonte-actions">
        <a href="/portal/flujo-estado-resultados.html" class="btn-primary">
          <i data-lucide="arrow-right"></i> Ir al Estado de Resultados
        </a>
      </div>
    </div>
  `
}

// ─── Card 4: Trimestral ────────────────────────────────────────────────────
function renderCardTrimestral(d) {
  const nivel = nivelClase(d.trimestral_alerta_nivel)
  const label = nivelLabel(d.trimestral_alerta_nivel)
  const diasDesde = d.trimestral_dias_desde_ult ?? null
  const proximoEn = d.trimestral_proximo_en_dias ?? null

  const ultimoHtml = diasDesde !== null
    ? `<div class="info-row">Último Diagnóstico: hace <span>${diasDesde} días</span></div>`
    : `<div class="info-row" style="color:var(--red)">Nunca realizado</div>`

  const proximoHtml = proximoEn !== null && proximoEn > 0
    ? `<div class="info-row">Próximo recomendado: en <span>${proximoEn} días</span></div>`
    : proximoEn === 0
      ? `<div class="alerta-row" style="color:var(--amber);background:rgba(255,149,0,0.1)"><i data-lucide="clock"></i> Es momento de actualizar tu Diagnóstico</div>`
      : ''

  const alertaHtml = nivel === 'alerta'
    ? `<div class="alerta-row"><i data-lucide="alert-triangle"></i> Tu último Diagnóstico tiene más de 90 días. Recálcalo para tener visibilidad actualizada.</div>`
    : ''

  return `
    <div class="horizonte-card borde-${nivel}">
      <div class="horizonte-header">
        <div class="horizonte-title-row">
          <div class="horizonte-icon" style="background:rgba(124,58,237,0.1)">
            <i data-lucide="search" style="color:#7c3aed"></i>
          </div>
          <div class="horizonte-title-block">
            <div class="horizonte-freq">Trimestral</div>
            <div class="horizonte-nombre">Diagnóstico Financiero</div>
          </div>
        </div>
        <span class="nivel-badge ${nivel}">${label}</span>
      </div>
      <div class="horizonte-body">
        ${ultimoHtml}
        ${proximoHtml}
        ${alertaHtml}
      </div>
      <div class="horizonte-actions">
        <a href="/portal/flujo-diagnostico.html" class="btn-primary">
          <i data-lucide="arrow-right"></i> Iniciar nuevo Diagnóstico
        </a>
      </div>
    </div>
  `
}

// ─── Card 5: Anual ─────────────────────────────────────────────────────────
function renderCardAnual(d) {
  const nivel = nivelClase(d.anual_alerta_nivel)
  const label = nivelLabel(d.anual_alerta_nivel)
  const ultimoAnio = d.anual_ultima_anio ?? null
  const hecho = ultimoAnio === anioActual()

  const ultimoHtml = ultimoAnio
    ? `<div class="info-row">Última revisión: <span>${ultimoAnio}</span></div>`
    : `<div class="info-row" style="color:var(--red)">Nunca marcada</div>`

  const alertaHtml = nivel === 'alerta'
    ? `<div class="alerta-row"><i data-lucide="alert-triangle"></i> No tienes revisión anual marcada para este año.</div>`
    : ''

  const checklistHtml = `
    <div class="checklist">
      <div class="checklist-item"><i data-lucide="check"></i> Resumen de ingresos, costos y utilidades del año</div>
      <div class="checklist-item"><i data-lucide="check"></i> Comparación con año anterior</div>
      <div class="checklist-item"><i data-lucide="check"></i> Evaluación de inversiones</div>
      <div class="checklist-item"><i data-lucide="check"></i> Estrategia financiera para el siguiente año</div>
      <div class="checklist-item"><i data-lucide="check"></i> Decisiones de reinversión y capital</div>
    </div>
  `

  const btnsHtml = hecho
    ? `<button class="btn-ghost danger" id="btn-desmarcar-anual"><i data-lucide="x"></i> Desmarcar</button>`
    : `<button class="btn-primary green" id="btn-marcar-anual"><i data-lucide="check"></i> Marcar revisión anual completada</button>`

  return `
    <div class="horizonte-card borde-${nivel}">
      <div class="horizonte-header">
        <div class="horizonte-title-row">
          <div class="horizonte-icon" style="background:rgba(236,72,153,0.1)">
            <i data-lucide="target" style="color:#ec4899"></i>
          </div>
          <div class="horizonte-title-block">
            <div class="horizonte-freq">Anual</div>
            <div class="horizonte-nombre">Proyección y Estrategia</div>
          </div>
        </div>
        <span class="nivel-badge ${nivel}">${label}</span>
      </div>
      <div class="horizonte-body">
        ${ultimoHtml}
        ${alertaHtml}
        ${checklistHtml}
      </div>
      <div class="horizonte-actions">${btnsHtml}</div>
    </div>
  `
}

// ─── Acciones Semanal ──────────────────────────────────────────────────────
async function accionMarcarSemanal() {
  const btn = document.getElementById('btn-marcar-semanal')
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…' }
  try {
    const { anio, semana } = isoSemana()
    const { error } = await supabase.rpc('flujo_rutina_marcar_semanal', {
      p_org_id: state.orgId, p_anio: anio, p_semana: semana, p_notas: null
    })
    if (error) { console.error('marcar_semanal:', error); return }
    state.datos = await cargarEstado()
    renderTodo()
  } catch (err) { console.error(err) }
}

async function accionDesmarcarSemanal() {
  const btn = document.getElementById('btn-desmarcar-semanal')
  if (btn) { btn.disabled = true; btn.textContent = 'Desmarcando…' }
  try {
    const { anio, semana } = isoSemana()
    const { error } = await supabase.rpc('flujo_rutina_desmarcar_semanal', {
      p_org_id: state.orgId, p_anio: anio, p_semana: semana
    })
    if (error) { console.error('desmarcar_semanal:', error); return }
    state.datos = await cargarEstado()
    renderTodo()
  } catch (err) { console.error(err) }
}

// ─── Acciones Anual ────────────────────────────────────────────────────────
async function accionMarcarAnual() {
  const btn = document.getElementById('btn-marcar-anual')
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…' }
  try {
    const { error } = await supabase.rpc('flujo_rutina_marcar_anual', {
      p_org_id: state.orgId, p_anio: anioActual(), p_notas: null
    })
    if (error) { console.error('marcar_anual:', error); return }
    state.datos = await cargarEstado()
    renderTodo()
  } catch (err) { console.error(err) }
}

async function accionDesmarcarAnual() {
  const btn = document.getElementById('btn-desmarcar-anual')
  if (btn) { btn.disabled = true; btn.textContent = 'Desmarcando…' }
  try {
    const { error } = await supabase.rpc('flujo_rutina_desmarcar_anual', {
      p_org_id: state.orgId, p_anio: anioActual()
    })
    if (error) { console.error('desmarcar_anual:', error); return }
    state.datos = await cargarEstado()
    renderTodo()
  } catch (err) { console.error(err) }
}

// ─── Arranque ──────────────────────────────────────────────────────────────
const _html = document.documentElement
const _saved = localStorage.getItem('scalex-theme') || 'dark'
_html.setAttribute('data-theme', _saved)
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('theme-toggle')
  if (btn) btn.addEventListener('click', () => {
    const next = _html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    _html.setAttribute('data-theme', next)
    localStorage.setItem('scalex-theme', next)
  })
})

init()
