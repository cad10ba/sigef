-- ====================================================================
-- 011 — Trava as funções RPC do SIGEF
-- ====================================================================
-- Problemas corrigidos:
--   1. sigef_register_user podia ser chamada por qualquer pessoa com a chave
--      pública (anon), inclusive com p_role = 'admin'.
--   2. sigef_change_password não conferia quem estava chamando: servia de
--      "oráculo" para testar senhas de qualquer usuário sem limite.
--   3. sigef_login / sigef_login_session (login antigo, paralelo ao Supabase
--      Auth) aceitavam tentativas ilimitadas e o atalho "admin".
--   4. sigef_delete_rows apagava a tabela inteira para qualquer sessão
--      válida; agora o "apagar tudo" é só de administrador.
--   5. Senha mínima sobe de 4 para 8 caracteres (só para senhas novas).
--   6. Funções internas deixam de ser executáveis por anon/authenticated.
-- ====================================================================

begin;

-- Helpers ------------------------------------------------------------
create or replace function public.sigef_current_app_user_id()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select u.id from public.app_users u
     where auth.uid() is not null and u.auth_id = auth.uid()
     limit 1;
$$;

create or replace function public.sigef_is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1 from public.app_users u
         where auth.uid() is not null
           and u.auth_id = auth.uid()
           and u.role = 'admin'
    );
$$;

revoke all on function public.sigef_current_app_user_id() from public;
revoke all on function public.sigef_is_app_admin() from public;
grant execute on function public.sigef_current_app_user_id() to authenticated, service_role;
grant execute on function public.sigef_is_app_admin() to authenticated, service_role;

-- 1. Cadastro de usuários: só administrador logado ---------------------
alter function public.sigef_register_user(text, text, text, text, text, text, text)
    rename to sigef_register_user_core;
revoke all on function public.sigef_register_user_core(text, text, text, text, text, text, text)
    from public, anon, authenticated;

create function public.sigef_register_user(
    p_id text, p_name text, p_role text, p_registration text,
    p_email text, p_role_label text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
    if not public.sigef_is_app_admin() then
        return jsonb_build_object('success', false,
            'message', 'Somente administradores logados podem cadastrar usuários.');
    end if;
    if coalesce(nullif(btrim(p_role), ''), 'docente') not in ('admin', 'docente', 'monitor', 'estagiario') then
        return jsonb_build_object('success', false, 'message', 'Perfil de acesso inválido.');
    end if;
    if length(btrim(coalesce(p_password, ''))) < 8 then
        return jsonb_build_object('success', false,
            'message', 'A senha deve conter no mínimo 8 caracteres.');
    end if;
    return public.sigef_register_user_core(
        p_id, p_name, p_role, p_registration, p_email, p_role_label, p_password);
end;
$$;

revoke all on function public.sigef_register_user(text, text, text, text, text, text, text) from public;
grant execute on function public.sigef_register_user(text, text, text, text, text, text, text)
    to authenticated, service_role;

-- 2. Troca de senha: só a própria conta, logada ------------------------
alter function public.sigef_change_password(text, text, text)
    rename to sigef_change_password_core;
revoke all on function public.sigef_change_password_core(text, text, text)
    from public, anon, authenticated;

create function public.sigef_change_password(
    p_user_id text, p_current_password text, p_new_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
    if public.sigef_current_app_user_id() is distinct from p_user_id then
        return jsonb_build_object('success', false,
            'message', 'Sessão expirada. Entre novamente para trocar a senha.');
    end if;
    if length(btrim(coalesce(p_new_password, ''))) < 8 then
        return jsonb_build_object('success', false,
            'message', 'A nova senha deve possuir pelo menos 8 caracteres.');
    end if;
    return public.sigef_change_password_core(p_user_id, p_current_password, p_new_password);
end;
$$;

revoke all on function public.sigef_change_password(text, text, text) from public;
grant execute on function public.sigef_change_password(text, text, text) to authenticated, service_role;

-- 3. Login antigo desativado (o app usa só o Supabase Auth) ------------
revoke all on function public.sigef_login(text, text) from public, anon, authenticated;
revoke all on function public.sigef_login_session(text, text) from public, anon, authenticated;

-- 4. "Apagar tudo" só para administrador ------------------------------
create or replace function public.sigef_delete_rows(p_token text, p_table text, p_ids text[] default null::text[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
     where token = p_token;
    return jsonb_build_object('success', true);
end;
$$;

-- 5. Funções internas: fora do alcance da API --------------------------
revoke all on function public.sigef_ensure_requester_for_user(text) from public, anon, authenticated;
revoke all on function public.sigef_app_users_requester_trigger() from public, anon, authenticated;
revoke all on function public.sigef_auth_user_deleted() from public, anon, authenticated;
revoke all on function public.sigef_loans_block_mutation() from public, anon, authenticated;

-- Funções de sessão por token: anon não precisa delas
revoke all on function public.sigef_upsert_rows(text, text, jsonb) from public, anon;
revoke all on function public.sigef_delete_rows(text, text, text[]) from public, anon;
revoke all on function public.sigef_delete_person(text, text) from public, anon;
revoke all on function public.sigef_list_users(text) from public, anon;
revoke all on function public.sigef_list_requesters(text) from public, anon;
revoke all on function public.sigef_list_loans(text) from public, anon;
revoke all on function public.sigef_list_reservations(text) from public, anon;
revoke all on function public.sigef_token_user(text) from public, anon, authenticated;
grant execute on function public.sigef_upsert_rows(text, text, jsonb) to authenticated, service_role;
grant execute on function public.sigef_delete_rows(text, text, text[]) to authenticated, service_role;
grant execute on function public.sigef_delete_person(text, text) to authenticated, service_role;
grant execute on function public.sigef_list_users(text) to authenticated, service_role;
grant execute on function public.sigef_list_requesters(text) to authenticated, service_role;
grant execute on function public.sigef_list_loans(text) to authenticated, service_role;
grant execute on function public.sigef_list_reservations(text) to authenticated, service_role;
grant execute on function public.sigef_session_from_auth() to authenticated, service_role;
revoke all on function public.sigef_session_from_auth() from public, anon;

commit;
