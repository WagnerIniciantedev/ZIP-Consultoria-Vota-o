
import React, { useState } from 'react';
import { Poll, VoteRecord, Resident, PollCalculationType, User, AssemblyType } from '../../types';
import { Button, Card, Badge, Input } from '../ui';
import { exportVotesToCSV, addLog, savePolls } from '../../services/dataService';
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowLeft, PlayCircle, PauseCircle, StopCircle, Download, Eye, EyeOff, Plus } from 'lucide-react';

interface ResultsPanelProps {
  poll: Poll;
  votes: VoteRecord[];
  residents: Resident[];
  onBack: () => void;
  onTogglePoll: (id: string) => void;
  onEndPoll: (id: string) => void;
  currentUser: User | null;
  assemblyType: AssemblyType | null;
  setPolls: React.Dispatch<React.SetStateAction<Poll[]>>;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ 
  poll, 
  votes, 
  residents, 
  onBack, 
  onTogglePoll, 
  onEndPoll,
  currentUser,
  assemblyType,
  setPolls
}) => {
  const [showDelinquentVotes, setShowDelinquentVotes] = useState(false);
  const [isConfirmingEnd, setIsConfirmingEnd] = useState(false);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});

  // --- DATA CALCULATION ---
  const pollVotes = votes.filter(v => v.pollId === poll.id);
  const validVotes = pollVotes.filter(v => !v.isDelinquentVote);
  const delinquentVotes = pollVotes.filter(v => v.isDelinquentVote);

  const dataMap = new Map<string, number>();
  poll.options.forEach(opt => dataMap.set(opt.id, 0));
  
  let totalWeight = 0;

  validVotes.forEach(v => {
    const resident = residents.find(r => r.unit === v.unit);
    let weight = 1;

    if (resident) {
      if (poll.calculationType === PollCalculationType.FRACTION) {
        weight = resident.fraction || 0;
      } else if (poll.calculationType === PollCalculationType.HABITE_SE) {
        weight = 1 + (resident.hasHabiteSe ? 1 : 0);
      }
      
      // Add proxy count to weight
      if (resident.proxyCount && resident.proxyCount > 0) {
        weight += resident.proxyCount;
      }
    }

    const current = dataMap.get(v.optionId) || 0;
    dataMap.set(v.optionId, current + weight);
    totalWeight += weight;
  });

  // Add manual votes if any
  if (poll.manualVotes) {
    Object.entries(poll.manualVotes).forEach(([optId, count]) => {
      const current = dataMap.get(optId) || 0;
      dataMap.set(optId, current + count);
      totalWeight += count;
    });
  }

  const chartData = poll.options.map(opt => {
    const val = dataMap.get(opt.id) || 0;
    return {
      name: opt.text,
      votos: Number(val.toFixed(4)), 
      percent: totalWeight > 0 ? ((val / totalWeight) * 100).toFixed(1) : 0
    };
  });

  const COLORS = ['#DC2626', '#EA580C', '#D97706', '#65A30D', '#059669', '#2563EB', '#7C3AED', '#DB2777'];

  const getCalculationLabel = (type: PollCalculationType) => {
    switch (type) {
      case PollCalculationType.FRACTION: return "Fração Ideal";
      case PollCalculationType.HABITE_SE: return "Condomínio Habite-se";
      default: return "Voto Unitário (Normal)";
    }
  };

  const handleExport = () => {
    exportVotesToCSV(votes, residents, poll);
  };

  const handleClickToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    onTogglePoll(poll.id);
    if (currentUser) {
      addLog(currentUser, poll.isActive ? 'PAUSAR_ENQUETE' : 'ATIVAR_ENQUETE', `Alterou status da enquete: ${poll.title}`);
    }
  };

  const handleConfirmEnd = (e: React.MouseEvent) => {
      e.preventDefault();
      onEndPoll(poll.id);
      setIsConfirmingEnd(false);
      if (currentUser) {
        addLog(currentUser, 'ENCERRAR_ENQUETE', `Encerrou a enquete: ${poll.title}`);
      }
  }

  const handleSaveManualVotes = () => {
    const newManualVotes: Record<string, number> = {};
    Object.entries(manualInputs).forEach(([id, val]) => {
      const num = parseFloat(val.replace(',', '.'));
      if (!isNaN(num) && num > 0) {
        newManualVotes[id] = num;
      }
    });

    setPolls(prev => {
      const updated = prev.map(p => p.id === poll.id ? { ...p, manualVotes: newManualVotes } : p);
      savePolls(updated);
      return updated;
    });

    setIsAddingManual(false);
    if (currentUser) {
      addLog(currentUser, 'VOTOS_MANUAIS', `Atualizou votos presenciais para: ${poll.title}`);
    }
  };

  const startManualEdit = () => {
    const initial: Record<string, string> = {};
    poll.options.forEach(opt => {
      initial[opt.id] = poll.manualVotes?.[opt.id]?.toString() || '';
    });
    setManualInputs(initial);
    setIsAddingManual(true);
  };

  const handleClickEnd = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsConfirmingEnd(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft size={16} /> Voltar para Lista
        </Button>
        <h2 className="text-xl font-bold text-gray-900">Resultados: {poll.title}</h2>
      </div>

      <Card title="Status da Votação">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
           <div>
             <div className="flex items-center gap-2">
               <p className="text-sm text-gray-500">{poll.description}</p>
               <Badge color="gray">{getCalculationLabel(poll.calculationType)}</Badge>
             </div>
             <div className="mt-2">
                 {poll.isActive ? <Badge color="green">Votação Ativa</Badge> : 
                 poll.isEnded ? <Badge color="red">Encerrada</Badge> : <Badge color="yellow">Pausada / Rascunho</Badge>}
             </div>
           </div>
           <div className="flex gap-3">
             {!poll.isEnded && (
               <>
                 <Button 
                   onClick={handleClickToggle} 
                   variant={poll.isActive ? "outline" : "primary"}
                   className="flex items-center gap-2"
                 >
                   {poll.isActive ? (
                     <><PauseCircle size={18} /> Pausar</>
                   ) : (
                     <><PlayCircle size={18} /> Ativar Votação</>
                   )}
                 </Button>

                 {isConfirmingEnd ? (
                     <div className="flex items-center bg-red-50 rounded p-1 border border-red-200 animate-in fade-in zoom-in">
                         <span className="text-xs text-red-700 font-bold mr-2 ml-1">Confirmar?</span>
                         <Button onClick={handleConfirmEnd} className="h-9 px-3 bg-red-600 hover:bg-red-700 text-white text-xs mr-2">Sim</Button>
                         <Button onClick={() => setIsConfirmingEnd(false)} variant="outline" className="h-9 px-3 text-xs">Não</Button>
                     </div>
                 ) : (
                    <Button 
                      type="button"
                      onClick={handleClickEnd} 
                      variant="danger"
                      className="flex items-center gap-2"
                    >
                      <StopCircle size={18} /> Encerrar Enquete
                    </Button>
                 )}
               </>
             )}
             <Button onClick={handleExport} variant="outline" className="flex items-center gap-2">
               <Download size={18} /> Exportar Excel
             </Button>
             {assemblyType === AssemblyType.HYBRID && (
               <Button onClick={startManualEdit} variant="primary" className="flex items-center gap-2">
                 <Plus size={18} /> Votos Presenciais
               </Button>
             )}
           </div>
         </div>
       </Card>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <Card title="Resultado Oficial">
           <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={chartData}
                     cx="50%"
                     cy="50%"
                     labelLine={false}
                     outerRadius={90}
                     fill="#8884d8"
                     dataKey="votos"
                     nameKey="name"
                   >
                     {chartData.map((_entry, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip formatter={(value: number) => [value, 'Votos/Pontos']} />
                 </PieChart>
               </ResponsiveContainer>
           </div>
           <div className="mt-4 grid grid-cols-2 gap-4">
               {chartData.map((d, i) => (
                 <div key={i} className="bg-gray-50 p-3 rounded text-center relative border border-transparent hover:border-gray-200 transition-colors">
                   <div 
                     className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 rounded-full" 
                     style={{ backgroundColor: COLORS[i % COLORS.length] }}
                   ></div>
                   <div className="text-sm font-medium text-gray-600 truncate pl-4">{d.name}</div>
                   <div className="text-xl font-bold text-gray-900">{d.percent}%</div>
                   <div className="text-xs text-gray-500">{d.votos} {poll.calculationType === PollCalculationType.FRACTION ? 'pontos' : 'votos'}</div>
                 </div>
               ))}
           </div>
           <div className="mt-4 text-center text-sm text-gray-500 pt-4 border-t">
             Total {poll.calculationType === PollCalculationType.FRACTION ? 'Pontos' : 'Votos'} Válidos: <strong>{Number(totalWeight.toFixed(4))}</strong>
           </div>
         </Card>

         <Card title="Painel de Auditoria">
             <div className="flex justify-between items-center mb-4">
               <span className="text-sm text-gray-600">Votos Inadimplentes (Não Contabilizados)</span>
               <button 
                 type="button"
                 onClick={() => setShowDelinquentVotes(!showDelinquentVotes)}
                 className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
               >
                 {showDelinquentVotes ? <EyeOff size={16}/> : <Eye size={16} />} 
                 {showDelinquentVotes ? 'Ocultar' : 'Exibir'}
               </button>
             </div>
             
             <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4 text-center">
               <span className="block text-2xl font-bold text-gray-700">{delinquentVotes.length}</span>
               <span className="text-xs text-gray-500 uppercase font-semibold">Votos Bloqueados</span>
             </div>

             {showDelinquentVotes && (
               <div className="max-h-64 overflow-y-auto border rounded bg-white text-sm">
                 <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-gray-50 sticky top-0">
                     <tr>
                       <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Unidade</th>
                       <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Opção</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-200">
                     {delinquentVotes.map((v, idx) => {
                       const opt = poll.options.find(o => o.id === v.optionId);
                       return (
                         <tr key={idx}>
                           <td className="px-3 py-2">{v.unit}</td>
                           <td className="px-3 py-2">{opt?.text}</td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
             )}
         </Card>
       </div>

       {isAddingManual && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Adicionar Votos Presenciais</h3>
            <p className="text-sm text-gray-500 mb-6">
              Insira a quantidade de votos (ou peso) coletados manualmente no presencial para cada opção.
            </p>
            
            <div className="space-y-4 mb-6">
              {poll.options.map(opt => (
                <div key={opt.id} className="flex items-center justify-between gap-4">
                  <label className="text-sm font-medium text-gray-700 truncate flex-1">
                    {opt.text}
                  </label>
                  <div className="w-32">
                    <Input
                      type="text"
                      placeholder="0.0000"
                      value={manualInputs[opt.id] || ''}
                      onChange={(e) => setManualInputs(prev => ({ ...prev, [opt.id]: e.target.value }))}
                      className="text-right"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsAddingManual(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveManualVotes}>
                Salvar Votos
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card title="Lista de Votantes (Tempo Real)">
          <div className="max-h-96 overflow-y-auto border rounded bg-white text-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Unidade</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Morador</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nome Zoom</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Opção Escolhida</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  {poll.calculationType !== PollCalculationType.NORMAL && (
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Peso</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pollVotes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 italic">
                      Nenhum voto registrado para esta enquete ainda.
                    </td>
                  </tr>
                ) : (
                  [...pollVotes].sort((a, b) => a.unit.localeCompare(b.unit)).map((v, idx) => {
                    const resident = residents.find(r => r.unit === v.unit);
                    const opt = poll.options.find(o => o.id === v.optionId);
                    
                    let weight = 1;
                    if (resident && !v.isDelinquentVote) {
                      if (poll.calculationType === PollCalculationType.FRACTION) {
                        weight = resident.fraction || 0;
                      } else if (poll.calculationType === PollCalculationType.HABITE_SE) {
                        weight = 1 + (resident.hasHabiteSe ? 1 : 0);
                      }
                    } else if (v.isDelinquentVote) {
                      weight = 0;
                    }

                    return (
                      <tr key={idx} className={v.isDelinquentVote ? "bg-red-50" : ""}>
                        <td className="px-4 py-3 font-bold text-gray-900">{v.unit}</td>
                        <td className="px-4 py-3 text-gray-600">{resident?.name || 'N/A'}</td>
                        <td className="px-4 py-3 text-gray-600 italic">{v.zoomName || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${v.isDelinquentVote ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-800'}`}>
                            {opt?.text || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {v.isDelinquentVote ? (
                            <Badge color="red">Inadimplente</Badge>
                          ) : (
                            <Badge color="green">Válido</Badge>
                          )}
                        </td>
                        {poll.calculationType !== PollCalculationType.NORMAL && (
                          <td className="px-4 py-3 font-mono text-xs">
                            {weight.toFixed(4)}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-xs text-gray-500 italic">
            * Esta lista é atualizada em tempo real conforme os condôminos confirmam seus votos.
          </div>
        </Card>
    </div>
  );
};
