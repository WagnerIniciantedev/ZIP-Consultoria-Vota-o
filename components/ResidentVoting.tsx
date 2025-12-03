
import React, { useState, useEffect } from 'react';
import { Button, Input, Card, Badge } from './ui';
import { Resident, Poll } from '../types';
import { Vote, CheckCircle, UserCheck, Lock, ArrowLeft, ChevronRight, Video, Clock, Building, Users, LayoutDashboard, AlertCircle, RefreshCw } from 'lucide-react';

interface ResidentVotingProps {
  residents: Resident[];
  polls: Poll[];
  onVoteSubmit: (pollId: string, unit: string, optionId: string, isDelinquent: boolean) => void;
  onRegisterAttendance: (unit: string, zoomName: string) => void;
  hasVoted: (pollId: string, unit: string) => boolean;
  onBack: () => void;
  isAdmin?: boolean;
}

// Internal State for Navigation
enum VoteStep {
  IDENTIFY = 'IDENTIFY',
  MULTI_UNIT_SELECT = 'MULTI_UNIT_SELECT',
  DASHBOARD = 'DASHBOARD',
  ZOOM_CHECKIN = 'ZOOM_CHECKIN',
  WAITING_ROOM = 'WAITING_ROOM',
  LIST = 'LIST',
  BOOTH = 'BOOTH',
  SUCCESS = 'SUCCESS'
}

