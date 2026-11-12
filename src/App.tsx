import React, { useState, useEffect } from 'react';
import { ActiveTab, UserProfile, Loan, Material, SportKit } from './types/sigef';
import { sigefStorage, subscribeToStorage } from './services/storage';
import { ToastProvider } from './components/Toast';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { DashboardPage } from './pages/DashboardPage';
import { SpacesPage } from './pages/SpacesPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { KitsPage } from './pages/KitsPage';
import { LoansPage } from './pages/LoansPage';
import { UsersPage } from './pages/UsersPage';
import { ReportsPage } from './pages/ReportsPage';
import { NormsPage } from './pages/NormsPage';

// Modals
import { NewReservationModal } from './components/NewReservationModal';
import { NewLoanModal } from './components/NewLoanModal';
import { ReturnLoanModal } from './components/ReturnLoanModal';
import { LoanReceiptModal } from './components/LoanReceiptModal';
import { NewMaterialModal } from './components/NewMaterialModal';
import { NewKitModal } from './components/NewKitModal';
import { LoginPage } from './components/LoginPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { supabase } from './services/supabase';
import { NewSystemUserModal } from './components/NewSystemUserModal';
import { SupabaseSyncModal } from './components/SupabaseSyncModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';

export default function App() {
  // Initialize storage on load
  useEffect(() => {
    sigefStorage.init();
    const currentTheme = sigefStorage.getTheme();
    sigefStorage.setTheme(currentTheme);
  }, []);

  // Ao voltar para a aba, recarrega o Supabase: registros criados no painel
  // do banco (docentes, reservas, etc.) passam a aparecer sem recarregar.
  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible' && sigefStorage.hasSession()) {
        sigefStorage.syncFromSupabase().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => document.removeEventListener('visibilitychange', refreshIfVisible);
  }, []);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    return subscribeToStorage(() => {
      setTick((prev) => prev + 1);
    });
  }, []);

  const [activeTab, setActiveTab] = useState<ActiveTab>('inicio');
  const [authUser, setAuthUser] = useState<UserProfile | null>(() => sigefStorage.getAuthUser());
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => sigefStorage.getCurrentUser());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => sigefStorage.getTheme() === 'dark');

  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  const allUsers = sigefStorage.getUsers();
  const loans = sigefStorage.getLoans();
  const overdueCount = loans.filter((l) => l.status === 'atrasado').length;

  // Modals state
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [reservationParams, setReservationParams] = useState<{
    spaceId?: string;
    date?: string;
    time?: string;
  }>({});

  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [loanTargetRequesterId, setLoanTargetRequesterId] = useState<string | undefined>(undefined);

  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnLoanTarget, setReturnLoanTarget] = useState<Loan | null>(null);

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptLoanTarget, setReceiptLoanTarget] = useState<Loan | null>(null);

  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState<Material | null>(null);

  const [isKitModalOpen, setIsKitModalOpen] = useState(false);
  const [kitToEdit, setKitToEdit] = useState<SportKit | null>(null);

  // Switch Theme
  const handleToggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    sigefStorage.setTheme(next);
  };

  // Switch User Profile
  const handleSelectUser = (user: UserProfile) => {
    sigefStorage.setCurrentUser(user);
    setCurrentUser(user);
  };

  // Auth handlers
  const handleLoginSuccess = (user: UserProfile) => {
    setAuthUser(user);
    setCurrentUser(user);
  };

  const handleLogout = () => {
    sigefStorage.logout();
    setAuthUser(null);
  };

  // Open reservation modal with optional prefilled space
  const handleOpenNewReservation = (spaceId?: string, date?: string, time?: string) => {
    setReservationParams({ spaceId, date, time });
    setIsReservationModalOpen(true);
  };

  // Open loan modal
  const handleOpenNewLoan = (requesterId?: string) => {
    setLoanTargetRequesterId(requesterId);
    setIsLoanModalOpen(true);
  };

  // Open return modal
  const handleOpenReturnLoan = (loan: Loan) => {
    setReturnLoanTarget(loan);
    setIsReturnModalOpen(true);
  };

  // Open receipt printable
  const handleOpenReceipt = (loan: Loan) => {
    setReceiptLoanTarget(loan);
    setIsReceiptModalOpen(true);
  };

  // Open material modal
  const handleOpenNewMaterial = (mat?: Material | null) => {
    setMaterialToEdit(mat || null);
    setIsMaterialModalOpen(true);
  };

  // Open kit modal
  const handleOpenNewKit = (kit?: SportKit | null) => {
    setKitToEdit(kit || null);
    setIsKitModalOpen(true);
  };

  // Link de "Esqueci minha senha": o Supabase volta com type=recovery na URL.
  const [isRecovery, setIsRecovery] = useState(
    () => typeof window !== 'undefined' && window.location.hash.includes('type=recovery')
  );
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (isRecovery) {
    return (
      <ToastProvider>
        <ResetPasswordPage onDone={() => setIsRecovery(false)} />
      </ToastProvider>
    );
  }

  if (!authUser) {
    return (
      <ToastProvider>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className={`min-h-dvh flex flex-col font-sans transition-colors duration-200 ${isDark ? 'bg-[#0B1418] text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
        {/* Header (fixed) */}
        <Header
          currentUser={currentUser}
          allUsers={allUsers}
          onSelectUser={handleSelectUser}
          onOpenNewReservation={() => handleOpenNewReservation()}
          onOpenNewLoan={() => handleOpenNewLoan()}
          onOpenNewMaterial={() => handleOpenNewMaterial()}
          onOpenNewKit={() => handleOpenNewKit()}
          onOpenNewUserModal={currentUser.role === 'admin' ? () => setIsNewUserModalOpen(true) : undefined}
          onOpenSupabaseModal={currentUser.role === 'admin' ? () => setIsSupabaseModalOpen(true) : undefined}
          onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
          onLogout={handleLogout}
          onNavigate={(tab) => setActiveTab(tab)}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenTerminalLoan={() => handleOpenNewLoan()}
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
        />

        {/* Main Body with Sidebar */}
        <div className="flex-1 flex w-full">
          {/* Navigation (Sidebar Desktop & Drawer / Bottom Mobile) */}
          <Navigation
            activeTab={activeTab}
            onNavigate={(tab) => setActiveTab(tab)}
            isSidebarOpen={isSidebarOpen}
            onCloseSidebar={() => setIsSidebarOpen(false)}
            onOpenTerminal={() => handleOpenNewLoan()}
            userRole={currentUser.role}
            overdueCount={overdueCount}
          />

          {/* Page Content Viewport */}
          <main className="flex-1 min-w-0 px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-12 max-w-7xl mx-auto w-full">
            {activeTab === 'inicio' && (
              <DashboardPage
                onNavigate={(tab) => setActiveTab(tab)}
                onOpenTerminalLoan={() => handleOpenNewLoan()}
                onOpenNewReservation={(spaceId) => handleOpenNewReservation(spaceId)}
                userRole={currentUser.role}
              />
            )}

            {activeTab === 'espacos' && (
              <SpacesPage
                onOpenNewReservation={handleOpenNewReservation}
                userRole={currentUser.role}
              />
            )}

            {activeTab === 'materiais' && (
              <MaterialsPage
                onOpenNewMaterial={handleOpenNewMaterial}
                userRole={currentUser.role}
              />
            )}

            {activeTab === 'kits' && (
              <KitsPage
                onOpenNewKit={handleOpenNewKit}
                onOpenNewLoanWithKit={(kitId) => handleOpenNewLoan()}
                userRole={currentUser.role}
              />
            )}

            {activeTab === 'emprestimos' && (
              <LoansPage
                onOpenNewLoan={handleOpenNewLoan}
                onOpenReturnLoan={handleOpenReturnLoan}
                onOpenReceipt={handleOpenReceipt}
                userRole={currentUser.role}
              />
            )}

            {activeTab === 'docentes' && (
              <UsersPage
                onOpenNewLoanWithRequester={handleOpenNewLoan}
                userRole={currentUser.role}
              />
            )}

            {activeTab === 'relatorios' && <ReportsPage />}

            {activeTab === 'normas' && <NormsPage userRole={currentUser.role} />}
          </main>
        </div>

        {/* Modal: Nova Reserva — montado apenas quando aberto (estado sempre limpo) */}
        {isReservationModalOpen && (
          <NewReservationModal
            isOpen
            onClose={() => setIsReservationModalOpen(false)}
            onSaved={() => {}}
            preselectedSpaceId={reservationParams.spaceId}
            preselectedDate={reservationParams.date}
            preselectedTime={reservationParams.time}
          />
        )}

        {/* Modal: Novo Empréstimo — montado apenas quando aberto */}
        {isLoanModalOpen && (
          <NewLoanModal
            isOpen
            onClose={() => setIsLoanModalOpen(false)}
            initialRequesterId={loanTargetRequesterId}
            onLoanCreated={(createdLoan) => {
              setIsLoanModalOpen(false);
              setReceiptLoanTarget(createdLoan);
              setIsReceiptModalOpen(true);
            }}
          />
        )}

        {/* Modal: Devolução & Vistoria — montado apenas quando aberto */}
        {isReturnModalOpen && returnLoanTarget && (
          <ReturnLoanModal
            isOpen
            onClose={() => setIsReturnModalOpen(false)}
            loan={returnLoanTarget}
            onReturned={() => {}}
          />
        )}

        {/* Modal: Termo Oficial / Comprovante para Impressão */}
        <LoanReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          loan={receiptLoanTarget}
        />

        {/* Modal: Novo Material — montado apenas quando aberto (novo cadastro começa vazio) */}
        {isMaterialModalOpen && (
          <NewMaterialModal
            isOpen
            onClose={() => setIsMaterialModalOpen(false)}
            materialToEdit={materialToEdit}
            onSaved={() => {}}
          />
        )}

        {/* Modal: Novo Kit — montado apenas quando aberto */}
        {isKitModalOpen && (
          <NewKitModal
            isOpen
            onClose={() => setIsKitModalOpen(false)}
            kitToEdit={kitToEdit}
            onSaved={() => {}}
          />
        )}

        {/* Modal: Cadastrar Novo Usuário do Sistema — montado apenas quando aberto */}
        {isNewUserModalOpen && (
          <NewSystemUserModal
            isOpen
            onClose={() => setIsNewUserModalOpen(false)}
            onUserCreated={() => setTick((t) => t + 1)}
          />
        )}

        {/* Modal: Status & Sincronização Supabase */}
        <SupabaseSyncModal
          isOpen={isSupabaseModalOpen}
          onClose={() => setIsSupabaseModalOpen(false)}
        />

        {/* Modal: Alterar Minha Senha — montado apenas quando aberto */}
        {isChangePasswordModalOpen && (
          <ChangePasswordModal
            isOpen
            onClose={() => setIsChangePasswordModalOpen(false)}
            currentUser={currentUser}
          />
        )}
      </div>
    </ToastProvider>
  );
}
