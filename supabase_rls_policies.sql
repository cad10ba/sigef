-- ====================================================================
-- SIGEF - RLS RESTRITIVA (dados pessoais + histórico patrimonial)
--
-- Execute no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/hvzvhqgfcozaprywordg/sql
--
-- ORDEM DE EXECUÇÃO
--   Rode este script POR ÚLTIMO, depois de qualquer script de schema/auth
--   (supabase_schema.sql, supabase_auth_hardening.sql, etc.). Ele remove
--   TODAS as políticas existentes das tabelas abaixo e recria o conjunto
--   fechado, para que nenhuma política permissiva antiga sobreviva (políticas
--   permissivas são somadas com OR: uma única USING (true) esquecida anula
--   todo o resto).
--
-- MODELO DE PAPÉIS (Supabase)
--   anon           -> visitante sem sessão (é o que a chave publishable dá)
--   authenticated  -> sessão válida do Supabase Auth (JWT)
--   admin          -> sessão válida + app_metadata.role = 'admin'
--   service_role   -> servidor/administração (ignora RLS, nunca no navegador)
--
-- IMPORTANTE: o SIGEF hoje autentica pela RPC sigef_login, que NÃO cria
-- sessão do Supabase Auth. Sem um JWT (signInWithPassword), o cliente cai em
-- "anon" e perde o acesso às tabelas sensíveis. Veja o impacto documentado em
-- supabase_rls_test_checklist.md antes de aplicar em produção.
--
-- MATRIZ DE PERMISSÕES APLICADA
--   tabela          anon SELECT   authenticated            DELETE
--   spaces          sim           tudo                     sim
--   materials       sim           tudo (estoque >= 0)      sim
--   kits            sim           tudo                     sim
--   notices         sim           tudo                     sim
--   regulation      sim           update                   nunca
--   categories      sim           tudo                     sim
--   requesters      nao           tudo                     sim
--   reservations    nao           tudo                     sim
--   loans           nao           select/insert/update     nunca (imutavel)
--   app_users       nao           select (so admin)        so pelas RPCs
-- ====================================================================

begin;

-- ====================================================================
-- 1. FUNÇÕES DE APOIO AO RLS
-- ====================================================================
-- Papel do chamador, lido do JWT. Usamos SOMENTE app_metadata: user_metadata
-- é editável pelo próprio usuário e permitiria se autopromover a admin.
CREATE OR REPLACE FUNCTION public.sigef_jwt_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT CASE
             WHEN auth.uid() IS NULL THEN 'anon'
             ELSE COALESCE(
                      NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', ''),
                      'authenticated'
                  )
           END;
$$;

CREATE OR REPLACE FUNCTION public.sigef_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT public.sigef_jwt_role() = 'admin';
$$;

COMMENT ON FUNCTION public.sigef_jwt_role() IS
    'Papel do chamador derivado do JWT (anon, authenticated ou o papel em app_metadata).';
COMMENT ON FUNCTION public.sigef_is_admin() IS
    'Verdadeiro somente para sessão autenticada com app_metadata.role = admin.';

-- As funções não expõem dados de tabela; ainda assim, o padrão do PostgreSQL é
-- dar EXECUTE a PUBLIC. Fechamos e liberamos só para os papéis do PostgREST.
revoke all on function public.sigef_jwt_role() from public;
revoke all on function public.sigef_is_admin() from public;
grant execute on function public.sigef_jwt_role() to anon, authenticated, service_role;
grant execute on function public.sigef_is_admin() to anon, authenticated, service_role;

-- ====================================================================
-- 2. REMOVER TODAS AS POLÍTICAS ANTIGAS DAS TABELAS DO SIGEF
-- ====================================================================
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename IN (
                 'spaces', 'materials', 'kits', 'requesters', 'loans',
                 'reservations', 'notices', 'app_users', 'regulation',
                 'categories'
               )
    LOOP
        EXECUTE format('drop policy if exists %I on %I.%I',
                       r.policyname, r.schemaname, r.tablename);
        RAISE NOTICE 'Política removida: %.% -> %', r.schemaname, r.tablename, r.policyname;
    END LOOP;
END
$$;

-- ====================================================================
-- 3. HABILITAR RLS EM TODAS AS TABELAS LISTADAS
-- ====================================================================
-- Observação: não usamos FORCE ROW LEVEL SECURITY. O dono da tabela (postgres)
-- precisa ignorar RLS para que as funções SECURITY DEFINER (sigef_login,
-- sigef_register_user, sigef_change_password) continuem funcionando.
alter table public.spaces       enable row level security;
alter table public.materials    enable row level security;
alter table public.kits         enable row level security;
alter table public.requesters   enable row level security;
alter table public.loans        enable row level security;
alter table public.reservations enable row level security;
alter table public.notices      enable row level security;
alter table public.app_users    enable row level security;
alter table public.regulation   enable row level security;
-- A tabela categories não faz parte do schema atual (categoria de material é
-- uma coluna de text em materials). Se ela existir no projeto, entra na regra.
alter table if exists public.categories enable row level security;

