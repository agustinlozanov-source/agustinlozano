// ============================================================================
// SCALEx PORTAL — Rituales JS
// ============================================================================
// Maneja 3 vistas dentro de la misma página:
//   - lista     → cards de rituales activos
//   - contrato  → Contrato del Dueño con firma manuscrita
//   - consejo   → Consejo de Escalabilidad
// ============================================================================

import {
  supabase,
  getMyProfile,
  getMyOrganization,
  signOut
} from './supabase-client.js'

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
const fmtTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
const fmtMoney = (amount, currency = 'MXN') => {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}
const fmtFullDate = () => {
  const now = new Date()
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${now.getDate()} de ${meses[now.getMonth()]} de ${now.getFullYear()}`
}

// ────────────────────────────────────────────────────────────────────────────
// Estado global
// ────────────────────────────────────────────────────────────────────────────
let state = {
  org: null,
  profile: null,
  contrato: null,
  consejo: null,
  miembros: [],
  sesiones: [],
  pagos: []
}

// ────────────────────────────────────────────────────────────────────────────
// Loaders
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

  if (error) console.error('[rituales] loadContrato error', error)

  // Si no existe, crear uno en borrador
  if (!data) {
    const { data: newC, error: e2 } = await supabase
      .from('contratos')
      .insert({
        organizacion_id: orgId,
        tipo: 'dueno',
        estado: 'borrador',
        version: 'v1.0',
        empresa_nombre: state.org?.nombre || '',
        firmante_nombre: `${state.profile?.nombre || ''} ${state.profile?.apellido || ''}`.trim(),
        firmante_cargo: 'Director General · Dueño',
        lugar: 'Monterrey, Nuevo León, México',
        vigencia_meses: 12,
        created_by: state.profile?.id
      })
      .select('*')
      .single()
    if (e2) {
      console.error('[rituales] create contrato error', e2)
      return null
    }
    return newC
  }

  return data
}

async function loadFirmas(contratoId) {
  const { data, error } = await supabase
    .from('contrato_firmas')
    .select('*')
    .eq('contrato_id', contratoId)
    .order('signed_at', { ascending: true })

  if (error) console.error('[rituales] loadFirmas error', error)
  return data || []
}

async function loadConsejoData(orgId) {
  const { data: consejo } = await supabase
    .from('consejos').select('*').eq('organizacion_id', orgId).maybeSingle()

  if (!consejo) return { consejo: null, miembros: [], sesiones: [], pagos: [] }

  const [{ data: miembros }, { data: sesiones }, { data: pagos }] = await Promise.all([
    supabase.from('consejo_miembros').select('*').eq('consejo_id', consejo.id).eq('estado', 'activo').order('created_at'),
    supabase.from('consejo_sesiones').select('*').eq('consejo_id', consejo.id).order('fecha_programada', { ascending: false }),
    supabase.from('consejo_pagos').select('*').eq('consejo_id', consejo.id).order('ano', { ascending: false }).order('trimestre', { ascending: false })
  ])

  return {
    consejo,
    miembros: miembros || [],
    sesiones: sesiones || [],
    pagos: pagos || []
  }
}

// ────────────────────────────────────────────────────────────────────────────
// VIEW SWITCHING
// ────────────────────────────────────────────────────────────────────────────
const TITLES = {
  list:    { eyebrow: 'Pilar 4 · Ritmo',          title: 'Rituales de Efectividad' },
  contrato:{ eyebrow: 'Ritual #1 · Compromiso',   title: 'Contrato del Dueño' },
  consejo: { eyebrow: 'Ritual #2 · Rendición',    title: 'Consejo de Escalabilidad' }
}

window.showView = function(view) {
  $$('.view').forEach(v => v.classList.remove('active'))
  $('#view-' + view).classList.add('active')

  $('#topbar-eyebrow').textContent = TITLES[view].eyebrow
  $('#topbar-title').textContent = TITLES[view].title

  const backBtn = $('#back-btn')
  if (view === 'list') backBtn.classList.add('topbar-back-hidden')
  else backBtn.classList.remove('topbar-back-hidden')

  // Re-render según vista
  if (view === 'contrato' && state.contrato) {
    renderContratoView()
  }
  if (view === 'consejo') {
    renderConsejoView()
  }

  $('.content').scrollTop = 0
  lucide.createIcons()
}

// ────────────────────────────────────────────────────────────────────────────
// VIEW 1 — LISTA DE RITUALES
// ────────────────────────────────────────────────────────────────────────────
function renderListView() {
  const c = state.contrato
  const consejoEstado = state.consejo

  // Card 1: Contrato
  const isFirmado = c?.estado === 'firmado'
  const card1 = $('#card-contrato')
  card1.querySelector('.ritual-card-status').className = `ritual-card-status ${isFirmado ? 'active' : 'pending'}`
  card1.querySelector('.ritual-card-status').textContent = isFirmado ? 'Firmado' : 'Por firmar'

  const card1CTA = card1.querySelector('.ritual-card-cta')
  if (card1CTA) {
    card1CTA.innerHTML = isFirmado
      ? `Ver contrato <i data-lucide="arrow-right"></i>`
      : `Firmar ahora <i data-lucide="arrow-right"></i>`
  }

  // Card 2: Consejo
  const card2 = $('#card-consejo')
  if (consejoEstado) {
    const proxSesion = state.sesiones.find(s => s.estado === 'programada')
    const fechaPrx = proxSesion ? fmtDate(proxSesion.fecha_programada) : 'sin programar'
    const miembrosCount = state.miembros.length

    card2.querySelector('.ritual-card-status').className = 'ritual-card-status active'
    card2.querySelector('.ritual-card-status').textContent = 'Activo'
    card2.querySelector('.ritual-meta-miembros').innerHTML = `<i data-lucide="users"></i><span><strong>${miembrosCount}/3</strong> miembros</span>`
    card2.querySelector('.ritual-meta-fecha').innerHTML = `<i data-lucide="calendar"></i><span>Próx. ${fechaPrx}</span>`
  }
}

// ────────────────────────────────────────────────────────────────────────────
// VIEW 2 — CONTRATO DEL DUEÑO
// ────────────────────────────────────────────────────────────────────────────
async function renderContratoView() {
  const c = state.contrato
  if (!c) return

  // Llenar datos editables
  $('#contrato-nombre-input').value = c.firmante_nombre || ''
  $('#contrato-empresa-input').value = c.empresa_nombre || ''

  // Bloque de firma
  $('#sig-info-firmante').textContent = c.firmante_nombre || '—'
  $('#sig-info-cargo').textContent = c.firmante_cargo || '—'
  $('#sig-info-fecha').textContent = c.signed_at
    ? new Date(c.signed_at).toLocaleDateString('es-MX', { dateStyle: 'long' })
    : fmtFullDate()
  $('#sig-info-lugar').textContent = c.lugar || '—'

  if (c.estado === 'firmado') {
    // Mostrar estado firmado
    const firmas = await loadFirmas(c.id)
    const ultimaFirma = firmas[firmas.length - 1]

    if (ultimaFirma) {
      // Pintar la firma guardada en el canvas
      const canvas = $('#signature-canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      img.onload = () => {
        const wrap = $('#canvas-wrap')
        canvas.width = wrap.clientWidth
        canvas.height = wrap.clientHeight
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      }
      img.src = ultimaFirma.signature_data

      $('#sig-placeholder').classList.add('hidden')
      $('#canvas-wrap').classList.add('signed')

      // Sello firmado
      $('#signed-state').style.display = 'block'
      $('#signed-timestamp').textContent = new Date(ultimaFirma.signed_at).toLocaleString('es-MX', {
        dateStyle: 'long', timeStyle: 'short'
      })

      // Ocultar CTA de firma
      $('#sign-cta').style.display = 'none'

      // Bloquear inputs
      $('#contrato-nombre-input').disabled = true
      $('#contrato-empresa-input').disabled = true

      // Bloquear canvas
      canvas.style.pointerEvents = 'none'
      $('.signature-actions').style.display = 'none'

      // Marcar todos los checks
      markCheck(2)
      markCheck(3)
    }
  } else {
    // Estado borrador: setup canvas para dibujar
    setTimeout(initCanvas, 50)
  }

  lucide.createIcons()
}

// Inputs de nombre/empresa actualizan el contrato (debounced)
let contratoSaveTimer
function onContratoFieldChange() {
  clearTimeout(contratoSaveTimer)
  contratoSaveTimer = setTimeout(async () => {
    if (!state.contrato || state.contrato.estado === 'firmado') return

    const updates = {
      firmante_nombre: $('#contrato-nombre-input').value.trim(),
      empresa_nombre: $('#contrato-empresa-input').value.trim()
    }

    const { error } = await supabase
      .from('contratos')
      .update(updates)
      .eq('id', state.contrato.id)

    if (!error) {
      Object.assign(state.contrato, updates)
      $('#sig-info-firmante').textContent = updates.firmante_nombre
    }
  }, 800)
}

// ────────────────────────────────────────────────────────────────────────────
// CANVAS DE FIRMA
// ────────────────────────────────────────────────────────────────────────────
let canvas, ctx, drawing = false, hasSignature = false, canvasInitialized = false

function initCanvas() {
  canvas = $('#signature-canvas')
  if (!canvas) return
  const wrap = $('#canvas-wrap')
  canvas.width = wrap.clientWidth
  canvas.height = wrap.clientHeight
  ctx = canvas.getContext('2d')

  const isDark = document.documentElement.dataset.theme === 'dark'
  ctx.strokeStyle = isDark ? '#ffffff' : '#070708'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (!canvasInitialized) {
    canvas.addEventListener('mousedown', startDraw)
    canvas.addEventListener('mousemove', draw)
    canvas.addEventListener('mouseup', endDraw)
    canvas.addEventListener('mouseleave', endDraw)
    canvas.addEventListener('touchstart', e => { e.preventDefault(); startDraw(getTouch(e)) })
    canvas.addEventListener('touchmove', e => { e.preventDefault(); draw(getTouch(e)) })
    canvas.addEventListener('touchend', endDraw)
    canvasInitialized = true
  }
}

function getTouch(e) {
  const rect = canvas.getBoundingClientRect()
  const t = e.touches[0] || e.changedTouches[0]
  return { offsetX: t.clientX - rect.left, offsetY: t.clientY - rect.top }
}
function startDraw(e) {
  drawing = true
  ctx.beginPath()
  ctx.moveTo(e.offsetX, e.offsetY)
  $('#sig-placeholder').classList.add('hidden')
}
function draw(e) {
  if (!drawing) return
  ctx.lineTo(e.offsetX, e.offsetY)
  ctx.stroke()
  hasSignature = true
  $('#sign-btn').disabled = false
}
function endDraw() {
  drawing = false
  if (hasSignature) {
    $('#canvas-wrap').classList.add('signed')
    markCheck(2)
  }
}

window.clearSignature = function() {
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  hasSignature = false
  $('#sig-placeholder').classList.remove('hidden')
  $('#canvas-wrap').classList.remove('signed')
  $('#sign-btn').disabled = true
  unmarkCheck(2)
}

window.useTypedSignature = function() {
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const isDark = document.documentElement.dataset.theme === 'dark'
  ctx.fillStyle = isDark ? '#ffffff' : '#070708'
  ctx.font = "italic 38px 'Caveat', cursive"
  const nombre = state.profile ? `${state.profile.nombre} ${state.profile.apellido || ''}`.trim() : 'Firma'
  ctx.fillText(nombre, 24, 88)
  hasSignature = true
  $('#sig-placeholder').classList.add('hidden')
  $('#canvas-wrap').classList.add('signed')
  markCheck(2)
  $('#sign-btn').disabled = false
}

function markCheck(n) {
  const item = $('#check-' + n)
  if (!item || item.classList.contains('done')) return
  item.classList.add('done')
  const icon = item.querySelector('.check-icon')
  icon.classList.remove('pending')
  icon.classList.add('done')
  icon.innerHTML = '<i data-lucide="check"></i>'
  lucide.createIcons()
  updateProgress()
}
function unmarkCheck(n) {
  const item = $('#check-' + n)
  if (!item) return
  item.classList.remove('done')
  const icon = item.querySelector('.check-icon')
  icon.classList.add('pending')
  icon.classList.remove('done')
  icon.innerHTML = ''
  updateProgress()
}
function updateProgress() {
  const done = $$('.check-item.done').length
  $('#progress-fill').style.width = (done / 3 * 100) + '%'
}

// ────────────────────────────────────────────────────────────────────────────
// FIRMAR CONTRATO (persiste en BD)
// ────────────────────────────────────────────────────────────────────────────
async function getClientIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json')
    const data = await res.json()
    return data.ip
  } catch {
    return null
  }
}

async function hashDocument(text) {
  const enc = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

window.signContract = async function() {
  if (!state.contrato || !canvas || !hasSignature) return

  const btn = $('#sign-btn')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner"></span> Firmando...'

  try {
    // 1. Capturar la firma como dataURL (base64)
    const signatureData = canvas.toDataURL('image/png')

    // 2. Calcular hash del contenido del contrato (para auditoría)
    const contractText = `${state.contrato.empresa_nombre}|${state.contrato.firmante_nombre}|${state.contrato.firmante_cargo}|${state.contrato.lugar}|v1.0`
    const docHash = await hashDocument(contractText)

    // 3. Obtener IP (best effort, puede fallar si bloqueado)
    const ip = await getClientIP()

    // 4. Insertar firma
    const { error: e1 } = await supabase
      .from('contrato_firmas')
      .insert({
        contrato_id: state.contrato.id,
        user_id: state.profile.id,
        nombre_firmante: state.contrato.firmante_nombre,
        cargo: state.contrato.firmante_cargo,
        email: state.profile.email,
        signature_data: signatureData,
        metodo_firma: 'canvas',
        ip_address: ip,
        user_agent: navigator.userAgent,
        signed_at_iso: new Date().toISOString(),
        hash_documento: docHash
      })

    if (e1) throw e1

    // 5. Actualizar contrato a firmado + snapshot de cláusulas
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + (state.contrato.vigencia_meses || 12))

    const { error: e2 } = await supabase
      .from('contratos')
      .update({
        estado: 'firmado',
        signed_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        clausulas_snapshot: {
          version: 'v1.0',
          texto: 'Contrato de Compromiso con la Escalabilidad — 6 cláusulas + Preámbulo',
          firmado_at: new Date().toISOString()
        }
      })
      .eq('id', state.contrato.id)

    if (e2) throw e2

    // 6. UI: mostrar estado firmado
    state.contrato.estado = 'firmado'
    state.contrato.signed_at = new Date().toISOString()

    markCheck(3)

    $('#signed-timestamp').textContent = new Date().toLocaleString('es-MX', {
      dateStyle: 'long', timeStyle: 'short'
    })
    $('#signed-state').style.display = 'block'
    $('#sign-cta').style.display = 'none'

    // Bloquear edición
    $('#contrato-nombre-input').disabled = true
    $('#contrato-empresa-input').disabled = true
    canvas.style.pointerEvents = 'none'
    $('.signature-actions').style.display = 'none'

    $('#signed-state').scrollIntoView({ behavior: 'smooth', block: 'center' })

    // Re-render lista
    renderListView()

  } catch (err) {
    console.error('[rituales] signContract error:', err)
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="pen-tool"></i> Firmar Contrato'
    lucide.createIcons()
    alert('Error al firmar: ' + (err.message || 'desconocido'))
  }
}

// ────────────────────────────────────────────────────────────────────────────
// VIEW 3 — CONSEJO DE ESCALABILIDAD
// ────────────────────────────────────────────────────────────────────────────
function renderConsejoView() {
  if (!state.consejo) {
    $('#consejo-content').innerHTML = `
      <div class="card" style="text-align:center; padding:60px 20px;">
        <h2 style="font-family:'Plus Jakarta Sans',sans-serif; font-size:20px; margin-bottom:12px;">Consejo no configurado</h2>
        <p style="color:var(--text-3);">Contacta a Agustín para configurar tu Consejo de Escalabilidad.</p>
      </div>
    `
    return
  }

  // Render miembros
  const slotsTotal = 3
  const miembrosHtml = []
  const gradients = ['gradient-1', 'gradient-2', 'gradient-3']

  state.miembros.forEach((m, i) => {
    miembrosHtml.push(`
      <div class="miembro-card">
        <div class="miembro-avatar ${gradients[i % 3]}">${initials(`${m.nombre} ${m.apellido || ''}`)}</div>
        <div class="miembro-nombre">${m.nombre} ${m.apellido || ''}</div>
        <div class="miembro-area">${m.area}</div>
        <span class="miembro-tag">Activo</span>
      </div>
    `)
  })

  // Slots vacíos hasta 3
  for (let i = state.miembros.length; i < slotsTotal; i++) {
    miembrosHtml.push(`
      <div class="miembro-card empty">
        <div class="miembro-avatar empty"><i data-lucide="user-plus" style="width:22px;height:22px"></i></div>
        <div class="miembro-nombre">Agregar miembro</div>
        <div class="miembro-area">Por asignar</div>
      </div>
    `)
  }

  $('#miembros-grid').innerHTML = miembrosHtml.join('')

  // Sesiones
  const sesionesHtml = state.sesiones.slice(0, 5).map(s => {
    const isPast = s.estado === 'completada'
    const isUpcoming = s.estado === 'programada'
    const d = new Date(s.fecha_programada)
    const dayNum = d.getDate()
    const monthShort = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()]

    const statusClass = isPast ? 'completed' : isUpcoming ? 'upcoming' : 'scheduled'
    const statusText = isPast ? 'Completada' : isUpcoming ? 'Próxima' : 'Programada'

    const durationMin = s.duracion_min || 90
    const horaIni = fmtTime(s.fecha_programada)
    const dEnd = new Date(d.getTime() + durationMin * 60000)
    const horaFin = `${String(dEnd.getHours()).padStart(2,'0')}:${String(dEnd.getMinutes()).padStart(2,'0')}`

    return `
      <div class="calendar-item">
        <div class="calendar-date ${isPast ? 'past' : ''}">
          <div class="calendar-date-day">${dayNum}</div>
          <div class="calendar-date-month">${monthShort}</div>
        </div>
        <div class="calendar-info">
          <div class="calendar-title">${s.titulo}</div>
          <div class="calendar-meta">
            <span><i data-lucide="clock"></i> ${horaIni} — ${horaFin}</span>
            <span><i data-lucide="${isPast ? 'file-text' : 'users'}"></i> ${isPast ? 'Acta firmada' : `${state.miembros.length} miembros`}</span>
          </div>
        </div>
        <span class="calendar-status ${statusClass}">${statusText}</span>
      </div>
    `
  }).join('')

  $('#sesiones-list').innerHTML = sesionesHtml || '<div style="font-size:13px; color:var(--text-3); padding:12px 0;">Sin sesiones programadas.</div>'

  // Pago pendiente
  const pagoPendiente = state.pagos.find(p => p.estado === 'pendiente')
  if (pagoPendiente) {
    $('#pago-amount').textContent = fmtMoney(pagoPendiente.monto, pagoPendiente.moneda)
    $('#pago-period').textContent = `${pagoPendiente.moneda} · ${pagoPendiente.trimestre} ${pagoPendiente.ano}`

    const venceTexto = pagoPendiente.fecha_vencimiento
      ? `Vence el ${new Date(pagoPendiente.fecha_vencimiento).toLocaleDateString('es-MX', { day:'numeric', month:'long' })}`
      : 'Sin fecha de vencimiento'
    $('#pago-vence').textContent = venceTexto
    $('#pago-card').style.display = 'block'
  } else {
    $('#pago-card').style.display = 'none'
  }

  // Cuota base
  $('#cuota-base').textContent = fmtMoney(state.consejo.cuota_trimestral, state.consejo.cuota_moneda)

  // Historial de pagos pagados
  const pagados = state.pagos.filter(p => p.estado === 'pagado')
  $('#pago-historial').innerHTML = pagados.length > 0
    ? pagados.map(p => `
        <div class="payment-history-item">
          <span>${p.trimestre} ${p.ano}</span>
          <span style="color:var(--green); font-weight:700;">Pagado</span>
        </div>
      `).join('')
    : '<div style="font-size:12px; color:var(--text-3);">Sin pagos previos</div>'

  lucide.createIcons()
}

// ────────────────────────────────────────────────────────────────────────────
// HEADER
// ────────────────────────────────────────────────────────────────────────────
function renderHeader() {
  const avatar = initials(`${state.profile?.nombre || ''} ${state.profile?.apellido || ''}`)
  $$('.user-avatar').forEach(el => el.textContent = avatar)
}

// ────────────────────────────────────────────────────────────────────────────
// THEME / LOGOUT
// ────────────────────────────────────────────────────────────────────────────
window.toggleTheme = function() {
  const html = document.documentElement
  const next = html.dataset.theme === 'dark' ? 'light' : 'dark'
  html.dataset.theme = next
  localStorage.setItem('scalex-theme', next)
  const icon = $('#theme-icon')
  if (icon) {
    icon.setAttribute('data-lucide', next === 'dark' ? 'sun' : 'moon')
    lucide.createIcons()
  }
  // Re-init canvas con nuevo color si está en contrato
  if ($('#view-contrato').classList.contains('active') && canvasInitialized && state.contrato?.estado !== 'firmado') {
    initCanvas()
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
    const [profile, org] = await Promise.all([
      getMyProfile(),
      getMyOrganization()
    ])

    state.profile = profile
    state.org = org

    if (!org) {
      $('.content').innerHTML = `
        <div style="text-align:center; padding:60px 20px;">
          <h2 style="font-family:'Plus Jakarta Sans',sans-serif; font-size:22px; margin-bottom:12px;">Sin organización asignada</h2>
          <p style="color:var(--text-3);">Contacta a Agustín.</p>
        </div>
      `
      return
    }

    renderHeader()

    const [contrato, consejoData] = await Promise.all([
      loadContrato(org.id),
      loadConsejoData(org.id)
    ])

    state.contrato = contrato
    state.consejo = consejoData.consejo
    state.miembros = consejoData.miembros
    state.sesiones = consejoData.sesiones
    state.pagos = consejoData.pagos

    // Setup listeners de inputs editables
    $('#contrato-nombre-input')?.addEventListener('input', onContratoFieldChange)
    $('#contrato-empresa-input')?.addEventListener('input', onContratoFieldChange)

    // Render inicial
    renderListView()
    showView('list')

    lucide.createIcons()

  } catch (err) {
    console.error('[rituales] init error:', err)
  }
}

init()
