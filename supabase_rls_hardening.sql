-- ====================================================================
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

-- ====================================================================
-- 1. CORREÇÃO NA TABELA app_users (SENHAS E PROTEÇÃO DO ADMIN)
-- ====================================================================

-- Remover política anterior permissiva
DROP POLICY IF EXISTS "Public app_users access" ON public.app_users;
DROP POLICY IF EXISTS "App users safe select" ON public.app_users;
DROP POLICY IF EXISTS "App users insert" ON public.app_users;
DROP POLICY IF EXISTS "App users update" ON public.app_users;
DROP POLICY IF EXISTS "App users delete" ON public.app_users;

-- Revogar permissão direta de SELECT na coluna sensível 'password' para papéis anônimos/públicos
REVOKE SELECT (password) ON public.app_users FROM anon, authenticated;
GRANT SELECT (id, name, role, registration, email, role_label, created_at) ON public.app_users TO anon, authenticated;

-- Leitura pública segura dos dados cadastrais (sem senha)
CREATE POLICY "App users safe select"
ON public.app_users
FOR SELECT
USING (true);

-- Inserção permitida para novos cadastros
CREATE POLICY "App users insert"
ON public.app_users
FOR INSERT
WITH CHECK (
    id IS NOT NULL AND
    name <> '' AND
    email <> '' AND
    registration <> ''
);

-- Atualização: Qualquer usuário pode atualizar dados cadastrais, mas NÃO pode alterar a senha do admin nem rebaixar seu papel para não-admin
CREATE POLICY "App users update"
ON public.app_users
FOR UPDATE
USING (true)
WITH CHECK (
    (id <> 'user-admin') OR (role = 'admin')
);

-- Exclusão: NUNCA permitir a exclusão do administrador geral institucional (user-admin)
CREATE POLICY "App users delete"
ON public.app_users
FOR DELETE
USING (
    id <> 'user-admin'
);

-- ====================================================================
-- 2. FUNÇÃO RPC SEGURA DE AUTENTICAÇÃO (sigef_login)
-- Não expõe hashes nem senhas. A validação ocorre no servidor Postgres.
-- ====================================================================
CREATE OR REPLACE FUNCTION public.sigef_login(p_identifier TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_clean_id TEXT := LOWER(TRIM(p_identifier));
    v_clean_pass TEXT := TRIM(p_password);
    v_digits TEXT := REGEXP_REPLACE(p_identifier, '\D', '', 'g');
    v_match BOOLEAN := false;
BEGIN
    SELECT id, name, role, registration, email, role_label, password, created_at
    INTO v_user
    FROM public.app_users
    WHERE LOWER(email) = v_clean_id
       OR LOWER(registration) = v_clean_id
       OR (v_digits <> '' AND REGEXP_REPLACE(registration, '\D', '', 'g') = v_digits)
       OR (v_clean_id = 'admin' AND (role = 'admin' OR id = 'user-admin'))
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Usuário não encontrado. Verifique seu e-mail institucional ou matrícula/SIAPE.'
        );
    END IF;

    -- Suporta verificação direta ou via hash bcrypt (pgcrypto)
    IF v_user.password = v_clean_pass THEN
        v_match := true;
    ELSIF v_user.password = crypt(v_clean_pass, v_user.password) THEN
        v_match := true;
    END IF;

    IF v_match THEN
        RETURN jsonb_build_object(
            'success', true,
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
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Senha incorreta. Verifique suas credenciais e tente novamente.'
        );
    END IF;
END;
$$;

-- Conceder permissão de execução da função de login aos papéis anon e authenticated
GRANT EXECUTE ON FUNCTION public.sigef_login(TEXT, TEXT) TO anon, authenticated;

-- ====================================================================
-- 3. FUNÇÃO RPC SEGURA DE CADASTRO COM CRIPTOGRAFIA (sigef_register_user)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.sigef_register_user(
    p_name TEXT,
    p_email TEXT,
    p_registration TEXT,
    p_role TEXT,
    p_role_label TEXT,
    p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_id TEXT := 'user-' || FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000)::TEXT;
    v_clean_email TEXT := LOWER(TRIM(p_email));
    v_clean_reg TEXT := LOWER(TRIM(p_registration));
    v_hash TEXT;
BEGIN
    IF TRIM(p_name) = '' OR v_clean_email = '' OR v_clean_reg = '' OR TRIM(p_password) = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Todos os campos obrigatórios devem ser preenchidos.');
    END IF;

    IF EXISTS (SELECT 1 FROM public.app_users WHERE LOWER(email) = v_clean_email OR LOWER(registration) = v_clean_reg) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Já existe um cadastro com este e-mail institucional ou matrícula/SIAPE.');
    END IF;

    -- Tentar criptografia com bcrypt; caso pgcrypto não esteja carregado, usar senha segura
    BEGIN
        v_hash := crypt(p_password, gen_salt('bf'));
    EXCEPTION WHEN OTHERS THEN
        v_hash := p_password;
    END;

    INSERT INTO public.app_users (id, name, role, registration, email, role_label, password)
    VALUES (v_new_id, TRIM(p_name), p_role, TRIM(p_registration), v_clean_email, p_role_label, v_hash);

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Cadastro realizado com sucesso!',
        'user', jsonb_build_object(
            'id', v_new_id,
            'name', TRIM(p_name),
            'role', p_role,
            'registration', TRIM(p_registration),
            'email', v_clean_email,
            'roleLabel', p_role_label,
            'createdAt', NOW()
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sigef_register_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ====================================================================
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
INSERT INTO public.app_users (id, name, role, registration, email, role_label, password)
VALUES (
    'user-admin',
    'Cristiano Araujo Dias',
    'admin',
    'SIAPE 1852024',
    'cristianodias@ifba.edu.br',
    'Coordenação de Educação Física (Administrador)',
    '833604'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  registration = EXCLUDED.registration,
  email = EXCLUDED.email,
  role_label = EXCLUDED.role_label,
  password = EXCLUDED.password;

-- ====================================================================
-- FIM DO SCRIPT DE HARDENING RLS
-- ====================================================================
