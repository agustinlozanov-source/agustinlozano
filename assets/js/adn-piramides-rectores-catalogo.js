// ════════════════════════════════════════════════════════════════════════════
// SCALEx · Catálogo final de ADN
// ════════════════════════════════════════════════════════════════════════════
// Contiene:
//   1. PIRAMIDES — textos descriptivos de los 4 tipos
//   2. AGENDAS_PASO_0 — templates de 7/30/90 por tipo de pirámide
//   3. AGENDAS_PASO_1 — template de 7/30/90 para rebalance
//   4. RECTORES — los 6 rectores estándar con su descripción
//   5. AGENDAS_PASO_2_RECTOR — template de 7/30/90 para cada rector
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// 1. LOS 4 TIPOS DE PIRÁMIDE — descripciones para mostrar al cliente
// ════════════════════════════════════════════════════════════════════════════

export const PIRAMIDES = {
  cerrada: {
    nombre: "Pirámide Cerrada",
    color: "#FF3B30", // rojo SCALEx
    icono: "alert-triangle",
    rango: "20-35 puntos",
    descripcion_corta: "Empresa tradicional donde el poder está concentrado en el dueño y la primera línea casi no decide.",
    descripcion_larga: "Tu empresa hoy opera bajo un modelo tradicional. El dueño es el centro de decisión, los procesos viven en cabezas y no en sistemas, y la primera línea — quien toca al público — tiene poca autoridad para resolver. Esto no es maldad: es ausencia de diseño. La mayoría de PyMEs en LATAM operan así porque heredaron el modelo, no porque lo eligieron. Es un buen punto de partida — porque ahora que ves la contraparte, puedes decidir si quieres construir otra cosa.",
    indicadores: [
      "Las decisiones cotidianas dependen casi siempre del dueño",
      "Si te ausentas, la operación se ralentiza significativamente",
      "Los procesos críticos viven en cabezas, no en documentos",
      "La primera línea escala las quejas en lugar de resolverlas",
      "El equipo trabaja con incertidumbre estructural"
    ],
    proximo_paso: "Tu primera tarea es identificar UN proceso de alto valor que hoy depende de ti y diseñar cómo cederlo en los próximos 90 días."
  },

  transicion: {
    nombre: "Pirámide en Transición",
    color: "#FF9500", // ámbar SCALEx
    icono: "trending-up",
    rango: "36-50 puntos",
    descripcion_corta: "Empresa en proceso de inversión. Hay zonas con autonomía y zonas todavía centralizadas.",
    descripcion_larga: "Tu empresa está en el proceso más interesante y más difícil — invirtiendo la pirámide. Hay áreas donde ya hay autonomía operativa, procesos documentados y decisiones distribuidas. Pero también hay áreas críticas donde sigues siendo el cuello de botella. Esta etapa es delicada: si no aceleras, se estanca; si presionas demasiado rápido, se rompe. El trabajo es identificar los siguientes puntos de cesión y ejecutarlos con disciplina.",
    indicadores: [
      "Algunas áreas funcionan sin ti, otras no",
      "Hay procesos documentados parcialmente",
      "La primera línea tiene autoridad limitada pero existe",
      "Las decisiones financieras siguen siendo centralizadas",
      "Existe tensión entre lo viejo y lo nuevo"
    ],
    proximo_paso: "Identifica las 2-3 áreas donde sigues siendo indispensable y diseña un plan plurianual para cederlas."
  },

  abierta: {
    nombre: "Pirámide Abierta",
    color: "#1AAB99", // teal SCALEx
    icono: "users",
    rango: "51-65 puntos",
    descripcion_corta: "Empresa con buena distribución del poder operativo. La mayoría de áreas funciona con autonomía.",
    descripcion_larga: "Tu empresa ya logró lo que la mayoría no logra: distribuir el poder operativo de forma estructural. La primera línea decide, los procesos viven en sistemas, y tu rol es mayormente estratégico. Estás en la antesala de la pirámide invertida — la verdadera ventaja competitiva. Lo que falta es consolidar las cesiones, profundizar la cultura de servicio al público, y construir los rectores que sostendrán el modelo en el largo plazo.",
    indicadores: [
      "La operación corre sin tu presencia diaria",
      "Hay procesos documentados y consultados",
      "La primera línea resuelve la mayoría de situaciones",
      "Tu tiempo se dedica mayormente a estrategia y futuro",
      "El equipo da feedback honesto hacia arriba"
    ],
    proximo_paso: "Consolida las cesiones hechas y enfócate en los rectores faltantes — especialmente Transformación y Gobierno Institucional."
  },

  invertida: {
    nombre: "Pirámide Invertida",
    color: "#D4A256", // dorado SCALEx
    icono: "award",
    rango: "66-80 puntos",
    descripcion_corta: "Empresa con el modelo de pirámide invertida operativo. Los públicos están en la cima, el liderazgo sostiene desde abajo.",
    descripcion_larga: "Has logrado lo que el 95% de las empresas en LATAM no logra. Tu pirámide está invertida — los públicos a los que sirves están en la cima, los procesos diferenciadores los sostienen, y tu liderazgo opera desde la base sosteniendo todo. Esto te da ventaja competitiva real: velocidad de decisión, calidad de servicio, retención de talento, capacidad de adquirir capital. El trabajo ahora es mantenimiento crítico — auditar que las cesiones no regresen al dueño y profundizar la cultura.",
    indicadores: [
      "La primera línea tiene autoridad y presupuesto delegado",
      "Los procesos viven en sistemas y se actualizan",
      "La operación opera sin tu presencia",
      "Las decisiones del cliente se resuelven sin escalar",
      "Tu rol es estratégico y de transformación"
    ],
    proximo_paso: "Tu trabajo ahora es de mantenimiento: auditar que las cesiones no regresen al dueño y profundizar los rectores institucionales."
  }
};

