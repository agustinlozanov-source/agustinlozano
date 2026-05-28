// adn-mapa.js — SCALEx Portal · ADN Paso 2 · Mapa ADN
// 4 capas: Públicos → Diferenciadores → Habilitadores → Rectores

import { supabase, getMyProfile, getMyOrganization } from '/assets/js/supabase-client.js'
import { RECTORES, AGENDA_PASO_2_RECTOR_TEMPLATE } from '/assets/js/adn-piramides-rectores-catalogo.js'

let sesionId = null
let saveTimers = {}

// Estado local de las 4 capas
let publicos = []        // [{id, nombre, que_entregamos, tipo_vinculo, criticidad, notas_consultor, _draft?}]
let diferenciadores = [] // [{id, nombre, prueba1_*, prueba2_*, semaforo, notas_consultor, _draft?}]
let habilitadores = []   // [{id, nombre, output_valioso, que_perderia, semaforo, notas_consultor, _draft?}]
let rectores = {}        // { codigo: { id, estado_actual, ano_construccion, notas_consultor } }

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const perfil = await getMyProfile()
  if (!perfil) return
  const org = await getMyOrganization()
  if (!org) return

  const { data: sid, error } = await supabase.rpc('adn_sesion_activa', {
    p_organizacion_id: org.id,
    p_consultor_id: perfil.id
  })
  if (error || !sid) { console.error('❌ adn_sesion_activa:', error?.message); return }
  sesionId = sid

  // Verificar pasos anteriores completados
  const { data: sesion } = await supabase
    .from('adn_sesiones')
    .select('paso_1_estado, paso_2_estado')
    .eq('id', sesionId)
    .maybeSingle()

  if (sesion?.paso_1_estado !== 'completado') {
    window.location.href = '/portal/adn.html'
    return
  }

  // Cargar todo en paralelo
  await Promise.all([
    cargarPublicos(),
    cargarDiferenciadores(),
    cargarHabilitadores(),
    cargarRectores()
  ])

  renderPublicos()
  renderDiferenciadores()
  renderHabilitadores()
  renderRectores()
  actualizarContadores()
  verificarCompletable()

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => cambiarTab(btn.dataset.tab))
  })

  document.getElementById('btn-add-publico').addEventListener('click', agregarPublico)
  document.getElementById('btn-add-diferenciador').addEventListener('click', agregarDiferenciador)
  document.getElementById('btn-add-habilitador').addEventListener('click', agregarHabilitador)
  document.getElementById('btn-completar').addEventListener('click', completarPaso2)

  // Si ya completado
  if (sesion?.paso_2_estado === 'completado') {
    const btnWrap = document.getElementById('completar-wrap')
    btnWrap.style.display = 'flex'
    const hint = document.getElementById('completar-hint')
    hint.textContent = '✓ Paso 2 completado'
    document.getElementById('btn-completar').disabled = true
  }
})

// ──────────────────────────────────────────────
// TABS
// ──────────────────────────────────────────────
function cambiarTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab))
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('visible', c.id === `tab-${tab}`)
  })
}

// ──────────────────────────────────────────────
// CARGAR DATOS
// ──────────────────────────────────────────────
async function cargarPublicos() {
  const { data } = await supabase
    .from('adn_paso2_publicos')
    .select('*')
    .eq('sesion_id', sesionId)
    .order('orden')
  publicos = data || []
}

async function cargarDiferenciadores() {
  const { data } = await supabase
    .from('adn_paso2_diferenciadores')
    .select('*')
    .eq('sesion_id', sesionId)
    .order('orden')
  diferenciadores = data || []
}

async function cargarHabilitadores() {
  const { data } = await supabase
    .from('adn_paso2_habilitadores')
    .select('*')
    .eq('sesion_id', sesionId)
    .order('orden')
  habilitadores = data || []
}

async function cargarRectores() {
  const { data } = await supabase
    .from('adn_paso2_rectores')
    .select('*')
    .eq('sesion_id', sesionId)
  rectores = {}
  if (data) {
    data.forEach(r => { rectores[r.rector_codigo] = r })
  }
}

