# Evaluaciones · Diplomado Anáhuac (sección oculta)

Sección **independiente** del portal SCALEx. No está enlazada desde la navegación
de la app y lleva `noindex`. Vive en:

```
https://app.scalexlatam.com/evaluaciones
```

## Estructura

```
evaluaciones/
├── index.html              # flujo completo: identidad → cuestionario → resultado
├── assets/
│   ├── eval.css            # identidad visual Anáhuac (naranja #FF5800 / marino #0E2841)
│   ├── eval-client.js      # cliente Supabase aislado (sin sesión del portal)
│   └── eval.js             # lógica: randomiza opciones, envía, muestra retro
└── db/
    ├── schema.sql          # tablas + RLS + funciones RPC + vistas de analítica
    └── seed.sql            # las 19 preguntas del Módulo 6 + opciones
```

## Puesta en marcha (una sola vez)

1. **Base de datos** — en Supabase → *SQL Editor*, correr en orden:
   1. `db/schema.sql`
   2. `db/seed.sql`

   Verificación (debe dar 4 opciones y 1 correcta por pregunta):
   ```sql
   select pregunta_id,
          count(*) filter (where es_correcta) as correctas,
          count(*) as opciones
   from eval_opciones group by pregunta_id order by pregunta_id;
   ```

2. **Deploy** — `git push`. El [`_redirects`](../_redirects) ya enruta
   `/evaluaciones` y `/evaluaciones/*` (por encima del catch-all del portal), y el
   [`netlify.toml`](../netlify.toml) agrega `X-Robots-Tag: noindex`.

## Diseño de seguridad

La anon key es pública, así que las respuestas correctas **no** viajan al navegador
antes de responder:

- RLS activado en todas las tablas `eval_*`, **sin políticas** para `anon`
  → nadie lee/escribe las tablas directamente.
- Todo pasa por 2 funciones `SECURITY DEFINER`:
  - `eval_iniciar(nombre, email, empresa)` → crea participante/intento y devuelve
    el cuestionario **sin** `es_correcta` ni `justificacion`.
  - `eval_calificar(intento_id, respuestas)` → **califica en el servidor** y recién
    ahí devuelve qué era correcto + la justificación.

## Configuración

| Qué | Dónde | Valor por defecto |
|---|---|---|
| Nota aprobatoria (umbral) | `db/schema.sql` → `eval_calificar` → `v_umbral` | `70` |
| Reintentos permitidos | `db/schema.sql` → `eval_iniciar` → `v_max_intentos` | `1` |
| Randomizar opciones | `assets/eval.js` → `CONFIG.shuffleOpciones` | `true` |
| Randomizar preguntas | `assets/eval.js` → `CONFIG.shufflePreguntas` | `false` |

## Analítica (solo en Supabase / service_role)

```sql
select * from eval_analitica_preguntas;      -- % de acierto por pregunta
select * from eval_analitica_participantes;   -- última nota por participante
```

## Agregar más evaluaciones / Diagnósticos

El modelo ya soporta más evaluaciones si se agrega una columna de `evaluacion_id`
a preguntas e intentos (hoy hay una sola: Módulo 6). Para la futura sección de
**Diagnósticos**, replicar el patrón en `/diagnosticos/` con su propio bloque en
`_redirects`.
