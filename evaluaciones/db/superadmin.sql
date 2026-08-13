-- ============================================================================
-- SCALEx · Evaluaciones — FASE 2: Superadmin (RPCs protegidas por admin)
-- ============================================================================
-- Todas las funciones verifican eval_is_admin() = usuario logueado con
-- perfiles.rol_global='admin'. anon / no-admin reciben {ok:false,error:'no_autorizado'}.
-- SECURITY DEFINER: bypassean RLS, pero el gate de admin es la barrera real.
-- ============================================================================

-- ¿El usuario del JWT actual es admin del portal?
create or replace function eval_is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol_global = 'admin');
$$;
grant execute on function eval_is_admin() to anon, authenticated;

-- ── Listar evaluaciones (incluye borradores) con conteos ──────────────────────
create or replace function admin_list_evaluaciones()
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if not eval_is_admin() then return jsonb_build_object('ok',false,'error','no_autorizado'); end if;
  return jsonb_build_object('ok', true, 'evaluaciones', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',e.id,'programa',e.programa,'anio',e.anio,'modulo',e.modulo,'bloque',e.bloque,
      'titulo',e.titulo,'umbral',e.umbral,'max_intentos',e.max_intentos,
      'publicada',e.publicada,'activa',e.activa,
      'preguntas',(select count(*) from eval_preguntas p where p.evaluacion_id=e.id),
      'intentos', (select count(*) from eval_intentos i where i.evaluacion_id=e.id and i.enviado_en is not null)
    ) order by e.programa, e.anio desc, e.modulo, e.bloque)
    from evaluaciones e
  ), '[]'::jsonb));
end; $$;
grant execute on function admin_list_evaluaciones() to anon, authenticated;

-- ── Valores existentes para los datalist (elegí-o-agregá) ─────────────────────
create or replace function admin_taxonomia()
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if not eval_is_admin() then return jsonb_build_object('ok',false,'error','no_autorizado'); end if;
  return jsonb_build_object('ok',true,
    'programas',(select coalesce(array_to_json(array_agg(distinct programa order by programa)),'[]') from evaluaciones),
    'anios',    (select coalesce(array_to_json(array_agg(distinct anio    order by anio)),'[]')     from evaluaciones),
    'modulos',  (select coalesce(array_to_json(array_agg(distinct modulo  order by modulo)),'[]')   from evaluaciones),
    'bloques',  (select coalesce(array_to_json(array_agg(distinct bloque  order by bloque)),'[]')   from evaluaciones),
    'temas',    (select coalesce(array_to_json(array_agg(distinct tema    order by tema)),'[]')     from eval_preguntas where tema is not null)
  );
end; $$;
grant execute on function admin_taxonomia() to anon, authenticated;

-- ── Traer una evaluación completa (con preguntas y opciones, incl. correcta) ──
create or replace function admin_get_evaluacion(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_eval jsonb; v_preg jsonb; v_intentos int;
begin
  if not eval_is_admin() then return jsonb_build_object('ok',false,'error','no_autorizado'); end if;
  select to_jsonb(e.*) into v_eval from evaluaciones e where e.id = p_id;
  if v_eval is null then return jsonb_build_object('ok',false,'error','evaluacion_inexistente'); end if;
  select count(*) into v_intentos from eval_intentos where evaluacion_id = p_id and enviado_en is not null;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',p.id,'orden',p.orden,'tema',p.tema,'tipo',p.tipo,
           'enunciado',p.enunciado,'justificacion',p.justificacion,
           'opciones',(select jsonb_agg(jsonb_build_object('id',o.id,'texto',o.texto,'correcta',o.es_correcta) order by o.etiqueta)
                       from eval_opciones o where o.pregunta_id=p.id)
         ) order by p.orden), '[]'::jsonb) into v_preg
  from eval_preguntas p where p.evaluacion_id = p_id;
  return jsonb_build_object('ok',true,'evaluacion',v_eval,'preguntas',v_preg,'intentos',v_intentos);
end; $$;
grant execute on function admin_get_evaluacion(bigint) to anon, authenticated;

