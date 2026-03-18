
import React, { useState } from 'react';
import { Poll, VoteRecord, Resident, PollCalculationType, User } from '../../types';
import { Button, Card, Badge } from '../ui';
import { exportVotesToCSV, addLog } from '../../services/dataService';
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowLeft, PlayCircle, PauseCircle, StopCircle, Download, Eye, EyeOff } from 'lucide-react';

interface ResultsPanelProps {
  poll: Poll;
  votes: VoteRecord[];
  residents: Resident[];
  onBack: () => void;
  onTogglePoll: (id: string) => void;
  onEndPoll: (id: string) => void;
  currentUser: User | null;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ 
  poll, 
  votes, 
  residents, 
  onBack, 
  onTogglePoll, 
  onEndPoll,
  currentUser
}) => {
  const [showDelinquentVotes, setShowDelinquentVotes] = useState(false);
  const [isConfirmingEnd, setIsConfirmingEnd] = useState(false);

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
    }

    const current = dataMap.get(v.optionId) || 0;
    dataMap.set(v.optionId, current + weight);
    totalWeight += weight;
  });

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

  const handleClickEnd = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsConfirmingEnd(true);
  };

  const handleConfirmEnd = (e: React.MouseEvent) => {
      e.preventDefault();
      onEndPoll(poll.id);
      setIsConfirmingEnd(false);
      if (currentUser) {
        addLog(currentUser, 'ENCERRAR_ENQUETE', `Encerrou a enquete: ${poll.title}`);
      }
  }

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
    </div>
  );
};
