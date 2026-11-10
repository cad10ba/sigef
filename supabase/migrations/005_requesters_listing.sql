-- ====================================================================
-- SIGEF — 005: listagem de solicitantes para a sessão autenticada
-- ====================================================================
-- Problema
--   requesters_select_staff libera SELECT apenas para o papel
--   `authenticated` (Supabase Auth). O SPA nunca abre sessão no Supabase
--   Auth, então todo select em public.requesters volta como "permission
--   denied" e a tela "Docentes, Estagiários, Monitores & Alunos" fica
--   vazia mesmo com registros no banco.
--
-- Solução (mesma linha da 004, sem abrir a tabela para anon)
--   sigef_list_requesters exige token VÁLIDO de public.app_sessions e
--   devolve apenas as colunas de perfil usadas pela interface. A tabela
--   continua fechada para anon: a autorização acontece na função
--   SECURITY DEFINER, não em uma política permissiva.
--
-- É idempotente: pode ser executada mais de uma vez sem efeito colateral.
-- ====================================================================

begin;

create or replace function public.sigef_list_requesters(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
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
     where s.token = p_token
       and s.expires_at > now();

    if v_user_id is null then
        return jsonb_build_object('success', false, 'message', 'Sessão expirada. Entre novamente.');
    end if;

    -- Renovação deslizante enquanto a sessão é usada.
    update public.app_sessions
       set expires_at = now() + interval '12 hours'
     where token = p_token;

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
$$;

revoke execute on function public.sigef_list_requesters(text) from public;
grant  execute on function public.sigef_list_requesters(text)
    to anon, authenticated, service_role;

commit;
