/**
 * presentacion.js
 * Conecta el Modo Presentación con datos reales del perfil autenticado.
 */

const NIVEL_TXT = {
  junior: 'Consultor Junior',
  senior: 'Consultor Senior',
  master: 'Consultor Master',
  master_certificador: 'Master Certificador',
}

const ANIOS_TXT = {
  1: '1 año en consultoría',
  2: '2 años en consultoría',
  3: '3 años en consultoría',
  4: '4 años en consultoría',
  5: '5 años en consultoría',
  6: '6 años en consultoría',
  7: '7 años en consultoría',
  8: '8 años en consultoría',
  9: '9 años en consultoría',
  10: '+10 años en consultoría',
  15: '+15 años en consultoría',
  20: '+20 años en consultoría',
}

function getIniciales(nombre, apellido) {
  const n = (nombre || '').trim()
  const a = (apellido || '').trim()
  if (n && a) return (n[0] + a[0]).toUpperCase()
  if (n) return n.slice(0, 2).toUpperCase()
  return '??'
}

function renderAvatar(container, perfil) {
  if (!container) return
  const iniciales = getIniciales(perfil.nombre, perfil.apellido)
  if (perfil.avatar_url) {
    container.innerHTML = `<img src="${perfil.avatar_url}" alt="${iniciales}" loading="lazy">`
  } else {
    container.textContent = iniciales
  }
}

function renderNoCert() {
  // Ocultar welcome y deck, mostrar bloqueo
  document.getElementById('welcome')?.remove()
  document.querySelector('.deck')?.remove()
  document.querySelector('.hud-top')?.remove()
  document.querySelector('.hud-bottom')?.remove()

  const bloqueo = document.createElement('div')
  bloqueo.className = 'no-cert'
  bloqueo.innerHTML = `
    <div class="no-cert-icon">
      <i data-lucide="shield-off"></i>
    </div>
    <h2>Acceso restringido</h2>
    <p>El Modo Presentación está disponible únicamente para consultores con certificación vigente.<br>Habla con tu administrador para que te asigne tu certificación.</p>
    <a href="/portal/dashboard.html">← Volver al Dashboard</a>
  `
  document.body.appendChild(bloqueo)
  if (window.lucide) lucide.createIcons()
}

/**
 * Punto de entrada.
 * Llamado desde el <script type="module"> de presentacion.html con el perfil cargado.
 */
export function init(perfil) {
  if (!perfil) {
    // No hay sesión — auth-guard debería haber redirigido, pero por si acaso
    window.location.href = '/portal/login.html'
    return
  }

  // ── Guard de certificación ──────────────────────────────────────────────────
  const isCertified = perfil.cert_vigente === true && perfil.nivel_consultor
  if (!isCertified) {
    renderNoCert()
    return
  }

  // ── Datos derivados ──────────────────────────────────────────────────────────
  const iniciales = getIniciales(perfil.nombre, perfil.apellido)
  const nombreCompleto = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ') || 'Consultor'
  const nivelTxt = NIVEL_TXT[perfil.nivel_consultor] || perfil.nivel_consultor || 'Consultor'
  const certTxt = `${nivelTxt} · #${perfil.cert_numero || '—'}`
  const ciudadTxt = perfil.ciudad ? perfil.ciudad + (perfil.pais ? ', ' + perfil.pais : '') : null
  const aniosTxt = ANIOS_TXT[perfil.anios_experiencia] || (perfil.anios_experiencia ? perfil.anios_experiencia + ' años' : null)

  // ── Fecha en portada ─────────────────────────────────────────────────────────
  const hoy = new Date()
  const fechaStr = hoy.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  const fechaEl = document.getElementById('portada-fecha')
  if (fechaEl) fechaEl.textContent = fechaStr

  // ── Pantalla de bienvenida ───────────────────────────────────────────────────
  const welcomeAvatar = document.getElementById('welcome-avatar')
  renderAvatar(welcomeAvatar, perfil)

  const welcomeName = document.getElementById('welcome-name')
  if (welcomeName) welcomeName.textContent = nombreCompleto

  const welcomeCert = document.getElementById('welcome-cert')
  if (welcomeCert) welcomeCert.textContent = certTxt

  // ── HUD ──────────────────────────────────────────────────────────────────────
  const hudAvatar = document.getElementById('hud-avatar')
  renderAvatar(hudAvatar, perfil)

  const hudName = document.getElementById('hud-name')
  if (hudName) hudName.textContent = nombreCompleto

  const hudCert = document.getElementById('hud-cert')
  if (hudCert) hudCert.textContent = certTxt

  // ── Slide 3 — Consultor ──────────────────────────────────────────────────────
  const slide3Avatar = document.getElementById('slide3-avatar')
  renderAvatar(slide3Avatar, perfil)

  const slide3Name = document.getElementById('slide3-name')
  if (slide3Name) slide3Name.textContent = nombreCompleto

  const slide3Cert = document.getElementById('slide3-cert')
  if (slide3Cert) slide3Cert.textContent = certTxt

  const slide3Ciudad = document.getElementById('slide3-ciudad')
  const slide3CiudadWrap = document.getElementById('slide3-ciudad-wrap')
  if (ciudadTxt) {
    if (slide3Ciudad) slide3Ciudad.textContent = ciudadTxt
  } else {
    if (slide3CiudadWrap) slide3CiudadWrap.style.display = 'none'
  }

  const slide3Anios = document.getElementById('slide3-anios')
  const slide3AniosWrap = document.getElementById('slide3-anios-wrap')
  if (aniosTxt) {
    if (slide3Anios) slide3Anios.textContent = aniosTxt
  } else {
    if (slide3AniosWrap) slide3AniosWrap.style.display = 'none'
  }

  const slide3Bio = document.getElementById('slide3-bio')
  if (slide3Bio) {
    if (perfil.bio && perfil.bio.trim()) {
      slide3Bio.textContent = `"${perfil.bio.trim()}"`
      slide3Bio.style.display = 'block'
    } else {
      slide3Bio.style.display = 'none'
    }
  }

  // ── Cierre ───────────────────────────────────────────────────────────────────
  const cierreAvatar = document.getElementById('cierre-avatar')
  renderAvatar(cierreAvatar, perfil)

  const cierreName = document.getElementById('cierre-name')
  if (cierreName) cierreName.textContent = nombreCompleto

  // ── Re-init iconos ───────────────────────────────────────────────────────────
  if (window.lucide) lucide.createIcons()
}