// ──────────────────────────────────────────────
// RENDER PÚBLICOS
// ──────────────────────────────────────────────
function renderPublicos() {
  const list = document.getElementById('publicos-list')
  list.innerHTML = ''
  publicos.forEach((pub, idx) => {
    const card = document.createElement('div')
    card.className = `item-card${pub.nombre ? ' has-data' : ''}`
    card.id = `pub-card-${pub.id}`
    card.innerHTML = `
      <div class="item-card-header">
        <div class="item-num">${idx + 1}</div>
        <div class="item-nombre-wrap">
          <div class="item-nombre-label">Nombre del público</div>
          <input class="item-nombre-input" type="text" placeholder="Ej. Directores de PyME industrial…" value="${esc(pub.nombre)}" data-field="nombre" data-id="${pub.id}">
        </div>
        <button class="item-delete" data-id="${pub.id}" data-tipo="publico" title="Eliminar"><i data-lucide="trash-2"></i></button>
      </div>
      <div class="fields-grid">
        <div class="field-group">
          <div class="field-label">¿Qué les entregamos?</div>
          <textarea class="field-textarea" placeholder="Describe qué reciben de la empresa…" data-field="que_entregamos" data-id="${pub.id}" rows="2">${esc(pub.que_entregamos)}</textarea>
        </div>
        <div class="fields-grid" style="grid-template-columns:1fr 1fr;gap:12px">
          <div class="field-group">
            <div class="field-label">Tipo de vínculo</div>
            <div class="pill-group">
              ${['directo','rebote'].map(v => `
                <div class="pill-option">
                  <input type="radio" name="vinculo-${pub.id}" id="vin-${v}-${pub.id}" value="${v}" ${pub.tipo_vinculo===v?'checked':''} data-field="tipo_vinculo" data-id="${pub.id}">
                  <label for="vin-${v}-${pub.id}">${v==='directo'?'Directo':'Rebote'}</label>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="field-group">
            <div class="field-label">Criticidad</div>
            <div class="pill-group">
              ${['primario','secundario','tangencial'].map(v => `
                <div class="pill-option">
                  <input type="radio" name="crit-${pub.id}" id="crit-${v}-${pub.id}" value="${v}" ${pub.criticidad===v?'checked':''} data-field="criticidad" data-id="${pub.id}">
                  <label for="crit-${v}-${pub.id}">${v.charAt(0).toUpperCase()+v.slice(1)}</label>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="field-group">
          <div class="field-label">Notas del consultor</div>
          <textarea class="field-textarea" placeholder="Observaciones, contexto adicional…" data-field="notas_consultor" data-id="${pub.id}" rows="2">${esc(pub.notas_consultor)}</textarea>
        </div>
      </div>
    `
    list.appendChild(card)
  })

  attachPublicoListeners()
  lucide.createIcons()
}

function attachPublicoListeners() {
  const list = document.getElementById('publicos-list')

  list.querySelectorAll('input[type="text"], textarea').forEach(input => {
    input.addEventListener('input', () => {
      const id = input.dataset.id
      const field = input.dataset.field
      debounceSave(id, () => guardarPublico(id, field, input.value))
    })
  })

  list.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const id = radio.dataset.id
      const field = radio.dataset.field
      guardarPublico(id, field, radio.value)
    })
  })

  list.querySelectorAll('.item-delete').forEach(btn => {
    btn.addEventListener('click', () => eliminarItem('publico', btn.dataset.id))
  })
}

