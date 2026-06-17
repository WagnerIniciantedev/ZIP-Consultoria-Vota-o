
import React, { useState } from 'react';
import { Poll, VoteRecord, Resident, PollCalculationType, User, AssemblyType } from '../../types';
import { Button, Card, Badge, Input } from '../ui';
import { exportVotesToCSV, addLog, savePolls, cleanText } from '../../services/dataService';
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowLeft, PlayCircle, PauseCircle, StopCircle, Download, Eye, EyeOff, Plus, Users, Maximize2, Minimize2, Tablet, X } from 'lucide-react';
import { UrnaEletronica } from '../UrnaEletronica';

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
  residentsCount: number;
  isZoomMode?: boolean;
  setIsZoomMode?: (val: boolean) => void;
  onVoteSubmit: (pollId: string, unit: string, optionId: string, isDelinquent: boolean, zoomName?: string) => Promise<void> | void;
  onReleaseDelinquentVote?: (pollId: string, unit: string, reason: string) => Promise<void> | void;
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
  setPolls,
  residentsCount,
  isZoomMode: isZoomModeProp = false,
  setIsZoomMode: setIsZoomModeProp,
  onVoteSubmit,
  onReleaseDelinquentVote
}) => {
  const [showDelinquentVotes, setShowDelinquentVotes] = useState(false);
  const [isConfirmingEnd, setIsConfirmingEnd] = useState(false);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [isZoomModeInternal, setIsZoomModeInternal] = useState(false);
  const [isZoomPromptOpen, setIsZoomPromptOpen] = useState(false);
  const [showZoomDetails, setShowZoomDetails] = useState(true);
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});
  const [isManualVoteFlowOpen, setIsManualVoteFlowOpen] = useState(false);
  const [isManualChoiceOpen, setIsManualChoiceOpen] = useState(false);
  
  // States for Releasing Delinquent Votes
  const [releasingVote, setReleasingVote] = useState<VoteRecord | null>(null);
  const [releaseReason, setReleaseReason] = useState("");

  const isZoomMode = isZoomModeProp || isZoomModeInternal;
  const setIsZoomMode = setIsZoomModeProp || setIsZoomModeInternal;
  const isHybrid = assemblyType === AssemblyType.HYBRID;

  // --- DATA CALCULATION ---
  const pollVotes = votes.filter(v => v.pollId === poll.id);
  const validVotes = pollVotes.filter(v => !v.isDelinquentVote || v.isDelinquentReleased);
  const delinquentVotes = pollVotes.filter(v => v.isDelinquentVote && !v.isDelinquentReleased);

  const onlineDataMap = new Map<string, number>();
  poll.options.forEach(opt => onlineDataMap.set(opt.id, 0));
  
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
      
      // Add proxy count to weight ONLY for units that carry proxies
      // We subtract the number of proxy units that ALREADY have a vote in this poll
      // to avoid double counting when using "Vote in Block" or "Distinct Votes"
      if (resident.proxyCount && resident.proxyCount > 0) {
        const proxyUnitsList = (resident.proxyUnits || '').split(',').map(u => u.trim().toLowerCase()).filter(u => u);
        const votedProxyUnitsCount = proxyUnitsList.filter(pUnit => 
          pollVotes.some(vote => vote.unit.toLowerCase() === pUnit && (!vote.isDelinquentVote || vote.isDelinquentReleased))
        ).length;
        
        const remainingProxies = Math.max(0, resident.proxyCount - votedProxyUnitsCount);
        weight += remainingProxies;
      }
    }

    const current = onlineDataMap.get(v.optionId) || 0;
    onlineDataMap.set(v.optionId, current + weight);
    totalWeight += weight;
  });

  // Add manual votes if any
  if (poll.manualVotes) {
    Object.values(poll.manualVotes).forEach((count) => {
      totalWeight += count;
    });
  }

  const chartData = poll.options.map(opt => {
    const onlineVal = onlineDataMap.get(opt.id) || 0;
    const manualVal = poll.manualVotes?.[opt.id] || 0;
    const totalVal = onlineVal + manualVal;
    
    const isFraction = poll.calculationType === PollCalculationType.FRACTION;
    const percentValue = totalWeight > 0 ? (totalVal / totalWeight) * 100 : 0;
    
    return {
      name: cleanText(opt.text),
      votos: Number(totalVal.toFixed(4)), 
      online: Number(onlineVal.toFixed(4)),
      presencial: Number(manualVal.toFixed(4)),
      percent: isFraction ? percentValue.toFixed(2) : Math.round(percentValue).toString()
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

  const handleEnterZoom = (showDetails: boolean) => {
    setShowZoomDetails(showDetails);
    setIsZoomMode(true);
    setIsZoomPromptOpen(false);
  };

  if (isZoomMode) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 z-[100] flex flex-col p-8 overflow-y-auto animate-in fade-in">
        <div className="flex justify-between items-center mb-10 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-4xl font-black text-white uppercase tracking-tight drop-shadow-md">{cleanText(poll.title)}</h1>
            <p className="text-xl text-slate-400 mt-2">{cleanText(poll.description)}</p>
          </div>
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              onClick={() => setIsZoomMode(false)}
              className="flex items-center gap-2 px-6 py-6 text-lg border-2 border-white/20 text-white hover:bg-white/10"
            >
              <Minimize2 size={24} /> Sair do Modo Zoom
            </Button>
          </div>
        </div>

        <div className={`flex-1 grid grid-cols-1 ${showZoomDetails ? 'lg:grid-cols-2' : 'max-w-4xl mx-auto w-full'} gap-12 items-center`}>
          <div className={`${showZoomDetails ? 'h-[550px]' : 'h-[650px]'} w-full bg-slate-800/40 backdrop-blur-md rounded-3xl p-8 flex items-center justify-center border border-white/10 shadow-2xl transition-all duration-500`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  outerRadius={showZoomDetails ? 180 : 220}
                  stroke="#ffffff"
                  strokeWidth={2}
                  fill="#8884d8"
                  dataKey="votos"
                  nameKey="name"
                  label={({ cx, cy, midAngle, outerRadius, percent, name }) => {
                    const RADIAN = Math.PI / 180;
                    // Point on the edge of the pie
                    const sx = cx + outerRadius * Math.cos(-midAngle * RADIAN);
                    const sy = cy + outerRadius * Math.sin(-midAngle * RADIAN);
                    
                    // Point for the label
                    const labelRadius = outerRadius + 40;
                    const x = cx + labelRadius * Math.cos(-midAngle * RADIAN);
                    const y = cy + labelRadius * Math.sin(-midAngle * RADIAN);
                    
                    const isFraction = poll.calculationType === PollCalculationType.FRACTION;
                    const displayPercent = isFraction ? (percent * 100).toFixed(2) : Math.round(percent * 100).toString();
                    
                    const textAnchor = x > cx ? 'start' : 'end';

                    return (
                      <g>
                        <line x1={sx} y1={sy} x2={x} y2={y} stroke="white" strokeWidth={2} opacity={0.6} />
                        <text 
                          x={x + (x > cx ? 10 : -10)} 
                          y={y} 
                          fill="white" 
                          textAnchor={textAnchor} 
                          dominantBaseline="central"
                          style={{ fontSize: showZoomDetails ? '20px' : '28px', fontWeight: '900', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                        >
                          {`${name}: ${displayPercent}%`}
                        </text>
                      </g>
                    );
                  }}
                >
                  {chartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', backgroundColor: '#1e293b', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(_value: number, _name: string, props: any) => [`${props.payload.percent}%`, 'Participação']} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {showZoomDetails && (
            <div className="space-y-4 animate-in slide-in-from-right-10 duration-500">
              <div className="grid grid-cols-1 gap-3">
                {chartData.map((d, i) => (
                  <div key={i} className="bg-white p-5 rounded-2xl border-l-8 flex items-center justify-between shadow-2xl" style={{ borderLeftColor: COLORS[i % COLORS.length] }}>
                    <div className="flex items-center gap-4">
                      <div className="w-5 h-5 rounded-full shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                      <div className="text-3xl font-black text-slate-900 leading-tight">{d.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-6xl font-black tracking-tighter" style={{ color: COLORS[i % COLORS.length] }}>{d.percent}%</div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="pt-8 border-t border-white/10 flex justify-center items-end">
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Total de Participação</p>
                  <p className="text-6xl font-black text-white drop-shadow-lg">100%</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isManualVoteFlowOpen) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <Button onClick={() => setIsManualVoteFlowOpen(false)} variant="outline" className="flex items-center gap-2">
            <ArrowLeft size={16} /> Voltar aos Resultados da Enquete
          </Button>
        </div>
        <UrnaEletronica 
          residents={residents}
          polls={[poll]} // Only pass this specific poll to restrict it
          votes={votes}
          onVoteSubmit={onVoteSubmit}
          onBack={() => setIsManualVoteFlowOpen(false)}
          singlePollId={poll.id}
          isStandalone={false}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft size={16} /> Voltar para Lista
        </Button>
        <h2 className="text-xl font-bold text-gray-900">Resultados: {cleanText(poll.title)}</h2>
      </div>

      <Card title="Status da Votação">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
           <div>
             <div className="flex items-center gap-2">
               <p className="text-sm text-gray-500">{cleanText(poll.description)}</p>
               <Badge color="gray">{getCalculationLabel(poll.calculationType)}</Badge>
             </div>
             <div className="mt-2 flex items-center gap-3">
                 {poll.isActive ? <Badge color="green">Votação Ativa</Badge> : 
                 poll.isEnded ? <Badge color="red">Encerrada</Badge> : <Badge color="yellow">Pausada / Rascunho</Badge>}
                 
                 {residentsCount > 0 && (
                   <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold border border-gray-200">
                     <Users size={12} className="text-gray-500" />
                     <span>Votos: {pollVotes.length} / {residentsCount}</span>
                   </div>
                 )}
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
             <Button onClick={() => setIsZoomPromptOpen(true)} variant="primary" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 border-indigo-600">
               <Maximize2 size={18} /> Visualização Zoom
             </Button>
             <Button onClick={() => setIsManualChoiceOpen(true)} variant="primary" className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 border-emerald-600">
               <Tablet size={18} /> Votação Manual
             </Button>
             {false && (
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
                     labelLine={true}
                     outerRadius={65}
                     label={({ percent, name }) => {
                       const isFraction = poll.calculationType === PollCalculationType.FRACTION;
                       const displayPercent = isFraction ? (percent * 100).toFixed(2) : Math.round(percent * 100).toString();
                       return `${name}: ${displayPercent}%`;
                     }}
                     fill="#8884d8"
                     dataKey="votos"
                     nameKey="name"
                   >
                     {chartData.map((_entry, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip formatter={(_value: number, _name: string, props: any) => [`${props.payload.percent}%`, 'Participação']} />
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
                   <div className="text-xs text-gray-500">
                     {d.votos} {poll.calculationType === PollCalculationType.FRACTION ? 'pontos' : 'votos'}
                     {poll.manualVotes && Object.keys(poll.manualVotes).length > 0 && (
                       <div className="text-[10px] mt-0.5 flex justify-center gap-2 opacity-70 font-bold">
                         <span className="text-blue-600">On: {d.online}</span>
                         <span className="text-orange-600">Pre: {d.presencial}</span>
                       </div>
                     )}
                   </div>
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
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Procurações</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nome Zoom</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Opção Escolhida</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  {(poll.calculationType !== PollCalculationType.NORMAL || pollVotes.some(v => {
                    const r = residents.find(res => res.unit === v.unit);
                    return r && (r.proxyCount || 0) > 0;
                  })) && (
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
                    if (resident && (!v.isDelinquentVote || v.isDelinquentReleased)) {
                      if (poll.calculationType === PollCalculationType.FRACTION) {
                        weight = resident.fraction || 0;
                      } else if (poll.calculationType === PollCalculationType.HABITE_SE) {
                        weight = 1 + (resident.hasHabiteSe ? 1 : 0);
                      }
                      
                      // Add proxy count to weight
                      if (resident.proxyCount && resident.proxyCount > 0) {
                        weight += resident.proxyCount;
                      }
                    } else if (v.isDelinquentVote && !v.isDelinquentReleased) {
                      weight = 0;
                    }

                    return (
                      <tr key={idx} className={v.isDelinquentVote ? (v.isDelinquentReleased ? "bg-emerald-50/50" : "bg-red-50") : ""}>
                        <td className="px-4 py-3 font-bold text-gray-900">{cleanText(v.unit)}</td>
                        <td className="px-4 py-3 text-gray-600">{cleanText(resident?.name || 'N/A')}</td>
                        <td className="px-4 py-3">
                          {resident?.proxyCount && resident.proxyCount > 0 ? (
                            <div className="text-xs text-blue-600 font-bold">
                              {resident.proxyCount} Proc. ({resident.proxyUnits})
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 italic">{cleanText(v.zoomName || '-')}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${v.isDelinquentVote && !v.isDelinquentReleased ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-800'}`}>
                            {cleanText(opt?.text || 'N/A')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {v.isDelinquentVote ? (
                            v.isDelinquentReleased ? (
                              <div className="flex flex-col gap-0.5">
                                <Badge color="green">CONSIDERADO</Badge>
                                <span className="text-[10px] text-emerald-700 font-medium max-w-[160px] truncate" title={v.delinquentReleaseReason}>
                                  Motivo: {v.delinquentReleaseReason}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-start gap-1">
                                <Badge color="red">Inadimplente</Badge>
                                <button
                                  type="button"
                                  onClick={() => setReleasingVote(v)}
                                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer p-0 bg-transparent border-0"
                                >
                                  Considerar Voto
                                </button>
                              </div>
                            )
                          ) : (
                            <Badge color="green">VÁLIDO</Badge>
                          )}
                        </td>
                        {(poll.calculationType !== PollCalculationType.NORMAL || pollVotes.some(v2 => {
                          const r2 = residents.find(res => res.unit === v2.unit);
                          return r2 && (r2.proxyCount || 0) > 0;
                        })) && (
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

        {releasingVote && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in duration-300">
              <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <PlayCircle className="text-indigo-600" size={20} />
                  Considerar Voto - Unidade {releasingVote.unit}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setReleasingVote(null);
                    setReleaseReason("");
                  }}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Ao liberar o voto desta unidade inadimplente, o sistema passará a considerá-lo como <strong>VOTO VÁLIDO</strong> para os cálculos e gráficos em tempo real desta enquete.
                </p>
                <div>
                  <label htmlFor="reason-input" className="block text-xs font-semibold text-gray-700 uppercase mb-1.5">
                    Motivo da Liberação *
                  </label>
                  <Input
                    id="reason-input"
                    type="text"
                    required
                    placeholder="Ex: Apresentou comprovante, acordo firmado..."
                    value={releaseReason}
                    onChange={(e) => setReleaseReason(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setReleasingVote(null);
                    setReleaseReason("");
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    if (!releaseReason.trim()) {
                      alert("Por favor, informe o motivo da liberação.");
                      return;
                    }
                    if (onReleaseDelinquentVote) {
                      await onReleaseDelinquentVote(releasingVote.pollId, releasingVote.unit, releaseReason);
                    }
                    setReleasingVote(null);
                    setReleaseReason("");
                  }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                >
                  Confirmar Liberação
                </Button>
              </div>
            </div>
          </div>
        )}

        {isZoomPromptOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-in zoom-in duration-300">
              <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Maximize2 size={40} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Visualização Zoom</h3>
              <p className="text-gray-600 mb-8">
                Deseja mostrar as opções e quantidades de votos em cada opção na tela cheia?
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  onClick={() => handleEnterZoom(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 py-4 text-lg font-bold"
                >
                  Sim, mostrar
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleEnterZoom(false)}
                  className="py-4 text-lg font-bold border-2"
                >
                  Não, só gráfico
                </Button>
              </div>
              <button 
                onClick={() => setIsZoomPromptOpen(false)}
                className="mt-6 text-gray-400 hover:text-gray-600 text-sm font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {isManualChoiceOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 animate-in zoom-in duration-300 relative border-t-4 border-red-600">
              <button 
                onClick={() => setIsManualChoiceOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                title="Fechar"
              >
                <X size={24} />
              </button>

              <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Tablet className="text-red-600 animate-pulse" size={24} />
                Votação Manual Presencial
              </h3>
              <p className="text-gray-500 text-sm mb-6">
                Escolha o método mais adequado para registrar os votos coletados de forma presencial{isHybrid ? " (Modo Híbrido)" : ""}.
              </p>

              <div className="grid grid-cols-1 gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsManualVoteFlowOpen(true);
                    setIsManualChoiceOpen(false);
                  }}
                  className="p-5 rounded-xl border-2 border-slate-200 hover:border-red-600 hover:bg-rose-50/30 text-left transition-all group flex items-start gap-4"
                >
                  <div className="p-3 bg-red-100 text-red-600 rounded-lg group-hover:bg-red-600 group-hover:text-white transition-colors">
                    <Tablet size={24} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-extrabold text-lg text-slate-900">Urna Eletrônica Interativa</h4>
                    <p className="text-sm text-slate-500 mt-1">
                      Ideal para votação auditável. Busque o morador por nome, CPF ou unidade e permita que ele externe seu voto diretamente.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    startManualEdit();
                    setIsManualChoiceOpen(false);
                  }}
                  className="p-5 rounded-xl border-2 border-slate-200 hover:border-red-600 hover:bg-rose-50/30 text-left transition-all group flex items-start gap-4"
                >
                  <div className="p-3 bg-red-100 text-red-600 rounded-lg group-hover:bg-red-600 group-hover:text-white transition-colors">
                    <Plus size={24} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-extrabold text-lg text-slate-900">Digitar Totais Diretamente</h4>
                    <p className="text-sm text-slate-500 mt-1">
                      Ideal para votação em papel. Digite o total de votos presenciais coletados fisicamente para cada opção desta enquete.
                    </p>
                  </div>
                </button>
              </div>

              <div className="flex justify-end">
                <Button 
                  variant="outline"
                  onClick={() => setIsManualChoiceOpen(false)}
                  className="border-slate-200 text-slate-600"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
