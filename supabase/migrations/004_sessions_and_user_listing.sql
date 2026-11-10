-- ====================================================================
-- SIGEF — 004: Sessão tokenizada + listagem de contas para administração
-- ====================================================================
-- Problema
--   O app autentica pela RPC sigef_login, mas não abre sessão no Supabase
--   Auth. Sem JWT autenticado, requesters/app_users ficam inacessíveis ao
--   cliente e a tela "Docentes & Alunos" aparece vazia — nem o admin vê as
--   demais contas.
--
-- Solução (mínima, sem migrar para o Supabase Auth)
--   1. app_sessions guarda tokens opacos emitidos no login (12 h, renováveis).
--      A tabela não tem GRANT nem política: só as funções SECURITY DEFINER
--      abaixo a leem.
--   2. sigef_login_session embrulha sigef_login e devolve o mesmo JSON com
--      session_token.
--   3. sigef_list_users exige token VÁLIDO de um usuário cujo papel atual
--      seja 'admin' e devolve apenas colunas de perfil (nunca o hash).
--   4. sigef_logout revoga o token.
--
-- Regra mantida: nenhuma função SECURITY DEFINER aberta a anon lê dado
-- pessoal sem checar o papel do chamador.
--
-- É idempotente: pode ser executada mais de uma vez sem efeito colateral.
-- ====================================================================

begin;

-- ----------------------------------------------------------------
-- 1. Tabela de sessões
-- ----------------------------------------------------------------
create table if not exists public.app_sessions (
    token      text primary key,
    user_id    text not null references public.app_users(id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null
);

create index if not exists idx_app_sessions_user_id on public.app_sessions(user_id);
create index if not exists idx_app_sessions_expires_at on public.app_sessions(expires_at);

alter table public.app_sessions enable row level security;
revoke all on public.app_sessions from anon, authenticated;

-- ----------------------------------------------------------------
-- 2. Login que emite a sessão
-- ----------------------------------------------------------------
create or replace function public.sigef_login_session(p_identifier text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
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
    values (v_token, v_user_id, now() + interval '12 hours');

    return v_result || jsonb_build_object('session_token', v_token);
end;
$$;

revoke execute on function public.sigef_login_session(text, text) from public;
grant  execute on function public.sigef_login_session(text, text)
    to anon, authenticated, service_role;

-- ----------------------------------------------------------------
-- 3. Listagem de contas — exclusiva do administrador
-- ----------------------------------------------------------------
create or replace function public.sigef_list_users(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
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
     where s.token = p_token
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
     where token = p_token;

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
$$;

revoke execute on function public.sigef_list_users(text) from public;
grant  execute on function public.sigef_list_users(text)
    to anon, authenticated, service_role;

-- ----------------------------------------------------------------
-- 4. Logout — revoga o token
-- ----------------------------------------------------------------
create or replace function public.sigef_logout(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
    delete from public.app_sessions where token = p_token;
    return jsonb_build_object('success', true);
end;
$$;

revoke execute on function public.sigef_logout(text) from public;
grant  execute on function public.sigef_logout(text)
    to anon, authenticated, service_role;

commit;
