// configuracion.js — SCALEx Portal · Centro de Configuración

import { supabase, getMyProfile } from '/assets/js/supabase-client.js'

let perfil = null
let esAdmin = false
let esDueno = false
let miOrgId = null
let miOrgNombre = null

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  perfil = await getMyProfile()
  if (!perfil) return

  esAdmin = perfil.rol_global === 'admin'

  // Detectar si es dueño de alguna org
  const { data: orgDueno } = await supabase.rpc('mi_organizacion_como_dueno')
  if (orgDueno && orgDueno.length > 0) {
    esDueno = true
    miOrgId = orgDueno[0].id
    miOrgNombre = orgDueno[0].nombre
  }

  const nombreUsuario = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ') || perfil.email
  document.getElementById('topbar-sub').textContent = nombreUsuario

  renderTabs()
  renderContenido()
})

// ──────────────────────────────────────────────
// TABS
// ──────────────────────────────────────────────
function renderTabs() {
  const tabsBar = document.getElementById('tabs-bar')
  const tabs = []

  if (esAdmin) {
    tabs.push({ id: 'tab-orgs', icon: 'building-2', label: 'Organizaciones' })
  }
  if (esDueno) {
    tabs.push({ id: 'tab-equipo', icon: 'users', label: 'Mi Equipo' })
  }
  tabs.push({ id: 'tab-cuenta', icon: 'user', label: 'Mi cuenta' })

  tabsBar.innerHTML = tabs.map((t, i) =>
    `<button class="tab-btn ${i === 0 ? 'active' : ''}" id="${t.id}" onclick="activarTab('${t.id}')">
      <i data-lucide="${t.icon}"></i> ${t.label}
    </button>`
  ).join('')

  lucide.createIcons()
}

window.activarTab = function(id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.id === id))
  renderContenido(id)
}

function tabActivo() {
  return document.querySelector('.tab-btn.active')?.id
}

// ──────────────────────────────────────────────
// RENDER CONTENIDO SEGÚN TAB
// ──────────────────────────────────────────────
async function renderContenido(tabId) {
  tabId = tabId || tabActivo()
  const content = document.getElementById('main-content')

  if (tabId === 'tab-orgs' && esAdmin) {
    await renderSeccionOrgs(content)
  } else if (tabId === 'tab-equipo' && esDueno) {
    await renderSeccionEquipo(content)
  } else {
    renderSeccionCuenta(content)
  }
}

// ──────────────────────────────────────────────
// SECCIÓN A — ORGANIZACIONES (Admin)
// ──────────────────────────────────────────────
async function renderSeccionOrgs(content) {
  content.innerHTML = `
    <div class="section-header">
      <div class="section-title">Organizaciones</div>
      <button class="btn-primary" onclick="abrirModalNuevaOrg()">
        <i data-lucide="plus"></i> Nueva organización con dueño
      </button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Dueño</th>
            <th>Email</th>
            <th>Ciudad</th>
            <th>Sector</th>
            <th>Creada</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="orgs-tbody">
          <tr class="empty-row"><td colspan="7">Cargando organizaciones…</td></tr>
        </tbody>
      </table>
    </div>`
  lucide.createIcons()
  await cargarOrgs()
}

async function cargarOrgs() {
  const { data, error } = await supabase.rpc('listar_organizaciones_admin')
  const tbody = document.getElementById('orgs-tbody')
  if (!tbody) return

  if (error) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Error: ${error.message}</td></tr>`
    return
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Sin organizaciones registradas</td></tr>`
    return
  }

  tbody.innerHTML = data.map(org => `
    <tr>
      <td>
        <div class="td-main">${escHtml(org.nombre || '—')}</div>
      </td>
      <td>${escHtml(org.dueno_nombre || '—')}</td>
      <td style="font-size:12px;color:var(--text-3)">${escHtml(org.dueno_email || '—')}</td>
      <td style="color:var(--text-3)">${escHtml(org.ciudad || '—')}</td>
      <td style="color:var(--text-3)">${escHtml(org.sector || '—')}</td>
      <td style="color:var(--text-4);font-size:11px">${formatFecha(org.created_at)}</td>
      <td>
        <button class="btn-ghost" style="font-size:11px;padding:5px 10px" onclick="toggleEquipoOrg('${org.id}', this)">
          <i data-lucide="users"></i> Equipo
        </button>
      </td>
    </tr>
    <tr class="org-detail-row" id="detail-${org.id}">
      <td class="org-detail-cell" colspan="7">
        <div class="org-detail-inner">
          <div class="org-detail-title">Equipo de ${escHtml(org.nombre)}</div>
          <div class="mini-team" id="mini-team-${org.id}">
            <span style="font-size:12px;color:var(--text-4)">Cargando…</span>
          </div>
        </div>
      </td>
    </tr>`
  ).join('')
  lucide.createIcons()
}

