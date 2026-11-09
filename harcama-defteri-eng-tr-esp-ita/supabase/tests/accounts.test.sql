\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null
create temp table t_result (name text, ok boolean, detail text);
grant all on t_result to public;

create function pg_temp.ok(p_name text, p_cond boolean, p_detail text default '') returns void language plpgsql as $$
begin insert into t_result values (p_name, coalesce(p_cond, false), p_detail); end $$;

-- Beklenen hata sınıfı: yetki, RLS ya da kısıt ihlali
create function pg_temp.denied(p_name text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  insert into t_result values (p_name, false, 'hata beklenirdi ama çalıştı');
exception when insufficient_privilege or check_violation or raise_exception or invalid_parameter_value or others then
  insert into t_result values (p_name, true, sqlstate);
end $$;

-- Kullanıcılar (postgres olarak eklenir; tetikleyici profili üretir)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@x.co', jsonb_build_object('full_name', repeat('x', 100), 'lang', 'xx', 'consent_version', '2026-10-20', 'consent_at', '1999-01-01T00:00:00Z')),
  ('00000000-0000-0000-0000-00000000000b', 'b@x.co', jsonb_build_object('full_name', '  Bora  ', 'lang', 'en', 'consent_version', '2026-10-20')),
  ('00000000-0000-0000-0000-00000000000c', 'c@x.co', null);

select pg_temp.ok('tetikleyici: her kullanıcıya profil', (select count(*) from public.profiles) = 3);
select pg_temp.ok('tetikleyici: ad 40 karaktere kısaltılır', (select char_length(display_name) from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 40);
select pg_temp.ok('tetikleyici: geçersiz dil null olur', (select lang from public.profiles where id = '00000000-0000-0000-0000-00000000000a') is null);
select pg_temp.ok('tetikleyici: geçerli dil korunur', (select lang from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 'en');
select pg_temp.ok('tetikleyici: ad kırpılır', (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 'Bora');
select pg_temp.ok('tetikleyici: onay zamanı istemcinin iddiası değil sunucu saati', (select consent_at > now() - interval '1 minute' from public.profiles where id = '00000000-0000-0000-0000-00000000000a'));
select pg_temp.ok('tetikleyici: üst verisiz kullanıcı için boş profil', (select display_name is null and lang is null and consent_version is null and consent_at is null from public.profiles where id = '00000000-0000-0000-0000-00000000000c'));

-- Kullanıcı A olarak
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

select pg_temp.ok('RLS: A yalnızca kendi profilini görür', (select count(*) from public.profiles) = 1 and (select count(*) from public.profiles where id <> auth.uid()) = 0);
update public.profiles set display_name = 'Ayşe' where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.ok('A kendi adını günceller', (select count(*) from public.profiles where display_name = 'Ayşe' and id = auth.uid()) = 1);
select pg_temp.ok('updated_at tetikleyicisi çalışır', (select count(*) from public.profiles where id = auth.uid() and updated_at > created_at) = 1);
with u as (update public.profiles set display_name = 'HACK' where id = '00000000-0000-0000-0000-00000000000b' returning 1) select pg_temp.ok('RLS: A, Bora''nın profilini güncelleyemez (0 satır)', (select count(*) from u) = 0);
select pg_temp.denied('sütun yetkisi: A onay sürümünü doğrudan değiştiremez', $$update public.profiles set consent_version = 'x' where id = auth.uid()$$);
select pg_temp.denied('sütun yetkisi: A consent_at değiştiremez', $$update public.profiles set consent_at = now() where id = auth.uid()$$);
select pg_temp.denied('sütun yetkisi: A kimliğini değiştiremez', $$update public.profiles set id = gen_random_uuid() where id = auth.uid()$$);
select pg_temp.denied('A profil ekleyemez', $$insert into public.profiles (id) values (gen_random_uuid())$$);
select pg_temp.denied('A profil silemez', $$delete from public.profiles$$);
select pg_temp.denied('kısıt: 41 karakterlik ad reddedilir', $$update public.profiles set display_name = repeat('x', 41) where id = auth.uid()$$);
select pg_temp.denied('kısıt: geçersiz dil reddedilir', $$update public.profiles set lang = 'xx' where id = auth.uid()$$);
select pg_temp.denied('apple_tokens: A okuyamaz', $$select * from public.apple_tokens$$);
select pg_temp.denied('apple_tokens: A yazamaz', $$insert into public.apple_tokens (user_id, refresh_token) values (auth.uid(), 't')$$);
select pg_temp.denied('trigger işlevi A tarafından çağrılamaz', $$select public.handle_new_user()$$);

select public.accept_terms('2027-01-01');
select pg_temp.ok('accept_terms: A kendi onayını günceller', (select count(*) from public.profiles where id = auth.uid() and consent_version = '2027-01-01') = 1);
select pg_temp.denied('accept_terms: boş sürüm reddedilir', $$select public.accept_terms('')$$);
select pg_temp.denied('accept_terms: 33 karakter reddedilir', $$select public.accept_terms(repeat('v', 33))$$);
reset role;
select pg_temp.ok('accept_terms yalnızca çağıranı etkiler (B değişmedi)', (select consent_version from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = '2026-10-20');

-- Oturumsuz authenticated (sub yok)
set role authenticated;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.ok('sub yokken profil görünmez', (select count(*) from public.profiles) = 0);
select pg_temp.denied('sub yokken accept_terms reddedilir', $$select public.accept_terms('x')$$);
reset role;

-- anon
set role anon;
select pg_temp.denied('anon profilleri okuyamaz', $$select * from public.profiles$$);
select pg_temp.denied('anon apple_tokens okuyamaz', $$select * from public.apple_tokens$$);
select pg_temp.denied('anon accept_terms çağıramaz', $$select public.accept_terms('x')$$);
reset role;

-- service_role (Edge Function): RLS'i aşar, apple_tokens'a erişir
set role service_role;
insert into public.apple_tokens (user_id, refresh_token) values ('00000000-0000-0000-0000-00000000000a', 'r1');
select pg_temp.ok('service_role apple_tokens yazıp okur', (select refresh_token from public.apple_tokens) = 'r1');
reset role;

-- Silme zinciri: kullanıcı silinince profil ve belirteç de gider
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.ok('cascade: profil silinir', (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 0);
select pg_temp.ok('cascade: apple belirteci silinir', (select count(*) from public.apple_tokens) = 0);
select pg_temp.ok('cascade: diğer kullanıcılar etkilenmez', (select count(*) from public.profiles) = 2);

\o
\set QUIET off
select case when ok then 'OK    ' else 'HATA  ' end || name || case when ok then '' else ' — ' || coalesce(detail, '') end as sonuc from t_result order by ok, name;
select count(*) filter (where ok) || ' geçti, ' || count(*) filter (where not ok) || ' başarısız' as ozet from t_result;
do $$ begin if exists (select 1 from t_result where not ok) then raise exception 'SQL testleri başarısız'; end if; end $$;
