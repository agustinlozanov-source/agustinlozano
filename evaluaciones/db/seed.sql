-- ============================================================================
-- SCALEx · Evaluaciones — Semilla: Módulo 6 (Innovación y Automatización)
-- ============================================================================
-- Correr DESPUÉS de schema.sql. Idempotente para primera carga.
-- (Si ya hay respuestas registradas, el DELETE de opciones fallará por FK:
--  en ese caso no re-siembres, o borra intentos/respuestas antes.)
-- ============================================================================

begin;

delete from eval_opciones where pregunta_id between 1 and 19;

-- ── Preguntas ─────────────────────────────────────────────────────────────────
insert into eval_preguntas (id, bloque, tipo, orden, enunciado, justificacion) values
(1,  'innovacion',    'concepto',  1,
 '¿Cuál es la diferencia esencial entre crecer y escalar?',
 'Escalar implica desacoplar el crecimiento de ingresos del de costos y complejidad. Las demás confunden magnitud o plazo con estructura.'),
(2,  'innovacion',    'concepto',  2,
 'Según la lógica de los ciclos hegemónicos, ¿por qué caen los imperios y las empresas dominantes?',
 'El incumbente cae por ceguera, no por escasez. El tamaño es tentador como respuesta, pero la causa raíz es la falta de visión.'),
(3,  'innovacion',    'concepto',  3,
 'Una empresa adquiere a un competidor mucho más pequeño que desarrolló un producto superior. ¿Qué está comprando realmente?',
 'El gigante ya tiene talento y capacidad; compra lo que no pudo crear internamente. Es la confesión de una falla de innovación propia.'),
(4,  'innovacion',    'concepto',  4,
 '¿Cuál de estas afirmaciones sobre innovar es correcta?',
 'Innovar no es lo mismo que ser único en lo operativo. La unicidad solo es el objetivo en lo estratégico.'),
(5,  'innovacion',    'concepto',  5,
 'La distinción entre innovación operativa y estratégica implica que:',
 'Cada nivel tiene su vara: valor (operativa) vs. unicidad/océano azul (estratégica). Poner la vara de único en lo operativo paraliza.'),
(6,  'innovacion',    'concepto',  6,
 'En el método de innovación, ¿por qué la primera fase es definir y declarar antes de generar ideas?',
 'La innovación empieza con un acuerdo de lenguaje. Sin definición compartida, cada quien jala hacia un lugar distinto.'),
(7,  'innovacion',    'concepto',  7,
 'El filtro ¿a quién sirve? establece que una innovación carece de valor cuando:',
 'Es la factorización: si el factor cliente sale negativo, el resultado es negativo, por más beneficio interno que haya.'),
(8,  'innovacion',    'concepto',  8,
 'El principio innovar para irme temprano a casa es legítimo siempre que:',
 'El interés propio es el mejor combustible, pero depende de dos condiciones: que no perjudique al público servido y que el liderazgo lo proteja.'),
(9,  'innovacion',    'escenario', 9,
 'Un director nota que un empleado automatizó un reporte que antes tomaba 2 horas y ahora se va temprano. ¿Cuál es la mejor respuesta directiva?',
 'Celebrar el interés propio legítimo enciende el efecto de red; castigarlo mata el motor para todos los que observan.'),
(10, 'innovacion',    'escenario', 10,
 'Tu empresa lleva 15 años siendo líder de su sector y todo funciona bien. ¿Qué es lo más peligroso que puedes hacer?',
 'Los ciclos se acortan; la comodidad del incumbente precede a la caída. La vigilancia de amenazas es lo único que ubica tu punto en la curva.'),
(11, 'automatizacion', 'concepto',  11,
 '¿Cuál es el efecto que la automatización tiene sobre el trabajo humano?',
 'Desplaza, no elimina: reubica a la persona hacia donde aporta más, porque en la repetición está el tiempo que la máquina sostiene mejor.'),
(12, 'automatizacion', 'concepto',  12,
 'Las tres olas de automatización, en orden, son:',
 'La progresión histórica va de lo físico (mecánica), a los flujos de datos (información), a la decisión (IA).'),