// ──────────────────────────────────────────────
// RENDER DIFERENCIADORES
// ──────────────────────────────────────────────
function renderDiferenciadores() {
  const list = document.getElementById('diferenciadores-list')
  list.innerHTML = ''

  diferenciadores.forEach((dif, idx) => {
    const card = document.createElement('div')
    card.className = `item-card${dif.nombre ? ' has-data' : ''}`
    card.id = `dif-card-${dif.id}`

    const semaforoOpts = [
      {v:'pendiente', l:'Pendiente'},
      {v:'legitimo', l:'Legítimo'},
      {v:'en_construccion', l:'En construcción'},
      {v:'eslogan', l:'Eslogan'}
    ]

    card.innerHTML = `
      <div class="item-card-header">
        <div class="item-num">${idx + 1}</div>
        <div class="item-nombre-wrap">
          <div class="item-nombre-label">Nombre del diferenciador</div>
          <input class="item-nombre-input" type="text" placeholder="Ej. Metodología de acompañamiento post-venta…" value="${esc(dif.nombre)}" data-field="nombre" data-id="${dif.id}">
        </div>
        <button class="item-delete" data-id="${dif.id}" data-tipo="diferenciador" title="Eliminar"><i data-lucide="trash-2"></i></button>
      </div>

      <div class="pruebas-section">
        <div class="pruebas-section-title"><i data-lucide="check-square"></i> Prueba 1 — ¿Es real o es una ocurrencia?</div>
        <div class="fields-grid" style="gap:10px">
          <div class="field-group">
            <div class="field-label">¿Por qué crees que esto te hace único?</div>
            <textarea class="field-textarea" rows="2" placeholder="" data-field="prueba1_unicidad" data-id="${dif.id}">${esc(dif.prueba1_unicidad)}</textarea>
          </div>
          <div class="field-group">
            <div class="field-label">¿Cómo sabes que la competencia NO hace esto?</div>
            <textarea class="field-textarea" rows="2" placeholder="" data-field="prueba1_competencia" data-id="${dif.id}">${esc(dif.prueba1_competencia)}</textarea>
          </div>
          <div class="field-group">
            <div class="field-label">¿Qué reciben los públicos gracias a esto?</div>
            <textarea class="field-textarea" rows="2" placeholder="" data-field="prueba1_publicos" data-id="${dif.id}">${esc(dif.prueba1_publicos)}</textarea>
          </div>
          <div class="field-group">
            <div class="field-label">¿Qué se perdería si dejaras de hacerlo?</div>
            <textarea class="field-textarea" rows="2" placeholder="" data-field="prueba1_si_desaparece" data-id="${dif.id}">${esc(dif.prueba1_si_desaparece)}</textarea>
          </div>
        </div>
      </div>

      <div class="pruebas-section" style="margin-top:10px">
        <div class="pruebas-section-title"><i data-lucide="wrench"></i> Prueba 2 — ¿Es proceso real o eslogan?</div>
        <div class="fields-grid" style="gap:10px">
          <div class="field-group">
            <div class="field-label">¿Qué procesos concretos lo operan hoy?</div>
            <textarea class="field-textarea" rows="2" placeholder="" data-field="prueba2_procesos" data-id="${dif.id}">${esc(dif.prueba2_procesos)}</textarea>
          </div>
          <div class="field-group">
            <div class="field-label">¿Qué áreas o departamentos lo sostienen?</div>
            <textarea class="field-textarea" rows="2" placeholder="" data-field="prueba2_areas" data-id="${dif.id}">${esc(dif.prueba2_areas)}</textarea>
          </div>
          <div class="field-group">
            <div class="field-label">¿Cómo se entrena al equipo para ejecutarlo?</div>
            <textarea class="field-textarea" rows="2" placeholder="" data-field="prueba2_entrenamiento" data-id="${dif.id}">${esc(dif.prueba2_entrenamiento)}</textarea>
          </div>
          <div class="field-group">
            <div class="field-label">¿Cómo mides que está pasando de verdad?</div>
            <textarea class="field-textarea" rows="2" placeholder="" data-field="prueba2_medicion" data-id="${dif.id}">${esc(dif.prueba2_medicion)}</textarea>
          </div>
        </div>
      </div>

      <div class="field-group" style="margin-top:12px">
        <div class="field-label">Veredicto semáforo</div>
        <select class="semaforo-select" data-field="semaforo" data-id="${dif.id}">
          ${semaforoOpts.map(o => `<option value="${o.v}" ${dif.semaforo===o.v?'selected':''}>${o.l}</option>`).join('')}
        </select>
      </div>

      <div class="field-group" style="margin-top:10px">
        <div class="field-label">Notas del consultor</div>
        <textarea class="field-textarea" rows="2" placeholder="" data-field="notas_consultor" data-id="${dif.id}">${esc(dif.notas_consultor)}</textarea>
      </div>
    `
    list.appendChild(card)
  })

  attachDiferenciadorListeners()
  lucide.createIcons()
}

