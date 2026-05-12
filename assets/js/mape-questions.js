// ============================================================================
// SCALEx PORTAL - MAPE Indicadores (Cuestionario v1)
// ============================================================================
// 12 indicadores en 2 ejes, formato MIXTO:
//   - likert: escala 1-5 (afirmaciones cualitativas)
//   - numerico: numero crudo (rentabilidad %, deuda %, etc) con rangos
//   - selector: opcion entre 4 (estados cualitativos discretos)
//
// Cada indicador define como normaliza su valor crudo a un score 0-100
// que luego se promedia para dar el puntaje del eje.
//
// Origen: manuscrito SCALEx Latam, pilar Reflejo, herramienta MAPE
// ============================================================================

export const MAPE_VERSION = 'v1'

export const MAPE_ESCALA_LIKERT = [
  { valor: 1, label: 'Nada de acuerdo' },
  { valor: 2, label: 'Poco de acuerdo' },
  { valor: 3, label: 'Neutral' },
  { valor: 4, label: 'De acuerdo' },
  { valor: 5, label: 'Muy de acuerdo' }
]

export const MAPE_EJES = [
  {
    codigo: 'financiero',
    numero: 1,
    titulo: 'Crecimiento financiero',
    pregunta: 'Tu empresa genera dinero de forma sostenible?',
    descripcion: 'Rentabilidad real, flujo de efectivo y dependencia de deuda',
    icono: 'trending-up'
  },
  {
    codigo: 'operativo',
    numero: 2,
    titulo: 'Capacidad operativa',
    pregunta: 'Tu estructura aguanta el siguiente nivel de crecimiento?',
    descripcion: 'Procesos, delegacion y autonomia del equipo',
    icono: 'settings'
  }
]

// ─────────────────────────────────────────────────────────────────────
// LOS 12 INDICADORES
// ─────────────────────────────────────────────────────────────────────

