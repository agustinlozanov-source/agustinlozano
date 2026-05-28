// adn-piramide.js — SCALEx Portal · ADN Paso 0 · Diagnóstico de Pirámide

import { supabase, getMyProfile, getMyOrganization } from '/assets/js/supabase-client.js'
import { TESIS_PASO_0, PUNTAJE_RESPUESTA, RANGOS_PIRAMIDE } from '/assets/js/adn-paso0-catalogo.js'
import { PIRAMIDES, AGENDAS_PASO_0 } from '/assets/js/adn-piramides-rectores-catalogo.js'

let sesionId = null
let respuestasMap = {}   // { tesis_numero: { tipo, notas } }
let saveTimers = {}

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

  // Cargar respuestas existentes
  const { data: respExist } = await supabase
    .from('adn_respuestas_p0')
    .select('tesis_numero, respuesta_tipo, notas_consultor')
    .eq('sesion_id', sesionId)

  if (respExist) {
    respExist.forEach(r => {
      respuestasMap[r.tesis_numero] = { tipo: r.respuesta_tipo, notas: r.notas_consultor || '' }
    })
  }

  // Verificar si ya completado
  const { data: sesion } = await supabase
    .from('adn_sesiones')
    .select('paso_0_completado, tipo_piramide, puntaje_piramide')
    .eq('id', sesionId)
    .maybeSingle()

  renderTesis()
  actualizarPanel()

  if (sesion?.paso_0_completado) {
    mostrarResultado(sesion.tipo_piramide, sesion.puntaje_piramide)
  }

  document.getElementById('btn-completar').addEventListener('click', completarPaso0)
})

// ──────────────────────────────────────────────
// RENDER TESIS
// ──────────────────────────────────────────────
function renderTesis() {
  const container = document.getElementById('tesis-container')
  container.innerHTML = ''

  TESIS_PASO_0.forEach(tesis => {
    const saved = respuestasMap[tesis.numero] || {}
    const card = document.createElement('div')
    card.className = `tesis-card${saved.tipo ? ' has-answer' : ''}`
    card.id = `tesis-card-${tesis.numero}`

    card.innerHTML = `
      <div class="tesis-num">Tesis ${tesis.numero} · ${tesis.angulo}</div>
      <div class="tesis-titulo">${tesis.titulo}</div>
      <div class="tesis-detonante">${tesis.detonante}</div>

      <div class="tesis-notas-label">Notas del consultor</div>
      <textarea class="tesis-notas" id="notas-${tesis.numero}" placeholder="Escribe aquí tus notas de la conversación…" rows="2">${saved.notas || ''}</textarea>

      <div class="tesis-opciones" id="opciones-${tesis.numero}">
        ${tesis.respuestas.map(r => `
          <label class="opcion-label${saved.tipo === r.tipo ? ' selected' : ''}" data-num="${tesis.numero}" data-tipo="${r.tipo}">
            <input type="radio" name="tesis-${tesis.numero}" value="${r.tipo}" ${saved.tipo === r.tipo ? 'checked' : ''}>
            <div class="opcion-tipo">${r.tipo}</div>
            <div class="opcion-desc">${r.descripcion}</div>
          </label>
        `).join('')}
      </div>
    `
    container.appendChild(card)
  })

  // Eventos: radio
  container.querySelectorAll('.opcion-label').forEach(label => {
    label.addEventListener('click', () => {
      const num = parseInt(label.dataset.num)
      const tipo = label.dataset.tipo
      seleccionarRespuesta(num, tipo)
    })
  })

  // Eventos: notas (debounce 900ms)
  container.querySelectorAll('.tesis-notas').forEach(textarea => {
    const num = parseInt(textarea.id.replace('notas-', ''))
    textarea.addEventListener('input', () => {
      clearTimeout(saveTimers[`notas-${num}`])
      saveTimers[`notas-${num}`] = setTimeout(() => guardarNotas(num, textarea.value), 900)
    })
  })

  // Render dots
  const dotsContainer = document.getElementById('tesis-dots')
  dotsContainer.innerHTML = ''
  TESIS_PASO_0.forEach(t => {
    const dot = document.createElement('div')
    dot.className = `tesis-dot${respuestasMap[t.numero]?.tipo ? ' done' : ''}`
    dot.id = `dot-${t.numero}`
    dotsContainer.appendChild(dot)
  })

  lucide.createIcons()
}

