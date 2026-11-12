import React, { useState } from 'react';
import { CoefRegulation, RegulationRule } from '../types/sigef';
import { sigefStorage } from '../services/storage';
import { useToast } from '../components/Toast';
import {
  BookOpenText,
  Phone,
  Mail,
  MapPin,
  Clock,
  ShieldAlert,
  Edit2,
  Check,
  Plus,
  Trash2,
  Building,
} from 'lucide-react';

interface NormsPageProps {
  userRole: string;
}

export const NormsPage: React.FC<NormsPageProps> = ({ userRole }) => {
  const { showToast } = useToast();
  const [regulation, setRegulation] = useState<CoefRegulation>(sigefStorage.getRegulation());
  const [isEditing, setIsEditing] = useState(false);

  // Editable rules state
  const [rules, setRules] = useState<RegulationRule[]>(regulation.rules);
  const [contact, setContact] = useState(regulation.contact);

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: CoefRegulation = {
      rules,
      contact,
    };
    sigefStorage.saveRegulation(updated);
    setRegulation(updated);
    setIsEditing(false);
    showToast('Regulamento e contatos da COEF atualizados com sucesso!', 'success');
  };

  const handleRuleChange = (index: number, field: 'title' | 'text', val: string) => {
    const updated = [...rules];
    updated[index][field] = val;
    setRules(updated);
  };

  const handleAddRule = () => {
    setRules([
      ...rules,
      {
        id: 'rule-' + Date.now(),
        title: 'Nova Norma Interna',
        text: 'Descreva a nova regra de utilização do complexo esportivo...',
      },
    ]);
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 leading-tight">
            <BookOpenText className="w-6 h-6 shrink-0 text-sky-400" />
            <span>Normas, Regulamento & Atendimento COEF</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Regulamento oficial de retirada, conservação de materiais, uso dos espaços e canais de contato
          </p>
        </div>

        {userRole === 'admin' && (
          <button
            onClick={() => {
              if (isEditing) {
                // Cancel
                setRules(regulation.rules);
                setContact(regulation.contact);
                setIsEditing(false);
              } else {
                setIsEditing(true);
              }
            }}
            className={`flex items-center justify-center gap-1.5 w-full sm:w-auto min-h-11 sm:min-h-0 px-4 py-2 rounded-xl text-xs font-semibold transition-colors self-start sm:self-auto ${
              isEditing
                ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
            }`}
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Cancelar Edição' : 'Editar Regulamento'}</span>
          </button>
        )}
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Coordination Contact Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#102027] to-[#12242B] border border-emerald-500/30 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-1 pb-3 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm sm:text-base font-bold text-white">
                Canais de Atendimento da Coordenação de Educação Física (COEF)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 font-semibold">
              Atendimento Presencial e Remoto
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 font-semibold block uppercase text-[10px]">Localização:</span>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={contact.building}
                    onChange={(e) => setContact({ ...contact, building: e.target.value })}
                    className="w-full h-8 px-2 bg-[#0B1418] border border-white/15 rounded-lg text-white mb-1"
                  />
                  <input
                    type="text"
                    value={contact.room}
                    onChange={(e) => setContact({ ...contact, room: e.target.value })}
                    className="w-full h-8 px-2 bg-[#0B1418] border border-white/15 rounded-lg text-white"
                  />
                </>
              ) : (
                <>
                  <p className="font-bold text-white text-sm">{contact.building}</p>
                  <p className="text-slate-300">{contact.room}</p>
                </>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 font-semibold block uppercase text-[10px]">Contato Direto:</span>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={contact.phone}
                    onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                    className="w-full h-8 px-2 bg-[#0B1418] border border-white/15 rounded-lg text-white mb-1"
                  />
                  <input
                    type="text"
                    value={contact.email}
                    onChange={(e) => setContact({ ...contact, email: e.target.value })}
                    className="w-full h-8 px-2 bg-[#0B1418] border border-white/15 rounded-lg text-white"
                  />
                </>
              ) : (
                <>
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{contact.phone}</span>
                  </p>
                  <p className="text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-sky-400" />
                    <span>{contact.email}</span>
                  </p>
                </>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 font-semibold block uppercase text-[10px]">
                Coordenação & Plantão:
              </span>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={contact.coordinatorName}
                    onChange={(e) => setContact({ ...contact, coordinatorName: e.target.value })}
                    className="w-full h-8 px-2 bg-[#0B1418] border border-white/15 rounded-lg text-white mb-1"
                  />
                  <input
                    type="text"
                    value={contact.openingHours}
                    onChange={(e) => setContact({ ...contact, openingHours: e.target.value })}
                    className="w-full h-8 px-2 bg-[#0B1418] border border-white/15 rounded-lg text-white"
                  />
                </>
              ) : (
                <>
                  <p className="font-bold text-white">
                    {contact.coordinatorName}{' '}
                    <span className="text-[11px] font-mono text-slate-400">({contact.siapeCoordinator})</span>
                  </p>
                  <p className="text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{contact.openingHours}</span>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Rules & Internal Regulations List */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#102027] border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-emerald-400" />
                <span>Regulamento Geral de Uso dos Materiais e Instalações Esportivas</span>
              </h3>
              <p className="text-xs text-slate-400">
                Aprovado pelo Colegiado da COEF • Aplicação obrigatória a todos os usuários
              </p>
            </div>

            {isEditing && (
              <button
                type="button"
                onClick={handleAddRule}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Artigo</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {rules.map((rule, idx) => (
              <div
                key={rule.id}
                className="p-4 rounded-xl bg-[#0B1418] border border-white/5 space-y-1.5 text-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    {isEditing ? (
                      <input
                        type="text"
                        value={rule.title}
                        onChange={(e) => handleRuleChange(idx, 'title', e.target.value)}
                        className="w-full h-8 px-2.5 bg-[#102027] border border-white/15 rounded-lg text-white font-bold text-sm mb-1.5"
                      />
                    ) : (
                      <h4 className="font-bold text-sm text-white flex items-center gap-2">
                        <span className="font-mono text-emerald-400 text-xs">Art. {idx + 1}º</span>
                        <span>{rule.title}</span>
                      </h4>
                    )}
                  </div>

                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRule(idx)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <textarea
                    rows={3}
                    value={rule.text}
                    onChange={(e) => handleRuleChange(idx, 'text', e.target.value)}
                    className="w-full p-2 bg-[#102027] border border-white/15 rounded-lg text-slate-200 text-xs"
                  />
                ) : (
                  <p className="text-slate-300 leading-relaxed text-xs">{rule.text}</p>
                )}
              </div>
            ))}
          </div>

          {isEditing && (
            <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setRules(regulation.rules);
                  setContact(regulation.contact);
                  setIsEditing(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Descartar Alterações
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs font-semibold rounded-xl shadow-lg"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Regulamento Oficial</span>
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