function attachDiferenciadorListeners() {
  const list = document.getElementById('diferenciadores-list')
  list.querySelectorAll('textarea, input[type="text"]').forEach(el => {
    el.addEventListener('input', () => {
      debounceSave(el.dataset.id + el.dataset.field, () => guardarDiferenciador(el.dataset.id, el.dataset.field, el.value))
    })
  })
  list.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', () => guardarDiferenciador(sel.dataset.id, sel.dataset.field, sel.value))
  })
  list.querySelectorAll('.item-delete').forEach(btn => {
    btn.addEventListener('click', () => eliminarItem('diferenciador', btn.dataset.id))
  })
}

// ──────────────────────────────────────────────
// RENDER HABILITADORES
// ──────────────────────────────────────────────
function renderHabilitadores() {
  const list = document.getElementById('habilitadores-list')
  list.innerHTML = ''

  habilitadores.forEach((hab, idx) => {
    const card = document.createElement('div')
    card.className = `item-card${hab.nombre ? ' has-data' : ''}`
    card.id = `hab-card-${hab.id}`

    const semaforoOpts = [
      {v:'pendiente', l:'Pendiente'},
      {v:'real', l:'Real'},
      {v:'en_formacion', l:'En formación'},
      {v:'area_disfrazada', l:'Área disfrazada'}
    ]

    card.innerHTML = `
      <div class="item-card-header">
        <div class="item-num">${idx + 1}</div>
        <div class="item-nombre-wrap">
          <div class="item-nombre-label">Nombre del habilitador</div>
          <input class="item-nombre-input" type="text" placeholder="El nombre-output que surge del método socrático…" value="${esc(hab.nombre)}" data-field="nombre" data-id="${hab.id}">
        </div>
        <button class="item-delete" data-id="${hab.id}" data-tipo="habilitador" title="Eliminar"><i data-lucide="trash-2"></i></button>
      </div>

      <div class="fields-grid">
        <div class="field-group">
          <div class="field-label">¿Qué entrega valioso produces internamente?</div>
          <textarea class="field-textarea" rows="2" placeholder="El output interno más valioso de esta empresa es…" data-field="output_valioso" data-id="${hab.id}">${esc(hab.output_valioso)}</textarea>
        </div>
        <div class="field-group">
          <div class="field-label">¿Qué perderías exactamente si dejara de pasar?</div>
          <textarea class="field-textarea" rows="2" placeholder="Si ese output desapareciera, lo primero que perderíamos es…" data-field="que_perderia" data-id="${hab.id}">${esc(hab.que_perderia)}</textarea>
        </div>
        <div class="field-group">
          <div class="field-label">Veredicto semáforo</div>
          <select class="semaforo-select" data-field="semaforo" data-id="${hab.id}">
            ${semaforoOpts.map(o => `<option value="${o.v}" ${hab.semaforo===o.v?'selected':''}>${o.l}</option>`).join('')}
          </select>
        </div>
        <div class="field-group">
          <div class="field-label">Notas del consultor</div>
          <textarea class="field-textarea" rows="2" placeholder="" data-field="notas_consultor" data-id="${hab.id}">${esc(hab.notas_consultor)}</textarea>
        </div>
      </div>
    `
    list.appendChild(card)
  })

  attachHabilitadorListeners()
  lucide.createIcons()
}

function attachHabilitadorListeners() {
  const list = document.getElementById('habilitadores-list')
  list.querySelectorAll('textarea, input[type="text"]').forEach(el => {
    el.addEventListener('input', () => {
      debounceSave(el.dataset.id + el.dataset.field, () => guardarHabilitador(el.dataset.id, el.dataset.field, el.value))
    })
  })
  list.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', () => guardarHabilitador(sel.dataset.id, sel.dataset.field, sel.value))
  })
  list.querySelectorAll('.item-delete').forEach(btn => {
    btn.addEventListener('click', () => eliminarItem('habilitador', btn.dataset.id))
  })
}

