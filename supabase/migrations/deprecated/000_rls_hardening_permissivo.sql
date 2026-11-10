-- ====================================================================
-- OBSOLETO: este script deixa políticas abertas a `anon` (USING (true)) em
-- requesters, loans, reservations e app_users. A versão vigente, que nega o
-- anônimo, é `supabase_rls_policies.sql` — rode-a por último.
--
-- SIGEF - Sistema Integrado de Gestão da Educação Física (COEF - IF)
-- SCRIPT DE CORREÇÃO E ENDURECIMENTO DAS POLÍTICAS DE RLS (SEGURANÇA)
--
-- Execute este script no SQL Editor do seu projeto Supabase:
-- https://supabase.com/dashboard/project/hvzvhqgfcozaprywordg/sql
--
-- VULNERABILIDADES CORRIGIDAS POR ESTE SCRIPT:
-- 1. [CRÍTICA] Exposição de senhas em texto puro na tabela app_users via SELECT *
-- 2. [ALTA] Exclusão arbitrária de termos de empréstimo (destruição de auditoria patrimonial)
-- 3. [ALTA] Exclusão ou rebaixamento indevido da conta de administrador (user-admin)
-- 4. [MÉDIA] Exclusão indevida do regulamento institucional (regulation)
-- 5. [MÉDIA] Quantidades negativas ou inconsistentes de estoque em materials
-- 6. [MÉDIA] Reservas com horário final menor ou igual ao horário inicial
-- ====================================================================

-- 0. Habilitar extensão criptográfica para hash de senhas se disponível
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- No Supabase o pgcrypto fica no schema "extensions": deixe-o explícito no
-- search_path da sessão para que crypt()/gen_salt() resolvam durante a migração.
SET search_path = public, extensions, pg_temp;

-- ====================================================================
-- ----------------------------------------------------------------
-- Hash das senhas existentes e remoção da coluna em texto puro
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- No Supabase o pgcrypto fica no schema "extensions": deixe-o explícito no
-- search_path da sessão para que crypt()/gen_salt() resolvam durante a migração.
SET search_path = public, extensions, pg_temp;

ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Converte o que estiver em texto puro. Valores que já são hash bcrypt
-- ($2a$/$2b$/$2y$) são preservados, então rodar de novo não re-hasheia nada.
DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name   = 'app_users'
           AND column_name  = 'password'
    ) THEN
        EXECUTE $stmt$
            UPDATE public.app_users
               SET password_hash = CASE
                       WHEN password LIKE '$2a$%'
                         OR password LIKE '$2b$%'
                         OR password LIKE '$2y$%' THEN password
                       ELSE crypt(BTRIM(password), gen_salt('bf', 10))
                   END
             WHERE password_hash IS NULL
                OR password_hash NOT LIKE '$2%'
        $stmt$;
    END IF;
END
$migration$;

-- Contas que ficaram sem senha recebem um hash aleatório: ninguém consegue
-- entrar com elas até um administrador redefinir a senha.
UPDATE public.app_users
   SET password_hash = crypt(md5(random()::text || clock_timestamp()::text), gen_salt('bf', 10))
 WHERE password_hash IS NULL;

ALTER TABLE public.app_users ALTER COLUMN password_hash SET NOT NULL;

-- A senha em texto puro deixa de existir na base.
ALTER TABLE public.app_users DROP COLUMN IF EXISTS password;

-- ----------------------------------------------------------------
-- Privilégios: o cliente só lê colunas de perfil, nunca o hash
-- ----------------------------------------------------------------
-- Importante: um GRANT de tabela inteira anularia o REVOKE por coluna, por
-- isso o privilégio de tabela é removido e reconcedido coluna a coluna.
REVOKE ALL ON public.app_users FROM anon, authenticated;
GRANT SELECT (id, name, role, registration, email, role_label, created_at)
   ON public.app_users TO anon, authenticated;

-- Escritas de credencial passam exclusivamente pelas funções SECURITY DEFINER
-- abaixo (o cliente não escreve mais em app_users).
DROP POLICY IF EXISTS "Public app_users access" ON public.app_users;
DROP POLICY IF EXISTS "App users safe select" ON public.app_users;
DROP POLICY IF EXISTS "App users insert" ON public.app_users;
DROP POLICY IF EXISTS "App users update" ON public.app_users;
DROP POLICY IF EXISTS "App users delete" ON public.app_users;

CREATE POLICY "App users safe select" ON public.app_users FOR SELECT USING (true);
CREATE POLICY "App users insert" ON public.app_users FOR INSERT WITH CHECK (id IS NOT NULL AND email <> '');
CREATE POLICY "App users update" ON public.app_users FOR UPDATE USING (true) WITH CHECK (id <> 'user-admin' OR role = 'admin');
CREATE POLICY "App users delete" ON public.app_users FOR DELETE USING (id <> 'user-admin');

-- ----------------------------------------------------------------

