import {
  Space,
  Material,
  SportKit,
  Requester,
  Loan,
  Reservation,
  NoticeBoardItem,
  CoefRegulation,
  UserProfile,
  UserRole,
  ReturnItemState,
  SportCategory,
} from '../types/sigef';
import {
  INITIAL_USERS,
  INITIAL_SPACES,
  INITIAL_MATERIALS,
  INITIAL_KITS,
  INITIAL_REQUESTERS,
  INITIAL_LOANS,
  INITIAL_RESERVATIONS,
  INITIAL_NOTICES,
  INITIAL_REGULATION,
  DEFAULT_SPORT_CATEGORIES,
} from '../data/initialData';
import {
  supabase,
  spaceToRow,
  rowToSpace,
  materialToRow,
  rowToMaterial,
  kitToRow,
  rowToKit,
  requesterToRow,
  rowToRequester,
  loanToRow,
  rowToLoan,
  reservationToRow,
  rowToReservation,
  noticeToRow,
  rowToNotice,
  userToRow,
  rowToUser,
  testSupabaseConnection,
} from './supabase';

async function safeSupabaseUpsert(table: string, data: any) {
  try {
    const { error } = await supabase.from(table).upsert(data);
    if (error && error.code !== 'PGRST205') {
      console.warn(`Supabase upsert into ${table} note:`, error.message);
    }
  } catch {
    // Graceful offline/missing tables fallback
  }
}

async function safeSupabaseDelete(table: string, id: string) {
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error && error.code !== 'PGRST205') {
      console.warn(`Supabase delete from ${table} note:`, error.message);
    }
  } catch {
    // Graceful offline/missing tables fallback
  }
}

async function safeSupabaseDeleteMultiple(table: string, ids: string[]) {
  try {
    if (!ids || ids.length === 0) return;
    const { error } = await supabase.from(table).delete().in('id', ids);
    if (error && error.code !== 'PGRST205') {
      console.warn(`Supabase delete multiple from ${table} note:`, error.message);
    }
  } catch {
    // Graceful offline/missing tables fallback
  }
}

async function safeSupabaseDeleteAll(table: string) {
  try {
    const { error } = await supabase.from(table).delete().neq('id', '');
    if (error && error.code !== 'PGRST205') {
      console.warn(`Supabase delete all from ${table} note:`, error.message);
    }
  } catch {
    // Graceful offline/missing tables fallback
  }
}

const STORAGE_KEYS = {
  CURRENT_USER: 'sigef_current_user_v2_blank',
  AUTH_USER: 'sigef_auth_user_v2_blank',
  USERS: 'sigef_users_v2_blank',
  SPACES: 'sigef_spaces_v2_blank',
  MATERIALS: 'sigef_materials_v2_blank',
  KITS: 'sigef_kits_v2_blank',
  REQUESTERS: 'sigef_requesters_v2_blank',
  LOANS: 'sigef_loans_v2_blank',
  RESERVATIONS: 'sigef_reservations_v2_blank',
  NOTICES: 'sigef_notices_v2_blank',
  REGULATION: 'sigef_regulation_v2_blank',
  CATEGORIES: 'sigef_categories_v2_custom',
  THEME: 'sigef_theme_v2_blank',
};

// Event listener mechanism to notify active tabs/components when storage updates
type StorageListener = () => void;
const listeners: Set<StorageListener> = new Set();

export function subscribeToStorage(listener: StorageListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('Error notifying storage listener:', err);
    }
  });
}

function getStoredItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`Failed to read ${key} from localStorage:`, e);
    return defaultValue;
  }
}

function setStoredItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    notifyListeners();
  } catch (e) {
    console.error(`Failed to save ${key} to localStorage:`, e);
  }
}

