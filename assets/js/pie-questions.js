// ============================================================================
// SCALEx PORTAL - PIE Questions (Cuestionario v1)
// ============================================================================
// 20 preguntas en 4 secciones, escala Likert 1-5
// Origen: manuscrito SCALEx Latam, pilar Reflejo
//
// Estructura de cada pregunta:
//   - codigo: identificador unico (seccion_numero) que se guarda en BD
//   - seccion: una de las 4 dimensiones
//   - texto: la afirmacion que el lider evalua
//   - orden: posicion visual dentro de la seccion
//
// Esta es la version 1. Si en el futuro se modifican, se versiona
// (v2, v3...) y se actualiza el campo cuestionario_version al guardar.
// ============================================================================

export const PIE_VERSION = 'v1'

export const PIE_ESCALA = [
  { valor: 1, label: 'Nada de acuerdo' },
  { valor: 2, label: 'Poco de acuerdo' },
  { valor: 3, label: 'Neutral' },
  { valor: 4, label: 'De acuerdo' },
  { valor: 5, label: 'Muy de acuerdo' }
]

export const PIE_SECCIONES = [
  {
    codigo: 'mentalidad',
    numero: 1,
    titulo: 'Mentalidad empresarial',
    pregunta: 'Como piensas sobre tu rol como dueno y el crecimiento de tu empresa?',
    descripcion: 'Tu vision sobre el liderazgo y el crecimiento estructurado'
  },
  {
    codigo: 'decisiones',
    numero: 2,
    titulo: 'Toma de decisiones',
    pregunta: 'Tomas decisiones estrategicas o reaccionas sin estructura?',
    descripcion: 'Tu metodo y proceso para decidir'
  },
  {
    codigo: 'delegacion',
    numero: 3,
    titulo: 'Delegacion y liderazgo',
    pregunta: 'Sigues siendo el cuello de botella o ya aprendiste a delegar?',
    descripcion: 'Tu capacidad de ceder control sin perder direccion'
  },
  {
    codigo: 'vision',
    numero: 4,
    titulo: 'Vision y estrategia personal',
    pregunta: 'Tienes una vision clara para escalar o solo estas sobreviviendo?',
    descripcion: 'Tu claridad sobre el rumbo a mediano y largo plazo'
  }
]

export const PIE_PREGUNTAS = [
  // ─────────────────────────────────────────
  // SECCION 1 - MENTALIDAD EMPRESARIAL
  // ─────────────────────────────────────────
  {
    codigo: 'mentalidad_1',
    seccion: 'mentalidad',
    orden: 1,
    texto: 'Tengo claro que para escalar mi negocio, mi rol dentro de la empresa debe evolucionar.'
  },
  {
    codigo: 'mentalidad_2',
    seccion: 'mentalidad',
    orden: 2,
    texto: 'Estoy dispuesto a aprender y desaprender para hacer crecer mi empresa.'
  },
  {
    codigo: 'mentalidad_3',
    seccion: 'mentalidad',
    orden: 3,
    texto: 'Tomo decisiones estrategicas basadas en datos y no solo en intuicion.'
  },
  {
    codigo: 'mentalidad_4',
    seccion: 'mentalidad',
    orden: 4,
    texto: 'Mi prioridad es el crecimiento estructurado de mi empresa, no solo la facturacion mensual.'
  },
  {
    codigo: 'mentalidad_5',
    seccion: 'mentalidad',
    orden: 5,
    texto: 'Entiendo que un negocio que depende totalmente de mi tiene un techo claro.'
  },

  // ─────────────────────────────────────────
  // SECCION 2 - TOMA DE DECISIONES
  // ─────────────────────────────────────────
  {
    codigo: 'decisiones_1',
    seccion: 'decisiones',
    orden: 1,
    texto: 'Tengo un proceso definido para tomar decisiones clave en mi empresa.'
  },
  {
    codigo: 'decisiones_2',
    seccion: 'decisiones',
    orden: 2,
    texto: 'Cuando una decision es critica, la analizo desde diferentes angulos antes de ejecutarla.'
  },
  {
    codigo: 'decisiones_3',
    seccion: 'decisiones',
    orden: 3,
    texto: 'Confio en mi equipo para que participe en la toma de decisiones estrategicas.'
  },
  {
    codigo: 'decisiones_4',
    seccion: 'decisiones',
    orden: 4,
    texto: 'Evito tomar decisiones basadas en emociones sin respaldo de datos o analisis.'
  },
  {
    codigo: 'decisiones_5',
    seccion: 'decisiones',
    orden: 5,
    texto: 'Reviso periodicamente las consecuencias de mis decisiones anteriores para mejorar.'
  },

  // ─────────────────────────────────────────
  // SECCION 3 - DELEGACION Y LIDERAZGO
  // ─────────────────────────────────────────
  {
    codigo: 'delegacion_1',
    seccion: 'delegacion',
    orden: 1,
    texto: 'Delego funciones estrategicas, no solo tareas operativas.'
  },
  {
    codigo: 'delegacion_2',
    seccion: 'delegacion',
    orden: 2,
    texto: 'Mi equipo tiene claridad sobre sus responsabilidades sin que yo tenga que intervenir todo el tiempo.'
  },
  {
    codigo: 'delegacion_3',
    seccion: 'delegacion',
    orden: 3,
    texto: 'Confio en mi equipo para tomar decisiones sin depender de mi en todo momento.'
  },
  {
    codigo: 'delegacion_4',
    seccion: 'delegacion',
    orden: 4,
    texto: 'Podria ausentarme por un mes sin que la empresa colapse.'
  },
  {
    codigo: 'delegacion_5',
    seccion: 'delegacion',
    orden: 5,
    texto: 'Mi equipo conoce los procesos clave del negocio y los puede ejecutar sin mi supervision directa.'
  },

  // ─────────────────────────────────────────
  // SECCION 4 - VISION Y ESTRATEGIA PERSONAL
  // ─────────────────────────────────────────
  {
    codigo: 'vision_1',
    seccion: 'vision',
    orden: 1,
    texto: 'Tengo una vision clara para mi empresa a 5-10 anos.'
  },
  {
    codigo: 'vision_2',
    seccion: 'vision',
    orden: 2,
    texto: 'Cada decision que tomo esta alineada con la estrategia a largo plazo del negocio.'
  },
  {
    codigo: 'vision_3',
    seccion: 'vision',
    orden: 3,
    texto: 'Tengo objetivos estrategicos bien definidos y medibles.'
  },
  {
    codigo: 'vision_4',
    seccion: 'vision',
    orden: 4,
    texto: 'Soy consciente de las areas donde necesito mejorar como lider y trabajo en ello.'
  },
  {
    codigo: 'vision_5',
    seccion: 'vision',
    orden: 5,
    texto: 'Tengo un plan estructurado para hacer crecer mi negocio sin sacrificar la calidad de vida.'
  }
]

