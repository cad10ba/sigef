-- ====================================================================
-- SIGEF — 008: excluir uma pessoa também exclui a conta do sistema
-- ====================================================================
-- Problema
--   A tela "Docentes, Estagiários, Monitores & Alunos" excluía apenas a
--   linha de public.requesters. Para docentes, monitores e demais contas,
--   a linha correspondente em public.app_users continuava existindo — a
--   pessoa "excluída" seguia aparecendo no Supabase e na lista de contas.
--
-- Solução
--   sigef_delete_person(token, requester_id) apaga o solicitante e a conta
--   de sistema ligada a ele (mesmo id derivado 'req-X' -> 'user-X' ou mesmo
--   e-mail), junto com as sessões abertas daquela conta.
--
--   Regras de segurança (validadas no servidor):
--     - exige sessão válida de um administrador;
--     - ninguém exclui a própria conta;
--     - o sistema nunca fica sem administrador.
--
-- É idempotente: pode ser executada mais de uma vez sem efeito colateral.
-- ====================================================================

begin;

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

    -- Conta correspondente: mesmo id derivado (req-1794... -> user-1794...)
    -- ou, quando não houver, o mesmo e-mail.
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

        select u.role into v_user_role from public.app_users u where u.id = v_user_id;
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
        -- Encerra as sessões abertas antes de remover a conta.
        delete from public.app_sessions where user_id = v_user_id;
        delete from public.app_users where id = v_user_id;
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
