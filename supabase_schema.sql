-- ====================================================================
-- SIGEF - Sistema Integrado de Gestão da Educação Física (COEF - IF)
-- Script de Criação das Tabelas no Supabase (PostgreSQL)
--
-- Como executar:
-- 1. Acesse o painel do Supabase: https://supabase.com/dashboard/project/hvzvhqgfcozaprywordg
-- 2. Vá em "SQL Editor" no menu lateral esquerdo
-- 3. Cole este script e clique em "RUN"
--
-- ATENÇÃO: as políticas no fim deste arquivo são PERMISSIVAS. Rode em seguida
-- `supabase_rls_policies.sql` (nega anon, restringe app_users, imutabiliza
-- loans) — é ele que define a segurança vigente.
-- ====================================================================

-- 1. Tabela de Espaços Esportivos
CREATE TABLE IF NOT EXISTS public.spaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 40,
    open_hours TEXT NOT NULL DEFAULT '07:00 às 22:00',
    allowed_sports TEXT[] NOT NULL DEFAULT '{}',
    photo TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'livre',
    maintenance_os TEXT,
    maintenance_reason TEXT,
    maintenance_until TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Materiais (Acervo Patrimonial)
CREATE TABLE IF NOT EXISTS public.materials (
    id TEXT PRIMARY KEY,
    patrimony_number TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT NOT NULL,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER NOT NULL DEFAULT 0,
    conservation_state TEXT NOT NULL DEFAULT 'bom',
    storage_location TEXT NOT NULL DEFAULT 'Almoxarifado COEF',
    min_stock_alert INTEGER NOT NULL DEFAULT 2,
    notes TEXT DEFAULT '',
    history JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Kits de Materiais
CREATE TABLE IF NOT EXISTS public.kits (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sport TEXT NOT NULL,
    description TEXT DEFAULT '',
    items JSONB NOT NULL DEFAULT '[]'::JSONB,
    status TEXT NOT NULL DEFAULT 'pronto',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Solicitantes (Docentes, Alunos, Monitores, Estagiários, Servidores)
CREATE TABLE IF NOT EXISTS public.requesters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    registration TEXT NOT NULL,
    course_or_department TEXT NOT NULL,
    class_group TEXT,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    supervisor_name TEXT,
    shift TEXT,
    workload_hours INTEGER,
    assigned_area TEXT,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    block_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Empréstimos e Termos de Guarda
CREATE TABLE IF NOT EXISTS public.loans (
    id TEXT PRIMARY KEY,
    term_number TEXT NOT NULL,
    requester_id TEXT NOT NULL,
    requester_name TEXT NOT NULL,
    requester_type TEXT NOT NULL,
    requester_registration TEXT NOT NULL,
    supervisor_teacher_id TEXT,
    supervisor_teacher_name TEXT,
    items JSONB NOT NULL DEFAULT '[]'::JSONB,
    kit_id TEXT,
    kit_name TEXT,
    loan_date TEXT NOT NULL,
    expected_return_date TEXT NOT NULL,
    actual_return_date TEXT,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativo',
    responsibility_accepted BOOLEAN NOT NULL DEFAULT TRUE,
    attendant_name TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabela de Reservas e Cronograma de Espaços
CREATE TABLE IF NOT EXISTS public.reservations (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL,
    space_name TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    use_type TEXT NOT NULL DEFAULT 'aula',
    sport TEXT NOT NULL,
    group_or_class TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    teacher_name TEXT NOT NULL,
    participants_count INTEGER NOT NULL DEFAULT 30,
    kit_ids TEXT[] DEFAULT '{}',
    material_allocations JSONB DEFAULT '[]'::JSONB,
    recurrence TEXT NOT NULL DEFAULT 'none',
    recurrence_until TEXT,
    status TEXT NOT NULL DEFAULT 'confirmada',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabela de Mural da Coordenação
CREATE TABLE IF NOT EXISTS public.notices (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    author_role TEXT NOT NULL,
    date TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    priority TEXT NOT NULL DEFAULT 'normal',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabela de Usuários do Sistema
CREATE TABLE IF NOT EXISTS public.app_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'docente',
    registration TEXT NOT NULL,
    email TEXT NOT NULL,
    role_label TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Tabela de Regulamento e Contato COEF
CREATE TABLE IF NOT EXISTS public.regulation (
    id TEXT PRIMARY KEY DEFAULT 'current',
    rules JSONB NOT NULL DEFAULT '[]'::JSONB,
    contact JSONB NOT NULL DEFAULT '{}'::JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- Habilitar RLS e Políticas Seguras (Hardened RLS)
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- No Supabase o pgcrypto fica no schema "extensions": deixe-o explícito no
-- search_path da sessão para que crypt()/gen_salt() resolvam durante a migração.
SET search_path = public, extensions, pg_temp;

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulation ENABLE ROW LEVEL SECURITY;

-- 1. Espaços Esportivos
DROP POLICY IF EXISTS "Public spaces access" ON public.spaces;
DROP POLICY IF EXISTS "Spaces select" ON public.spaces;
DROP POLICY IF EXISTS "Spaces manage" ON public.spaces;
CREATE POLICY "Spaces select" ON public.spaces FOR SELECT USING (true);
CREATE POLICY "Spaces manage" ON public.spaces FOR ALL USING (true) WITH CHECK (true);

-- 2. Materiais (com validação estrita de estoque não-negativo)
DROP POLICY IF EXISTS "Public materials access" ON public.materials;
DROP POLICY IF EXISTS "Materials select" ON public.materials;
DROP POLICY IF EXISTS "Materials write" ON public.materials;
CREATE POLICY "Materials select" ON public.materials FOR SELECT USING (true);
CREATE POLICY "Materials write" ON public.materials FOR ALL USING (true)
WITH CHECK (total_quantity >= 0 AND available_quantity >= 0);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_materials_quantities') THEN
        ALTER TABLE public.materials ADD CONSTRAINT chk_materials_quantities
        CHECK (total_quantity >= 0 AND available_quantity >= 0);
    END IF;
END $$;

-- 3. Kits
DROP POLICY IF EXISTS "Public kits access" ON public.kits;
CREATE POLICY "Kits access" ON public.kits FOR ALL USING (true) WITH CHECK (true);

-- 4. Solicitantes
DROP POLICY IF EXISTS "Public requesters access" ON public.requesters;
CREATE POLICY "Requesters access" ON public.requesters FOR ALL USING (true) WITH CHECK (true);

-- 5. Empréstimos (Audit Trail Imutável: Sem permissão de DELETE para anon)
DROP POLICY IF EXISTS "Public loans access" ON public.loans;
DROP POLICY IF EXISTS "Loans select" ON public.loans;
DROP POLICY IF EXISTS "Loans insert" ON public.loans;
DROP POLICY IF EXISTS "Loans update" ON public.loans;
DROP POLICY IF EXISTS "Loans delete" ON public.loans;

CREATE POLICY "Loans select" ON public.loans FOR SELECT USING (true);
CREATE POLICY "Loans insert" ON public.loans FOR INSERT WITH CHECK (id IS NOT NULL AND term_number IS NOT NULL);
CREATE POLICY "Loans update" ON public.loans FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Loans delete" ON public.loans FOR DELETE USING (false);

-- 6. Reservas
DROP POLICY IF EXISTS "Public reservations access" ON public.reservations;
CREATE POLICY "Reservations access" ON public.reservations FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_reservations_times') THEN
        ALTER TABLE public.reservations ADD CONSTRAINT chk_reservations_times
        CHECK (end_time > start_time);
    END IF;
END $$;

-- 7. Mural de Avisos
DROP POLICY IF EXISTS "Public notices access" ON public.notices;
CREATE POLICY "Notices access" ON public.notices FOR ALL USING (true) WITH CHECK (true);

-- 8. Usuários (senhas apenas com hash; privilégios mínimos)

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

-- 9. Regulamento (Sem permissão de DELETE)
DROP POLICY IF EXISTS "Public regulation access" ON public.regulation;
DROP POLICY IF EXISTS "Regulation select" ON public.regulation;
DROP POLICY IF EXISTS "Regulation update" ON public.regulation;
DROP POLICY IF EXISTS "Regulation delete" ON public.regulation;

CREATE POLICY "Regulation select" ON public.regulation FOR SELECT USING (true);
CREATE POLICY "Regulation update" ON public.regulation FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Regulation delete" ON public.regulation FOR DELETE USING (false);

-- ====================================================================
-- Funções RPC Seguras (Login e Registro)
-- ====================================================================
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


-- Usuário Administrador Geral
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


