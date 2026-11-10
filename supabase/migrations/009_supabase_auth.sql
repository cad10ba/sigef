-- ====================================================================
-- SIGEF — 009: credenciais no Supabase Auth
-- ====================================================================
-- Antes
--   A senha vivia apenas em public.app_users.password_hash (bcrypt) e o
--   login era a RPC sigef_login_session. Nenhuma conta existia em
--   auth.users, então o app não tinha identidade Supabase (auth.uid()).
--
-- Depois
--   auth.users passa a ser o cadastro de credenciais. public.app_users vira o
--   perfil do sistema (papel, matrícula, rótulo) ligado por auth_id.
--     - as contas existentes são copiadas com o MESMO hash bcrypt, então as
--       senhas atuais continuam valendo (sem pedir nova senha a ninguém);
--     - o login do app usa supabase.auth.signInWithPassword e depois
--       sigef_session_from_auth(), que emite o token de sessão de sempre;
--     - cadastro, troca de senha e exclusão mantêm auth.users em sincronia;
--     - excluir a conta em auth.users remove o perfil e o solicitante.
--
--   sigef_login_session continua existindo como caminho de emergência: os
--   hashes seguem iguais nas duas tabelas.
--
-- É idempotente: pode ser executada mais de uma vez sem efeito colateral.
-- ====================================================================

begin;

-- ----------------------------------------------------------------
-- 1. Vínculo entre o perfil e a identidade do Supabase Auth
-- ----------------------------------------------------------------
alter table public.app_users add column if not exists auth_id uuid;

create unique index if not exists app_users_auth_id_key
    on public.app_users (auth_id);

-- ----------------------------------------------------------------
-- 2. Copia as contas existentes para auth.users
-- ----------------------------------------------------------------
do $$
declare
    r          record;
    v_auth_id  uuid;
begin
    for r in select * from public.app_users where auth_id is null loop
        select au.id into v_auth_id
          from auth.users au
         where lower(au.email) = lower(r.email)
         limit 1;

        if v_auth_id is null then
            v_auth_id := gen_random_uuid();

            insert into auth.users (
                instance_id, id, aud, role, email, encrypted_password,
                email_confirmed_at, created_at, updated_at,
                raw_app_meta_data, raw_user_meta_data,
                confirmation_token, recovery_token, email_change,
                email_change_token_new, email_change_token_current,
                phone_change, phone_change_token, reauthentication_token
            ) values (
                '00000000-0000-0000-0000-000000000000',
                v_auth_id,
                'authenticated',
                'authenticated',
                lower(r.email),
                r.password_hash,
                now(),
                coalesce(r.created_at, now()),
                now(),
                '{"provider":"email","providers":["email"]}'::jsonb,
                jsonb_build_object(
                    'name', r.name,
                    'role', r.role,
                    'registration', r.registration
                ),
                '', '', '', '', '', '', '', ''
            );

            insert into auth.identities (
                id, user_id, provider_id, provider, identity_data,
                last_sign_in_at, created_at, updated_at
            ) values (
                gen_random_uuid(),
                v_auth_id,
                v_auth_id::text,
                'email',
                jsonb_build_object(
                    'sub', v_auth_id::text,
                    'email', lower(r.email),
                    'email_verified', true
                ),
                now(), now(), now()
            );
        elsif not exists (
            select 1 from auth.identities i where i.user_id = v_auth_id
        ) then
            insert into auth.identities (
                id, user_id, provider_id, provider, identity_data,
                last_sign_in_at, created_at, updated_at
            ) values (
                gen_random_uuid(),
                v_auth_id,
                v_auth_id::text,
                'email',
                jsonb_build_object(
                    'sub', v_auth_id::text,
                    'email', lower(r.email),
                    'email_verified', true
                ),
                now(), now(), now()
            );
        end if;

        update public.app_users set auth_id = v_auth_id where id = r.id;
    end loop;
end $$;

-- ----------------------------------------------------------------
-- 3. Excluir em auth.users limpa o perfil do sistema
-- ----------------------------------------------------------------
create or replace function public.sigef_auth_user_deleted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    delete from public.requesters
     where lower(email) = lower(old.email);

    delete from public.app_users where auth_id = old.id;
    return old;
end;
$$;

revoke all on function public.sigef_auth_user_deleted() from public;

drop trigger if exists on_auth_user_deleted_sigef on auth.users;
create trigger on_auth_user_deleted_sigef
    after delete on auth.users
    for each row execute function public.sigef_auth_user_deleted();

