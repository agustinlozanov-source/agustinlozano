-- ============================================================================
-- SCALEx · Evaluaciones — FASE 3: /resultados por evaluación
-- ============================================================================
-- Lista pública (acceso abierto, igual que /resultados) de las evaluaciones que
-- tienen al menos un intento enviado, para poblar el selector del dashboard.
-- eval_resultados(evaluacion_id) ya existe (Fase 1) y filtra por evaluación.
-- ============================================================================

create or replace function eval_resultados_lista()
returns jsonb language sql security definer set search_path = public stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'titulo', e.titulo, 'programa', e.programa,
           'anio', e.anio, 'modulo', e.modulo, 'bloque', e.bloque,
           'intentos', (select count(*) from eval_intentos i where i.evaluacion_id=e.id and i.enviado_en is not null)
         ) order by e.programa, e.anio desc, e.modulo, e.bloque), '[]'::jsonb)
  from evaluaciones e
  where exists (select 1 from eval_intentos i where i.evaluacion_id=e.id and i.enviado_en is not null);
$$;

revoke all on function eval_resultados_lista() from public;
grant execute on function eval_resultados_lista() to anon, authenticated;
