// ============================================================================
// SCALEx Portal · admin-consultores.js
// ============================================================================
// Vista ADMIN para asignar/revocar certificaciones a consultores.
// Solo accesible si rol_global === 'admin'.
// ============================================================================

import { supabase, getMyProfile } from '/assets/js/supabase-client.js'

const NIVEL_TXT = {
  junior: 'Junior',
  senior: 'Senior',
  master: 'Master',
  master_certificador: 'Master Cert.'
}

// Usuario actualmente en el modal
let modalUserId = null

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

function hoy() {
  return new Date().toISOString().split('T')[0]
}

// ────────────────────────────────────────────────────────────────────────────
// Render bloqueado
// ────────────────────────────────────────────────────────────────────────────
function renderBloqueado() {
  const content = document.getElementById('content-area')
  if (!content) return
  content.innerHTML = `
    <div class="access-blocked">
      <div class="access-blocked-icon"><i data-lucide="shield-x"></i></div>
      <h2>Sin permisos para esta sección</h2>
      <p>Solo los administradores globales pueden asignar certificaciones. Contacta a Agustín si necesitas acceso.</p>
    </div>
  `
  if (window.lucide) lucide.createIcons()
}

// ────────────────────────────────────────────────────────────────────────────
// Cargar lista de consultores
// ────────────────────────────────────────────────────────────────────────────
export async function cargarConsultores() {
  const content = document.getElementById('content-area')
  if (!content) return

  content.innerHTML = `
    <div class="skeleton" style="height:50px;margin-bottom:16px;"></div>
    <div class="skeleton" style="height:400px;"></div>
  `

  const { data: perfiles, error } = await supabase
    .from('perfiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    content.innerHTML = `<p style="color:var(--red);padding:20px">Error al cargar usuarios: ${error.message}</p>`
    return
  }

  const total = perfiles?.length || 0

  const filas = (perfiles || []).map(p => {
    const iniciales = getIniciales(p.nombre, p.apellido)
    const nombre = [p.nombre, p.apellido].filter(Boolean).join(' ') || '(sin nombre)'
    const email = p.email || '—'
    const nivel = p.nivel_consultor
    const nivelLabel = nivel ? NIVEL_TXT[nivel] || nivel : '—'
    const nivelClass = nivel || 'ninguno'
    const certNum = p.cert_numero || '—'
    const vigente = p.cert_vigente === true
    const avatarInner = p.avatar_url
      ? `<img src="${p.avatar_url}" alt="${iniciales}">`
      : iniciales

    return `
      <tr>
        <td>
          <div class="user-cell">
            <div class="tabla-avatar">${avatarInner}</div>
            <div class="user-cell-info">
              <div class="user-cell-name">${nombre}</div>
              <div class="user-cell-email">${email}</div>
            </div>
          </div>
        </td>
        <td><span style="font-size:12px;color:var(--text-3)">${p.rol_global || 'cliente'}</span></td>
        <td><span class="nivel-badge ${nivelClass}">${nivelLabel}</span></td>
        <td style="font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;color:var(--text)">${nivel ? '#' + certNum : '—'}</td>
        <td><span class="vigente-dot ${vigente ? 'si' : 'no'}">${vigente ? 'Vigente' : 'No vigente'}</span></td>
        <td>
          <button class="btn-cert" onclick="abrirModal('${p.id}')">
            <i data-lucide="pencil"></i>
            ${nivel ? 'Editar' : 'Certificar'}
          </button>
        </td>
      </tr>
    `
  }).join('')

  content.innerHTML = `
    <div class="tabla-header">
      <div class="tabla-title">Usuarios del sistema</div>
      <div class="tabla-count">${total} usuario${total !== 1 ? 's' : ''}</div>
    </div>
    <div class="tabla-wrap">
      <table class="tabla">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Nivel</th>
            <th># Cert</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `

  // Guardar perfiles en memoria para el modal
  window._adminPerfiles = perfiles || []
  if (window.lucide) lucide.createIcons()
}