export const sigefStorage = {
  init() {
    // Clean old v1 demo keys if present so user starts fresh in blank
    [
      'sigef_spaces_v1',
      'sigef_materials_v1',
      'sigef_kits_v1',
      'sigef_requesters_v1',
      'sigef_loans_v1',
      'sigef_reservations_v1',
      'sigef_notices_v1',
      'sigef_regulation_v1',
      'sigef_users_v1',
      'sigef_current_user_v1',
    ].forEach((k) => localStorage.removeItem(k));

    if (!localStorage.getItem(STORAGE_KEYS.SPACES)) {
      setStoredItem(STORAGE_KEYS.SPACES, INITIAL_SPACES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.MATERIALS)) {
      setStoredItem(STORAGE_KEYS.MATERIALS, INITIAL_MATERIALS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.KITS)) {
      setStoredItem(STORAGE_KEYS.KITS, INITIAL_KITS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.REQUESTERS)) {
      setStoredItem(STORAGE_KEYS.REQUESTERS, INITIAL_REQUESTERS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.LOANS)) {
      setStoredItem(STORAGE_KEYS.LOANS, INITIAL_LOANS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.RESERVATIONS)) {
      setStoredItem(STORAGE_KEYS.RESERVATIONS, INITIAL_RESERVATIONS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.NOTICES)) {
      setStoredItem(STORAGE_KEYS.NOTICES, INITIAL_NOTICES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.REGULATION)) {
      setStoredItem(STORAGE_KEYS.REGULATION, INITIAL_REGULATION);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
      setStoredItem(STORAGE_KEYS.CATEGORIES, DEFAULT_SPORT_CATEGORIES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      setStoredItem(STORAGE_KEYS.USERS, []);
    } else {
      // Remove any previously pre-seeded hardcoded admin
      const users = this.getUsers().filter((u) => u.id !== 'user-admin');
      setStoredItem(STORAGE_KEYS.USERS, users);
    }
    const authUser = this.getAuthUser();
    if (authUser && authUser.id === 'user-admin') {
      this.setAuthUser(null);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
    this.refreshAllKitStatuses();
    this.syncFromSupabase().catch(() => {});
  },

  resetToInitialData() {
    setStoredItem(STORAGE_KEYS.SPACES, INITIAL_SPACES);
    setStoredItem(STORAGE_KEYS.MATERIALS, INITIAL_MATERIALS);
    setStoredItem(STORAGE_KEYS.KITS, INITIAL_KITS);
    setStoredItem(STORAGE_KEYS.REQUESTERS, INITIAL_REQUESTERS);
    setStoredItem(STORAGE_KEYS.LOANS, INITIAL_LOANS);
    setStoredItem(STORAGE_KEYS.RESERVATIONS, INITIAL_RESERVATIONS);
    setStoredItem(STORAGE_KEYS.NOTICES, INITIAL_NOTICES);
    setStoredItem(STORAGE_KEYS.REGULATION, INITIAL_REGULATION);
    setStoredItem(STORAGE_KEYS.USERS, []);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    this.refreshAllKitStatuses();
  },

  // Users & Auth profile
  getUsers(): UserProfile[] {
    return getStoredItem<UserProfile[]>(STORAGE_KEYS.USERS, []);
  },

  getAuthUser(): UserProfile | null {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserProfile;
    } catch {
      return null;
    }
  },

  setAuthUser(user: UserProfile | null) {
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    } else {
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
    }
    notifyListeners();
  },

  getCurrentUser(): UserProfile {
    const auth = this.getAuthUser();
    if (auth) return auth;
    const stored = getStoredItem<UserProfile | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (stored) return stored;
    const users = this.getUsers();
    if (users.length > 0) return users[0];
    return {
      id: 'temp-admin',
      name: 'Administrador',
      role: 'admin',
      registration: 'SIAPE',
      email: 'admin@ifba.edu.br',
      roleLabel: 'Coordenação de Educação Física (Administrador)',
    };
  },

  setCurrentUser(user: UserProfile) {
    setStoredItem(STORAGE_KEYS.CURRENT_USER, user);
    this.setAuthUser(user);
  },

  login(identifier: string, password: string): { success: boolean; message: string; user?: UserProfile } {
    const users = this.getUsers();
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    if (users.length === 0) {
      return {
        success: false,
        message: 'Nenhum usuário cadastrado no sistema ainda. Cadastre o Administrador na aba "Criar Nova Conta".',
      };
    }

    const user = users.find(
      (u) =>
        u.email.toLowerCase() === cleanId ||
        u.registration.toLowerCase() === cleanId ||
        (cleanId.replace(/\D/g, '') && u.registration.toLowerCase().replace(/\D/g, '') === cleanId.replace(/\D/g, '')) ||
        (cleanId === 'admin' && u.role === 'admin')
    );

    if (!user) {
      return { success: false, message: 'Usuário não encontrado. Verifique seu e-mail institucional ou matrícula/SIAPE.' };
    }

    const expectedPass = user.password || '123456';
    if (cleanPass !== expectedPass) {
      return { success: false, message: 'Senha incorreta. Verifique suas credenciais e tente novamente.' };
    }

    this.setCurrentUser(user);
    this.setAuthUser(user);
    return { success: true, message: `Login realizado com sucesso! Bem-vindo(a), ${user.name}.`, user };
  },

  async loginAsync(
    identifier: string,
    password: string
  ): Promise<{ success: boolean; message: string; user?: UserProfile }> {
    // 1. Fast local verification
    const localRes = this.login(identifier, password);
    if (localRes.success) {
      return localRes;
    }

    // 2. Cloud RPC verification via Supabase sigef_login (secure server-side verification without password exposure)
    try {
      const { data, error } = await supabase.rpc('sigef_login', {
        p_identifier: identifier,
        p_password: password,
      });

      if (!error && data && data.success && data.user) {
        const u = data.user;
        const cloudUser: UserProfile = {
          id: u.id,
          name: u.name,
          role: u.role,
          registration: u.registration,
          email: u.email,
          roleLabel: u.roleLabel || u.role_label,
          createdAt: u.createdAt || u.created_at,
        };

        // Cache user profile locally
        const users = this.getUsers();
        const existingIdx = users.findIndex((x) => x.id === cloudUser.id);
        if (existingIdx >= 0) {
          users[existingIdx] = { ...users[existingIdx], ...cloudUser };
        } else {
          users.push(cloudUser);
        }
        setStoredItem(STORAGE_KEYS.USERS, users);

        this.setCurrentUser(cloudUser);
        this.setAuthUser(cloudUser);
        return { success: true, message: data.message || `Login realizado com sucesso!`, user: cloudUser };
      }
    } catch {
      // Offline fallback
    }

    return localRes;
  },

  registerUser(data: {
    name: string;
    email: string;
    registration: string;
    role: UserRole;
    password: string;
    department?: string;
    phone?: string;
  }): { success: boolean; message: string; user?: UserProfile } {
    const users = this.getUsers();
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanReg = data.registration.trim().toLowerCase();

    if (!data.name.trim() || !cleanEmail || !cleanReg || !data.password) {
      return { success: false, message: 'Todos os campos obrigatórios devem ser preenchidos.' };
    }

    const existing = users.find(
      (u) => u.email.toLowerCase() === cleanEmail || u.registration.toLowerCase() === cleanReg
    );
    if (existing) {
      return { success: false, message: 'Já existe um cadastro com este e-mail institucional ou matrícula/SIAPE.' };
    }

    let roleLabel = 'Docente de Educação Física';
    if (data.role === 'admin') roleLabel = 'Coordenação de Educação Física (Administrador)';
    else if (data.role === 'monitor') roleLabel = 'Monitor / Bolsista de Ed. Física';
    else if (data.role === 'estagiario') roleLabel = 'Estagiário de Ed. Física';

    const newUser: UserProfile = {
      id: 'user-' + Date.now(),
      name: data.name.trim(),
      email: data.email.trim(),
      registration: data.registration.trim(),
      role: data.role,
      roleLabel,
      password: data.password,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    setStoredItem(STORAGE_KEYS.USERS, users);

    // Sync to Requesters collection so user can borrow or reserve right away
    const requesters = this.getRequesters();
    const existingReq = requesters.find(
      (r) => r.registration.toLowerCase() === cleanReg || r.email.toLowerCase() === cleanEmail
    );
    if (!existingReq) {
      const reqType = data.role === 'admin' ? 'servidor' : data.role;
      const newReq: Requester = {
        id: 'req-' + Date.now(),
        name: newUser.name,
        type: reqType as any,
        registration: newUser.registration,
        courseOrDepartment: data.department?.trim() || 'Coordenação de Educação Física (COEF)',
        email: newUser.email,
        phone: data.phone?.trim() || '(85) 9',
        isBlocked: false,
      };
      requesters.push(newReq);
      setStoredItem(STORAGE_KEYS.REQUESTERS, requesters);
      safeSupabaseUpsert('requesters', requesterToRow(newReq));
    }

    safeSupabaseUpsert('app_users', userToRow(newUser));

    this.setCurrentUser(newUser);
    this.setAuthUser(newUser);

    return {
      success: true,
      message: `Conta criada com sucesso! Bem-vindo(a) ao SIGEF, ${newUser.name}.`,
      user: newUser,
    };
  },

  logout(): void {
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    notifyListeners();
  },

  // Spaces
  getSpaces(): Space[] {
    return getStoredItem<Space[]>(STORAGE_KEYS.SPACES, INITIAL_SPACES);
  },

  saveSpace(space: Space): void {
    const list = this.getSpaces();
    const idx = list.findIndex((s) => s.id === space.id);
    if (idx >= 0) {
      list[idx] = space;
    } else {
      list.push(space);
    }
    setStoredItem(STORAGE_KEYS.SPACES, list);
    safeSupabaseUpsert('spaces', spaceToRow(space));
  },

  deleteSpace(spaceId: string): void {
    const list = this.getSpaces().filter((s) => s.id !== spaceId);
    setStoredItem(STORAGE_KEYS.SPACES, list);
    safeSupabaseDelete('spaces', spaceId);
  },

  // Materials & Inventory
  getMaterials(): Material[] {
    return getStoredItem<Material[]>(STORAGE_KEYS.MATERIALS, INITIAL_MATERIALS);
  },

  saveMaterial(mat: Material): void {
    const list = this.getMaterials();
    const idx = list.findIndex((m) => m.id === mat.id);
    if (idx >= 0) {
      list[idx] = mat;
    } else {
      list.push(mat);
    }
    setStoredItem(STORAGE_KEYS.MATERIALS, list);
    this.refreshAllKitStatuses();
    safeSupabaseUpsert('materials', materialToRow(mat));
  },

  deleteMaterial(materialId: string): void {
    const list = this.getMaterials().filter((m) => m.id !== materialId);
    setStoredItem(STORAGE_KEYS.MATERIALS, list);
    this.refreshAllKitStatuses();
    safeSupabaseDelete('materials', materialId);
  },

  deleteMultipleMaterials(materialIds: string[]): void {
    if (!materialIds || materialIds.length === 0) return;
    const idSet = new Set(materialIds);
    const list = this.getMaterials().filter((m) => !idSet.has(m.id));
    setStoredItem(STORAGE_KEYS.MATERIALS, list);
    this.refreshAllKitStatuses();
    safeSupabaseDeleteMultiple('materials', materialIds);
  },

  clearAllMaterials(): void {
    setStoredItem(STORAGE_KEYS.MATERIALS, []);
    this.refreshAllKitStatuses();
    safeSupabaseDeleteAll('materials');
  },

  saveMaterialsBatch(newMaterials: Material[], mode: 'add' | 'replace' = 'add'): void {
    if (!newMaterials || newMaterials.length === 0) return;
    let list = this.getMaterials();

    if (mode === 'replace') {
      list = [...newMaterials];
      safeSupabaseDeleteAll('materials');
    } else {
      newMaterials.forEach((item) => {
        const existingIdx = list.findIndex(
          (m) =>
            m.id === item.id ||
            (m.patrimonyNumber &&
              item.patrimonyNumber &&
              m.patrimonyNumber.trim().toLowerCase() === item.patrimonyNumber.trim().toLowerCase())
        );
        if (existingIdx >= 0) {
          list[existingIdx] = { ...list[existingIdx], ...item, id: list[existingIdx].id };
        } else {
          list.push(item);
        }
      });
    }

    setStoredItem(STORAGE_KEYS.MATERIALS, list);
    this.refreshAllKitStatuses();

    // Upsert into Supabase in batch
    try {
      const rows = newMaterials.map(materialToRow);
      safeSupabaseUpsert('materials', rows);
    } catch {
      // Graceful fallback
    }
  },

  adjustMaterialStock(
    materialId: string,
    delta: number,
    type: 'entrada' | 'baixa' | 'emprestimo' | 'devolucao' | 'manutencao' | 'ajuste',
    reason: string,
    responsible: string
  ): void {
    const list = this.getMaterials();
    const mat = list.find((m) => m.id === materialId);
    if (!mat) return;

    const newAvail = Math.max(0, mat.availableQuantity + delta);
    mat.availableQuantity = newAvail;
    if (type === 'entrada') {
      mat.totalQuantity += delta;
    } else if (type === 'baixa') {
      mat.totalQuantity = Math.max(0, mat.totalQuantity - Math.abs(delta));
    }

    if (!mat.history) mat.history = [];
    mat.history.unshift({
      id: 'mov-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      date: new Date().toISOString(),
      type,
      quantity: Math.abs(delta),
      reason,
      responsible,
    });

    setStoredItem(STORAGE_KEYS.MATERIALS, list);
    this.refreshAllKitStatuses();
    safeSupabaseUpsert('materials', materialToRow(mat));
  },

  // Sport Kits
  getKits(): SportKit[] {
    return getStoredItem<SportKit[]>(STORAGE_KEYS.KITS, INITIAL_KITS);
  },

  saveKit(kit: SportKit): void {
    const list = this.getKits();
    const idx = list.findIndex((k) => k.id === kit.id);
    if (idx >= 0) {
      list[idx] = kit;
    } else {
      list.push(kit);
    }
    setStoredItem(STORAGE_KEYS.KITS, list);
    this.refreshAllKitStatuses();
    safeSupabaseUpsert('kits', kitToRow(kit));
  },

  deleteKit(kitId: string): void {
    const list = this.getKits().filter((k) => k.id !== kitId);
    setStoredItem(STORAGE_KEYS.KITS, list);
    safeSupabaseDelete('kits', kitId);
  },

  // Sport Categories & Modalities Management
  getCategories(): SportCategory[] {
    const stored = getStoredItem<SportCategory[]>(STORAGE_KEYS.CATEGORIES, DEFAULT_SPORT_CATEGORIES);
    const existingIds = new Set(stored.map((c) => c.id.toLowerCase()));
    const allCategories = [...stored];

    // Scan materials for any additional custom categories to ensure none are omitted
    const materials = this.getMaterials();
    materials.forEach((m) => {
      if (m.category && !existingIds.has(m.category.toLowerCase().trim())) {
        const id = m.category.toLowerCase().trim();
        const name = m.category.charAt(0).toUpperCase() + m.category.slice(1);
        existingIds.add(id);
        allCategories.push({ id, name, isCustom: true });
      }
    });

    return allCategories;
  },

  addCategory(name: string): SportCategory {
    const trimmed = name.trim();
    if (!trimmed) {
      return { id: 'recreacao', name: 'Recreação & Jogos' };
    }

    const categories = this.getCategories();
    const normalizedName = trimmed.toLowerCase();
    const existing = categories.find(
      (c) => c.name.toLowerCase() === normalizedName || c.id.toLowerCase() === normalizedName
    );
    if (existing) {
      return existing;
    }

    // Generate clean ID from name
    const cleanId =
      trimmed
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '') || ('cat_' + Date.now());

    const newCat: SportCategory = {
      id: cleanId,
      name: trimmed,
      isCustom: true,
    };

    const list = getStoredItem<SportCategory[]>(STORAGE_KEYS.CATEGORIES, DEFAULT_SPORT_CATEGORIES);
    list.push(newCat);
    setStoredItem(STORAGE_KEYS.CATEGORIES, list);
    return newCat;
  },

  deleteCategory(categoryId: string): void {
    const list = getStoredItem<SportCategory[]>(STORAGE_KEYS.CATEGORIES, DEFAULT_SPORT_CATEGORIES);
    const filtered = list.filter((c) => c.id !== categoryId);
    setStoredItem(STORAGE_KEYS.CATEGORIES, filtered);
  },

  getCategoryLabel(categoryKey: string): string {
    if (!categoryKey) return 'Geral';
    const categories = this.getCategories();
    const found = categories.find(
      (c) => c.id.toLowerCase() === categoryKey.toLowerCase() || c.name.toLowerCase() === categoryKey.toLowerCase()
    );
    if (found) return found.name;
    return categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
  },

  refreshAllKitStatuses(): void {
    const materials = this.getMaterials();
    const kits = getStoredItem<SportKit[]>(STORAGE_KEYS.KITS, INITIAL_KITS);
    let changed = false;

    const updated = kits.map((kit) => {
      let isReady = true;
      for (const item of kit.items) {
        const mat = materials.find((m) => m.id === item.materialId);
        if (!mat || mat.availableQuantity < item.quantity) {
          isReady = false;
          break;
        }
      }
      const newStatus = isReady ? 'pronto' : 'incompleto';
      if (kit.status !== 'emprestado' && kit.status !== newStatus) {
        changed = true;
        return { ...kit, status: newStatus };
      }
      return kit;
    });

    if (changed) {
      setStoredItem(STORAGE_KEYS.KITS, updated);
    }
  },

  // Requesters (Docentes, Alunos, Servidores)
  getRequesters(): Requester[] {
    return getStoredItem<Requester[]>(STORAGE_KEYS.REQUESTERS, INITIAL_REQUESTERS);
  },

  saveRequester(req: Requester): void {
    const list = this.getRequesters();
    const idx = list.findIndex((r) => r.id === req.id);
    if (idx >= 0) {
      list[idx] = req;
    } else {
      list.push(req);
    }
    setStoredItem(STORAGE_KEYS.REQUESTERS, list);
    safeSupabaseUpsert('requesters', requesterToRow(req));
  },

  deleteRequester(requesterId: string): void {
    const list = this.getRequesters().filter((r) => r.id !== requesterId);
    setStoredItem(STORAGE_KEYS.REQUESTERS, list);
    safeSupabaseDelete('requesters', requesterId);
  },

  findRequester(query: string): Requester | undefined {
    const clean = query.trim().toLowerCase();
    const list = this.getRequesters();
    return list.find(
      (r) =>
        r.registration.toLowerCase().includes(clean) ||
        r.name.toLowerCase().includes(clean) ||
        r.email.toLowerCase().includes(clean)
    );
  },

  // Reservations
  getReservations(): Reservation[] {
    return getStoredItem<Reservation[]>(STORAGE_KEYS.RESERVATIONS, INITIAL_RESERVATIONS);
  },

  saveReservation(reservation: Reservation): { success: boolean; conflictError?: string } {
    // Conflict detection: same space, same date, overlapping time window
    const conflict = this.checkReservationConflict(
      reservation.spaceId,
      reservation.date,
      reservation.startTime,
      reservation.endTime,
      reservation.id
    );

    if (conflict) {
      return {
        success: false,
        conflictError: `Conflito de horário com: "${conflict.groupOrClass}" (${conflict.startTime} às ${conflict.endTime}) com ${conflict.teacherName}.`,
      };
    }

    const list = this.getReservations();
    const idx = list.findIndex((r) => r.id === reservation.id);
    if (idx >= 0) {
      list[idx] = reservation;
    } else {
      list.push(reservation);
    }

    // If recurring weekly until end date, create subsequent reservations
    if (reservation.recurrence === 'weekly' && reservation.recurrenceUntil) {
      const cur = new Date(reservation.date + 'T12:00:00');
      const until = new Date(reservation.recurrenceUntil + 'T12:00:00');
      while (true) {
        cur.setDate(cur.getDate() + 7);
        if (cur > until) break;
        const yyyy = cur.getFullYear();
        const mm = String(cur.getMonth() + 1).padStart(2, '0');
        const dd = String(cur.getDate()).padStart(2, '0');
        const recurringDate = `${yyyy}-${mm}-${dd}`;

        const subConflict = this.checkReservationConflict(
          reservation.spaceId,
          recurringDate,
          reservation.startTime,
          reservation.endTime
        );
        if (!subConflict) {
          list.push({
            ...reservation,
            id: 'res-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
            date: recurringDate,
            recurrence: 'none',
          });
        }
      }
    }

    setStoredItem(STORAGE_KEYS.RESERVATIONS, list);
    safeSupabaseUpsert('reservations', reservationToRow(reservation));
    return { success: true };
  },

  deleteReservation(reservationId: string): void {
    const list = this.getReservations().filter((r) => r.id !== reservationId);
    setStoredItem(STORAGE_KEYS.RESERVATIONS, list);
    safeSupabaseDelete('reservations', reservationId);
  },

  checkReservationConflict(
    spaceId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeReservationId?: string
  ): Reservation | undefined {
    const list = this.getReservations().filter(
      (r) =>
        r.spaceId === spaceId &&
        r.date === date &&
        r.status !== 'cancelada' &&
        r.id !== excludeReservationId
    );

    const toMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    const newStart = toMinutes(startTime);
    const newEnd = toMinutes(endTime);

    return list.find((existing) => {
      const existStart = toMinutes(existing.startTime);
      const existEnd = toMinutes(existing.endTime);
      // Overlap condition: startA < endB && endA > startB
      return newStart < existEnd && newEnd > existStart;
    });
  },

  // Loans
  getLoans(): Loan[] {
    return getStoredItem<Loan[]>(STORAGE_KEYS.LOANS, INITIAL_LOANS);
  },

  generateTermNumber(): string {
    const loans = this.getLoans();
    let max = 4891;
    loans.forEach((l) => {
      const num = parseInt(l.termNumber.replace('#', ''), 10);
      if (!isNaN(num) && num > max) max = num;
    });
    return `#${max + 1}`;
  },

  createLoan(loan: Loan): { success: boolean; error?: string } {
    // Check if requester is blocked
    const requesters = this.getRequesters();
    const req = requesters.find((r) => r.id === loan.requesterId);
    if (req && req.isBlocked) {
      return {
        success: false,
        error: `Solicitante bloqueado para novos empréstimos: ${req.blockReason || 'Possui pendências na COEF'}.`,
      };
    }

    // Decrement available quantities in materials
    const materials = this.getMaterials();
    for (const item of loan.items) {
      const mat = materials.find((m) => m.id === item.materialId);
      if (mat) {
        if (mat.availableQuantity < item.quantity) {
          return {
            success: false,
            error: `Estoque insuficiente para o material: "${mat.name}". Disponível: ${mat.availableQuantity}, Solicitado: ${item.quantity}.`,
          };
        }
      }
    }

    // Deduct stock and add movement history
    for (const item of loan.items) {
      this.adjustMaterialStock(
        item.materialId,
        -item.quantity,
        'emprestimo',
        `Empréstimo Termo ${loan.termNumber} para ${loan.requesterName}`,
        loan.attendantName
      );
    }

    const loans = this.getLoans();
    loans.unshift(loan);
    setStoredItem(STORAGE_KEYS.LOANS, loans);
    this.refreshAllKitStatuses();
    safeSupabaseUpsert('loans', loanToRow(loan));
    return { success: true };
  },

  returnLoan(
    loanId: string,
    inspectedItems: {
      materialId: string;
      returnStatus: ReturnItemState;
      inspectionNote?: string;
    }[],
    generalNotes?: string
  ): void {
    const loans = this.getLoans();
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;

    const materials = this.getMaterials();
    let hasPending = false;

    loan.items.forEach((item) => {
      const inspected = inspectedItems.find((i) => i.materialId === item.materialId);
      if (inspected) {
        item.returnStatus = inspected.returnStatus;
        item.inspectionNote = inspected.inspectionNote;

        const mat = materials.find((m) => m.id === item.materialId);
        if (mat) {
          if (inspected.returnStatus === 'devolvido_ok') {
            // Restore available quantity
            this.adjustMaterialStock(
              item.materialId,
              item.quantity,
              'devolucao',
              `Devolução OK do Termo ${loan.termNumber}`,
              loan.attendantName
            );
          } else if (inspected.returnStatus === 'danificado') {
            // Change conservation state and log
            mat.conservationState = 'danificado';
            this.adjustMaterialStock(
              item.materialId,
              0, // remains out of service
              'manutencao',
              `Item danificado na devolução do Termo ${loan.termNumber}: ${inspected.inspectionNote || 'Dano físico constatado'}`,
              loan.attendantName
            );
          } else if (inspected.returnStatus === 'extraviado') {
            // Write off from total stock
            this.adjustMaterialStock(
              item.materialId,
              -item.quantity,
              'baixa',
              `Extravio do item no Termo ${loan.termNumber}`,
              loan.attendantName
            );
          }
        }
      }
      if (item.returnStatus === 'pendente') {
        hasPending = true;
      }
    });

    if (!hasPending) {
      loan.status = 'devolvido';
      loan.actualReturnDate = new Date().toISOString();
    }
    if (generalNotes) {
      loan.notes = (loan.notes ? loan.notes + ' | ' : '') + generalNotes;
    }

    setStoredItem(STORAGE_KEYS.LOANS, loans);
    safeSupabaseUpsert('loans', loanToRow(loan));

    // If requester had delay block, check if they still have overdue loans
    this.recheckRequesterBlockStatus(loan.requesterId);
  },

  recheckRequesterBlockStatus(requesterId: string) {
    const loans = this.getLoans();
    const overdue = loans.some((l) => l.requesterId === requesterId && l.status === 'atrasado');
    const requesters = this.getRequesters();
    const req = requesters.find((r) => r.id === requesterId);
    if (req) {
      if (!overdue && req.blockReason?.includes('atraso')) {
        req.isBlocked = false;
        req.blockReason = undefined;
        setStoredItem(STORAGE_KEYS.REQUESTERS, requesters);
      }
    }
  },

  // Notices
  getNotices(): NoticeBoardItem[] {
    return getStoredItem<NoticeBoardItem[]>(STORAGE_KEYS.NOTICES, INITIAL_NOTICES);
  },

  saveNotice(notice: NoticeBoardItem): void {
    const list = this.getNotices();
    const idx = list.findIndex((n) => n.id === notice.id);
    if (idx >= 0) {
      list[idx] = notice;
    } else {
      list.unshift(notice);
    }
    setStoredItem(STORAGE_KEYS.NOTICES, list);
    safeSupabaseUpsert('notices', noticeToRow(notice));
  },

  deleteNotice(noticeId: string): void {
    const list = this.getNotices().filter((n) => n.id !== noticeId);
    setStoredItem(STORAGE_KEYS.NOTICES, list);
    safeSupabaseDelete('notices', noticeId);
  },

  togglePinNotice(noticeId: string): void {
    const list = this.getNotices();
    const notice = list.find((n) => n.id === noticeId);
    if (notice) {
      notice.isPinned = !notice.isPinned;
      setStoredItem(STORAGE_KEYS.NOTICES, list);
      safeSupabaseUpsert('notices', noticeToRow(notice));
    }
  },

  // Regulation
  getRegulation(): CoefRegulation {
    return getStoredItem<CoefRegulation>(STORAGE_KEYS.REGULATION, INITIAL_REGULATION);
  },

  saveRegulation(reg: CoefRegulation): void {
    setStoredItem(STORAGE_KEYS.REGULATION, reg);
    safeSupabaseUpsert('regulation', { id: 'current', rules: reg.rules, contact: reg.contact });
  },

  // Theme
  getTheme(): 'dark' | 'light' {
    return getStoredItem<'dark' | 'light'>(STORAGE_KEYS.THEME, 'dark');
  },

  setTheme(theme: 'dark' | 'light'): void {
    setStoredItem(STORAGE_KEYS.THEME, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    notifyListeners();
  },

  // Supabase Cloud Sync Methods
  async testSupabaseStatus() {
    return testSupabaseConnection();
  },

  async syncFromSupabase(): Promise<{ success: boolean; message: string; count: number }> {
    try {
      let count = 0;

      // 1. Spaces
      const { data: spacesData, error: spacesErr } = await supabase.from('spaces').select('*');
      if (!spacesErr && spacesData && spacesData.length > 0) {
        const spaces = spacesData.map(rowToSpace);
        setStoredItem(STORAGE_KEYS.SPACES, spaces);
        count += spaces.length;
      }

      // 2. Materials
      const { data: matData, error: matErr } = await supabase.from('materials').select('*');
      if (!matErr && matData && matData.length > 0) {
        const materials = matData.map(rowToMaterial);
        setStoredItem(STORAGE_KEYS.MATERIALS, materials);
        count += materials.length;
      }

      // 3. Kits
      const { data: kitData, error: kitErr } = await supabase.from('kits').select('*');
      if (!kitErr && kitData && kitData.length > 0) {
        const kits = kitData.map(rowToKit);
        setStoredItem(STORAGE_KEYS.KITS, kits);
        count += kits.length;
      }

      // 4. Requesters
      const { data: reqData, error: reqErr } = await supabase.from('requesters').select('*');
      if (!reqErr && reqData && reqData.length > 0) {
        const requesters = reqData.map(rowToRequester);
        setStoredItem(STORAGE_KEYS.REQUESTERS, requesters);
        count += requesters.length;
      }

      // 5. Loans
      const { data: loanData, error: loanErr } = await supabase.from('loans').select('*');
      if (!loanErr && loanData && loanData.length > 0) {
        const loans = loanData.map(rowToLoan);
        setStoredItem(STORAGE_KEYS.LOANS, loans);
        count += loans.length;
      }

      // 6. Reservations
      const { data: resData, error: resErr } = await supabase.from('reservations').select('*');
      if (!resErr && resData && resData.length > 0) {
        const reservations = resData.map(rowToReservation);
        setStoredItem(STORAGE_KEYS.RESERVATIONS, reservations);
        count += reservations.length;
      }

      // 7. Notices
      const { data: notData, error: notErr } = await supabase.from('notices').select('*');
      if (!notErr && notData && notData.length > 0) {
        const notices = notData.map(rowToNotice);
        setStoredItem(STORAGE_KEYS.NOTICES, notices);
        count += notices.length;
      }

      // 8. Users (Selecting only safe non-sensitive columns; password is never retrieved via anon SELECT)
      const { data: userData, error: userErr } = await supabase
        .from('app_users')
        .select('id, name, role, registration, email, role_label, created_at');
      if (!userErr && userData && userData.length > 0) {
        const currentUsers = this.getUsers();
        const users = userData.map((r) => {
          const u = rowToUser(r);
          const local = currentUsers.find((cu) => cu.id === u.id);
          if (local && local.password) {
            u.password = local.password;
          }
          return u;
        });
        setStoredItem(STORAGE_KEYS.USERS, users);
        count += users.length;
      }

      this.refreshAllKitStatuses();
      notifyListeners();

      return {
        success: true,
        message:
          count > 0
            ? `Sincronizados ${count} registros da nuvem Supabase com sucesso!`
            : 'Conexão ativa! A base do Supabase está limpa e pronta para uso.',
        count,
      };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Erro ao sincronizar dados do Supabase.', count: 0 };
    }
  },

  async syncToSupabase(): Promise<{ success: boolean; message: string; count: number }> {
    try {
      let count = 0;
      const spaces = this.getSpaces();
      if (spaces.length > 0) {
        const { error } = await supabase.from('spaces').upsert(spaces.map(spaceToRow));
        if (!error) count += spaces.length;
      }

      const materials = this.getMaterials();
      if (materials.length > 0) {
        const { error } = await supabase.from('materials').upsert(materials.map(materialToRow));
        if (!error) count += materials.length;
      }

      const kits = this.getKits();
      if (kits.length > 0) {
        const { error } = await supabase.from('kits').upsert(kits.map(kitToRow));
        if (!error) count += kits.length;
      }

      const requesters = this.getRequesters();
      if (requesters.length > 0) {
        const { error } = await supabase.from('requesters').upsert(requesters.map(requesterToRow));
        if (!error) count += requesters.length;
      }

      const loans = this.getLoans();
      if (loans.length > 0) {
        const { error } = await supabase.from('loans').upsert(loans.map(loanToRow));
        if (!error) count += loans.length;
      }

      const reservations = this.getReservations();
      if (reservations.length > 0) {
        const { error } = await supabase.from('reservations').upsert(reservations.map(reservationToRow));
        if (!error) count += reservations.length;
      }

      const notices = this.getNotices();
      if (notices.length > 0) {
        const { error } = await supabase.from('notices').upsert(notices.map(noticeToRow));
        if (!error) count += notices.length;
      }

      const users = this.getUsers();
      if (users.length > 0) {
        const { error } = await supabase.from('app_users').upsert(users.map(userToRow));
        if (!error) count += users.length;
      }

      return {
        success: true,
        message: `${count} registros exportados para o Supabase com sucesso!`,
        count,
      };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Erro ao exportar dados para o Supabase.', count: 0 };
    }
  },
};
