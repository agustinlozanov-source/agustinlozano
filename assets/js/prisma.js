// ============================================================================
// SCALEx PORTAL - PRISMA v2 - Con Plan de Accion Trackeable
// ============================================================================
// Pilar 1 - Reflejo - Herramienta 3
// Vistas: loading / sin-requisitos / listo / resultado
// Resultado ahora incluye acciones desplegables (CRUD) por horizonte 7/30/90
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
  if (!name) return '..'
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase()
}

// ─────────────────────────────────────────────────────────────────────
// PERFILES PRISMA
// ─────────────────────────────────────────────────────────────────────
const PRISMA_PERFILES = {
  lider_estrategico: {
    nombre: 'Lider Estrategico',
    color: 'green',
    icono: 'star',
    descripcion_larga: 'Estas listo para escalar. Tu vision es clara, tomas decisiones estrategicas y tu empresa puede crecer sin depender exclusivamente de ti. El reto ahora es expandir manteniendo el control.',
    estrategia: 'Expansion controlada',
    urgencia: 'Optimizar y escalar'
  },
  lider_estancado: {
    nombre: 'Lider Estancado',
    color: 'amber',
    icono: 'pause-circle',
    descripcion_larga: 'Tienes orden y procesos, pero la empresa no esta creciendo financieramente. Hay que revisar modelo de negocio, propuesta de valor y donde estan los cuellos de botella reales para la rentabilidad.',
    estrategia: 'Revisar modelo de negocio',
    urgencia: 'Romper el techo financiero'
  },
  lider_agotado: {
    nombre: 'Lider Agotado',
    color: 'amber',
    icono: 'battery-low',
    descripcion_larga: 'La empresa esta creciendo pero el equipo y los procesos no estan listos. Tu sigues siendo el cuello de botella y la presion se va a sentir cada vez mas. Hay que delegar y estructurar antes de que colapses tu o la operacion.',
    estrategia: 'Delegar y estructurar urgente',
    urgencia: 'Evitar el colapso'
  },
  lider_supervivencia: {
    nombre: 'Lider en Supervivencia',
    color: 'red',
    icono: 'flame',
    descripcion_larga: 'Tu empresa esta atrapada en modo supervivencia. Faltan los fundamentos: vision clara, procesos, control financiero. La buena noticia: estas viendo esto. El primer paso es decidir tomar las riendas estructuradamente.',
    estrategia: 'Reestructurar desde la base',
    urgencia: 'Detener el sangrado'
  }
}

const PIE_PERFIL_NOMBRES = {
  'lider_estrategico': 'Lider Estrategico',
  'lider_transicion': 'Lider en Transicion',
  'lider_operativo': 'Lider Operativo',
  'lider_reactivo': 'Lider Reactivo'
}
const MAPE_CUADRANTE_NOMBRES = {
  'crecimiento_escalable': 'Crecimiento Escalable',
  'crecimiento_fragil': 'Crecimiento Fragil',
  'financiero_estancado': 'Financiero Estancado',
  'zona_estancamiento': 'Zona de Estancamiento'
}

const ESTADO_LABELS = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  hecha: 'Hecha',
  descartada: 'Descartada'
}

const ESTADO_ICONS = {
  pendiente: 'circle',
  en_progreso: 'circle-dot',
  hecha: 'check-circle-2',
  descartada: 'x-circle'
}

let state = {
  org: null,
  profile: null,
  requisitos: null,
  ultimoSnapshot: null,
  historial: [],
  vistaActual: 'loading',
  // Acciones
  acciones: [],          // array de acciones del snapshot actual
  stats: null,            // stats de progreso
  expandedHorizontes: { 7: true, 30: false, 90: false },  // estado de los desplegables
  editingAccion: null     // accion siendo editada en modal
}

// ────────────────────────────────────────────────────────────────────────────
// SUPABASE - PRISMA
// ────────────────────────────────────────────────────────────────────────────

