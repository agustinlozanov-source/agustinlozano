// adn-piramide-invertida.js — SCALEx Portal · ADN Paso 3 · Visualización
// Solo lectura: carga todos los datos de los pasos 0, 1 y 2 y renderiza la pirámide

import { supabase, getMyProfile, getMyOrganization } from '/assets/js/supabase-client.js'
import { PIRAMIDES, RECTORES } from '/assets/js/adn-piramides-rectores-catalogo.js'
import { HIBRIDOS } from '/assets/js/adn-hibridos-catalogo.js'

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Tema
  const savedTheme = localStorage.getItem('scalex-theme') || 'dark'
  document.documentElement.setAttribute('data-theme', savedTheme)
  const themeBtn = document.getElementById('theme-toggle')
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      localStorage.setItem('scalex-theme', next)
      lucide.createIcons()
    })
  }

  const perfil = await getMyProfile()
  if (!perfil) return
  const org = await getMyOrganization()
  if (!org) return

  // Topbar
  renderTopbar(perfil, org)

  // Obtener sesión activa
  const { data: sid, error } = await supabase.rpc('adn_sesion_activa', {
    p_organizacion_id: org.id,
    p_consultor_id: perfil.id
  })
  if (error || !sid) { console.error('❌ adn_sesion_activa:', error?.message); return }

  // Verificar paso 2 completado
  const { data: sesion } = await supabase
    .from('adn_sesiones')
    .select('paso_0_estado, paso_0_tipo_piramide, paso_0_puntaje, paso_1_estado, paso_1_nombre_hibrido, paso_2_estado')
    .eq('id', sid)
    .maybeSingle()

  if (!sesion || sesion.paso_2_estado !== 'completado') {
    window.location.href = '/portal/adn.html'
    return
  }

  // Cargar datos de las capas en paralelo
  const [
    { data: publicos },
    { data: diferenciadores },
    { data: habilitadores },
    { data: rectoresData }
  ] = await Promise.all([
    supabase.from('adn_paso2_publicos').select('id, nombre, tipo_vinculo, criticidad').eq('sesion_id', sid).order('created_at'),
    supabase.from('adn_paso2_diferenciadores').select('id, nombre, semaforo').eq('sesion_id', sid).order('created_at'),
    supabase.from('adn_paso2_habilitadores').select('id, nombre, semaforo').eq('sesion_id', sid).order('created_at'),
    supabase.from('adn_paso2_rectores').select('rector_codigo, estado_actual, ano_construccion').eq('sesion_id', sid)
  ])

  // Construir mapa de rectores por código
  const rectoresMap = {}
  ;(rectoresData || []).forEach(r => { rectoresMap[r.rector_codigo] = r })

  // Renderizar todo
  renderSummary(sesion)
  renderLayers(publicos || [], diferenciadores || [], habilitadores || [], rectoresMap)
  renderPiramideDetail(sesion.paso_0_tipo_piramide)
  renderHibridoDetail(sesion.paso_1_nombre_hibrido)

  lucide.createIcons()
})

// ──────────────────────────────────────────────
// TOPBAR
// ──────────────────────────────────────────────
function renderTopbar(perfil, org) {
  const nombre = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ') || perfil.email
  const iniciales = [(perfil.nombre || '')[0], (perfil.apellido || '')[0]].filter(Boolean).join('').toUpperCase() || 'U'

  const nameEl = document.getElementById('topbar-name')
  const roleEl = document.getElementById('topbar-role')
  const avatarEl = document.getElementById('topbar-avatar')

  if (nameEl) nameEl.textContent = nombre
  if (roleEl) roleEl.textContent = `${org.nombre_corto || org.nombre} · #${perfil.codigo_consultor || 'MRC-001'}`
  if (avatarEl) {
    if (perfil.avatar_url) {
      avatarEl.innerHTML = `<img src="${perfil.avatar_url}" alt="${iniciales}">`
    } else {
      avatarEl.textContent = iniciales
    }
  }
}

