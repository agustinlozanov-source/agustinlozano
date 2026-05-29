// ════════════════════════════════════════════════════════════════════════════
// SCALEx · Catálogo del Diagnóstico Financiero (PRISMA del Flujo)
// ════════════════════════════════════════════════════════════════════════════
// Contiene:
//   1. VARIABLES — las 8 variables con sus componentes guiados
//   2. UMBRALES — criterios de evaluación de cada índice
//   3. MATRICES — descripciones de los cuadrantes de las 3 matrices
//   4. VEREDICTOS — textos descriptivos del veredicto global
//   5. AGENDAS — templates de 7/30/90 por veredicto
// ════════════════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════════════════
// 1. LAS 8 VARIABLES DEL DIAGNÓSTICO
// ════════════════════════════════════════════════════════════════════════════
// Cada variable se captura con goteo: una a la vez, con explicación,
// componentes y cálculo automático.
// ════════════════════════════════════════════════════════════════════════════

export const VARIABLES_DIAGNOSTICO = [
  // ── Variable 1 — FCN ──
  {
    numero: 1,
    codigo: "fcn",
    nombre: "Flujo de Caja Neto",
    abreviacion: "FCN",
    descripcion: "El dinero líquido disponible HOY para operar.",
    explicacion: "No es lo que vas a facturar este mes ni lo que tienes por cobrar. Es lo que está disponible en este momento en tus cuentas y caja.",
    tipo: "simple",
    componentes: [
      {
        codigo: "fcn",
        label: "Dinero disponible hoy",
        ayuda: "Suma todo el efectivo que tienes en bancos + caja chica. No cuentes cheques pendientes de cobro ni cuentas por cobrar — solo lo que YA puedes usar para pagar algo hoy mismo.",
        tipo_input: "moneda",
        ejemplos: ["Saldo en bancos: $50,000", "Caja chica: $5,000", "Total FCN: $55,000"]
      }
    ],
    formula: null,
    formula_display: null
  },

  // ── Variable 2 — IM ──
  {
    numero: 2,
    codigo: "im",
    nombre: "Ingresos Mensuales",
    abreviacion: "IM",
    descripcion: "Lo que tu empresa factura en un mes típico.",
    explicacion: "Si tus ingresos varían mucho mes a mes, usa el promedio de los últimos 3 meses.",
    tipo: "simple",
    componentes: [
      {
        codigo: "im",
        label: "Ingresos mensuales (promedio)",
        ayuda: "Toma tu facturación total. Si tienes meses muy distintos, saca el promedio de los últimos 3 meses para tener un dato realista.",
        tipo_input: "moneda",
        ejemplos: ["Mes 1: $180,000", "Mes 2: $220,000", "Mes 3: $200,000", "Promedio: $200,000"]
      }
    ],
    formula: null,
    formula_display: null
  },

  // ── Variable 3 — MUN ──
  {
    numero: 3,
    codigo: "mun",
    nombre: "Margen de Utilidad Neto",
    abreviacion: "MUN",
    descripcion: "De cada $100 que vendes, cuánto queda como ganancia REAL.",
    explicacion: "Esto NO es margen bruto (ventas menos costo de producto). Es el margen FINAL después de pagar TODO: insumos, sueldos, renta, servicios, impuestos. Todo.",
    tipo: "compuesta",
    componentes: [
      {
        codigo: "mun_ingresos_mes",
        label: "Ingresos totales del último mes",
        ayuda: "Lo que realmente facturaste el mes pasado.",
        tipo_input: "moneda"
      },
      {
        codigo: "mun_utilidad_neta",
        label: "Utilidad neta del último mes",
        ayuda: "Lo que quedó después de pagar TODOS los gastos del mes: insumos, sueldos, renta, servicios, impuestos. Si terminaste con $20,000 más en banco después de pagar todo, esa es tu utilidad neta.",
        tipo_input: "moneda"
      }
    ],
    formula: "(mun_utilidad_neta / mun_ingresos_mes) * 100",
    formula_display: "MUN = (Utilidad Neta / Ingresos) × 100"
  },

  // ── Variable 4 — GFM ──
  {
    numero: 4,
    codigo: "gfm",
    nombre: "Gastos Fijos Mensuales",
    abreviacion: "GFM",
    descripcion: "Lo que tienes que pagar cada mes aunque no vendas nada.",
    explicacion: "Son los gastos que NO dependen de las ventas. Renta, sueldos base, servicios, suscripciones, créditos. Vamos a listarlos uno por uno.",
    tipo: "lista_componentes",
    componentes: [
      // Esta variable se captura como lista editable
      // El usuario agrega filas con label + monto
    ],
    componentes_sugeridos: [
      { label: "Renta del local", placeholder: "Ej: 25,000" },
      { label: "Sueldos base del equipo", placeholder: "Ej: 80,000" },
      { label: "Servicios (luz, agua, internet, teléfono)", placeholder: "Ej: 5,000" },
      { label: "Pago de créditos / arrendamientos", placeholder: "Ej: 10,000" },
      { label: "Suscripciones (software, plataformas)", placeholder: "Ej: 3,000" },
      { label: "Otros gastos fijos", placeholder: "Ej: 2,000" }
    ],
    formula: "suma de montos",
    formula_display: "GFM = suma de todos los gastos fijos"
  },

  // ── Variable 5 — CCE ──
  {
    numero: 5,
    codigo: "cce",
    nombre: "Ciclo de Conversión de Efectivo",
    abreviacion: "CCE",
    descripcion: "Cuántos días pasan entre que sale dinero y entra dinero.",
    explicacion: "Es el dato más poderoso del diagnóstico pero el menos intuitivo. Mide cuánto tiempo tu dinero está 'fuera de caja' entre que pagas un insumo y cobras al cliente final. Vamos a calcularlo paso a paso.",
    tipo: "compuesta_condicional",
    pregunta_detonante: {
      pregunta: "¿Tu empresa vende productos físicos o servicios?",
      opciones: [
        { codigo: "productos", label: "Productos físicos (tengo inventario de algún tipo)" },
        { codigo: "servicios", label: "Servicios puros (no hay inventario tangible)" },
        { codigo: "mixto", label: "Mixto (vendo ambos)" }
      ]
    },
    componentes: [
      {
        codigo: "cce_dias_inventario",
        label: "Días de inventario",
        ayuda: "En promedio, ¿cuántos días tienes un producto/insumo en bodega desde que lo compras hasta que se vende o se usa?",
        tipo_input: "dias",
        solo_si: ["productos", "mixto"],
        ejemplos: [
          "Restaurante: 3-7 días",
          "Comercio de ropa: 60-180 días",
          "Manufactura: 30-90 días"
        ],
        ayuda_calculo: "Si no lo sabes: toma el valor de tu último inventario y divídelo entre tus ventas mensuales × 30."
      },
      {
        codigo: "cce_dias_cobro",
        label: "Días de cobro",
        ayuda: "Cuando vendes algo, ¿cuántos días pasan en promedio hasta que el dinero llega a tu cuenta?",
        tipo_input: "dias",
        ejemplos: [
          "Cobro de contado / tarjeta: 1-3 días",
          "Crédito a 15 días: 15-30 días",
          "Crédito a 30 días: 30-60 días",
          "Servicios a empresas grandes: 60-90 días"
        ],
        ayuda_calculo: "Si no lo sabes: toma tus cuentas por cobrar de hoy y divide entre ventas mensuales × 30."
      },
      {
        codigo: "cce_dias_pago",
        label: "Días de pago",
        ayuda: "Cuando compras un insumo o servicio, ¿cuántos días pasan en promedio antes de que tengas que pagarle al proveedor?",
        tipo_input: "dias",
        ejemplos: [
          "Pago de contado: 0 días",
          "Crédito 15 días con proveedor: 15 días",
          "Crédito 30 días: 30 días"
        ],
        ayuda_calculo: "Si no lo sabes: toma tus cuentas por pagar de hoy y divide entre compras mensuales × 30."
      }
    ],
    formula_display: "Productos/Mixto: CCE = Inventario + Cobro − Pago    |    Servicios: CCE = Cobro − Pago",
    interpretacion_resultado: "Tu negocio tarda {cce} días en convertir dinero invertido en dinero recuperado. Necesitas tener al menos {cce/30:.1f} meses de operación financiados en caja para no asfixiarte."
  },

  // ── Variable 6 — PT ──
  {
    numero: 6,
    codigo: "pt",
    nombre: "Pasivos Totales",
    abreviacion: "PT",
    descripcion: "Todo lo que la empresa debe hoy.",
    explicacion: "Suma todas las deudas, créditos, préstamos y cuentas por pagar que la empresa tiene en este momento. Vamos a listarlas.",
    tipo: "lista_componentes",
    componentes: [],
    componentes_sugeridos: [
      { label: "Créditos bancarios", placeholder: "Ej: 200,000" },
      { label: "Préstamos de socios o familiares", placeholder: "Ej: 100,000" },
      { label: "Cuentas por pagar a proveedores", placeholder: "Ej: 80,000" },
      { label: "Arrendamientos pendientes", placeholder: "Ej: 50,000" },
      { label: "Impuestos por pagar", placeholder: "Ej: 30,000" },
      { label: "Otros pasivos", placeholder: "Ej: 20,000" }
    ],
    formula: "suma de montos",
    formula_display: "PT = suma de todas las deudas y obligaciones"
  },

  // ── Variable 7 — CI ──
  {
    numero: 7,
    codigo: "ci",
    nombre: "Crecimiento de Ingresos",
    abreviacion: "CI",
    descripcion: "Qué tanto crecieron tus ventas vs el año pasado.",
    explicacion: "Compara este año con el año pasado. Si vendiste $1M y ahora vendes $1.2M, tu CI es 20%.",
    tipo: "compuesta",
    componentes: [
      {
        codigo: "ci_ingresos_anterior",
        label: "Ingresos del año pasado",
        ayuda: "Facturación total del año anterior (12 meses).",
        tipo_input: "moneda"
      },
      {
        codigo: "ci_ingresos_actual",
        label: "Ingresos del año actual (proyectado o real)",
        ayuda: "Si el año actual aún no termina, proyecta cuánto vas a facturar al cierre.",
        tipo_input: "moneda"
      }
    ],
    formula: "((ci_ingresos_actual / ci_ingresos_anterior) - 1) * 100",
    formula_display: "CI = ((Año Actual / Año Anterior) − 1) × 100"
  },

  // ── Variable 8 — CC ──
  {
    numero: 8,
    codigo: "cc",
    nombre: "Crecimiento de Costos",
    abreviacion: "CC",
    descripcion: "Qué tanto crecieron tus costos vs el año pasado.",
    explicacion: "Mismo cálculo que CI pero con costos. Si tus costos totales el año pasado fueron $700K y este año van a ser $850K, tu CC es 21%.",
    tipo: "compuesta",
    componentes: [
      {
        codigo: "cc_costos_anterior",
        label: "Costos totales del año pasado",
        ayuda: "Suma de TODOS los gastos del año anterior (insumos + sueldos + renta + servicios + todo).",
        tipo_input: "moneda"
      },
      {
        codigo: "cc_costos_actual",
        label: "Costos totales del año actual (proyectado o real)",
        ayuda: "Si el año aún no termina, proyecta los costos al cierre.",
        tipo_input: "moneda"
      }
    ],
    formula: "((cc_costos_actual / cc_costos_anterior) - 1) * 100",
    formula_display: "CC = ((Año Actual / Año Anterior) − 1) × 100"
  }
];