(13, 'automatizacion', 'concepto',  13,
 '¿Por qué la automatización estratégica es la más difícil de alcanzar hoy?',
 'Lo estratégico resiste porque la economía es más filosofía que matemática: nadie predice el dólar de mañana. No es tema de inversión ni de tecnología disponible.'),
(14, 'automatizacion', 'concepto',  14,
 'La premisa no se puede automatizar lo que no se conoce significa que:',
 'La automatización presupone el proceso. Automatizar sin mapa es poner pegatinas.'),
(15, 'automatizacion', 'concepto',  15,
 'En el mapa institucional por capas, ¿cuál capa define hacia quién apuntan todos los procesos?',
 'El mapa arranca definiendo a quién sirve, el mismo filtro ¿a quién sirve? de la innovación. Es el punto de partida.'),
(16, 'automatizacion', 'concepto',  16,
 'De los cuatro objetos automatizables, ¿cuál es el más valioso e incomprendido?',
 'La mayoría cree que automatizar es sacar datos a mano de un sistema y cargarlos en otro; conectar las apps para que se hablen solas es lo que más tiempo libera y menos se entiende.'),
(17, 'automatizacion', 'concepto',  17,
 'El Business Intelligence (BI) se describió como:',
 'BI es el puente de la automatización operativa a la de decisiones. Su valor está en cruzar datos, no en una herramienta específica.'),
(18, 'automatizacion', 'escenario', 18,
 'Una empresa quiere automatizar todo con IA pero no tiene sus procesos documentados. ¿Cuál es el primer paso correcto?',
 'La secuencia es mapear → cablear → automatizar. Saltarse el mapa es poner pegatinas; y lo estratégico es lo último, no lo primero.'),
(19, 'automatizacion', 'escenario', 19,
 'Un director de retail duda si invertir en cruzar los datos de ventas, inventario y clientes en un solo tablero. ¿Qué le dirías?',
 'Se señaló explícitamente el peso del BI en retail. Es de las decisiones de mayor impacto para ese sector.')
on conflict (id) do update
  set bloque = excluded.bloque, tipo = excluded.tipo, orden = excluded.orden,
      enunciado = excluded.enunciado, justificacion = excluded.justificacion;

