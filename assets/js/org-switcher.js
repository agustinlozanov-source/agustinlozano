// ============================================================================
// SCALEx PORTAL — Org Switcher (selector multi-org del topbar)
// ============================================================================
// Componente reutilizable. Se monta en cualquier topbar con:
//   import { mountOrgSwitcher } from './org-switcher.js'
//   mountOrgSwitcher('#contenedor', { onChange: () => location.reload() })
// ============================================================================

import {
  getMyOrganizations,
  getMyOrganization,
  setActiveOrganization
} from './supabase-client.js'

const SWITCHER_HTML = `
<div class="org-switcher" id="org-switcher">
  <button class="org-switcher-btn" id="org-switcher-btn" aria-haspopup="true">
    <div class="org-switcher-avatar" id="org-switcher-avatar">··</div>
    <div class="org-switcher-info">
      <div class="org-switcher-name" id="org-switcher-name">—</div>
      <div class="org-switcher-rol" id="org-switcher-rol">—</div>
    </div>
    <i data-lucide="chevrons-up-down" class="org-switcher-icon"></i>
  </button>
  <div class="org-switcher-menu" id="org-switcher-menu" role="menu">
    <div class="org-switcher-menu-header">Cambiar a otra organización</div>
    <div class="org-switcher-menu-list" id="org-switcher-menu-list"></div>
  </div>
</div>
`

const SWITCHER_CSS = `
.org-switcher { position: relative; }

.org-switcher-btn {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 10px 6px 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  color: var(--text);
  max-width: 260px;
}
.org-switcher-btn:hover { background: var(--surface-hover); }

.org-switcher-avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--gradient);
  color: white;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 11px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.org-switcher-info {
  text-align: left;
  min-width: 0;
  flex: 1;
}
.org-switcher-name {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 12.5px; font-weight: 700;
  color: var(--text); line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}
.org-switcher-rol {
  font-size: 10px; font-weight: 600;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 1px;
}

.org-switcher-icon {
  width: 14px; height: 14px;
  color: var(--text-3);
  flex-shrink: 0;
}

.org-switcher-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 280px;
  max-width: 320px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.35);
  z-index: 50;
  display: none;
}
.org-switcher.open .org-switcher-menu { display: block; }

.org-switcher-menu-header {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  padding: 8px 10px 6px;
}

.org-switcher-menu-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 360px;
  overflow-y: auto;
}

.org-switcher-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
  font-family: inherit;
  color: var(--text);
  width: 100%;
}
.org-switcher-item:hover { background: var(--surface); }
.org-switcher-item.active { background: var(--teal-light); }

.org-switcher-item-avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: var(--gradient);
  color: white;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 12px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.org-switcher-item-info {
  flex: 1;
  min-width: 0;
}
.org-switcher-item-name {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 13px; font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.org-switcher-item-rol {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 1px;
}
.org-switcher-item.active .org-switcher-item-rol { color: var(--teal); font-weight: 600; }

.org-switcher-item-check {
  width: 16px; height: 16px;
  color: var(--teal);
  flex-shrink: 0;
  display: none;
}
.org-switcher-item.active .org-switcher-item-check { display: block; }

@media (max-width: 700px) {
  .org-switcher-btn { max-width: 200px; padding: 5px 8px 5px 5px; }
  .org-switcher-name { max-width: 110px; font-size: 12px; }
  .org-switcher-rol { font-size: 9px; }
  .org-switcher-menu { right: -10px; min-width: 260px; }
}
`

const initials = (name) => {
  if (!name) return '··'
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase()
}

const rolLabel = (rol) => {
  const labels = {
    dueno: 'Dueño',
    admin: 'Admin',
    consultor: 'Consultor',
    miembro: 'Miembro',
    invitado: 'Invitado'
  }
  return labels[rol] || rol
}

let cssInjected = false
function injectCSS() {
  if (cssInjected) return
  const style = document.createElement('style')
  style.textContent = SWITCHER_CSS
  document.head.appendChild(style)
  cssInjected = true
}

/**
 * Monta el selector en el contenedor indicado.
 * @param {string} containerSelector — ej: '#topbar-org-slot'
 * @param {object} opts — { onChange: function }
 */
export async function mountOrgSwitcher(containerSelector, opts = {}) {
  injectCSS()

  const container = document.querySelector(containerSelector)
  if (!container) {
    console.error('[org-switcher] no se encontró el contenedor', containerSelector)
    return
  }

  // Cargar orgs
  const [orgs, activeOrg] = await Promise.all([
    getMyOrganizations(),
    getMyOrganization()
  ])

  // Si solo tiene 1 org, NO mostrar selector (sería confuso)
  if (orgs.length <= 1) {
    container.innerHTML = ''
    return
  }

  // Renderizar HTML base
  container.innerHTML = SWITCHER_HTML

  // Llenar el botón con la org activa
  const btnAvatar = document.getElementById('org-switcher-avatar')
  const btnName = document.getElementById('org-switcher-name')
  const btnRol = document.getElementById('org-switcher-rol')

  if (activeOrg) {
    btnAvatar.textContent = initials(activeOrg.nombre_corto || activeOrg.nombre)
    btnName.textContent = activeOrg.nombre_corto || activeOrg.nombre
    btnRol.textContent = rolLabel(activeOrg.rol)
  }

  // Llenar la lista de orgs
  const list = document.getElementById('org-switcher-menu-list')
  list.innerHTML = orgs.map(org => `
    <button class="org-switcher-item ${activeOrg?.id === org.id ? 'active' : ''}"
            data-org-id="${org.id}">
      <div class="org-switcher-item-avatar">${initials(org.nombre_corto || org.nombre)}</div>
      <div class="org-switcher-item-info">
        <div class="org-switcher-item-name">${org.nombre}</div>
        <div class="org-switcher-item-rol">${rolLabel(org.rol)}${org.cargo ? ' · ' + org.cargo : ''}</div>
      </div>
      <i data-lucide="check" class="org-switcher-item-check"></i>
    </button>
  `).join('')

  if (window.lucide) lucide.createIcons()

  // Toggle menú al click
  const switcher = document.getElementById('org-switcher')
  const btn = document.getElementById('org-switcher-btn')

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    switcher.classList.toggle('open')
  })

  // Cerrar menú al click afuera
  document.addEventListener('click', (e) => {
    if (!switcher.contains(e.target)) switcher.classList.remove('open')
  })

  // ESC cierra menú
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') switcher.classList.remove('open')
  })

  // Click en una org → cambiar
  list.querySelectorAll('.org-switcher-item').forEach(item => {
    item.addEventListener('click', () => {
      const orgId = item.dataset.orgId
      if (orgId === activeOrg?.id) {
        switcher.classList.remove('open')
        return
      }
      setActiveOrganization(orgId)
      switcher.classList.remove('open')
      if (typeof opts.onChange === 'function') {
        opts.onChange(orgId)
      } else {
        // Default: recargar la página para refrescar todos los datos
        window.location.reload()
      }
    })
  })
}

window.SCALEx = window.SCALEx || {}
window.SCALEx.mountOrgSwitcher = mountOrgSwitcher