// ════════════════════════════════════════════════════════════════════════════
// 2. UMBRALES DE LOS 3 ÍNDICES
// ════════════════════════════════════════════════════════════════════════════

export const UMBRALES_INDICES = {
  iaf: {
    nombre: "Índice de Autonomía Financiera",
    apodo: "El Tanque de Gasolina",
    formula_display: "IAF = (FCN × MUN%) / GFM",
    rangos: [
      { min: 1, max: null, label: "Sano", color: "verde", interpretacion: "Tu empresa puede operar sin problemas financieros." },
      { min: 0.5, max: 1, label: "Optimizar", color: "ambar", interpretacion: "Necesitas optimizar costos o mejorar flujo de efectivo." },
      { min: null, max: 0.5, label: "Riesgo Alto", color: "rojo", interpretacion: "Riesgo financiero alto. Requiere acción inmediata." }
    ]
  },
  iafi: {
    nombre: "Índice de Agilidad Financiera",
    apodo: "La Carrera del Dinero",
    formula_display: "IAFi = CCE / (PT / IM)",
    rangos: [
      { min: null, max: 30, label: "Ágil", color: "verde", interpretacion: "Conviertes dinero rápido y tienes deuda controlada." },
      { min: 30, max: 60, label: "En Riesgo", color: "ambar", interpretacion: "La deuda puede volverse insostenible. Vigilar." },
      { min: 60, max: null, label: "Crítico", color: "rojo", interpretacion: "Alto riesgo. Reducir plazos de cobro y nivel de deuda." }
    ]
  },
  ie: {
    nombre: "Índice de Escalabilidad",
    apodo: "El Globo de la Rentabilidad",
    formula_display: "IE = (1 + CI%) / (1 + CC%)",
    rangos: [
      { min: 1.5, max: null, label: "Escalable", color: "verde", interpretacion: "Crecimiento sostenible. El negocio puede escalar." },
      { min: 1, max: 1.5, label: "Cuidado", color: "ambar", interpretacion: "Riesgo de que los costos se descontrolen." },
      { min: null, max: 1, label: "Insostenible", color: "rojo", interpretacion: "Crecimiento insostenible. Los costos consumen las ganancias." }
    ]
  }
};


