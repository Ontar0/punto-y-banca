-- =============================================================
--  Punto y Banca 2.0 — Esquema para Supabase
--  Pegá TODO este archivo en:  Supabase → SQL Editor → New query → Run
-- =============================================================

-- Tabla donde se archiva cada tablero terminado.
create table if not exists public.boards (
  id          uuid primary key default gen_random_uuid(),
  device_id   uuid        not null,
  created_at  timestamptz not null default now(),
  passes      integer     not null default 0,
  count_p     integer     not null default 0,
  count_b     integer     not null default 0,
  count_a     integer     not null default 0,
  sequence    text[]      not null default '{}'
);

create index if not exists boards_device_id_idx  on public.boards (device_id);
create index if not exists boards_created_at_idx on public.boards (created_at desc);

-- -------------------------------------------------------------
--  Seguridad a nivel de fila (RLS)
--  - anon  (jugadores): SOLO pueden INSERTAR.
--  - authenticated (vos, admin): pueden LEER.
--  - Nadie puede UPDATE ni DELETE (no se definen políticas).
-- -------------------------------------------------------------
alter table public.boards enable row level security;

drop policy if exists "anon insert boards" on public.boards;
create policy "anon insert boards"
  on public.boards
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "admins read boards" on public.boards;
create policy "admins read boards"
  on public.boards
  for select
  to authenticated
  using (true);
