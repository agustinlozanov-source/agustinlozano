// ============================================================================
// SCALEx Portal · perfil.js
// ============================================================================
// Carga y edita los datos del perfil del usuario logueado.
// Auto-save con debounce de 900ms por campo.
// Subida de foto a Supabase Storage bucket "avatares".
// ============================================================================

import { supabase, getMyProfile, getUser } from '/assets/js/supabase-client.js'

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

function setSaveState(indicatorId, state, msg) {
  const el = document.getElementById(indicatorId)
  if (!el) return
  el.className = 'save-indicator ' + state
  el.textContent = msg || ''
  if (state === 'saved') {
    setTimeout(() => { el.textContent = '' }, 2500)
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Timers de debounce por campo
// ────────────────────────────────────────────────────────────────────────────
const debounceTimers = {}

function debounce(key, fn, delay = 900) {
  if (debounceTimers[key]) clearTimeout(debounceTimers[key])
  debounceTimers[key] = setTimeout(fn, delay)
}

// ────────────────────────────────────────────────────────────────────────────
// Guardar campo
// ────────────────────────────────────────────────────────────────────────────
async function saveField(userId, column, value, indicatorId) {
  setSaveState(indicatorId, 'saving', 'Guardando…')
  try {
    const { error } = await supabase
      .from('perfiles')
      .update({ [column]: value })
      .eq('id', userId)
    if (error) throw error
    setSaveState(indicatorId, 'saved', '✓ Guardado')
  } catch (err) {
    console.error('[perfil] saveField error', err)
    setSaveState(indicatorId, 'error', '✗ Error al guardar')
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Renderizar sección de certificación (solo lectura)
// ────────────────────────────────────────────────────────────────────────────
function renderCert(perfil) {
  const section = document.getElementById('cert-section')
  if (!section) return

  if (!perfil.nivel_consultor) {
    section.innerHTML = `
      <div class="cert-no-asig">
        Aún no tienes asignación de certificación.<br>
        Contacta al Owner para que te asigne nivel y número.
      </div>
    `
    return
  }

  const nivelTxt = {
    junior: 'Consultor Junior',
    senior: 'Consultor Senior',
    master: 'Consultor Master',
    master_certificador: 'Master Certificador'
  }[perfil.nivel_consultor] || perfil.nivel_consultor

  const fechaFmt = perfil.cert_emitida_en
    ? new Date(perfil.cert_emitida_en).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  const viggente = perfil.cert_vigente === true

  section.innerHTML = `
    <div class="cert-badge ${perfil.nivel_consultor}">
      <i data-lucide="badge-check"></i>
      ${nivelTxt}
    </div>
    <div class="cert-meta">
      <div class="cert-meta-row">
        <span>Número</span>
        <span>#${perfil.cert_numero || '—'}</span>
      </div>
      <div class="cert-meta-row">
        <span>Emitida</span>
        <span>${fechaFmt}</span>
      </div>
      <div class="cert-meta-row">
        <span>Estado</span>
        <span>
          <span class="vigente-badge ${viggente ? 'si' : 'no'}">
            ${viggente ? '● Vigente' : '● No vigente'}
          </span>
        </span>
      </div>
    </div>
  `
  if (window.lucide) lucide.createIcons()
}

// ────────────────────────────────────────────────────────────────────────────
// Renderizar avatar
// ────────────────────────────────────────────────────────────────────────────
function renderAvatar(perfil) {
  const container = document.getElementById('foto-avatar')
  const inicialesEl = document.getElementById('foto-iniciales')
  if (!container) return

  const iniciales = getIniciales(perfil.nombre, perfil.apellido)

  if (perfil.avatar_url) {
    inicialesEl.style.display = 'none'
    // Eliminar img previa si existe
    const imgExist = container.querySelector('img.real-avatar')
    if (imgExist) imgExist.remove()
    const img = document.createElement('img')
    img.className = 'real-avatar'
    img.src = perfil.avatar_url
    img.alt = iniciales
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;'
    container.insertBefore(img, container.querySelector('.foto-overlay'))
  } else {
    inicialesEl.textContent = iniciales
    inicialesEl.style.display = ''
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Poblar formulario
// ────────────────────────────────────────────────────────────────────────────
function poblarForm(perfil) {
  const fields = {
    'field-nombre': perfil.nombre || '',
    'field-apellido': perfil.apellido || '',
    'field-cargo': perfil.cargo || '',
    'field-bio': perfil.bio || '',
    'field-ciudad': perfil.ciudad || '',
    'field-pais': perfil.pais || 'MX',
    'field-telefono': perfil.telefono || ''
  }
  for (const [id, value] of Object.entries(fields)) {
    const el = document.getElementById(id)
    if (el) el.value = value
  }

  const aniosEl = document.getElementById('field-anios')
  if (aniosEl) {
    const val = perfil.anios_experiencia || 0
    aniosEl.value = [0, 1, 2, 3, 5, 10].includes(val) ? val : 0
  }

  renderAvatar(perfil)
  renderCert(perfil)
  if (window.lucide) lucide.createIcons()
}

// ────────────────────────────────────────────────────────────────────────────
// Configurar auto-save por campo
// ────────────────────────────────────────────────────────────────────────────
function setupAutoSave(userId) {
  const campos = [
    { fieldId: 'field-nombre',    column: 'nombre',             indicatorId: 'save-nombre' },
    { fieldId: 'field-apellido',  column: 'apellido',           indicatorId: 'save-apellido' },
    { fieldId: 'field-cargo',     column: 'cargo',              indicatorId: 'save-cargo' },
    { fieldId: 'field-bio',       column: 'bio',                indicatorId: 'save-bio' },
    { fieldId: 'field-ciudad',    column: 'ciudad',             indicatorId: 'save-ciudad' },
    { fieldId: 'field-pais',      column: 'pais',               indicatorId: 'save-pais' },
    { fieldId: 'field-telefono',  column: 'telefono',           indicatorId: 'save-telefono' },
    { fieldId: 'field-anios',     column: 'anios_experiencia',  indicatorId: 'save-anios', isNumber: true }
  ]

  for (const { fieldId, column, indicatorId, isNumber } of campos) {
    const el = document.getElementById(fieldId)
    if (!el) continue
    const eventType = el.tagName === 'SELECT' ? 'change' : 'input'
    el.addEventListener(eventType, () => {
      const value = isNumber ? parseInt(el.value, 10) : el.value.trim()
      setSaveState(indicatorId, 'saving', 'Guardando…')
      debounce(column, () => saveField(userId, column, value, indicatorId))
    })
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Upload de foto
// ────────────────────────────────────────────────────────────────────────────
async function handleFotoUpload(file, userId) {
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    setSaveState('foto-save-indicator', 'error', '✗ Máximo 2 MB')
    return
  }

  setSaveState('foto-save-indicator', 'saving', 'Subiendo foto…')

  try {
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${userId}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatares')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage
      .from('avatares')
      .getPublicUrl(path)

    const publicUrl = urlData.publicUrl + '?t=' + Date.now()

    const { error: updateError } = await supabase
      .from('perfiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId)

    if (updateError) throw updateError

    // Actualizar UI
    const inicialesEl = document.getElementById('foto-iniciales')
    if (inicialesEl) inicialesEl.style.display = 'none'
    const container = document.getElementById('foto-avatar')
    const imgExist = container?.querySelector('img.real-avatar')
    if (imgExist) imgExist.remove()
    if (container) {
      const img = document.createElement('img')
      img.className = 'real-avatar'
      img.src = publicUrl
      img.alt = 'Avatar'
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;'
      container.insertBefore(img, container.querySelector('.foto-overlay'))
    }

    setSaveState('foto-save-indicator', 'saved', '✓ Foto actualizada')
  } catch (err) {
    console.error('[perfil] foto upload error', err)
    setSaveState('foto-save-indicator', 'error', '✗ Error al subir')
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Init
// ────────────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const user = await getUser()
    if (!user) return

    const perfil = await getMyProfile()
    if (!perfil) return

    poblarForm(perfil)
    setupAutoSave(user.id)

    // Listener de foto
    const fotoInput = document.getElementById('foto-input')
    if (fotoInput) {
      fotoInput.addEventListener('change', (e) => {
        const file = e.target.files[0]
        if (file) handleFotoUpload(file, user.id)
      })
    }

  } catch (err) {
    console.error('[perfil] init error', err)
  }
}

init()