async function loadRequisitos(orgId) {
  const { data, error } = await supabase.rpc('prisma_requisitos', { p_org_id: orgId })
  if (error) { console.error('[prisma] requisitos', error); return null }
  return data
}

async function loadHistorial(orgId) {
  const { data, error } = await supabase
    .from('prisma_snapshots')
    .select('*')
    .eq('organizacion_id', orgId)
    .eq('usuario_id', state.profile?.id)
    .order('generado_en', { ascending: false })
    .limit(10)
  if (error) { console.error('[prisma] historial', error); return [] }
  return data || []
}

async function generarPrisma(pieId, mapeId) {
  const { data, error } = await supabase.rpc('prisma_generar', {
    p_pie_eval_id: pieId,
    p_mape_eval_id: mapeId
  })
  if (error) { console.error('[prisma] generar', error); return null }
  return data
}

async function loadSnapshotCompleto(snapshotId) {
  const { data, error } = await supabase
    .from('prisma_snapshots').select('*').eq('id', snapshotId).single()
  if (error) { console.error('[prisma] load snapshot', error); return null }
  return data
}

async function guardarNotas(snapshotId, notas) {
  const { error } = await supabase
    .from('prisma_snapshots').update({ notas_consultor: notas }).eq('id', snapshotId)
  return !error
}

// ────────────────────────────────────────────────────────────────────────────
// SUPABASE - ACCIONES
// ────────────────────────────────────────────────────────────────────────────

async function loadAcciones(snapshotId) {
  const { data, error } = await supabase
    .from('prisma_acciones')
    .select('*')
    .eq('prisma_snapshot_id', snapshotId)
    .order('horizonte', { ascending: true })
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) { console.error('[acciones] load', error); return [] }
  return data || []
}

async function loadStats(snapshotId) {
  const { data, error } = await supabase.rpc('prisma_acciones_stats', { p_snapshot_id: snapshotId })
  if (error) { console.error('[acciones] stats', error); return null }
  return data
}

async function crearAccion(payload) {
  const { data, error } = await supabase
    .from('prisma_acciones')
    .insert(payload)
    .select('*').single()
  if (error) { console.error('[acciones] crear', error); return null }
  return data
}

async function actualizarAccion(id, payload) {
  const { data, error } = await supabase
    .from('prisma_acciones')
    .update(payload)
    .eq('id', id)
    .select('*').single()
  if (error) { console.error('[acciones] actualizar', error); return null }
  return data
}

async function eliminarAccion(id) {
  const { error } = await supabase.from('prisma_acciones').delete().eq('id', id)
  return !error
}