// ──────────────────────────────────────────────
// RENDER RECTORES
// ──────────────────────────────────────────────
function renderRectores() {
  const list = document.getElementById('rectores-list')
  list.innerHTML = ''

  const RECTOR_ICONOS = {
    planeacion_estrategica: 'map',
    auditoria: 'search',
    legal_fiscal: 'scale',
    normatividad: 'book-open',
    transformacion: 'refresh-cw',
    gobierno_institucional: 'building'
  }

  RECTORES.forEach(rector => {
    const saved = rectores[rector.codigo] || {}
    const card = document.createElement('div')
    card.className = `rector-card${saved.estado_actual && saved.estado_actual !== 'ausente' ? ' has-data' : ''}`
    card.id = `rector-card-${rector.codigo}`

    card.innerHTML = `
      <div class="rector-header">
        <div class="rector-icon"><i data-lucide="${RECTOR_ICONOS[rector.codigo] || 'shield'}"></i></div>
        <div>
          <div class="rector-titulo">${rector.nombre}</div>
          <div class="rector-desc">${rector.descripcion_corta}</div>
        </div>
      </div>
      <div class="rector-pregunta">${rector.pregunta_evaluacion}</div>
      <div class="rector-controls">
        <div class="field-group">
          <div class="field-label">Estado actual</div>
          <div class="pill-group">
            ${[{v:'ausente',l:'Ausente'},{v:'declarado',l:'Declarado'},{v:'operativo',l:'Operativo'}].map(o => `
              <div class="pill-option">
                <input type="radio" name="estado-${rector.codigo}" id="est-${rector.codigo}-${o.v}" value="${o.v}" ${(saved.estado_actual||'ausente')===o.v?'checked':''} data-codigo="${rector.codigo}" data-field="estado_actual">
                <label for="est-${rector.codigo}-${o.v}">${o.l}</label>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="rector-ano-group">
          <div class="rector-ano-label">Año de construcción</div>
          <div class="rector-ano-pills">
            ${[1,2,3].map(n => `
              <div class="ano-pill">
                <input type="radio" name="ano-${rector.codigo}" id="ano-${rector.codigo}-${n}" value="${n}" ${saved.ano_construccion===n?'checked':''} data-codigo="${rector.codigo}" data-field="ano_construccion">
                <label for="ano-${rector.codigo}-${n}">${n}</label>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="field-group" style="margin-top:12px">
        <div class="field-label">Notas del consultor</div>
        <textarea class="field-textarea" rows="2" placeholder="" data-codigo="${rector.codigo}" data-field="notas_consultor">${esc(saved.notas_consultor)}</textarea>
      </div>
      <div class="rector-si-no" style="margin-top:10px">
        <strong>Si no existe: </strong>${rector.si_no_existe}
      </div>
    `
    list.appendChild(card)
  })

  attachRectorListeners()
  lucide.createIcons()
}

function attachRectorListeners() {
  const list = document.getElementById('rectores-list')

  list.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const codigo = radio.dataset.codigo
      const field = radio.dataset.field
      const value = field === 'ano_construccion' ? parseInt(radio.value) : radio.value
      guardarRector(codigo, field, value)
    })
  })

  list.querySelectorAll('textarea').forEach(ta => {
    ta.addEventListener('input', () => {
      const codigo = ta.dataset.codigo
      debounceSave('rector-' + codigo, () => guardarRector(codigo, 'notas_consultor', ta.value))
    })
  })
}

// ──────────────────────────────────────────────
// AGREGAR ITEMS
// ──────────────────────────────────────────────
async function agregarPublico() {
  const tempId = 'draft-' + Date.now()
  const draft = { id: tempId, nombre: '', que_entregamos: '', tipo_vinculo: null, criticidad: null, notas_consultor: '', orden: publicos.length, _draft: true }
  publicos.push(draft)
  renderPublicos()
  actualizarContadores()

  const newCard = document.getElementById(`pub-card-${tempId}`)
  newCard?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  newCard?.querySelector('input')?.focus()
}