window.toggleEquipoOrg = async function(orgId, btn) {
  const detailRow = document.getElementById(`detail-${orgId}`)
  if (!detailRow) return
  const isOpen = detailRow.classList.toggle('open')
  if (!isOpen) return

  const { data, error } = await supabase.rpc('listar_equipo_org', { p_org_id: orgId })
  const container = document.getElementById(`mini-team-${orgId}`)
  if (!container) return

  if (error || !data || data.length === 0) {
    container.innerHTML = '<span style="font-size:12px;color:var(--text-4)">Sin miembros registrados</span>'
    return
  }

  container.innerHTML = data.map(m => {
    const iniciales = getIniciales(m.nombre, m.apellido)
    return `<div class="mini-member">
      <div class="mini-avatar">${iniciales}</div>
      <div>
        <div class="mini-name">${escHtml([m.nombre, m.apellido].filter(Boolean).join(' ') || m.email)}</div>
        <div class="mini-cargo">${escHtml(m.cargo || m.rol_en_org || '')}</div>
      </div>
    </div>`
  }).join('')
}

// Modal nueva org
window.abrirModalNuevaOrg = function() {
  ['org-nombre','org-sector','org-ciudad','dueno-nombre','dueno-apellido','dueno-email','dueno-password']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = '' })
  document.getElementById('modal-org-error').style.display = 'none'
  document.getElementById('modal-nueva-org').classList.add('open')
  lucide.createIcons()
}

window.crearOrganizacion = async function() {
  const btn = document.getElementById('btn-crear-org')
  const errEl = document.getElementById('modal-org-error')
  errEl.style.display = 'none'

  const orgNombre = document.getElementById('org-nombre').value.trim()
  const orgSector = document.getElementById('org-sector').value.trim()
  const orgCiudad = document.getElementById('org-ciudad').value.trim()
  const nombre = document.getElementById('dueno-nombre').value.trim()
  const apellido = document.getElementById('dueno-apellido').value.trim()
  const email = document.getElementById('dueno-email').value.trim()
  const password = document.getElementById('dueno-password').value.trim()

  if (!orgNombre) return mostrarErrorModal('modal-org-error', 'El nombre de la empresa es obligatorio')
  if (!nombre) return mostrarErrorModal('modal-org-error', 'El nombre del dueño es obligatorio')
  if (!email || !email.includes('@')) return mostrarErrorModal('modal-org-error', 'Email inválido')
  if (password.length < 6) return mostrarErrorModal('modal-org-error', 'La contraseña debe tener al menos 6 caracteres')

  btn.disabled = true
  btn.innerHTML = '<i data-lucide="loader"></i> Creando…'
  lucide.createIcons()

  const { data, error } = await supabase.functions.invoke('crear-usuario', {
    body: { modo: 'cliente', email, password, nombre, apellido, org_nombre: orgNombre, org_sector: orgSector, org_ciudad: orgCiudad }
  })

  btn.disabled = false
  btn.innerHTML = '<i data-lucide="plus"></i> Crear organización'
  lucide.createIcons()

  const err = error || data?.error
  if (err) {
    mostrarErrorModal('modal-org-error', typeof err === 'string' ? err : (err.message || JSON.stringify(err)))
    return
  }

  document.getElementById('modal-nueva-org').classList.remove('open')
  toast(`Organización "${orgNombre}" creada. Credenciales: ${email} / ${password}`, 'success', 7000)
  await cargarOrgs()
}

