-- ====================================================================
-- 010 — Escrita e dados pessoais só para a equipe do SIGEF
-- ====================================================================
-- Problema corrigido:
--   As políticas da 003 liberam escrita (e leitura de dados pessoais) para
--   QUALQUER sessão "authenticated". Se o cadastro público do Supabase Auth
--   estiver ligado, qualquer pessoa cria uma conta pela API com a chave
--   publishable e passa a ler solicitantes/reservas/empréstimos e a alterar
--   espaços e materiais.
--
-- Solução:
--   1. sigef_is_staff(): verdadeiro só quando o usuário do Supabase Auth está
--      vinculado a uma conta em public.app_users (auth_id).
--   2. Todas as políticas "*_staff" passam a exigir sigef_is_staff().
--   3. anon perde qualquer privilégio de escrita residual (o Supabase concede
--      ALL para anon por padrão em tabelas novas do schema public).
--   4. sigef_resolve_identifier deixa de devolver o nome e só resolve
--      matrícula/SIAPE (e-mail já é o próprio identificador).
--
-- Também desligue no painel: Authentication > Sign In / Providers >
-- "Allow new users to sign up" = OFF. Contas novas continuam sendo criadas
-- pelos administradores via sigef_register_user.
-- ====================================================================

begin;

-- 1. Função de equipe ------------------------------------------------
create or replace function public.sigef_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select auth.uid() is not null
       and exists (select 1 from public.app_users u where u.auth_id = auth.uid());
$$;

revoke all on function public.sigef_is_staff() from public;
grant execute on function public.sigef_is_staff() to anon, authenticated, service_role;

comment on function public.sigef_is_staff() is
    'Verdadeiro só para usuário do Supabase Auth vinculado a public.app_users.';

-- 2. Reescreve as políticas de equipe --------------------------------
do $$
declare
    r record;
begin
    for r in
        select tablename, policyname, cmd
          from pg_policies
         where schemaname = 'public'
           and policyname like '%\_staff' escape '\'
           and tablename in ('spaces','materials','kits','notices','regulation',
                             'categories','requesters','reservations','loans')
    loop
        if r.cmd = 'INSERT' then
            -- Mantém as checagens de integridade já existentes (materials, loans)
            execute format(
                'alter policy %I on public.%I with check (public.sigef_is_staff() and (%s))',
                r.policyname, r.tablename,
                coalesce((select with_check from pg_policies
                           where schemaname='public' and tablename=r.tablename
                             and policyname=r.policyname), 'true'));
        elsif r.cmd = 'UPDATE' then
            execute format(
                'alter policy %I on public.%I using (public.sigef_is_staff()) with check (public.sigef_is_staff() and (%s))',
                r.policyname, r.tablename,
                coalesce((select with_check from pg_policies
                           where schemaname='public' and tablename=r.tablename
                             and policyname=r.policyname), 'true'));
        else -- SELECT / DELETE
            execute format(
                'alter policy %I on public.%I using (public.sigef_is_staff())',
                r.policyname, r.tablename);
        end if;
        raise notice 'Política endurecida: %.%', r.tablename, r.policyname;
    end loop;
end
$$;

-- 3. anon: só leitura nas tabelas públicas, nada nas pessoais ---------
revoke insert, update, delete, truncate on public.spaces     from anon;
revoke insert, update, delete, truncate on public.materials  from anon;
revoke insert, update, delete, truncate on public.kits       from anon;
revoke insert, update, delete, truncate on public.notices    from anon;
revoke insert, update, delete, truncate on public.regulation from anon;
do $$
begin
    if to_regclass('public.categories') is not null then
        execute 'revoke insert, update, delete, truncate on public.categories from anon';
    end if;
end
$$;

-- 4. Resolver identificador sem expor nome ---------------------------
create or replace function public.sigef_resolve_identifier(p_identifier text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
    select coalesce(
        (select jsonb_build_object('success', true, 'email', u.email)
           from public.app_users u
          where position('@' in coalesce(p_identifier, '')) = 0
            and lower(u.registration) = lower(btrim(coalesce(p_identifier, '')))
          limit 1),
        jsonb_build_object('success', false)
    );
$$;

revoke all on function public.sigef_resolve_identifier(text) from public;
grant execute on function public.sigef_resolve_identifier(text)
    to anon, authenticated, service_role;

commit;

-- Conferência rápida (rode separado, depois do commit):
-- select tablename, policyname, cmd, qual, with_check
--   from pg_policies where schemaname = 'public' order by 1, 2;