// ────────────────────────────────────────────────────────────────────────────
// Modal
// ────────────────────────────────────────────────────────────────────────────
window.abrirModal = function(userId) {
  modalUserId = userId
  const perfil = (window._adminPerfiles || []).find(p => p.id === userId)
  if (!perfil) return

  const iniciales = getIniciales(perfil.nombre, perfil.apellido)
  const nombre = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ') || '(sin nombre)'

  // Avatar del modal
  const avatarEl = document.getElementById('modal-avatar')
  if (avatarEl) {
    if (perfil.avatar_url) {
      avatarEl.innerHTML = `<img src="${perfil.avatar_url}" alt="${iniciales}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    } else {
      avatarEl.textContent = iniciales
    }
  }

  const el = (id) => document.getElementById(id)
  if (el('modal-nombre')) el('modal-nombre').textContent = nombre
  if (el('modal-email')) el('modal-email').textContent = perfil.email || '—'
  if (el('modal-nivel')) el('modal-nivel').value = perfil.nivel_consultor || 'junior'
  if (el('modal-cert-numero')) el('modal-cert-numero').value = perfil.cert_numero || ''
  if (el('modal-cert-fecha')) el('modal-cert-fecha').value = perfil.cert_emitida_en || hoy()
  if (el('modal-feedback')) el('modal-feedback').textContent = ''

  const btnRevocar = el('btn-revocar')
  if (btnRevocar) btnRevocar.style.display = perfil.nivel_consultor ? '' : 'none'

  el('modal-overlay')?.classList.add('open')
  if (window.lucide) lucide.createIcons()
}

window.cerrarModal = function() {
  document.getElementById('modal-overlay')?.classList.remove('open')
  modalUserId = null
}

window.asignarCert = async function() {
  if (!modalUserId) return
  const nivel = document.getElementById('modal-nivel')?.value
  const certNumero = document.getElementById('modal-cert-numero')?.value?.trim()
  const certFecha = document.getElementById('modal-cert-fecha')?.value
  const feedback = document.getElementById('modal-feedback')
  const btn = document.getElementById('btn-asignar')

  if (!nivel || !certNumero || !certFecha) {
    if (feedback) { feedback.className = 'modal-feedback err'; feedback.textContent = 'Completa todos los campos' }
    return
  }

  btn.disabled = true
  if (feedback) { feedback.className = 'modal-feedback'; feedback.textContent = 'Asignando…' }

  try {
    const { error } = await supabase.rpc('asignar_certificacion', {
      p_usuario_id: modalUserId,
      p_nivel: nivel,
      p_cert_numero: certNumero,
      p_cert_emitida_en: certFecha
    })
    if (error) throw error
    if (feedback) { feedback.className = 'modal-feedback ok'; feedback.textContent = '✓ Certificación asignada' }
    setTimeout(() => {
      cerrarModal()
      cargarConsultores()
    }, 1000)
  } catch (err) {
    console.error('[admin-consultores] asignarCert error', err)
    if (feedback) { feedback.className = 'modal-feedback err'; feedback.textContent = '✗ Error: ' + err.message }
  } finally {
    btn.disabled = false
  }
}

window.revocarCert = async function() {
  if (!modalUserId) return
  const feedback = document.getElementById('modal-feedback')
  const btn = document.getElementById('btn-revocar')

  if (!confirm('¿Confirmas que deseas revocar la certificación?')) return

  btn.disabled = true
  if (feedback) { feedback.className = 'modal-feedback'; feedback.textContent = 'Revocando…' }

  try {
    const { error } = await supabase.rpc('revocar_certificacion', {
      p_usuario_id: modalUserId
    })
    if (error) throw error
    if (feedback) { feedback.className = 'modal-feedback ok'; feedback.textContent = '✓ Certificación revocada' }
    setTimeout(() => {
      cerrarModal()
      cargarConsultores()
    }, 1000)
  } catch (err) {
    console.error('[admin-consultores] revocarCert error', err)
    if (feedback) { feedback.className = 'modal-feedback err'; feedback.textContent = '✗ Error: ' + err.message }
  } finally {
    btn.disabled = false
  }
}

// Cerrar modal al click fuera
document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) cerrarModal()
})

// ────────────────────────────────────────────────────────────────────────────
// Init
// ────────────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const perfil = await getMyProfile()
    if (!perfil || perfil.rol_global !== 'admin') {
      renderBloqueado()
      return
    }
    await cargarConsultores()
  } catch (err) {
    console.error('[admin-consultores] init error', err)
  }
}

init()