async function cambiarEstado(id, nuevoEstado) {
  const { data, error } = await supabase
    .from('prisma_acciones')
    .update({ estado: nuevoEstado })
    .eq('id', id)
    .select('*').single()
  if (error) { console.error('[acciones] estado', error); return null }
  return data
}

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatFecha(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatFechaCorta(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

function isVencida(fechaLimite, estado) {
  if (!fechaLimite || estado === 'hecha' || estado === 'descartada') return false
  return new Date(fechaLimite) < new Date(new Date().toDateString())
}

function cambiarVista(nueva) {
  state.vistaActual = nueva
  $$('.view').forEach(v => v.classList.remove('active'))
  const el = $('#view-' + nueva)
  if (el) el.classList.add('active')
  if (window.lucide) lucide.createIcons()
  const content = $('.content')
  if (content) content.scrollTop = 0
}

function getAccionesPorHorizonte(horizonte) {
  return state.acciones.filter(a => a.horizonte === horizonte)
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: SIN REQUISITOS
// ────────────────────────────────────────────────────────────────────────────

function renderSinRequisitos() {
  const req = state.requisitos
  const piePill = $('#req-pie-pill')
  const mapePill = $('#req-mape-pill')

  if (req.tiene_pie) {
    piePill.classList.add('done')
    piePill.querySelector('.req-pill-status').innerHTML = '<i data-lucide="check-circle"></i><span>Completado: ' + (PIE_PERFIL_NOMBRES[req.pie_perfil] || req.pie_perfil) + '</span>'
    piePill.querySelector('.req-pill-action').style.display = 'none'
  } else {
    piePill.classList.remove('done')
    piePill.querySelector('.req-pill-status').innerHTML = '<i data-lucide="circle"></i><span>Pendiente de completar</span>'
    piePill.querySelector('.req-pill-action').style.display = 'inline-flex'
  }

  if (req.tiene_mape) {
    mapePill.classList.add('done')
    mapePill.querySelector('.req-pill-status').innerHTML = '<i data-lucide="check-circle"></i><span>Completado: ' + (MAPE_CUADRANTE_NOMBRES[req.mape_cuadrante] || req.mape_cuadrante) + '</span>'
    mapePill.querySelector('.req-pill-action').style.display = 'none'
  } else {
    mapePill.classList.remove('done')
    mapePill.querySelector('.req-pill-status').innerHTML = '<i data-lucide="circle"></i><span>Pendiente de completar</span>'
    mapePill.querySelector('.req-pill-action').style.display = 'inline-flex'
  }
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: LISTO PARA GENERAR
// ────────────────────────────────────────────────────────────────────────────

function renderListo() {
  const req = state.requisitos
  $('#listo-pie-fecha').textContent = formatFecha(req.pie_fecha)
  $('#listo-pie-perfil').textContent = PIE_PERFIL_NOMBRES[req.pie_perfil] || req.pie_perfil
  $('#listo-mape-fecha').textContent = formatFecha(req.mape_fecha)
  $('#listo-mape-cuadrante').textContent = MAPE_CUADRANTE_NOMBRES[req.mape_cuadrante] || req.mape_cuadrante

  if (state.historial.length > 0) {
    $('#listo-historial-wrap').style.display = 'block'
    renderHistorial()
  } else {
    $('#listo-historial-wrap').style.display = 'none'
  }
}

function renderHistorial() {
  const wrap = $('#listo-historial-list')
  if (!wrap) return

  wrap.innerHTML = state.historial.map(s => {
    const perfil = PRISMA_PERFILES[s.perfil_prisma]
    return '<div class="hist-item">' +
      '<div class="hist-icon ' + (perfil?.color || 'green') + '"><i data-lucide="' + (perfil?.icono || 'star') + '"></i></div>' +
      '<div class="hist-body">' +
        '<div class="hist-perfil">' + escapeHtml(perfil?.nombre || s.perfil_prisma) + '</div>' +
        '<div class="hist-fecha">' + formatFecha(s.generado_en) + '</div>' +
      '</div>' +
      '<button class="btn btn-ghost btn-sm" data-id="' + s.id + '"><i data-lucide="eye"></i><span>Ver</span></button>' +
    '</div>'
  }).join('')

  wrap.querySelectorAll('[data-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const snap = await loadSnapshotCompleto(btn.dataset.id)
      if (snap) {
        state.ultimoSnapshot = snap
        await loadAccionesData()
        renderResultado()
        cambiarVista('resultado')
      }
    })
  })
}

// ────────────────────────────────────────────────────────────────────────────
// VISTA: RESULTADO (refresca acciones)
// ────────────────────────────────────────────────────────────────────────────

async function loadAccionesData() {
  if (!state.ultimoSnapshot) return
  const [acc, stats] = await Promise.all([
    loadAcciones(state.ultimoSnapshot.id),
    loadStats(state.ultimoSnapshot.id)
  ])
  state.acciones = acc
  state.stats = stats
}

function renderResultado() {
  const s = state.ultimoSnapshot
  if (!s) return

  const perfil = PRISMA_PERFILES[s.perfil_prisma] || PRISMA_PERFILES.lider_supervivencia

  // Hero
  $('#result-perfil-nombre').textContent = perfil.nombre
  $('#result-perfil-desc').textContent = perfil.descripcion_larga
  $('#result-fecha').textContent = formatFecha(s.generado_en)
  const iconEl = $('#result-perfil-icon')
  if (iconEl) iconEl.innerHTML = '<i data-lucide="' + perfil.icono + '"></i>'

  const hero = $('#result-hero')
  hero.className = 'result-hero ' + (perfil.color || 'green')

  // Progress global en el hero
  renderProgresoHero()

  // Origen
  $('#result-pie-perfil').textContent = PIE_PERFIL_NOMBRES[s.pie_perfil] || s.pie_perfil
  $('#result-pie-puntaje').textContent = s.pie_puntaje_total + ' / 100'
  $('#result-mape-cuadrante').textContent = MAPE_CUADRANTE_NOMBRES[s.mape_cuadrante] || s.mape_cuadrante
  $('#result-mape-puntajes').textContent = 'F: ' + s.mape_puntaje_financiero + ' / O: ' + s.mape_puntaje_operativo

  // Badges
  $('#result-estrategia').textContent = perfil.estrategia
  $('#result-urgencia').textContent = perfil.urgencia

  // Plan 7-30-90 (textos guia)
  $('#plan-7-text').textContent = s.plan_7_dias || '-'
  $('#plan-30-text').textContent = s.plan_30_dias || '-'
  $('#plan-90-text').textContent = s.plan_90_dias || '-'

  // Acciones por horizonte
  renderHorizonte(7)
  renderHorizonte(30)
  renderHorizonte(90)

  // Notas
  const notasEl = $('#result-notas')
  if (notasEl) notasEl.value = s.notas_consultor || ''

  if (window.lucide) lucide.createIcons()
}

function renderProgresoHero() {
  const stats = state.stats
  if (!stats) {
    $('#result-progress-line').style.display = 'none'
    return
  }

  const total = stats.total - stats.descartadas
  $('#result-progress-line').style.display = 'flex'

  if (total === 0) {
    $('#result-progress-text').textContent = 'Aun no tienes acciones registradas. Despliega los horizontes y crea las primeras.'
    $('#result-progress-fill').style.width = '0%'
    $('#result-progress-pct').textContent = ''
    return
  }

  $('#result-progress-text').textContent = stats.hechas + ' de ' + total + ' acciones completadas'
  $('#result-progress-fill').style.width = stats.progreso_pct + '%'
  $('#result-progress-pct').textContent = stats.progreso_pct + '%'
}

function renderHorizonte(horizonte) {
  const acciones = getAccionesPorHorizonte(horizonte)
  const card = $('#plan-' + horizonte + '-card')
  const listWrap = $('#plan-' + horizonte + '-acciones')
  const stats = state.stats?.['horizonte_' + horizonte] || { total: 0, hechas: 0, pct: 0 }

  // Stats badge en el header del horizonte
  const statsBadge = $('#plan-' + horizonte + '-stats')
  if (statsBadge) {
    if (stats.total > 0) {
      statsBadge.style.display = 'inline-flex'
      statsBadge.innerHTML = '<span class="stats-num">' + stats.hechas + '/' + stats.total + '</span><div class="stats-mini-bar"><div class="stats-mini-fill" style="width:' + stats.pct + '%"></div></div>'
    } else {
      statsBadge.style.display = 'none'
    }
  }

  // Expandido o colapsado
  const expanded = state.expandedHorizontes[horizonte]
  card.classList.toggle('expanded', expanded)

  if (!expanded) {
    listWrap.innerHTML = ''
    return
  }

  // Lista de acciones + boton agregar
  let html = ''

  if (acciones.length === 0) {
    html += '<div class="acciones-empty">' +
      '<p>Aun no hay acciones concretas para este horizonte. Convierte la guia en pasos especificos.</p>' +
    '</div>'
  } else {
    html += '<div class="acciones-list">'
    acciones.forEach(a => {
      const vencida = isVencida(a.fecha_limite, a.estado)
      const estadoCls = a.estado + (vencida ? ' vencida' : '')

      html += '<div class="accion-item ' + estadoCls + '" data-id="' + a.id + '">' +
        '<button class="accion-check" data-action="toggle-estado" data-id="' + a.id + '" title="Cambiar estado">' +
          '<i data-lucide="' + ESTADO_ICONS[a.estado] + '"></i>' +
        '</button>' +
        '<div class="accion-body">' +
          '<div class="accion-titulo">' + escapeHtml(a.titulo) + '</div>' +
          (a.descripcion ? '<div class="accion-desc">' + escapeHtml(a.descripcion) + '</div>' : '') +
          '<div class="accion-meta">'

      if (a.fecha_limite) {
        html += '<span class="accion-meta-item ' + (vencida ? 'vencida' : '') + '">' +
          '<i data-lucide="calendar"></i>' +
          formatFechaCorta(a.fecha_limite) +
        '</span>'
      }

      html += '<span class="accion-meta-item estado-' + a.estado + '">' +
        '<i data-lucide="' + ESTADO_ICONS[a.estado] + '"></i>' +
        ESTADO_LABELS[a.estado] +
      '</span>'

      if (a.impacto_esperado) {
        html += '<span class="accion-meta-item"><i data-lucide="target"></i>Con impacto</span>'
      }
      if (a.evidencia) {
        html += '<span class="accion-meta-item"><i data-lucide="paperclip"></i>Con evidencia</span>'
      }

      html += '</div>' +
        '</div>' +
        '<div class="accion-actions">' +
          '<button class="accion-btn" data-action="edit" data-id="' + a.id + '" title="Editar"><i data-lucide="edit-2"></i></button>' +
          '<button class="accion-btn danger" data-action="delete" data-id="' + a.id + '" title="Eliminar"><i data-lucide="trash-2"></i></button>' +
        '</div>' +
      '</div>'
    })
    html += '</div>'
  }

  // Boton agregar
  html += '<button class="btn-add-accion" data-action="add" data-horizonte="' + horizonte + '">' +
    '<i data-lucide="plus"></i>' +
    '<span>Agregar accion concreta</span>' +
  '</button>'

  listWrap.innerHTML = html

  // Listeners
  listWrap.querySelectorAll('[data-action="toggle-estado"]').forEach(btn => {
    btn.addEventListener('click', () => onToggleEstado(btn.dataset.id))
  })
  listWrap.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => openModalEditar(btn.dataset.id))
  })
  listWrap.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => onEliminarAccion(btn.dataset.id))
  })
  listWrap.querySelectorAll('[data-action="add"]').forEach(btn => {
    btn.addEventListener('click', () => openModalCrear(parseInt(btn.dataset.horizonte)))
  })

  if (window.lucide) lucide.createIcons()
}

