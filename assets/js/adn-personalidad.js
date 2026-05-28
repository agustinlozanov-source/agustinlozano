// adn-personalidad.js — SCALEx Portal · ADN Paso 1 · Perfil de Personalidad Empresarial

import { supabase, getMyProfile, getMyOrganization } from '/assets/js/supabase-client.js'
import { PREGUNTAS_PASO_1, RASGOS, DIMENSIONES } from '/assets/js/adn-paso1-catalogo.js'
import { HIBRIDOS, obtenerHibrido } from '/assets/js/adn-hibridos-catalogo.js'
import { renderAgendas } from '/assets/js/adn-agendas.js'

let sesionId = null
let respuestasMap = {}   // { pregunta_numero: { tipo, notas, pesos } }
let saveTimers = {}

// Colores por rasgo
const RASGO_COLORES = {
  templo:      '#a855f7',
  familia:     '#ec4899',
  estudio:     '#3533cd',
  fabrica:     '#1aab99',
  comercio:    '#ff9500',
  taller:      '#d4a256',
  laboratorio: '#00c853'
}

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

  // Verificar que paso 0 esté completado
  const { data: sesion } = await supabase
    .from('adn_sesiones')
    .select('paso_0_estado, paso_1_estado, paso_1_nombre_hibrido')
    .eq('id', sesionId)
    .maybeSingle()

  if (sesion?.paso_0_estado !== 'completado') {
    // Redirigir al hub con mensaje
    window.location.href = '/portal/adn.html'
    return
  }

  // Cargar respuestas existentes
  const { data: respExist } = await supabase
    .from('adn_paso1_respuestas')
    .select('pregunta_numero, respuesta_tipo, pesos_rasgos, notas_consultor')
    .eq('sesion_id', sesionId)

  if (respExist) {
    respExist.forEach(r => {
      respuestasMap[r.pregunta_numero] = {
        tipo: r.respuesta_tipo,
        notas: r.notas_consultor || '',
        pesos: r.pesos_rasgos || {}
      }
    })
  }

  renderPreguntas()
  actualizarPanel()

  // Si ya estaba completado, mostrar resultado
  if (sesion?.paso_1_estado === 'completado' && sesion.paso_1_nombre_hibrido) {
    const mix = calcularMix()
    const resultado = obtenerHibrido(mix)
    if (resultado.hibrido) {
      mostrarResultado(resultado)
    }
  }

  document.getElementById('btn-completar').addEventListener('click', completarPaso1)
})

// ──────────────────────────────────────────────
// RENDER PREGUNTAS
// ──────────────────────────────────────────────
function renderPreguntas() {
  const container = document.getElementById('preguntas-container')
  container.innerHTML = ''

  let ultimaDim = null

  PREGUNTAS_PASO_1.forEach(pregunta => {
    // Separador de dimensión
    if (pregunta.dimension !== ultimaDim) {
      ultimaDim = pregunta.dimension
      const dimDiv = document.createElement('div')
      dimDiv.className = 'dim-label'
      dimDiv.textContent = DIMENSIONES[pregunta.dimension] || pregunta.dimension
      container.appendChild(dimDiv)
    }

    const saved = respuestasMap[pregunta.numero] || {}
    const card = document.createElement('div')
    card.className = `pregunta-card${saved.tipo ? ' has-answer' : ''}`
    card.id = `pregunta-card-${pregunta.numero}`

    card.innerHTML = `
      <div class="pregunta-num">Pregunta ${pregunta.numero}</div>
      <div class="pregunta-titulo">${pregunta.titulo}</div>
      <div class="pregunta-detonante">${pregunta.detonante}</div>

      <div class="notas-label">Notas del consultor</div>
      <textarea class="notas-input" id="notas-${pregunta.numero}" placeholder="Anota lo relevante de la respuesta…" rows="2">${saved.notas || ''}</textarea>

      <div class="opciones" id="opciones-${pregunta.numero}">
        ${pregunta.respuestas.map(r => `
          <label class="opcion-label${saved.tipo === r.tipo ? ' selected' : ''}" data-num="${pregunta.numero}" data-tipo="${r.tipo}" data-pesos='${JSON.stringify(r.pesos)}'>
            <input type="radio" name="pregunta-${pregunta.numero}" value="${r.tipo}" ${saved.tipo === r.tipo ? 'checked' : ''}>
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
      let pesos = {}
      try { pesos = JSON.parse(label.dataset.pesos) } catch(e) {}
      seleccionarRespuesta(num, tipo, pesos, label.closest('.pregunta-card').querySelector(`input[value="${tipo}"]`)?.closest('.opciones'))
    })
  })

  // Eventos: notas
  container.querySelectorAll('.notas-input').forEach(textarea => {
    const num = parseInt(textarea.id.replace('notas-', ''))
    textarea.addEventListener('input', () => {
      clearTimeout(saveTimers[`notas-${num}`])
      saveTimers[`notas-${num}`] = setTimeout(() => guardarNotas(num, textarea.value), 900)
    })
  })

  // Render dots
  const dotsContainer = document.getElementById('preguntas-dots')
  dotsContainer.innerHTML = ''
  PREGUNTAS_PASO_1.forEach(p => {
    const dot = document.createElement('div')
    dot.className = `pregunta-dot${respuestasMap[p.numero]?.tipo ? ' done' : ''}`
    dot.id = `dot-${p.numero}`
    dotsContainer.appendChild(dot)
  })

  lucide.createIcons()
}

