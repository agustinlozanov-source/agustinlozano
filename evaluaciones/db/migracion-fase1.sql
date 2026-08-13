-- ============================================================================
-- SCALEx · Evaluaciones — MIGRACIÓN FASE 1: motor multi-evaluación
-- ============================================================================
-- Aditiva y no destructiva. Sobre la base VIVA:
--   - crea tabla `evaluaciones` (taxonomía Programa/Año/Módulo/Bloque + config)
--   - eval_preguntas: renombra bloque->tema, agrega evaluacion_id, id por secuencia
--   - eval_intentos: agrega evaluacion_id (reintentos ahora por evaluación)
--   - envuelve el Módulo 6 existente en una evaluación (conserva preguntas e intentos)
--   - reescribe RPCs: eval_catalogo / eval_iniciar(4 args) / eval_calificar / eval_resultados
-- Correr UNA vez en Supabase (o vía Management API).
-- ============================================================================

begin;

-- ── 0. Fuera las vistas dependientes (se recrean al final) ────────────────────
drop view if exists eval_analitica_participantes;
drop view if exists eval_analitica_preguntas;

-- ── 1. Tabla de evaluaciones ──────────────────────────────────────────────────
create table if not exists evaluaciones (
  id           bigint generated always as identity primary key,
  programa     text not null,
  anio         int  not null,
  modulo       text not null,
  bloque       text not null,
  titulo       text not null,
  descripcion  text,
  umbral       numeric(5,2) not null default 70,
  max_intentos int not null default 1,
  publicada    boolean not null default false,   -- borrador vs publicada
  activa       boolean not null default true,    -- soft-delete / archivo
  creado_en    timestamptz not null default now(),
  unique (programa, anio, modulo, bloque)
);
alter table evaluaciones enable row level security;  -- sin políticas: acceso vía funciones

-- ── 2. eval_preguntas: bloque->tema, evaluacion_id, id por secuencia ──────────
alter table eval_preguntas rename column bloque to tema;
alter table eval_preguntas alter column tema type text using tema::text;
alter table eval_preguntas alter column tema drop not null;
alter table eval_preguntas add column if not exists evaluacion_id bigint
  references evaluaciones(id) on delete cascade;

create sequence if not exists eval_preguntas_id_seq owned by eval_preguntas.id;
select setval('eval_preguntas_id_seq', greatest((select coalesce(max(id),0) from eval_preguntas), 99));
alter table eval_preguntas alter column id set default (nextval('eval_preguntas_id_seq'))::int;

-- ── 3. eval_intentos: evaluacion_id + FK participante en cascada ──────────────
alter table eval_intentos add column if not exists evaluacion_id bigint
  references evaluaciones(id) on delete cascade;

alter table eval_intentos drop constraint if exists eval_intentos_participante_id_fkey;
alter table eval_intentos add constraint eval_intentos_participante_id_fkey
  foreign key (participante_id) references eval_participantes(id) on delete cascade;

-- ── 4. Migrar el Módulo 6 existente a una evaluación ──────────────────────────
insert into evaluaciones (programa, anio, modulo, bloque, titulo, descripcion, umbral, max_intentos, publicada, activa)
values (
  'Diplomado en Alta Dirección y Gestión Estratégica', 2026, 'Módulo 6',
  'Innovación y Automatización', 'Evaluación Módulo 6 — Bloque Virtual',
  'Bloque virtual: 10 preguntas de Innovación + 9 de Automatización.', 70, 1, true, true
)
on conflict (programa, anio, modulo, bloque) do nothing;

update eval_preguntas p set evaluacion_id = e.id
from evaluaciones e
where p.evaluacion_id is null
  and e.programa='Diplomado en Alta Dirección y Gestión Estratégica'
  and e.anio=2026 and e.modulo='Módulo 6' and e.bloque='Innovación y Automatización';

update eval_intentos i set evaluacion_id = e.id
from evaluaciones e
where i.evaluacion_id is null
  and e.programa='Diplomado en Alta Dirección y Gestión Estratégica'
  and e.anio=2026 and e.modulo='Módulo 6' and e.bloque='Innovación y Automatización';

-- Ahora sí, exigir NOT NULL
alter table eval_preguntas alter column evaluacion_id set not null;
alter table eval_intentos  alter column evaluacion_id set not null;

-- ── 5. RPCs ───────────────────────────────────────────────────────────────────

-- Catálogo público: evaluaciones publicadas y activas (para los selects en cascada)
create or replace function eval_catalogo()
returns jsonb language sql security definer set search_path = public stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'programa', programa, 'anio', anio,
           'modulo', modulo, 'bloque', bloque, 'titulo', titulo
         ) order by programa, anio desc, modulo, bloque), '[]'::jsonb)
  from evaluaciones
  where publicada and activa;
$$;