// ════════════════════════════════════════════════════════════════════════════
// 2. AGENDAS 7/30/90 — Paso 0 (por tipo de pirámide)
// ════════════════════════════════════════════════════════════════════════════
// El anclaje del 7/30/90 del Paso 0 es CESIÓN DE PODER.
// Cada tipo de pirámide tiene su intensidad ajustada.
// ════════════════════════════════════════════════════════════════════════════

export const AGENDAS_PASO_0 = {
  cerrada: {
    "7_dias": "Identifica 1 proceso de alto valor que hoy haces solo tú y que podría ser cedido. Solo identificar, no actuar. Escribir qué hace, qué información requiere y qué decisiones implica.",
    "30_dias": "De ese proceso identificado, descompón sus partes. Identifica al candidato del equipo que podría asumirlo. Define qué información, qué herramientas y qué capacitación necesita para hacerlo.",
    "90_dias": "Ejecutar la cesión completa: declarar la responsabilidad, entregar herramientas, capacitar, establecer feedback. Al cierre del 90, ese proceso ya no lo haces tú."
  },
  transicion: {
    "7_dias": "Identifica las 2-3 áreas donde sigues siendo indispensable. Para cada una, escribe qué decisiones dependen aún de ti y cuáles podrían cederse.",
    "30_dias": "Elige UNA de esas áreas para enfocarte en 90 días. Identifica a la persona o equipo que va a asumir esa responsabilidad. Diseña el plan de cesión.",
    "90_dias": "Ejecutar la cesión. Al cierre, esa área debe operar sin tu intervención cotidiana. Solo escalación de excepciones."
  },
  abierta: {
    "7_dias": "Audita qué cesiones hechas en el pasado han regresado parcialmente al dueño. Identifica las 2 más críticas para reforzar.",
    "30_dias": "Para cada cesión auditada, diseña instrumentos de vigilancia y feedback que permitan al equipo seguir operando con autonomía sin retornos.",
    "90_dias": "Implementar los instrumentos. Empezar a construir los rectores faltantes — especialmente Transformación si no existe operativamente."
  },
  invertida: {
    "7_dias": "Audita las cesiones existentes para detectar señales de retorno hacia el dueño. Identifica si hay decisiones que han vuelto a tu escritorio.",
    "30_dias": "Profundiza los rectores institucionales. Identifica cuáles están operativos y cuáles solo declarados.",
    "90_dias": "Construir el rector institucional más débil. Esto consolida la pirámide invertida y la hace sostenible en el largo plazo."
  }
};

// ════════════════════════════════════════════════════════════════════════════
// 3. AGENDA 7/30/90 — Paso 1 (rebalance de dosis)
// ════════════════════════════════════════════════════════════════════════════
// El anclaje del 7/30/90 del Paso 1 es REBALANCE DE DOSIS DE RASGOS.
// Es el mismo template para todos — el contenido específico lo llena
// el consultor con el cliente sobre qué rasgo subir y qué dosificar.
// ════════════════════════════════════════════════════════════════════════════

export const AGENDA_PASO_1_TEMPLATE = {
  "7_dias": "Identifica qué rasgo de los que tienes BAJOS te gustaría subir. ¿Por qué? ¿Qué te aportaría? Identifica también qué rasgo dominante estás dispuesto a dosificar para hacer espacio. Justifica ambas decisiones con argumentos estratégicos.",
  "30_dias": "Diseña UNA acción concreta de incorporación del rasgo elegido. La acción debe ser específica — no genérica. Ejemplo: 'contratar a alguien con perfil comercial fuerte para subir Comercio del 3% al 15%', no 'mejorar nuestra cultura comercial'.",
  "90_dias": "Mide. ¿La acción del día 30 logró mover el rasgo en la operación diaria, no solo en intención? Si sí, consolida. Si no, ajusta la dosis o elige otra acción."
};

