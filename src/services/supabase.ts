import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { APP_USERS_SECURITY_SQL, SIGEF_AUTH_FUNCTIONS_SQL } from './authSql';
// Script de RLS versionado no repositório (uma única fonte para o app e para o
// SQL Editor): nada de política permissiva embutida em string no código.
import rlsPoliciesSql from '../../supabase_rls_policies.sql?raw';
import {
  Space,
  Material,
  SportKit,
  Requester,
  Loan,
  Reservation,
  NoticeBoardItem,
  UserProfile,
  CoefRegulation,
} from '../types/sigef';

// Credentials provided by the user
const RAW_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 'https://hvzvhqgfcozaprywordg.supabase.co';
// Strip trailing /rest/v1 or /rest/v1/ if user pasted the REST endpoint URL
export const SUPABASE_URL = RAW_URL.replace(/\/rest\/v1\/?$/, '').trim();
export const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  'sb_publishable_q19GlvrpfNFaSTSbwhmDtw_uirJ3PNW';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const SUPABASE_PROJECT_ID = 'hvzvhqgfcozaprywordg';

export const REQUIRED_TABLES = [
  'spaces',
  'materials',
  'kits',
  'requesters',
  'loans',
  'reservations',
  'notices',
  'app_users',
  'regulation',
] as const;

export type TableName = (typeof REQUIRED_TABLES)[number];

// Complete SQL Schema script ready to be executed in the Supabase SQL Editor
export const SUPABASE_SQL_SCHEMA = `-- ====================================================================
-- SIGEF - Sistema Integrado de Gestão da Educação Física (IF)
-- Script de Criação das Tabelas no Supabase (PostgreSQL)
-- Execute este script no SQL Editor do seu projeto Supabase:
-- https://supabase.com/dashboard/project/hvzvhqgfcozaprywordg/sql
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

-- 2. Materiais (validação de estoque positivo)
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

-- 5. Empréstimos (Audit Trail Imutável: DELETE BLOQUEADO para proteção de patrimônio)
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
${APP_USERS_SECURITY_SQL}

-- 9. Regulamento (Sem permissão de exclusão)
DROP POLICY IF EXISTS "Public regulation access" ON public.regulation;
DROP POLICY IF EXISTS "Regulation select" ON public.regulation;
DROP POLICY IF EXISTS "Regulation update" ON public.regulation;
DROP POLICY IF EXISTS "Regulation delete" ON public.regulation;

CREATE POLICY "Regulation select" ON public.regulation FOR SELECT USING (true);
CREATE POLICY "Regulation update" ON public.regulation FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Regulation delete" ON public.regulation FOR DELETE USING (false);

-- RPC de autenticação (login, cadastro e troca de senha com hash)
${SIGEF_AUTH_FUNCTIONS_SQL}

-- ====================================================================
-- RLS restritiva aplicada por ÚLTIMO: remove as políticas permissivas acima
-- e recria o conjunto fechado (fonte única: supabase_rls_policies.sql)
-- ====================================================================
${rlsPoliciesSql}
`;

// Script de RLS restritiva (fonte única: supabase_rls_policies.sql na raiz).
// Exibido/copiado pelo app: sem políticas permissivas, dados pessoais só com
// sessão do Supabase Auth e histórico de empréstimos imutável.
export const SUPABASE_RLS_HARDENING_SQL = rlsPoliciesSql;

// Helper conversion functions (CamelCase <-> snake_case)
export function spaceToRow(s: Space) {
  return {
    id: s.id,
    name: s.name,
    type: s.type,
    capacity: s.capacity,
    open_hours: s.openHours,
    allowed_sports: s.allowedSports,
    photo: s.photo || '',
    notes: s.notes || '',
    status: s.status,
    maintenance_os: s.maintenanceOs || null,
    maintenance_reason: s.maintenanceReason || null,
    maintenance_until: s.maintenanceUntil || null,
  };
}

export function rowToSpace(r: any): Space {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    capacity: r.capacity,
    openHours: r.open_hours || '07:00 às 22:00',
    allowedSports: r.allowed_sports || [],
    photo: r.photo || '',
    notes: r.notes || '',
    status: r.status || 'livre',
    maintenanceOs: r.maintenance_os || undefined,
    maintenanceReason: r.maintenance_reason || undefined,
    maintenanceUntil: r.maintenance_until || undefined,
  };
}

