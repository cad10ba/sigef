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
  DEFAULT_TIME_SLOTS,
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
  rowToUser,
  testSupabaseConnection,
} from './supabase';

// A autenticação é decidida exclusivamente pelo banco (RPC sigef_login).
// Nenhuma senha é comparada, gravada ou guardada no navegador.
const AUTH_GENERIC_FAILURE =
  'Não foi possível entrar. Verifique o identificador e a senha informados.';
const AUTH_UNAVAILABLE =
  'Não foi possível validar suas credenciais agora. Verifique a conexão e tente novamente.';

// Token opaco emitido por sigef_login_session. Depois do endurecimento do RLS,
// é ele que autoriza leitura/escrita das tabelas fechadas ao cliente anônimo.
function getSessionToken(): string | null {
  try {
    return (
      localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN) ??
      sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN)
    );
  } catch {
    return null;
  }
}

// O token vive no localStorage: fechar a aba não pode deixar o app "logado"
// mas sem autorização de escrita (era isso que fazia exclusões ficarem só
// locais e reaparecerem na próxima sincronização).
function setSessionToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
  } catch {
    // storage indisponível: a sessão vale só para a chamada atual
  }
}

// Login pelo Supabase Auth: resolve matrícula/SIAPE para o e-mail cadastrado,
// autentica em auth.users e converte o JWT em token de sessão do app.
async function signInWithSupabaseAuth(
  identifier: string,
  password: string
): Promise<{ success: boolean; message?: string; user?: any; session_token?: string } | null> {
  try {
    const clean = identifier.trim();
    let email = clean.includes('@') ? clean.toLowerCase() : '';

    if (!email) {
      // Matrícula/SIAPE: o servidor devolve só o e-mail, nunca o nome.
      const { data: resolved } = await supabase.rpc('sigef_resolve_identifier', {
        p_identifier: clean,
      });
      if (resolved?.success && resolved.email) {
        email = String(resolved.email).toLowerCase();
      }
    }
    if (!email) return null;

    const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !signIn?.session) {
      if (error) console.warn('Supabase Auth recusou o login:', error.message);
      return null;
    }

    const { data: session, error: sessionErr } = await supabase.rpc('sigef_session_from_auth');
    if (sessionErr || !session?.success) {
      console.warn(
        'Falha ao abrir a sessão do app:',
        sessionErr?.message || session?.message || 'erro desconhecido'
      );
      await supabase.auth.signOut();
      return null;
    }

    return session;
  } catch (err) {
    console.warn('Erro no login pelo Supabase Auth:', err);
    return null;
  }
}

// Escritas passam pela RPC sigef_upsert_rows (SECURITY DEFINER + token de
// sessão). Sem sessão não há escrita autorizada; nesse caso mantemos a chamada
// direta para instalações que ainda usem políticas permissivas.
async function safeSupabaseUpsert(table: string, data: any) {
  try {
    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) return;

    const token = getSessionToken();
    if (token) {
      // Uma falha passageira (rede/token renovando) não pode perder o registro
      // criado no aplicativo: tenta uma vez mais antes de desistir.
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data: res, error } = await supabase.rpc('sigef_upsert_rows', {
          p_token: token,
          p_table: table,
          p_rows: rows,
        });
        if (!error && res?.success !== false) return;
        if (attempt === 0) {
          console.warn(
            `Supabase upsert into ${table} retry:`,
            error?.message || res?.message || 'falha na sincronização'
          );
          await new Promise((resolve) => setTimeout(resolve, 800));
        } else {
          console.warn(
            `Supabase upsert into ${table} note:`,
            error?.message || res?.message || 'falha na sincronização'
          );
        }
      }
      return;
    }

    // Sem sessão do app não há escrita na nuvem: a gravação direta com a
    // chave pública foi removida (a RLS só aceita a equipe autenticada).
    console.warn(`Supabase upsert into ${table} ignorado: sem sessão ativa.`);
  } catch {
    // Graceful offline/missing tables fallback
  }
}

async function safeSupabaseDelete(table: string, id: string) {
  await safeSupabaseDeleteMultiple(table, [id]);
}

