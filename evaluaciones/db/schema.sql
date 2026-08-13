-- ============================================================================
-- SCALEx · Evaluaciones (Diplomado Anáhuac) — Esquema Supabase / Postgres
-- ============================================================================
-- Correr en: Supabase → SQL Editor (una sola vez).
-- Diseño de seguridad: la anon key es PÚBLICA. Por eso:
--   1. RLS activado en todas las tablas SIN políticas para anon
--      → ningún cliente puede leer/escribir las tablas directamente.
--   2. Todo el acceso ocurre vía 2 funciones SECURITY DEFINER:
--        - eval_iniciar()   devuelve el cuestionario SIN la respuesta correcta
--                           ni la justificación.
--        - eval_calificar() califica del lado del servidor y recién ahí
--                           devuelve qué era correcto + la justificación.
--   → Las respuestas correctas nunca viajan al navegador antes de responder.
-- ============================================================================

-- ── Tipos ───────────────────────────────────────────────────────────────────
do $$ begin
  create type eval_bloque as enum ('innovacion','automatizacion');
exception when duplicate_object then null; end $$;

do $$ begin
  create type eval_tipo as enum ('concepto','escenario');
exception when duplicate_object then null; end $$;

-- ── Tablas ────────────────────────────────────────────────────────────────────
create table if not exists eval_participantes (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  email      text not null unique,
  empresa    text,
  creado_en  timestamptz not null default now()
);

create table if not exists eval_preguntas (
  id            int primary key,                 -- 1..19 (P1..P19)
  bloque        eval_bloque not null,
  tipo          eval_tipo   not null,
  orden         int not null,                    -- orden pedagógico de presentación
  enunciado     text not null,
  justificacion text not null                    -- feedback (solo se revela tras calificar)
);

create table if not exists eval_opciones (
  id          bigint generated always as identity primary key,
  pregunta_id int  not null references eval_preguntas(id) on delete cascade,
  etiqueta    char(1) not null,                  -- a,b,c,d (orden lógico; el front randomiza)
  texto       text not null,
  es_correcta boolean not null default false
);

create table if not exists eval_intentos (
  id              bigint generated always as identity primary key,
  participante_id bigint not null references eval_participantes(id),
  iniciado_en     timestamptz not null default now(),
  enviado_en      timestamptz,
  puntaje         numeric(5,2),                  -- 0.00–100.00
  aprobado        boolean
);

create table if not exists eval_respuestas (
  id          bigint generated always as identity primary key,
  intento_id  bigint not null references eval_intentos(id) on delete cascade,
  pregunta_id int    not null references eval_preguntas(id),
  opcion_id   bigint not null references eval_opciones(id),
  es_correcta boolean not null,
  unique (intento_id, pregunta_id)
);

create index if not exists idx_eval_opciones_pregunta on eval_opciones(pregunta_id);
create index if not exists idx_eval_intentos_part     on eval_intentos(participante_id);
create index if not exists idx_eval_respuestas_intento on eval_respuestas(intento_id);

-- ── RLS: bloquear acceso directo (todo pasa por las funciones) ───────────────
alter table eval_participantes enable row level security;
alter table eval_preguntas     enable row level security;
alter table eval_opciones      enable row level security;
alter table eval_intentos      enable row level security;
alter table eval_respuestas    enable row level security;
-- (sin políticas → PostgREST niega acceso directo de anon/authenticated)

