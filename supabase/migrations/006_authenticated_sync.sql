-- ====================================================================
-- SIGEF — 006: sincronização autenticada (leitura + escrita) via RPC
-- ====================================================================
-- Problema
--   Depois do endurecimento do RLS (003), o cliente anônimo (chave
--   publishable) perdeu a escrita em TODAS as tabelas e a leitura de
--   requesters/loans/reservations. Resultado no app:
--     * dados gravados no Supabase não apareciam (empréstimos e reservas);
--     * cadastros/edições feitos no app não chegavam ao banco (o upsert
--       anônimo era negado e o erro só ia para o console);
--     * exclusões feitas no app não chegavam ao banco.
--
-- Solução (mesma linha da 004/005, sem reabrir as tabelas para anon)
--   1. sigef_token_user valida o token opaco de public.app_sessions.
--   2. sigef_list_loans / sigef_list_reservations devolvem as linhas para
--      quem tem sessão válida (as tabelas seguem fechadas para anon).
--   3. sigef_upsert_rows aplica insert ... on conflict (id) do update com
--      as colunas enviadas pelo cliente, numa lista branca de tabelas.
--   4. sigef_delete_rows exclui por id (ou esvazia a tabela quando não há
--      ids), exceto loans — termo de guarda é imutável por definição.
--
-- A autorização continua no servidor (SECURITY DEFINER + token de sessão);
-- nenhuma política permissiva é criada e anon segue sem privilégio nas
-- tabelas de dado pessoal.
--
-- É idempotente: pode ser executada mais de uma vez sem efeito colateral.
-- ====================================================================

begin;

-- ----------------------------------------------------------------
-- 1. Validação da sessão
-- ----------------------------------------------------------------
create or replace function public.sigef_token_user(p_token text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select s.user_id
      from public.app_sessions s
     where s.token = p_token
       and s.expires_at > now()
$$;

revoke all on function public.sigef_token_user(text) from public;

-- ----------------------------------------------------------------
-- 2. Leitura de empréstimos e reservas com sessão válida
-- ----------------------------------------------------------------
create or replace function public.sigef_list_loans(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_rows jsonb;
begin
    if public.sigef_token_user(p_token) is null then
        return jsonb_build_object('success', false, 'message', 'Sessão expirada. Entre novamente.');
    end if;

    update public.app_sessions
       set expires_at = now() + interval '12 hours'
     where token = p_token;

    select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc nulls last), '[]'::jsonb)
      into v_rows
      from public.loans l;

    return jsonb_build_object('success', true, 'loans', v_rows);
end;
$$;

create or replace function public.sigef_list_reservations(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_rows jsonb;
begin
    if public.sigef_token_user(p_token) is null then
        return jsonb_build_object('success', false, 'message', 'Sessão expirada. Entre novamente.');
    end if;

    update public.app_sessions
       set expires_at = now() + interval '12 hours'
     where token = p_token;

    select coalesce(
               jsonb_agg(to_jsonb(r) order by r.date, r.start_time, r.created_at),
               '[]'::jsonb
           )
      into v_rows
      from public.reservations r;

    return jsonb_build_object('success', true, 'reservations', v_rows);
end;
$$;

-- ----------------------------------------------------------------
-- 3. Escrita (upsert) por tabela da lista branca
-- ----------------------------------------------------------------
-- A lista de colunas é derivada das chaves efetivamente enviadas e só
-- aceita nomes que existem na tabela. Assim o cliente atualiza apenas o
-- que conhece e colunas de servidor (created_at, updated_at) preservam
-- seus valores/defaults.
create or replace function public.sigef_upsert_rows(
    p_token text,
    p_table text,
    p_rows  jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
     where token = p_token;

    return jsonb_build_object('success', true, 'count', jsonb_array_length(p_rows));
end;
$$;

-- ----------------------------------------------------------------
-- 4. Exclusão com sessão válida
-- ----------------------------------------------------------------
-- Sem p_ids a tabela é esvaziada (usado pelo "substituir acervo" e pelo
-- "limpar estoque"). loans fica de fora: o termo de guarda é imutável.
create or replace function public.sigef_delete_rows(
    p_token text,
    p_table text,
    p_ids   text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_allowed constant text[] := array[
        'spaces', 'materials', 'kits', 'notices', 'requesters', 'reservations'
    ];
begin
    if public.sigef_token_user(p_token) is null then
        return jsonb_build_object('success', false, 'message', 'Sessão expirada. Entre novamente.');
    end if;

    if p_table is null or not (p_table = any(v_allowed)) then
        return jsonb_build_object('success', false, 'message', 'Tabela não permitida.');
    end if;

    if p_ids is null or array_length(p_ids, 1) is null then
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

-- ----------------------------------------------------------------
-- 5. Permissões
-- ----------------------------------------------------------------
revoke execute on function public.sigef_list_loans(text) from public;
grant  execute on function public.sigef_list_loans(text)
    to anon, authenticated, service_role;

revoke execute on function public.sigef_list_reservations(text) from public;
grant  execute on function public.sigef_list_reservations(text)
    to anon, authenticated, service_role;

revoke execute on function public.sigef_upsert_rows(text, text, jsonb) from public;
grant  execute on function public.sigef_upsert_rows(text, text, jsonb)
    to anon, authenticated, service_role;

revoke execute on function public.sigef_delete_rows(text, text, text[]) from public;
grant  execute on function public.sigef_delete_rows(text, text, text[])
    to anon, authenticated, service_role;

commit;