// ──────────────────────────────────────────────
// SUMMARY CARDS: pirámide + híbrido
// ──────────────────────────────────────────────
function renderSummary(sesion) {
  const grid = document.getElementById('summary-grid')
  if (!grid) return

  const tipoPiramide = sesion.paso_0_tipo_piramide || 'transicion'
  const piramide = PIRAMIDES[tipoPiramide] || PIRAMIDES.transicion
  const puntaje = sesion.paso_0_puntaje || 0
  const nombreHibrido = sesion.paso_1_nombre_hibrido || '—'

  // Buscar el híbrido en el catálogo por nombre
  const hibridoEntry = Object.values(HIBRIDOS).find(h => h.nombre === nombreHibrido)

  grid.innerHTML = `
    <div class="summary-card">
      <div class="summary-card-eyebrow">Paso 0 · Tipo de pirámide</div>
      <div class="summary-card-title" style="color:${piramide.color}">${piramide.nombre}</div>
      <div class="summary-card-sub">${piramide.descripcion_corta}</div>
      <div class="summary-card-badge" style="background:${piramide.color}18; border:1px solid ${piramide.color}33; color:${piramide.color}">
        <i data-lucide="${piramide.icono}" style="width:13px;height:13px"></i>
        ${puntaje} puntos · ${piramide.rango}
      </div>
    </div>
    <div class="summary-card">
      <div class="summary-card-eyebrow">Paso 1 · Perfil de personalidad</div>
      <div class="summary-card-title" style="color:var(--pink)">${nombreHibrido}</div>
      <div class="summary-card-sub">${hibridoEntry ? hibridoEntry.esencia : 'Identidad empresarial definida en el Paso 1.'}</div>
      <div class="summary-card-badge" style="background:var(--pink-light); border:1px solid rgba(236,72,153,0.25); color:var(--pink)">
        <i data-lucide="dna" style="width:13px;height:13px"></i>
        Híbrido empresarial
      </div>
    </div>
  `
}

// ──────────────────────────────────────────────
// CAPAS DE LA PIRÁMIDE INVERTIDA
// ──────────────────────────────────────────────
function renderLayers(publicos, diferenciadores, habilitadores, rectoresMap) {
  const container = document.getElementById('layers')
  if (!container) return

  container.innerHTML = `
    ${renderLayerPublicos(publicos)}
    ${renderLayerDiferenciadores(diferenciadores)}
    ${renderLayerHabilitadores(habilitadores)}
    ${renderLayerRectores(rectoresMap)}
  `
}

function renderLayerPublicos(publicos) {
  const chips = publicos.length
    ? publicos.map(p => {
        const esDirecto = p.tipo_vinculo === 'directo'
        const esPrimario = p.criticidad === 'primario'
        return `<span class="chip chip-publico">
          ${esPrimario ? '<span class="chip-dot"></span>' : ''}
          ${p.nombre}
        </span>`
      }).join('')
    : `<span class="empty-chip">Sin públicos registrados</span>`

  return `
    <div class="layer">
      <div class="layer-label">
        <div class="layer-label-icon" style="background:var(--pink-light)">
          <i data-lucide="users" style="color:var(--pink)"></i>
        </div>
        <div class="layer-label-name" style="color:var(--pink)">Públicos</div>
        <div class="layer-label-desc">A quién servimos — en la cima de la pirámide</div>
      </div>
      <div class="layer-content">${chips}</div>
    </div>
  `
}

function renderLayerDiferenciadores(diferenciadores) {
  const semaforoLabel = { pendiente: 'Pendiente', legitimo: 'Legítimo', en_construccion: 'En construcción', eslogan: 'Solo eslogan' }

  const chips = diferenciadores.length
    ? diferenciadores.map(d => `
        <span class="chip chip-diferenciador">
          <span class="chip-dot"></span>
          ${d.nombre}
        </span>`).join('')
    : `<span class="empty-chip">Sin diferenciadores registrados</span>`

  return `
    <div class="layer">
      <div class="layer-label">
        <div class="layer-label-icon" style="background:var(--teal-light)">
          <i data-lucide="zap" style="color:var(--teal)"></i>
        </div>
        <div class="layer-label-name" style="color:var(--teal)">Diferenciadores</div>
        <div class="layer-label-desc">Qué nos hace únicos frente a la competencia</div>
      </div>
      <div class="layer-content">${chips}</div>
    </div>
  `
}

function renderLayerHabilitadores(habilitadores) {
  const chips = habilitadores.length
    ? habilitadores.map(h => `
        <span class="chip chip-habilitador">
          <span class="chip-dot"></span>
          ${h.nombre}
        </span>`).join('')
    : `<span class="empty-chip">Sin habilitadores registrados</span>`

  return `
    <div class="layer">
      <div class="layer-label">
        <div class="layer-label-icon" style="background:var(--indigo-light)">
          <i data-lucide="settings" style="color:#7b7ef4"></i>
        </div>
        <div class="layer-label-name" style="color:#7b7ef4">Habilitadores</div>
        <div class="layer-label-desc">Los procesos internos que hacen posible los diferenciadores</div>
      </div>
      <div class="layer-content">${chips}</div>
    </div>
  `
}