async function safeSupabaseDeleteMultiple(table: string, ids: string[]) {
  try {
    if (!ids || ids.length === 0) return;

    const token = getSessionToken();
    if (token) {
      const { data: res, error } = await supabase.rpc('sigef_delete_rows', {
        p_token: token,
        p_table: table,
        p_ids: ids,
      });
      if (error || res?.success === false) {
        console.warn(
          `Supabase delete from ${table} note:`,
          error?.message || res?.message || 'falha na sincronização'
        );
        enqueueDeletions(table, ids);
      }
      return;
    }

    // Sem sessão a nuvem recusa a exclusão: guarda para reenviar depois.
    enqueueDeletions(table, ids);
  } catch {
    // Falha de rede: a exclusão fica pendente e é reenviada na próxima sessão.
    enqueueDeletions(table, ids);
  }
}

// ----------------------------------------------------------------
// Exclusões pendentes
// ----------------------------------------------------------------
// Uma exclusão feita sem sessão válida (aba nova, rede fora) não pode virar
// "exclusão só local": o registro voltaria na próxima leitura. As ids ficam
// numa fila e são reenviadas assim que houver sessão.
const PENDING_DELETES_KEY = 'sigef_pending_deletes_v1';

type PendingDelete = { table: string; id: string };

function readPendingDeletes(): PendingDelete[] {
  try {
    const raw = localStorage.getItem(PENDING_DELETES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writePendingDeletes(list: PendingDelete[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(PENDING_DELETES_KEY);
    else localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(list));
  } catch {
    // sem storage: nada a recuperar depois
  }
}

function enqueueDeletions(table: string, ids: string[]): void {
  const pending = readPendingDeletes();
  ids.forEach((id) => {
    if (!pending.some((p) => p.table === table && p.id === id)) {
      pending.push({ table, id });
    }
  });
  writePendingDeletes(pending);
}

async function flushPendingDeletions(): Promise<void> {
  const token = getSessionToken();
  if (!token) return;

  const pending = readPendingDeletes();
  if (pending.length === 0) return;

  const byTable = new Map<string, string[]>();
  pending.forEach((p) => {
    byTable.set(p.table, [...(byTable.get(p.table) || []), p.id]);
  });

  const remaining: PendingDelete[] = [];
  for (const [table, ids] of byTable) {
    try {
      const { data, error } = await supabase.rpc('sigef_delete_rows', {
        p_token: token,
        p_table: table,
        p_ids: ids,
      });
      if (error || data?.success === false) {
        console.warn(
          `Exclusões pendentes de ${table} não enviadas:`,
          error?.message || data?.message || 'falha na sincronização'
        );
        ids.forEach((id) => remaining.push({ table, id }));
      }
    } catch {
      ids.forEach((id) => remaining.push({ table, id }));
    }
  }
  writePendingDeletes(remaining);
}

// ----------------------------------------------------------------
// Leitura não pode sobrescrever escrita local
// ----------------------------------------------------------------
// Toda sincronização lê a nuvem e substitui a lista local. Se uma reserva for
// criada enquanto essa leitura está em andamento, o resultado (anterior à
// gravação) apagava da tela um registro que já existia no Supabase — ele só
// reaparecia na sincronização seguinte. Cada escrita local avança um contador
// por tabela; a leitura só aplica o resultado quando nada mudou no meio.
const tableWriteSeq = new Map<string, number>();

function markLocalWrite(table: string): void {
  tableWriteSeq.set(table, (tableWriteSeq.get(table) || 0) + 1);
}

function writeSeqOf(table: string): number {
  return tableWriteSeq.get(table) || 0;
}

async function safeSupabaseDeleteAll(table: string) {
  try {
    const token = getSessionToken();
    if (token) {
      const { data: res, error } = await supabase.rpc('sigef_delete_rows', {
        p_token: token,
        p_table: table,
        p_ids: null,
      });
      if (error || res?.success === false) {
        console.warn(
          `Supabase delete all from ${table} note:`,
          error?.message || res?.message || 'falha na sincronização'
        );
      }
      return;
    }

    // Sem sessão do app, "apagar tudo" nunca vai para a nuvem.
    console.warn(`Supabase delete all from ${table} ignorado: sem sessão ativa.`);
  } catch {
    // Graceful offline/missing tables fallback
  }
}

const STORAGE_KEYS = {
  CURRENT_USER: 'sigef_current_user_v2_blank',
  AUTH_USER: 'sigef_auth_user_v2_blank',
  SESSION_TOKEN: 'sigef_session_token_v1',
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
  TIME_SLOTS: 'sigef_time_slots_v1',
  THEME: 'sigef_theme_v2_blank',
};

// --------------------------------------------------------------------
// Classificação das chaves (LGPD)
// --------------------------------------------------------------------
// NUNCA no navegador: dado pessoal (nome, e-mail, telefone, matrícula) ou
// histórico de responsabilidade. Vivem só em memória enquanto a aba existe e
// são hidratados do Supabase sob demanda, já sob RLS.
const MEMORY_ONLY_KEYS = new Set<string>([
  STORAGE_KEYS.USERS,
  STORAGE_KEYS.REQUESTERS,
  STORAGE_KEYS.LOANS,
  STORAGE_KEYS.RESERVATIONS,
]);

// Sessão (quem está logado) em sessionStorage: some ao fechar a aba e é
// apagada no logout. No localStorage a cópia sobreviveria por meses.
const SESSION_KEYS = new Set<string>([
  STORAGE_KEYS.AUTH_USER,
  STORAGE_KEYS.CURRENT_USER,
  STORAGE_KEYS.SESSION_TOKEN,
]);

// Cache permitido no localStorage: só dado operacional não sensível.
const PERSISTED_KEYS = new Set<string>([
  STORAGE_KEYS.SESSION_TOKEN,
  'sigef_pending_deletes_v1',
  STORAGE_KEYS.SPACES,
  STORAGE_KEYS.MATERIALS,
  STORAGE_KEYS.KITS,
  STORAGE_KEYS.NOTICES,
  STORAGE_KEYS.REGULATION,
  STORAGE_KEYS.CATEGORIES,
  STORAGE_KEYS.TIME_SLOTS,
  STORAGE_KEYS.THEME,
]);

const memoryStore = new Map<string, string>();

// Expurgo seletivo (boot): preserva o cache não sensível e a sessão da aba,
// e remove qualquer cópia antiga de dado pessoal gravada por versões anteriores.
function purgeNonPersistedKeys(): void {
  memoryStore.clear();
  [localStorage, sessionStorage].forEach((storage) => {
    Object.keys(storage)
      .filter((key) => key.startsWith('sigef_'))
      .forEach((key) => {
        const allowed =
          storage === localStorage ? PERSISTED_KEYS.has(key) : SESSION_KEYS.has(key);
        if (!allowed) storage.removeItem(key);
      });
  });
}

// Expurgo total (logout): nenhuma chave sigef_* sobrevive em nenhum storage,
// exceto a configuração da grade de horários (dado operacional, não pessoal).
function purgeAllSigefKeys(): void {
  memoryStore.clear();
  [localStorage, sessionStorage].forEach((storage) => {
    Object.keys(storage)
      .filter((key) => key.startsWith('sigef_') && key !== STORAGE_KEYS.TIME_SLOTS)
      .forEach((key) => storage.removeItem(key));
  });
}

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
    // Dado pessoal: só existe em memória, pelo tempo de vida da aba.
    if (MEMORY_ONLY_KEYS.has(key)) {
      const raw = memoryStore.get(key);
      return raw ? (JSON.parse(raw) as T) : defaultValue;
    }
    const storage = SESSION_KEYS.has(key) ? sessionStorage : localStorage;
    const raw = storage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`Failed to read ${key} from storage:`, e);
    return defaultValue;
  }
}

