// ============================================================================
// SCALEx Portal · Shell · portal-shell.js
// ============================================================================
// Inyecta en TODAS las páginas del portal:
//   1. Sidebar extras: Modo Presentación, Mi Perfil, Admin (si aplica)
//   2. User badge en la topbar con foto/iniciales + cert
// ============================================================================

import { getMyProfile } from '/assets/js/supabase-client.js'

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
function getIniciales(nombre, apellido) {
  const n = (nombre || '').trim()
  const a = (apellido || '').trim()
  if (n && a) return (n[0] + a[0]).toUpperCase()
  if (n) return n.slice(0, 2).toUpperCase()
  return '?'
}

const NIVEL_TXT = {
  junior: 'Consultor Junior',
  senior: 'Consultor Senior',
  master: 'Consultor Master',
  master_certificador: 'Master Certificador'
}

// ────────────────────────────────────────────────────────────────────────────
// Estilos inyectados una sola vez
// ────────────────────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('portal-shell-styles')) return
  const style = document.createElement('style')
  style.id = 'portal-shell-styles'
  style.textContent = `
    /* ── Sidebar scroll — aplicado via JS directo sobre el elemento ── */

    /* ── User Badge ── */
    .user-badge {
      display: flex; align-items: center; gap: 10px;
      padding: 6px 14px 6px 6px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 50px;
      cursor: default;
    }
    .user-badge-avatar {
      width: 30px; height: 30px; border-radius: 50%;
      background: var(--gradient);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-weight: 800; font-size: 11px; color: white;
      overflow: hidden; flex-shrink: 0;
    }
    .user-badge-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
    .user-badge-info { display: flex; flex-direction: column; gap: 1px; }
    .user-badge-name {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 12px; font-weight: 700; color: var(--text); line-height: 1.2;
    }
    .user-badge-cert { font-size: 10px; color: var(--text-3); font-weight: 500; line-height: 1.2; }
    .user-badge-cert.certificado { color: var(--teal); }
  `
  document.head.appendChild(style)
}

// ────────────────────────────────────────────────────────────────────────────
// Sidebar extras
// ────────────────────────────────────────────────────────────────────────────
function injectSidebarExtras(perfil) {
  const sidebarBottom = document.querySelector('.sidebar-bottom')
  if (!sidebarBottom) return

  const isAdmin = perfil.rol_global === 'admin'
  const isCertConsultor = perfil.rol_global === 'consultor' && perfil.cert_vigente === true

  // Punto de inserción: .sidebar-nav si existe, si no fallback a antes del bottom
  const nav = document.querySelector('.sidebar-nav') || sidebarBottom

  // Divider
  const divider = document.createElement('div')
  divider.className = 'sidebar-divider'

  // Mi Perfil — visible siempre
  const perfilLink = document.createElement('a')
  perfilLink.href = '/portal/perfil.html'
  perfilLink.className = 'sidebar-icon'
  perfilLink.id = 'sidebar-perfil'
  perfilLink.title = 'Mi Perfil'
  perfilLink.innerHTML = '<i data-lucide="user"></i>'

  // Modo Presentación — solo consultor certificado vigente
  const presentacionLink = document.createElement('a')
  presentacionLink.href = '/portal/presentacion.html'
  presentacionLink.className = 'sidebar-icon'
  presentacionLink.id = 'sidebar-presentacion'
  presentacionLink.title = 'Modo Presentación'
  presentacionLink.innerHTML = '<i data-lucide="presentation"></i>'
  if (!isCertConsultor) presentacionLink.style.display = 'none'

  if (nav.classList.contains('sidebar-nav')) {
    // Insertar al final del nav scrolleable
    nav.append(divider, presentacionLink, perfilLink)
    if (isAdmin) {
      const adminLink = document.createElement('a')
      adminLink.href = '/portal/admin-consultores.html'
      adminLink.className = 'sidebar-icon'
      adminLink.id = 'sidebar-admin-consultores'
      adminLink.title = 'Admin · Consultores'
      adminLink.innerHTML = '<i data-lucide="shield-check"></i>'
      nav.append(adminLink)
    }
  } else {
    // Fallback: insertar antes del bottom (portales sin sidebar-nav aún)
    sidebarBottom.before(divider, presentacionLink, perfilLink)
    if (isAdmin) {
      const adminLink = document.createElement('a')
      adminLink.href = '/portal/admin-consultores.html'
      adminLink.className = 'sidebar-icon'
      adminLink.id = 'sidebar-admin-consultores'
      adminLink.title = 'Admin · Consultores'
      adminLink.innerHTML = '<i data-lucide="shield-check"></i>'
      sidebarBottom.before(adminLink)
    }
  }

  if (window.lucide) lucide.createIcons()
}

// ────────────────────────────────────────────────────────────────────────────
// User badge en topbar
// ────────────────────────────────────────────────────────────────────────────
function injectUserBadge(perfil) {
  const actions = document.querySelector('.topbar-actions')
  if (!actions) return

  const iniciales = getIniciales(perfil.nombre, perfil.apellido)
  const nombreCompleto = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ') || perfil.email || 'Usuario'

  const isCert = perfil.cert_vigente === true && perfil.nivel_consultor
  const nivelTxt = NIVEL_TXT[perfil.nivel_consultor] || ''
  const certLine = isCert
    ? nivelTxt + ' · #' + perfil.cert_numero
    : (perfil.cargo || '')

  const avatarInner = perfil.avatar_url
    ? `<img src="${perfil.avatar_url}" alt="${iniciales}">`
    : iniciales

  const badge = document.createElement('div')
  badge.className = 'user-badge'
  badge.innerHTML = `
    <div class="user-badge-avatar">${avatarInner}</div>
    <div class="user-badge-info">
      <div class="user-badge-name">${nombreCompleto}</div>
      <div class="user-badge-cert${isCert ? ' certificado' : ''}">${certLine}</div>
    </div>
  `

  // Insertar al inicio de las acciones
  actions.insertBefore(badge, actions.firstChild)
}

// ────────────────────────────────────────────────────────────────────────────
// Init
// ────────────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const perfil = await getMyProfile()
    if (!perfil) return
    injectStyles()
    injectSidebarExtras(perfil)
    injectUserBadge(perfil)
  } catch (err) {
    console.error('[portal-shell] init error', err)
  }
}

// Esperar a que el DOM esté listo antes de inyectar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
