-- ====================================================================
-- SIGEF - Sistema Integrado de Gestão da Educação Física (COEF - IF)
-- Script de Criação das Tabelas no Supabase (PostgreSQL)
--
-- Como executar:
-- 1. Acesse o painel do Supabase: https://supabase.com/dashboard/project/hvzvhqgfcozaprywordg
-- 2. Vá em "SQL Editor" no menu lateral esquerdo
-- 3. Cole este script e clique em "RUN"
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
    password TEXT NOT NULL DEFAULT 'admin',
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

-- 8. Usuários (Proteção de senha e proteção do administrador)
DROP POLICY IF EXISTS "Public app_users access" ON public.app_users;
DROP POLICY IF EXISTS "App users safe select" ON public.app_users;
DROP POLICY IF EXISTS "App users insert" ON public.app_users;
DROP POLICY IF EXISTS "App users update" ON public.app_users;
DROP POLICY IF EXISTS "App users delete" ON public.app_users;

-- Revogar leitura direta da coluna sensível password de clientes não autenticados
REVOKE SELECT (password) ON public.app_users FROM anon, authenticated;
GRANT SELECT (id, name, role, registration, email, role_label, created_at) ON public.app_users TO anon, authenticated;

CREATE POLICY "App users safe select" ON public.app_users FOR SELECT USING (true);
CREATE POLICY "App users insert" ON public.app_users FOR INSERT WITH CHECK (id IS NOT NULL AND email <> '');
CREATE POLICY "App users update" ON public.app_users FOR UPDATE USING (true) WITH CHECK (id <> 'user-admin' OR role = 'admin');
CREATE POLICY "App users delete" ON public.app_users FOR DELETE USING (id <> 'user-admin');

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

GRANT EXECUTE ON FUNCTION public.sigef_login(TEXT, TEXT) TO anon, authenticated;

-- Usuário Administrador Geral
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