-- Login: única decisão de autenticação, sempre em bcrypt
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sigef_login(p_identifier TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_user       public.app_users%ROWTYPE;
    v_clean_id   TEXT := LOWER(BTRIM(COALESCE(p_identifier, '')));
    v_clean_pass TEXT := BTRIM(COALESCE(p_password, ''));
    v_digits     TEXT := REGEXP_REPLACE(COALESCE(p_identifier, ''), '\D', '', 'g');
    v_hash       TEXT;
    v_match      BOOLEAN := FALSE;
BEGIN
    SELECT *
      INTO v_user
      FROM public.app_users
     WHERE LOWER(email) = v_clean_id
        OR LOWER(registration) = v_clean_id
        OR (v_digits <> '' AND REGEXP_REPLACE(registration, '\D', '', 'g') = v_digits)
        OR (v_clean_id = 'admin' AND role = 'admin')
     LIMIT 1;

    -- Sem linha encontrada, calculamos um hash descartável para que o tempo de
    -- resposta não revele se o identificador existe.
    v_hash := COALESCE(v_user.password_hash, crypt(md5(random()::text), gen_salt('bf', 10)));

    -- Única comparação possível: crypt(senha digitada, hash gravado) = hash.
    v_match := (v_user.id IS NOT NULL) AND (crypt(v_clean_pass, v_hash) = v_hash);

    IF v_match THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'message', 'Login realizado com sucesso!',
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
    END IF;

    -- Usuário inexistente e senha incorreta devolvem exatamente a mesma coisa.
    RETURN jsonb_build_object(
        'success', FALSE,
        'message', 'Credenciais inválidas. Verifique o identificador e a senha informados.'
    );
END;
$$;

-- ----------------------------------------------------------------
-- Cadastro e troca de senha (sempre com hash, nunca em texto puro)
-- ----------------------------------------------------------------
-- Remove a assinatura antiga (6 parâmetros), que gravava a senha sem hash.
DROP FUNCTION IF EXISTS public.sigef_register_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.sigef_register_user(
    p_id           TEXT,
    p_name         TEXT,
    p_role         TEXT,
    p_registration TEXT,
    p_email        TEXT,
    p_role_label   TEXT,
    p_password     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_user        public.app_users%ROWTYPE;
    v_clean_email TEXT := LOWER(BTRIM(COALESCE(p_email, '')));
    v_clean_reg   TEXT := LOWER(BTRIM(COALESCE(p_registration, '')));
    v_pass        TEXT := BTRIM(COALESCE(p_password, ''));
BEGIN
    IF BTRIM(COALESCE(p_id, '')) = ''
       OR BTRIM(COALESCE(p_name, '')) = ''
       OR v_clean_email = ''
       OR v_clean_reg = ''
       OR LENGTH(v_pass) < 4 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Todos os campos obrigatórios devem ser preenchidos e a senha deve ter no mínimo 4 caracteres.'
        );
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.app_users
         WHERE id = p_id
            OR LOWER(email) = v_clean_email
            OR LOWER(registration) = v_clean_reg
    ) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Já existe um cadastro com este e-mail institucional ou matrícula/SIAPE.'
        );
    END IF;

    INSERT INTO public.app_users (id, name, role, registration, email, role_label, password_hash)
    VALUES (
        p_id,
        BTRIM(p_name),
        COALESCE(NULLIF(BTRIM(p_role), ''), 'docente'),
        BTRIM(p_registration),
        v_clean_email,
        COALESCE(NULLIF(BTRIM(p_role_label), ''), 'Usuário'),
        crypt(v_pass, gen_salt('bf', 10))
    );

    SELECT * INTO v_user FROM public.app_users WHERE id = p_id;

    RETURN jsonb_build_object(
        'success', TRUE,
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
END;
$$;

CREATE OR REPLACE FUNCTION public.sigef_change_password(
    p_user_id          TEXT,
    p_current_password TEXT,
    p_new_password     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_hash    TEXT;
    v_current TEXT := BTRIM(COALESCE(p_current_password, ''));
    v_new     TEXT := BTRIM(COALESCE(p_new_password, ''));
BEGIN
    IF LENGTH(v_new) < 4 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'A nova senha deve possuir pelo menos 4 caracteres.'
        );
    END IF;

    SELECT password_hash INTO v_hash FROM public.app_users WHERE id = p_user_id;

    IF v_hash IS NULL OR crypt(v_current, v_hash) <> v_hash THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'A senha atual informada está incorreta.'
        );
    END IF;

    UPDATE public.app_users
       SET password_hash = crypt(v_new, gen_salt('bf', 10))
     WHERE id = p_user_id;

    RETURN jsonb_build_object('success', TRUE, 'message', 'Senha atualizada com sucesso!');
END;
$$;

GRANT EXECUTE ON FUNCTION public.sigef_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sigef_register_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sigef_change_password(TEXT, TEXT, TEXT) TO anon, authenticated;

