-- =============================================================
--  Punto y Banca 2.0 — Esquema para Supabase (versión robusta)
--  Copiá TODO este archivo en: SQL Editor → New query → Run
--  Al final, el Results debe mostrar:  rows | true
-- =============================================================

-- 1) Tabla (si ya existe, no hace nada)
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

-- 2) Quitar permisos previos y ACTIVAR la seguridad a nivel de fila
revoke all on public.boards from anon, authenticated;
alter table public.boards enable row level security;

-- 3) Políticas
drop policy if exists "anon insert boards" on public.boards;
create policy "anon insert boards"
  on public.boards
  for insert
  to anon
  with check (true);

drop policy if exists "admins read boards" on public.boards;
create policy "admins read boards"
  on public.boards
  for select
  to authenticated
  using (true);

-- 4) Permisos mínimos (grants). Sin estos, hasta con RLS activo el API
--    responde "permission denied".
grant insert on public.boards to anon;
grant select on public.boards to authenticated;

-- 5) VERIFICACIÓN VISIBLE:
--    Si en el Results aparece  boards | true  → la seguridad está ACTIVA.
select relname, relrowsecurity as rls_enabled
from pg_class
where relname = 'boards' and relnamespace = 'public'::regnamespace;