// ────────────────────────────────────────────────────────────────────────────
// HORIZONTES (expand/collapse)
// ────────────────────────────────────────────────────────────────────────────

function toggleHorizonte(horizonte) {
  state.expandedHorizontes[horizonte] = !state.expandedHorizontes[horizonte]
  renderHorizonte(horizonte)
}

// ────────────────────────────────────────────────────────────────────────────
// MODAL DE ACCION
// ────────────────────────────────────────────────────────────────────────────

function openModalCrear(horizonte) {
  state.editingAccion = null
  $('#modal-titulo').textContent = 'Nueva accion'
  $('#modal-submit-text').textContent = 'Crear accion'
  $('#input-horizonte').value = horizonte
  $('#input-titulo').value = ''
  $('#input-descripcion').value = ''
  $('#input-fecha-limite').value = ''
  $('#input-impacto').value = ''
  $('#input-evidencia').value = ''
  $('#input-estado').value = 'pendiente'

  // Cambiar el header del modal con badge del horizonte
  $('#modal-horizonte-badge').textContent = horizonte + ' DIAS'
  $('#modal-horizonte-badge').className = 'modal-horizonte-badge h-' + horizonte

  $('#modal-backdrop').classList.add('active')
  setTimeout(() => $('#input-titulo').focus(), 50)
  if (window.lucide) lucide.createIcons()
}

