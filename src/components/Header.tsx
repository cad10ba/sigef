import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  Plus,
  Moon,
  Sun,
  Menu,
  ChevronDown,
  CalendarPlus,
  PackagePlus,
  Boxes,
  ClipboardPenLine,
  UserCheck,
  UserPlus,
  LogOut,
  Database,
  AlertCircle,
  Clock,
  Wrench,
  X,
  ExternalLink,
} from 'lucide-react';
import { UserProfile, ActiveTab } from '../types/sigef';
import { sigefStorage } from '../services/storage';

interface HeaderProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  onOpenNewReservation: () => void;
  onOpenNewLoan: () => void;
  onOpenNewMaterial: () => void;
  onOpenNewKit: () => void;
  onOpenNewUserModal?: () => void;
  onOpenSupabaseModal?: () => void;
  onLogout?: () => void;
  onNavigate: (tab: ActiveTab) => void;
  onToggleSidebar: () => void;
  onOpenTerminalLoan?: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  allUsers,
  onSelectUser,
  onOpenNewReservation,
  onOpenNewLoan,
  onOpenNewMaterial,
  onOpenNewKit,
  onOpenNewUserModal,
  onOpenSupabaseModal,
  onLogout,
  onNavigate,
  onToggleSidebar,
  onOpenTerminalLoan,
  isDark,
  onToggleTheme,
}) => {
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const newMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setIsNewMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Notifications calculation
  const loans = sigefStorage.getLoans();
  const materials = sigefStorage.getMaterials();
  const spaces = sigefStorage.getSpaces();

  const overdueLoans = loans.filter((l) => l.status === 'atrasado');
  const lowStockMaterials = materials.filter((m) => m.availableQuantity <= m.minStockAlert);
  const maintenanceSpaces = spaces.filter((s) => s.status === 'manutencao' || s.status === 'interditado');

  const totalAlerts = overdueLoans.length + lowStockMaterials.length + maintenanceSpaces.length;

  // Global search items
  const allMaterials = sigefStorage.getMaterials();
  const allRequesters = sigefStorage.getRequesters();
  const allSpaces = sigefStorage.getSpaces();

  const searchResults = searchQuery.trim().length > 1 ? {
    materials: allMaterials.filter(
      (m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.patrimonyNumber.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 3),
    requesters: allRequesters.filter(
      (r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.registration.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 3),
    spaces: allSpaces.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.allowedSports.some((sport) => sport.toLowerCase().includes(searchQuery.toLowerCase()))
    ).slice(0, 2),
  } : null;

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0B1418]/95 dark:bg-[#0B1418]/95 backdrop-blur-md border-b border-white/10 dark:border-white/10 text-slate-100">
      {/* Top Institutional Bar */}
      <div className="hidden lg:flex items-center justify-between px-6 py-1 bg-[#102027]/70 border-b border-white/5 text-[11px] text-slate-400">
        <div className="flex items-center gap-2 tracking-wide font-medium">
          <span className="text-emerald-400 font-semibold">CAMPUS</span>
          <span>•</span>
          <span>DIRETORIA DE ENSINO</span>
          <span>•</span>
          <span className="text-slate-200">COORDENAÇÃO DE EDUCAÇÃO FÍSICA (COEF)</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span>Horário do Complexo: 07:00 às 22:00</span>
          <span>•</span>
          <span className="text-emerald-400 font-semibold">Terminal SIGEF Ativo</span>
        </div>
      </div>

      {/* Main Header Row */}
      <div className="flex items-center justify-between gap-3 px-3 sm:px-6 h-16">
        {/* Left: Mobile Menu Toggle & Brand Lockup */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggleSidebar}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
            title="Alternar Menu Lateral"
            aria-label="Alternar Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={() => onNavigate('inicio')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#1B8A4B] to-[#22A55B] text-white font-extrabold shadow-md shadow-emerald-950/40 border border-emerald-400/30">
              <span className="text-xs tracking-tighter font-mono">IF</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                  SIGEF
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  COEF
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-400 leading-none">
                Gestão da Educação Física
              </p>
            </div>
          </button>
        </div>

        {/* Center: Global Search Bar */}
        <div ref={searchRef} className="relative flex-1 max-w-xl mx-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="Buscar bolas, coletes, cones, professores, termos…"
              className="w-full h-10 pl-10 pr-9 text-xs sm:text-sm bg-[#102027] border border-white/10 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Instant Search Results Dropdown */}
          {isSearchFocused && searchResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#102027] border border-white/15 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-xs text-slate-400">
                <span>Resultados da busca rápida</span>
                <span className="text-[11px] font-mono">Pressione ESC para fechar</span>
              </div>

              {searchResults.materials.length > 0 && (
                <div className="mb-3">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-400 block px-2 mb-1">
                    Materiais & Acervo
                  </span>
                  {searchResults.materials.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        onNavigate('materiais');
                        setIsSearchFocused(false);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 text-left text-xs transition-colors"
                    >
                      <div>
                        <span className="font-semibold text-slate-200 block">{m.name}</span>
                        <span className="text-[11px] text-slate-400">
                          {m.patrimonyNumber} • {m.category}
                        </span>
                      </div>
                      <span className="font-mono text-emerald-400 font-semibold">
                        {m.availableQuantity} disp.
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {searchResults.requesters.length > 0 && (
                <div className="mb-3">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-sky-400 block px-2 mb-1">
                    Docentes & Solicitantes
                  </span>
                  {searchResults.requesters.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        onNavigate('docentes');
                        setIsSearchFocused(false);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 text-left text-xs transition-colors"
                    >
                      <div>
                        <span className="font-semibold text-slate-200 block">{r.name}</span>
                        <span className="text-[11px] text-slate-400">
                          {r.registration} • {r.courseOrDepartment}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        r.isBlocked ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {r.isBlocked ? 'Bloqueado' : 'Regular'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {searchResults.spaces.length > 0 && (
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-400 block px-2 mb-1">
                    Espaços Físicos
                  </span>
                  {searchResults.spaces.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        onNavigate('espacos');
                        setIsSearchFocused(false);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 text-left text-xs transition-colors"
                    >
                      <div>
                        <span className="font-semibold text-slate-200 block">{s.name}</span>
                        <span className="text-[11px] text-slate-400">
                          Capacidade: {s.capacity} pessoas
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-300 capitalize">{s.status}</span>
                    </button>
                  ))}
                </div>
              )}

              {searchResults.materials.length === 0 &&
                searchResults.requesters.length === 0 &&
                searchResults.spaces.length === 0 && (
                  <p className="text-center py-4 text-xs text-slate-400">
                    Nenhum item encontrado para "{searchQuery}".
                  </p>
                )}
            </div>
          )}
        </div>

        {/* Right Actions Zone */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* "+ Novo" Button & Dropdown */}
          <div ref={newMenuRef} className="relative">
            <button
              onClick={() => setIsNewMenuOpen(!isNewMenuOpen)}
              className="flex items-center gap-1.5 h-10 px-3.5 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-emerald-950/30 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">Novo</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            </button>

            {isNewMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[#102027] border border-white/15 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    setIsNewMenuOpen(false);
                    onOpenNewReservation();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10 rounded-lg transition-colors text-left font-medium"
                >
                  <CalendarPlus className="w-4 h-4 text-emerald-400" />
                  <span>Nova Reserva de Espaço</span>
                </button>
                <button
                  onClick={() => {
                    setIsNewMenuOpen(false);
                    onOpenNewLoan();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10 rounded-lg transition-colors text-left font-medium"
                >
                  <ClipboardPenLine className="w-4 h-4 text-sky-400" />
                  <span>Novo Empréstimo (Termo)</span>
                </button>
                <div className="my-1 border-t border-white/10" />
                <button
                  onClick={() => {
                    setIsNewMenuOpen(false);
                    onOpenNewMaterial();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10 rounded-lg transition-colors text-left font-medium"
                >
                  <PackagePlus className="w-4 h-4 text-amber-400" />
                  <span>Cadastrar Material (Patrimônio)</span>
                </button>
                <button
                  onClick={() => {
                    setIsNewMenuOpen(false);
                    onOpenNewKit();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10 rounded-lg transition-colors text-left font-medium"
                >
                  <Boxes className="w-4 h-4 text-purple-400" />
                  <span>Montar Novo Kit Esportivo</span>
                </button>
                {onOpenNewUserModal && (
                  <button
                    onClick={() => {
                      setIsNewMenuOpen(false);
                      onOpenNewUserModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-emerald-300 hover:bg-white/10 rounded-lg transition-colors text-left font-medium"
                  >
                    <UserPlus className="w-4 h-4 text-emerald-400" />
                    <span>Cadastrar Usuário do Sistema</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Notifications Bell */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative p-2.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
              title="Avisos e Notificações"
              aria-label="Notificações"
            >
              <Bell className="w-5 h-5" />
              {totalAlerts > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-[#0B1418]">
                  {totalAlerts}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#102027] border border-white/15 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white">Central de Alertas COEF</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold">
                      {totalAlerts} pendência(s)
                    </span>
                  </div>
                  <button
                    onClick={() => setIsNotifOpen(false)}
                    className="text-slate-400 hover:text-white p-1 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-3 space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {overdueLoans.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30">
                      <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold mb-1">
                        <Clock className="w-4 h-4 shrink-0 text-rose-400" />
                        <span>{overdueLoans.length} Empréstimo(s) em Atraso</span>
                      </div>
                      {overdueLoans.map((l) => (
                        <div
                          key={l.id}
                          onClick={() => {
                            onNavigate('emprestimos');
                            setIsNotifOpen(false);
                          }}
                          className="mt-1 text-[11px] text-slate-300 hover:text-white cursor-pointer pl-6 border-l border-rose-500/20"
                        >
                          <span className="font-semibold text-rose-200">{l.termNumber}</span>: {l.requesterName} ({l.items.map((i) => i.materialName).join(', ')})
                        </div>
                      ))}
                    </div>
                  )}

                  {lowStockMaterials.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30">
                      <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold mb-1">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>{lowStockMaterials.length} Alerta(s) de Estoque Mínimo</span>
                      </div>
                      {lowStockMaterials.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => {
                            onNavigate('materiais');
                            setIsNotifOpen(false);
                          }}
                          className="mt-1 text-[11px] text-slate-300 hover:text-white cursor-pointer pl-6 border-l border-amber-500/20 flex justify-between"
                        >
                          <span>{m.name}</span>
                          <span className="font-bold text-amber-300 font-mono">
                            {m.availableQuantity}/{m.minStockAlert}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {maintenanceSpaces.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-slate-800/60 border border-white/10">
                      <div className="flex items-center gap-2 text-sky-300 text-xs font-semibold mb-1">
                        <Wrench className="w-4 h-4 shrink-0 text-sky-400" />
                        <span>Espaços em Manutenção / Bloqueados</span>
                      </div>
                      {maintenanceSpaces.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => {
                            onNavigate('espacos');
                            setIsNotifOpen(false);
                          }}
                          className="mt-1 text-[11px] text-slate-300 hover:text-white cursor-pointer pl-6 border-l border-sky-500/20"
                        >
                          <span className="font-medium text-slate-200">{s.name}</span>
                          {s.maintenanceOs && ` (${s.maintenanceOs})`}
                        </div>
                      ))}
                    </div>
                  )}

                  {totalAlerts === 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      Tudo em ordem na coordenação! Nenhum atraso ou aviso crítico ativo.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Supabase Database Connection Status */}
          {onOpenSupabaseModal && (
            <button
              onClick={onOpenSupabaseModal}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 text-xs font-semibold transition-colors"
              title="Banco de Dados Supabase (hvzvhqgfcozaprywordg)"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supabase</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </button>
          )}

          {/* Theme Toggle (Light / Dark) */}
          <button
            onClick={onToggleTheme}
            className="p-2.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
            title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            aria-label="Alternar tema"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5 text-indigo-400" />}
          </button>

          {/* User Profile Switcher */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/5 transition-colors border border-white/10 bg-[#102027]"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white font-bold flex items-center justify-center text-xs">
                {currentUser.name
                  .split(' ')
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')}
              </div>
              <div className="hidden md:block text-left pr-1">
                <span className="block text-xs font-semibold text-slate-200 leading-tight">
                  {currentUser.name.split(' ')[0]} {currentUser.name.split(' ').slice(-1)[0]}
                </span>
                <span className="block text-[10px] text-emerald-400 uppercase font-semibold">
                  {currentUser.role}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-[#102027] border border-white/15 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="pb-2.5 mb-2.5 border-b border-white/10">
                  <p className="font-semibold text-xs text-white">{currentUser.name}</p>
                  <p className="text-[11px] text-slate-400">{currentUser.registration}</p>
                  <p className="text-[11px] text-emerald-400 font-medium">{currentUser.roleLabel}</p>
                </div>

                <div className="text-[11px] uppercase font-bold text-slate-400 px-2 mb-1.5">
                  Alternar Perfil Simulado:
                </div>

                <div className="space-y-1">
                  {allUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        onSelectUser(user);
                        setIsUserMenuOpen(false);
                      }}
                      className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left text-xs transition-colors ${
                        user.id === currentUser.id
                          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                          : 'hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <UserCheck
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          user.id === currentUser.id ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      />
                      <div>
                        <span className="font-semibold block">{user.name}</span>
                        <span className="text-[10px] opacity-75">{user.roleLabel}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {onOpenNewUserModal && (
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenNewUserModal();
                    }}
                    className="mt-2 w-full py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 border border-emerald-500/20 transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Cadastrar Novo Usuário</span>
                  </button>
                )}

                {onOpenSupabaseModal && (
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenSupabaseModal();
                    }}
                    className="mt-1.5 w-full py-2 px-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 border border-emerald-500/20 transition-colors"
                  >
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Banco Supabase (PostgreSQL)</span>
                  </button>
                )}

                {onLogout && (
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout();
                    }}
                    className="mt-1.5 w-full py-2 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center justify-center gap-2 border border-rose-500/20 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair da Conta (Logout)</span>
                  </button>
                )}

                <div className="mt-3 pt-2.5 border-t border-white/10 flex justify-between items-center text-xs text-slate-400 px-1">
                  <span>SIGEF COEF</span>
                  <button
                    onClick={() => {
                      if (confirm('Deseja limpar todos os cadastros e resetar o sistema em branco?')) {
                        sigefStorage.resetToInitialData();
                        window.location.reload();
                      }
                    }}
                    className="text-slate-400 hover:text-rose-400 underline text-[11px] transition-colors"
                  >
                    Limpar Dados
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