-- ============================================================================
-- FUNCIÓN 1 — eval_iniciar: upsert de participante, crea/reusa intento y
-- devuelve el cuestionario SIN es_correcta ni justificación.
-- ============================================================================
create or replace function eval_iniciar(
  p_nombre  text,
  p_email   text,
  p_empresa text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_part_id      bigint;
  v_intento_id   bigint;
  v_enviados     int;
  v_max_intentos int := 1;        -- ← configurable (reintentos permitidos)
  v_ultimo       jsonb;
  v_cuestionario jsonb;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'email_requerido');
  end if;
  if p_nombre is null or length(trim(p_nombre)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'nombre_requerido');
  end if;

  -- Upsert participante por email
  insert into eval_participantes (nombre, email, empresa)
  values (trim(p_nombre), lower(trim(p_email)), nullif(trim(p_empresa), ''))
  on conflict (email) do update
    set nombre  = excluded.nombre,
        empresa = coalesce(excluded.empresa, eval_participantes.empresa)
  returning id into v_part_id;

  -- ¿Ya agotó los reintentos?
  select count(*) into v_enviados
  from eval_intentos
  where participante_id = v_part_id and enviado_en is not null;

  if v_enviados >= v_max_intentos then
    select jsonb_build_object('puntaje', puntaje, 'aprobado', aprobado, 'enviado_en', enviado_en)
      into v_ultimo
      from eval_intentos
      where participante_id = v_part_id and enviado_en is not null
      order by enviado_en desc
      limit 1;
    return jsonb_build_object(
      'ok', false, 'error', 'sin_reintentos',
      'max_intentos', v_max_intentos, 'ultimo', v_ultimo
    );
  end if;

  -- Reusar intento en progreso o crear uno nuevo
  select id into v_intento_id
  from eval_intentos
  where participante_id = v_part_id and enviado_en is null
  order by iniciado_en desc
  limit 1;

  if v_intento_id is null then
    insert into eval_intentos (participante_id) values (v_part_id)
    returning id into v_intento_id;
  end if;

  -- Cuestionario SIN es_correcta ni justificación
  select jsonb_agg(
           jsonb_build_object(
             'id', p.id,
             'bloque', p.bloque,
             'tipo', p.tipo,
             'orden', p.orden,
             'enunciado', p.enunciado,
             'opciones', (
               select jsonb_agg(
                        jsonb_build_object('id', o.id, 'texto', o.texto)
                        order by o.etiqueta
                      )
               from eval_opciones o
               where o.pregunta_id = p.id
             )
           )
           order by p.orden
         ) into v_cuestionario
  from eval_preguntas p;

  return jsonb_build_object(
    'ok', true,
    'intento_id', v_intento_id,
    'participante_id', v_part_id,
    'cuestionario', v_cuestionario
  );
end;
$$;

-- ============================================================================
-- FUNCIÓN 2 — eval_calificar: recibe [{pregunta_id, opcion_id}], califica en
-- el servidor, persiste respuestas y devuelve puntaje + retroalimentación.
-- ============================================================================
create or replace function eval_calificar(
  p_intento_id bigint,
  p_respuestas jsonb          -- [{"pregunta_id":1,"opcion_id":123}, ...]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_umbral      numeric := 70;    -- ← configurable (nota aprobatoria)
  v_total       int     := 19;
  v_correctas   int     := 0;
  v_puntaje     numeric(5,2);
  v_aprobado    boolean;
  v_ya_enviado  timestamptz;
  v_es_correcta boolean;
  v_detalle     jsonb;
  r             record;
begin
  select enviado_en into v_ya_enviado from eval_intentos where id = p_intento_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'intento_inexistente');
  end if;
  if v_ya_enviado is not null then
    return jsonb_build_object('ok', false, 'error', 'intento_ya_enviado');
  end if;

  delete from eval_respuestas where intento_id = p_intento_id;

  for r in
    select (x->>'pregunta_id')::int as pregunta_id,
           (x->>'opcion_id')::bigint as opcion_id
    from jsonb_array_elements(p_respuestas) x
  loop
    -- La opción debe pertenecer a la pregunta (evita manipulación)
    select es_correcta into v_es_correcta
    from eval_opciones
    where id = r.opcion_id and pregunta_id = r.pregunta_id;

    if not found then
      continue;   -- opción inválida → se ignora (cuenta como no respondida)
    end if;

    insert into eval_respuestas (intento_id, pregunta_id, opcion_id, es_correcta)
    values (p_intento_id, r.pregunta_id, r.opcion_id, coalesce(v_es_correcta, false))
    on conflict (intento_id, pregunta_id) do update
      set opcion_id = excluded.opcion_id, es_correcta = excluded.es_correcta;

    if coalesce(v_es_correcta, false) then
      v_correctas := v_correctas + 1;
    end if;
  end loop;

  v_puntaje  := round((v_correctas::numeric / v_total) * 100, 2);
  v_aprobado := v_puntaje >= v_umbral;

  update eval_intentos
     set enviado_en = now(), puntaje = v_puntaje, aprobado = v_aprobado
   where id = p_intento_id;

  -- Retroalimentación completa (opción correcta + justificación) por pregunta
  select jsonb_agg(
           jsonb_build_object(
             'pregunta_id', p.id,
             'orden', p.orden,
             'enunciado', p.enunciado,
             'justificacion', p.justificacion,
             'opcion_correcta_id',
               (select id from eval_opciones o where o.pregunta_id = p.id and o.es_correcta limit 1),
             'opcion_elegida_id',
               (select opcion_id from eval_respuestas rr where rr.intento_id = p_intento_id and rr.pregunta_id = p.id),
             'correcta',
               coalesce((select es_correcta from eval_respuestas rr where rr.intento_id = p_intento_id and rr.pregunta_id = p.id), false)
           )
           order by p.orden
         ) into v_detalle
  from eval_preguntas p;

  return jsonb_build_object(
    'ok', true,
    'puntaje', v_puntaje,
    'aprobado', v_aprobado,
    'correctas', v_correctas,
    'total', v_total,
    'umbral', v_umbral,
    'detalle', v_detalle
  );
