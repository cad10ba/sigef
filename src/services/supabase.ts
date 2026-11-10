import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