-- 4. CORREÇÃO NA TABELA loans (IMUTABILIDADE DO HISTÓRICO DE EMPRÉSTIMOS)
-- Termos de empréstimo e guarda de patrimônio público NÃO PODEM ser excluídos por clientes!
-- ====================================================================

DROP POLICY IF EXISTS "Public loans access" ON public.loans;
DROP POLICY IF EXISTS "Loans select" ON public.loans;
DROP POLICY IF EXISTS "Loans insert" ON public.loans;
DROP POLICY IF EXISTS "Loans update" ON public.loans;
DROP POLICY IF EXISTS "Loans delete" ON public.loans;

-- Consulta pública dos empréstimos
CREATE POLICY "Loans select"
ON public.loans
FOR SELECT
USING (true);

-- Registro de novos empréstimos
CREATE POLICY "Loans insert"
ON public.loans
FOR INSERT
WITH CHECK (
    id IS NOT NULL AND
    term_number IS NOT NULL AND
    requester_id IS NOT NULL
);

-- Atualização de devolução e vistoria técnica
CREATE POLICY "Loans update"
ON public.loans
FOR UPDATE
USING (true)
WITH CHECK (true);

-- BLOQUEIO ESTRITO DE DELETE: Ninguém via anon pode deletar registros de empréstimos
CREATE POLICY "Loans delete"
ON public.loans
FOR DELETE
USING (false);

-- ====================================================================
-- 5. CORREÇÃO NA TABELA regulation (PROTEÇÃO DO REGULAMENTO)
-- ====================================================================

DROP POLICY IF EXISTS "Public regulation access" ON public.regulation;
DROP POLICY IF EXISTS "Regulation select" ON public.regulation;
DROP POLICY IF EXISTS "Regulation update" ON public.regulation;
DROP POLICY IF EXISTS "Regulation delete" ON public.regulation;

CREATE POLICY "Regulation select"
ON public.regulation
FOR SELECT
USING (true);

CREATE POLICY "Regulation update"
ON public.regulation
FOR ALL
USING (true)
WITH CHECK (true);

-- Bloqueia exclusão de linha de regulamento
CREATE POLICY "Regulation delete"
ON public.regulation
FOR DELETE
USING (false);

-- ====================================================================
-- 6. CORREÇÃO NA TABELA materials (VALIDAÇÃO DE ESTOQUE)
-- ====================================================================

DROP POLICY IF EXISTS "Public materials access" ON public.materials;
DROP POLICY IF EXISTS "Materials select" ON public.materials;
DROP POLICY IF EXISTS "Materials insert" ON public.materials;
DROP POLICY IF EXISTS "Materials update" ON public.materials;
DROP POLICY IF EXISTS "Materials delete" ON public.materials;

CREATE POLICY "Materials select"
ON public.materials
FOR SELECT
USING (true);

CREATE POLICY "Materials insert"
ON public.materials
FOR INSERT
WITH CHECK (
    total_quantity >= 0 AND
    available_quantity >= 0 AND
    available_quantity <= total_quantity
);

CREATE POLICY "Materials update"
ON public.materials
FOR UPDATE
USING (true)
WITH CHECK (
    total_quantity >= 0 AND
    available_quantity >= 0
);

CREATE POLICY "Materials delete"
ON public.materials
FOR DELETE
USING (true);

-- Adicionar constraints caso não existam
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_materials_quantities') THEN
        ALTER TABLE public.materials ADD CONSTRAINT chk_materials_quantities
        CHECK (total_quantity >= 0 AND available_quantity >= 0);
    END IF;
END $$;

-- ====================================================================
-- 7. CORREÇÃO NA TABELA reservations (INTEGRIDADE TEMPORAL)
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_reservations_times') THEN
        ALTER TABLE public.reservations ADD CONSTRAINT chk_reservations_times
        CHECK (end_time > start_time);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_reservations_participants') THEN
        ALTER TABLE public.reservations ADD CONSTRAINT chk_reservations_participants
        CHECK (participants_count >= 1);
    END IF;
END $$;

-- ====================================================================
-- 8. GARANTIR INTEGRIDADE DO USUÁRIO ADMINISTRADOR
-- ====================================================================
INSERT INTO public.app_users (id, name, role, registration, email, role_label, password_hash)
VALUES (
    'user-admin',
    'Cristiano Araujo Dias',
    'admin',
    'SIAPE 1852024',
    'cristianodias@ifba.edu.br',
    'Coordenação de Educação Física (Administrador)',
    crypt('833604', gen_salt('bf', 10))
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  registration = EXCLUDED.registration,
  email = EXCLUDED.email,
  role_label = EXCLUDED.role_label,
  password_hash = EXCLUDED.password_hash;

-- ====================================================================
-- FIM DO SCRIPT DE HARDENING RLS
-- ====================================================================
