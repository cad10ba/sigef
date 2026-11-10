import React from 'react';
import { sigefStorage } from '../services/storage';
import { downloadCSV, formatDateBR } from '../utils/formatters';
import { useToast } from '../components/Toast';
import {
  BarChart3,
  Download,
  TrendingUp,
  Dumbbell,
  Calendar,
  AlertTriangle,
  PieChart,
  CheckCircle,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { showToast } = useToast();
  const materials = sigefStorage.getMaterials();
  const loans = sigefStorage.getLoans();
  const spaces = sigefStorage.getSpaces();
  const reservations = sigefStorage.getReservations();

  // 1. Materiais mais emprestados
  const materialLoanCounts: { [key: string]: { name: string; count: number; category: string } } = {};
  loans.forEach((loan) => {
    loan.items.forEach((item) => {
      if (!materialLoanCounts[item.materialId]) {
        materialLoanCounts[item.materialId] = {
          name: item.materialName,
          count: 0,
          category: 'geral',
        };
      }
      materialLoanCounts[item.materialId].count += item.quantity;
    });
  });

  const topMaterials = Object.values(materialLoanCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const maxMaterialCount = Math.max(...topMaterials.map((m) => m.count), 1);

  // 2. Ocupação por espaço
  const spaceReservationsCount = spaces.map((s) => {
    const count = reservations.filter((r) => r.spaceId === s.id).length;
    return { name: s.name, count, capacity: s.capacity };
  });

  const maxSpaceCount = Math.max(...spaceReservationsCount.map((s) => s.count), 1);

  // 3. Itens danificados / baixados
  const damagedItems = materials.filter(
    (m) => m.conservationState === 'danificado' || m.conservationState === 'baixado'
  );
  const totalDamagedQty = damagedItems.reduce((acc, m) => acc + (m.totalQuantity - m.availableQuantity), 0);

  // 4. Status de empréstimos
  const activeLoans = loans.filter((l) => l.status === 'ativo').length;
  const overdueLoans = loans.filter((l) => l.status === 'atrasado').length;
  const returnedLoans = loans.filter((l) => l.status === 'devolvido').length;
  const totalLoans = loans.length || 1;

  const handleExportManagementReport = () => {
    const lines = [
      'RELATÓRIO GERENCIAL SIGEF - COORDENAÇÃO DE EDUCAÇÃO FÍSICA',
      `Data de Emissão:;${new Date().toLocaleDateString('pt-BR')}`,
      '',
      '--- MATERIAIS MAIS EMPRESTADOS ---',
      'Material;Total de Empréstimos (Unidades)',
      ...topMaterials.map((m) => `"${m.name}";${m.count}`),
      '',
      '--- OCUPAÇÃO DOS ESPAÇOS ---',
      'Espaço Esportivo;Total de Reservas Registradas;Capacidade',
      ...spaceReservationsCount.map((s) => `"${s.name}";${s.count};${s.capacity}`),
      '',
      '--- ITENS DANIFICADOS OU BAIXADOS ---',
      'Tombo;Material;Estado;Local de Guarda',
      ...damagedItems.map((d) => `"${d.patrimonyNumber}";"${d.name}";"${d.conservationState}";"${d.storageLocation}"`),
    ];

    downloadCSV(
      `relatorio_gerencial_sigef_${new Date().toISOString().split('T')[0]}.csv`,
      lines.join('\n')
    );
    showToast('Relatório gerencial exportado em formato CSV!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            <span>Relatórios Gerenciais & Estatísticas</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Métricas de utilização dos espaços, giro de materiais no acervo e índice de devoluções
          </p>
        </div>

        <button
          onClick={handleExportManagementReport}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-950/40 transition-all active:scale-[0.98] self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Exportar Relatório Geral (CSV)</span>
        </button>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#102027] border border-white/10">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
            Total de Termos Gerados
          </span>
          <div className="mt-2 text-2xl font-bold font-mono text-white tabular-nums">
            {loans.length}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Desde a implantação do semestre</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#102027] border border-white/10">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
            Taxa de Devolução Pontual
          </span>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            {loans.length > 0 ? `${Math.round(((loans.length - overdueLoans) / totalLoans) * 100)}%` : '—'}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Sem ocorrências de atraso grave</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#102027] border border-white/10">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
            Aulas / Reservas Registradas
          </span>
          <div className="mt-2 text-2xl font-bold font-mono text-sky-400 tabular-nums">
            {reservations.length}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Complexo Esportivo</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#102027] border border-white/10">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
            Avarias / Manutenção Técnica
          </span>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-400 tabular-nums">
            {damagedItems.length} itens
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Em processo de reparo ou baixa</span>
        </div>
      </div>

      {/* Two Columns Grid: Most Loaned Materials & Space Occupancy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Materiais mais emprestados */}
        <div className="p-5 rounded-2xl bg-[#102027] border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Materiais Mais Emprestados (Volume Acumulado)</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Top 5</span>
          </div>

          <div className="space-y-3.5">
            {topMaterials.map((mat, idx) => {
              const pct = Math.round((mat.count / maxMaterialCount) * 100);

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{mat.name}</span>
                    <span className="font-mono font-bold text-emerald-400 tabular-nums">
                      {mat.count} retiradas
                    </span>
                  </div>
                  {/* Clean Visual Progress Bar */}
                  <div className="h-2 w-full bg-[#0B1418] rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-600 to-[#22A55B] rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {topMaterials.length === 0 && (
              <p className="text-xs text-slate-400 py-6 text-center">Nenhum dado de empréstimo registrado.</p>
            )}
          </div>
        </div>

        {/* Chart 2: Ocupação por Espaço Físico */}
        <div className="p-5 rounded-2xl bg-[#102027] border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400" />
              <span>Ocupação por Espaço Esportivo (Reservas Ativas)</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">COEF</span>
          </div>

          <div className="space-y-3.5">
            {spaceReservationsCount.map((spc, idx) => {
              const pct = Math.round((spc.count / maxSpaceCount) * 100);

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{spc.name}</span>
                    <span className="font-mono font-bold text-sky-400 tabular-nums">
                      {spc.count} agendamento(s)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#0B1418] rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-sky-600 to-cyan-400 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {spaceReservationsCount.length === 0 && (
              <p className="text-xs text-slate-400 py-6 text-center">Nenhum espaço esportivo cadastrado.</p>
            )}
          </div>
        </div>
      </div>

      {/* Itens Danificados / Avarias Table */}
      <div className="p-5 rounded-2xl bg-[#102027] border border-white/10 shadow-xl space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Relatório de Avarias e Extravios no Acervo</span>
            </h3>
            <p className="text-xs text-slate-400">
              Itens que necessitam de vulcanização, costura, substituição ou baixa patrimonial
            </p>
          </div>
        </div>

        {/* Avarias — cartões no celular */}
        <div className="md:hidden space-y-2.5">
          {damagedItems.map((mat) => {
            const lastMov = mat.history?.[0];
            return (
              <div key={mat.id} className="p-3.5 rounded-xl bg-[#0B1418] border border-white/10">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-[11px] text-slate-400 block">
                      {mat.patrimonyNumber}
                    </span>
                    <span className="font-semibold text-white text-sm block truncate">{mat.name}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                    {mat.conservationState}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {mat.storageLocation} •{' '}
                  {lastMov ? `${lastMov.reason} (${formatDateBR(lastMov.date)})` : 'Registro do sistema'}
                </p>
              </div>
            );
          })}

          {damagedItems.length === 0 && (
            <p className="text-center py-6 text-xs text-slate-400">
              Nenhum item com avaria ou baixa registrado no momento.
            </p>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0B1418] text-slate-400 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-2.5 pl-3">Tombo</th>
                <th className="p-2.5">Material</th>
                <th className="p-2.5">Estado</th>
                <th className="p-2.5">Local Atual</th>
                <th className="p-2.5 pr-3">Última Ocorrência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {damagedItems.map((mat) => {
                const lastMov = mat.history?.[0];
                return (
                  <tr key={mat.id} className="hover:bg-white/[0.02]">
                    <td className="p-2.5 pl-3 font-mono text-slate-200">{mat.patrimonyNumber}</td>
                    <td className="p-2.5 font-semibold text-white">{mat.name}</td>
                    <td className="p-2.5">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {mat.conservationState}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-400">{mat.storageLocation}</td>
                    <td className="p-2.5 pr-3 text-[11px] text-slate-400">
                      {lastMov ? `${lastMov.reason} (${formatDateBR(lastMov.date)})` : 'Registro do sistema'}
                    </td>
                  </tr>
                );
              })}

              {damagedItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-400">
                    Nenhum item com avaria ou baixa registrado no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