// ──────────────────────────────────────────────
// SELECCIONAR RESPUESTA
// ──────────────────────────────────────────────
function seleccionarRespuesta(num, tipo) {
  // Actualizar estado local
  if (!respuestasMap[num]) respuestasMap[num] = { tipo: '', notas: '' }
  respuestasMap[num].tipo = tipo

  // UI: seleccionar visualmente
  document.querySelectorAll(`#opciones-${num} .opcion-label`).forEach(l => {
    l.classList.toggle('selected', l.dataset.tipo === tipo)
  })
  document.getElementById(`tesis-card-${num}`)?.classList.add('has-answer')
  document.getElementById(`dot-${num}`)?.classList.add('done')

  actualizarPanel()
  guardarRespuesta(num, tipo)
}

// ──────────────────────────────────────────────
// GUARDAR EN SUPABASE
// ──────────────────────────────────────────────
async function guardarRespuesta(num, tipo) {
  setSaveIndicator('saving')
  const notas = respuestasMap[num]?.notas || ''
  const puntaje = PUNTAJE_RESPUESTA[tipo]

  const { error } = await supabase
    .from('adn_respuestas_p0')
    .upsert(
      { sesion_id: sesionId, tesis_numero: num, respuesta_tipo: tipo, puntaje, notas_consultor: notas },
      { onConflict: 'sesion_id,tesis_numero' }
    )

  if (error) { console.error('❌ guardar respuesta p0:', error.message); setSaveIndicator('error'); return }
  setSaveIndicator('saved')
}

async function guardarNotas(num, notas) {
  if (!respuestasMap[num]) respuestasMap[num] = { tipo: '', notas: '' }
  respuestasMap[num].notas = notas

  setSaveIndicator('saving')
  const tipo = respuestasMap[num].tipo
  if (!tipo) { setSaveIndicator('idle'); return } // Solo guardar si ya tiene tipo

  const puntaje = PUNTAJE_RESPUESTA[tipo]
  const { error } = await supabase
    .from('adn_respuestas_p0')
    .upsert(
      { sesion_id: sesionId, tesis_numero: num, respuesta_tipo: tipo, puntaje, notas_consultor: notas },
      { onConflict: 'sesion_id,tesis_numero' }
    )

  if (error) { console.error('❌ guardar notas p0:', error.message); setSaveIndicator('error'); return }
  setSaveIndicator('saved')
}

// ──────────────────────────────────────────────
// ACTUALIZAR PANEL LATERAL
// ──────────────────────────────────────────────
function actualizarPanel() {
  const respondidas = Object.values(respuestasMap).filter(r => r.tipo).length
  const total = TESIS_PASO_0.length

  // Progress bar
  document.getElementById('prog-fill').style.width = `${(respondidas / total) * 100}%`
  document.getElementById('prog-label').textContent = `${respondidas} / ${total}`

  // Puntaje
  const puntaje = Object.values(respuestasMap)
    .reduce((sum, r) => sum + (r.tipo ? (PUNTAJE_RESPUESTA[r.tipo] || 0) : 0), 0)

  document.getElementById('score-num').textContent = puntaje

  // Arc SVG — circunferencia 251.2 para r=40
  const pct = puntaje / 80
  const offset = 251.2 * (1 - pct)
  document.getElementById('score-arc').setAttribute('stroke-dashoffset', offset)

  // Tipo de pirámide
  const rango = RANGOS_PIRAMIDE.find(r => puntaje >= r.min && puntaje <= r.max)
  if (rango && respondidas > 0) {
    const pir = PIRAMIDES[rango.codigo]
    document.getElementById('score-tipo').textContent = pir.nombre
    document.getElementById('score-rango').textContent = pir.rango + ' puntos'
    document.getElementById('score-arc').setAttribute('stroke', pir.color)
  } else {
    document.getElementById('score-tipo').textContent = respondidas === 0 ? '—' : 'Calculando…'
    document.getElementById('score-rango').textContent = 'Responde las tesis para calcular'
  }

  // Botón completar — solo si las 20 están respondidas y no completado aún
  const btnWrap = document.getElementById('btn-completar-wrap')
  if (respondidas === total) {
    btnWrap.style.display = 'block'
  }
}