export function materialToRow(m: Material) {
  return {
    id: m.id,
    patrimony_number: m.patrimonyNumber,
    name: m.name,
    description: m.technicalDescription || '',
    category: m.category,
    total_quantity: m.totalQuantity,
    available_quantity: m.availableQuantity,
    conservation_state: m.conservationState,
    storage_location: m.storageLocation,
    min_stock_alert: m.minStockAlert,
    notes: '',
    history: m.history || [],
  };
}

export function rowToMaterial(r: any): Material {
  return {
    id: r.id,
    patrimonyNumber: r.patrimony_number,
    name: r.name,
    technicalDescription: r.description || '',
    category: r.category,
    totalQuantity: Number(r.total_quantity) || 0,
    availableQuantity: Number(r.available_quantity) || 0,
    conservationState: r.conservation_state,
    storageLocation: r.storage_location || 'Almoxarifado COEF',
    minStockAlert: Number(r.min_stock_alert) || 2,
    history: Array.isArray(r.history) ? r.history : [],
  };
}

export function kitToRow(k: SportKit) {
  return {
    id: k.id,
    name: k.name,
    sport: k.category,
    description: k.description || '',
    items: k.items,
    status: k.status,
    notes: '',
  };
}

export function rowToKit(r: any): SportKit {
  return {
    id: r.id,
    name: r.name,
    category: r.sport || 'recreacao',
    description: r.description || '',
    items: Array.isArray(r.items) ? r.items : [],
    status: r.status || 'pronto',
  };
}

export function requesterToRow(req: Requester) {
  return {
    id: req.id,
    name: req.name,
    type: req.type,
    registration: req.registration,
    course_or_department: req.courseOrDepartment,
    class_group: req.classGroup || null,
    email: req.email,
    phone: req.phone,
    supervisor_name: req.supervisorName || null,
    shift: req.shift || null,
    workload_hours: req.workloadHours || null,
    assigned_area: req.assignedArea || null,
    is_blocked: req.isBlocked,
    block_reason: req.blockReason || null,
  };
}

export function rowToRequester(r: any): Requester {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    registration: r.registration,
    courseOrDepartment: r.course_or_department,
    classGroup: r.class_group || undefined,
    email: r.email,
    phone: r.phone,
    supervisorName: r.supervisor_name || undefined,
    shift: r.shift || undefined,
    workloadHours: r.workload_hours ? Number(r.workload_hours) : undefined,
    assignedArea: r.assigned_area || undefined,
    isBlocked: Boolean(r.is_blocked),
    blockReason: r.block_reason || undefined,
  };
}

export function loanToRow(l: Loan) {
  return {
    id: l.id,
    term_number: l.termNumber,
    requester_id: l.requesterId,
    requester_name: l.requesterName,
    requester_type: l.requesterType,
    requester_registration: l.requesterRegistration,
    supervisor_teacher_id: l.supervisorTeacherId || null,
    supervisor_teacher_name: l.supervisorTeacherName || null,
    items: l.items,
    kit_id: l.kitId || null,
    kit_name: l.kitName || null,
    loan_date: l.loanDate,
    expected_return_date: l.expectedReturnDate,
    actual_return_date: l.actualReturnDate || null,
    purpose: l.purpose,
    status: l.status,
    responsibility_accepted: l.responsibilityAccepted,
    attendant_name: l.attendantName,
    notes: l.notes || null,
  };
}

export function rowToLoan(r: any): Loan {
  return {
    id: r.id,
    termNumber: r.term_number,
    requesterId: r.requester_id,
    requesterName: r.requester_name,
    requesterType: r.requester_type,
    requesterRegistration: r.requester_registration,
    supervisorTeacherId: r.supervisor_teacher_id || undefined,
    supervisorTeacherName: r.supervisor_teacher_name || undefined,
    items: Array.isArray(r.items) ? r.items : [],
    kitId: r.kit_id || undefined,
    kitName: r.kit_name || undefined,
    loanDate: r.loan_date,
    expectedReturnDate: r.expected_return_date,
    actualReturnDate: r.actual_return_date || undefined,
    purpose: r.purpose,
    status: r.status,
    responsibilityAccepted: Boolean(r.responsibility_accepted),
    attendantName: r.attendant_name,
    notes: r.notes || undefined,
  };
}