end;
$$;

-- ── Permisos: solo EXECUTE de las 2 funciones para anon ──────────────────────
revoke all on function eval_iniciar(text,text,text)      from public;
revoke all on function eval_calificar(bigint,jsonb)      from public;
grant execute on function eval_iniciar(text,text,text)   to anon, authenticated;
grant execute on function eval_calificar(bigint,jsonb)   to anon, authenticated;

-- ============================================================================
-- ANALÍTICA (solo service_role / SQL Editor — NO expuesta a anon)
-- % de acierto por pregunta: detecta qué concepto quedó flojo en el grupo.
-- ============================================================================
create or replace view eval_analitica_preguntas as
select p.id, p.bloque, p.tipo, p.enunciado,
       count(r.*)                              as respuestas,
       count(r.*) filter (where r.es_correcta) as aciertos,
       round(100.0 * count(r.*) filter (where r.es_correcta) / nullif(count(r.*), 0), 1) as pct_acierto
from eval_preguntas p
left join eval_respuestas r on r.pregunta_id = p.id
group by p.id, p.bloque, p.tipo, p.enunciado
order by pct_acierto asc nulls last;

-- Resumen por participante (última nota)
create or replace view eval_analitica_participantes as
select pa.nombre, pa.email, pa.empresa,
       i.puntaje, i.aprobado, i.enviado_en
from eval_participantes pa
join lateral (
  select puntaje, aprobado, enviado_en
  from eval_intentos
  where participante_id = pa.id and enviado_en is not null
  order by enviado_en desc
  limit 1
) i on true
order by i.enviado_en desc;

-- ============================================================================
-- FUNCIÓN 3 — eval_resultados: payload para la página /resultados.
-- OJO: expuesta a anon (la página es de acceso abierto por decisión del dueño).
-- Devuelve resumen + participantes (última nota) + analítica por pregunta.
-- ============================================================================
create or replace function eval_resultados()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'resumen', (
      select jsonb_build_object(
        'participantes', count(*),
        'aprobados',     count(*) filter (where aprobado),
        'reprobados',    count(*) filter (where not aprobado),
        'promedio',      coalesce(round(avg(puntaje), 2), 0)
      )
      from (
        select distinct on (participante_id) participante_id, puntaje, aprobado
        from eval_intentos
        where enviado_en is not null
        order by participante_id, enviado_en desc
      ) x
    ),
    'participantes', coalesce((
      select jsonb_agg(row_to_json(t) order by t.enviado_en desc)
      from (
        select pa.nombre, pa.email, pa.empresa,
               i.puntaje, i.aprobado, i.enviado_en,
               (select count(*) from eval_intentos ii
                 where ii.participante_id = pa.id and ii.enviado_en is not null) as intentos
        from eval_participantes pa
        join lateral (
          select puntaje, aprobado, enviado_en
          from eval_intentos
          where participante_id = pa.id and enviado_en is not null
          order by enviado_en desc limit 1
        ) i on true
      ) t
    ), '[]'::jsonb),
    'preguntas', coalesce((
      select jsonb_agg(row_to_json(p) order by p.id)
      from (
        select q.id, q.bloque, q.tipo, q.enunciado,
               count(r.*)                              as respuestas,
               count(r.*) filter (where r.es_correcta) as aciertos,
               round(100.0 * count(r.*) filter (where r.es_correcta) / nullif(count(r.*), 0), 1) as pct_acierto
        from eval_preguntas q
        left join eval_respuestas r on r.pregunta_id = q.id
        group by q.id, q.bloque, q.tipo, q.enunciado
      ) p
    ), '[]'::jsonb)
  );
$$;

revoke all on function eval_resultados() from public;
grant execute on function eval_resultados() to anon, authenticated;