// ──────────────────────────────────────────────
// SELECCIONAR RESPUESTA
// ──────────────────────────────────────────────
function seleccionarRespuesta(num, tipo, pesos, opcionesContainer) {
  if (!respuestasMap[num]) respuestasMap[num] = { tipo: '', notas: '', pesos: {} }
  respuestasMap[num].tipo = tipo
  respuestasMap[num].pesos = pesos

  // UI
  document.querySelectorAll(`#opciones-${num} .opcion-label`).forEach(l => {
    l.classList.toggle('selected', l.dataset.tipo === tipo)
  })
  document.getElementById(`pregunta-card-${num}`)?.classList.add('has-answer')
  document.getElementById(`dot-${num}`)?.classList.add('done')

  actualizarPanel()
  guardarRespuesta(num, tipo, pesos)
}

// ──────────────────────────────────────────────
// CALCULAR MIX DE RASGOS
// ──────────────────────────────────────────────
function calcularMix() {
  // Sumar todos los pesos de las respuestas dadas
  const totales = {}
  RASGOS.forEach(r => totales[r] = 0)

  Object.values(respuestasMap).forEach(resp => {
    if (!resp.tipo || !resp.pesos) return
    Object.entries(resp.pesos).forEach(([rasgo, peso]) => {
      if (totales[rasgo] !== undefined) totales[rasgo] += peso
    })
  })

  const suma = Object.values(totales).reduce((a, b) => a + b, 0)
  if (suma === 0) return RASGOS.reduce((obj, r) => { obj[r] = 0; return obj }, {})

  // Convertir a porcentajes
  const mix = {}
  RASGOS.forEach(r => {
    mix[r] = Math.round((totales[r] / suma) * 100)
  })
  return mix
}

// ──────────────────────────────────────────────
// ACTUALIZAR PANEL DERECHO
// ──────────────────────────────────────────────
function actualizarPanel() {
  const total = PREGUNTAS_PASO_1.length
  const respondidas = Object.values(respuestasMap).filter(r => r.tipo).length

  // Progress ring
  const CIRCUM = 226.2
  const pct = respondidas / total
  const offset = CIRCUM - pct * CIRCUM
  const arc = document.getElementById('ring-arc')
  if (arc) {
    arc.style.strokeDashoffset = offset
    arc.style.transition = 'stroke-dashoffset .5s ease'
  }
  const ringNum = document.getElementById('ring-num')
  if (ringNum) ringNum.textContent = respondidas

  const ringLabel = document.getElementById('ring-label')
  if (ringLabel) {
    if (respondidas === 0) ringLabel.textContent = 'Responde para calcular'
    else if (respondidas < 10) ringLabel.textContent = 'Sigue adelante…'
    else if (respondidas < 20) ringLabel.textContent = 'Buen avance'
    else if (respondidas < 28) ringLabel.textContent = `${total - respondidas} preguntas restantes`
    else ringLabel.textContent = '¡Listo para completar!'
  }

  // Barra de progreso izquierda
  const fill = document.getElementById('prog-fill')
  if (fill) fill.style.width = (pct * 100) + '%'
  const lbl = document.getElementById('prog-label')
  if (lbl) lbl.textContent = `${respondidas} / ${total}`

  // Rasgo bars
  const mix = calcularMix()
  renderRasgoBars(mix, respondidas)

  // Híbrido preview
  if (respondidas >= 5) {
    const resultado = obtenerHibrido(mix)
    const preview = document.getElementById('hibrido-preview')
    const nombreEl = document.getElementById('hibrido-nombre')
    const rasgosEl = document.getElementById('hibrido-rasgos')

    if (resultado.hibrido && preview && nombreEl && rasgosEl) {
      preview.classList.add('visible')
      nombreEl.textContent = resultado.hibrido.nombre
      const top2 = resultado.rasgos_dominantes
      rasgosEl.textContent = `${capitalize(top2[0])} + ${capitalize(top2[1])}`
    }
  }

  // Botón completar
  const btnWrap = document.getElementById('btn-completar-wrap')
  if (btnWrap) {
    btnWrap.style.display = respondidas === total ? 'block' : 'none'
  }
}

