-- 013_integridade_e_tokens.sql
-- SIGEF: tokens de sessão guardados como hash SHA-256, chaves estrangeiras e campos únicos.
-- Preparado em 2026-11-11. Aplicar só com aprovação.

begin;

-- 1. Tokens de sessão em hash -------------------------------------------------
create or replace function public.sigef_hash_token(p_token text)
returns text language sql immutable
set search_path = extensions, pg_temp
as $$ select encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') $$;
revoke all on function public.sigef_hash_token(text) from public, anon, authenticated;

-- Sessões abertas continuam valendo: o token atual vira hash uma única vez.
update public.app_sessions set token = public.sigef_hash_token(token);

-- sigef_list_users
CREATE OR REPLACE FUNCTION public.sigef_list_users(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
    v_user_id text;
    v_role    text;
    v_users   jsonb;
begin
    if btrim(coalesce(p_token, '')) = '' then
        return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
    end if;

    select u.id, u.role
      into v_user_id, v_role
      from public.app_sessions s
      join public.app_users u on u.id = s.user_id
     where s.token = public.sigef_hash_token(p_token)
       and s.expires_at > now();

    if v_user_id is null then
        return jsonb_build_object('success', false, 'message', 'Sessão expirada. Entre novamente.');
    end if;

    if v_role <> 'admin' then
        return jsonb_build_object('success', false, 'message', 'Acesso restrito à administração.');
    end if;

    -- Renovação deslizante enquanto a sessão é usada.
    update public.app_sessions
       set expires_at = now() + interval '12 hours'
     where token = public.sigef_hash_token(p_token);

    select coalesce(
               jsonb_agg(
                   jsonb_build_object(
                       'id',         u.id,
                       'name',       u.name,
                       'role',       u.role,
                       'registration', u.registration,
                       'email',      u.email,
                       'roleLabel',  u.role_label,
                       'createdAt',  u.created_at
                   )
                   order by case u.role
                                when 'admin'      then 0
                                when 'docente'    then 1
                                when 'monitor'    then 2
                                when 'estagiario' then 3
                                else 4
                            end,
                            u.name
               ),
               '[]'::jsonb
           )
      into v_users
      from public.app_users u
     where u.id <> v_user_id;

    return jsonb_build_object('success', true, 'users', v_users);
end;
$function$;

-- sigef_logout
CREATE OR REPLACE FUNCTION public.sigef_logout(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
begin
    delete from public.app_sessions where token = public.sigef_hash_token(p_token);
    return jsonb_build_object('success', true);
end;
$function$;

-- sigef_login_session
CREATE OR REPLACE FUNCTION public.sigef_login_session(p_identifier text, p_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
    v_result jsonb;
    v_user_id text;
    v_token   text;
begin
    v_result := public.sigef_login(p_identifier, p_password);

    if not coalesce((v_result->>'success')::boolean, false) then
        return v_result;
    end if;

    v_user_id := v_result->'user'->>'id';
    if v_user_id is null then
        return v_result;
    end if;

    -- Limpeza oportunista de sessões vencidas.
    delete from public.app_sessions where expires_at < now();

    v_token := encode(gen_random_bytes(32), 'hex');

    insert into public.app_sessions (token, user_id, expires_at)
    values (public.sigef_hash_token(v_token), v_user_id, now() + interval '12 hours');

    return v_result || jsonb_build_object('session_token', v_token);
end;
$function$;

-- sigef_list_loans
CREATE OR REPLACE FUNCTION public.sigef_list_loans(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_rows jsonb;
begin
    if public.sigef_token_user(p_token) is null then
        return jsonb_build_object('success', false, 'message', 'Sessão expirada. Entre novamente.');
    end if;

    update public.app_sessions
       set expires_at = now() + interval '12 hours'
     where token = public.sigef_hash_token(p_token);

    select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc nulls last), '[]'::jsonb)
      into v_rows
      from public.loans l;

    return jsonb_build_object('success', true, 'loans', v_rows);
end;
$function$;

-- sigef_list_reservations
CREATE OR REPLACE FUNCTION public.sigef_list_reservations(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_rows jsonb;
begin
    if public.sigef_token_user(p_token) is null then
        return jsonb_build_object('success', false, 'message', 'Sessão expirada. Entre novamente.');
    end if;

    update public.app_sessions
       set expires_at = now() + interval '12 hours'
     where token = public.sigef_hash_token(p_token);

    select coalesce(
               jsonb_agg(to_jsonb(r) order by r.date, r.start_time, r.created_at),
               '[]'::jsonb
           )
      into v_rows
      from public.reservations r;

    return jsonb_build_object('success', true, 'reservations', v_rows);
end;
$function$;

-- sigef_session_from_auth
CREATE OR REPLACE FUNCTION public.sigef_session_from_auth()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
    v_auth_id uuid := auth.uid();
    v_user    public.app_users%rowtype;
    v_token   text;
begin
    if v_auth_id is null then
        return jsonb_build_object(
            'success', false,
            'message', 'Sessão do Supabase Auth não encontrada. Entre novamente.'
        );
    end if;

    select * into v_user from public.app_users where auth_id = v_auth_id;

    if not found then
        return jsonb_build_object(
            'success', false,
            'message', 'Nenhuma conta do sistema está ligada a este usuário.'
        );
    end if;

    delete from public.app_sessions where expires_at < now();

    v_token := encode(gen_random_bytes(32), 'hex');

    insert into public.app_sessions (token, user_id, expires_at)
    values (public.sigef_hash_token(v_token), v_user.id, now() + interval '12 hours');

    return jsonb_build_object(
        'success', true,
        'session_token', v_token,
        'user', jsonb_build_object(
            'id', v_user.id,
            'name', v_user.name,
            'role', v_user.role,
            'registration', v_user.registration,
            'email', v_user.email,
            'roleLabel', v_user.role_label,
            'createdAt', v_user.created_at
        )
    );
end;
$function$;

-- sigef_token_user
CREATE OR REPLACE FUNCTION public.sigef_token_user(p_token text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    select s.user_id
      from public.app_sessions s
     where s.token = public.sigef_hash_token(p_token)
       and s.expires_at > now()
$function$;

-- sigef_upsert_rows
CREATE OR REPLACE FUNCTION public.sigef_upsert_rows(p_token text, p_table text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_allowed constant text[] := array[
        'spaces', 'materials', 'kits', 'notices',
        'regulation', 'requesters', 'loans', 'reservations'
    ];
    v_relid regclass;
    v_cols  text;
    v_set   text;
begin
    if public.sigef_token_user(p_token) is null then
        return jsonb_build_object('success', false, 'message', 'Sessão expirada. Entre novamente.');
    end if;

    if p_table is null or not (p_table = any(v_allowed)) then
        return jsonb_build_object('success', false, 'message', 'Tabela não permitida.');
    end if;

    if p_rows is null
       or jsonb_typeof(p_rows) <> 'array'
       or jsonb_array_length(p_rows) = 0 then
        return jsonb_build_object('success', true, 'count', 0);
    end if;

    if jsonb_typeof(p_rows -> 0) <> 'object' then
        return jsonb_build_object('success', false, 'message', 'Formato de dados inválido.');
    end if;

    v_relid := format('public.%I', p_table)::regclass;

    select string_agg(format('%I', a.attname), ', ')
      into v_cols
      from pg_attribute a
     where a.attrelid = v_relid
       and a.attnum > 0
       and not a.attisdropped
       and a.attname in (
             select jsonb_object_keys(r)
               from jsonb_array_elements(p_rows) r
           );

    select string_agg(format('%I = excluded.%I', a.attname, a.attname), ', ')
      into v_set
      from pg_attribute a
     where a.attrelid = v_relid
       and a.attnum > 0
       and not a.attisdropped
       and a.attname <> 'id'
       and a.attname in (
             select jsonb_object_keys(r)
               from jsonb_array_elements(p_rows) r
           );

    if v_cols is null or btrim(v_cols) = '' then
        return jsonb_build_object('success', false, 'message', 'Nenhuma coluna válida nos dados.');
    end if;

    if v_set is null then
        execute format(
            'insert into public.%1$I (%2$s)
             select %2$s from jsonb_populate_recordset(null::public.%1$I, $1)
             on conflict (id) do nothing',
            p_table, v_cols
        ) using p_rows;
    else
        execute format(
            'insert into public.%1$I (%2$s)
             select %2$s from jsonb_populate_recordset(null::public.%1$I, $1)
             on conflict (id) do update set %3$s',
            p_table, v_cols, v_set
        ) using p_rows;
    end if;

    update public.app_sessions
       set expires_at = now() + interval '12 hours'
     where token = public.sigef_hash_token(p_token);

    return jsonb_build_object('success', true, 'count', jsonb_array_length(p_rows));
exception
    when foreign_key_violation then
        return jsonb_build_object('success', false,
            'message', 'Não foi possível salvar ou excluir: o registro está ligado a outro (ex.: espaço com reservas, pessoa com empréstimos).');
    when unique_violation then
        return jsonb_build_object('success', false,
            'message', 'Já existe um cadastro com esse tombo, matrícula ou e-mail.');
end;
$function$;

-- sigef_delete_rows
CREATE OR REPLACE FUNCTION public.sigef_delete_rows(p_token text, p_table text, p_ids text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_allowed constant text[] := array[
        'spaces', 'materials', 'kits', 'notices', 'requesters', 'reservations'
    ];
    v_caller text;
begin
    v_caller := public.sigef_token_user(p_token);
    if v_caller is null then
        return jsonb_build_object('success', false, 'message', 'Sessão expirada. Entre novamente.');
    end if;
    if p_table is null or not (p_table = any(v_allowed)) then
        return jsonb_build_object('success', false, 'message', 'Tabela não permitida.');
    end if;
    if p_ids is null or array_length(p_ids, 1) is null then
        if not exists (select 1 from public.app_users u where u.id = v_caller and u.role = 'admin') then
            return jsonb_build_object('success', false,
                'message', 'Somente administradores podem apagar todos os registros.');
        end if;
        execute format('delete from public.%I', p_table);
    else
        execute format('delete from public.%I where id = any($1)', p_table) using p_ids;
    end if;
    update public.app_sessions
       set expires_at = now() + interval '12 hours'
     where token = public.sigef_hash_token(p_token);
    return jsonb_build_object('success', true);
exception
    when foreign_key_violation then
        return jsonb_build_object('success', false,
            'message', 'Não foi possível salvar ou excluir: o registro está ligado a outro (ex.: espaço com reservas, pessoa com empréstimos).');
    when unique_violation then
        return jsonb_build_object('success', false,
            'message', 'Já existe um cadastro com esse tombo, matrícula ou e-mail.');
end;
$function$;

-- sigef_delete_person
CREATE OR REPLACE FUNCTION public.sigef_delete_person(p_token text, p_requester_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_caller_id   text;
    v_caller_role text;
    v_req         public.requesters%rowtype;
    v_user_id     text;
    v_user_role   text;
    v_auth_id     uuid;
    v_admin_count int;
begin
    v_caller_id := public.sigef_token_user(p_token);
    if v_caller_id is null then
        return jsonb_build_object('success', false, 'message', 'Sessão expirada. Entre novamente.');
    end if;

    select u.role into v_caller_role from public.app_users u where u.id = v_caller_id;
    if coalesce(v_caller_role, '') <> 'admin' then
        return jsonb_build_object('success', false, 'message', 'Somente administradores podem excluir cadastros.');
    end if;

    if p_requester_id is null or p_requester_id = '' then
        return jsonb_build_object('success', false, 'message', 'Cadastro não informado.');
    end if;

    select * into v_req from public.requesters where id = p_requester_id;

    if p_requester_id like 'req-%' then
        v_user_id := 'user-' || substr(p_requester_id, 5);
        if not exists (select 1 from public.app_users u where u.id = v_user_id) then
            v_user_id := null;
        end if;
    end if;

    if v_user_id is null and coalesce(v_req.email, '') <> '' then
        select u.id into v_user_id
          from public.app_users u
         where lower(u.email) = lower(v_req.email)
         limit 1;
    end if;

    if v_user_id is not null then
        if v_user_id = v_caller_id then
            return jsonb_build_object('success', false, 'message', 'Você não pode excluir a própria conta.');
        end if;

        select u.role, u.auth_id into v_user_role, v_auth_id
          from public.app_users u
         where u.id = v_user_id;

        if v_user_role = 'admin' then
            select count(*) into v_admin_count from public.app_users u where u.role = 'admin';
            if v_admin_count <= 1 then
                return jsonb_build_object(
                    'success', false,
                    'message', 'É preciso manter ao menos um administrador no sistema.'
                );
            end if;
        end if;
    end if;

    delete from public.requesters where id = p_requester_id;

    if v_user_id is not null then
        delete from public.app_sessions where user_id = v_user_id;
        delete from public.app_users where id = v_user_id;
    end if;

    if v_auth_id is not null then
        delete from auth.users where id = v_auth_id;
    end if;

    update public.app_sessions
       set expires_at = now() + interval '12 hours'
     where token = public.sigef_hash_token(p_token);

    return jsonb_build_object('success', true, 'removed_account', v_user_id is not null);
exception
    when foreign_key_violation then
        return jsonb_build_object('success', false,
            'message', 'Não foi possível salvar ou excluir: o registro está ligado a outro (ex.: espaço com reservas, pessoa com empréstimos).');
    when unique_violation then
        return jsonb_build_object('success', false,
            'message', 'Já existe um cadastro com esse tombo, matrícula ou e-mail.');
end;
$function$;

-- sigef_list_requesters
CREATE OR REPLACE FUNCTION public.sigef_list_requesters(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
    v_user_id    text;
    v_requesters jsonb;
begin
    if btrim(coalesce(p_token, '')) = '' then
        return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
    end if;

    select u.id
      into v_user_id
      from public.app_sessions s
      join public.app_users u on u.id = s.user_id
     where s.token = public.sigef_hash_token(p_token)
       and s.expires_at > now();

    if v_user_id is null then
        return jsonb_build_object('success', false, 'message', 'Sessão expirada. Entre novamente.');
    end if;

    -- Renovação deslizante enquanto a sessão é usada.
    update public.app_sessions
       set expires_at = now() + interval '12 hours'
     where token = public.sigef_hash_token(p_token);

    select coalesce(
               jsonb_agg(
                   jsonb_build_object(
                       'id',                   r.id,
                       'name',                 r.name,
                       'type',                 r.type,
                       'registration',         r.registration,
                       'course_or_department', r.course_or_department,
                       'class_group',          r.class_group,
                       'email',                r.email,
                       'phone',                r.phone,
                       'supervisor_name',      r.supervisor_name,
                       'shift',                r.shift,
                       'workload_hours',       r.workload_hours,
                       'assigned_area',        r.assigned_area,
                       'is_blocked',           r.is_blocked,
                       'block_reason',         r.block_reason
                   )
                   order by r.name
               ),
               '[]'::jsonb
           )
      into v_requesters
      from public.requesters r;

    return jsonb_build_object('success', true, 'requesters', v_requesters);
end;
$function$;


-- 2. Chaves estrangeiras ------------------------------------------------------
alter table public.reservations
  add constraint reservations_space_fk foreign key (space_id) references public.spaces(id) on delete restrict;
alter table public.loans
  add constraint loans_requester_fk foreign key (requester_id) references public.requesters(id) on delete restrict,
  add constraint loans_supervisor_fk foreign key (supervisor_teacher_id) references public.requesters(id) on delete set null,
  add constraint loans_kit_fk foreign key (kit_id) references public.kits(id) on delete set null;
alter table public.app_users
  add constraint app_users_auth_fk foreign key (auth_id) references auth.users(id) on delete set null;
-- reservations.teacher_id fica sem FK: o app grava 'doc-custom' para docente avulso.

create index if not exists idx_reservations_space_id on public.reservations(space_id);
create index if not exists idx_loans_requester_id on public.loans(requester_id);
create index if not exists idx_loans_supervisor_id on public.loans(supervisor_teacher_id);
create index if not exists idx_loans_kit_id on public.loans(kit_id);

-- 3. Campos únicos (vazios não contam) ----------------------------------------
create unique index materials_patrimony_uq on public.materials (btrim(patrimony_number)) where btrim(patrimony_number) <> '';
create unique index requesters_registration_uq on public.requesters (btrim(registration)) where btrim(registration) <> '';
create unique index app_users_email_uq on public.app_users (lower(btrim(email)));
create unique index app_users_registration_uq on public.app_users (btrim(registration)) where btrim(registration) <> '';

commit;