-- ====================================================================
-- 4. DADOS PÚBLICOS: SELECT para anon, escrita para sessão autenticada
-- ====================================================================

-- 4.1 spaces — grade de espaços esportivos (sem dado pessoal)
grant select on public.spaces to anon, authenticated;
grant insert, update, delete on public.spaces to authenticated;

create policy spaces_select_public on public.spaces
    for select to anon, authenticated using (true);
create policy spaces_insert_staff on public.spaces
    for insert to authenticated with check (true);
create policy spaces_update_staff on public.spaces
    for update to authenticated using (true) with check (true);
create policy spaces_delete_staff on public.spaces
    for delete to authenticated using (true);

-- 4.2 materials — acervo patrimonial (quantidades nunca negativas)
grant select on public.materials to anon, authenticated;
grant insert, update, delete on public.materials to authenticated;

create policy materials_select_public on public.materials
    for select to anon, authenticated using (true);
create policy materials_insert_staff on public.materials
    for insert to authenticated
    with check (total_quantity >= 0 and available_quantity >= 0);
create policy materials_update_staff on public.materials
    for update to authenticated
    using (true)
    with check (total_quantity >= 0 and available_quantity >= 0);
create policy materials_delete_staff on public.materials
    for delete to authenticated using (true);

-- 4.3 kits — composição de kits por modalidade
grant select on public.kits to anon, authenticated;
grant insert, update, delete on public.kits to authenticated;

create policy kits_select_public on public.kits
    for select to anon, authenticated using (true);
create policy kits_insert_staff on public.kits
    for insert to authenticated with check (true);
create policy kits_update_staff on public.kits
    for update to authenticated using (true) with check (true);
create policy kits_delete_staff on public.kits
    for delete to authenticated using (true);

-- 4.4 notices — mural da coordenação (informativo, sem dado pessoal)
grant select on public.notices to anon, authenticated;
grant insert, update, delete on public.notices to authenticated;

create policy notices_select_public on public.notices
    for select to anon, authenticated using (true);
create policy notices_insert_staff on public.notices
    for insert to authenticated with check (true);
create policy notices_update_staff on public.notices
    for update to authenticated using (true) with check (true);
create policy notices_delete_staff on public.notices
    for delete to authenticated using (true);

-- 4.5 regulation — regulamento institucional: leitura pública, edição da
-- equipe, exclusão nunca (o regulamento é um registro único).
grant select on public.regulation to anon, authenticated;
grant update on public.regulation to authenticated;
revoke delete on public.regulation from anon, authenticated;

create policy regulation_select_public on public.regulation
    for select to anon, authenticated using (true);
create policy regulation_update_staff on public.regulation
    for update to authenticated using (true) with check (true);
create policy regulation_delete_none on public.regulation
    for delete to anon, authenticated using (false);

-- 4.6 categories — se existir no projeto (configuração pública)
do $$
begin
    if to_regclass('public.categories') is null then
        raise notice 'public.categories não existe — seção ignorada.';
        return;
    end if;

    execute 'grant select on public.categories to anon, authenticated';
    execute 'grant insert, update, delete on public.categories to authenticated';

    execute 'create policy categories_select_public on public.categories
                 for select to anon, authenticated using (true)';
    execute 'create policy categories_insert_staff on public.categories
                 for insert to authenticated with check (true)';
    execute 'create policy categories_update_staff on public.categories
                 for update to authenticated using (true) with check (true)';
    execute 'create policy categories_delete_staff on public.categories
                 for delete to authenticated using (true)';
end
$$;

-- ====================================================================
-- 5. DADOS PESSOAIS: anon perde até o privilégio de tabela
-- ====================================================================
-- Aqui não basta a RLS: revogamos o GRANT para que uma política futura
-- permissiva não reabra a tabela. O visitante recebe 401/403 em vez de [].
-- (requesters guarda nome, e-mail, telefone e matrícula.)

revoke all on public.requesters   from anon;
revoke all on public.reservations from anon;
revoke all on public.loans        from anon;

grant select, insert, update, delete on public.requesters   to authenticated;
grant select, insert, update, delete on public.reservations to authenticated;

-- 5.1 requesters
create policy requesters_select_staff on public.requesters
    for select to authenticated using (true);
