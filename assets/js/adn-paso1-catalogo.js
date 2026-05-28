// ════════════════════════════════════════════════════════════════════════════
// SCALEx · Catálogo del Paso 1 de ADN — Perfil de Personalidad Empresarial
// ════════════════════════════════════════════════════════════════════════════
// 28 preguntas detonantes en 5 dimensiones + 1 transversal final.
// Cada respuesta clicada reparte pesos a 2-3 rasgos.
// Los 7 rasgos: templo, familia, estudio, fabrica, comercio, taller, laboratorio
// ════════════════════════════════════════════════════════════════════════════

export const PREGUNTAS_PASO_1 = [
  // ═══ DIMENSIÓN 1 — ORIGEN DE LA ENERGÍA (5 preguntas) ═══
  {
    numero: 1,
    dimension: "origen_energia",
    titulo: "El momento cero",
    detonante: "Cuéntame cómo empezó tu empresa. No me cuentes el negocio — cuéntame el momento. ¿Qué estabas viendo, sintiendo o queriendo cuando decidiste hacerla?",
    respuestas: [
      { tipo: "A", descripcion: "Habla de una misión, una causa, algo que faltaba en el mundo. Lenguaje de valores, propósito, deber.",
        pesos: { templo: 3, estudio: 1 } },
      { tipo: "B", descripcion: "Habla de personas. Familia, amigos, equipo de confianza. La empresa nació por o para alguien cercano.",
        pesos: { familia: 3, taller: 1 } },
      { tipo: "C", descripcion: "Habla de oportunidad. Vio un hueco, una necesidad insatisfecha, un negocio rentable. Lenguaje de mercado.",
        pesos: { comercio: 3, laboratorio: 1 } },
      { tipo: "D", descripcion: "Habla del oficio. Era bueno haciendo algo y decidió hacerlo por su cuenta. Lenguaje de producto, hechura.",
        pesos: { taller: 3, estudio: 1 } }
    ]
  },
  {
    numero: 2,
    dimension: "origen_energia",
    titulo: "Lo que te mantiene despierto",
    detonante: "¿Qué es lo que te quita el sueño hoy? No problemas operativos — me refiero a lo que mantiene tu cabeza ocupada los domingos cuando piensas en la empresa.",
    respuestas: [
      { tipo: "A", descripcion: "Le da vueltas a si la empresa está cumpliendo su propósito, si está siendo coherente con sus valores.",
        pesos: { templo: 3, estudio: 1 } },
      { tipo: "B", descripcion: "Pensamientos sobre el equipo. Quién está bien, quién no, cómo cuidarlos.",
        pesos: { familia: 3, taller: 1 } },
      { tipo: "C", descripcion: "Indicadores de mercado, competencia, ventas, oportunidades. Foco en lo comercial.",
        pesos: { comercio: 3, fabrica: 1 } },
      { tipo: "D", descripcion: "La eficiencia interna, los procesos que no fluyen, lo que se podría optimizar.",
        pesos: { fabrica: 3, taller: 1 } }
    ]
  },
  {
    numero: 3,
    dimension: "origen_energia",
    titulo: "La conversación recurrente",
    detonante: "Si grabara las conversaciones de tu equipo durante una semana entera, ¿qué tema aparecería más veces? ¿De qué habla la empresa cuando habla de sí misma?",
    respuestas: [
      { tipo: "A", descripcion: "Hablan de calidad, detalle, originalidad, autoría de lo que entregan.",
        pesos: { estudio: 3, taller: 1 } },
      { tipo: "B", descripcion: "Hablan del mercado, los clientes que quieren ganar, los competidores, los precios.",
        pesos: { comercio: 3, fabrica: 1 } },
      { tipo: "C", descripcion: "Hablan de causas, impacto, transformación que generan en sus públicos.",
        pesos: { templo: 3, laboratorio: 1 } },
      { tipo: "D", descripcion: "Hablan de lo que están probando, nuevas ideas, hipótesis, experimentos en marcha.",
        pesos: { laboratorio: 3, estudio: 1 } }
    ]
  },
  {
    numero: 4,
    dimension: "origen_energia",
    titulo: "El momento de orgullo",
    detonante: "Cuéntame el último momento en que sentiste verdadero orgullo de tu empresa. No me cuentes una ganancia económica. Cuéntame el momento — qué pasó, qué viste, qué sentiste.",
    respuestas: [
      { tipo: "A", descripcion: "Un cliente o público transformado. Una historia humana de impacto.",
        pesos: { templo: 3, familia: 1 } },
      { tipo: "B", descripcion: "Un trabajo bien hecho. Una pieza, un producto, un servicio entregado con excelencia técnica.",
        pesos: { taller: 3, estudio: 1 } },
      { tipo: "C", descripcion: "El equipo unido logrando algo difícil juntos. La química humana funcionando.",
        pesos: { familia: 3, templo: 1 } },
      { tipo: "D", descripcion: "Un sistema operando solo. Un proceso fluyendo sin necesidad de su presencia.",
        pesos: { fabrica: 3, laboratorio: 1 } }
    ]
  },
  {
    numero: 5,
    dimension: "origen_energia",
    titulo: "Si tuvieras todo el dinero del mundo",
    detonante: "Si mañana te dijeran que ganaste un premio gigante de dinero y ya no necesitas la empresa por finanzas, ¿qué harías con ella? ¿La vendes, la cierras, la transformas, la mantienes igual?",
    respuestas: [
      { tipo: "A", descripcion: "La mantendría igual o la haría crecer porque la causa sigue vigente. No es por dinero — es por lo que representa.",
        pesos: { templo: 3, familia: 1 } },
      { tipo: "B", descripcion: "La transformaría en un proyecto más experimental, más arriesgado, donde pueda probar cosas nuevas.",
        pesos: { laboratorio: 3, estudio: 1 } },
      { tipo: "C", descripcion: "La vendería o la pondría en piloto automático. El cierre es que funcione sin mí.",
        pesos: { fabrica: 3, comercio: 1 } },
      { tipo: "D", descripcion: "La conservaría porque es donde ejerzo el oficio que amo. Aunque no necesitara el dinero, seguiría haciendo lo que hago.",
        pesos: { taller: 3, estudio: 1 } }
    ]
  },

  // ═══ DIMENSIÓN 2 — VELOCIDAD DE DECISIÓN (4 preguntas) ═══
  {
    numero: 6,
    dimension: "velocidad_decision",
    titulo: "La decisión más reciente",
    detonante: "Cuéntame de la última decisión importante que tomaste en tu empresa. ¿Qué tan rápido la tomaste, con quién la consultaste, y cómo se ejecutó?",
    respuestas: [
      { tipo: "A", descripcion: "Decisión meditada, consultada con varias personas, ejecutada con tiempo. Estructura clara.",
        pesos: { fabrica: 3, templo: 1 } },
      { tipo: "B", descripcion: "Decisión rápida basada en intuición y experiencia del oficio. La ejecutó él mismo.",
        pesos: { taller: 3, familia: 1 } },
      { tipo: "C", descripcion: "Decisión basada en datos de mercado, leyendo señales comerciales.",
        pesos: { comercio: 3, laboratorio: 1 } },
      { tipo: "D", descripcion: "Decisión experimental — probar y ver qué pasa. Aceptó que podía salir mal.",
        pesos: { laboratorio: 3, estudio: 1 } }
    ]
  },
  {
    numero: 7,
    dimension: "velocidad_decision",
    titulo: "El error tolerado",
    detonante: "En tu empresa, cuando alguien comete un error razonable intentando algo nuevo, ¿qué pasa? Cuéntame la última vez que pasó.",
    respuestas: [
      { tipo: "A", descripcion: "Se castiga o se evita repetir. La preferencia es ir a lo seguro.",
        pesos: { fabrica: 3, comercio: 1 } },
      { tipo: "B", descripcion: "Se aprende del error, se conversa, se ajusta. La gente confía en intentar.",
        pesos: { laboratorio: 3, familia: 1 } },
      { tipo: "C", descripcion: "Depende de quién lo cometió. Hay diferencias según jerarquía o cercanía personal.",
        pesos: { familia: 3, templo: 1 } },
      { tipo: "D", descripcion: "El error se asume colectivamente. El equipo lo vive como parte del oficio.",
        pesos: { taller: 3, estudio: 1 } }
    ]
  },
  {
    numero: 8,
    dimension: "velocidad_decision",
    titulo: "Cuando dos opiniones se enfrentan",
    detonante: "Cuando hay dos personas de tu equipo con opiniones opuestas sobre cómo hacer algo importante, ¿cómo se resuelve?",
    respuestas: [
      { tipo: "A", descripcion: "Termina decidiendo el dueño. La autoridad cierra.",
        pesos: { templo: 2, fabrica: 2 } },
      { tipo: "B", descripcion: "Se debate hasta llegar a acuerdo, aunque tarde. La armonía importa.",
        pesos: { familia: 3, templo: 1 } },
      { tipo: "C", descripcion: "Se prueba la idea de cada uno en paralelo y gana la que muestra resultados.",
        pesos: { laboratorio: 3, comercio: 1 } },
      { tipo: "D", descripcion: "Se acude al criterio técnico — quien tiene más oficio en ese tema decide.",
        pesos: { taller: 3, estudio: 1 } }
    ]
  },
  {
    numero: 9,
    dimension: "velocidad_decision",
    titulo: "Tiempo de la decisión cotidiana",
    detonante: "De las decisiones operativas chicas que tu empresa toma todos los días, ¿qué porcentaje se demora más de lo que debería? ¿Por qué?",
    respuestas: [
      { tipo: "A", descripcion: "Pocas se demoran. Hay procesos claros, cada quien sabe qué hacer.",
        pesos: { fabrica: 3, taller: 1 } },
      { tipo: "B", descripcion: "Bastantes se demoran porque me consultan cosas que podrían decidir solos.",
        pesos: { templo: 2, familia: 2 } },
      { tipo: "C", descripcion: "Las decisiones se demoran cuando implican relaciones humanas — siempre se cuida a las personas antes que la velocidad.",
        pesos: { familia: 3, templo: 1 } },
      { tipo: "D", descripcion: "Se demoran cuando hay debate creativo sobre la mejor forma de hacer las cosas.",
        pesos: { estudio: 3, laboratorio: 1 } }
    ]
  },

  // ═══ DIMENSIÓN 3 — APETITO POR LA INCERTIDUMBRE (4 preguntas) ═══
  {
    numero: 10,
    dimension: "apetito_incertidumbre",
    titulo: "La oportunidad incierta",
    detonante: "Te llega una oportunidad de negocio interesante pero el resultado es incierto — podría ser muy buena o salir mal. ¿Qué haces?",
    respuestas: [
      { tipo: "A", descripcion: "Analizo a profundidad, evalúo riesgos. Si no veo claridad, no entro.",
        pesos: { fabrica: 3, templo: 1 } },
      { tipo: "B", descripcion: "Entro porque vale la pena explorar. Confío en que aprenderé algo.",
        pesos: { laboratorio: 3, estudio: 1 } },
      { tipo: "C", descripcion: "Consulto con mi equipo y vemos si se siente bien para todos.",
        pesos: { familia: 3, templo: 1 } },
      { tipo: "D", descripcion: "Si encaja con mi capacidad técnica y me da control del resultado, entro.",
        pesos: { taller: 3, comercio: 1 } }
    ]
  },
  {
    numero: 11,
    dimension: "apetito_incertidumbre",
    titulo: "Lo nuevo en el mercado",
    detonante: "¿Qué tan seguido cambias tu producto, servicio o forma de operar? Cuéntame el último cambio importante que hiciste.",
    respuestas: [
      { tipo: "A", descripcion: "Casi nunca cambio lo que funciona. La consistencia es valor.",
        pesos: { templo: 3, taller: 1 } },
      { tipo: "B", descripcion: "Cambio cuando el mercado lo pide. Sigo señales comerciales.",
        pesos: { comercio: 3, fabrica: 1 } },
      { tipo: "C", descripcion: "Cambio constantemente — siempre estoy probando nuevas variantes.",
        pesos: { laboratorio: 3, estudio: 1 } },
      { tipo: "D", descripcion: "Cambio cuando descubro una forma técnicamente superior de hacerlo.",
        pesos: { taller: 3, estudio: 1 } }
    ]
  },
  {
    numero: 12,
    dimension: "apetito_incertidumbre",
    titulo: "Cuando algo se rompe",
    detonante: "Cuéntame la última crisis seria que tuvo tu empresa. ¿Cómo la enfrentaste?",
    respuestas: [
      { tipo: "A", descripcion: "Volví a los principios, a la causa. Me apoyé en por qué hago esto.",
        pesos: { templo: 3, familia: 1 } },
      { tipo: "B", descripcion: "Junté al equipo y nos sostuvimos juntos. La gente fue la fuerza.",
        pesos: { familia: 3, templo: 1 } },
      { tipo: "C", descripcion: "Apreté procesos, métricas, control. Salí por eficiencia.",
        pesos: { fabrica: 3, comercio: 1 } },
      { tipo: "D", descripcion: "Inventé algo nuevo. La crisis fue oportunidad de pivotar.",
        pesos: { laboratorio: 3, comercio: 1 } }
    ]
  },
  {
    numero: 13,
    dimension: "apetito_incertidumbre",
    titulo: "Lo desconocido del futuro",
    detonante: "¿Qué tan claro tienes hacia dónde va tu industria en los próximos 3-5 años? ¿Cómo te preparas para lo que no sabes?",
    respuestas: [
      { tipo: "A", descripcion: "Tengo claridad y la empresa está alineada a esa visión. Hay plan.",
        pesos: { templo: 3, fabrica: 1 } },
      { tipo: "B", descripcion: "Tengo hipótesis, varias apuestas en paralelo. Veré cuál funciona.",
        pesos: { laboratorio: 3, comercio: 1 } },
      { tipo: "C", descripcion: "Lo que sé es lo que hago bien hoy. Confío en que ese oficio seguirá siendo valioso.",
        pesos: { taller: 3, estudio: 1 } },
      { tipo: "D", descripcion: "Me adapto cuando llega. No me anticipo demasiado.",
        pesos: { familia: 2, comercio: 2 } }
    ]
  },

  // ═══ DIMENSIÓN 4 — VÍNCULO CON LOS PÚBLICOS (5 preguntas) ═══
  {
    numero: 14,
    dimension: "vinculo_publicos",
    titulo: "El cliente ideal",
    detonante: "Cuéntame cómo es tu cliente ideal. Y cuéntame por qué tu empresa es ideal para ese cliente.",
    respuestas: [
      { tipo: "A", descripcion: "Su cliente ideal comparte sus valores. Trabajan juntos por algo en común.",
        pesos: { templo: 3, familia: 1 } },
      { tipo: "B", descripcion: "Su cliente ideal valora la calidad y el detalle. Aprecia el oficio bien hecho.",
        pesos: { taller: 3, estudio: 1 } },
      { tipo: "C", descripcion: "Su cliente ideal paga bien, decide rápido, y entiende lo que vende.",
        pesos: { comercio: 3, fabrica: 1 } },
      { tipo: "D", descripcion: "Su cliente ideal está abierto a probar cosas nuevas con él.",
        pesos: { laboratorio: 3, estudio: 1 } }
    ]
  },
  {
    numero: 15,
    dimension: "vinculo_publicos",
    titulo: "La relación duradera",
    detonante: "¿Tienes un cliente que llevas años atendiendo? Cuéntame por qué sigue contigo.",
    respuestas: [
      { tipo: "A", descripcion: "Sigue porque cree en lo que hacen, en la causa. Hay conexión profunda.",
        pesos: { templo: 3, familia: 1 } },
      { tipo: "B", descripcion: "Sigue porque hay relación personal. Se conocen bien, hay confianza humana.",
        pesos: { familia: 3, templo: 1 } },
      { tipo: "C", descripcion: "Sigue porque le dan un producto/servicio que técnicamente nadie le da igual.",
        pesos: { taller: 3, estudio: 1 } },
      { tipo: "D", descripcion: "Sigue porque siguen siendo competitivos en precio y servicio.",
        pesos: { comercio: 3, fabrica: 1 } }
    ]
  },
  {
    numero: 16,
    dimension: "vinculo_publicos",
    titulo: "El cliente que perdiste",
    detonante: "Cuéntame de un cliente importante que perdiste. ¿Qué pasó, y qué hiciste cuando te enteraste?",
    respuestas: [
      { tipo: "A", descripcion: "Lo vivió como traición. Le dolió personalmente.",
        pesos: { familia: 3, templo: 1 } },
      { tipo: "B", descripcion: "Analizó qué falló en el servicio, ajustó procesos, siguió.",
        pesos: { fabrica: 3, taller: 1 } },
      { tipo: "C", descripcion: "Vio qué cambió en el mercado, ajustó su propuesta.",
        pesos: { comercio: 3, laboratorio: 1 } },
      { tipo: "D", descripcion: "Le preguntó qué falló para aprender, lo conversó con apertura.",
        pesos: { laboratorio: 3, estudio: 1 } }
    ]
  },
  {
    numero: 17,
    dimension: "vinculo_publicos",
    titulo: "El proveedor",
    detonante: "Cuéntame cómo tratas a tus proveedores. ¿Qué tipo de relación tienes con los más importantes?",
    respuestas: [
      { tipo: "A", descripcion: "Los trata como aliados de largo plazo. Hay lealtad mutua.",
        pesos: { familia: 3, templo: 1 } },
      { tipo: "B", descripcion: "Los presiona por precio y velocidad. Es transacción comercial.",
        pesos: { comercio: 3, fabrica: 1 } },
      { tipo: "C", descripcion: "Trabaja con los que tienen el mejor oficio en su ramo, aunque cobren más.",
        pesos: { taller: 3, estudio: 1 } },
      { tipo: "D", descripcion: "Cambia de proveedor cuando descubre mejores opciones.",
        pesos: { laboratorio: 2, comercio: 2 } }
    ]
  },
  {
    numero: 18,
    dimension: "vinculo_publicos",
    titulo: "Lo que dirían los clientes de ti",
    detonante: "Si entrevistara a 5 de tus clientes y les preguntara qué hace especial a tu empresa, ¿qué dirían? No me digas lo que tú quieres que digan — lo que realmente dirían.",
    respuestas: [
      { tipo: "A", descripcion: "Que son coherentes con lo que dicen. Que se siente la causa.",
        pesos: { templo: 3, estudio: 1 } },
      { tipo: "B", descripcion: "Que los quieren, que hay calidez en cómo los tratan.",
        pesos: { familia: 3, templo: 1 } },
      { tipo: "C", descripcion: "Que son confiables — entregan a tiempo, con calidad consistente.",
        pesos: { fabrica: 3, taller: 1 } },
      { tipo: "D", descripcion: "Que son distintos. Que les dan algo que nadie más les da.",
        pesos: { estudio: 3, laboratorio: 1 } }
    ]
  },

  // ═══ DIMENSIÓN 5 — CONSTRUCCIÓN DEL TALENTO (5 preguntas) ═══
  {
    numero: 19,
    dimension: "construccion_talento",
    titulo: "Por qué llega la gente",
    detonante: "Cuando alguien decide trabajar contigo en lugar de la competencia, ¿por qué crees que te elige?",
    respuestas: [
      { tipo: "A", descripcion: "Porque cree en lo que hacen. Hay misión que comparte.",
        pesos: { templo: 3, familia: 1 } },
      { tipo: "B", descripcion: "Porque va a aprender un oficio profundo. Le enseñan.",
        pesos: { taller: 3, estudio: 1 } },
      { tipo: "C", descripcion: "Por el ambiente. La gente. La calidez del lugar.",
        pesos: { familia: 3, templo: 1 } },
      { tipo: "D", descripcion: "Porque van a hacer cosas interesantes. Va a poder probar y crear.",
        pesos: { laboratorio: 3, estudio: 1 } }
    ]
  },
  {
    numero: 20,
    dimension: "construccion_talento",
    titulo: "Cómo crece la gente",
    detonante: "Cuando alguien de tu equipo está listo para crecer profesionalmente, ¿cómo es ese proceso en tu empresa?",
    respuestas: [
      { tipo: "A", descripcion: "Hay plan de desarrollo claro, capacitación estructurada, evaluaciones.",
        pesos: { fabrica: 3, taller: 1 } },
      { tipo: "B", descripcion: "Crece haciendo. Más responsabilidad, aprende sobre la marcha con guía.",
        pesos: { taller: 3, familia: 1 } },
      { tipo: "C", descripcion: "Crece probando proyectos nuevos. Se le da lienzo en blanco.",
        pesos: { laboratorio: 3, estudio: 1 } },
      { tipo: "D", descripcion: "Crece porque le tienen confianza y le abren camino sin proceso formal.",
        pesos: { familia: 3, templo: 1 } }
    ]
  },
  {
    numero: 21,
    dimension: "construccion_talento",
    titulo: "El que se va",
    detonante: "Cuéntame de alguien que se fue de tu empresa y te dolió que se fuera. ¿Por qué se fue?",
    respuestas: [
      { tipo: "A", descripcion: "Se fue porque ya no se sintió alineado con lo que hacen. Diferencias de fondo.",
        pesos: { templo: 3, familia: 1 } },
      { tipo: "B", descripcion: "Se fue por dinero. La competencia le ofreció más.",
        pesos: { comercio: 3, fabrica: 1 } },
      { tipo: "C", descripcion: "Se fue para crecer en un lugar más grande. Le quedaron chicos.",
        pesos: { familia: 2, laboratorio: 2 } },
      { tipo: "D", descripcion: "Se fue por oportunidad personal — familia, salud, mudanza.",
        pesos: { familia: 3, templo: 1 } }
    ]
  },
  {
    numero: 22,
    dimension: "construccion_talento",
    titulo: "La promoción",
    detonante: "La última vez que ascendiste a alguien o le diste más responsabilidad, ¿en qué te basaste para tomar esa decisión?",
    respuestas: [
      { tipo: "A", descripcion: "En su compromiso y lealtad demostrados durante años.",
        pesos: { familia: 3, templo: 1 } },
      { tipo: "B", descripcion: "En su dominio técnico del oficio. Es de los mejores.",
        pesos: { taller: 3, estudio: 1 } },
      { tipo: "C", descripcion: "En métricas objetivas — resultados, productividad, indicadores.",
        pesos: { fabrica: 3, comercio: 1 } },
      { tipo: "D", descripcion: "En su capacidad de proponer cosas nuevas y atreverse.",
        pesos: { laboratorio: 3, estudio: 1 } }
    ]
  },
  {
    numero: 23,
    dimension: "construccion_talento",
    titulo: "Si tu mejor persona se fuera mañana",
    detonante: "Si tu mejor persona se fuera mañana sin avisar, ¿qué pasa con su trabajo?",
    respuestas: [
      { tipo: "A", descripcion: "Se cae. Ese trabajo solo lo sabe hacer ella.",
        pesos: { taller: 3, estudio: 1 } },
      { tipo: "B", descripcion: "Otro lo cubre porque hay procesos documentados. Se siente la pérdida pero la operación sigue.",
        pesos: { fabrica: 3, comercio: 1 } },
      { tipo: "C", descripcion: "El equipo se reorganiza, se sostienen unos a otros mientras se cubre.",
        pesos: { familia: 3, templo: 1 } },
      { tipo: "D", descripcion: "Es oportunidad de reinventar cómo se hacía ese trabajo.",
        pesos: { laboratorio: 3, estudio: 1 } }
    ]
  },

  // ═══ TRANSVERSAL FINAL (5 preguntas extras para llegar a 28) ═══
  {
    numero: 24,
    dimension: "transversal",
    titulo: "La frase de identidad",
    detonante: "Si tuvieras que terminar la frase 'En mi empresa lo que importa es...', ¿cómo la terminarías? Dame la primera respuesta honesta, no la pensada.",
    respuestas: [
      { tipo: "A", descripcion: "'...para qué estamos aquí' / 'lo que representamos'",
        pesos: { templo: 3, estudio: 1 } },
      { tipo: "B", descripcion: "'...quién está con nosotros' / 'la gente'",
        pesos: { familia: 3, templo: 1 } },
      { tipo: "C", descripcion: "'...la firma con la que entregamos' / 'la calidad' / 'el detalle'",
        pesos: { estudio: 2, taller: 2 } },
      { tipo: "D", descripcion: "'...producir más con menos' / 'ser eficientes'",
        pesos: { fabrica: 3, comercio: 1 } }
    ]
  },
  {
    numero: 25,
    dimension: "transversal",
    titulo: "El espacio físico",
    detonante: "Si entrara por primera vez a tus oficinas, ¿qué notaría primero? ¿Qué sentiría el espacio?",
    respuestas: [
      { tipo: "A", descripcion: "Algo simbólico — fotos, frases, elementos que reflejan la causa o historia.",
        pesos: { templo: 3, familia: 1 } },
      { tipo: "B", descripcion: "Calidez humana — la gente se siente cómoda, hay vida cotidiana visible.",
        pesos: { familia: 3, templo: 1 } },
      { tipo: "C", descripcion: "Diseño cuidado, estética intencional. El espacio comunica autoría.",
        pesos: { estudio: 3, taller: 1 } },
      { tipo: "D", descripcion: "Funcionalidad, orden, eficiencia. Cada cosa en su lugar.",
        pesos: { fabrica: 3, taller: 1 } }
    ]
  },
  {
    numero: 26,
    dimension: "transversal",
    titulo: "El ritmo natural",
    detonante: "¿Cómo describirías el ritmo natural de tu empresa? ¿Es rápida, pausada, intermitente, frenética?",
    respuestas: [
      { tipo: "A", descripcion: "Pausada y profunda. Las cosas se hacen con cuidado, no se apura lo importante.",
        pesos: { templo: 3, taller: 1 } },
      { tipo: "B", descripcion: "Intermitente. Hay temporadas calmadas y temporadas de mucha intensidad.",
        pesos: { familia: 2, taller: 2 } },
      { tipo: "C", descripcion: "Rápida y reactiva. Siempre estamos respondiendo al mercado.",
        pesos: { comercio: 3, fabrica: 1 } },
      { tipo: "D", descripcion: "Frenética e impredecible. Siempre estamos probando, cambiando, pivotando.",
        pesos: { laboratorio: 3, estudio: 1 } }
    ]
  },
  {
    numero: 27,
    dimension: "transversal",
    titulo: "Lo que NO eres",
    detonante: "Cuando ves a tu competencia o a otras empresas de tu industria, ¿qué dices 'eso no es lo nuestro, jamás'? ¿Qué rechazas explícitamente?",
    respuestas: [
      { tipo: "A", descripcion: "Rechaza el oportunismo, vender sin causa, traicionar valores por dinero.",
        pesos: { templo: 3, familia: 1 } },
      { tipo: "B", descripcion: "Rechaza la frialdad, el trato impersonal, la rotación alta.",
        pesos: { familia: 3, templo: 1 } },
      { tipo: "C", descripcion: "Rechaza la mediocridad, la calidad pobre, el conformismo técnico.",
        pesos: { taller: 3, estudio: 1 } },
      { tipo: "D", descripcion: "Rechaza la rigidez, la incapacidad de cambiar, el quedarse atrás.",
        pesos: { laboratorio: 3, comercio: 1 } }
    ]
  },
  {
    numero: 28,
    dimension: "transversal",
    titulo: "Tu legado",
    detonante: "Si tu empresa siguiera operando 50 años después de que tú ya no estés, ¿qué te gustaría que la gente dijera de ella?",
    respuestas: [
      { tipo: "A", descripcion: "Que cambió algo en el mundo. Que dejó huella en lo que representó.",
        pesos: { templo: 3, estudio: 1 } },
      { tipo: "B", descripcion: "Que fue un buen lugar para trabajar. Que cuidó a su gente.",
        pesos: { familia: 3, templo: 1 } },
      { tipo: "C", descripcion: "Que hizo cosas excepcionales. Que su trabajo era reconocible y único.",
        pesos: { estudio: 2, taller: 2 } },
      { tipo: "D", descripcion: "Que fue duradera, sólida, próspera. Que supo escalar y mantenerse.",
        pesos: { fabrica: 3, comercio: 1 } }
    ]
  }
];

// Lista de rasgos (7 en total)
export const RASGOS = [
  'templo', 'familia', 'estudio', 'fabrica', 'comercio', 'taller', 'laboratorio'
];

// Etiquetas display de las dimensiones
export const DIMENSIONES = {
  origen_energia: 'Origen de la energía',
  velocidad_decision: 'Velocidad de decisión',
  apetito_incertidumbre: 'Apetito por la incertidumbre',
  vinculo_publicos: 'Vínculo con los públicos',
  construccion_talento: 'Construcción del talento',
  transversal: 'Transversal'
};
