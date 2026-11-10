import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Dumbbell,
  ClipboardList,
  Boxes,
  Users,
  BarChart3,
  BookOpenText,
  ScanLine,
  X,
  Shield,
} from 'lucide-react';
import { ActiveTab, UserRole } from '../types/sigef';

interface NavigationProps {
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
  isSidebarOpen: boolean;
  onCloseSidebar: () => void;
  onOpenTerminal: () => void;
  userRole: UserRole;
  overdueCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onNavigate,
  isSidebarOpen,
  onCloseSidebar,
  onOpenTerminal,
  userRole,
  overdueCount,
}) => {
  const navItems = [
    { id: 'inicio' as ActiveTab, label: 'Início', icon: LayoutDashboard },
    { id: 'espacos' as ActiveTab, label: 'Espaços & Reservas', icon: CalendarDays },
    {
      id: 'emprestimos' as ActiveTab,
      label: 'Empréstimos',
      icon: ClipboardList,
      badge: overdueCount > 0 ? `${overdueCount}` : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    { id: 'materiais' as ActiveTab, label: 'Acervo & Materiais', icon: Dumbbell },
    { id: 'kits' as ActiveTab, label: 'Kits de Aula', icon: Boxes },
    { id: 'docentes' as ActiveTab, label: 'Docentes & Alunos', icon: Users },
    { id: 'relatorios' as ActiveTab, label: 'Relatórios & Ocupação', icon: BarChart3 },
    { id: 'normas' as ActiveTab, label: 'Normas & Contato', icon: BookOpenText },
  ];

  // Atalhos fixos na barra inferior: os cinco destinos de uso diário no balcão.
  const mobileTabs = [
    { id: 'inicio' as ActiveTab, label: 'Início', icon: LayoutDashboard },
    { id: 'espacos' as ActiveTab, label: 'Espaços', icon: CalendarDays },
    { id: 'emprestimos' as ActiveTab, label: 'Empréstimos', icon: ClipboardList },
    { id: 'materiais' as ActiveTab, label: 'Materiais', icon: Dumbbell },
    { id: 'kits' as ActiveTab, label: 'Kits', icon: Boxes },
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={onCloseSidebar}
          aria-hidden="true"
        />
      )}

      {/* Desktop Sidebar & Mobile Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-[17rem] max-w-[85vw] bg-[#0B1418] border-r border-white/10 flex flex-col pb-[env(safe-area-inset-bottom)] transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:z-10`}
      >
        {/* Drawer Header for Mobile */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#1B8A4B] text-white flex items-center justify-center font-bold text-xs">
              IF
            </div>
            <div>
              <span className="font-bold text-sm text-white">SIGEF COEF</span>
              <p className="text-[10px] text-slate-400">Coordenação de Ed. Física</p>
            </div>
          </div>
          <button
            onClick={onCloseSidebar}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
            aria-label="Fechar navegação"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Express Balcão Terminal Button */}
        <div className="p-3.5 border-b border-white/5">
          <button
            onClick={() => {
              onCloseSidebar();
              onOpenTerminal();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-[#1B8A4B] hover:from-emerald-500 hover:to-[#22A55B] text-white text-xs font-semibold shadow-lg shadow-emerald-950/50 transition-all active:scale-[0.98]"
          >
            <ScanLine className="w-4 h-4 shrink-0" />
            <span>Terminal Balcão Rápido</span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 pb-1 block">
            Módulos do Sistema
          </span>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseSidebar();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Info */}
        <div className="p-4 border-t border-white/10 bg-[#102027]/40">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <p className="font-semibold text-slate-200 text-[11px]">Sistema Institucional</p>
              <p className="text-[10px] text-slate-500">Complexo de Ed. Física</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Fixed Bottom Navigation for Mobile (Thumb Zone) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B1418]/95 backdrop-blur-md border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around h-16 px-1">
          {mobileTabs.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors active:bg-white/5 ${
                  isActive ? 'text-emerald-400 font-bold' : 'text-slate-400'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-emerald-400" />
                )}
                <span className="relative">
                  <Icon className="w-5 h-5" />
                  {item.id === 'emprestimos' && overdueCount > 0 && (
                    <span className="absolute -top-0.5 -right-1.5 min-w-[14px] h-[14px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[#0B1418]">
                      {overdueCount}
                    </span>
                  )}
                </span>
                <span className="truncate max-w-full px-0.5">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
