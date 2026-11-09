-- ====================================================================
-- SIGEF — MIGRAÇÃO DE AUTENTICAÇÃO (IF / COEF)
-- Login exclusivamente no servidor, senhas somente com hash
--
-- Execute este script UMA vez no SQL Editor do projeto Supabase:
-- https://supabase.com/dashboard/project/hvzvhqgfcozaprywordg/sql
--
-- POR QUE RPC (sigef_login) E NÃO SUPABASE AUTH?
-- O schema já tem public.app_users com id, name, role, registration, email,
-- role_label e tudo o que o app usa em telas, empréstimos e reservas. Migrar
-- para Supabase Auth exigiria criar um auth.users por pessoa, manter um
-- vínculo auth_user_id -> app_users, migrar senhas que o GoTrue não importa em
-- texto puro, reescrever o cadastro e todas as leituras de perfil. Trocar a
-- comparação por crypt() dentro da RPC existente resolve o problema de
-- segurança mexendo em UM dos lados (banco) e mantendo o formato de retorno
-- que o front-end já consome. Por isso: RPC.
--
-- O QUE ESTE SCRIPT FAZ
-- 1. Cria app_users.password_hash e converte para bcrypt
--    (crypt(senha, gen_salt('bf', 10))) todas as senhas que ainda estão em
--    texto puro. A senha original do usuário continua valendo.
-- 2. Remove a coluna app_users.password (texto puro deixa de existir).
-- 3. Retira do cliente anon/authenticated qualquer acesso ao hash.
-- 4. Recria sigef_login comparando SOMENTE via crypt() e devolvendo a MESMA
--    mensagem para "usuário não encontrado" e "senha incorreta".
-- 5. Cria sigef_register_user (grava sempre hash) e sigef_change_password
--    (confere a senha atual no banco e grava o novo hash).
--
-- É idempotente: pode ser executado mais de uma vez sem efeito colateral.
-- Depois de rodar, o app não precisa de nenhuma variável nova.
-- ====================================================================

-- ----------------------------------------------------------------
-- 1 + 2. Hash das senhas existentes e remoção da coluna em texto puro
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
-- 3. Privilégios: o cliente só lê colunas de perfil, nunca o hash
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
-- 4. Login: única decisão de autenticação, sempre em bcrypt
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
-- 5. Cadastro e troca de senha (sempre com hash, nunca em texto puro)
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
