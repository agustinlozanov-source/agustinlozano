// ════════════════════════════════════════════════════════════════════════════
// SCALEx · Catálogo de los 21 Híbridos de Personalidad Empresarial
// ════════════════════════════════════════════════════════════════════════════
// Cada combinación de 2 rasgos dominantes (de los 7) genera un nombre
// identificable + descripción + fortaleza + debilidad + rasgos a explorar.
//
// 7 rasgos → C(7,2) = 21 combinaciones
//
// El sistema toma los 2 rasgos más altos del mix porcentual y devuelve
// la combinación correspondiente. Si los 2 dominantes son por ejemplo
// 'familia' y 'taller', el nombre del híbrido es 'La Casa-Oficio'.
// ════════════════════════════════════════════════════════════════════════════

// Las claves son pares ordenados alfabéticamente: "rasgo1+rasgo2"
// El sistema debe ordenar alfabéticamente los 2 dominantes antes de buscar
export const HIBRIDOS = {
  // ═══ Combinaciones con TEMPLO ═══
  "familia+templo": {
    nombre: "La Tribu con Causa",
    esencia: "Empresa donde la causa une a la tribu. La misión es lo que mantiene unida a la gente y la gente es quien sostiene la misión.",
    fortaleza: "Lealtad inquebrantable. Cero rotación. Los empleados y clientes se vuelven evangelistas naturales.",
    debilidad: "Se vuelve endogámica. Difícil incorporar a alguien externo aunque sea bueno. La crítica honesta se siente como traición a la causa.",
    rasgos_a_explorar: [
      "Subir Laboratorio modesto para abrir a perspectivas externas sin sacrificar cohesión.",
      "Subir Fábrica para profesionalizar procesos clave sin desmembrar el vínculo.",
      "No bajar mucho Familia o Templo — son los que sostienen la identidad."
    ]
  },

  "estudio+templo": {
    nombre: "El Propósito con Firma",
    esencia: "Empresa con causa profunda que se expresa con autoría reconocible. Cada cosa que entrega lleva el sello de su misión y de su sensibilidad estética.",
    fortaleza: "Identidad de marca poderosa. Los clientes la siguen por lo que representa y por cómo lo entrega.",
    debilidad: "Rigidez creativa. 'Así somos' se vuelve excusa para no evolucionar. Costos altos que el mercado no siempre absorbe.",
    rasgos_a_explorar: [
      "Subir Comercio para aterrizar la firma en operación rentable sin diluirla.",
      "Subir Laboratorio para permitir evolución sin perder coherencia.",
      "Dosificar Templo si la causa está bloqueando decisiones comerciales."
    ]
  },

  "fabrica+templo": {
    nombre: "La Misión Organizada",
    esencia: "Empresa con causa profunda traducida en sistema operativo eficiente. La misión se ejecuta a escala porque hay procesos detrás.",
    fortaleza: "Impacto medible. La causa no se queda en discurso — se vuelve operación que sostiene resultados.",
    debilidad: "La causa puede congelarse en proceso. Los rituales reemplazan al sentido. La gente puede sentirse parte de una maquinaria de propósito.",
    rasgos_a_explorar: [
      "Subir Familia para re-humanizar el sistema sin perder eficiencia.",
      "Subir Laboratorio modesto para evitar que los procesos se anquilosen.",
      "Auditar qué procesos sirven a la causa y cuáles solo se mantienen por inercia."
    ]
  },

  "comercio+templo": {
    nombre: "La Causa Sostenible",
    esencia: "Empresa con propósito claro que aprende a venderlo bien. No vende a pesar de su causa — vende gracias a su causa.",
    fortaleza: "Narrativa comercial auténtica. Los clientes pagan premium porque sienten que compran significado, no producto.",
    debilidad: "Tensión interna constante entre 'vendemos esto' y 'esto es lo que defendemos'. Si la balanza se va al comercio, pierde alma.",
    rasgos_a_explorar: [
      "Subir Fábrica para sistematizar cuándo el negocio se subordina a la causa.",
      "Subir Estudio para diferenciar más la propuesta y evitar la commoditización.",
      "Mantener Templo intacto — es lo que sostiene el premium pricing."
    ]
  },

  "laboratorio+templo": {
    nombre: "El Propósito en Movimiento",
    esencia: "Empresa con causa firme que se permite reinventarse para servirla mejor. La misión es fija, los métodos son flexibles.",
    fortaleza: "Relevancia constante. La causa siempre encuentra nueva forma de llegar a sus públicos.",
    debilidad: "Confusión interna. Si la gente no distingue qué es esencia y qué es experimento, se desorienta.",
    rasgos_a_explorar: [
      "Subir Fábrica para declarar explícitamente qué es inamovible (la causa) y qué se experimenta.",
      "Subir Taller para consolidar oficio sobre los experimentos que sí funcionaron.",
      "Subir Familia para sostener emocionalmente al equipo frente al cambio constante."
    ]
  },

  "taller+templo": {
    nombre: "El Oficio con Propósito",
    esencia: "Empresa donde el saber hacer profundo está al servicio de un propósito mayor. La hechura impecable no es un fin — es el medio de honrar la misión.",
    fortaleza: "Combinación rara de calidad técnica y sentido. Genera lealtad de clientes que valoran ambas cosas — los mejores clientes del mundo.",
    debilidad: "Difícil de escalar y difícil de comercializar. Hay resistencia interna a 'vender' porque se siente que devalúa la causa.",
    rasgos_a_explorar: [
      "Subir Comercio para profesionalizar la dimensión comercial sin traicionar el oficio.",
      "Subir Fábrica para sistematizar la transmisión del oficio a nuevas generaciones.",
      "No bajar Templo ni Taller — son la combinación distintiva."
    ]
  },

  // ═══ Combinaciones con FAMILIA (sin templo, ya está arriba) ═══
  "estudio+familia": {
    nombre: "La Casa Creativa",
    esencia: "Empresa donde el vínculo entre las personas alimenta la creatividad. Se crea bien porque hay confianza humana de fondo.",
    fortaleza: "Trabajo creativo de alta calidad sostenido por equipos estables. La cultura emocional protege la chispa creativa.",
    debilidad: "Los favoritismos sabotean el mérito creativo. La crítica honesta se evita por miedo a herir relaciones. Talento nuevo le cuesta entrar.",
    rasgos_a_explorar: [
      "Subir Fábrica para abrir canales formales de crítica creativa.",
      "Subir Laboratorio para empujar al equipo a probar más allá de la zona de confort.",
      "Subir Comercio para que la creatividad encuentre mercado más amplio."
    ]
  },

  "fabrica+familia": {
    nombre: "El Sistema Cercano",
    esencia: "Empresa con procesos sólidos sostenidos por vínculos humanos auténticos. La eficiencia no anula la calidez.",
    fortaleza: "Retención brutal. La gente da más de lo esperado. Sistemas robustos con baja rotación.",
    debilidad: "Dificultad para promover por mérito puro. Los procesos se relajan por excepciones personales. Crece el riesgo de mediocridad cómoda.",
    rasgos_a_explorar: [
      "Subir Comercio para introducir criterios objetivos de desempeño.",
      "Subir Estudio para elevar el estándar creativo sin enfriar la cultura.",
      "Mantener Familia — es lo que sostiene la retención."
    ]
  },

  "comercio+familia": {
    nombre: "El Negocio de Confianza",
    esencia: "Empresa comercial donde la relación humana es el activo principal. Los clientes son personas, no transacciones.",
    fortaleza: "Cartera de clientes leales construida en años. Recompra natural. Recomendaciones constantes.",
    debilidad: "Dependencia extrema de pocas relaciones. Si se va el vendedor estrella, se va el cliente. Difícil escalar.",
    rasgos_a_explorar: [
      "Subir Fábrica para convertir relaciones individuales en activos de la empresa.",
      "Subir Estudio para construir propuesta de valor que vaya más allá del vínculo personal.",
      "Subir Laboratorio para explorar canales nuevos de cliente."
    ]
  },

  "familia+taller": {
    nombre: "La Casa-Oficio",
    esencia: "Empresa donde la tribu se forjó alrededor de un saber hacer profundo. El oficio se enseña en familia, se aprende en años.",
    fortaleza: "Maestría técnica preservada generacionalmente. Conocimiento profundo que la competencia no puede replicar.",
    debilidad: "Todo el conocimiento vive en pocas cabezas vinculadas por vínculo personal. Si esos vínculos se rompen, se rompe el oficio.",
    rasgos_a_explorar: [
      "Subir Fábrica para documentar el oficio sin matarlo.",
      "Subir Comercio para que el oficio encuentre mercado más amplio.",
      "Subir Estudio para refinar la firma del oficio."
    ]
  },

  "familia+laboratorio": {
    nombre: "El Equipo Inquieto",
    esencia: "Empresa donde la gente unida prueba cosas juntas. La confianza humana hace posible el riesgo creativo colectivo.",
    fortaleza: "Capacidad de pivotar sin fracturas internas. Cuando una idea falla, el equipo no se desmorona — sigue.",
    debilidad: "La cohesión se confunde con consenso. Las apuestas se toman para que todos estén cómodos, no para ganar.",
    rasgos_a_explorar: [
      "Subir Comercio para introducir criterios objetivos de qué se mantiene y qué se mata.",
      "Subir Fábrica para disciplinar las apuestas con datos.",
      "Subir Estudio para que las apuestas tengan firma reconocible."
    ]
  },

  // ═══ Combinaciones con ESTUDIO (sin templo ni familia) ═══
  "estudio+fabrica": {
    nombre: "La Producción con Firma",
    esencia: "Empresa que produce a escala sin perder identidad de autor. Cada unidad lleva el sello creativo, aunque se fabriquen miles.",
    fortaleza: "Marca con personalidad reconocible que llega a muchos. Diferenciación sostenida en volumen.",
    debilidad: "Tensión constante entre el creador y el sistema. Si gana el sistema, se pierde la firma.",
    rasgos_a_explorar: [
      "Subir Templo para proteger la firma del sistema con un norte claro.",
      "Subir Familia para humanizar la maquinaria.",
      "Subir Laboratorio modesto para evitar que la firma se estanque."
    ]
  },

  "comercio+estudio": {
    nombre: "El Autor Comercial",
    esencia: "Empresa con sensibilidad creativa que sabe leer el mercado. Crea con firma pero también vende bien.",
    fortaleza: "Producto distinto que además se mueve. No es arte que nadie compra ni commodity sin alma.",
    debilidad: "El mercado puede empujar a diluir la firma. Si se cede demasiado al cliente, se pierde la autoría.",
    rasgos_a_explorar: [
      "Subir Templo para anclar la firma a una causa que el mercado no pueda diluir.",
      "Subir Taller para profundizar la maestría técnica que sostiene la firma.",
      "Subir Laboratorio para innovar antes que la firma se vuelva fórmula."
    ]
  },

  "estudio+taller": {
    nombre: "El Estudio de Oficio",
    esencia: "Empresa donde el oficio profundo se hace con firma reconocible. Cada pieza es técnica y artística a la vez.",
    fortaleza: "Trabajo inigualable en calidad y diferenciación. Los clientes pagan premium y vuelven por la firma.",
    debilidad: "Brutalmente difícil de escalar. Todo depende de pocas personas insustituibles. Los egos artísticos chocan.",
    rasgos_a_explorar: [
      "Subir Familia para sostener egos con vínculo humano.",
      "Subir Fábrica para sistematizar lo replicable del oficio.",
      "Subir Comercio para que el oficio encuentre el mercado correcto a su altura."
    ]
  },

  "estudio+laboratorio": {
    nombre: "El Estudio Inquieto",
    esencia: "Empresa creativa que nunca deja de experimentar. La firma evoluciona porque se atreve a cambiarla cada cierto tiempo.",
    fortaleza: "Capacidad de mantenerse fresca por años. Mientras otros se vuelven anticuados, esta empresa se reinventa con coherencia.",
    debilidad: "Los clientes pueden perder la referencia. Crisis de identidad recurrente.",
    rasgos_a_explorar: [
      "Subir Templo para anclar lo que NO cambia, aunque todo lo demás evolucione.",
      "Subir Comercio para validar las evoluciones con el mercado antes que con el ego.",
      "Subir Familia para sostener al equipo en los pivotes."
    ]
  },

  // ═══ Combinaciones con FÁBRICA (sin las anteriores) ═══
  "comercio+fabrica": {
    nombre: "El Sistema Productivo",
    esencia: "Empresa optimizada para producir y vender. Los procesos son tan eficientes como las señales de mercado son leídas.",
    fortaleza: "Crecimiento sólido y predecible. Ningún competidor le gana en costo-velocidad.",
    debilidad: "Pierde alma en el camino. La gente se vuelve recurso. La cultura se enfría. Difícil retener talento de oficio profundo o creativo.",
    rasgos_a_explorar: [
      "Subir Familia para re-introducir capas humanas al sistema.",
      "Subir Templo para conectar la maquinaria con un propósito que la gente sienta.",
      "Subir Estudio para diferenciar la producción de la commoditización."
    ]
  },

  "fabrica+taller": {
    nombre: "El Oficio Escalado",
    esencia: "Empresa que escaló un saber hacer profundo sin perderlo del todo. Hay sistema, pero también queda hechura.",
    fortaleza: "Ofrece calidad técnica a volúmenes que el taller puro no puede. Transición entre artesano y manufactura inteligente.",
    debilidad: "La calidad se diluye gradualmente. Los maestros viejos se quejan. Los procesos ganan pero el oficio sufre.",
    rasgos_a_explorar: [
      "Subir Estudio para refinar lo que la escala diluye.",
      "Subir Templo para proteger el estándar del oficio como causa.",
      "Subir Familia para sostener a los maestros y a los nuevos."
    ]
  },

  "fabrica+laboratorio": {
    nombre: "El Sistema en Iteración",
    esencia: "Empresa con procesos sólidos que se atreven a mejorarse a sí mismos. Eficiencia presente y eficiencia futura conviven.",
    fortaleza: "Capacidad de mejora continua estructurada. No se queda obsoleta porque el sistema mismo se actualiza.",
    debilidad: "Cambiar lo que funciona puede dañar lo que funciona. Si se experimenta demasiado, se pierde la confiabilidad.",
    rasgos_a_explorar: [
      "Subir Templo para definir qué procesos son sagrados y cuáles se tocan.",
      "Subir Familia para sostener al equipo entre cambios.",
      "Subir Estudio para que las iteraciones tengan firma, no solo eficiencia."
    ]
  },

  // ═══ Combinaciones con COMERCIO (sin las anteriores) ═══
  "comercio+taller": {
    nombre: "El Oficio en el Mercado",
    esencia: "Empresa con dominio técnico profundo que sabe venderlo. La calidad existe, y el mercado se entera.",
    fortaleza: "Premium pricing sostenido. Los clientes reconocen el oficio y pagan por él porque la empresa sabe articularlo.",
    debilidad: "El comercial empuja a hacer más de lo que el taller puede sostener con calidad. Cuello de botella en producción.",
    rasgos_a_explorar: [
      "Subir Fábrica para alinear capacidad comercial con capacidad técnica.",
      "Subir Templo para anclar el oficio a una causa que evite la sobreventa.",
      "Subir Familia para sostener a los maestros que sostienen el oficio."
    ]
  },

  "comercio+laboratorio": {
    nombre: "El Explorador Comercial",
    esencia: "Empresa que experimenta con disciplina comercial. Prueba rápido, mide rápido, mata rápido lo que no funciona.",
    fortaleza: "Velocidad de innovación que la competencia no puede igualar. Encuentra océanos azules antes que nadie.",
    debilidad: "Dispersión crónica. Demasiadas apuestas abiertas. Difícil construir identidad estable.",
    rasgos_a_explorar: [
      "Subir Templo para construir identidad estable bajo la experimentación.",
      "Subir Estudio para que las apuestas tengan firma reconocible.",
      "Subir Familia para sostener al equipo en el cambio constante."
    ]
  },

  // ═══ Combinaciones con TALLER + LABORATORIO ═══
  "laboratorio+taller": {
    nombre: "El Taller Experimental",
    esencia: "Empresa de oficio profundo que se atreve a empujar los límites técnicos. Maestría con espíritu de descubrimiento.",
    fortaleza: "Innovación técnica genuina. La empresa avanza el estado del arte de su industria.",
    debilidad: "Riesgo de perder el oficio establecido por perseguir el nuevo. Tensión entre 'lo que dominamos' y 'lo que estamos probando'.",
    rasgos_a_explorar: [
      "Subir Templo para definir qué del oficio es no-negociable.",
      "Subir Comercio para que la innovación encuentre mercado.",
      "Subir Familia para sostener a los maestros que cambian de método."
    ]
  }
};

/**
 * Función helper: obtiene el híbrido dado el mix porcentual de rasgos
 * @param {object} mix - {templo: 38, familia: 22, ...}
 * @returns {object} el híbrido + los dos rasgos dominantes
 */
export function obtenerHibrido(mix) {
  // Ordenar rasgos por porcentaje descendente
  const ordenados = Object.entries(mix)
    .sort((a, b) => b[1] - a[1])
    .map(([rasgo]) => rasgo);

  const top2 = ordenados.slice(0, 2);
  // Ordenar alfabéticamente para hacer la clave
  const clave = top2.slice().sort().join('+');

  return {
    rasgos_dominantes: top2,
    clave,
    hibrido: HIBRIDOS[clave] || null
  };
}
