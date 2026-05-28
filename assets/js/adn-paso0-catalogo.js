// ════════════════════════════════════════════════════════════════════════════
// SCALEx · Catálogo del Paso 0 de ADN — Diagnóstico de Pirámide
// ════════════════════════════════════════════════════════════════════════════
// 20 tesis detonantes. Cada una mide la misma premisa desde un ángulo distinto:
//   "¿Le da prioridad por proceso a los públicos a los que sirve, sí o no?"
//
// El consultor escucha al cliente, toma notas, y clica una de 4 respuestas-tipo.
// Cada respuesta vale: A=1, B=2, C=3, D=4.
// Suma máxima 80 puntos. Rangos:
//   20-35 = pirámide cerrada
//   36-50 = pirámide en transición
//   51-65 = pirámide abierta
//   66-80 = pirámide invertida
// ════════════════════════════════════════════════════════════════════════════

export const TESIS_PASO_0 = [
  {
    numero: 1,
    titulo: "El estacionamiento",
    angulo: "Jerarquía espacial física",
    detonante: "Imagínate que vas a construir tu empresa desde cero en un terreno nuevo. Tienes que diseñar el estacionamiento. ¿Dónde van los lugares más cercanos a la entrada? ¿Quiénes se estacionan ahí? ¿Y los más lejanos?",
    respuestas: [
      { tipo: "A", descripcion: "Lugares cercanos para dueño y dirección. Clientes y proveedores al final." },
      { tipo: "B", descripcion: "Dirección cerca, pero también clientes con espacios reservados." },
      { tipo: "C", descripcion: "Primero clientes, después proveedores, después empleados. Su lugar al final." },
      { tipo: "D", descripcion: "Diseñó por flujo del público, justificando cada decisión por servicio." }
    ]
  },
  {
    numero: 2,
    titulo: "La sala de juntas",
    angulo: "Jerarquía espacial simbólica",
    detonante: "En tu sala de juntas, ¿hay un lugar que es 'el lugar del jefe'? Si entra un cliente importante, ¿dónde lo sientas?",
    respuestas: [
      { tipo: "A", descripcion: "Cabecera fija del dueño. No se cede ni para clientes." },
      { tipo: "B", descripcion: "Cabecera del dueño, pero a clientes importantes sí se cede a veces." },
      { tipo: "C", descripcion: "No hay lugar fijo. El que llega primero se sienta donde quiera." },
      { tipo: "D", descripcion: "Mesa redonda o círculo. La jerarquía espacial no existe." }
    ]
  },
  {
    numero: 3,
    titulo: "La primera línea al teléfono",
    angulo: "Autoridad de quien toca al cliente",
    detonante: "Si soy cliente nuevo y llamo, ¿quién contesta? ¿Puede resolverme algo o tiene que escalar? Si la queja es fuerte, ¿hasta dónde llega?",
    respuestas: [
      { tipo: "A", descripcion: "Recepcionista sin autoridad. Quejas fuertes llegan al dueño." },
      { tipo: "B", descripcion: "Servicio al cliente con autoridad limitada. Escalan a gerencia." },
      { tipo: "C", descripcion: "Persona capacitada para resolver el 80%. Solo casos excepcionales escalan." },
      { tipo: "D", descripcion: "La primera persona tiene autoridad, presupuesto y protocolo. El cliente no repite su historia." }
    ]
  },
  {
    numero: 4,
    titulo: "Las decisiones de $5,000",
    angulo: "Distribución del poder operativo",
    detonante: "Una decisión de $5,000 para mejorar la atención de un cliente — comprar, contratar, regalar algo. ¿Quién la toma? ¿Cuántas aprobaciones?",
    respuestas: [
      { tipo: "A", descripcion: "Solo el dueño. Cualquier gasto pasa por él." },
      { tipo: "B", descripcion: "El dueño o un socio. 2-3 niveles de aprobación." },
      { tipo: "C", descripcion: "Gerentes de área dentro de su presupuesto. 1 nivel." },
      { tipo: "D", descripcion: "El que atiende al cliente puede decidir. 0 niveles, solo reporta después." }
    ]
  },
  {
    numero: 5,
    titulo: "El orden de la agenda de dirección",
    angulo: "Qué está primero en la cabeza del dueño",
    detonante: "En tu junta de dirección, ¿cuál es el primer punto de la agenda? ¿De qué hablan primero?",
    respuestas: [
      { tipo: "A", descripcion: "Números financieros: ventas, cobranza, gastos." },
      { tipo: "B", descripcion: "Operación interna: quién hizo qué, qué falta." },
      { tipo: "C", descripcion: "Equipo: cómo están las personas, qué necesitan." },
      { tipo: "D", descripcion: "Públicos: cómo están los clientes, qué nos piden, qué se está perdiendo." }
    ]
  },
  {
    numero: 6,
    titulo: "El empleado nuevo en sus primeras 8 horas",
    angulo: "Diseño del onboarding",
    detonante: "Una persona nueva entra hoy. En sus primeras 8 horas, ¿qué pasa? ¿Quién la recibe, qué le explican, cuándo conoce a sus compañeros?",
    respuestas: [
      { tipo: "A", descripcion: "Llega y la dejan. Pregunta todo. Nadie se acerca." },
      { tipo: "B", descripcion: "Alguien la recibe, explica lo básico, presenta a 2-3. El resto sola." },
      { tipo: "C", descripcion: "Onboarding de medio día con persona asignada y materiales." },
      { tipo: "D", descripcion: "Onboarding diseñado a 90 días. Día 1 ya sabe metas, herramientas, capacitador, procesos." }
    ]
  },
  {
    numero: 7,
    titulo: "La propuesta del último empleado",
    angulo: "Velocidad de ideas hacia decisión",
    detonante: "¿Cuándo fue la última vez que un empleado de primera línea te propuso algo? ¿Qué pasó con esa propuesta?",
    respuestas: [
      { tipo: "A", descripcion: "No recuerdo una reciente. O si la hubo, no llegó a nada." },
      { tipo: "B", descripcion: "Recuerdo alguna. La escuchamos pero no se implementó." },
      { tipo: "C", descripcion: "Hubo una que se ejecutó después de varias semanas." },
      { tipo: "D", descripcion: "Pasa constantemente. Hay mecanismo para que lleguen a decisión rápido." }
    ]
  },
  {
    numero: 8,
    titulo: "El cliente que se queja",
    angulo: "Reflejo de la cultura ante el conflicto",
    detonante: "Un cliente importante se queja fuerte con un empleado. ¿Qué es lo primero que pasa?",
    respuestas: [
      { tipo: "A", descripcion: "El empleado se defiende como puede. Se informa al dueño después. Hay regaño." },
      { tipo: "B", descripcion: "Escala al jefe inmediato. Se contesta cuando se pueda. Se busca culpable." },
      { tipo: "C", descripcion: "Hay protocolo. Se documenta, se responde en X tiempo, se analiza la causa." },
      { tipo: "D", descripcion: "El empleado resuelve en el momento dentro de un rango. El sistema captura el aprendizaje." }
    ]
  },
  {
    numero: 9,
    titulo: "El tiempo del dueño",
    angulo: "Dónde invierte energía el líder",
    detonante: "De tu semana, ¿cuánto tiempo apagando fuegos urgentes vs pensando el futuro?",
    respuestas: [
      { tipo: "A", descripcion: "Casi todo apagando fuegos. El futuro lo pienso en domingo o nunca." },
      { tipo: "B", descripcion: "70% fuegos, 30% futuro, a ratos." },
      { tipo: "C", descripcion: "50/50, con espacios protegidos." },
      { tipo: "D", descripcion: "30% operativo, 70% estratégico. La operación corre sin mí." }
    ]
  },
  {
    numero: 10,
    titulo: "El mes sin avisar",
    angulo: "Test de dependencia del dueño",
    detonante: "Si te fueras un mes sin avisar — desconectado total — ¿qué pasaría con tu empresa?",
    respuestas: [
      { tipo: "A", descripcion: "Colapsa o se paraliza. Todo se acumula esperándome." },
      { tipo: "B", descripcion: "Funciona a medias. Las decisiones importantes se posponen." },
      { tipo: "C", descripcion: "Funciona bien en operación. Algunas decisiones grandes esperan." },
      { tipo: "D", descripcion: "Funciona normalmente. Hay sistema, personas con autoridad, protocolos." }
    ]
  },
  {
    numero: 11,
    titulo: "Los procesos escritos",
    angulo: "Operación en cabezas vs en sistemas",
    detonante: "Los procesos críticos — atención, contratación, quejas, cobranza — ¿están escritos en algún lado accesible?",
    respuestas: [
      { tipo: "A", descripcion: "No. Cada quien sabe lo suyo. Si alguien se va, el conocimiento se va con él." },
      { tipo: "B", descripcion: "Algunos a medias. Hay documentos pero nadie los consulta." },
      { tipo: "C", descripcion: "Los críticos están documentados, se consultan ocasionalmente." },
      { tipo: "D", descripcion: "Todos los clave escritos, actualizados, los nuevos aprenden de ahí. El sistema vive en documentos." }
    ]
  },
  {
    numero: 12,
    titulo: "La mala noticia",
    angulo: "Mesura del líder vs víscera",
    detonante: "Llega una mala noticia importante a media mañana. ¿Cómo reacciona tu equipo ante tu reacción?",
    respuestas: [
      { tipo: "A", descripcion: "Mi reacción contagia rápido. Se nota cuando algo va mal." },
      { tipo: "B", descripcion: "Algunos lo notan. Intento controlarme pero a veces se sale." },
      { tipo: "C", descripcion: "Proceso antes de comunicar. Casi siempre logro mesura." },
      { tipo: "D", descripcion: "Mi equipo no detecta mi estado por mi reacción. Proceso primero, comunico con claridad." }
    ]
  },
  {
    numero: 13,
    titulo: "El despido que no has hecho",
    angulo: "Claridad de cuándo alguien no encaja",
    detonante: "¿Hay alguien en tu equipo que sabes que no debería seguir pero todavía no has hablado con esa persona?",
    respuestas: [
      { tipo: "A", descripcion: "Sí, varios. No sé bien cómo abordarlo." },
      { tipo: "B", descripcion: "Sí, uno. Llevo meses postergándolo." },
      { tipo: "C", descripcion: "No, lo que tengo que hablar lo hablo. A veces tardo pero lo hago." },
      { tipo: "D", descripcion: "No, tengo claridad de quién encaja y las conversaciones difíciles las tengo a tiempo." }
    ]
  },
  {
    numero: 14,
    titulo: "La contratación por intuición vs proceso",
    angulo: "Diseño de la entrada al equipo",
    detonante: "La última contratación importante, ¿cómo la decidiste? ¿Intuición, recomendación, proceso formal?",
    respuestas: [
      { tipo: "A", descripcion: "Intuición o recomendación. Le di chance porque me cayó bien." },
      { tipo: "B", descripcion: "Intuición con algunas entrevistas. Sin proceso formal." },
      { tipo: "C", descripcion: "Varias entrevistas y referencias. Yo decidí al final." },
      { tipo: "D", descripcion: "Proceso con criterios claros, varios evaluadores, decisión colectiva por perfil de rol." }
    ]
  },
  {
    numero: 15,
    titulo: "El horario del dueño",
    angulo: "Presencia obligatoria como síntoma",
    detonante: "¿Es indispensable que estés físicamente presente para que la operación funcione? ¿Notas la diferencia los días que no estás?",
    respuestas: [
      { tipo: "A", descripcion: "Si no estoy se nota mucho. La gente se ralentiza, se posponen decisiones." },
      { tipo: "B", descripcion: "Se nota un poco. Lo importante igual se hace." },
      { tipo: "C", descripcion: "Casi no se nota mi ausencia." },
      { tipo: "D", descripcion: "Mi presencia o ausencia no afecta la operación. Mi rol es estratégico." }
    ]
  },
  {
    numero: 16,
    titulo: "El feedback desde abajo",
    angulo: "Cuando el empleado le dice al dueño qué está mal",
    detonante: "¿Cuándo fue la última vez que un empleado te dijo, cara a cara, que algo que TÚ haces no está bien para la empresa? ¿Cómo terminó?",
    respuestas: [
      { tipo: "A", descripcion: "No recuerdo. La gente no me dice esas cosas." },
      { tipo: "B", descripcion: "Hace mucho. No terminó bien." },
      { tipo: "C", descripcion: "Algunas veces. Me cuesta pero escucho." },
      { tipo: "D", descripcion: "Con frecuencia, hay confianza, y muchas veces cambio cosas a partir de eso." }
    ]
  },
  {
    numero: 17,
    titulo: "El gasto imprevisto del cliente",
    angulo: "Autoridad económica de primera línea",
    detonante: "Un cliente necesita algo urgente que cuesta $2,000 y no estaba presupuestado. ¿Quién decide?",
    respuestas: [
      { tipo: "A", descripcion: "Yo. Me llaman aunque sea fin de semana." },
      { tipo: "B", descripcion: "Un gerente. Pero termina consultándome." },
      { tipo: "C", descripcion: "El gerente del área dentro de un rango." },
      { tipo: "D", descripcion: "La persona que atiende al cliente. Tiene presupuesto delegado." }
    ]
  },
  {
    numero: 18,
    titulo: "La capacitación como inversión",
    angulo: "Diseño del crecimiento del equipo",
    detonante: "En los últimos 12 meses, ¿cuánto invertiste en capacitar a tu equipo? ¿Planeado o cuando se puede?",
    respuestas: [
      { tipo: "A", descripcion: "Muy poco o nada. Cuando hay tiempo o emergencia." },
      { tipo: "B", descripcion: "Algo, sin plan. Aprovechamos oportunidades." },
      { tipo: "C", descripcion: "Hay presupuesto anual de capacitación." },
      { tipo: "D", descripcion: "Cada rol tiene plan de desarrollo. La capacitación es estructural." }
    ]
  },
  {
    numero: 19,
    titulo: "Las reuniones sin el dueño",
    angulo: "Autonomía operativa del equipo",
    detonante: "¿Tu equipo tiene reuniones operativas regulares sin ti? ¿Te enteras por minutas o solo cuando algo falla?",
    respuestas: [
      { tipo: "A", descripcion: "No las hay. Si hay junta, yo estoy." },
      { tipo: "B", descripcion: "Hay algunas pero termino entrando o me reportan informal." },
      { tipo: "C", descripcion: "Hay reuniones sin mí. Me llegan resúmenes." },
      { tipo: "D", descripcion: "El equipo opera con sus propias reuniones e indicadores. Solo reporta lo estratégico." }
    ]
  },
  {
    numero: 20,
    titulo: "El orgullo de lo construido",
    angulo: "Qué celebra el dueño cuando habla de su empresa",
    detonante: "Cuando hablas con orgullo de tu empresa con alguien externo, ¿qué cuentas primero? ¿Qué te hace sentir orgulloso?",
    respuestas: [
      { tipo: "A", descripcion: "Lo que YO construí. Lo que logré contra viento y marea. El esfuerzo personal." },
      { tipo: "B", descripcion: "Lo que hemos sobrevivido. Las crisis superadas. Mi tenacidad." },
      { tipo: "C", descripcion: "El equipo que se formó. Lo que crecimos juntos." },
      { tipo: "D", descripcion: "Los clientes que servimos, lo que transformamos para ellos, las historias de público que cambiaron." }
    ]
  }
];

// Mapeo respuesta-tipo → puntaje
export const PUNTAJE_RESPUESTA = { A: 1, B: 2, C: 3, D: 4 };

// Rangos de tipo de pirámide
export const RANGOS_PIRAMIDE = [
  { min: 20, max: 35, codigo: 'cerrada' },
  { min: 36, max: 50, codigo: 'transicion' },
  { min: 51, max: 65, codigo: 'abierta' },
  { min: 66, max: 80, codigo: 'invertida' }
];