function renderLayerRectores(rectoresMap) {
  const estadoColor = { operativo: 'var(--green)', declarado: 'var(--amber)', ausente: 'var(--text-4)' }
  const estadoLabel = { operativo: 'Operativo', declarado: 'Declarado', ausente: 'Ausente' }
  const estadoClass = { operativo: 'rector-operativo', declarado: 'rector-declarado', ausente: 'rector-ausente' }
  const estadoTextColor = { operativo: 'var(--green)', declarado: 'var(--amber)', ausente: 'var(--text-4)' }

  const chips = RECTORES.map(r => {
    const data = rectoresMap[r.codigo] || { estado_actual: 'ausente', ano_construccion: null }
    const estado = data.estado_actual || 'ausente'
    const ano = data.ano_construccion
    return `
      <div class="rector-chip ${estadoClass[estado]}">
        <div class="rector-chip-name">${r.nombre}</div>
        <div class="rector-chip-meta">
          <span class="rector-chip-estado" style="color:${estadoTextColor[estado]}">${estadoLabel[estado]}</span>
          ${ano ? `<span class="rector-chip-ano">· Año ${ano}</span>` : ''}
        </div>
      </div>
    `
  }).join('')

  return `
    <div class="layer">
      <div class="layer-label">
        <div class="layer-label-icon" style="background:var(--gold-light)">
          <i data-lucide="shield" style="color:var(--gold)"></i>
        </div>
        <div class="layer-label-name" style="color:var(--gold)">Rectores</div>
        <div class="layer-label-desc">La base institucional que sostiene todo</div>
      </div>
      <div class="rectores-grid">${chips}</div>
    </div>
  `
}

// ──────────────────────────────────────────────
// DETALLE PIRÁMIDE
// ──────────────────────────────────────────────
function renderPiramideDetail(tipoPiramide) {
  const wrap = document.getElementById('piramide-detail-wrap')
  if (!wrap) return

  const tipo = tipoPiramide || 'transicion'
  const p = PIRAMIDES[tipo] || PIRAMIDES.transicion

  wrap.innerHTML = `
    <div class="piramide-detail">
      <div class="piramide-detail-header">
        <div class="piramide-detail-icon" style="background:${p.color}18; border:1px solid ${p.color}30">
          <i data-lucide="${p.icono}" style="color:${p.color}"></i>
        </div>
        <div>
          <div class="piramide-detail-title">${p.nombre}</div>
          <div class="piramide-detail-rango">${p.rango}</div>
        </div>
      </div>
      <div class="piramide-detail-desc">${p.descripcion_larga}</div>
      <div class="piramide-indicadores">
        <div class="piramide-indicadores-title">Señales características</div>
        ${p.indicadores.map(ind => `<div class="piramide-indicador">${ind}</div>`).join('')}
      </div>
      <div class="piramide-proximo">
        <strong>Próximo paso: </strong>${p.proximo_paso}
      </div>
    </div>
  `
}

// ──────────────────────────────────────────────
// DETALLE HÍBRIDO
// ──────────────────────────────────────────────
function renderHibridoDetail(nombreHibrido) {
  const wrap = document.getElementById('hibrido-detail-wrap')
  if (!wrap || !nombreHibrido) return

  // Buscar por nombre en el catálogo
  const entry = Object.values(HIBRIDOS).find(h => h.nombre === nombreHibrido)
  if (!entry) return

  wrap.innerHTML = `
    <div class="hibrido-card">
      <div class="hibrido-icon">
        <i data-lucide="sparkles"></i>
      </div>
      <div class="hibrido-body">
        <div class="hibrido-eyebrow">Perfil de personalidad · Paso 1</div>
        <div class="hibrido-nombre">${entry.nombre}</div>
        <div class="hibrido-esencia">${entry.esencia}</div>
        <div class="hibrido-row">
          <div class="hibrido-box">
            <div class="hibrido-box-label">Fortaleza central</div>
            <div class="hibrido-box-text">${entry.fortaleza}</div>
          </div>
          <div class="hibrido-box">
            <div class="hibrido-box-label">Punto de atención</div>
            <div class="hibrido-box-text">${entry.debilidad}</div>
          </div>
        </div>
      </div>
    </div>
  `
}