// ──────────────────────────────────────────────
// COMPLETAR PASO 0
// ──────────────────────────────────────────────
async function completarPaso0() {
  const btn = document.getElementById('btn-completar')
  btn.disabled = true
  btn.innerHTML = '<i data-lucide="loader"></i> Calculando…'
  lucide.createIcons()

  const { data, error } = await supabase.rpc('adn_completar_paso_0', { p_sesion_id: sesionId })
  if (error) {
    console.error('❌ adn_completar_paso_0:', error.message)
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="check-circle"></i> Reintentar'
    lucide.createIcons()
    return
  }

  // Leer tipo_piramide actualizado
  const { data: sesion } = await supabase
    .from('adn_sesiones')
    .select('tipo_piramide, puntaje_piramide')
    .eq('id', sesionId)
    .maybeSingle()

  // Generar agendas
  if (sesion?.tipo_piramide) {
    await generarAgendas(sesion.tipo_piramide)
    mostrarResultado(sesion.tipo_piramide, sesion.puntaje_piramide)
  }

  document.getElementById('btn-completar-wrap').style.display = 'none'
  setSaveIndicator('saved')
}

// ──────────────────────────────────────────────
// MOSTRAR RESULTADO
// ──────────────────────────────────────────────
function mostrarResultado(tipoCodigo, puntaje) {
  const pir = PIRAMIDES[tipoCodigo]
  if (!pir) return

  const wrap = document.getElementById('resultado-wrap')
  wrap.style.display = 'block'

  document.getElementById('resultado-card').innerHTML = `
    <div class="resultado-tipo-badge" style="background:${pir.color}22;color:${pir.color}">
      <i data-lucide="${pir.icono}"></i> ${puntaje || ''} puntos · ${pir.rango}
    </div>
    <div class="resultado-nombre">${pir.nombre}</div>
    <div class="resultado-desc">${pir.descripcion_larga}</div>
    <ul class="resultado-indicators">
      ${pir.indicadores.map(i => `<li>${i}</li>`).join('')}
    </ul>
    <div class="resultado-siguiente">${pir.proximo_paso}</div>
  `

  // Agenda
  const agendas = AGENDAS_PASO_0[tipoCodigo]
  if (agendas) {
    document.getElementById('agenda-wrap').style.display = 'block'
    document.getElementById('agenda-content').innerHTML = `
      <div class="agenda-item">
        <div class="agenda-dia">7 días</div>
        <div class="agenda-texto">${agendas['7_dias']}</div>
      </div>
      <div class="agenda-item">
        <div class="agenda-dia">30 días</div>
        <div class="agenda-texto">${agendas['30_dias']}</div>
      </div>
      <div class="agenda-item">
        <div class="agenda-dia">90 días</div>
        <div class="agenda-texto">${agendas['90_dias']}</div>
      </div>
    `
  }

  document.getElementById('btn-completar-wrap').style.display = 'none'
  lucide.createIcons()
}

// ──────────────────────────────────────────────
// GENERAR AGENDAS EN BD
// ──────────────────────────────────────────────
async function generarAgendas(tipoCodigo) {
  const agendas = AGENDAS_PASO_0[tipoCodigo]
  if (!agendas) return

  const filas = [
    { sesion_id: sesionId, paso: 0, horizonte: '7_dias', texto: agendas['7_dias'] },
    { sesion_id: sesionId, paso: 0, horizonte: '30_dias', texto: agendas['30_dias'] },
    { sesion_id: sesionId, paso: 0, horizonte: '90_dias', texto: agendas['90_dias'] }
  ]

  const { error } = await supabase
    .from('adn_agendas')
    .upsert(filas, { onConflict: 'sesion_id,paso,horizonte' })

  if (error) console.error('❌ adn_agendas insert:', error.message)
}

// ──────────────────────────────────────────────
// SAVE INDICATOR
// ──────────────────────────────────────────────
function setSaveIndicator(estado) {
  const el = document.getElementById('save-indicator')
  const txt = document.getElementById('save-text')
  el.className = 'save-indicator ' + estado
  const labels = { saving: 'Guardando…', saved: 'Guardado ✓', error: 'Error al guardar', idle: '—' }
  txt.textContent = labels[estado] || '—'
  if (estado === 'saved') setTimeout(() => setSaveIndicator('idle'), 2500)
}