function renderRasgoBars(mix, respondidas) {
  const container = document.getElementById('rasgo-bars')
  if (!container) return

  if (respondidas === 0) {
    container.innerHTML = '<div style="font-size:12px;color:var(--text-4);text-align:center;padding:8px 0">Responde preguntas para ver el mix</div>'
    return
  }

  // Ordenar rasgos de mayor a menor
  const ordenados = RASGOS.slice().sort((a, b) => (mix[b] || 0) - (mix[a] || 0))

  container.innerHTML = ordenados.map(rasgo => {
    const pct = mix[rasgo] || 0
    const color = RASGO_COLORES[rasgo] || '#ec4899'
    return `
      <div class="rasgo-item">
        <div class="rasgo-header">
          <span class="rasgo-nombre">${NOMBRES_RASGO[rasgo] || rasgo}</span>
          <span class="rasgo-pct" style="color:${color}">${pct}%</span>
        </div>
        <div class="rasgo-track">
          <div class="rasgo-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>
    `
  }).join('')
}

const NOMBRES_RASGO = {
  templo:      'El Templo',
  familia:     'La Familia',
  estudio:     'El Estudio',
  fabrica:     'La Fábrica',
  comercio:    'El Comercio',
  taller:      'El Taller',
  laboratorio: 'El Laboratorio'
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

// ──────────────────────────────────────────────
// GUARDAR EN SUPABASE
// ──────────────────────────────────────────────
async function guardarRespuesta(num, tipo, pesos) {
  setSaveIndicator('saving')
  const pregunta = PREGUNTAS_PASO_1.find(p => p.numero === num)
  const notas = respuestasMap[num]?.notas || ''

  const { error } = await supabase
    .from('adn_paso1_respuestas')
    .upsert(
      {
        sesion_id: sesionId,
        pregunta_numero: num,
        dimension: pregunta?.dimension || '',
        respuesta_tipo: tipo,
        pesos_rasgos: pesos,
        notas_consultor: notas
      },
      { onConflict: 'sesion_id,pregunta_numero' }
    )

  if (error) {
    console.error('❌ adn_paso1_respuestas upsert:', error.message)
    setSaveIndicator('error')
  } else {
    setSaveIndicator('saved')
  }
}

async function guardarNotas(num, notas) {
  if (!respuestasMap[num]?.tipo) return  // No guardar notas sin respuesta tipo
  if (!respuestasMap[num]) respuestasMap[num] = { tipo: '', notas: '', pesos: {} }
  respuestasMap[num].notas = notas
  setSaveIndicator('saving')

  const pregunta = PREGUNTAS_PASO_1.find(p => p.numero === num)
  const { error } = await supabase
    .from('adn_paso1_respuestas')
    .upsert(
      {
        sesion_id: sesionId,
        pregunta_numero: num,
        dimension: pregunta?.dimension || '',
        respuesta_tipo: respuestasMap[num].tipo,
        pesos_rasgos: respuestasMap[num].pesos || {},
        notas_consultor: notas
      },
      { onConflict: 'sesion_id,pregunta_numero' }
    )

  if (error) {
    console.error('❌ adn_paso1_respuestas notas:', error.message)
    setSaveIndicator('error')
  } else {
    setSaveIndicator('saved')
  }
}

// ──────────────────────────────────────────────
// COMPLETAR PASO 1
// ──────────────────────────────────────────────
async function completarPaso1() {
  const btn = document.getElementById('btn-completar')
  btn.disabled = true
  btn.innerHTML = '<i data-lucide="loader"></i> Calculando…'
  lucide.createIcons()

  // Calcular híbrido final
  const mix = calcularMix()
  const resultado = obtenerHibrido(mix)

  if (!resultado.hibrido) {
    console.error('❌ No se pudo determinar el híbrido')
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="check-circle"></i> Reintentar'
    lucide.createIcons()
    return
  }

  const nombreHibrido = resultado.hibrido.nombre
  const clave = resultado.clave

  // Llamar RPC
  const { error } = await supabase.rpc('adn_completar_paso_1', {
    p_sesion_id: sesionId,
    p_nombre_hibrido: nombreHibrido
  })

  if (error) {
    console.error('❌ adn_completar_paso_1:', error.message)
    btn.disabled = false
    btn.innerHTML = '<i data-lucide="check-circle"></i> Reintentar'
    lucide.createIcons()
    return
  }

  // Guardar agenda
  await generarAgendas(clave, resultado.hibrido)

  // Mostrar resultado completo
  mostrarResultado(resultado)
  document.getElementById('btn-completar-wrap').style.display = 'none'
  setSaveIndicator('saved')
}

// ──────────────────────────────────────────────
// MOSTRAR RESULTADO COMPLETO
// ──────────────────────────────────────────────
function mostrarResultado(resultado) {
  const hibrido = resultado.hibrido
  if (!hibrido) return

  const top2 = resultado.rasgos_dominantes || []

  const wrap = document.getElementById('resultado-wrap')
  if (!wrap) return
  wrap.style.display = 'block'

  document.getElementById('resultado-card').innerHTML = `
    <div class="resultado-badge">
      <i data-lucide="sparkles"></i>
      ${capitalize(top2[0] || '')} + ${capitalize(top2[1] || '')}
    </div>
    <div class="resultado-nombre">${hibrido.nombre}</div>
    <div class="resultado-esencia">${hibrido.esencia}</div>
    <div class="resultado-row">
      <div class="resultado-bloque">
        <div class="resultado-bloque-label">Fortaleza</div>
        <div class="resultado-bloque-text">${hibrido.fortaleza}</div>
      </div>
      <div class="resultado-bloque">
        <div class="resultado-bloque-label">Tensión natural</div>
        <div class="resultado-bloque-text">${hibrido.debilidad}</div>
      </div>
    </div>
    <div class="resultado-explorar">
      <strong>Rasgos a explorar:</strong>
      <ul>
        ${(hibrido.rasgos_a_explorar || []).map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
  `

  // Agenda interactiva desde BD
  const agendaWrap = document.getElementById('agenda-wrap')
  const agendaContent = document.getElementById('agenda-content')
  if (agendaWrap && agendaContent && sesionId) {
    agendaWrap.style.display = 'block'
    renderAgendas(sesionId, 'paso_1', agendaContent)
  }

  lucide.createIcons()
}

// ──────────────────────────────────────────────
// GENERAR AGENDAS EN BD
// ──────────────────────────────────────────────
async function generarAgendas(claveHibrido, hibrido) {
  if (!hibrido) return

  // Agenda genérica para paso 1 basada en los rasgos a explorar
  const contenido7 = `Comparte el resultado del Perfil de Personalidad (${hibrido.nombre}) con el equipo directivo. Reacción y resonancia.`
  const contenido30 = `Identifica 1-2 iniciativas concretas que activen los rasgos a explorar: ${(hibrido.rasgos_a_explorar || []).slice(0, 2).join(' / ')}`
  const contenido90 = `Revisión: ¿cómo ha evolucionado el perfil? ¿Qué rasgos se han fortalecido o debilitado? Conectar con el Mapa ADN del Paso 2.`

  const filas = [
    { sesion_id: sesionId, paso: 'paso_1', horizonte: '7_dias',  contenido: contenido7 },
    { sesion_id: sesionId, paso: 'paso_1', horizonte: '30_dias', contenido: contenido30 },
    { sesion_id: sesionId, paso: 'paso_1', horizonte: '90_dias', contenido: contenido90 }
  ]

  const { error } = await supabase
    .from('adn_agendas')
    .delete()
    .eq('sesion_id', sesionId)
    .eq('paso', 'paso_1')
  if (!error) await supabase.from('adn_agendas').insert(filas)
  else console.error('❌ adn_agendas delete:', error.message)
}

// ──────────────────────────────────────────────
// SAVE INDICATOR
// ──────────────────────────────────────────────
function setSaveIndicator(estado) {
  const el = document.getElementById('save-indicator')
  const txt = document.getElementById('save-text')
  if (!el || !txt) return
  el.className = 'save-indicator ' + estado
  const labels = { saving: 'Guardando…', saved: 'Guardado ✓', error: 'Error al guardar', idle: '—' }
  txt.textContent = labels[estado] || '—'
  if (estado === 'saved') setTimeout(() => setSaveIndicator('idle'), 2500)
}