-- Iniciar: ahora recibe evaluacion_id; reintentos por (participante, evaluación)
drop function if exists eval_iniciar(text, text, text);
create or replace function eval_iniciar(
  p_nombre text, p_email text, p_empresa text, p_evaluacion_id bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_part_id bigint; v_intento_id bigint; v_enviados int;
  v_eval evaluaciones; v_cuestionario jsonb; v_ultimo jsonb;
begin
  if p_email  is null or length(trim(p_email))  = 0 then return jsonb_build_object('ok',false,'error','email_requerido');  end if;
  if p_nombre is null or length(trim(p_nombre)) = 0 then return jsonb_build_object('ok',false,'error','nombre_requerido'); end if;

  select * into v_eval from evaluaciones where id = p_evaluacion_id and publicada and activa;
  if not found then return jsonb_build_object('ok',false,'error','evaluacion_no_disponible'); end if;

  insert into eval_participantes (nombre, email, empresa)
  values (trim(p_nombre), lower(trim(p_email)), nullif(trim(p_empresa),''))
  on conflict (email) do update
    set nombre = excluded.nombre, empresa = coalesce(excluded.empresa, eval_participantes.empresa)
  returning id into v_part_id;

  select count(*) into v_enviados from eval_intentos
   where participante_id = v_part_id and evaluacion_id = p_evaluacion_id and enviado_en is not null;

  if v_enviados >= v_eval.max_intentos then
    select jsonb_build_object('puntaje',puntaje,'aprobado',aprobado,'enviado_en',enviado_en) into v_ultimo
      from eval_intentos
      where participante_id = v_part_id and evaluacion_id = p_evaluacion_id and enviado_en is not null
      order by enviado_en desc limit 1;
    return jsonb_build_object('ok',false,'error','sin_reintentos','max_intentos',v_eval.max_intentos,'ultimo',v_ultimo);
  end if;

  select id into v_intento_id from eval_intentos
   where participante_id = v_part_id and evaluacion_id = p_evaluacion_id and enviado_en is null
   order by iniciado_en desc limit 1;
  if v_intento_id is null then
    insert into eval_intentos (participante_id, evaluacion_id) values (v_part_id, p_evaluacion_id)
    returning id into v_intento_id;
  end if;

  select jsonb_agg(jsonb_build_object(
           'id', p.id, 'tema', p.tema, 'tipo', p.tipo, 'orden', p.orden, 'enunciado', p.enunciado,
           'opciones', (select jsonb_agg(jsonb_build_object('id',o.id,'texto',o.texto) order by o.etiqueta)
                        from eval_opciones o where o.pregunta_id = p.id)
         ) order by p.orden) into v_cuestionario
  from eval_preguntas p where p.evaluacion_id = p_evaluacion_id;

  return jsonb_build_object(
    'ok', true, 'intento_id', v_intento_id, 'participante_id', v_part_id,
    'evaluacion', jsonb_build_object('id',v_eval.id,'titulo',v_eval.titulo,'programa',v_eval.programa,
      'anio',v_eval.anio,'modulo',v_eval.modulo,'bloque',v_eval.bloque,'umbral',v_eval.umbral),
    'cuestionario', coalesce(v_cuestionario, '[]'::jsonb)
  );
end; $$;

-- Calificar: deriva evaluación/umbral/total del intento
create or replace function eval_calificar(p_intento_id bigint, p_respuestas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_eval_id bigint; v_umbral numeric; v_total int; v_correctas int := 0;
  v_puntaje numeric(5,2); v_aprobado boolean; v_ya timestamptz; v_es boolean; v_detalle jsonb; r record;
begin
  select i.enviado_en, i.evaluacion_id into v_ya, v_eval_id from eval_intentos i where i.id = p_intento_id;
  if not found then return jsonb_build_object('ok',false,'error','intento_inexistente'); end if;
  if v_ya is not null then return jsonb_build_object('ok',false,'error','intento_ya_enviado'); end if;

  select umbral into v_umbral from evaluaciones where id = v_eval_id;
  select count(*) into v_total from eval_preguntas where evaluacion_id = v_eval_id;
  if v_total = 0 then return jsonb_build_object('ok',false,'error','evaluacion_sin_preguntas'); end if;

  delete from eval_respuestas where intento_id = p_intento_id;

  for r in select (x->>'pregunta_id')::int as pid, (x->>'opcion_id')::bigint as oid
           from jsonb_array_elements(p_respuestas) x
  loop
    select o.es_correcta into v_es from eval_opciones o
      where o.id = r.oid and o.pregunta_id = r.pid
        and exists (select 1 from eval_preguntas p where p.id = r.pid and p.evaluacion_id = v_eval_id);
    if not found then continue; end if;
    insert into eval_respuestas (intento_id, pregunta_id, opcion_id, es_correcta)
      values (p_intento_id, r.pid, r.oid, coalesce(v_es,false))
      on conflict (intento_id, pregunta_id) do update set opcion_id = excluded.opcion_id, es_correcta = excluded.es_correcta;
    if coalesce(v_es,false) then v_correctas := v_correctas + 1; end if;
  end loop;

  v_puntaje  := round((v_correctas::numeric / v_total) * 100, 2);
  v_aprobado := v_puntaje >= v_umbral;
  update eval_intentos set enviado_en = now(), puntaje = v_puntaje, aprobado = v_aprobado where id = p_intento_id;

  select jsonb_agg(jsonb_build_object(
           'pregunta_id', p.id, 'orden', p.orden, 'enunciado', p.enunciado, 'justificacion', p.justificacion,
           'opcion_correcta_id', (select id from eval_opciones o where o.pregunta_id = p.id and o.es_correcta limit 1),
           'opcion_elegida_id',  (select opcion_id from eval_respuestas rr where rr.intento_id = p_intento_id and rr.pregunta_id = p.id),
           'correcta', coalesce((select es_correcta from eval_respuestas rr where rr.intento_id = p_intento_id and rr.pregunta_id = p.id), false)
         ) order by p.orden) into v_detalle
  from eval_preguntas p where p.evaluacion_id = v_eval_id;

  return jsonb_build_object('ok',true,'puntaje',v_puntaje,'aprobado',v_aprobado,
    'correctas',v_correctas,'total',v_total,'umbral',v_umbral,'detalle',coalesce(v_detalle,'[]'::jsonb));
end; $$;

-- Resultados: filtrable por evaluación (compat: sin arg = todas). tema se expone como 'bloque'.
drop function if exists eval_resultados();
create or replace function eval_resultados(p_evaluacion_id bigint default null)
returns jsonb language sql security definer set search_path = public stable as $$
  with env as (
    select * from eval_intentos
    where enviado_en is not null
      and (p_evaluacion_id is null or evaluacion_id = p_evaluacion_id)
  ),
  ult as (
    select distinct on (participante_id, evaluacion_id)
      participante_id, evaluacion_id, puntaje, aprobado, enviado_en
    from env
    order by participante_id, evaluacion_id, enviado_en desc
  )
  select jsonb_build_object(
    'resumen', (
      select jsonb_build_object(
        'participantes', count(*), 'aprobados', count(*) filter (where aprobado),
        'reprobados', count(*) filter (where not aprobado), 'promedio', coalesce(round(avg(puntaje),2),0)
      ) from ult
    ),
    'participantes', coalesce((
      select jsonb_agg(row_to_json(t) order by t.enviado_en desc)
      from (
        select pa.nombre, pa.email, pa.empresa, u.puntaje, u.aprobado, u.enviado_en,
               (select count(*) from env e2 where e2.participante_id = pa.id and e2.evaluacion_id = u.evaluacion_id) as intentos
        from ult u join eval_participantes pa on pa.id = u.participante_id
      ) t
    ), '[]'::jsonb),
    'preguntas', coalesce((
      select jsonb_agg(row_to_json(p) order by p.id)
      from (
        select q.id, q.tema as bloque, q.tipo, q.enunciado,
               count(r.*) as respuestas,
               count(r.*) filter (where r.es_correcta) as aciertos,
               round(100.0 * count(r.*) filter (where r.es_correcta) / nullif(count(r.*),0), 1) as pct_acierto
        from eval_preguntas q
        left join eval_respuestas r on r.pregunta_id = q.id
        left join env e on e.id = r.intento_id
        where (p_evaluacion_id is null or q.evaluacion_id = p_evaluacion_id)
        group by q.id, q.tema, q.tipo, q.enunciado
      ) p
    ), '[]'::jsonb)
  );
$$;

-- Permisos
revoke all on function eval_catalogo()                          from public;
revoke all on function eval_iniciar(text,text,text,bigint)      from public;
revoke all on function eval_calificar(bigint,jsonb)             from public;
revoke all on function eval_resultados(bigint)                  from public;
grant execute on function eval_catalogo()                       to anon, authenticated;
grant execute on function eval_iniciar(text,text,text,bigint)   to anon, authenticated;
grant execute on function eval_calificar(bigint,jsonb)          to anon, authenticated;
grant execute on function eval_resultados(bigint)               to anon, authenticated;

-- ── 6. Recrear vistas de analítica (ahora con evaluación y tema) ──────────────
create or replace view eval_analitica_preguntas as
select e.id as evaluacion_id, e.titulo as evaluacion, q.id, q.tema, q.tipo, q.enunciado,
       count(r.*) as respuestas,
       count(r.*) filter (where r.es_correcta) as aciertos,
       round(100.0 * count(r.*) filter (where r.es_correcta) / nullif(count(r.*),0), 1) as pct_acierto
from eval_preguntas q
join evaluaciones e on e.id = q.evaluacion_id
left join eval_respuestas r on r.pregunta_id = q.id
group by e.id, e.titulo, q.id, q.tema, q.tipo, q.enunciado
order by e.id, pct_acierto asc nulls last;

create or replace view eval_analitica_participantes as
select ev.titulo as evaluacion, pa.nombre, pa.email, pa.empresa, i.puntaje, i.aprobado, i.enviado_en
from eval_participantes pa
join lateral (
  select evaluacion_id, puntaje, aprobado, enviado_en
  from eval_intentos
  where participante_id = pa.id and enviado_en is not null
  order by enviado_en desc limit 1
) i on true
join evaluaciones ev on ev.id = i.evaluacion_id
order by i.enviado_en desc;

commit;