function openModalEditar(accionId) {
  const accion = state.acciones.find(a => a.id === accionId)
  if (!accion) return

  state.editingAccion = accion
  $('#modal-titulo').textContent = 'Editar accion'
  $('#modal-submit-text').textContent = 'Guardar cambios'
  $('#input-horizonte').value = accion.horizonte
  $('#input-titulo').value = accion.titulo || ''
  $('#input-descripcion').value = accion.descripcion || ''
  $('#input-fecha-limite').value = accion.fecha_limite || ''
  $('#input-impacto').value = accion.impacto_esperado || ''
  $('#input-evidencia').value = accion.evidencia || ''
  $('#input-estado').value = accion.estado || 'pendiente'

  $('#modal-horizonte-badge').textContent = accion.horizonte + ' DIAS'
  $('#modal-horizonte-badge').className = 'modal-horizonte-badge h-' + accion.horizonte

  $('#modal-backdrop').classList.add('active')
  setTimeout(() => $('#input-titulo').focus(), 50)
  if (window.lucide) lucide.createIcons()
}

function closeModal() {
  $('#modal-backdrop').classList.remove('active')
  state.editingAccion = null
}

async function submitAccion(e) {
  e.preventDefault()

  const titulo = $('#input-titulo').value.trim()
  if (!titulo) {
    showToast('El titulo es obligatorio', 'error')
    $('#input-titulo').focus()
    return
  }

  const payload = {
    titulo: titulo,
    descripcion: $('#input-descripcion').value.trim() || null,
    fecha_limite: $('#input-fecha-limite').value || null,
    impacto_esperado: $('#input-impacto').value.trim() || null,
    evidencia: $('#input-evidencia').value.trim() || null,
    estado: $('#input-estado').value || 'pendiente'
  }

  const btn = $('#modal-submit-btn')
  btn.disabled = true
  const originalHtml = btn.innerHTML
  btn.innerHTML = '<div class="spinner"></div><span>Guardando...</span>'

  let result
  if (state.editingAccion) {
    result = await actualizarAccion(state.editingAccion.id, payload)
  } else {
    const horizonte = parseInt($('#input-horizonte').value)
    result = await crearAccion({
      ...payload,
      horizonte,
      prisma_snapshot_id: state.ultimoSnapshot.id,
      organizacion_id: state.org.id,
      usuario_id: state.profile.id
    })
  }

  btn.disabled = false
  btn.innerHTML = originalHtml
  if (window.lucide) lucide.createIcons()

  if (!result) {
    showToast('Error al guardar', 'error')
    return
  }

  closeModal()
  await loadAccionesData()
  renderResultado()
  showToast(state.editingAccion ? 'Accion actualizada' : 'Accion creada', 'success')
}

