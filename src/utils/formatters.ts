import {
  SpaceStatus,
  UseType,
  ReservationStatus,
  ConservationState,
  KitStatus,
  LoanStatus,
  ReturnItemState,
} from '../types/sigef';

export function formatDateBR(dateString?: string): string {
  if (!dateString) return '—';
  try {
    // If it's YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateTimeBR(dateString?: string): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const date = d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const time = d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${date} às ${time}`;
  } catch {
    return dateString;
  }
}

export function calculateDelayDays(expectedReturnISO: string): number {
  try {
    const expected = new Date(expectedReturnISO).getTime();
    const now = new Date().getTime();
    if (now <= expected) return 0;
    const diffMs = now - expected;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

export function getSpaceStatusBadge(status: SpaceStatus): {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
} {
  switch (status) {
    case 'livre':
      return {
        label: 'Livre',
        bgClass: 'bg-emerald-500/10 dark:bg-emerald-500/15',
        textClass: 'text-emerald-700 dark:text-emerald-400',
        borderClass: 'border-emerald-500/30',
      };
    case 'em_uso':
      return {
        label: 'Em Uso',
        bgClass: 'bg-sky-500/10 dark:bg-sky-500/15',
        textClass: 'text-sky-700 dark:text-sky-400',
        borderClass: 'border-sky-500/30',
      };
    case 'reservado':
      return {
        label: 'Reservado',
        bgClass: 'bg-indigo-500/10 dark:bg-indigo-500/15',
        textClass: 'text-indigo-700 dark:text-indigo-400',
        borderClass: 'border-indigo-500/30',
      };
    case 'manutencao':
      return {
        label: 'Manutenção',
        bgClass: 'bg-amber-500/10 dark:bg-amber-500/15',
        textClass: 'text-amber-700 dark:text-amber-400',
        borderClass: 'border-amber-500/30',
      };
    case 'interditado':
      return {
        label: 'Interditado',
        bgClass: 'bg-rose-500/10 dark:bg-rose-500/15',
        textClass: 'text-rose-700 dark:text-rose-400',
        borderClass: 'border-rose-500/30',
      };
    default:
      return {
        label: status,
        bgClass: 'bg-slate-500/10',
        textClass: 'text-slate-600 dark:text-slate-400',
        borderClass: 'border-slate-500/20',
      };
  }
}

export function getUseTypeBadge(useType: UseType): {
  label: string;
  colorClass: string;
} {
  switch (useType) {
    case 'aula':
      return { label: 'Aula Curricular', colorClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    case 'treino':
      return { label: 'Treino / Seleção', colorClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
    case 'extensao':
      return { label: 'Extensão / Projeto', colorClass: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
    case 'evento':
      return { label: 'Evento / Interclasse', colorClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    case 'livre':
      return { label: 'Uso Livre', colorClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
    case 'manutencao':
      return { label: 'Manutenção', colorClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
    default:
      return { label: useType, colorClass: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
  }
}

export function getConservationBadge(state: ConservationState): {
  label: string;
  colorClass: string;
} {
  switch (state) {
    case 'novo':
      return { label: 'Novo', colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    case 'bom':
      return { label: 'Bom', colorClass: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };
    case 'regular':
      return { label: 'Regular', colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    case 'danificado':
      return { label: 'Danificado', colorClass: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
    case 'baixado':
      return { label: 'Baixado', colorClass: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
    default:
      return { label: state, colorClass: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
  }
}

export function getLoanStatusBadge(status: LoanStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'ativo':
      return { label: 'Em Andamento', badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
    case 'atrasado':
      return { label: 'Atrasado', badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    case 'devolvido':
      return { label: 'Devolvido', badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    default:
      return { label: status, badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
  }
}

export function getKitStatusBadge(status: KitStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'pronto':
      return { label: 'Pronto p/ Uso', badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    case 'incompleto':
      return { label: 'Incompleto', badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    case 'emprestado':
      return { label: 'Emprestado', badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
    default:
      return { label: status, badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
  }
}

export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