-- ----------------------------------------------------------------
-- 4. Identificador -> e-mail (o login aceita matrícula/SIAPE)
-- ----------------------------------------------------------------
create or replace function public.sigef_resolve_identifier(p_identifier text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
    select coalesce(
        (select jsonb_build_object(
                    'success', true,
                    'email', u.email,
                    'name', u.name)
           from public.app_users u
          where lower(u.email) = lower(btrim(coalesce(p_identifier, '')))
             or lower(u.registration) = lower(btrim(coalesce(p_identifier, '')))
          limit 1),
        jsonb_build_object('success', false)
    );
$$;

revoke all on function public.sigef_resolve_identifier(text) from public;
grant execute on function public.sigef_resolve_identifier(text)
    to anon, authenticated, service_role;

-- ----------------------------------------------------------------
-- 5. Sessão do app a partir do JWT do Supabase Auth
-- ----------------------------------------------------------------
create or replace function public.sigef_session_from_auth()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
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
    values (v_token, v_user.id, now() + interval '12 hours');

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
$$;

revoke all on function public.sigef_session_from_auth() from public;
grant execute on function public.sigef_session_from_auth()
    to authenticated, service_role;

-- ----------------------------------------------------------------
-- 6. Cadastro cria a credencial em auth.users
-- ----------------------------------------------------------------
create or replace function public.sigef_register_user(
    p_id           text,
    p_name         text,
    p_role         text,
    p_registration text,
    p_email        text,
    p_role_label   text,
    p_password     text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    v_user        public.app_users%rowtype;
    v_auth_id     uuid;
    v_clean_email text := lower(btrim(coalesce(p_email, '')));
    v_clean_reg   text := lower(btrim(coalesce(p_registration, '')));
    v_pass        text := btrim(coalesce(p_password, ''));
begin
    if btrim(coalesce(p_id, '')) = ''
       or btrim(coalesce(p_name, '')) = ''
       or v_clean_email = ''
       or v_clean_reg = ''
       or length(v_pass) < 4 then
        return jsonb_build_object(
            'success', false,
            'message', 'Todos os campos obrigatórios devem ser preenchidos e a senha deve ter no mínimo 4 caracteres.'
        );
    end if;

    if exists (
        select 1 from public.app_users
         where id = p_id
            or lower(email) = v_clean_email
            or lower(registration) = v_clean_reg
    ) then
        return jsonb_build_object(
            'success', false,
            'message', 'Já existe um cadastro com este e-mail institucional ou matrícula/SIAPE.'
        );
    end if;

    select au.id into v_auth_id
      from auth.users au
     where lower(au.email) = v_clean_email
     limit 1;

    if v_auth_id is null then
        v_auth_id := gen_random_uuid();

        insert into auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, created_at, updated_at,
            raw_app_meta_data, raw_user_meta_data,
            confirmation_token, recovery_token, email_change,
            email_change_token_new, email_change_token_current,
            phone_change, phone_change_token, reauthentication_token
        ) values (
            '00000000-0000-0000-0000-000000000000',
            v_auth_id,
            'authenticated',
            'authenticated',
            v_clean_email,
            crypt(v_pass, gen_salt('bf', 10)),
            now(), now(), now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object(
                'name', btrim(p_name),
                'role', coalesce(nullif(btrim(p_role), ''), 'docente'),
                'registration', btrim(p_registration)
            ),
            '', '', '', '', '', '', '', ''
        );

        insert into auth.identities (
            id, user_id, provider_id, provider, identity_data,
            last_sign_in_at, created_at, updated_at
        ) values (
            gen_random_uuid(),
            v_auth_id,
            v_auth_id::text,
            'email',
            jsonb_build_object(
                'sub', v_auth_id::text,
                'email', v_clean_email,
                'email_verified', true
            ),
            now(), now(), now()
        );
    else
        update auth.users
           set encrypted_password = crypt(v_pass, gen_salt('bf', 10)),
               updated_at = now()
         where id = v_auth_id;
    end if;

    insert into public.app_users (id, name, role, registration, email, role_label, password_hash, auth_id)
    values (
        p_id,
        btrim(p_name),
        coalesce(nullif(btrim(p_role), ''), 'docente'),
        btrim(p_registration),
        v_clean_email,
        coalesce(nullif(btrim(p_role_label), ''), 'Usuário'),
        crypt(v_pass, gen_salt('bf', 10)),
        v_auth_id
    );

    select * into v_user from public.app_users where id = p_id;

    return jsonb_build_object(
        'success', true,
        'message', 'Conta criada com sucesso!',
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
$$;

revoke all on function public.sigef_register_user(text, text, text, text, text, text, text) from public;
grant execute on function public.sigef_register_user(text, text, text, text, text, text, text)
    to anon, authenticated, service_role;

-- ----------------------------------------------------------------
-- 7. Troca de senha atualiza os dois lados
-- ----------------------------------------------------------------
create or replace function public.sigef_change_password(
    p_user_id          text,
    p_current_password text,
    p_new_password     text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    v_hash    text;
    v_auth_id uuid;
    v_current text := btrim(coalesce(p_current_password, ''));
    v_new     text := btrim(coalesce(p_new_password, ''));
begin
    if length(v_new) < 4 then
        return jsonb_build_object(
            'success', false,
            'message', 'A nova senha deve possuir pelo menos 4 caracteres.'
        );
    end if;

    select password_hash, auth_id into v_hash, v_auth_id
      from public.app_users
     where id = p_user_id;

    if v_hash is null or crypt(v_current, v_hash) <> v_hash then
        return jsonb_build_object(
            'success', false,
            'message', 'A senha atual informada está incorreta.'
        );
    end if;

    update public.app_users
       set password_hash = crypt(v_new, gen_salt('bf', 10))
     where id = p_user_id;

    if v_auth_id is not null then
        update auth.users
           set encrypted_password = crypt(v_new, gen_salt('bf', 10)),
               updated_at = now()
         where id = v_auth_id;
    end if;

    return jsonb_build_object('success', true, 'message', 'Senha atualizada com sucesso!');
end;
$$;

revoke all on function public.sigef_change_password(text, text, text) from public;
grant execute on function public.sigef_change_password(text, text, text)
    to anon, authenticated, service_role;

-- ----------------------------------------------------------------
-- 8. Excluir a pessoa remove a credencial em auth.users
-- ----------------------------------------------------------------
create or replace function public.sigef_delete_person(
    p_token        text,
    p_requester_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
     where token = p_token;

    return jsonb_build_object('success', true, 'removed_account', v_user_id is not null);
end;
$$;

revoke all on function public.sigef_delete_person(text, text) from public;
grant execute on function public.sigef_delete_person(text, text)
    to anon, authenticated, service_role;

commit;
