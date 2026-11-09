// ====================================================================
// SQL de autenticação do SIGEF (fonte única para os scripts exibidos no app)
//
// Estes trechos são interpolados em SUPABASE_SQL_SCHEMA e em
// SUPABASE_RLS_HARDENING_SQL (src/services/supabase.ts) para que rodar
// qualquer um dos scripts NUNCA recrie a comparação de senha em texto puro.
// A versão para colar no SQL Editor está em supabase_auth_hardening.sql.
// ====================================================================

// Credenciais de app_users: coluna de hash, migração das senhas em texto puro,
// remoção da coluna antiga e privilégios mínimos para o cliente.
export const APP_USERS_SECURITY_SQL = `-- ----------------------------------------------------------------
-- app_users: senhas apenas com hash (bcrypt / pgcrypto)
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- No Supabase o pgcrypto fica no schema "extensions": deixe-o explícito no
-- search_path da sessão para que crypt()/gen_salt() resolvam durante a migração.
SET search_path = public, extensions, pg_temp;

ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Converte as senhas existentes em texto puro para bcrypt.
-- Senhas que já são hash ($2a$/$2b$/$2y$) são preservadas (idempotente).
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

-- Contas sem senha recebem um hash aleatório (precisam ser redefinidas).
UPDATE public.app_users
   SET password_hash = crypt(md5(random()::text || clock_timestamp()::text), gen_salt('bf', 10))
 WHERE password_hash IS NULL;

ALTER TABLE public.app_users ALTER COLUMN password_hash SET NOT NULL;

-- A coluna em texto puro deixa de existir.
ALTER TABLE public.app_users DROP COLUMN IF EXISTS password;

-- O hash nunca é legível pelo cliente: nada de privilégio de tabela inteira
-- (um GRANT de tabela anularia o REVOKE por coluna). Só as colunas de perfil.
REVOKE ALL ON public.app_users FROM anon, authenticated;
GRANT SELECT (id, name, role, registration, email, role_label, created_at)
   ON public.app_users TO anon, authenticated;

-- Escritas de credencial passam exclusivamente pelas funções SECURITY DEFINER.
DROP POLICY IF EXISTS "Public app_users access" ON public.app_users;
DROP POLICY IF EXISTS "App users safe select" ON public.app_users;
DROP POLICY IF EXISTS "App users insert" ON public.app_users;
DROP POLICY IF EXISTS "App users update" ON public.app_users;
DROP POLICY IF EXISTS "App users delete" ON public.app_users;

CREATE POLICY "App users safe select" ON public.app_users FOR SELECT USING (true);
CREATE POLICY "App users insert" ON public.app_users FOR INSERT WITH CHECK (id IS NOT NULL AND email <> '');
CREATE POLICY "App users update" ON public.app_users FOR UPDATE USING (true) WITH CHECK (id <> 'user-admin' OR role = 'admin');
CREATE POLICY "App users delete" ON public.app_users FOR DELETE USING (id <> 'user-admin');
`;

// Funções RPC: única porta de entrada para login, cadastro e troca de senha.
export const SIGEF_AUTH_FUNCTIONS_SQL = `-- ----------------------------------------------------------------
-- RPC de autenticação (nenhuma comparação de senha no navegador)
-- ----------------------------------------------------------------

-- Login: busca o usuário pelo identificador e compara SEMPRE em bcrypt.
-- Usuário inexistente e senha incorreta devolvem a MESMA resposta.
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
    v_digits     TEXT := REGEXP_REPLACE(COALESCE(p_identifier, ''), '\\D', '', 'g');
    v_hash       TEXT;
    v_match      BOOLEAN := FALSE;
BEGIN
    SELECT *
      INTO v_user
      FROM public.app_users
     WHERE LOWER(email) = v_clean_id
        OR LOWER(registration) = v_clean_id
        OR (v_digits <> '' AND REGEXP_REPLACE(registration, '\\D', '', 'g') = v_digits)
        OR (v_clean_id = 'admin' AND role = 'admin')
     LIMIT 1;

    -- Sem linha encontrada, calculamos um hash descartável para que o tempo de
    -- resposta não revele se o identificador existe.
    v_hash := COALESCE(v_user.password_hash, crypt(md5(random()::text), gen_salt('bf', 10)));

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

    -- Mensagem única: não é possível descobrir se o identificador existe.
    RETURN jsonb_build_object(
        'success', FALSE,
        'message', 'Credenciais inválidas. Verifique o identificador e a senha informados.'
    );
END;
$$;

-- Cadastro: a senha é recebida e gravada já com hash (nunca em texto puro).
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

-- Troca de senha: confere a senha atual no banco e grava o novo hash.
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
`;