create policy requesters_insert_staff on public.requesters
    for insert to authenticated with check (true);
create policy requesters_update_staff on public.requesters
    for update to authenticated using (true) with check (true);
create policy requesters_delete_staff on public.requesters
    for delete to authenticated using (true);

-- 5.2 reservations
create policy reservations_select_staff on public.reservations
    for select to authenticated using (true);
create policy reservations_insert_staff on public.reservations
    for insert to authenticated with check (true);
create policy reservations_update_staff on public.reservations
    for update to authenticated using (true) with check (true);
create policy reservations_delete_staff on public.reservations
    for delete to authenticated using (true);

-- ====================================================================
-- 6. loans — HISTÓRICO IMUTÁVEL
-- ====================================================================
-- Termo de guarda é prova de responsabilidade sobre patrimônio público:
--  * DELETE bloqueado por privilégio, por política e por gatilho;
--  * campos de identificação do termo não podem ser reescritos por UPDATE
--    (devolução, status, itens e observações continuam editáveis).
-- O papel service_role (servidor/administração) continua podendo expurgar
-- dados em rotinas internas — a imutabilidade vale para o cliente.

revoke all on public.loans from anon, authenticated;
grant select, insert, update on public.loans to authenticated;
revoke delete on public.loans from anon, authenticated;

create policy loans_select_staff on public.loans
    for select to authenticated using (true);
create policy loans_insert_staff on public.loans
    for insert to authenticated
    with check (id is not null and term_number is not null and requester_id is not null);
create policy loans_update_staff on public.loans
    for update to authenticated using (true) with check (true);
create policy loans_delete_none on public.loans
    for delete to anon, authenticated using (false);

create or replace function public.sigef_loans_block_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    if new.id                    is distinct from old.id
    or new.term_number           is distinct from old.term_number
    or new.requester_id          is distinct from old.requester_id
    or new.requester_name        is distinct from old.requester_name
    or new.requester_type        is distinct from old.requester_type
    or new.requester_registration is distinct from old.requester_registration
    or new.loan_date             is distinct from old.loan_date
    or new.created_at            is distinct from old.created_at then
        raise exception 'Histórico imutável: os dados de identificação do termo de empréstimo não podem ser alterados.'
            using errcode = 'insufficient_privilege';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_loans_immutable on public.loans;
create trigger trg_loans_immutable
    before update on public.loans
    for each row execute function public.sigef_loans_block_mutation();

-- ====================================================================
-- 7. app_users — SOMENTE ADMIN, E SOMENTE LEITURA DE PERFIL
-- ====================================================================
-- O hash de senha nunca é legível pelo cliente e a escrita de credenciais
-- acontece exclusivamente pelas RPCs SECURITY DEFINER. Por isso não existe
-- GRANT de INSERT/UPDATE/DELETE para anon nem para authenticated: as
-- políticas abaixo apenas documentam a negação.
revoke all on public.app_users from anon, authenticated;
grant select (id, name, role, registration, email, role_label, created_at)
    on public.app_users to authenticated;

create policy app_users_select_admin on public.app_users
    for select to authenticated using (public.sigef_is_admin());
create policy app_users_insert_none on public.app_users
    for insert to anon, authenticated with check (false);
create policy app_users_update_none on public.app_users
    for update to anon, authenticated using (false);
create policy app_users_delete_none on public.app_users
    for delete to anon, authenticated using (false);

-- ====================================================================
-- 8. FUNÇÕES SECURITY DEFINER — REVISÃO DE GRANT
-- ====================================================================
-- As três funções abaixo rodam como o dono (postgres) e, portanto, IGNORAM a
-- RLS. Quem recebe EXECUTE nelas acessa app_users independentemente das
-- políticas: o GRANT é a fronteira real. O padrão do PostgreSQL é EXECUTE
-- para PUBLIC, por isso cada uma é fechada e reconcedida nominalmente.
--
--   sigef_login(p_identifier, p_password)
--     Precisa de anon (é o login). Compara sempre em bcrypt e devolve a mesma
--     mensagem para usuário inexistente e senha errada. Risco residual: é um
--     oráculo de senha exposto sem sessão — aplique rate limit (Edge Function
--     ou tabela de tentativas) e use bcrypt cost >= 12 em produção.
--
--   sigef_register_user(..., p_role, ..., p_password)
--     CRÍTICO: o chamador escolhe p_role. Do jeito que estava (aberta a anon),
--     qualquer pessoa na internet criava uma conta 'admin'. A versão abaixo
--     substitui a anterior: mantém o autocadastro funcionando (papéis
--     operacionais), mas recusa 'admin' para quem não é admin autenticado.
--
--   sigef_change_password(p_user_id, p_current, p_new)
--     Recebe p_user_id do cliente. Aberta a anon, vira oráculo de senha para
--     qualquer usuário (não há troca sem conhecer a senha atual, mas há
--     tentativa ilimitada). O app depende dela sem sessão, então o GRANT foi
--     mantido; a correção definitiva é derivar o id de auth.uid() ao migrar
--     para o Supabase Auth e, desde já, limitar tentativas.
--
-- Regra para o futuro: nenhuma nova função SECURITY DEFINER concedida a anon
-- deve ler/escrever tabelas com dado pessoal sem checar o papel do chamador.