export const ResidentVoting: React.FC<ResidentVotingProps> = ({ 
  residents, 
  polls, 
  onVoteSubmit, 
  onRegisterAttendance,
  hasVoted, 
  onBack, 
  isAdmin = false 
}) => {
  const [step, setStep] = useState<VoteStep>(VoteStep.IDENTIFY);
  
  // Login Inputs
  const [unitInput, setUnitInput] = useState('');
  const [cpfInput, setCpfInput] = useState('');
  
  // Multi Unit State
  const [multiUnitCandidates, setMultiUnitCandidates] = useState<Resident[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<Resident[]>([]); // The units the user is currently representing

  // Zoom Input
  const [zoomNameInput, setZoomNameInput] = useState('');

  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Filter Active Polls
  const activePolls = polls.filter(p => p.isActive);

  // Helper status checks
  const allApproved = selectedUnits.length > 0 && selectedUnits.every(u => u.attendanceStatus === 'APPROVED');
  const allPending = selectedUnits.length > 0 && selectedUnits.every(u => u.attendanceStatus === 'PENDING');
  
  // --- Effects ---

  // Refreshes data if admin approves in background
  useEffect(() => {
    if (selectedUnits.length > 0) {
      // Re-fetch the latest data for these units
      const updatedUnits = selectedUnits.map(selected => {
          const found = residents.find(r => r.unit === selected.unit);
          return found || selected;
      });
      
      // Check if we need to update state
      const hasChanged = JSON.stringify(updatedUnits) !== JSON.stringify(selectedUnits);
      if (hasChanged) {
          setSelectedUnits(updatedUnits);
      }

      // Check attendance status for all selected units
      const anyBlocked = updatedUnits.some(u => u.attendanceStatus === 'BLOCKED');
      
      if (anyBlocked) {
         alert("O acesso de uma ou mais unidades foi bloqueado.");
         setStep(VoteStep.IDENTIFY);
         setSelectedUnits([]);
         return;
      }
    }
  }, [residents, step]);

  const handleIdentify = () => {
    if (residents.length === 0) {
        alert("A lista de moradores ainda não foi carregada pelo administrador. Aguarde um momento e tente novamente.");
        return;
    }

    const targetUnit = unitInput.toLowerCase().trim();
    const targetCpfClean = cpfInput.replace(/\D/g, '');

    if (!targetUnit) {
        alert("Por favor, digite o número da Unidade.");
        return;
    }

    // 1. Find the specific unit requested
    const resident = residents.find(r => r.unit.toLowerCase() === targetUnit);

    if (resident) {
      // 2. Validate CPF (Only if CPF exists in Excel)
      if (resident.cpf) {
         const recordCpfClean = resident.cpf.replace(/\D/g, '');
         // Check matches start
         if (!targetCpfClean || !recordCpfClean.startsWith(targetCpfClean)) {
             alert("Os dados de CPF não conferem com a unidade informada.");
             return;
         }
         if (targetCpfClean.length < 5) {
             alert("Digite pelo menos os 5 primeiros dígitos do CPF.");
             return;
         }
      } else {
         // Fallback if Excel has no CPF: Warning or allow just Unit?
         // Assuming we strictly need CPF if configured, but for flexibility:
         if (cpfInput.length > 0 && cpfInput.length < 3) {
             alert("Por favor, confirme os dados.");
             return;
         }
      }

      // 3. Check for Multi-Unit Ownership (same CPF)
      // Only do this if we have a valid CPF to search by from the record found
      if (resident.cpf) {
          const cleanRecordCpf = resident.cpf.replace(/\D/g, '');
          const siblings = residents.filter(r => r.cpf && r.cpf.replace(/\D/g, '') === cleanRecordCpf);
          
          if (siblings.length > 1) {
              setMultiUnitCandidates(siblings);
              setStep(VoteStep.MULTI_UNIT_SELECT);
              return;
          }
      }

      // If single unit, proceed
      proceedWithUnits([resident]);

    } else {
      alert("Unidade não encontrada na lista de votação.\n\nVerifique se digitou corretamente ou contate o administrador.");
    }
  };

  const handleMultiUnitSelection = (units: Resident[]) => {
      proceedWithUnits(units);
  };

  const proceedWithUnits = (units: Resident[]) => {
      setSelectedUnits(units);
      
      // Direct flow: Identify -> Zoom Checkin -> Waiting Room
      // Check if already approved or pending to route correctly
      const isApproved = units.every(u => u.attendanceStatus === 'APPROVED');
      const isPending = units.every(u => u.attendanceStatus === 'PENDING');

      if (isApproved) {
          setStep(VoteStep.DASHBOARD);
      } else if (isPending) {
          setStep(VoteStep.WAITING_ROOM);
      } else {
          setStep(VoteStep.ZOOM_CHECKIN);
      }
  };

  // --- Dashboard Logic ---

  const handleGoToAttendance = () => {
      if (allApproved) {
          alert("Você já está aprovado e presente na assembleia.");
          return;
      }
      if (allPending) {
          setStep(VoteStep.WAITING_ROOM);
          return;
      }
      // If not registered or mixed status
      setStep(VoteStep.ZOOM_CHECKIN);
  };

  const handleGoToVoting = () => {
      // 1. Check Approval
      if (!allApproved) {
          alert("Atenção: Você precisa aguardar a aprovação do administrador na Sala de Espera antes de votar.");
          return;
      }

      // 2. Check Active Polls
      if (activePolls.length === 0) {
          alert("Nenhuma votação foi iniciada pelo administrador no momento. Aguarde.");
          return;
      }

      setStep(VoteStep.LIST);
  };


  const handleZoomSubmit = () => {
      if(!zoomNameInput.trim()) {
          alert("Por favor, informe seu nome no Zoom/Reunião para que o Admin te identifique.");
          return;
      }
      
      // Register for ALL selected units
      selectedUnits.forEach(u => {
          onRegisterAttendance(u.unit, zoomNameInput);
      });
      
      setStep(VoteStep.WAITING_ROOM);
  };

  const handleSelectPoll = (poll: Poll) => {
    // Check if ALL selected units have voted
    const allVoted = selectedUnits.every(u => hasVoted(poll.id, u.unit));
    
    if (allVoted) {
      alert("Todas as suas unidades já votaram nesta enquete.");
      return;
    }
    
    setSelectedPoll(poll);
    setStep(VoteStep.BOOTH);
  };

  const submitVote = () => {
    if (selectedOption && selectedUnits.length > 0 && selectedPoll) {
      
      let voteCount = 0;
      selectedUnits.forEach(u => {
          // Only cast vote if this specific unit hasn't voted yet
          if (!hasVoted(selectedPoll.id, u.unit)) {
             onVoteSubmit(selectedPoll.id, u.unit, selectedOption, u.isDelinquent);
             voteCount++;
          }
      });

      if (voteCount > 0) {
          setStep(VoteStep.SUCCESS);
      } else {
          alert("Erro: Votos já registrados anteriormente.");
          setStep(VoteStep.LIST);
      }
    }
  };

  const handleFinishSuccess = () => {
    setStep(VoteStep.LIST);
    setSelectedPoll(null);
    setSelectedOption(null);
  };

  // --- Render Steps ---

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        
        {/* Step 1: Identification */}
        {step === VoteStep.IDENTIFY && (
          <Card title="Acesso ao Sistema">
            <div className="space-y-4">
              <p className="text-gray-600 text-sm">Identifique-se com sua Unidade e CPF para entrar.</p>
              
              {residents.length === 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-xs text-yellow-800 flex items-center gap-2 animate-pulse">
                      <RefreshCw className="animate-spin" size={14} />
                      Aguardando lista de moradores...
                  </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidade / Apartamento</label>
                <Input 
                  placeholder="Ex: 101" 
                  value={unitInput}
                  onChange={(e) => setUnitInput(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF (5 primeiros dígitos)</label>
                <Input 
                  placeholder="Ex: 12345" 
                  value={cpfInput}
                  onChange={(e) => setCpfInput(e.target.value)}
                  maxLength={11}
                  type="tel"
                  onKeyDown={(e) => e.key === 'Enter' && handleIdentify()}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={onBack} className="flex-1">
                  Voltar
                </Button>
                <Button onClick={handleIdentify} className="flex-[2]" disabled={residents.length === 0}>
                  {residents.length === 0 ? "Carregando..." : "Entrar"}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 1.5: Multi-Unit Selection */}
        {step === VoteStep.MULTI_UNIT_SELECT && (
             <Card title="Múltiplas Unidades">
                 <div className="space-y-4">
                     <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-start gap-3">
                        <Users className="text-blue-600 mt-1 flex-shrink-0" />
                        <p className="text-sm text-blue-800">
                            Identificamos <strong>{multiUnitCandidates.length} unidades</strong> vinculadas ao seu CPF.
                        </p>
                     </div>

                     <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-2">
                         {multiUnitCandidates.map(u => (
                             <div key={u.unit} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                                 <Building size={16} className="text-gray-400" />
                                 <span className="font-bold text-gray-700">{u.unit}</span>
                                 <span className="text-sm text-gray-500">- {u.name}</span>
                             </div>
                         ))}
                     </div>

                     <div className="flex flex-col gap-3 mt-4">
                         <Button onClick={() => handleMultiUnitSelection(multiUnitCandidates)}>
                            Entrar com TODAS as unidades
                         </Button>
                         <Button variant="outline" onClick={() => handleMultiUnitSelection([multiUnitCandidates.find(u => u.unit.toLowerCase() === unitInput.toLowerCase().trim())!])}>
                            Apenas a unidade {unitInput}
                         </Button>
                     </div>
                 </div>
             </Card>
        )}

        {/* Step 3: Zoom Check-in */}
        {step === VoteStep.ZOOM_CHECKIN && selectedUnits.length > 0 && (
           <Card>
              <Button variant="outline" className="mb-4 text-xs flex items-center gap-1" onClick={() => setStep(VoteStep.IDENTIFY)}>
                  <ArrowLeft size={12} /> Voltar
              </Button>
              <div className="text-center space-y-4">
                  <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center">
                    <Video className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">Identificação para Sala</h2>
                  <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                      <p>Proprietário Identificado:</p>
                      <strong>{selectedUnits[0].name}</strong>
                      <p className="mt-1">Unidade(s): {selectedUnits.map(u => u.unit).join(', ')}</p>
                  </div>
                  
                  <div className="text-left p-4 rounded-lg border border-blue-100 bg-blue-50/50">
                     <label className="block text-sm font-bold text-gray-800 mb-2">Qual seu nome no Zoom/Reunião?</label>
                     <Input 
                        placeholder="Ex: João Silva - 101"
                        value={zoomNameInput}
                        onChange={(e) => setZoomNameInput(e.target.value)}
                        autoFocus
                     />
                     <p className="text-xs text-gray-500 mt-2">
                        O admin usará este nome para aprovar sua entrada.
                     </p>
                  </div>

                  <Button onClick={handleZoomSubmit} className="w-full">
                     Confirmar Presença
                  </Button>
              </div>
           </Card>
        )}

        {/* Step 4: Waiting Room */}
        {step === VoteStep.WAITING_ROOM && selectedUnits.length > 0 && (
            <Card>
                <div className="text-center py-8">
                    <div className="animate-pulse mx-auto bg-yellow-100 w-20 h-20 rounded-full flex items-center justify-center mb-6">
                        <Clock className="h-10 w-10 text-yellow-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Aguardando Aprovação</h2>
                    <p className="text-gray-500 mb-6 px-4">
                        Sua presença para <strong>{selectedUnits.map(u => u.unit).join(', ')}</strong> foi registrada na Sala de Espera.
                    </p>
                    <div className="bg-gray-50 p-3 rounded text-sm text-gray-600 inline-block mb-6">
                        Status: <span className="font-bold text-yellow-600">PENDENTE</span>
                    </div>
                    <p className="text-xs text-gray-400">
                        Assim que o administrador aprovar, você será liberado para votar automaticamente.
                    </p>
                    <div className="mt-8">
                        {/* Option to go back to identify if stuck or wrong unit */}
                        <button 
                            onClick={() => setStep(VoteStep.IDENTIFY)} 
                            className="text-xs text-red-400 underline"
                        >
                            Entrei com a unidade errada? Sair
                        </button>
                    </div>
                </div>
            </Card>
        )}

        {/* Step 2: DASHBOARD (Menu) */}
        {step === VoteStep.DASHBOARD && selectedUnits.length > 0 && (
          <Card>
            <div className="space-y-6">
               <div className="flex justify-between items-center border-b pb-4">
                 <div>
                   <h2 className="text-lg font-bold text-gray-900">Olá, {selectedUnits[0].name.split(' ')[0]}</h2>
                   <p className="text-sm text-gray-500">Unidades: {selectedUnits.map(u => u.unit).join(', ')}</p>
                 </div>
                 <Button variant="outline" size="sm" onClick={onBack} className="h-8 text-xs">Sair</Button>
               </div>
               
               <div className="flex justify-center">
                   <Badge color="green">Presença Confirmada</Badge>
               </div>

               <div className="grid grid-cols-1 gap-4">
                 <button 
                   onClick={handleGoToVoting}
                   className="flex items-start gap-4 p-4 border rounded-xl text-left transition-all hover:bg-red-50 hover:border-red-200 border-gray-200 group bg-white shadow-sm"
                 >
                    <div className="p-3 rounded-full bg-red-100 text-red-600">
                      <Vote size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 group-hover:text-red-700">Votação / Enquetes</h3>
                      <p className="text-sm text-gray-500 mt-1">
                          {activePolls.length > 0 
                            ? `${activePolls.length} votação(ões) ativa(s). Clique para votar.` 
                            : "Aguardando início da votação..."}
                      </p>
                    </div>
                 </button>
                 
                 <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                    <UserCheck className="text-green-600" size={20} />
                    <div className="text-sm text-gray-600">
                        Você está registrado como: <strong>{selectedUnits[0].zoomName}</strong>
                    </div>
                 </div>
               </div>
            </div>
          </Card>
        )}

        {/* Step 5: List Active Polls */}
        {step === VoteStep.LIST && selectedUnits.length > 0 && (
           <Card title="Votações Disponíveis">
             <div className="space-y-4">
                <Button variant="outline" className="mb-2 text-xs flex items-center gap-1" onClick={() => setStep(VoteStep.DASHBOARD)}>
                  <ArrowLeft size={12} /> Voltar ao Menu
                </Button>
                
                {activePolls.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
                    <Vote className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                    Nenhuma votação ativa no momento.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activePolls.map(poll => {
                      const allVoted = selectedUnits.every(u => hasVoted(poll.id, u.unit));
                      
                      return (
                        <div 
                          key={poll.id} 
                          onClick={() => !allVoted && handleSelectPoll(poll)}
                          className={`border rounded-lg p-4 transition-all relative overflow-hidden ${
                            allVoted 
                            ? 'bg-gray-50 border-gray-200 cursor-default opacity-80' 
                            : 'bg-white border-red-100 hover:border-red-400 hover:shadow-sm cursor-pointer'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <h3 className="font-bold text-gray-900 pr-8">{poll.title}</h3>
                            {allVoted && <CheckCircle className="text-green-500 h-5 w-5" />}
                          </div>
                          {poll.description && <p className="text-sm text-gray-500 line-clamp-2 mb-2">{poll.description}</p>}
                          
                          <div className="flex justify-end mt-2">
                             {allVoted ? (
                               <Badge color="green">Votos Registrados</Badge>
                             ) : (
                               <span className="text-red-600 text-sm font-medium flex items-center">
                                 Votar Agora <ChevronRight size={16} />
                               </span>
                             )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
             </div>
           </Card>
        )}

        {/* Step 6: Voting Booth */}
        {step === VoteStep.BOOTH && selectedUnits.length > 0 && selectedPoll && (
          <Card title="Cédula de Votação">
            <div className="space-y-6">
              <div>
                <Button variant="outline" className="mb-4 text-xs flex items-center gap-1" onClick={() => setStep(VoteStep.LIST)}>
                  <ArrowLeft size={12} /> Voltar para Lista
                </Button>
                <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedPoll.title}</h2>
                <div className="bg-red-50 text-red-800 text-sm p-2 rounded mb-2">
                    Votando por: <strong>{selectedUnits.filter(u => !hasVoted(selectedPoll.id, u.unit)).map(u => u.unit).join(', ')}</strong>
                </div>
                {selectedPoll.description && <p className="text-gray-500 text-sm">{selectedPoll.description}</p>}
              </div>

              <div className="space-y-3">
                {selectedPoll.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedOption(opt.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedOption === opt.id 
                        ? 'border-red-600 bg-red-50 text-red-800' 
                        : 'border-gray-200 bg-white hover:border-red-300 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 ${
                         selectedOption === opt.id ? 'border-red-600' : 'border-gray-400'
                      }`}>
                        {selectedOption === opt.id && <div className="w-3 h-3 rounded-full bg-red-600" />}
                      </div>
                      <span className="font-medium">{opt.text}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep(VoteStep.LIST)} className="flex-1">
                  Cancelar
                </Button>
                <Button 
                  onClick={submitVote} 
                  className="flex-[2]" 
                  disabled={!selectedOption}
                >
                  Confirmar Voto(s)
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 7: Success */}
        {step === VoteStep.SUCCESS && selectedUnits.length > 0 && (
          <Card>
            <div className="text-center py-6">
               <div className="mx-auto bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                 <CheckCircle className="h-8 w-8 text-green-600" />
               </div>
               <h2 className="text-2xl font-bold text-gray-900 mb-2">Voto(s) Registrado(s)!</h2>
               <p className="text-gray-500 mb-6">Obrigado por participar.</p>

               <div className="flex flex-col gap-3">
                 <Button onClick={handleFinishSuccess}>
                   Voltar para Lista de Votações
                 </Button>
                 <Button variant="outline" onClick={() => setStep(VoteStep.DASHBOARD)}>
                   <LayoutDashboard size={16} className="mr-2" /> Voltar ao Menu Principal
                 </Button>
               </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
