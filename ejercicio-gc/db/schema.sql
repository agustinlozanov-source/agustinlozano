-- ============================================================================
-- SCALEx · Ejercicio interactivo "¿Qué es Gobierno Corporativo?" — Supabase
-- ============================================================================
-- Tiempo real vía Supabase Realtime. Acceso abierto (ejercicio en vivo en clase):
--   - anon puede LEER las 3 tablas y ESCRIBIR respuestas y votos.
--   - anon NO puede modificar la síntesis ni el estado de la sesión: eso solo lo
--     hace la función Netlify con la service_role key (facilitador).
-- Reutilizable: cada "sesión" (gc_sesiones) tiene su propia pregunta y estado;
-- "Reiniciar" limpia respuestas/votos y vuelve a 'collecting'.
-- ============================================================================

create table if not exists gc_sesiones (
  id         text primary key,               -- 'gobierno-corporativo'
  titulo     text not null,
  subtitulo  text,
  pregunta   text not null,
  estado     text not null default 'collecting',  -- collecting | voting | closed
  sintesis   jsonb not null default '[]',          -- [{label,text}]
  creado_en  timestamptz not null default now()
);

create table if not exists gc_respuestas (
  id              bigint generated always as identity primary key,
  sesion_id       text not null references gc_sesiones(id) on delete cascade,
  participante_id text not null,              -- generado en el cliente
  nombre          text not null,
  texto           text not null,
  creado_en       timestamptz not null default now(),
  unique (sesion_id, participante_id)         -- 1 respuesta por persona
);

create table if not exists gc_votos (
  id              bigint generated always as identity primary key,
  sesion_id       text not null references gc_sesiones(id) on delete cascade,
  participante_id text not null,
  opcion          text not null,              -- label: "Opción A" | "B" | "C"
  creado_en       timestamptz not null default now(),
  unique (sesion_id, participante_id)         -- 1 voto por persona
);

create index if not exists idx_gc_respuestas_sesion on gc_respuestas(sesion_id);
create index if not exists idx_gc_votos_sesion       on gc_votos(sesion_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table gc_sesiones   enable row level security;
alter table gc_respuestas enable row level security;
alter table gc_votos      enable row level security;

drop policy if exists gc_ses_sel   on gc_sesiones;
drop policy if exists gc_resp_sel  on gc_respuestas;
drop policy if exists gc_resp_ins  on gc_respuestas;
drop policy if exists gc_vote_sel  on gc_votos;
drop policy if exists gc_vote_ins  on gc_votos;

create policy gc_ses_sel  on gc_sesiones   for select to anon, authenticated using (true);
create policy gc_resp_sel on gc_respuestas for select to anon, authenticated using (true);
create policy gc_resp_ins on gc_respuestas for insert to anon, authenticated with check (true);
create policy gc_vote_sel on gc_votos      for select to anon, authenticated using (true);
create policy gc_vote_ins on gc_votos      for insert to anon, authenticated with check (true);
-- (sin policies de UPDATE/DELETE → anon no puede alterar síntesis/estado ni borrar)

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Agrega las tablas a la publicación de realtime (ignora si ya están).
do $$ begin
  alter publication supabase_realtime add table gc_sesiones;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table gc_respuestas;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table gc_votos;
exception when duplicate_object then null; end $$;

-- ── Seed de la sesión del ejercicio ───────────────────────────────────────────
insert into gc_sesiones (id, titulo, subtitulo, pregunta) values (
  'gobierno-corporativo',
  '¿Qué es Gobierno Corporativo?',
  'Diplomado en Alta Dirección · Módulo 6',
  'En tus propias palabras, sin buscar en Google, sin definición de libro. ¿Qué significa para ti Gobierno Corporativo?'
)
on conflict (id) do nothing;
