// admin-pipeline.js — SCALEx Portal Pipeline Admin View
// Guard: solo accesible si rol_global === 'admin'

import { supabase, getMyProfile } from '/assets/js/supabase-client.js'

let rows = []
let sortKey = 'total'
let sortDir = 'desc'

document.addEventListener('DOMContentLoaded', async () => {
  const perfil = await getMyProfile()
  if (!perfil || perfil.rol_global !== 'admin') {
    window.location.href = '/portal/dashboard.html'
    return
  }

  document.getElementById('search-input')?.addEventListener('input', renderTabla)
  await cargarDatos()
})

window.cargarDatos = async function() {
  const tbody = document.getElementById('tabla-body')
  if (tbody) tbody.innerHTML = '<tr class="loading-row"><td colspan="9">Cargando datos…</td></tr>'

  // Traer todos los prospectos activos + perfil del consultor
  const { data: prospectos, error: e1 } = await supabase
    .from('prospectos')
    .select('id, consultor_id, etapa')
    .neq('etapa', 'descartado')

  const { data: perfiles, error: e2 } = await supabase
    .from('perfiles')
    .select('id, nombre, apellido, email, cert_vigente, nivel_consultor, cert_numero')

  if (e1 || e2) {
    console.error('❌ admin-pipeline:', e1?.message, e2?.message)
    if (tbody) tbody.innerHTML = '<tr class="loading-row"><td colspan="9">Error al cargar datos</td></tr>'
    return
  }

  // Agrupar prospectos por consultor
  const mapa = {}
  for (const p of prospectos || []) {
    if (!mapa[p.consultor_id]) mapa[p.consultor_id] = { sin_contactar:0, conversacion_iniciada:0, reunion_agendada:0, en_propuesta:0, cuenta_activa:0 }
    if (mapa[p.consultor_id][p.etapa] !== undefined) mapa[p.consultor_id][p.etapa]++
  }

  // Armar rows solo con consultores que tienen prospectos
  rows = Object.entries(mapa).map(([consultor_id, etapas]) => {
    const perfil = (perfiles || []).find(p => p.id === consultor_id) || {}
    const total = Object.values(etapas).reduce((s, n) => s + n, 0)
    return {
      consultor_id,
      nombre: [perfil.nombre, perfil.apellido].filter(Boolean).join(' ') || perfil.email || '—',
      email: perfil.email || '',
      cert_vigente: perfil.cert_vigente,
      nivel_consultor: perfil.nivel_consultor,
      ...etapas,
      total,
      tasa: total > 0 ? Math.round((etapas.cuenta_activa / total) * 100) : 0
    }
  })

  actualizarMetricasGlobales()
  renderTabla()
}

function actualizarMetricasGlobales() {
  const total = rows.reduce((s, r) => s + (r.total || 0), 0)
  const activos = rows.reduce((s, r) => s + (r.cuenta_activa || 0), 0)
  const propuesta = rows.reduce((s, r) => s + (r.en_propuesta || 0), 0)
  const tasa = total > 0 ? Math.round((activos / total) * 100) : 0

  setText('m-total', total)
  setText('m-activos', activos)
  setText('m-propuesta', propuesta)
  setText('m-tasa', `${tasa}%`)
  setText('badge-consultores', `${rows.length} consultor${rows.length !== 1 ? 'es' : ''}`)
}

function renderTabla() {
  const query = (document.getElementById('search-input')?.value || '').toLowerCase()

  let lista = rows.filter(r =>
    !query || (r.nombre || '').toLowerCase().includes(query) || (r.email || '').toLowerCase().includes(query)
  )

  // Sort
  lista = lista.sort((a, b) => {
    let va = a[sortKey] ?? 0
    let vb = b[sortKey] ?? 0
    if (typeof va === 'string') va = va.toLowerCase()
    if (typeof vb === 'string') vb = vb.toLowerCase()
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const tbody = document.getElementById('tabla-body')
  if (!tbody) return

  if (!lista.length) {
    tbody.innerHTML = '<tr class="loading-row"><td colspan="9">Sin datos</td></tr>'
    return
  }

  tbody.innerHTML = lista.map(r => {
    const tasa = r.total > 0 ? Math.round((r.cuenta_activa / r.total) * 100) : 0
    const tasaWidth = Math.max(tasa, 2)

    return `
      <tr>
        <td>
          <div class="consultor-name">${escHtml(r.nombre || '—')}</div>
          <div style="font-size:11px;color:var(--text-4)">${escHtml(r.email || '')}</div>
        </td>
        <td>
          <span class="cert-badge ${r.cert_vigente ? 'vigente' : 'sin-cert'}">
            ${r.cert_vigente ? (r.nivel_consultor || 'Cert') : 'Sin cert.'}
          </span>
        </td>
        <td><span class="num-cell">${r.total || 0}</span></td>
        <td style="color:var(--text-3)">${r.sin_contactar || 0}</td>
        <td style="color:#b8b7ff">${r.conversacion_iniciada || 0}</td>
        <td style="color:var(--teal)">${r.reunion_agendada || 0}</td>
        <td style="color:var(--amber)">${r.en_propuesta || 0}</td>
        <td style="color:var(--green);font-weight:700">${r.cuenta_activa || 0}</td>
        <td>
          <div class="tasa-bar">
            <div style="flex:1;height:6px;background:var(--surface);border-radius:99px;overflow:hidden;min-width:60px">
              <div class="tasa-fill" style="width:${tasaWidth}%"></div>
            </div>
            <span class="tasa-num">${tasa}%</span>
          </div>
        </td>
      </tr>`
  }).join('')
}

window.sortBy = function(key) {
  if (sortKey === key) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey = key
    sortDir = 'desc'
  }

  // Actualizar clases en headers
  document.querySelectorAll('thead th').forEach(th => {
    th.classList.remove('sorted')
    const icon = th.querySelector('.sort-icon')
    if (icon) icon.textContent = '↕'
  })
  // Highlight columna activa — buscar el th que llama a sortBy(key)
  document.querySelectorAll('thead th').forEach(th => {
    if (th.getAttribute('onclick') === `sortBy('${key}')`) {
      th.classList.add('sorted')
      const icon = th.querySelector('.sort-icon')
      if (icon) icon.textContent = sortDir === 'asc' ? '↑' : '↓'
    }
  })

  renderTabla()
}

function setText(id, val) {
  const el = document.getElementById(id)
  if (el) el.textContent = val
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