export function reservationToRow(res: Reservation) {
  return {
    id: res.id,
    space_id: res.spaceId,
    space_name: res.spaceName,
    date: res.date,
    start_time: res.startTime,
    end_time: res.endTime,
    use_type: res.useType,
    sport: res.sport,
    group_or_class: res.groupOrClass,
    teacher_id: res.teacherId,
    teacher_name: res.teacherName,
    participants_count: res.participantsCount,
    kit_ids: res.kitIds || [],
    material_allocations: res.materialAllocations || [],
    recurrence: res.recurrence,
    recurrence_until: res.recurrenceUntil || null,
    status: res.status,
    notes: res.notes || null,
  };
}

export function rowToReservation(r: any): Reservation {
  return {
    id: r.id,
    spaceId: r.space_id,
    spaceName: r.space_name,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    useType: r.use_type,
    sport: r.sport,
    groupOrClass: r.group_or_class,
    teacherId: r.teacher_id,
    teacherName: r.teacher_name,
    participantsCount: Number(r.participants_count) || 30,
    kitIds: Array.isArray(r.kit_ids) ? r.kit_ids : [],
    materialAllocations: Array.isArray(r.material_allocations) ? r.material_allocations : [],
    recurrence: r.recurrence || 'none',
    recurrenceUntil: r.recurrence_until || undefined,
    status: r.status || 'confirmada',
    notes: r.notes || undefined,
  };
}

export function noticeToRow(n: NoticeBoardItem) {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    author: n.author,
    author_role: n.authorRole,
    date: n.date,
    is_pinned: n.isPinned,
    priority: n.priority,
  };
}

export function rowToNotice(r: any): NoticeBoardItem {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    author: r.author,
    authorRole: r.author_role,
    date: r.date,
    isPinned: Boolean(r.is_pinned),
    priority: r.priority || 'normal',
  };
}

// Perfis apenas: credenciais (password_hash) nunca passam pelo cliente.
export function rowToUser(r: any): UserProfile {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    registration: r.registration,
    email: r.email,
    roleLabel: r.role_label,
    createdAt: r.created_at,
  };
}

// Check connectivity with Supabase project
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  projectUrl: string;
  foundTables: string[];
  missingTables: string[];
  message: string;
}> {
  const foundTables: string[] = [];
  const missingTables: string[] = [];

  try {
    for (const table of REQUIRED_TABLES) {
      // `select('id')` instead of `select('*')`: app_users exposes only the
      // profile columns to anon, so `*` is denied after the auth hardening.
      const { error } = await supabase.from(table).select('id').limit(1);
      if (!error) {
        foundTables.push(table);
      } else if (error.code === 'PGRST205' || error.message?.includes('not find the table')) {
        missingTables.push(table);
      } else {
        // Other error (e.g. permission or empty)
        missingTables.push(table);
      }
    }

    const connected = true; // Project responded
    let message = '';
    if (foundTables.length === REQUIRED_TABLES.length) {
      message = 'Conexão perfeita! Todas as 9 tabelas do SIGEF estão ativas no Supabase.';
    } else if (foundTables.length > 0) {
      message = `Conectado ao Supabase! ${foundTables.length}/${REQUIRED_TABLES.length} tabelas identificadas.`;
    } else {
      message =
        'Conexão estabelecida com o projeto Supabase! Execute o script SQL no Supabase para criar as tabelas.';
    }

    return {
      connected,
      projectUrl: SUPABASE_URL,
      foundTables,
      missingTables,
      message,
    };
  } catch (err: any) {
    return {
      connected: false,
      projectUrl: SUPABASE_URL,
      foundTables: [],
      missingTables: [...REQUIRED_TABLES],
      message: err?.message || 'Falha ao conectar com o Supabase.',
    };
  }
}