// ════════════════════════════════════════════════════════════════════════════
// 3. LAS 3 MATRICES DIAGNÓSTICAS
// ════════════════════════════════════════════════════════════════════════════

export const MATRICES = {
  matriz1: {
    nombre: "Liquidez vs Margen",
    apodo: "¿Tienes dinero Y ganas dinero?",
    eje_x: { label: "Flujo de Caja", min: "Bajo", max: "Alto" },
    eje_y: { label: "Margen de Utilidad", min: "Bajo", max: "Alto" },
    cuadrantes: {
      sano: {
        nombre: "Negocio Sano",
        color: "verde",
        descripcion: "Empresa rentable y con dinero disponible. Puede crecer estratégicamente.",
        accion: "Mantener control financiero y optimizar inversión."
      },
      liquidez: {
        nombre: "Problema de Liquidez",
        color: "ambar",
        descripcion: "Gana bien, pero el dinero entra tarde. Puede sufrir para pagar gastos fijos.",
        accion: "Optimizar cobros y mejorar flujo de efectivo."
      },
      riesgo: {
        nombre: "Negocio en Riesgo",
        color: "ambar",
        descripcion: "Tiene dinero, pero los márgenes son bajos. No es sostenible a largo plazo si los costos suben.",
        accion: "Aumentar precios o reducir costos."
      },
      crisis: {
        nombre: "Negocio en Crisis",
        color: "rojo",
        descripcion: "No hay liquidez ni rentabilidad. Riesgo alto de quiebra.",
        accion: "Urgente: reestructuración de costos y modelo de negocio."
      }
    }
  },
  matriz2: {
    nombre: "CCE vs Endeudamiento",
    apodo: "¿Qué tan rápido entra el dinero vs cuánto debes?",
    eje_x: { label: "Endeudamiento", min: "Bajo", max: "Alto" },
    eje_y: { label: "CCE", min: "Rápido", max: "Lento" },
    cuadrantes: {
      crecimiento_saludable: {
        nombre: "Crecimiento Saludable",
        color: "verde",
        descripcion: "Empresa bien administrada. Puede escalar con bajo riesgo.",
        accion: "Mantener disciplina financiera."
      },
      riesgo_financiero: {
        nombre: "Riesgo Financiero",
        color: "ambar",
        descripcion: "Gana dinero rápido, pero debe demasiado. Puede caer en crisis si no reduce su deuda.",
        accion: "Priorizar pago de deudas antes de crecer."
      },
      riesgo_liquidez: {
        nombre: "Riesgo de Liquidez",
        color: "ambar",
        descripcion: "No tiene deuda, pero el dinero entra lento. Puede tener problemas para pagar gastos fijos.",
        accion: "Mejorar políticas de cobro y reducir tiempos de conversión."
      },
      peligro_colapso: {
        nombre: "Peligro de Colapso",
        color: "rojo",
        descripcion: "Gasta demasiado y el dinero entra muy lento. Altísimo riesgo de insolvencia.",
        accion: "Renegociar deudas y reducir costos urgentes."
      }
    }
  },
  matriz3: {
    nombre: "Crecimiento Ingresos vs Costos",
    apodo: "¿Escalas o solo creces más caro?",
    eje_x: { label: "Crecimiento de Ingresos", min: "Bajo", max: "Alto" },
    eje_y: { label: "Crecimiento de Costos", min: "Bajo", max: "Alto" },
    cuadrantes: {
      escalabilidad_positiva: {
        nombre: "Escalabilidad Positiva",
        color: "verde",
        descripcion: "Crece rápido sin aumentar demasiado los costos. Empresa lista para expandirse.",
        accion: "Mantener control de costos y seguir escalando."
      },
      crecimiento_deficiente: {
        nombre: "Crecimiento Deficiente",
        color: "ambar",
        descripcion: "Vende más, pero también gasta más. Si los costos siguen subiendo, perderá rentabilidad.",
        accion: "Hacer ajustes en costos antes de seguir expandiéndose."
      },
      crecimiento_insostenible: {
        nombre: "Crecimiento Insostenible",
        color: "ambar",
        descripcion: "Mantiene costos bajos, pero no crece en ventas. Se queda estancado sin posibilidades de expansión.",
        accion: "Invertir en estrategias de ventas antes de escalar."
      },
      recesion: {
        nombre: "Negocio en Recesión",
        color: "rojo",
        descripcion: "Gasta más de lo que vende. Pérdidas recurrentes y riesgo de colapso.",
        accion: "Recortar costos y redefinir estrategia de negocio."
      }
    }
  }
};


