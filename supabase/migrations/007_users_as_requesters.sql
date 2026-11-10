-- ====================================================================
-- SIGEF — 007: toda conta do sistema também é um solicitante
-- ====================================================================
-- Problema
--   Contas criadas em app_users (docentes, monitores, estagiários e
--   administradores) não apareciam em "Docentes & Alunos", porque essa
--   lista é alimentada por public.requesters. Quando o upsert do cliente
--   falhava (sessão recém-criada, rede, RLS antiga), a conta ficava só em
--   app_users — visível no Supabase e ausente no aplicativo.
--
-- Solução
--   1. Preenche requesters para toda conta de app_users que ainda não tem
--      solicitante correspondente (mesmo id derivado, e-mail ou matrícula).
--   2. Cria um trigger em app_users que mantém essa correspondência para
--      contas novas, inclusive as cadastradas direto no painel do Supabase.
--
-- O id derivado ('req-' || sufixo de 'user-...') coincide com o que o
-- cliente envia em registerUser, então o upsert do app apenas atualiza a
-- mesma linha em vez de duplicar.
--
-- É idempotente: pode ser executada mais de uma vez sem efeito colateral.
-- ====================================================================

begin;

-- ----------------------------------------------------------------
-- 1. Correspondência conta -> solicitante
-- ----------------------------------------------------------------
create or replace function public.sigef_requester_type_for_role(p_role text)
returns text
language sql
immutable
as $$
    select case p_role
             when 'admin' then 'servidor'
             when 'docente' then 'docente'
             when 'monitor' then 'monitor'
             when 'estagiario' then 'estagiario'
             else 'servidor'
           end
$$;

create or replace function public.sigef_ensure_requester_for_user(p_user_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_user  public.app_users%rowtype;
    v_req_id text;
begin
    select * into v_user from public.app_users where id = p_user_id;
    if not found then
        return;
    end if;

    v_req_id := 'req-' || regexp_replace(v_user.id, '^user-', '');

    -- Já existe um solicitante para esta pessoa? (id derivado, e-mail ou
    -- matrícula). Então não cria nada.
    if exists (
        select 1
          from public.requesters r
         where r.id = v_req_id
            or lower(coalesce(r.email, '')) = lower(coalesce(v_user.email, ''))
            or coalesce(r.registration, '') = coalesce(v_user.registration, '')
    ) then
        return;
    end if;

    insert into public.requesters (
        id, name, type, registration, course_or_department,
        email, phone, is_blocked
    ) values (
        v_req_id,
        v_user.name,
        public.sigef_requester_type_for_role(v_user.role),
        v_user.registration,
        coalesce(nullif(v_user.role_label, ''), 'Coordenação de Educação Física (COEF)'),
        v_user.email,
        '(73) 9',
        false
    )
    on conflict (id) do nothing;
end;
$$;

revoke all on function public.sigef_ensure_requester_for_user(text) from public;

create or replace function public.sigef_app_users_requester_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    perform public.sigef_ensure_requester_for_user(new.id);
    return new;
end;
$$;

drop trigger if exists app_users_requester_sync on public.app_users;
create trigger app_users_requester_sync
after insert on public.app_users
for each row
execute function public.sigef_app_users_requester_trigger();

-- ----------------------------------------------------------------
-- 2. Preenchimento das contas já existentes
-- ----------------------------------------------------------------
select public.sigef_ensure_requester_for_user(u.id)
  from public.app_users u;

commit;