async function agregarDiferenciador() {
  const tempId = 'draft-' + Date.now()
  const draft = { id: tempId, nombre: '', semaforo: 'pendiente', orden: diferenciadores.length, _draft: true }
  diferenciadores.push(draft)
  renderDiferenciadores()
  actualizarContadores()

  const newCard = document.getElementById(`dif-card-${tempId}`)
  newCard?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  newCard?.querySelector('input')?.focus()
}

async function agregarHabilitador() {
  const tempId = 'draft-' + Date.now()
  const draft = { id: tempId, nombre: '', semaforo: 'pendiente', orden: habilitadores.length, _draft: true }
  habilitadores.push(draft)
  renderHabilitadores()
  actualizarContadores()

  const newCard = document.getElementById(`hab-card-${tempId}`)
  newCard?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  newCard?.querySelector('input')?.focus()
}

// ──────────────────────────────────────────────
// ELIMINAR ITEMS
// ──────────────────────────────────────────────
async function eliminarItem(tipo, id) {
  // Si es draft local, solo eliminar del array
  const isDraft = id.startsWith('draft-')

  if (!isDraft) {
    const tabla = { publico: 'adn_paso2_publicos', diferenciador: 'adn_paso2_diferenciadores', habilitador: 'adn_paso2_habilitadores' }[tipo]
    if (!tabla) return
    setSaveIndicator('saving')
    const { error } = await supabase.from(tabla).delete().eq('id', id)
    if (error) { console.error('❌ delete:', error.message); setSaveIndicator('error'); return }
    setSaveIndicator('saved')
  }

  if (tipo === 'publico') { publicos = publicos.filter(p => p.id !== id); renderPublicos() }
  if (tipo === 'diferenciador') { diferenciadores = diferenciadores.filter(d => d.id !== id); renderDiferenciadores() }
  if (tipo === 'habilitador') { habilitadores = habilitadores.filter(h => h.id !== id); renderHabilitadores() }

  actualizarContadores()
}

// ──────────────────────────────────────────────
// GUARDAR PÚBLICO
// ──────────────────────────────────────────────
async function guardarPublico(id, field, value) {
  const item = publicos.find(p => p.id === id)
  if (!item) return
  item[field] = value

  // Si es draft y el campo nombre aún está vacío, no persistir
  if (item._draft) {
    if (!item.nombre?.trim()) return
    // Primer insert real
    setSaveIndicator('saving')
    const { data, error } = await supabase
      .from('adn_paso2_publicos')
      .insert({ sesion_id: sesionId, nombre: item.nombre.trim(), que_entregamos: item.que_entregamos || '', tipo_vinculo: item.tipo_vinculo, criticidad: item.criticidad, notas_consultor: item.notas_consultor || '', orden: item.orden })
      .select().single()
    if (error) { console.error('❌ insert publico:', error.message); setSaveIndicator('error'); return }
    // Reemplazar draft con el registro real
    const idx = publicos.findIndex(p => p.id === id)
    publicos[idx] = data
    renderPublicos()
    actualizarContadores()
    setSaveIndicator('saved')
    verificarCompletable()
    return
  }

  setSaveIndicator('saving')
  const { error } = await supabase
    .from('adn_paso2_publicos')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) { console.error('❌ update publico:', error.message); setSaveIndicator('error') }
  else { setSaveIndicator('saved'); verificarCompletable() }
}