// ════════════════════════════════════════════════════════════════════════════
// 4. VEREDICTOS GLOBALES
// ════════════════════════════════════════════════════════════════════════════

export const VEREDICTOS = {
  sano: {
    nombre: "Negocio Sano",
    color: "verde",
    icono: "check-circle",
    titulo: "Tu empresa está financieramente sana.",
    descripcion: "Las 3 dimensiones críticas (liquidez, conversión de efectivo, crecimiento eficiente) están en zona segura. Esto te da margen para invertir, escalar y planear el futuro.",
    siguiente_paso: "Aprovecha este momento para construir reservas, planear inversiones estratégicas y profundizar tus rectores institucionales."
  },
  estresado: {
    nombre: "Negocio Estresado",
    color: "ambar",
    icono: "alert-triangle",
    titulo: "Tu empresa muestra señales de tensión financiera.",
    descripcion: "Una o más dimensiones están en zona de alerta. Todavía no es crisis, pero es el momento ideal para actuar — antes de que se complique.",
    siguiente_paso: "Identifica la dimensión más débil y enfócate ahí. Una decisión a tiempo evita una crisis después."
  },
  en_coma: {
    nombre: "Negocio en Coma",
    color: "rojo",
    icono: "alert-octagon",
    titulo: "Tu empresa está en riesgo financiero crítico.",
    descripcion: "Una o más dimensiones están en zona roja. La situación requiere acción inmediata para evitar consecuencias graves.",
    siguiente_paso: "No retrases la acción. La buena noticia: el diagnóstico ya está claro. Ahora es momento de ejecutar."
  }
};