export const MAPE_INDICADORES = [
  // ═══════════════════════════════════════════════════════
  // EJE 1 - CRECIMIENTO FINANCIERO (6 indicadores)
  // ═══════════════════════════════════════════════════════

  {
    codigo: 'financiero_1',
    eje: 'financiero',
    orden: 1,
    tipo: 'numerico',
    texto: 'Cual fue tu rentabilidad neta promedio en los ultimos 12 meses?',
    suffix: '% sobre ingresos',
    hint: 'Referencia: Negocios sanos en LATAM rondan 15-25% segun industria. Si no la conoces con precision, estima.',
    placeholder: '0',
    min: -50,
    max: 100,
    // Normalizacion: <0 = 0pts | 0-10 = 30pts | 10-20 = 70pts | 20+ = 100pts
    normalizar: (v) => {
      const n = parseFloat(v)
      if (isNaN(n)) return 0
      if (n < 0) return 0
      if (n < 5) return 15
      if (n < 10) return 35
      if (n < 15) return 55
      if (n < 20) return 75
      if (n < 30) return 90
      return 100
    }
  },

  {
    codigo: 'financiero_2',
    eje: 'financiero',
    orden: 2,
    tipo: 'selector',
    texto: 'Como esta tu flujo de efectivo actualmente?',
    opciones: [
      { codigo: 'negativo', label: 'Negativo', score: 0 },
      { codigo: 'al_filo', label: 'Justo / al filo', score: 30 },
      { codigo: 'positivo_estable', label: 'Positivo estable', score: 70 },
      { codigo: 'holgado', label: 'Holgado con reserva', score: 100 }
    ]
  },

  {
    codigo: 'financiero_3',
    eje: 'financiero',
    orden: 3,
    tipo: 'numerico',
    texto: 'Que porcentaje representa tu deuda externa sobre tus ingresos anuales?',
    suffix: '% deuda / ingresos',
    hint: 'Sano: menos del 30%. Alerta: 30-50%. Critico: mas del 50%.',
    placeholder: '0',
    min: 0,
    max: 200,
    // Inverso: menos deuda = mejor score
    normalizar: (v) => {
      const n = parseFloat(v)
      if (isNaN(n)) return 50
      if (n <= 10) return 100
      if (n <= 20) return 85
      if (n <= 30) return 70
      if (n <= 50) return 40
      if (n <= 80) return 15
      return 0
    }
  },

  {
    codigo: 'financiero_4',
    eje: 'financiero',
    orden: 4,
    tipo: 'likert',
    texto: '"Si dejaramos de vender un mes completo, mi empresa podria operar sin colapsar financieramente."',
    // Likert 1-5 -> 0,25,50,75,100
    normalizar: (v) => {
      const n = parseInt(v)
      return Math.max(0, Math.min(100, (n - 1) * 25))
    }
  },

  {
    codigo: 'financiero_5',
    eje: 'financiero',
    orden: 5,
    tipo: 'selector',
    texto: 'Como ha evolucionado tu facturacion en los ultimos 12 meses?',
    opciones: [
      { codigo: 'cae', label: 'Esta cayendo', score: 0 },
      { codigo: 'estable', label: 'Estable o casi sin cambio', score: 35 },
      { codigo: 'crece_lento', label: 'Crece lento (menos del 15% anual)', score: 65 },
      { codigo: 'crece_fuerte', label: 'Crece fuerte (mas del 15% anual)', score: 100 }
    ]
  },

  {
    codigo: 'financiero_6',
    eje: 'financiero',
    orden: 6,
    tipo: 'likert',
    texto: '"Conozco con precision el costo real de cada producto o servicio que vendo."',
    normalizar: (v) => {
      const n = parseInt(v)
      return Math.max(0, Math.min(100, (n - 1) * 25))
    }
  },

  // ═══════════════════════════════════════════════════════
  // EJE 2 - CAPACIDAD OPERATIVA (6 indicadores)
  // ═══════════════════════════════════════════════════════

  {
    codigo: 'operativo_1',
    eje: 'operativo',
    orden: 1,
    tipo: 'selector',
    texto: 'Que tan documentados estan tus procesos clave?',
    opciones: [
      { codigo: 'ninguno', label: 'Ninguno documentado', score: 0 },
      { codigo: 'algunos', label: 'Algunos, sin sistema', score: 30 },
      { codigo: 'mayoria', label: 'La mayoria, con manuales', score: 70 },
      { codigo: 'todos', label: 'Todos, vivos y actualizados', score: 100 }
    ]
  },

  {
    codigo: 'operativo_2',
    eje: 'operativo',
    orden: 2,
    tipo: 'likert',
    texto: '"Mi equipo toma decisiones operativas sin necesidad de consultarme."',
    normalizar: (v) => {
      const n = parseInt(v)
      return Math.max(0, Math.min(100, (n - 1) * 25))
    }
  },

  {
    codigo: 'operativo_3',
    eje: 'operativo',
    orden: 3,
    tipo: 'likert',
    texto: '"Si me ausento un mes completo, la empresa sigue operando con normalidad."',
    normalizar: (v) => {
      const n = parseInt(v)
      return Math.max(0, Math.min(100, (n - 1) * 25))
    }
  },

  {
    codigo: 'operativo_4',
    eje: 'operativo',
    orden: 4,
    tipo: 'selector',
    texto: 'Cuando entra un cliente nuevo, que tan estandarizado es el proceso de atencion?',
    opciones: [
      { codigo: 'cada_vez', label: 'Cada vez es diferente', score: 0 },
      { codigo: 'pasos_basicos', label: 'Tenemos pasos basicos en mente', score: 35 },
      { codigo: 'flujo_definido', label: 'Tenemos un flujo definido y documentado', score: 75 },
      { codigo: 'sistemico', label: 'Es sistemico y medible con KPIs', score: 100 }
    ]
  },

  {
    codigo: 'operativo_5',
    eje: 'operativo',
    orden: 5,
    tipo: 'likert',
    texto: '"Tenemos indicadores (KPIs) que revisamos periodicamente para medir la operacion."',
    normalizar: (v) => {
      const n = parseInt(v)
      return Math.max(0, Math.min(100, (n - 1) * 25))
    }
  },

  {
    codigo: 'operativo_6',
    eje: 'operativo',
    orden: 6,
    tipo: 'selector',
    texto: 'Si tu equipo tiene que crecer un 30%, que tan facil seria absorberlo?',
    opciones: [
      { codigo: 'imposible', label: 'Imposible sin caos', score: 0 },
      { codigo: 'dificil', label: 'Dificil, requeriria reorganizacion fuerte', score: 30 },
      { codigo: 'manejable', label: 'Manejable con ajustes', score: 70 },
      { codigo: 'sencillo', label: 'Sencillo, la estructura esta lista', score: 100 }
    ]
  }
]