// ──────────────────────────────────────────────
// GUARDAR DIFERENCIADOR
// ──────────────────────────────────────────────
async function guardarDiferenciador(id, field, value) {
  const item = diferenciadores.find(d => d.id === id)
  if (!item) return
  item[field] = value

  if (item._draft) {
    if (!item.nombre?.trim()) return
    setSaveIndicator('saving')
    const { data, error } = await supabase
      .from('adn_paso2_diferenciadores')
      .insert({ sesion_id: sesionId, nombre: item.nombre.trim(), semaforo: item.semaforo || 'pendiente', orden: item.orden })
      .select().single()
    if (error) { console.error('❌ insert diferenciador:', error.message); setSaveIndicator('error'); return }
    const idx = diferenciadores.findIndex(d => d.id === id)
    diferenciadores[idx] = data
    renderDiferenciadores()
    actualizarContadores()
    setSaveIndicator('saved')
    return
  }

  setSaveIndicator('saving')
  const { error } = await supabase
    .from('adn_paso2_diferenciadores')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) { console.error('❌ update diferenciador:', error.message); setSaveIndicator('error') }
  else setSaveIndicator('saved')
}

// ──────────────────────────────────────────────
// GUARDAR HABILITADOR
// ──────────────────────────────────────────────
async function guardarHabilitador(id, field, value) {
  const item = habilitadores.find(h => h.id === id)
  if (!item) return
  item[field] = value

  if (item._draft) {
    if (!item.nombre?.trim()) return
    setSaveIndicator('saving')
    const { data, error } = await supabase
      .from('adn_paso2_habilitadores')
      .insert({ sesion_id: sesionId, nombre: item.nombre.trim(), semaforo: item.semaforo || 'pendiente', orden: item.orden })
      .select().single()
    if (error) { console.error('❌ insert habilitador:', error.message); setSaveIndicator('error'); return }
    const idx = habilitadores.findIndex(h => h.id === id)
    habilitadores[idx] = data
    renderHabilitadores()
    actualizarContadores()
    setSaveIndicator('saved')
    return
  }

  setSaveIndicator('saving')
  const { error } = await supabase
    .from('adn_paso2_habilitadores')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) { console.error('❌ update habilitador:', error.message); setSaveIndicator('error') }
  else setSaveIndicator('saved')
}

// ──────────────────────────────────────────────
// GUARDAR RECTOR
// ──────────────────────────────────────────────
async function guardarRector(codigo, field, value) {
  setSaveIndicator('saving')
  if (!rectores[codigo]) rectores[codigo] = {}
  rectores[codigo][field] = value

  const { error } = await supabase
    .from('adn_paso2_rectores')
    .upsert(
      { sesion_id: sesionId, rector_codigo: codigo, ...rectores[codigo], updated_at: new Date().toISOString() },
      { onConflict: 'sesion_id,rector_codigo' }
    )

  if (error) { console.error('❌ upsert rector:', error.message); setSaveIndicator('error') }
  else {
    setSaveIndicator('saved')
    verificarCompletable()
    // Marcar card como has-data si no es ausente
    const card = document.getElementById(`rector-card-${codigo}`)
    if (card) {
      card.classList.toggle('has-data', rectores[codigo].estado_actual !== 'ausente' && rectores[codigo].estado_actual != null)
    }
    // Actualizar contador rectores
    actualizarContadores()
  }
}

// ──────────────────────────────────────────────
// CONTADORES Y COMPLETABLE
// ──────────────────────────────────────────────
function actualizarContadores() {
  document.getElementById('count-publicos').textContent = publicos.filter(p => p.nombre?.trim()).length
  document.getElementById('count-diferenciadores').textContent = diferenciadores.filter(d => d.nombre?.trim()).length
  document.getElementById('count-habilitadores').textContent = habilitadores.filter(h => h.nombre?.trim()).length
  const rectoresEvaluados = Object.values(rectores).filter(r => r.estado_actual && r.estado_actual !== 'ausente').length
  document.getElementById('count-rectores').textContent = `${rectoresEvaluados}/6`
}