async function onEliminarAccion(accionId) {
  const accion = state.acciones.find(a => a.id === accionId)
  if (!accion) return
  if (!confirm('Eliminar "' + accion.titulo + '"? Esta accion no se puede deshacer.')) return

  const ok = await eliminarAccion(accionId)
  if (!ok) {
    showToast('Error al eliminar', 'error')
    return
  }

  await loadAccionesData()
  renderResultado()
  showToast('Accion eliminada', 'success')
}

async function onToggleEstado(accionId) {
  const accion = state.acciones.find(a => a.id === accionId)
  if (!accion) return

  // Ciclo: pendiente -> en_progreso -> hecha -> pendiente
  const ciclo = { pendiente: 'en_progreso', en_progreso: 'hecha', hecha: 'pendiente', descartada: 'pendiente' }
  const nuevo = ciclo[accion.estado] || 'pendiente'

  const result = await cambiarEstado(accionId, nuevo)
  if (!result) {
    showToast('Error al cambiar estado', 'error')
    return
  }

  await loadAccionesData()
  renderResultado()
}

// ────────────────────────────────────────────────────────────────────────────
// GENERAR PRISMA
// ────────────────────────────────────────────────────────────────────────────

async function onGenerar() {
  const btn = $('#btn-generar')
  btn.disabled = true
  btn.innerHTML = '<div class="spinner"></div><span>Generando PRISMA...</span>'

  const result = await generarPrisma(state.requisitos.pie_id, state.requisitos.mape_id)
  if (!result) {
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="sparkles"></i><span>Generar mi PRISMA</span>'
    if (window.lucide) lucide.createIcons()
    showToast('Error al generar PRISMA', 'error')
    return
  }

  const snap = await loadSnapshotCompleto(result.id)
  if (snap) {
    state.ultimoSnapshot = snap
    state.historial = await loadHistorial(state.org.id)
    await loadAccionesData()
    renderResultado()
    cambiarVista('resultado')
  }
}

