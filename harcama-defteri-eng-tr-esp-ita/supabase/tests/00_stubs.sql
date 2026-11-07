-- Gerçek Supabase'in auth şemasının test için en küçük taklidi (yalnızca testte çalışır, migration'a girmez).
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb,
  last_sign_in_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase varsayılanı: public'te yeni tablolar anon/authenticated/service_role'a TAM yetkiyle açılır. Migration bunu daraltmak zorundadır.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