// ════════════════════════════════════════════════════════════════════════════
// 5. AGENDAS 7/30/90 POR VEREDICTO
// ════════════════════════════════════════════════════════════════════════════

export const AGENDAS_DIAGNOSTICO = {
  sano: {
    "7_dias": "Analiza dónde tienes más excedente y define qué porcentaje vas a reservar para fondo de emergencia, qué porcentaje para reinvertir y qué porcentaje para nuevas inversiones.",
    "30_dias": "Identifica 2-3 oportunidades estratégicas que requieran capital (nueva línea de negocio, expansión, tecnología, talento) y elige UNA para profundizar.",
    "90_dias": "Construye un plan de inversión a 12 meses con la oportunidad elegida. Conecta este plan con tu Vector (estrategia) para que la inversión soporte el crecimiento estratégico."
  },
  estresado: {
    "7_dias": "Identifica cuál de las 3 dimensiones está más débil (liquidez, CCE+deuda, crecimiento). Lista las 3-5 fugas concretas que estén causando el estrés en esa dimensión.",
    "30_dias": "Diseña un plan de ajuste sobre la dimensión más débil. Acciones específicas: renegociar plazos con proveedores, gestionar cobranzas, recortar gastos no esenciales, ajustar precios. Implementa al menos 2 de esas acciones.",
    "90_dias": "Mide el impacto del plan. Recalcula el diagnóstico al final del trimestre. La meta es mover al menos una dimensión de ámbar a verde sin sacrificar las otras."
  },
  en_coma: {
    "7_dias": "Convoca a tu equipo financiero (tú + contador + consultor) y lista TODOS los compromisos por pagar de los próximos 60 días vs. el flujo esperado. Identifica el déficit exacto.",
    "30_dias": "Ejecuta acciones de rescate inmediato: renegociar TODOS los pagos diferibles, gestionar cobranzas vencidas con disciplina, eliminar gastos no esenciales, pedir anticipos a clientes importantes. Comunica con honestidad al equipo.",
    "90_dias": "Evalúa la salud financiera al cierre del trimestre. Si las acciones funcionaron, planea cómo reconstruir reservas. Si no, considera reestructuración estructural del modelo de negocio."
  }
};