// ────────────────────────────────────────────────────────────────────────────
// NOTAS (autosave)
// ────────────────────────────────────────────────────────────────────────────

async function onGuardarNotas() {
  if (!state.ultimoSnapshot) return
  const notas = $('#result-notas').value
  const ok = await guardarNotas(state.ultimoSnapshot.id, notas)
  if (ok) {
    state.ultimoSnapshot.notas_consultor = notas
    showToast('Notas guardadas', 'success')
  }
}

// ────────────────────────────────────────────────────────────────────────────
// UI
// ────────────────────────────────────────────────────────────────────────────

function showToast(message, type = 'info') {
  const t = $('#toast')
  if (!t) return
  t.className = 'toast ' + type + ' show'
  t.textContent = message
  setTimeout(() => t.classList.remove('show'), 2500)
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
window.toggleHorizonte = toggleHorizonte
window.closeModal = closeModal

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────

async function init() {
  try {
    const [profile, org] = await Promise.all([getMyProfile(), getMyOrganization()])
    state.profile = profile
    state.org = org

    if (!org) {
      $('.content').innerHTML = '<div class="empty-state-big"><h2>Sin organizacion asignada</h2></div>'
      return
    }

    const avatar = initials((profile?.nombre || '') + ' ' + (profile?.apellido || ''))
    $$('.user-avatar').forEach(el => el.textContent = avatar)

    const [requisitos, historial] = await Promise.all([
      loadRequisitos(org.id),
      loadHistorial(org.id)
    ])
    state.requisitos = requisitos
    state.historial = historial

    if (historial.length > 0) {
      state.ultimoSnapshot = historial[0]
      await loadAccionesData()
      renderResultado()
      cambiarVista('resultado')
    } else if (requisitos && requisitos.puede_generar) {
      renderListo()
      cambiarVista('listo')
    } else {
      renderSinRequisitos()
      cambiarVista('sin-requisitos')
    }

    // Listeners
    $('#btn-generar')?.addEventListener('click', onGenerar)
    $('#btn-generar-nuevo')?.addEventListener('click', async () => {
      state.requisitos = await loadRequisitos(org.id)
      if (state.requisitos && state.requisitos.puede_generar) {
        renderListo()
        cambiarVista('listo')
      } else {
        renderSinRequisitos()
        cambiarVista('sin-requisitos')
      }
    })

    // Notas autosave
    const notasEl = $('#result-notas')
    if (notasEl) {
      let timeout
      notasEl.addEventListener('input', () => {
        clearTimeout(timeout)
        timeout = setTimeout(onGuardarNotas, 1200)
      })
    }

    // Modal submit
    $('#modal-form')?.addEventListener('submit', submitAccion)
    $('#modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') closeModal()
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#modal-backdrop').classList.contains('active')) {
        closeModal()
      }
    })

    if (window.lucide) lucide.createIcons()

  } catch (err) {
    console.error('[prisma] init error:', err)
  }
}

init()
