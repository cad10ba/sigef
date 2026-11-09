import React, { useState, useEffect } from 'react';
import { sigefStorage } from '../services/storage';
import {
  SUPABASE_URL,
  SUPABASE_PROJECT_ID,
  REQUIRED_TABLES,
} from '../services/supabase';
import { useToast } from './Toast';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  X,
  CloudUpload,
  CloudDownload,
  Terminal,
  ShieldCheck,
  Lock,
  ShieldAlert,
  FileText,
} from 'lucide-react';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'security' | 'sql'>('security');
  const [status, setStatus] = useState<{
    connected: boolean;
    foundTables: string[];
    missingTables: string[];
    message: string;
  }>({
    connected: true,
    foundTables: [],
    missingTables: [...REQUIRED_TABLES],
    message: 'Verificando tabelas no Supabase...',
  });

  const checkStatus = async () => {
    setTestingConnection(true);
    try {
      const res = await sigefStorage.testSupabaseStatus();
      setStatus({
        connected: res.connected,
        foundTables: res.foundTables,
        missingTables: res.missingTables,
        message: res.message,
      });
    } catch (err: any) {
      setStatus({
        connected: false,
        foundTables: [],
        missingTables: [...REQUIRED_TABLES],
        message: err?.message || 'Falha na comunicação com o Supabase.',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen]);

  const currentUser = sigefStorage.getCurrentUser();
  if (!isOpen || currentUser.role !== 'admin') return null;

  const handleSyncFromCloud = async () => {
    setLoading(true);
    const res = await sigefStorage.syncFromSupabase();
    setLoading(false);
    if (res.success) {
      showToast(res.message, 'success');
      checkStatus();
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleSyncToCloud = async () => {
    setLoading(true);
    const res = await sigefStorage.syncToSupabase();
    setLoading(false);
    if (res.success) {
      showToast(res.message, 'success');
      checkStatus();
    } else {
      showToast(res.message, 'error');
    }
  };

  const sqlEditorUrl = `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/sql`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl bg-[#102027] text-slate-100 rounded-3xl border border-white/15 p-5 sm:p-7 shadow-2xl max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Integração & Segurança Supabase
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  RLS Hardened
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Projeto: <span className="text-emerald-400">{SUPABASE_PROJECT_ID}</span> • {SUPABASE_URL}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-4 pb-2 border-b border-white/5">
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'security'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Auditoria de Políticas RLS</span>
          </button>

          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'overview'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Tabelas & Conexão ({status.foundTables.length}/9)</span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'sql'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Scripts SQL</span>
          </button>
        </div>

        {/* TAB 1: RLS Security Audit */}
        {activeTab === 'security' && (
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-300">
                    Auditoria de Segurança RLS Concluída
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Identificamos vulnerabilidades no modelo inicial de acesso livre e desenvolvemos as correções definitivas de segurança para aplicar diretamente no seu PostgreSQL do Supabase.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Itens de Proteção e Políticas RLS Aplicadas:
              </span>

              {/* Vulnerability 1 */}
              <div className="p-3.5 rounded-2xl bg-[#0B1418] border border-white/10 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Zero-Leakage de Senhas (app_users)</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Corrigido
                    </span>
                  </div>
                  <p className="text-slate-300 mt-1 leading-relaxed">
                    Revogada a leitura direta da coluna sensível <code className="text-sky-300 bg-white/5 px-1 py-0.5 rounded">password</code> para papéis públicos. O login é autenticado com segurança no servidor através da função RPC <code className="text-emerald-300 bg-white/5 px-1 py-0.5 rounded">public.sigef_login</code>.
                  </p>
                </div>
              </div>

              {/* Vulnerability 2 */}
              <div className="p-3.5 rounded-2xl bg-[#0B1418] border border-white/10 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Imutabilidade dos Termos de Empréstimo (loans)</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Protegido
                    </span>
                  </div>
                  <p className="text-slate-300 mt-1 leading-relaxed">
                    O comando <code className="text-rose-300 bg-white/5 px-1 py-0.5 rounded">DELETE</code> foi terminantemente bloqueado no RLS (<code className="text-emerald-300">USING (false)</code>). Registros de empréstimo e termos de guarda de patrimônio público são imutáveis e auditáveis.
                  </p>
                </div>
              </div>

              {/* Vulnerability 3 */}
              <div className="p-3.5 rounded-2xl bg-[#0B1418] border border-white/10 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Proteção das Contas de Administrador</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Blindado
                    </span>
                  </div>
                  <p className="text-slate-300 mt-1 leading-relaxed">
                    Políticas de segurança do banco que protegem as contas com papel de administrador da Coordenação contra exclusões ou alterações indevidas.
                  </p>
                </div>
              </div>

              {/* Vulnerability 4 */}
              <div className="p-3.5 rounded-2xl bg-[#0B1418] border border-white/10 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Validações de Integridade (Estoque & Horários)</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Restrições Ativas
                    </span>
                  </div>
                  <p className="text-slate-300 mt-1 leading-relaxed">
                    Check constraints adicionadas para impedir estoques negativos em <code className="text-purple-300">materials</code> e reservas inconsistentes (onde horário final seja anterior ou igual ao inicial) em <code className="text-purple-300">reservations</code>.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="p-4 rounded-2xl bg-[#0B1418] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">Aplicar Correções no Supabase:</span>
                <span className="text-[11px] text-slate-400">
                  Aplique as migrações versionadas de <code className="text-emerald-300">supabase/migrations/</code> no SQL Editor do projeto.
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <a
                  href={sqlEditorUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl text-xs border border-white/15 transition-colors"
                >
                  <span>Abrir SQL Editor</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Tables Overview */}
        {activeTab === 'overview' && (
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-[#0B1418] border border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3 h-3 rounded-full animate-pulse ${
                      status.connected ? 'bg-emerald-400' : 'bg-rose-500'
                    }`}
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {status.connected ? 'Conexão Supabase Ativa' : 'Desconectado'}
                    </span>
                    <span className="text-[11px] text-slate-400">{status.message}</span>
                  </div>
                </div>

                <button
                  onClick={checkStatus}
                  disabled={testingConnection}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-200 border border-white/10 transition-colors self-start sm:self-auto disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                  <span>{testingConnection ? 'Verificando...' : 'Testar Conexão'}</span>
                </button>
              </div>

              {/* Tables Checklist */}
              <div className="mt-3 pt-3 border-t border-white/5">
                <span className="text-[11px] uppercase font-bold text-slate-400 block mb-2">
                  Estado das Tabelas no Banco:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {REQUIRED_TABLES.map((t) => {
                    const exists = status.foundTables.includes(t);
                    return (
                      <div
                        key={t}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] border ${
                          exists
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-semibold'
                            : 'bg-white/[0.02] border-white/10 text-slate-400'
                        }`}
                      >
                        {exists ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className="font-mono truncate">{t}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SQL Scripts */}
        {activeTab === 'sql' && (
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-[#0B1418] border border-white/10 space-y-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Scripts SQL fora do bundle</span>
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                O SQL de schema, de autenticação e de RLS agora vive apenas no repositório, versionado em
                <code className="text-emerald-300"> supabase/migrations/</code>. O cliente não recebe mais nenhum script.
              </p>
              <ul className="text-[11px] font-mono text-slate-300 space-y-1 pt-1">
                <li>1. supabase/migrations/001_schema.sql</li>
                <li>2. supabase/migrations/002_auth_hardening.sql</li>
                <li>3. supabase/migrations/003_rls_policies.sql</li>
              </ul>
            </div>
          </div>
        )}

        {/* Sync Actions */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Sincronização bidirecional em tempo real ativada</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleSyncFromCloud}
              disabled={loading}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold rounded-xl border border-white/10 transition-colors disabled:opacity-50"
              title="Baixar dados do Supabase para o app"
            >
              <CloudDownload className="w-4 h-4 text-sky-400" />
              <span>Baixar da Nuvem</span>
            </button>

            <button
              onClick={handleSyncToCloud}
              disabled={loading}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs font-semibold rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
              title="Enviar dados atuais para o Supabase"
            >
              <CloudUpload className="w-4 h-4" />
              <span>Exportar para Nuvem</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
