-- Modül 1: hesap altyapısı.
--   public.profiles      : auth.users ile 1:1 profil + yasal metin onayı (kullanıcı kendi satırını okur, yalnızca ad/dil günceller)
--   public.apple_tokens  : hesap silinirken Apple erişim iznini iptal etmek için yenileme belirteci (yalnızca service_role)
--
-- KURAL: Sonraki modüllerde kullanıcıya ait HER tablo `user_id uuid references auth.users(id) on delete cascade`
-- olmalı ve RLS açık olmalıdır; hesap silme (Edge Function `delete-account`) bu zincire güvenir.

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text check (display_name is null or char_length(display_name) <= 40),
  lang           text check (lang is null or lang in ('tr', 'en', 'es', 'it', 'zh')),
  consent_version text check (consent_version is null or char_length(consent_version) <= 32),
  consent_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- Okuma ve güncelleme yalnızca kendi satırı; ekleme/silme politikası YOK (ekleme tetikleyiciyle, silme cascade ile)
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- Sütun düzeyinde yetki: kullanıcı id, onay alanları ve tarihleri değiştiremez
grant update (display_name, lang) on public.profiles to authenticated;

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- Yeni kullanıcı için profil. Üst veri (raw_user_meta_data) istemciden gelir ve GÜVENİLMEZ: kısaltılır, doğrulanır,
-- onay zamanı istemcinin iddiası değil sunucu saatidir.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name  text  := nullif(left(btrim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), 40), '');
  v_lang  text  := meta ->> 'lang';
  v_cons  text  := nullif(left(btrim(coalesce(meta ->> 'consent_version', '')), 32), '');
begin
  insert into public.profiles (id, display_name, lang, consent_version, consent_at)
  values (new.id, v_name, case when v_lang in ('tr', 'en', 'es', 'it', 'zh') then v_lang end, v_cons, case when v_cons is not null then now() end);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Yeni yasal metin sürümünü kabul: yalnızca oturumdaki kullanıcının kendi satırı
create function public.accept_terms(p_version text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_version is null or char_length(btrim(p_version)) not between 1 and 32 then
    raise exception 'invalid version' using errcode = '22023';
  end if;
  update public.profiles set consent_version = btrim(p_version), consent_at = now() where id = (select auth.uid());
end $$;

revoke all on function public.accept_terms(text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- Apple yenileme belirteci: RLS açık + hiç politika + hiçbir yetki = yalnızca service_role (RLS'i aşar) erişir.
-- Üretimde Supabase Vault ile şifrelenmesi önerilir (docs/ARCHITECTURE.md).
create table public.apple_tokens (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  created_at    timestamptz not null default now()
);
alter table public.apple_tokens enable row level security;
alter table public.apple_tokens force row level security;
revoke all on public.apple_tokens from anon, authenticated;
