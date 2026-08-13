# Evaluaciones · Diplomado Anáhuac (sección oculta)

Motor de **evaluaciones autocalificables** del diplomado, independiente del portal
SCALEx. No está enlazado desde la navegación de la app y lleva `noindex`. Vive en:

```
https://app.scalexlatam.com/evaluaciones
```

## Modelo (multi-evaluación)

Cada evaluación se identifica por **Programa / Año / Módulo / Bloque** (combinación
única) y tiene su propia config (umbral, reintentos) y su set de preguntas.

```
evaluaciones (programa, anio, modulo, bloque, titulo, umbral, max_intentos, publicada, activa)
  └── eval_preguntas (evaluacion_id, orden, tema, tipo, enunciado, justificacion)
        └── eval_opciones (etiqueta, texto, es_correcta)
eval_intentos (participante_id, evaluacion_id, ...)   ← reintentos por (persona × evaluación)
```

El participante: **identidad (nombre, correo, empresa) → selecciona Programa/Año/Módulo/Bloque
(cascada) → responde**. Los selects se pueblan solo con evaluaciones `publicada = true`.

> `tema` (innovacion/automatizacion) es un tag interno por pregunta, para agrupar y
> para analítica. No confundir con el `bloque` de la taxonomía (nivel de selección).

## Estructura

```
evaluaciones/
├── index.html              # flujo: identidad → selección → cuestionario → resultado
├── assets/
│   ├── eval.css            # identidad visual Anáhuac (naranja #FF5800 / marino #0E2841)
│   ├── eval-client.js      # cliente Supabase aislado (sin sesión del portal)
│   └── eval.js             # cascada de selección, randomiza opciones, envía, muestra retro
└── db/
    ├── schema.sql          # base v1 (tablas + RLS + RPC + vistas)
    ├── seed.sql            # las 19 preguntas del Módulo 6 + opciones
    └── migracion-fase1.sql # → motor multi-evaluación (evaluaciones, evaluacion_id, RPCs nuevas)
```

## Puesta en marcha

**Base de datos** — en Supabase → *SQL Editor*, correr EN ORDEN (base + migración):

1. `db/schema.sql`
2. `db/seed.sql`
3. `db/migracion-fase1.sql`

Verificación:
```sql
select id, programa, anio, modulo, bloque, publicada from evaluaciones;
select evaluacion_id, count(*) from eval_preguntas group by evaluacion_id;
```

**Deploy** — `git push`. El [`_redirects`](../_redirects) enruta `/evaluaciones` y
`/evaluaciones/*` (por encima del catch-all del portal); el [`netlify.toml`](../netlify.toml)
agrega `X-Robots-Tag: noindex`.

## Diseño de seguridad

La anon key es pública, así que las respuestas correctas **no** viajan al navegador
antes de responder:

- RLS activado en todas las tablas `eval_*` y `evaluaciones`, **sin políticas** para
  `anon` → nadie lee/escribe las tablas directamente.
- Todo pasa por funciones `SECURITY DEFINER`:
  - `eval_catalogo()` → taxonomía de evaluaciones publicadas (sin preguntas).
  - `eval_iniciar(nombre, email, empresa, evaluacion_id)` → crea participante/intento y
    devuelve el cuestionario **sin** `es_correcta` ni `justificacion`.
  - `eval_calificar(intento_id, respuestas)` → **califica en el servidor** y recién ahí
    devuelve qué era correcto + la justificación.

## Configuración

| Qué | Dónde | Valor por defecto |
|---|---|---|
| Nota aprobatoria (umbral) | columna `evaluaciones.umbral` (por evaluación) | `70` |
| Reintentos permitidos | columna `evaluaciones.max_intentos` (por evaluación) | `1` |
| Publicar / despublicar | columna `evaluaciones.publicada` | — |
| Randomizar opciones | `assets/eval.js` → `CONFIG.shuffleOpciones` | `true` |
| Randomizar preguntas | `assets/eval.js` → `CONFIG.shufflePreguntas` | `false` |

## Crear una evaluación (por ahora, vía SQL)

El **Superadmin visual llega en la Fase 2**. Hasta entonces, se crea por SQL:

```sql
-- 1. la evaluación
insert into evaluaciones (programa, anio, modulo, bloque, titulo, umbral, max_intentos, publicada)
values ('Diplomado en Alta Dirección y Gestión Estratégica', 2026, 'Módulo 7',
        'Finanzas', 'Evaluación Módulo 7', 70, 1, true)
returning id;   -- usar este id abajo

-- 2. preguntas (evaluacion_id = el de arriba); 3. opciones (4 por pregunta, 1 es_correcta)
```

## Analítica (solo en Supabase / service_role)

```sql
select * from eval_analitica_preguntas;       -- % de acierto por pregunta y evaluación
select * from eval_analitica_participantes;    -- última nota por participante y evaluación
```

## Roadmap

- **Fase 1 (hecha):** motor multi-evaluación + selección en cascada + reintentos por evaluación.
- **Fase 2:** Superadmin protegido (login portal + admin) con importador + formulario.
- **Fase 3:** `/resultados` con selector de evaluación y export por evaluación.
- **Diagnósticos:** replicar el patrón en `/diagnosticos/` con su propio bloque en `_redirects`.