// ──────────────────────────────────────────────
// SECCIÓN B — MI EQUIPO (Dueño)
// ──────────────────────────────────────────────
async function renderSeccionEquipo(content) {
  content.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Mi Equipo</div>
        <div style="font-size:12px;color:var(--text-3);margin-top:2px">${escHtml(miOrgNombre || '')}</div>
      </div>
      <button class="btn-primary" onclick="abrirModalNuevoColab()">
        <i data-lucide="user-plus"></i> Agregar colaborador
      </button>
    </div>
    <div class="team-grid" id="team-grid">
      <div style="font-size:12px;color:var(--text-4);grid-column:1/-1;text-align:center;padding:32px">Cargando equipo…</div>
    </div>`
  lucide.createIcons()
  await cargarEquipo()
}

async function cargarEquipo() {
  const grid = document.getElementById('team-grid')
  if (!grid || !miOrgId) return

  const { data, error } = await supabase.rpc('listar_equipo_org', { p_org_id: miOrgId })

  if (error) {
    grid.innerHTML = `<div style="color:var(--red);font-size:12px;grid-column:1/-1">Error: ${error.message}</div>`
    return
  }
  if (!data || data.length === 0) {
    grid.innerHTML = `<div style="font-size:12px;color:var(--text-4);grid-column:1/-1;text-align:center;padding:32px">Sin miembros en el equipo</div>`
    return
  }

  grid.innerHTML = data.map(m => {
    const iniciales = getIniciales(m.nombre, m.apellido)
    const nombre = escHtml([m.nombre, m.apellido].filter(Boolean).join(' ') || m.email || '—')
    const esDuenoCard = m.rol_en_org === 'dueno' || m.rol_en_org === 'owner'
    return `
      <div class="team-card">
        <div class="team-avatar">${iniciales}</div>
        <div class="team-info">
          <div class="team-name">${nombre}</div>
          <div class="team-cargo">${escHtml(m.cargo || m.email || '')}</div>
          <span class="team-rol ${esDuenoCard ? 'dueno' : ''}">${esDuenoCard ? 'Dueño' : 'Colaborador'}</span>
        </div>
        ${!esDuenoCard ? `<button class="btn-danger-sm" title="Quitar del equipo" onclick="quitarMiembro('${m.user_id}', '${nombre}')">
          <i data-lucide="user-minus"></i>
        </button>` : ''}
      </div>`
  }).join('')
  lucide.createIcons()
}

window.abrirModalNuevoColab = function() {
  ['colab-nombre','colab-apellido','colab-email','colab-password','colab-cargo']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = '' })
  document.getElementById('modal-colab-error').style.display = 'none'
  document.getElementById('modal-nuevo-colab').classList.add('open')
  lucide.createIcons()
}

window.crearColaborador = async function() {
  const btn = document.getElementById('btn-crear-colab')
  const errEl = document.getElementById('modal-colab-error')
  errEl.style.display = 'none'

  const nombre = document.getElementById('colab-nombre').value.trim()
  const apellido = document.getElementById('colab-apellido').value.trim()
  const email = document.getElementById('colab-email').value.trim()
  const password = document.getElementById('colab-password').value.trim()
  const cargo = document.getElementById('colab-cargo').value.trim()

  if (!nombre) return mostrarErrorModal('modal-colab-error', 'El nombre es obligatorio')
  if (!email || !email.includes('@')) return mostrarErrorModal('modal-colab-error', 'Email inválido')
  if (password.length < 6) return mostrarErrorModal('modal-colab-error', 'La contraseña debe tener al menos 6 caracteres')

  btn.disabled = true
  btn.innerHTML = '<i data-lucide="loader"></i> Creando…'
  lucide.createIcons()

  const { data, error } = await supabase.functions.invoke('crear-usuario', {
    body: { modo: 'miembro', email, password, nombre, apellido, org_id: miOrgId, cargo }
  })

  btn.disabled = false
  btn.innerHTML = '<i data-lucide="user-plus"></i> Agregar colaborador'
  lucide.createIcons()

  const err = error || data?.error
  if (err) {
    const msg = typeof err === 'string' ? err : (err.message || JSON.stringify(err))
    console.error('❌ crear-usuario (miembro):', msg, '| data completo:', JSON.stringify(data))
    mostrarErrorModal('modal-colab-error', msg)
    return
  }

  document.getElementById('modal-nuevo-colab').classList.remove('open')
  toast(`Colaborador ${nombre} agregado. Credenciales: ${email} / ${password}`, 'success', 7000)
  await cargarEquipo()
}

window.quitarMiembro = async function(userId, nombre) {
  if (!confirm(`¿Quitar a ${nombre} del equipo? Seguirá existiendo su cuenta pero perderá acceso a esta organización.`)) return

  const { error } = await supabase.rpc('quitar_usuario_de_org', {
    p_user_id: userId,
    p_org_id: miOrgId
  })

  if (error) { toast('Error al quitar miembro: ' + error.message, 'error'); return }
  toast(`${nombre} removido del equipo`)
  await cargarEquipo()
}

// ──────────────────────────────────────────────
// SECCIÓN C — MI CUENTA (Todos)
// ──────────────────────────────────────────────
function renderSeccionCuenta(content) {
  content.innerHTML = `
    <div class="section-header">
      <div class="section-title">Mi cuenta</div>
    </div>
    <div class="account-card">
      <div class="account-card-title">Perfil y acceso</div>
      <a href="/portal/perfil.html" class="account-link">
        <i data-lucide="user-circle"></i>
        <div>
          <div>Editar mi perfil</div>
          <div class="account-link-sub">Nombre, foto, información de contacto</div>
        </div>
        <i data-lucide="chevron-right" style="margin-left:auto;color:var(--text-4);width:14px;height:14px"></i>
      </a>
      <div class="placeholder-block">
        <i data-lucide="lock"></i>
        <div>
          <div style="font-weight:600;color:var(--text-3)">Cambiar contraseña</div>
          <div>Disponible próximamente</div>
        </div>
      </div>
    </div>`
  lucide.createIcons()
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
function mostrarErrorModal(elId, msg) {
  const el = document.getElementById(elId)
  if (!el) return
  el.textContent = msg
  el.style.display = 'block'
}

function getIniciales(nombre, apellido) {
  const n = (nombre || '').trim()
  const a = (apellido || '').trim()
  if (n && a) return (n[0] + a[0]).toUpperCase()
  if (n) return n.slice(0, 2).toUpperCase()
  return '?'
}

function formatFecha(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function toast(msg, tipo = 'success', duration = 4000) {
  const container = document.getElementById('toast-container')
  if (!container) return
  const t = document.createElement('div')
  t.className = `toast ${tipo}`
  t.innerHTML = `<i data-lucide="${tipo === 'success' ? 'check-circle' : 'alert-circle'}"></i><span>${msg}</span>`
  container.appendChild(t)
  lucide.createIcons()
  setTimeout(() => t.remove(), duration)
}