// ════════════════════════════════════════════════════════════════════════════
// 4. LOS 6 RECTORES ESTÁNDAR
// ════════════════════════════════════════════════════════════════════════════

export const RECTORES = [
  {
    codigo: "planeacion_estrategica",
    nombre: "Planeación estratégica",
    descripcion_corta: "El proceso que conecta visión de largo plazo con operación de cada día.",
    pregunta_evaluacion: "¿Tienes un plan estratégico vivo — no un documento guardado en un drive? ¿Lo consultas, lo actualizas, las decisiones cotidianas se conectan con él?",
    si_no_existe: "Sin Planeación Estratégica viva, el Vector se rompe. La empresa opera por impulsos del corto plazo y pierde capacidad de competir a 3-5 años."
  },
  {
    codigo: "auditoria",
    nombre: "Auditoría",
    descripcion_corta: "El proceso independiente que verifica que las cosas se hacen como se dice.",
    pregunta_evaluacion: "¿Hay alguien o algún proceso que revisa de forma independiente que las cosas se están haciendo como dicen que se están haciendo? Financiero, operativo, calidad.",
    si_no_existe: "Sin Auditoría, la empresa se autoengaña. Los reportes reflejan lo que la gente quiere mostrar, no lo que realmente pasa."
  },
  {
    codigo: "legal_fiscal",
    nombre: "Legal y fiscal",
    descripcion_corta: "El proceso que sostiene la empresa frente a la ley, los impuestos y los riesgos.",
    pregunta_evaluacion: "¿Tienes cubierto lo legal y lo fiscal con asesoría especializada — no solo el contador del mes? Contratos, obligaciones laborales, riesgos legales identificados.",
    si_no_existe: "Sin Legal y Fiscal sólido, la empresa vive expuesta. Una contingencia puede llevarla a la quiebra o a una crisis reputacional."
  },
  {
    codigo: "normatividad",
    nombre: "Normatividad",
    descripcion_corta: "Las reglas internas escritas que rigen cómo se hace lo que se hace.",
    pregunta_evaluacion: "¿Hay reglas internas escritas que rigen cómo se hace lo que se hace? Políticas de operación, código de conducta, normas que aplican a todos por igual.",
    si_no_existe: "Sin Normatividad, las decisiones cotidianas dependen de criterio individual. Imposible escalar más allá del círculo de confianza del dueño."
  },
  {
    codigo: "transformacion",
    nombre: "Transformación",
    descripcion_corta: "El proceso encargado de evolucionar la empresa, no mantenerla.",
    pregunta_evaluacion: "¿Existe alguien o un proceso encargado de evolucionar la empresa? No mantener — evolucionar. Identificar qué hay que cambiar, planear el cambio, ejecutarlo.",
    si_no_existe: "Sin Transformación, la empresa se atrofia. Sigue haciendo lo mismo aunque el mercado cambie. Es la causa más común de empresas que se quedan atrás."
  },
  {
    codigo: "gobierno_institucional",
    nombre: "Gobierno institucional",
    descripcion_corta: "Las reglas de gobernanza que sostienen a la empresa más allá del dueño.",
    pregunta_evaluacion: "¿Hay estructura de gobierno definida — consejo, comités, roles de decisión clara — que opera independiente del dueño? ¿O todas las decisiones grandes siguen siendo unipersonales?",
    si_no_existe: "Sin Gobierno Institucional, la empresa es la persona del dueño. Si él se ausenta o se va, la empresa no sobrevive como institución."
  }
];

// ════════════════════════════════════════════════════════════════════════════
// 5. AGENDA 7/30/90 — Paso 2 por rector (construcción del rector)
// ════════════════════════════════════════════════════════════════════════════
// El anclaje del 7/30/90 del Paso 2 es CONSTRUCCIÓN DEL RECTOR ELEGIDO.
// Template general — cada rector elegido genera su propio plan a un año.
// ════════════════════════════════════════════════════════════════════════════

export const AGENDA_PASO_2_RECTOR_TEMPLATE = {
  "7_dias": "Define qué significa este rector PARA TU empresa. No el rector genérico — el tuyo. ¿Qué debe garantizar? ¿Qué problema concreto resuelve en tu operación?",
  "30_dias": "Identifica quién va a sostener este rector. Persona, equipo, asesor externo, mix. Define el alcance y la frecuencia de operación mínima.",
  "90_dias": "Diseñar y empezar a operar la versión mínima viable del rector. Al cierre del 90, debe estar al menos en estado DECLARADO con actividad verificable."
};