function setStoredItem<T>(key: string, value: T): void {
  try {
    const serialized = JSON.stringify(value);
    if (MEMORY_ONLY_KEYS.has(key)) {
      memoryStore.set(key, serialized);
      // Garante que nenhuma cópia antiga continue no disco.
      localStorage.removeItem(key);
    } else if (SESSION_KEYS.has(key)) {
      sessionStorage.setItem(key, serialized);
    } else {
      localStorage.setItem(key, serialized);
    }
    notifyListeners();
  } catch (e) {
    console.error(`Failed to save ${key} to storage:`, e);
  }
}

export const sigefStorage = {
  init() {
    // Remove do navegador qualquer cópia antiga de dado pessoal (inclusive as
    // chaves v1 de demonstração) antes de montar o cache não sensível.
    purgeNonPersistedKeys();

    if (!localStorage.getItem(STORAGE_KEYS.SPACES)) {
      setStoredItem(STORAGE_KEYS.SPACES, INITIAL_SPACES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.MATERIALS)) {
      setStoredItem(STORAGE_KEYS.MATERIALS, INITIAL_MATERIALS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.KITS)) {
      setStoredItem(STORAGE_KEYS.KITS, INITIAL_KITS);
    }
    // requesters/loans/reservations não são semeados nem persistidos: chegam
    // do Supabase sob demanda e ficam apenas em memória.
    if (!localStorage.getItem(STORAGE_KEYS.NOTICES)) {
      setStoredItem(STORAGE_KEYS.NOTICES, INITIAL_NOTICES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.REGULATION)) {
      setStoredItem(STORAGE_KEYS.REGULATION, INITIAL_REGULATION);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
      setStoredItem(STORAGE_KEYS.CATEGORIES, DEFAULT_SPORT_CATEGORIES);
    }
    // app_users nunca é cacheado: começa vazio em memória e é carregado do
    // Supabase (somente as colunas de perfil, sob RLS) durante a sessão.
    setStoredItem(STORAGE_KEYS.USERS, []);
    const authUser = this.getAuthUser();
    if (authUser && authUser.id === 'user-admin') {
      this.setAuthUser(null);
      sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
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
    setStoredItem(STORAGE_KEYS.TIME_SLOTS, DEFAULT_TIME_SLOTS);
    setStoredItem(STORAGE_KEYS.USERS, []);
    sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    sessionStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    this.refreshAllKitStatuses();
  },

  // Users & Auth profile
  getUsers(): UserProfile[] {
    return getStoredItem<UserProfile[]>(STORAGE_KEYS.USERS, []);
  },

  getAuthUser(): UserProfile | null {
    const raw = sessionStorage.getItem(STORAGE_KEYS.AUTH_USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserProfile;
    } catch {
      return null;
    }
  },

  setAuthUser(user: UserProfile | null) {
    if (!user) {
      sessionStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    } else {
      sessionStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
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
    // Sem usuário: perfil visitante com o menor privilégio. Nunca assumir
    // admin no navegador; a tela de login aparece porque authUser é nulo.
    return {
      id: 'visitante',
      name: 'Visitante',
      role: 'estagiario',
      registration: '',
      email: '',
      roleLabel: 'Sem sessão',
    };
  },

  setCurrentUser(user: UserProfile) {
    setStoredItem(STORAGE_KEYS.CURRENT_USER, user);
    this.setAuthUser(user);
  },

  // Como a lista de usuários não é mais cacheada, o app pergunta ao servidor
  // apenas "existe alguma conta?" — sem ler nenhum perfil. Se a RLS negar a
  // leitura, o projeto já está configurado e protegido: cai no login.
  async systemHasAccounts(): Promise<boolean> {
    try {
      const { data, error } = await supabase.from('app_users').select('id').limit(1);
      if (error) return true;
      return (data?.length ?? 0) > 0;
    } catch {
      return true;
    }
  },

  // Lista as demais contas do sistema (admins, docentes, monitores e
  // estagiários). A decisão é do servidor: exige sessão válida de um admin.
  async listSystemUsers(): Promise<{
    success: boolean;
    message?: string;
    users?: UserProfile[];
  }> {
    const token = getSessionToken();
    if (!token) {
      return { success: false, message: 'Sessão expirada. Entre novamente para ver os usuários.' };
    }

    try {
      const { data, error } = await supabase.rpc('sigef_list_users', { p_token: token });
      if (error) {
        console.error('Falha ao chamar sigef_list_users:', error.message);
        return { success: false, message: 'Não foi possível carregar os usuários agora.' };
      }
      if (!data?.success) {
        return { success: false, message: data?.message || 'Não foi possível carregar os usuários.' };
      }

      const users: UserProfile[] = (data.users || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        registration: u.registration,
        email: u.email,
        roleLabel: u.roleLabel || u.role_label,
        createdAt: u.createdAt || u.created_at,
      }));

      return { success: true, users };
    } catch (err) {
      console.error('Erro inesperado ao listar usuários:', err);
      return { success: false, message: 'Não foi possível carregar os usuários agora.' };
    }
  },

  // Lista de solicitantes (docentes, estagiários, monitores e alunos). A RLS
  // mantém public.requesters fechada para anon; o servidor devolve a lista
  // somente quando o token da sessão é válido.
  async listRequesters(): Promise<{
    success: boolean;
    message?: string;
    requesters?: Requester[];
  }> {
    const token = getSessionToken();
    if (!token) {
      return { success: false, message: 'Sessão expirada. Entre novamente para ver os usuários.' };
    }

    const requestersSeq = writeSeqOf('requesters');

    try {
      const { data, error } = await supabase.rpc('sigef_list_requesters', { p_token: token });
      if (error) {
        console.error('Falha ao chamar sigef_list_requesters:', error.message);
        return { success: false, message: 'Não foi possível carregar os usuários agora.' };
      }
      if (!data?.success) {
        return { success: false, message: data?.message || 'Não foi possível carregar os usuários.' };
      }

      const requesters: Requester[] = (data.requesters || []).map(rowToRequester);
      if (writeSeqOf('requesters') !== requestersSeq) {
        // Houve cadastro/alteração local durante a leitura: a lista local é
        // mais nova que a resposta e permanece intacta.
        return { success: true, requesters: this.getRequesters() };
      }
      setStoredItem(STORAGE_KEYS.REQUESTERS, requesters);
      return { success: true, requesters };
    } catch (err) {
      console.error('Erro inesperado ao listar solicitantes:', err);
      return { success: false, message: 'Não foi possível carregar os usuários agora.' };
    }
  },

  async loginAsync(
    identifier: string,
    password: string
  ): Promise<{ success: boolean; message: string; user?: UserProfile }> {
    const cleanId = identifier.trim();

    if (!cleanId || !password) {
      return {
        success: false,
        message: 'Preencha seu identificador (e-mail ou matrícula/SIAPE) e sua senha.',
      };
    }

    // A senha é verificada pelo Supabase Auth (auth.users). Se o Auth estiver
    // indisponível, a RPC sigef_login_session ainda confere o mesmo hash bcrypt
    // guardado em app_users — nenhuma senha chega ao navegador em nenhum caso.
    try {
      let data = await signInWithSupabaseAuth(cleanId, password);

      if (!data) {
        const legacy = await supabase.rpc('sigef_login_session', {
          p_identifier: cleanId,
          p_password: password,
        });
        if (legacy.error) {
          console.error('Falha ao chamar sigef_login_session:', legacy.error.message);
        } else if (legacy.data?.success && legacy.data.user) {
          data = legacy.data;
        }
      }

      if (!data?.success || !data.user) {
        // Mensagem fixa: o servidor também não distingue "usuário não
        // encontrado" de "senha incorreta", então não há o que explorar aqui.
        return { success: false, message: AUTH_GENERIC_FAILURE };
      }

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

      // Cache do perfil (nunca da senha) para a interface.
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
      // Token opaco da sessão: autoriza a listagem de contas no servidor.
      if (data.session_token) {
        setSessionToken(data.session_token);
      }
      // Dados pessoais (solicitantes, empréstimos, reservas, usuários) são
      // buscados sob demanda: sem sessão válida a RLS devolve vazio/erro e
      // nada fica guardado no navegador.
      this.syncFromSupabase().catch(() => {});
      return {
        success: true,
        message: data.message || 'Login realizado com sucesso!',
        user: cloudUser,
      };
    } catch (err) {
      console.error('Erro inesperado no login:', err);
      return { success: false, message: AUTH_UNAVAILABLE };
    }
  },

  async registerUser(data: {
    name: string;
    email: string;
    registration: string;
    role: UserRole;
    password: string;
    department?: string;
    phone?: string;
  }): Promise<{ success: boolean; message: string; user?: UserProfile }> {
    const cleanName = data.name.trim();
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanReg = data.registration.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !cleanReg || !data.password) {
      return { success: false, message: 'Todos os campos obrigatórios devem ser preenchidos.' };
    }

    if (data.password.trim().length < 4) {
      return { success: false, message: 'A senha deve conter no mínimo 4 caracteres.' };
    }

    // Cadastro feito por um administrador (outra pessoa) não pode trocar a
    // sessão de quem está usando o sistema pela do novo usuário: sem isso a
    // exclusão passava a ser recusada com "somente administradores".
    const isSelfSignup = !getSessionToken();

    let roleLabel = 'Docente de Educação Física';
    if (data.role === 'admin') roleLabel = 'Coordenação de Educação Física (Administrador)';
    else if (data.role === 'monitor') roleLabel = 'Monitor / Bolsista de Ed. Física';
    else if (data.role === 'estagiario') roleLabel = 'Estagiário de Ed. Física';

    const draft: UserProfile = {
      id: 'user-' + Date.now(),
      name: cleanName,
      email: data.email.trim(),
      registration: data.registration.trim(),
      role: data.role,
      roleLabel,
      createdAt: new Date().toISOString(),
    };

    // A conta é criada pela RPC: a senha viaja uma única vez e o banco grava
    // apenas o hash (bcrypt). O navegador nunca guarda a senha.
    let newUser: UserProfile;
    try {
      const { data: res, error } = await supabase.rpc('sigef_register_user', {
        p_id: draft.id,
        p_name: draft.name,
        p_role: draft.role,
        p_registration: draft.registration,
        p_email: draft.email,
        p_role_label: draft.roleLabel,
        p_password: data.password,
      });

      if (error) {
        console.error('Falha ao chamar sigef_register_user:', error.message);
        return {
          success: false,
          message: 'Não foi possível concluir o cadastro agora. Verifique a conexão e tente novamente.',
        };
      }

      if (!res?.success || !res.user) {
        return { success: false, message: res?.message || 'Não foi possível concluir o cadastro.' };
      }

      newUser = {
        ...draft,
        ...res.user,
        roleLabel: res.user.roleLabel || draft.roleLabel,
        createdAt: res.user.createdAt || draft.createdAt,
      };

      // Só o cadastro próprio abre sessão: a conta recém-criada passa a
      // sincronizar dados com o Supabase sem afetar quem já está logado.
      if (isSelfSignup) {
        const session = await signInWithSupabaseAuth(cleanEmail, data.password);
        if (session?.session_token) {
          setSessionToken(session.session_token);
        }
      }
    } catch (err) {
      console.error('Erro inesperado no cadastro:', err);
      return {
        success: false,
        message: 'Não foi possível concluir o cadastro agora. Verifique a conexão e tente novamente.',
      };
    }

    const users = this.getUsers();
    users.push(newUser);
    setStoredItem(STORAGE_KEYS.USERS, users);

    // Sync to Requesters collection so user can borrow or reserve right away
    const requesters = this.getRequesters();
    const existingReq = requesters.find(
      (r) => r.registration.toLowerCase() === cleanReg || r.email.toLowerCase() === cleanEmail
    );
    if (!existingReq) {
      const reqType = data.role === 'admin' ? 'servidor' : data.role;
      // Mesmo id que o trigger app_users_requester_sync gera no banco: assim o
      // upsert atualiza a linha criada pelo trigger em vez de duplicá-la.
      const newReq: Requester = {
        id: 'req-' + newUser.id.replace(/^user-/, ''),
        name: newUser.name,
        type: reqType as any,
        registration: newUser.registration,
        courseOrDepartment: data.department?.trim() || 'Coordenação de Educação Física (COEF)',
        email: newUser.email,
        phone: data.phone?.trim() || '(73) 9',
        isBlocked: false,
      };
      requesters.push(newReq);
      setStoredItem(STORAGE_KEYS.REQUESTERS, requesters);
      safeSupabaseUpsert('requesters', requesterToRow(newReq));
    }

    // A troca do usuário logado só faz sentido no cadastro próprio; quando um
    // admin cria a conta de outra pessoa, ele continua no sistema como admin.
    if (isSelfSignup) {
      this.setCurrentUser(newUser);
      this.setAuthUser(newUser);
    }

    return {
      success: true,
      message: isSelfSignup
        ? `Conta criada com sucesso! Bem-vindo(a) ao SIGEF, ${newUser.name}.`
        : `Conta de ${newUser.name} criada com sucesso!`,
      user: newUser,
    };
  },

  logout(): void {
    void supabase.auth.signOut().catch(() => {});
    const token = getSessionToken();
    if (token) {
      // Revoga a sessão no servidor sem atrasar a saída da interface.
      void supabase.rpc('sigef_logout', { p_token: token }).then(
        () => {},
        () => {}
      );
    }
    // Nenhuma chave sigef_* (dado pessoal, cache ou sessão) sobrevive à saída.
    purgeAllSigefKeys();
    notifyListeners();
  },

  async changeSelfPassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const currentUser = this.getCurrentUser();

    if (!currentPassword.trim()) {
      return { success: false, message: 'Informe a senha atual.' };
    }

    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, message: 'A nova senha deve possuir pelo menos 4 caracteres.' };
    }

    // A senha atual é conferida contra o hash dentro do banco; o navegador não
    // tem cópia de senha para comparar.
    try {
      const { data, error } = await supabase.rpc('sigef_change_password', {
        p_user_id: currentUser.id,
        p_current_password: currentPassword,
        p_new_password: newPassword,
      });

      if (error) {
        console.error('Falha ao chamar sigef_change_password:', error.message);
        return { success: false, message: AUTH_UNAVAILABLE };
      }

      if (!data?.success) {
        return { success: false, message: data?.message || 'Não foi possível alterar a senha.' };
      }

      notifyListeners();
      return { success: true, message: data.message || 'Senha atualizada com sucesso!' };
    } catch (err) {
      console.error('Erro inesperado ao trocar a senha:', err);
      return { success: false, message: AUTH_UNAVAILABLE };
    }
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

  // Coluna de horários da planilha de ocupação (editável pelo admin).
  getTimeSlots(): string[] {
    const stored = getStoredItem<string[]>(STORAGE_KEYS.TIME_SLOTS, DEFAULT_TIME_SLOTS);
    return stored.length > 0 ? stored : DEFAULT_TIME_SLOTS;
  },

  saveTimeSlots(slots: string[]): void {
    setStoredItem(STORAGE_KEYS.TIME_SLOTS, slots);
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
    markLocalWrite('requesters');
    safeSupabaseUpsert('requesters', requesterToRow(req));
  },

  // Exclui o cadastro e, quando ele pertence a uma conta do sistema (docente,
  // monitor, admin), apaga também a conta no Supabase. A decisão é do
  // servidor (sigef_delete_person), que exige sessão de administrador.
  async deleteRequester(
    requesterId: string
  ): Promise<{ success: boolean; message?: string }> {
    const token = getSessionToken();

    if (token) {
      try {
        const { data, error } = await supabase.rpc('sigef_delete_person', {
          p_token: token,
          p_requester_id: requesterId,
        });
        if (error) {
          console.warn('Supabase delete person note:', error.message);
        }
        if (data?.success === false) {
          return {
            success: false,
            message: data.message || 'Não foi possível excluir o cadastro.',
          };
        }
      } catch {
        // Sem sincronização agora: a remoção local abaixo continua valendo.
      }
    } else {
      void safeSupabaseDelete('requesters', requesterId);
    }

    const list = this.getRequesters().filter((r) => r.id !== requesterId);
    setStoredItem(STORAGE_KEYS.REQUESTERS, list);
    markLocalWrite('requesters');
    return { success: true };
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

    // Reservas geradas pela recorrência também precisam ir para a nuvem.
    const toPersist: Reservation[] = [reservation];

    // If recurring weekly until end date, create subsequent reservations
    // (only for new reservations; editing must not duplicate the recurrence)
    if (idx < 0 && reservation.recurrence === 'weekly' && reservation.recurrenceUntil) {
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
          const recurring: Reservation = {
            ...reservation,
            id: 'res-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
            date: recurringDate,
            recurrence: 'none',
          };
          list.push(recurring);
          toPersist.push(recurring);
        }
      }
    }

    setStoredItem(STORAGE_KEYS.RESERVATIONS, list);
    // Marca a escrita antes do envio: uma leitura da nuvem que já estava em
    // andamento não pode apagar da tela a reserva recém-criada.
    markLocalWrite('reservations');
    safeSupabaseUpsert('reservations', toPersist.map(reservationToRow));
    return { success: true };
  },

  deleteReservation(reservationId: string): void {
    const list = this.getReservations().filter((r) => r.id !== reservationId);
    setStoredItem(STORAGE_KEYS.RESERVATIONS, list);
    markLocalWrite('reservations');
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
    markLocalWrite('loans');
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
    markLocalWrite('loans');
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
  // Existe sessão válida nesta aba? Usado para saber se as listas de dado
  // pessoal (solicitantes, empréstimos, reservas) podem ser recarregadas.
  hasSession(): boolean {
    return Boolean(getSessionToken());
  },

  async testSupabaseStatus() {
    return testSupabaseConnection();
  },

  async syncFromSupabase(): Promise<{ success: boolean; message: string; count: number }> {
    try {
      let count = 0;
      const token = getSessionToken();

      // Exclusões feitas sem sessão válida são reenviadas primeiro: assim a
      // nuvem não devolve um registro que o usuário já removeu.
      await flushPendingDeletions();

      // O Supabase é a fonte da verdade: cada lista é substituída mesmo quando
      // o banco está vazio, para que uma exclusão feita na nuvem desapareça do
      // aplicativo. Se a leitura falhar, a lista local é preservada.

      // 1. Spaces
      const { data: spacesData, error: spacesErr } = await supabase.from('spaces').select('*');
      if (!spacesErr && spacesData) {
        const spaces = spacesData.map(rowToSpace);
        setStoredItem(STORAGE_KEYS.SPACES, spaces);
        count += spaces.length;
      }

      // 2. Materials
      const { data: matData, error: matErr } = await supabase.from('materials').select('*');
      if (!matErr && matData) {
        const materials = matData.map(rowToMaterial);
        setStoredItem(STORAGE_KEYS.MATERIALS, materials);
        count += materials.length;
      }

      // 3. Kits
      const { data: kitData, error: kitErr } = await supabase.from('kits').select('*');
      if (!kitErr && kitData) {
        const kits = kitData.map(rowToKit);
        setStoredItem(STORAGE_KEYS.KITS, kits);
        count += kits.length;
      }

      // 4. Notices
      const { data: notData, error: notErr } = await supabase.from('notices').select('*');
      if (!notErr && notData) {
        const notices = notData.map(rowToNotice);
        setStoredItem(STORAGE_KEYS.NOTICES, notices);
        count += notices.length;
      }

      // 5. Regulation (registro único): só sobrescreve quando existe na nuvem,
      //    para não apagar o texto padrão de uma base ainda não configurada.
      const { data: regData, error: regErr } = await supabase
        .from('regulation')
        .select('*')
        .limit(1);
      const regulationRow = !regErr && regData ? regData[0] : undefined;
      if (regulationRow) {
        setStoredItem(STORAGE_KEYS.REGULATION, {
          rules: Array.isArray(regulationRow.rules) ? regulationRow.rules : [],
          contact: regulationRow.contact || {},
        } as CoefRegulation);
        count += 1;
      }

      // 6. Requesters — via RPC com token da sessão (a tabela é fechada a anon).
      const reqRes = await this.listRequesters();
      if (reqRes.success && reqRes.requesters) {
        count += reqRes.requesters.length;
      }

      // 7/8. Loans e reservations também são fechadas a anon: a leitura só
      //      acontece pela RPC autenticada (migração 006).
      if (token) {
        const loansSeq = writeSeqOf('loans');
        const { data: loanRes, error: loanErr } = await supabase.rpc('sigef_list_loans', {
          p_token: token,
        });
        if (!loanErr && loanRes?.success && Array.isArray(loanRes.loans)) {
          // Escrita local durante a leitura: a resposta é anterior a ela.
          if (writeSeqOf('loans') === loansSeq) {
            const loans = loanRes.loans.map(rowToLoan);
            setStoredItem(STORAGE_KEYS.LOANS, loans);
            count += loans.length;
          }
        } else if (loanErr) {
          console.warn('Falha ao carregar empréstimos do Supabase:', loanErr.message);
        }

        const reservationsSeq = writeSeqOf('reservations');
        const { data: resRes, error: resErr } = await supabase.rpc('sigef_list_reservations', {
          p_token: token,
        });
        if (!resErr && resRes?.success && Array.isArray(resRes.reservations)) {
          if (writeSeqOf('reservations') === reservationsSeq) {
            const reservations = resRes.reservations.map(rowToReservation);
            setStoredItem(STORAGE_KEYS.RESERVATIONS, reservations);
            count += reservations.length;
          }
        } else if (resErr) {
          console.warn('Falha ao carregar reservas do Supabase:', resErr.message);
        }
      }

      // 9. Perfis de usuário (somente colunas de perfil; o hash nunca é lido
      //    pelo cliente e a lista não é usada para validar login).
      const { data: userData, error: userErr } = await supabase
        .from('app_users')
        .select('id, name, role, registration, email, role_label, created_at');
      if (!userErr && userData) {
        const users = userData.map(rowToUser);
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
      const token = getSessionToken();
      if (!token) {
        return {
          success: false,
          message: 'Entre novamente para exportar os dados com segurança.',
          count: 0,
        };
      }

      let count = 0;
      const failures: string[] = [];

      const pushRows = async (table: string, rows: any[]) => {
        if (rows.length === 0) return;
        const { data, error } = await supabase.rpc('sigef_upsert_rows', {
          p_token: token,
          p_table: table,
          p_rows: rows,
        });
        if (error || data?.success === false) {
          failures.push(table);
          console.warn(
            `Falha ao exportar ${table} para o Supabase:`,
            error?.message || data?.message || 'erro desconhecido'
          );
          return;
        }
        count += rows.length;
      };

      await pushRows('spaces', this.getSpaces().map(spaceToRow));
      await pushRows('materials', this.getMaterials().map(materialToRow));
      await pushRows('kits', this.getKits().map(kitToRow));
      await pushRows('requesters', this.getRequesters().map(requesterToRow));
      await pushRows('loans', this.getLoans().map(loanToRow));
      await pushRows('reservations', this.getReservations().map(reservationToRow));
      await pushRows('notices', this.getNotices().map(noticeToRow));

      // app_users não é exportado: credenciais só são gravadas pelas RPCs
      // sigef_register_user / sigef_change_password, sempre com hash.

      if (failures.length > 0) {
        return {
          success: false,
          message: `Não foi possível exportar: ${failures.join(', ')}.`,
          count,
        };
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