-- ── Crear / actualizar metadata de una evaluación ─────────────────────────────
create or replace function admin_upsert_evaluacion(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not eval_is_admin() then return jsonb_build_object('ok',false,'error','no_autorizado'); end if;
  if coalesce(trim(p->>'programa'),'')='' or coalesce(trim(p->>'modulo'),'')=''
     or coalesce(trim(p->>'bloque'),'')='' or coalesce(trim(p->>'titulo'),'')=''
     or (p->>'anio') is null then
    return jsonb_build_object('ok',false,'error','faltan_campos');
  end if;

  if (p->>'id') is not null then
    update evaluaciones set
      programa=trim(p->>'programa'), anio=(p->>'anio')::int, modulo=trim(p->>'modulo'), bloque=trim(p->>'bloque'),
      titulo=trim(p->>'titulo'), descripcion=nullif(trim(p->>'descripcion'),''),
      umbral=coalesce((p->>'umbral')::numeric,70), max_intentos=coalesce((p->>'max_intentos')::int,1),
      publicada=coalesce((p->>'publicada')::boolean,false), activa=coalesce((p->>'activa')::boolean,true)
    where id=(p->>'id')::bigint
    returning id into v_id;
    if v_id is null then return jsonb_build_object('ok',false,'error','evaluacion_inexistente'); end if;
  else
    insert into evaluaciones (programa,anio,modulo,bloque,titulo,descripcion,umbral,max_intentos,publicada,activa)
    values (trim(p->>'programa'),(p->>'anio')::int,trim(p->>'modulo'),trim(p->>'bloque'),trim(p->>'titulo'),
            nullif(trim(p->>'descripcion'),''),coalesce((p->>'umbral')::numeric,70),
            coalesce((p->>'max_intentos')::int,1),coalesce((p->>'publicada')::boolean,false),
            coalesce((p->>'activa')::boolean,true))
    returning id into v_id;
  end if;
  return jsonb_build_object('ok',true,'id',v_id);
exception when unique_violation then
  return jsonb_build_object('ok',false,'error','combinacion_duplicada');
end; $$;
grant execute on function admin_upsert_evaluacion(jsonb) to anon, authenticated;

-- ── Borrar una evaluación (cascade: preguntas/opciones/intentos/respuestas) ────
create or replace function admin_delete_evaluacion(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not eval_is_admin() then return jsonb_build_object('ok',false,'error','no_autorizado'); end if;
  delete from evaluaciones where id = p_id;
  if not found then return jsonb_build_object('ok',false,'error','evaluacion_inexistente'); end if;
  return jsonb_build_object('ok',true);
end; $$;
grant execute on function admin_delete_evaluacion(bigint) to anon, authenticated;

-- ── Publicar / despublicar ────────────────────────────────────────────────────
create or replace function admin_set_publicada(p_id bigint, p_publicada boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not eval_is_admin() then return jsonb_build_object('ok',false,'error','no_autorizado'); end if;
  -- No publicar una evaluación sin preguntas
  if p_publicada and (select count(*) from eval_preguntas where evaluacion_id=p_id)=0 then
    return jsonb_build_object('ok',false,'error','evaluacion_sin_preguntas');
  end if;
  update evaluaciones set publicada=p_publicada where id=p_id;
  if not found then return jsonb_build_object('ok',false,'error','evaluacion_inexistente'); end if;
  return jsonb_build_object('ok',true);
end; $$;
grant execute on function admin_set_publicada(bigint, boolean) to anon, authenticated;

-- ── Importar/reemplazar preguntas en bloque ───────────────────────────────────
-- p_preguntas: [{tema?, tipo?, enunciado, justificacion?, opciones:[{texto, correcta}]}]
create or replace function admin_importar_preguntas(
  p_evaluacion_id bigint, p_preguntas jsonb, p_reemplazar boolean default true
) returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; o jsonb; v_pid bigint; v_ord int := 0; v_i int; v_correctas int; v_n int; v_tipo eval_tipo;
begin
  if not eval_is_admin() then return jsonb_build_object('ok',false,'error','no_autorizado'); end if;
  if not exists (select 1 from evaluaciones where id=p_evaluacion_id) then
    return jsonb_build_object('ok',false,'error','evaluacion_inexistente'); end if;
  if exists (select 1 from eval_intentos where evaluacion_id=p_evaluacion_id) then
    return jsonb_build_object('ok',false,'error','evaluacion_con_intentos'); end if;
  if jsonb_typeof(p_preguntas) <> 'array' or jsonb_array_length(p_preguntas)=0 then
    return jsonb_build_object('ok',false,'error','sin_preguntas'); end if;

  -- validación previa (todo o nada)
  for r in select value from jsonb_array_elements(p_preguntas) loop
    if coalesce(trim(r->>'enunciado'),'')='' then return jsonb_build_object('ok',false,'error','enunciado_vacio'); end if;
    if jsonb_typeof(r->'opciones')<>'array' or jsonb_array_length(r->'opciones')<2 then
      return jsonb_build_object('ok',false,'error','opciones_insuficientes'); end if;
    select count(*) into v_correctas from jsonb_array_elements(r->'opciones') x where (x->>'correcta')::boolean is true;
    if v_correctas <> 1 then return jsonb_build_object('ok',false,'error','debe_haber_1_correcta'); end if;
  end loop;

  if p_reemplazar then delete from eval_preguntas where evaluacion_id=p_evaluacion_id; end if;

  for r in select value from jsonb_array_elements(p_preguntas) loop
    v_ord := v_ord + 1;
    v_tipo := (case when lower(coalesce(r->>'tipo','')) = 'escenario' then 'escenario' else 'concepto' end)::eval_tipo;
    insert into eval_preguntas (evaluacion_id, orden, tema, tipo, enunciado, justificacion)
    values (p_evaluacion_id, v_ord, nullif(trim(r->>'tema'),''), v_tipo,
            trim(r->>'enunciado'), coalesce(r->>'justificacion',''))
    returning id into v_pid;

    v_i := 0;
    for o in select value from jsonb_array_elements(r->'opciones') loop
      insert into eval_opciones (pregunta_id, etiqueta, texto, es_correcta)
      values (v_pid, chr(97 + v_i), trim(o->>'texto'), coalesce((o->>'correcta')::boolean, false));
      v_i := v_i + 1;
    end loop;
  end loop;

  select count(*) into v_n from eval_preguntas where evaluacion_id=p_evaluacion_id;
  return jsonb_build_object('ok',true,'total',v_n);
end; $$;
grant execute on function admin_importar_preguntas(bigint, jsonb, boolean) to anon, authenticated;

-- ── Crear / editar UNA pregunta (formulario) ──────────────────────────────────
-- p: {id?, tema?, tipo?, enunciado, justificacion?, opciones:[{texto, correcta}]}
create or replace function admin_upsert_pregunta(p_evaluacion_id bigint, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_pid bigint; o jsonb; v_i int := 0; v_correctas int; v_ord int; v_tipo eval_tipo;
begin
  if not eval_is_admin() then return jsonb_build_object('ok',false,'error','no_autorizado'); end if;
  if not exists (select 1 from evaluaciones where id=p_evaluacion_id) then
    return jsonb_build_object('ok',false,'error','evaluacion_inexistente'); end if;
  if exists (select 1 from eval_intentos where evaluacion_id=p_evaluacion_id) then
    return jsonb_build_object('ok',false,'error','evaluacion_con_intentos'); end if;
  if coalesce(trim(p->>'enunciado'),'')='' then return jsonb_build_object('ok',false,'error','enunciado_vacio'); end if;
  if jsonb_typeof(p->'opciones')<>'array' or jsonb_array_length(p->'opciones')<2 then
    return jsonb_build_object('ok',false,'error','opciones_insuficientes'); end if;
  select count(*) into v_correctas from jsonb_array_elements(p->'opciones') x where (x->>'correcta')::boolean is true;
  if v_correctas <> 1 then return jsonb_build_object('ok',false,'error','debe_haber_1_correcta'); end if;

  v_tipo := (case when lower(coalesce(p->>'tipo','')) = 'escenario' then 'escenario' else 'concepto' end)::eval_tipo;

  if (p->>'id') is not null then
    v_pid := (p->>'id')::bigint;
    update eval_preguntas set tema=nullif(trim(p->>'tema'),''), tipo=v_tipo,
           enunciado=trim(p->>'enunciado'), justificacion=coalesce(p->>'justificacion','')
    where id=v_pid and evaluacion_id=p_evaluacion_id;
    if not found then return jsonb_build_object('ok',false,'error','pregunta_inexistente'); end if;
    delete from eval_opciones where pregunta_id=v_pid;
  else
    select coalesce(max(orden),0)+1 into v_ord from eval_preguntas where evaluacion_id=p_evaluacion_id;
    insert into eval_preguntas (evaluacion_id, orden, tema, tipo, enunciado, justificacion)
    values (p_evaluacion_id, v_ord, nullif(trim(p->>'tema'),''), v_tipo,
            trim(p->>'enunciado'), coalesce(p->>'justificacion',''))
    returning id into v_pid;
  end if;

  for o in select value from jsonb_array_elements(p->'opciones') loop
    insert into eval_opciones (pregunta_id, etiqueta, texto, es_correcta)
    values (v_pid, chr(97 + v_i), trim(o->>'texto'), coalesce((o->>'correcta')::boolean, false));
    v_i := v_i + 1;
  end loop;

  return jsonb_build_object('ok',true,'id',v_pid);
end; $$;
grant execute on function admin_upsert_pregunta(bigint, jsonb) to anon, authenticated;

-- ── Borrar UNA pregunta ───────────────────────────────────────────────────────
create or replace function admin_delete_pregunta(p_pregunta_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_eval bigint;
begin
  if not eval_is_admin() then return jsonb_build_object('ok',false,'error','no_autorizado'); end if;
  select evaluacion_id into v_eval from eval_preguntas where id=p_pregunta_id;
  if v_eval is null then return jsonb_build_object('ok',false,'error','pregunta_inexistente'); end if;
  if exists (select 1 from eval_intentos where evaluacion_id=v_eval) then
    return jsonb_build_object('ok',false,'error','evaluacion_con_intentos'); end if;
  delete from eval_preguntas where id=p_pregunta_id;
  return jsonb_build_object('ok',true);
end; $$;
grant execute on function admin_delete_pregunta(bigint) to anon, authenticated;