// ─────────────────────────────────────────────────────────────────────
// PERFILES Y RANGOS
// ─────────────────────────────────────────────────────────────────────
export const PIE_PERFILES = {
  lider_estrategico: {
    codigo: 'lider_estrategico',
    nombre: 'Lider Estrategico',
    rango: '80 - 100 puntos',
    rango_min: 80,
    rango_max: 100,
    color: 'green',
    emoji: 'star',
    descripcion_corta: 'Listo para escalar sin fricciones',
    descripcion_larga: 'Tienes vision clara, tomas decisiones estrategicas y tu empresa no depende totalmente de ti. Has aprendido a delegar y a pensar en crecimiento sin quedarte atrapado en la operacion.',
    acciones: [
      'Asegurar que tu empresa este lista para escalar sin fricciones.',
      'Enfocarte en mejorar procesos de crecimiento y expansion.',
      'Utilizar herramientas de automatizacion y control financiero.'
    ]
  },
  lider_transicion: {
    codigo: 'lider_transicion',
    nombre: 'Lider en Transicion',
    rango: '60 - 79 puntos',
    rango_min: 60,
    rango_max: 79,
    color: 'teal',
    emoji: 'trending-up',
    descripcion_corta: 'En camino, con espacio para crecer',
    descripcion_larga: 'Estas en camino, pero todavia tienes aspectos que te frenan. Tomas decisiones estrategicas, pero sigues demasiado involucrado en la operacion.',
    acciones: [
      'Definir claramente que tareas seguiras haciendo tu y cuales debes delegar.',
      'Crear sistemas de toma de decisiones estructurados para reducir la dependencia en ti.',
      'Trabajar en herramientas de vision y planificacion estrategica.'
    ]
  },
  lider_operativo: {
    codigo: 'lider_operativo',
    nombre: 'Lider Operativo',
    rango: '40 - 59 puntos',
    rango_min: 40,
    rango_max: 59,
    color: 'amber',
    emoji: 'alert-triangle',
    descripcion_corta: 'Cuello de botella de tu propio negocio',
    descripcion_larga: 'Tu empresa sigue dependiendo demasiado de ti y tomas decisiones basadas en urgencias. Delegas poco o nada, lo que te convierte en un cuello de botella para el crecimiento.',
    acciones: [
      'Identificar que actividades son estrategicas y cuales debes delegar inmediatamente.',
      'Implementar reuniones de alineacion con tu equipo para mejorar la comunicacion.',
      'Crear un plan de accion de 90 dias para dejar de estar en la operacion diaria.'
    ]
  },
  lider_reactivo: {
    codigo: 'lider_reactivo',
    nombre: 'Lider Reactivo',
    rango: 'Menos de 40 puntos',
    rango_min: 0,
    rango_max: 39,
    color: 'red',
    emoji: 'flame',
    descripcion_corta: 'Modo supervivencia',
    descripcion_larga: 'No tienes claridad en tu vision, liderazgo ni procesos de toma de decisiones. Tu negocio opera en modo supervivencia, sin planificacion ni estrategia.',
    acciones: [
      'Definir urgentemente un proposito claro y una vision a largo plazo.',
      'Empezar por delegar tareas simples y medir el impacto.',
      'Hacer una revision de modelo de negocio con herramientas de planificacion.'
    ]
  }
}

// Helper: obtener perfil por puntaje
export function getPerfilByPuntaje(puntaje) {
  if (puntaje >= 80) return PIE_PERFILES.lider_estrategico
  if (puntaje >= 60) return PIE_PERFILES.lider_transicion
  if (puntaje >= 40) return PIE_PERFILES.lider_operativo
  return PIE_PERFILES.lider_reactivo
}

// Helper: obtener pregunta por codigo
export function getPreguntaByCodigo(codigo) {
  return PIE_PREGUNTAS.find(p => p.codigo === codigo)
}

// Helper: obtener preguntas de una seccion
export function getPreguntasBySeccion(seccion) {
  return PIE_PREGUNTAS.filter(p => p.seccion === seccion)
}

// Helper: obtener seccion por codigo
export function getSeccionByCodigo(codigo) {
  return PIE_SECCIONES.find(s => s.codigo === codigo)
}
