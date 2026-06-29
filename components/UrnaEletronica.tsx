import React, { useState, useMemo } from 'react';
import { Resident, Poll, VoteRecord } from '../types';
import { Button, Card, Input } from './ui';
import { Search, User, CheckCircle2, ArrowLeft, X, ShieldAlert } from 'lucide-react';

const maskCpf = (cpf?: string) => {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length <= 3) return digits + '*'.repeat(11 - digits.length);
  return digits.slice(0, 3) + '.***.***-**';
};

const removeAccents = (str?: string | null): string => {
  if (!str) return '';
  return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

interface UrnaEletronicaProps {
  residents: Resident[];
  polls: Poll[];
  votes: VoteRecord[];
  onVoteSubmit: (pollId: string, unit: string, optionId: string, isDelinquent: boolean, zoomName?: string) => Promise<void> | void;
  onBack: () => void;
  singlePollId?: string; // If restricted to a single poll (results panel mode)
  isStandalone?: boolean; // If in full-screen "Urna" mode
}

export const UrnaEletronica: React.FC<UrnaEletronicaProps> = ({
  residents,
  polls,
  votes,
  onVoteSubmit,
  onBack,
  singlePollId,
  isStandalone = false
}) => {
  // Navigation states: 'SEARCH' | 'CONFIRM' | 'PROXY_OPTION' | 'VOTE_POLLS' | 'SUCCESS'
  const [step, setStep] = useState<'SEARCH' | 'CONFIRM' | 'PROXY_OPTION' | 'VOTE_POLLS' | 'SUCCESS'>('SEARCH');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  
  // Voting states
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [votedPollIds, setVotedPollIds] = useState<string[]>([]);
  const [showError, setShowError] = useState<string | null>(null);

  // Proxy voting states
  const [votingMode, setVotingMode] = useState<'UNIFIED' | 'DISTINCT' | null>(null);
  const [currentVotingUnit, setCurrentVotingUnit] = useState<string>('');
  const [remainingUnitsToVote, setRemainingUnitsToVote] = useState<string[]>([]);

  // Filter only active and unended polls
  const availablePolls = useMemo(() => {
    const active = polls.filter(p => p.isActive && !p.isEnded);
    if (singlePollId) {
      return active.filter(p => p.id === singlePollId);
    }
    return active;
  }, [polls, singlePollId]);

  // Clean search helper
  const filteredResidents = useMemo(() => {
    const trimmed = (searchQuery || '').trim();
    if (!trimmed) return [];
    
    const queryTerms = removeAccents(trimmed.toLowerCase())
      .split(/\s+/)
      .filter(term => term.length > 0);
      
    if (queryTerms.length === 0) return [];
    
    return residents.filter(r => {
      if (!r) return false;
      const unitStr = removeAccents(r.unit).toLowerCase();
      const nameStr = removeAccents(r.name).toLowerCase();
      const cpfStr = r.cpf ? String(r.cpf).replace(/[^0-9]/g, '') : '';
      
      const nameWords = nameStr.split(/\s+/).filter(word => word.length > 0);
      
      return queryTerms.every(term => {
        const unitMatch = unitStr.includes(term);
        const termDigits = term.replace(/[^0-9]/g, '');
        const cpfMatch = (cpfStr && termDigits) ? cpfStr.includes(termDigits) : false;
        
        const nameWordMatch = nameWords.some(word => {
          if (term.length <= 2) {
            return word.startsWith(term);
          } else {
            return word.includes(term);
          }
        });
        
        return unitMatch || cpfMatch || nameWordMatch;
      });
    }).slice(0, 8); // Limit to 8 matches for clean UI
  }, [searchQuery, residents]);

  // Check if a resident has already voted in a specific poll
  const hasResidentVoted = (resUnit: string, pollId: string) => {
    return votes.some(v => v.unit.toLowerCase() === resUnit.toLowerCase() && v.pollId === pollId) || votedPollIds.includes(pollId);
  };

  const handleSelectResident = (resident: Resident) => {
    setSelectedResident(resident);
    setSearchQuery('');
    setStep('CONFIRM');
    setShowError(null);
  };

  const handleConfirmResident = () => {
    if (!selectedResident) return;
    
    if (availablePolls.length === 0) {
      setShowError("Aguardando ativação da enquete.");
      return;
    }

    // Check represented units (including proxies)
    const parsedProxyUnits = selectedResident.proxyUnits
      ? selectedResident.proxyUnits.split(',').map(u => u.trim()).filter(u => u.length > 0)
      : [];

    const allRepresentedUnits = [selectedResident.unit, ...parsedProxyUnits];
    
    // Find polls that have at least one unvoted represented unit
    const unvotedPolls = availablePolls.filter(p => 
      allRepresentedUnits.some(u => !hasResidentVoted(u, p.id))
    );
    
    if (unvotedPolls.length === 0) {
      if (parsedProxyUnits.length > 0) {
        setShowError(`Este condômino (Unidade ${selectedResident.unit}) e suas procurações (${parsedProxyUnits.join(', ')}) já registraram votos em todas as enquetes ativas.`);
      } else {
        setShowError(`Este condômino (Unidade ${selectedResident.unit}) já registrou votos em todas as enquetes ativas.`);
      }
      return;
    }

    setVotedPollIds([]);

    if (parsedProxyUnits.length > 0) {
      // Show proxy decision step first
      setStep('PROXY_OPTION');
    } else {
      // Normal single voting flow
      setVotingMode('UNIFIED');
      setSelectedPoll(unvotedPolls[0]);
      setSelectedOptionId('');
      
      const unvotedUnitsForThisPoll = [selectedResident.unit].filter(u => !hasResidentVoted(u, unvotedPolls[0].id));
      setRemainingUnitsToVote(unvotedUnitsForThisPoll);
      setCurrentVotingUnit(unvotedUnitsForThisPoll[0] || selectedResident.unit);
      
      setStep('VOTE_POLLS');
    }
  };

  const handleSelectProxyMode = (mode: 'UNIFIED' | 'DISTINCT') => {
    if (!selectedResident) return;

    const parsedProxyUnits = selectedResident.proxyUnits
      ? selectedResident.proxyUnits.split(',').map(u => u.trim()).filter(u => u.length > 0)
      : [];

    const allRepresentedUnits = [selectedResident.unit, ...parsedProxyUnits];

    const unvotedPolls = availablePolls.filter(p => 
      allRepresentedUnits.some(u => !hasResidentVoted(u, p.id))
    );

    if (unvotedPolls.length === 0) {
      setShowError("Não há enquetes pendentes para estas unidades.");
      return;
    }

    setVotingMode(mode);
    const firstPoll = unvotedPolls[0];
    setSelectedPoll(firstPoll);
    setSelectedOptionId('');

    const unvotedUnitsForThisPoll = allRepresentedUnits.filter(u => !hasResidentVoted(u, firstPoll.id));
    setRemainingUnitsToVote(unvotedUnitsForThisPoll);
    setCurrentVotingUnit(unvotedUnitsForThisPoll[0] || selectedResident.unit);

    setStep('VOTE_POLLS');
  };

  const handleVoteSubmitClick = async () => {
    if (!selectedResident || !selectedPoll || !selectedOptionId) return;

    const parsedProxyUnits = selectedResident.proxyUnits
      ? selectedResident.proxyUnits.split(',').map(u => u.trim()).filter(u => u.length > 0)
      : [];

    const allRepresentedUnits = [selectedResident.unit, ...parsedProxyUnits];

    try {
      if (votingMode === 'UNIFIED') {
        // Vote for all represented units that haven't voted for this poll yet
        const unvotedUnits = allRepresentedUnits.filter(u => !hasResidentVoted(u, selectedPoll.id));
        
        for (const unit of unvotedUnits) {
          const residentForUnit = residents.find(r => r.unit.toLowerCase() === unit.toLowerCase()) || selectedResident;
          await onVoteSubmit(
            selectedPoll.id,
            unit,
            selectedOptionId,
            residentForUnit.isDelinquent,
            "VOTO PRESENCIAL"
          );
        }

        // Add to session voted listed to prevent duplicate voting prior to server snapshot
        const updatedVoted = [...votedPollIds, selectedPoll.id];
        setVotedPollIds(updatedVoted);

        // Find next unvoted active poll
        const nextPoll = availablePolls.find(p => 
          p.id !== selectedPoll.id && 
          !updatedVoted.includes(p.id) && 
          allRepresentedUnits.some(u => !hasResidentVoted(u, p.id))
        );

        if (nextPoll) {
          setSelectedPoll(nextPoll);
          setSelectedOptionId('');
          const nextPollUnvotedUnits = allRepresentedUnits.filter(u => !hasResidentVoted(u, nextPoll.id));
          setRemainingUnitsToVote(nextPollUnvotedUnits);
          setCurrentVotingUnit(nextPollUnvotedUnits[0] || selectedResident.unit);
        } else {
          setStep('SUCCESS');
          // Reset state after a short period if standalone
          if (isStandalone) {
            setTimeout(() => {
              handleReset();
            }, 3500);
          }
        }
      } else {
        // DISTINCT mode: vote for currentVotingUnit only
        const residentForUnit = residents.find(r => r.unit.toLowerCase() === currentVotingUnit.toLowerCase()) || selectedResident;
        await onVoteSubmit(
          selectedPoll.id,
          currentVotingUnit,
          selectedOptionId,
          residentForUnit.isDelinquent,
          "VOTO PRESENCIAL"
        );

        const nextUnits = remainingUnitsToVote.slice(1);
        if (nextUnits.length > 0) {
          setRemainingUnitsToVote(nextUnits);
          setCurrentVotingUnit(nextUnits[0]);
          setSelectedOptionId(''); // clear selection for next unit
        } else {
          // All represented units have voted for this poll!
          const updatedVoted = [...votedPollIds, selectedPoll.id];
          setVotedPollIds(updatedVoted);

          // Find next active poll that has some unvoted units
          const nextPoll = availablePolls.find(p => 
            p.id !== selectedPoll.id && 
            !updatedVoted.includes(p.id) && 
            allRepresentedUnits.some(u => !hasResidentVoted(u, p.id))
          );

          if (nextPoll) {
            setSelectedPoll(nextPoll);
            setSelectedOptionId('');
            const nextPollUnvotedUnits = allRepresentedUnits.filter(u => !hasResidentVoted(u, nextPoll.id));
            setRemainingUnitsToVote(nextPollUnvotedUnits);
            setCurrentVotingUnit(nextPollUnvotedUnits[0] || selectedResident.unit);
          } else {
            setStep('SUCCESS');
            if (isStandalone) {
              setTimeout(() => {
                handleReset();
              }, 3500);
            }
          }
        }
      }
    } catch (err: any) {
      setShowError("Ocorreu um erro ao salvar o voto. Tente novamente.");
    }
  };

  const handleReset = () => {
    setStep('SEARCH');
    setSelectedResident(null);
    setSelectedPoll(null);
    setSelectedOptionId('');
    setVotedPollIds([]);
    setShowError(null);
    setSearchQuery('');
    setVotingMode(null);
    setCurrentVotingUnit('');
    setRemainingUnitsToVote([]);
  };

  return (
    <Card className="shadow-xl border-t-4 border-red-600 bg-white min-h-[500px] flex flex-col justify-between">
      {/* Header */}
      <div className="border-b pb-4 mb-4 flex justify-between items-center bg-slate-50/50 p-4 -m-6 rounded-t-xl border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse"></span>
            {isStandalone ? "Urna Eletrônica Presencial" : "Votação Manual Integrada"}
          </h2>
          {!isStandalone && (
            <p className="text-xs text-gray-500 mt-0.5">
              Registrar votos físicos/manuais para a enquete: {selectedPoll?.title || ''}
            </p>
          )}
        </div>
        {!isStandalone && (
          <Button variant="ghost" onClick={onBack} size="sm" className="text-gray-500 hover:text-black">
            <X size={20} />
          </Button>
        )}
        {isStandalone && step === 'SEARCH' && (
          <Button variant="outline" onClick={onBack} size="sm" className="text-blue-600 hover:bg-blue-50 border-blue-200">
            <ArrowLeft size={16} className="mr-2" /> Painel de Controle
          </Button>
        )}
      </div>

      <div className="flex-1 py-4 flex flex-col justify-center">
        {showError && (
          <div className="mb-4 bg-amber-50 border-l-4 border-amber-500 p-4 rounded text-sm text-amber-900 flex items-start gap-2">
            <ShieldAlert size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Aviso</p>
              <p>{showError}</p>
              {step === 'CONFIRM' && (
                <Button size="sm" variant="outline" className="mt-2 text-xs border-amber-200 text-amber-800" onClick={handleReset}>
                  Selecionar outro morador
                </Button>
              )}
            </div>
          </div>
        )}

        {/* STEP 1: SEARCH */}
        {step === 'SEARCH' && (
          <div className="space-y-6 max-w-xl mx-auto w-full">
            <div className="text-center space-y-2">
              <div className="bg-red-50 p-3 rounded-full inline-flex text-red-600">
                <Search size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Localizar Condômino</h3>
              <p className="text-sm text-gray-500">Busque pela unidade, CPF ou nome completo do morador que deseja registrar o voto.</p>
            </div>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <Search size={20} />
              </span>
              <Input
                placeholder="Ex: Apt 102, 123.456..., ou Maria..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-lg font-medium border-red-200 hover:border-red-300 focus:border-red-500"
                autoFocus
              />
            </div>

            {filteredResidents.length > 0 && (
              <div className="bg-white border rounded-xl divide-y shadow-md overflow-hidden max-h-[300px] overflow-y-auto">
                {filteredResidents.map((r, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectResident(r)}
                    className="w-full text-left p-4 hover:bg-slate-50 transition-colors flex justify-between items-center"
                  >
                    <div>
                      <span className="font-bold text-gray-900 text-lg block">Unidade {r.unit}</span>
                      <span className="text-sm text-gray-500">{r.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchQuery && filteredResidents.length === 0 && (
              <p className="text-center text-sm text-gray-500 py-4">Nenhum condômino encontrado para "{searchQuery}".</p>
            )}
          </div>
        )}

        {/* STEP 2: CONFIRM */}
        {step === 'CONFIRM' && selectedResident && (
          <div className="max-w-md mx-auto w-full space-y-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
            <div className="text-center space-y-2">
              <div className="bg-blue-50 p-3 rounded-full inline-flex text-blue-600">
                <User size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-800">É este morador mesmo?</h3>
              <p className="text-sm text-gray-500">Por favor, verifique se os dados apresentados correspondem ao condômino físico.</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-sm">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs text-gray-500 uppercase font-black">Unidade / Fração</span>
                <span className="font-bold text-slate-800">{selectedResident.unit}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs text-gray-500 uppercase font-black">Nome Completo</span>
                <span className="font-bold text-slate-800 text-right">{selectedResident.name}</span>
              </div>
              <div className="flex justify-between items-center transition-all">
                <span className="text-xs text-gray-500 uppercase font-black">Documento (CPF)</span>
                <span className="font-mono text-slate-800 font-bold">{maskCpf(selectedResident.cpf) || "Não Informado"}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <Button onClick={handleConfirmResident} className="flex-1 bg-green-600 hover:bg-green-700 text-white h-12 text-md">
                Sim, Sou Eu / É este
              </Button>
              <Button onClick={handleReset} variant="outline" className="flex-1 border-slate-200 text-slate-600 h-12 text-md">
                Não, Voltar
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2.5: PROXY_OPTION */}
        {step === 'PROXY_OPTION' && selectedResident && (
          <div className="max-w-xl mx-auto w-full space-y-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 animate-in fade-in-50 duration-200">
            <div className="text-center space-y-2">
              <div className="bg-amber-50 p-3 rounded-full inline-flex text-amber-600">
                <ShieldAlert size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Atenção: Procurações Detectadas</h3>
              <p className="text-sm text-gray-500">
                O condômino <strong>{selectedResident.name}</strong> (Unidade {selectedResident.unit}) possui procurações registradas no sistema.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-sm">
              <div className="flex justify-between items-start border-b pb-2">
                <span className="text-xs text-gray-500 uppercase font-black">Unidade Principal</span>
                <span className="font-bold text-slate-800">Unidade {selectedResident.unit}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 uppercase font-black">Unidades Representadas por Procuração</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {selectedResident.proxyUnits?.split(',').map(u => u.trim()).filter(u => u).map((unit, idx) => (
                    <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      Unidade {unit}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600 font-medium text-center">Como deseja prosseguir com a votação na Urna?</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleSelectProxyMode('UNIFIED')}
                  className="p-5 rounded-xl border-2 border-slate-200 hover:border-red-600 bg-white hover:bg-red-50/10 text-left transition-all duration-200 flex flex-col justify-between h-full group"
                >
                  <div>
                    <h4 className="font-black text-gray-900 group-hover:text-red-950 text-base">Voto Unificado (Todas)</h4>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      O eleitor votará uma única vez. A opção selecionada será replicada automaticamente para <strong>todas as {1 + (selectedResident.proxyUnits?.split(',').map(u => u.trim()).filter(u => u).length || 0)} unidades</strong> representadas.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-red-600 mt-4 inline-block group-hover:underline">Votar Unificado →</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectProxyMode('DISTINCT')}
                  className="p-5 rounded-xl border-2 border-slate-200 hover:border-blue-600 bg-white hover:bg-blue-50/10 text-left transition-all duration-200 flex flex-col justify-between h-full group"
                >
                  <div>
                    <h4 className="font-black text-gray-900 group-hover:text-blue-950 text-base">Voto Distinto (Individual)</h4>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      A urna passará de forma sequencial por cada unidade representada para que o eleitor possa registrar votos <strong>separados ou independentes</strong>.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-blue-600 mt-4 inline-block group-hover:underline">Votar Individualmente →</span>
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-center">
              <Button onClick={handleReset} variant="ghost" className="text-gray-500 hover:text-black">
                Cancelar e Voltar
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: VOTE_POLLS */}
        {step === 'VOTE_POLLS' && selectedResident && selectedPoll && (
          <div className="max-w-2xl mx-auto w-full space-y-6 animate-in fade-in-50 duration-200">
            <div className="bg-slate-900 text-white p-5 rounded-2xl flex justify-between items-center shadow-lg border border-slate-800">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-red-400">
                  {votingMode === 'UNIFIED' 
                    ? "Votação Unificada (Todas as Unidades)" 
                    : `Registrando Voto Individual: Unidade ${currentVotingUnit}`
                  }
                </p>
                <h4 className="font-black text-xl">
                  {votingMode === 'UNIFIED' 
                    ? `Unidades: ${[selectedResident.unit, ...(selectedResident.proxyUnits?.split(',').map(u => u.trim()).filter(u => u) || [])].join(', ')}`
                    : `Unidade ${currentVotingUnit}`
                  }
                </h4>
                <p className="text-xs text-slate-400">
                  Eleitor: {selectedResident.name} {currentVotingUnit !== selectedResident.unit && `(Representando Unidade ${currentVotingUnit})`}
                </p>
              </div>
              {votingMode === 'DISTINCT' && (
                <div className="text-right">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Faltam {remainingUnitsToVote.length} unidade(s)
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <span className="text-xs text-slate-500 uppercase font-black tracking-widest block">Pauta em Votação</span>
              <h3 className="text-2xl font-black text-gray-900">{selectedPoll.title}</h3>
              <p className="text-sm text-gray-600">{selectedPoll.description}</p>
            </div>

            {/* Simulated Urn Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedPoll.options.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedOptionId(opt.id)}
                  className={`p-5 rounded-2xl border-2 text-left transition-all duration-200 ${
                    selectedOptionId === opt.id
                      ? 'border-red-600 bg-red-50 text-red-900 shadow-md ring-2 ring-red-300'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedOptionId === opt.id ? 'border-red-600 bg-red-600' : 'border-slate-300'}`}>
                      {selectedOptionId === opt.id && <div className="w-2 h-2 rounded-full bg-white"></div>}
                    </div>
                    <span className="font-extrabold text-lg">{opt.text}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Ballot Keyboard (Stylized) */}
            <div className="pt-6 border-t border-slate-100 flex gap-4">
              <Button 
                onClick={handleVoteSubmitClick} 
                disabled={!selectedOptionId}
                className="flex-1 bg-[#15803d] hover:bg-[#166534] text-white py-4 text-lg font-black tracking-wider flex items-center justify-center gap-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow"
              >
                CONFIRMA
              </Button>
              <Button 
                onClick={() => setSelectedOptionId('')} 
                disabled={!selectedOptionId}
                className="bg-[#d97706] hover:bg-[#b45309] text-white px-6 font-bold uppercase py-4 rounded-xl disabled:opacity-50"
              >
                CORRIGE
              </Button>
              <Button 
                onClick={handleReset} 
                variant="outline"
                className="border-slate-200 text-slate-600 px-6 font-bold uppercase rounded-xl"
              >
                Sair
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: SUCCESS */}
        {step === 'SUCCESS' && (
          <div className="text-center space-y-6 max-w-md mx-auto py-12">
            <div className="text-green-600 bg-green-50 p-6 rounded-full inline-flex animate-bounce">
              <CheckCircle2 size={64} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900">Voto Confirmado!</h3>
              <p className="text-sm text-slate-500">O voto foi transmitido e armazenado com sucesso no ecossistema oficial da assembleia.</p>
            </div>

            {!isStandalone ? (
              <Button onClick={onBack} size="lg" className="w-full bg-slate-900 text-white hover:bg-slate-850">
                Voltar aos Enquetes
              </Button>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-400">Esta tela reiniciará automaticamente em alguns segundos para o próximo eleitor...</p>
                <Button onClick={handleReset} variant="outline" className="w-full">
                  Próxima Votação (Iniciar Agora)
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Instructions / Standalone layout helper */}
      <div className="mt-8 border-t pt-4 text-xs text-gray-400 flex justify-between items-center border-gray-150">
        <span>Zip Consultoria de Voto & Condomínios © 2026</span>
        <span>Modo: {isStandalone ? "Cabine Eletrônica Segura" : "Registrador Manual"}</span>
      </div>
    </Card>
  );
};