// ════════════════════════════════════════════════════════════════════════════
// 6. HELPERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Calcula el MUN dado los componentes
 */
export function calcularMUN(ingresos, utilidadNeta) {
  if (!ingresos || ingresos <= 0) return null;
  return (utilidadNeta / ingresos) * 100;
}

/**
 * Calcula el CCE dado los componentes y tipo de empresa
 */
export function calcularCCE(diasInventario, diasCobro, diasPago, tipoEmpresa) {
  if (diasCobro == null || diasPago == null) return null;
  if (tipoEmpresa === "servicios") {
    return diasCobro - diasPago;
  }
  // productos o mixto
  if (diasInventario == null) return null;
  return diasInventario + diasCobro - diasPago;
}

/**
 * Calcula CI o CC dado año anterior y actual
 */
export function calcularCrecimiento(anterior, actual) {
  if (!anterior || anterior <= 0) return null;
  return ((actual / anterior) - 1) * 100;
}

/**
 * Suma componentes de GFM o PT
 */
export function sumarComponentes(componentes) {
  if (!Array.isArray(componentes)) return 0;
  return componentes.reduce((acc, c) => acc + (parseFloat(c.monto) || 0), 0);
}

/**
 * Calcula los 3 índices
 */
export function calcularIndices(d) {
  const indices = { iaf: null, iafi: null, ie: null };

  if (d.fcn != null && d.mun != null && d.gfm != null && d.gfm > 0) {
    indices.iaf = (d.fcn * (d.mun / 100)) / d.gfm;
  }

  if (d.cce != null && d.pt != null && d.im != null && d.im > 0) {
    const denom = d.pt / d.im;
    if (denom > 0) indices.iafi = d.cce / denom;
  }

  if (d.ci != null && d.cc != null) {
    const denom = 1 + (d.cc / 100);
    if (denom > 0) indices.ie = (1 + (d.ci / 100)) / denom;
  }

  return indices;
}

/**
 * Determina el color/label del índice según su valor
 */
export function evaluarIndice(indiceCodigo, valor) {
  if (valor == null) return null;
  const umbrales = UMBRALES_INDICES[indiceCodigo];
  if (!umbrales) return null;

  for (const rango of umbrales.rangos) {
    const cumpleMin = rango.min == null || valor >= rango.min;
    const cumpleMax = rango.max == null || valor < rango.max;
    if (cumpleMin && cumpleMax) return rango;
  }
  return null;
}
