import React, { useState } from 'react';
import { Poll, Resident } from '../../types';
import { Vote, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '../ui';

interface LiveVotingPanelProps {
  polls: Poll[];
  currentResident: Resident | null;
  isAdmin: boolean;
  hasVoted: (pollId: string, unit: string) => boolean;
  onVoteSubmit: (pollId: string, optionId: string, unit: string, zoomName: string) => void;
}

export const LiveVotingPanel: React.FC<LiveVotingPanelProps> = ({
  polls,
  currentResident,
  isAdmin,
  hasVoted,
  onVoteSubmit,
}) => {
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const activePolls = polls.filter(p => p.isActive);
  const unit = currentResident?.unit || 'Admin';
  const zoomName = currentResident?.zoomName || currentResident?.name || 'Participante';

  const handleVote = async (pollId: string) => {
    if (!selectedOptionId || !currentResident) return;
    setSubmitting(true);
    try {
      await onVoteSubmit(pollId, selectedOptionId, unit, zoomName);
      setSuccessMsg('Voto registrado com sucesso!');
      setTimeout(() => setSuccessMsg(null), 3000);
      setSelectedOptionId(null);
      setSelectedPollId(null);
    } catch (e) {
      console.error("Failed to vote", e);
    } finally {
      setSubmitting(false);
    }
  };

  if (isAdmin) {
    return (
      <div className="p-4 flex-1 overflow-y-auto space-y-4 text-slate-800">
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800">
          <strong>Modo Administrador:</strong> Você está visualizando o painel de votação ativo na assembleia. Os votos oficiais são computados pelos residentes.
        </div>
        <h4 className="font-bold text-sm text-slate-900">Votações na Assembleia ({activePolls.length} ativas)</h4>
        {activePolls.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8">Nenhuma votação ativa no momento.</p>
        ) : (
          activePolls.map(p => (
            <div key={p.id} className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm space-y-2">
              <div className="font-bold text-xs text-slate-900">{p.title}</div>
              <p className="text-[11px] text-slate-500">{p.description}</p>
              <div className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded w-fit">Votação Ativa</div>
            </div>
          ))
        )}
      </div>
    );
  }

  if (!currentResident) {
    return (
      <div className="p-6 flex-1 flex flex-col items-center justify-center text-center text-slate-600">
        <AlertCircle size={32} className="text-amber-500 mb-2" />
        <p className="text-xs font-medium">Identificação de unidade não encontrada na sessão de transmissão.</p>
      </div>
    );
  }

  return (
    <div className="p-4 flex-1 overflow-y-auto space-y-4 text-slate-800">
      <div className="bg-red-50 border border-red-100 p-3 rounded-xl">
        <div className="text-xs font-bold text-red-900">Unidade: {currentResident.unit}</div>
        <div className="text-[11px] text-red-700">{currentResident.name}</div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}

      <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
        <Vote size={16} className="text-red-600" /> Votações Ativas
      </h4>

      {activePolls.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Vote className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-xs">Nenhuma votação ativa no momento.</p>
          <p className="text-[10px] text-slate-400 mt-1">As votações abertas pelo administrador aparecerão aqui automaticamente.</p>
        </div>
      ) : (
        activePolls.map(poll => {
          const alreadyVoted = hasVoted(poll.id, currentResident.unit);
          const isSelected = selectedPollId === poll.id;

          return (
            <div key={poll.id} className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h5 className="font-bold text-xs text-slate-900">{poll.title}</h5>
                  {poll.description && <p className="text-[11px] text-slate-500 mt-0.5">{poll.description}</p>}
                </div>
                {alreadyVoted && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                    <CheckCircle size={12} /> Votado
                  </span>
                )}
              </div>

              {alreadyVoted ? (
                <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg text-center font-medium">
                  Seu voto já foi registrado para esta pauta.
                </div>
              ) : isSelected ? (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-bold text-slate-700">Selecione sua opção:</p>
                  <div className="space-y-1.5">
                    {poll.options.map(opt => (
                      <label 
                        key={opt.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          selectedOptionId === opt.id ? 'border-red-600 bg-red-50 font-bold text-red-900' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name={`poll_${poll.id}`} 
                          value={opt.id}
                          checked={selectedOptionId === opt.id}
                          onChange={() => setSelectedOptionId(opt.id)}
                          className="text-red-600 focus:ring-red-500"
                        />
                        <span>{opt.text}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button 
                      size="sm" 
                      onClick={() => handleVote(poll.id)}
                      disabled={!selectedOptionId || submitting}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs h-8"
                    >
                      {submitting ? 'Registrando...' : 'Confirmar Voto'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => { setSelectedPollId(null); setSelectedOptionId(null); }}
                      className="text-xs h-8"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setSelectedPollId(poll.id)}
                  className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  Participar da Votação <ArrowRight size={14} />
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