function verificarCompletable() {
  const tienePublicos = publicos.filter(p => p.nombre?.trim()).length >= 1
  const tieneDiferenciadores = diferenciadores.filter(d => d.nombre?.trim()).length >= 1
  const tieneHabilitadores = habilitadores.filter(h => h.nombre?.trim()).length >= 1
  const rectoresEvaluados = Object.values(rectores).filter(r => r.estado_actual).length

  const wrap = document.getElementById('completar-wrap')
  const hint = document.getElementById('completar-hint')

  if (tienePublicos && tieneDiferenciadores && tieneHabilitadores && rectoresEvaluados === 6) {
    wrap.style.display = 'flex'
    hint.textContent = 'Mapa completo — listo para completar'
  } else {
    const falta = []
    if (!tienePublicos) falta.push('1+ público')
    if (!tieneDiferenciadores) falta.push('1+ diferenciador')
    if (!tieneHabilitadores) falta.push('1+ habilitador')
    if (rectoresEvaluados < 6) falta.push(`${6 - rectoresEvaluados} rector(es)`)
    wrap.style.display = 'flex'
    hint.textContent = `Falta: ${falta.join(', ')}`
    document.getElementById('btn-completar').disabled = falta.length > 0
  }
}

// ──────────────────────────────────────────────
// COMPLETAR PASO 2
// ──────────────────────────────────────────────
async function completarPaso2() {
  const btn = document.getElementById('btn-completar')
  btn.disabled = true
  btn.innerHTML = '<i data-lucide="loader"></i> Completando…'
  lucide.createIcons()

  const { error } = await supabase.rpc('adn_completar_paso_2', { p_sesion_id: sesionId })
  if (error) {
    console.error('❌ adn_completar_paso_2:', error.message)
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="check-circle"></i> Reintentar'
    lucide.createIcons()
    return
  }

  // Generar agendas para cada rector evaluado
  await generarAgendasRectores()

  btn.innerHTML = '<i data-lucide="check-circle"></i> Paso 2 completado'
  document.getElementById('completar-hint').textContent = '✓ Mapa ADN completado'
  setSaveIndicator('saved')

  setTimeout(() => {
    window.location.href = '/portal/adn.html'
  }, 1800)
}

// ──────────────────────────────────────────────
// GENERAR AGENDAS — rector elegido (año 1)
// ──────────────────────────────────────────────
async function generarAgendasRectores() {
  // Solo genera agenda para rectores asignados a Año 1 y no operativos
  const rectoresAno1 = Object.entries(rectores)
    .filter(([, r]) => r.ano_construccion === 1 && r.estado_actual !== 'operativo')

  if (rectoresAno1.length === 0) return

  const filas = []
  for (const [codigo, r] of rectoresAno1) {
    const info = RECTORES.find(rec => rec.codigo === codigo)
    const nombre = info?.nombre || codigo

    filas.push(
      { sesion_id: sesionId, paso: 'paso_2_rector', horizonte: '7_dias',
        contenido: `[${nombre}] ${AGENDA_PASO_2_RECTOR_TEMPLATE['7_dias']}`,
        referencia_id: r.id || null },
      { sesion_id: sesionId, paso: 'paso_2_rector', horizonte: '30_dias',
        contenido: `[${nombre}] ${AGENDA_PASO_2_RECTOR_TEMPLATE['30_dias']}`,
        referencia_id: r.id || null },
      { sesion_id: sesionId, paso: 'paso_2_rector', horizonte: '90_dias',
        contenido: `[${nombre}] ${AGENDA_PASO_2_RECTOR_TEMPLATE['90_dias']}`,
        referencia_id: r.id || null }
    )
  }

  const { error } = await supabase
    .from('adn_agendas')
    .upsert(filas, { onConflict: 'sesion_id,paso,horizonte' })

  if (error) console.error('❌ adn_agendas rectores:', error.message)
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
function esc(val) {
  if (!val) return ''
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function debounceSave(key, fn) {
  clearTimeout(saveTimers[key])
  saveTimers[key] = setTimeout(fn, 800)
}

function setSaveIndicator(estado) {
  const el = document.getElementById('save-indicator')
  const txt = document.getElementById('save-text')
  if (!el || !txt) return
  el.className = 'save-indicator ' + estado
  const labels = { saving: 'Guardando…', saved: 'Guardado ✓', error: 'Error al guardar', idle: '—' }
  txt.textContent = labels[estado] || '—'
  if (estado === 'saved') setTimeout(() => setSaveIndicator('idle'), 2500)
}
