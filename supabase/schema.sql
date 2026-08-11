-- Esquema del dashboard territorial (Realty GI)
--
-- Reconstruido a partir de las consultas de lib/data.ts, porque el proyecto
-- Supabase original (wmffxycqrojckcmmcutk) dejó de resolver por DNS y el repo
-- nunca tuvo migraciones. Correr entero sobre un proyecto nuevo deja la app
-- levantando; los datos (proyectos, competencia, POIs) se cargan aparte.
--
-- La app se conecta solo con la anon key, así que todo lo que lee el mapa
-- necesita policy de lectura pública. Los puntos de usuario son abiertos a
-- propósito: no hay login en este dashboard.

-- ---------------------------------------------------------------- proyectos
create table if not exists public.realty_proyectos (
  id        text primary key,
  name      text not null,
  lat       double precision not null,
  lng       double precision not null,
  loc       text,
  tagline   text,
  url       text,
  img       text,
  logo_url  text,          -- /logos/<slug>.png rehosteado en Storage
  kml_url   text,          -- overlay KML del proyecto (opcional)
  orden     integer not null default 0,
  visible   boolean not null default true
);

alter table public.realty_proyectos enable row level security;

drop policy if exists "realty_proyectos lectura publica" on public.realty_proyectos;
create policy "realty_proyectos lectura publica"
  on public.realty_proyectos for select to anon, authenticated using (true);

-- -------------------------------------------------------------- competencia
-- La app consulta la vista v_competidores, nunca la tabla directamente.
create table if not exists public.competidores (
  id           bigint generated always as identity primary key,
  inmobiliaria text not null,
  proyecto     text not null,
  provincia    text,
  distrito     text,
  lat          double precision not null,
  lng          double precision not null,
  visible      boolean not null default true
);

alter table public.competidores enable row level security;

drop policy if exists "competidores lectura publica" on public.competidores;
create policy "competidores lectura publica"
  on public.competidores for select to anon, authenticated using (true);

create or replace view public.v_competidores as
  select inmobiliaria, proyecto, provincia, distrito, lat, lng, visible
  from public.competidores;

-- ------------------------------------------------------------------- POIs
-- Capas KML de contexto: tren, salud, finanzas, educación.
create table if not exists public.pois (
  id              text primary key,
  name            text not null,
  category        text not null default 'otro'
                  check (category in ('tren','salud','finanzas','educacion','otro')),
  kml_url         text not null,
  color           text,
  default_visible boolean not null default false,
  orden           integer not null default 0
);

alter table public.pois enable row level security;

drop policy if exists "pois lectura publica" on public.pois;
create policy "pois lectura publica"
  on public.pois for select to anon, authenticated using (true);

-- ------------------------------------------------- puntos marcados a mano
-- Sin auth: cualquiera que abra el dashboard puede añadir y borrar puntos.
create table if not exists public.user_points (
  id          bigint generated always as identity primary key,
  name        text not null,
  description text,
  lat         double precision not null,
  lng         double precision not null,
  color       text not null default '#7c3aed',
  created_at  timestamptz not null default now()
);

alter table public.user_points enable row level security;

drop policy if exists "user_points lectura publica" on public.user_points;
create policy "user_points lectura publica"
  on public.user_points for select to anon, authenticated using (true);

drop policy if exists "user_points alta publica" on public.user_points;
create policy "user_points alta publica"
  on public.user_points for insert to anon, authenticated with check (true);

drop policy if exists "user_points baja publica" on public.user_points;
create policy "user_points baja publica"
  on public.user_points for delete to anon, authenticated using (true);

create index if not exists user_points_created_at_idx
  on public.user_points (created_at desc);

-- --------------------------------------------------------------- ajustes
-- Clave/valor. Claves en uso: earth_project_url, brand_logo_url.
create table if not exists public.app_settings (
  key   text primary key,
  value text
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings lectura publica" on public.app_settings;
create policy "app_settings lectura publica"
  on public.app_settings for select to anon, authenticated using (true);

insert into public.app_settings (key, value) values
  ('earth_project_url', ''),
  ('brand_logo_url', '')
on conflict (key) do nothing;

-- --------------------------------------------------------------- storage
-- Bucket público donde viven los logos y los KML que sirve el sidebar.
insert into storage.buckets (id, name, public) values ('public-assets', 'public-assets', true)
on conflict (id) do nothing;