// ─────────────────────────────────────────────────────────────────────
// LOS 4 CUADRANTES
// ─────────────────────────────────────────────────────────────────────
export const MAPE_CUADRANTES = {
  crecimiento_escalable: {
    codigo: 'crecimiento_escalable',
    nombre: 'Crecimiento Escalable',
    color: 'green',
    badge: 'SALUDABLE',
    descripcion_corta: 'Listo para escalar con control',
    descripcion_larga: 'Tu empresa esta financieramente saludable y con estructura lista para crecimiento sin caos. No depende de una sola persona. Es el cuadrante objetivo.',
    riesgo_principal: null,
    acciones: [
      'Optimiza sistemas y automatiza para seguir escalando sin friccion.',
      'Expande sin miedo, manteniendo control sobre la operacion y finanzas.',
      'Empieza a pensar en nuevos mercados, productos o canales de venta.'
    ]
  },
  crecimiento_fragil: {
    codigo: 'crecimiento_fragil',
    nombre: 'Crecimiento Fragil',
    color: 'amber',
    badge: 'ATENCION',
    descripcion_corta: 'Crece, pero sin estructura',
    descripcion_larga: 'Tu empresa esta creciendo, pero el equipo y los procesos no estan preparados. Se siente la sobrecarga y el caos interno. El dueno sigue involucrado en demasiadas decisiones.',
    riesgo_principal: 'Puede colapsar por desorden interno. La rentabilidad va a empezar a caer si no estructuras.',
    acciones: [
      'Estructura procesos claros y delega funciones clave.',
      'Implementa sistemas de control financiero y operativo antes de seguir creciendo.',
      'Identifica al menos un area completa que pueda funcionar sin tu intervencion diaria.'
    ]
  },
  financiero_estancado: {
    codigo: 'financiero_estancado',
    nombre: 'Crecimiento Financiero Estancado',
    color: 'amber',
    badge: 'ATENCION',
    descripcion_corta: 'Bien gestionada, pero no crece',
    descripcion_larga: 'Tienen procesos solidos y estructura clara, pero el mercado no responde como deberia. No estan escalando, solo sobreviviendo con estabilidad.',
    riesgo_principal: 'La empresa puede volverse irrelevante con el tiempo. Sin crecimiento financiero, no hay sostenibilidad a largo plazo.',
    acciones: [
      'Revisa el modelo de negocio y su rentabilidad real.',
      'Busca nuevas oportunidades de mercado o diversificacion.',
      'Cuestiona si tu propuesta de valor sigue siendo relevante.'
    ]
  },
  zona_estancamiento: {
    codigo: 'zona_estancamiento',
    nombre: 'Zona de Estancamiento',
    color: 'red',
    badge: 'URGENTE',
    descripcion_corta: 'Atrapado: ni crece, ni esta listo',
    descripcion_larga: 'Tu empresa esta atrapada. No crece y tampoco esta lista para hacerlo. El dueno toma casi todas las decisiones, no hay procesos definidos y las finanzas estan en modo supervivencia.',
    riesgo_principal: 'Puede caer en crisis o desaparecer en los proximos anos. La falta de accion estructurada impide cualquier posibilidad real de escalabilidad.',
    acciones: [
      'Reestructura la vision del negocio y del dueno - urgente.',
      'Implementa cambios profundos en estrategia, liderazgo y control financiero.',
      'Empieza por una decision clave: delegar al menos una funcion completa esta semana.'
    ]
  }
}

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

// Devuelve el cuadrante segun los puntajes de ambos ejes (umbral 50)
export function getCuadrante(puntajeFinanciero, puntajeOperativo) {
  const fin = puntajeFinanciero >= 50
  const op = puntajeOperativo >= 50

  if (fin && op) return MAPE_CUADRANTES.crecimiento_escalable
  if (fin && !op) return MAPE_CUADRANTES.crecimiento_fragil
  if (!fin && op) return MAPE_CUADRANTES.financiero_estancado
  return MAPE_CUADRANTES.zona_estancamiento
}

// Devuelve indicadores de un eje
export function getIndicadoresByEje(ejeCodigo) {
  return MAPE_INDICADORES.filter(i => i.eje === ejeCodigo)
}

// Devuelve indicador por codigo
export function getIndicadorByCodigo(codigo) {
  return MAPE_INDICADORES.find(i => i.codigo === codigo)
}

// Devuelve eje por codigo
export function getEjeByCodigo(codigo) {
  return MAPE_EJES.find(e => e.codigo === codigo)
}

// Normaliza una respuesta a score 0-100 segun su tipo
export function normalizarRespuesta(indicador, rawValue) {
  if (!indicador) return 0

  if (indicador.tipo === 'likert' || indicador.tipo === 'numerico') {
    // Ambos tipos tienen su propia funcion normalizar
    return indicador.normalizar(rawValue)
  }

  if (indicador.tipo === 'selector') {
    const opcion = indicador.opciones.find(o => o.codigo === rawValue)
    return opcion ? opcion.score : 0
  }

  return 0
}

// Posicion del punto en la matriz para visualizacion (0-100 -> coords CSS %)
// La matriz visual tiene Y invertido (top=alto, bottom=bajo) y X invertido
// (izquierda=alta operativa, derecha=baja operativa)
export function getPosicionMatriz(puntajeFinanciero, puntajeOperativo) {
  // Y: alto valor financiero -> top bajo (5-95%)
  const topPct = 95 - (puntajeFinanciero * 0.9)
  // X: alto valor operativo -> left bajo (5-95%)
  const leftPct = 95 - (puntajeOperativo * 0.9)
  return {
    top: Math.max(5, Math.min(95, topPct)),
    left: Math.max(5, Math.min(95, leftPct))
  }
}
