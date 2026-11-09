export type UserRole = 'admin' | 'docente' | 'monitor' | 'estagiario';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  registration: string; // SIAPE ou Matrícula
  email: string;
  roleLabel: string;
  password?: string;
  createdAt?: string;
}

export type SpaceType = 'quadra' | 'campo' | 'areia' | 'danca' | 'tatame' | 'musculacao' | 'outro';

export type SpaceStatus = 'livre' | 'em_uso' | 'reservado' | 'manutencao' | 'interditado';

export interface Space {
  id: string;
  name: string;
  type: SpaceType;
  capacity: number;
  openHours: string;
  allowedSports: string[];
  photo: string;
  notes: string;
  status: SpaceStatus;
  maintenanceOs?: string;
  maintenanceReason?: string;
  maintenanceUntil?: string;
}

export type UseType = 'aula' | 'treino' | 'extensao' | 'evento' | 'livre' | 'manutencao';

export type ReservationStatus = 'pendente' | 'confirmada' | 'cancelada' | 'concluida';

export interface MaterialAllocation {
  materialId: string;
  materialName: string;
  quantity: number;
}

export interface Reservation {
  id: string;
  spaceId: string;
  spaceName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  useType: UseType;
  sport: string;
  groupOrClass: string;
  teacherId: string;
  teacherName: string;
  participantsCount: number;
  kitIds: string[];
  materialAllocations: MaterialAllocation[];
  recurrence: 'none' | 'weekly';
  recurrenceUntil?: string; // YYYY-MM-DD
  status: ReservationStatus;
  notes?: string;
}

export interface SportCategory {
  id: string;
  name: string;
  isCustom?: boolean;
}

export type StandardMaterialCategory =
  | 'futebol'
  | 'volei'
  | 'basquete'
  | 'handebol'
  | 'futsal'
  | 'atletismo'
  | 'danca'
  | 'lutas'
  | 'musculacao'
  | 'recreacao';

export type MaterialCategory = StandardMaterialCategory | (string & {});

export type ConservationState = 'novo' | 'bom' | 'regular' | 'danificado' | 'baixado';

export interface MaterialMovement {
  id: string;
  date: string; // ISO
  type: 'entrada' | 'baixa' | 'emprestimo' | 'devolucao' | 'manutencao' | 'ajuste';
  quantity: number;
  reason: string;
  responsible: string;
}

export interface Material {
  id: string;
  patrimonyNumber: string;
  name: string;
  technicalDescription: string;
  category: MaterialCategory;
  totalQuantity: number;
  availableQuantity: number;
  conservationState: ConservationState;
  storageLocation: string;
  minStockAlert: number;
  history: MaterialMovement[];
}

export interface SportKitItem {
  materialId: string;
  materialName: string;
  quantity: number;
}

export type KitStatus = 'pronto' | 'incompleto' | 'emprestado';

export interface SportKit {
  id: string;
  name: string;
  description: string;
  category: MaterialCategory;
  items: SportKitItem[];
  status: KitStatus;
}

export type RequesterType = 'aluno' | 'docente' | 'servidor' | 'estagiario' | 'monitor';

export interface Requester {
  id: string;
  name: string;
  type: RequesterType;
  registration: string; // Matrícula ou SIAPE
  courseOrDepartment: string;
  classGroup?: string;
  email: string;
  phone: string;
  supervisorName?: string; // Docente Supervisor / Orientador (para estagiários e monitores)
  shift?: string; // Turno de atuação (Manhã, Tarde, Noite, Integral)
  workloadHours?: number; // Carga horária semanal (ex: 20h, 30h)
  assignedArea?: string; // Área de atuação (ex: Almoxarifado, Apoio a Aulas, Musculação)
  isBlocked: boolean;
  blockReason?: string;
}

export type ReturnItemState = 'pendente' | 'devolvido_ok' | 'danificado' | 'extraviado';

export interface LoanItem {
  materialId: string;
  materialName: string;
  patrimonyNumber: string;
  quantity: number;
  returnStatus: ReturnItemState;
  inspectionNote?: string;
}

export type LoanStatus = 'ativo' | 'atrasado' | 'devolvido';

export interface Loan {
  id: string;
  termNumber: string; // Ex: "#4891"
  requesterId: string;
  requesterName: string;
  requesterType: RequesterType;
  requesterRegistration: string;
  supervisorTeacherId?: string;
  supervisorTeacherName?: string;
  items: LoanItem[];
  kitId?: string;
  kitName?: string;
  loanDate: string; // ISO string
  expectedReturnDate: string; // ISO string
  actualReturnDate?: string; // ISO string
  purpose: string;
  status: LoanStatus;
  responsibilityAccepted: boolean;
  attendantName: string;
  notes?: string;
}

export interface NoticeBoardItem {
  id: string;
  title: string;
  content: string;
  author: string;
  authorRole: string;
  date: string; // dd/mm/aaaa
  isPinned: boolean;
  priority: 'baixa' | 'normal' | 'alta';
}

export interface RegulationRule {
  id: string;
  title: string;
  text: string;
}

export interface CoefRegulation {
  rules: RegulationRule[];
  contact: {
    campus: string;
    department: string;
    building: string;
    room: string;
    email: string;
    phone: string;
    whatsapp: string;
    openingHours: string;
    coordinatorName: string;
    siapeCoordinator: string;
  };
}

export type ActiveTab =
  | 'inicio'
  | 'espacos'
  | 'materiais'
  | 'emprestimos'
  | 'kits'
  | 'docentes'
  | 'relatorios'
  | 'normas';