-- ── Opciones (es_correcta = true en la clave) ────────────────────────────────
insert into eval_opciones (pregunta_id, etiqueta, texto, es_correcta) values
-- P1 (b)
(1,'a','Crecer es aumentar ventas; escalar es aumentar utilidades', false),
(1,'b','Crecer es sumar ingresos, costos y complejidad en la misma proporción; escalar es aumentar ingresos sin que costos y complejidad suban igual', true),
(1,'c','Crecer es a corto plazo; escalar es a largo plazo', false),
(1,'d','Son sinónimos; la diferencia es solo de tamaño de empresa', false),
-- P2 (c)
(2,'a','Por falta de recursos económicos', false),
(2,'b','Por errores en la ejecución operativa', false),
(2,'c','Por falta de visión para anticipar la disrupción, no por falta de recursos', true),
(2,'d','Por el tamaño excesivo que los vuelve lentos', false),
-- P3 (c)
(3,'a','Talento y capacidad instalada', false),
(3,'b','Participación de mercado', false),
(3,'c','La innovación que ella misma no fue capaz de imaginar', true),
(3,'d','Eliminar a un competidor incómodo', false),
-- P4 (b)
(4,'a','Innovar siempre significa crear algo que nadie más en el mundo hace', false),
(4,'b','En lo operativo, tomar algo que ya existe y adaptarlo a tu contexto es innovación legítima', true),
(4,'c','Clonar una práctica de otro sector nunca es innovación', false),
(4,'d','La innovación solo aplica a productos nuevos, no a procesos', false),
-- P5 (a)
(5,'a','La operativa la hace cualquier rol y busca valor; la estratégica busca unicidad y diferenciación', true),
(5,'b','La operativa es menos importante que la estratégica', false),
(5,'c','Ambas persiguen volverse únicos en el mercado', false),
(5,'d','La estratégica la ejecutan los mandos operativos', false),
-- P6 (b)
(6,'a','Porque es un requisito administrativo', false),
(6,'b','Porque si cada persona entiende innovación distinto, el proceso se rompe antes de empezar', true),
(6,'c','Porque hay que informar a Recursos Humanos primero', false),
(6,'d','Porque las ideas deben aprobarse antes de proponerse', false),
-- P7 (b)
(7,'a','No genera ingresos inmediatos', false),
(7,'b','Beneficia a quien la propone pero perjudica al cliente o proveedor', true),
(7,'c','Ya existe en otra empresa', false),
(7,'d','No fue aprobada por la dirección', false),
-- P8 (b)
(8,'a','El empleado no se lo diga a nadie', false),
(8,'b','La innovación pase el filtro de a quién sirve y el líder la celebre en lugar de castigarla', true),
(8,'c','Se haga solo fuera del horario laboral', false),
(8,'d','Aumente las horas de trabajo del equipo', false),
-- P9 (c)
(9,'a','Asignarle más trabajo para llenar el tiempo liberado', false),
(9,'b','Cuestionar por qué se va antes que los demás', false),
(9,'c','Reconocerlo públicamente, porque ese comportamiento, si se celebra, se contagia', true),
(9,'d','Pedirle que mantenga el proceso manual para no depender de la automatización', false),
-- P10 (b)
(10,'a','Invertir en nuevos mercados', false),
(10,'b','Asumir que la posición actual está garantizada y dejar de vigilar las amenazas', true),
(10,'c','Contratar más personal', false),
(10,'d','Reducir precios para ganar cuota', false),
-- P11 (b)
(11,'a','Lo elimina por completo, reduciendo empleo', false),
(11,'b','Lo desplaza de lo repetitivo hacia tareas de mayor valor, sin eliminar el valor', true),
(11,'c','Lo mantiene igual pero más rápido', false),
(11,'d','Solo aplica al trabajo físico, no al de oficina', false),
-- P12 (b)
(12,'a','Información → mecánica → IA', false),
(12,'b','Mecánica → información → IA', true),
(12,'c','IA → mecánica → información', false),
(12,'d','Mecánica → IA → información', false),
-- P13 (b)
(13,'a','Porque requiere demasiada inversión', false),
(13,'b','Porque involucra variables (micro, macro, percepción, lo social) que aún no son del todo matemáticas', true),
(13,'c','Porque los directivos se resisten a ella', false),
(13,'d','Porque la tecnología todavía no existe', false),
-- P14 (b)
(14,'a','Hay que capacitar al personal antes de automatizar', false),
(14,'b','Sin procesos mapeados y definidos, no hay nada que automatizar', true),
(14,'c','La automatización requiere conocimiento técnico avanzado', false),
(14,'d','Solo las empresas grandes pueden automatizar', false),
-- P15 (c)
(15,'a','Procesos rectores (legal, fiscal)', false),
(15,'b','Procesos habilitadores', false),
(15,'c','Públicos servidos', true),
(15,'d','Capas de diferenciación', false),
-- P16 (d)
(16,'a','Automatizar un sistema', false),
(16,'b','Automatizar un proceso', false),
(16,'c','Automatizar una decisión', false),
(16,'d','Automatizar la conexión entre sistemas', true),
-- P17 (c)
(17,'a','Una moda técnica pasajera', false),
(17,'b','Una herramienta exclusiva de empresas de tecnología', false),
(17,'c','Una capacidad estratégica que surge de concentrar y cruzar todos los datos en un solo espacio', true),
(17,'d','Un tipo de software de contabilidad', false),
-- P18 (c)
(18,'a','Comprar el mejor software de IA del mercado', false),
(18,'b','Contratar programadores de inmediato', false),
(18,'c','Mapear los procesos antes de intentar automatizar cualquier cosa', true),
(18,'d','Empezar automatizando la capa estratégica, que es la más rentable', false),
-- P19 (b)
(19,'a','Que espere a que la empresa sea más grande', false),
(19,'b','Que el BI hace diferencias enormes, especialmente en retail, y es una capacidad estratégica', true),
(19,'c','Que primero automatice la capa estratégica', false),
(19,'d','Que los datos cruzados solo sirven para empresas de tecnología', false);

commit;

-- Verificación rápida: cada pregunta debe tener exactamente 1 correcta y 4 opciones
-- select pregunta_id, count(*) filter (where es_correcta) correctas, count(*) opciones
-- from eval_opciones group by pregunta_id order by pregunta_id;