revoke execute on function public.sigef_login(text, text) from public;
grant  execute on function public.sigef_login(text, text)
    to anon, authenticated, service_role;

revoke execute on function public.sigef_register_user(text, text, text, text, text, text, text) from public;
grant  execute on function public.sigef_register_user(text, text, text, text, text, text, text)
    to anon, authenticated, service_role;

revoke execute on function public.sigef_change_password(text, text, text) from public;
grant  execute on function public.sigef_change_password(text, text, text)
    to anon, authenticated, service_role;

-- 8.1 sigef_register_user endurecida (substitui a definição anterior).
--     A senha continua indo para o banco e sendo gravada só como hash bcrypt.
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
    v_clean_email text := lower(btrim(coalesce(p_email, '')));
    v_clean_reg   text := lower(btrim(coalesce(p_registration, '')));
    v_pass        text := btrim(coalesce(p_password, ''));
    v_role        text := coalesce(nullif(btrim(p_role), ''), 'docente');
    v_label       text;
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

    -- Papel válido e sem autopromoção: 'admin' só de um admin autenticado.
    if v_role not in ('admin', 'docente', 'monitor', 'estagiario') then
        v_role := 'docente';
    end if;
    if v_role = 'admin' and not public.sigef_is_admin() then
        return jsonb_build_object(
            'success', false,
            'message', 'Somente administradores podem criar contas de administrador.'
        );
    end if;

    v_label := case v_role
                   when 'admin'      then 'Coordenação de Educação Física (Administrador)'
                   when 'monitor'    then 'Monitor / Bolsista de Ed. Física'
                   when 'estagiario' then 'Estagiário de Ed. Física'
                   else 'Docente de Educação Física'
               end;

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

    insert into public.app_users (id, name, role, registration, email, role_label, password_hash)
    values (
        p_id,
        btrim(p_name),
        v_role,
        btrim(p_registration),
        v_clean_email,
        v_label,
        crypt(v_pass, gen_salt('bf', 10))
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

-- Auditoria: qualquer outra função SECURITY DEFINER fora de pg_catalog que
-- ainda esteja aberta a PUBLIC/anon precisa da mesma revisão.
do $$
declare
    r record;
begin
    for r in
        select n.nspname as schema,
               p.proname as funcao,
               pg_get_function_identity_arguments(p.oid) as argumentos,
               coalesce(array_to_string(p.proacl, ' | '), '(padrão: PUBLIC)') as acl
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where p.prosecdef
           and n.nspname not in ('pg_catalog', 'information_schema')
         order by 1, 2
    loop
        raise notice 'SECURITY DEFINER: %.%(%) -> %',
            r.schema, r.funcao, r.argumentos, r.acl;
    end loop;
end
$$;

-- ====================================================================
-- 9. VERIFICAÇÃO RÁPIDA (resultados aparecem no editor)
-- ====================================================================
-- 9.1 RLS ativa em todas as tabelas?
select c.relname as tabela,
       c.relrowsecurity as rls_ativa
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('spaces','materials','kits','requesters','loans',
                     'reservations','notices','app_users','regulation','categories')
 order by 1;

-- 9.2 anon continua sem privilégio nas tabelas sensíveis? (esperado: false)
select has_table_privilege('anon', 'public.requesters',   'select') as anon_requesters,
       has_table_privilege('anon', 'public.loans',        'select') as anon_loans,
       has_table_privilege('anon', 'public.reservations', 'select') as anon_reservations,
       has_table_privilege('anon', 'public.app_users',    'select') as anon_app_users,
       has_table_privilege('authenticated', 'public.loans', 'delete') as auth_loans_delete;

-- 9.3 Políticas resultantes
select tablename, policyname, roles, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename in ('spaces','materials','kits','requesters','loans',
                     'reservations','notices','app_users','regulation','categories')
 order by 1, 2;

commit;

-- ====================================================================
-- ROLLBACK (não recomendado — só em emergência operacional)
--   alter table public.requesters disable row level security;
--   grant all on public.requesters to anon;
-- ====================================================================
