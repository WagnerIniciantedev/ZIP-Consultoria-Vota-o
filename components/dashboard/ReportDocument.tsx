
import React from 'react';
import { LogoZip } from '../LogoZip';
import { Poll, VoteRecord, Resident, PollCalculationType, AssemblyType, DelinquencyModification } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { cleanText, getCompanySettings } from '../../services/dataService';

interface ReportDocumentProps {
  condoName: string;
  date: number;
  polls: Poll[];
  votes: VoteRecord[];
  residents: Resident[];
  isForPDF?: boolean;
  showDelinquents?: boolean;
  assemblyType?: AssemblyType | null;
  delinquencyModifications?: DelinquencyModification[];
  showCompanyInfo?: boolean;
  logoSize?: number;
}

const COLORS = ['#DC2626', '#EA580C', '#D97706', '#65A30D', '#059669', '#2563EB', '#7C3AED', '#DB2777'];

export const ReportDocument: React.FC<ReportDocumentProps> = ({
  condoName,
  date,
  polls,
  votes,
  residents,
  isForPDF = false,
  showDelinquents = true,
  assemblyType = null,
  delinquencyModifications = [],
  showCompanyInfo = false,
  logoSize = 128
}) => {
  const companySettings = getCompanySettings();
  const totalUnits = new Set(residents.map(r => r.unit)).size;
  const participatingUnits = new Set(votes.map(v => v.unit)).size;
  const quorumPercent = totalUnits > 0 ? ((participatingUnits / totalUnits) * 100).toFixed(1) : 0;

  // Overall assembly unique units split
  const uniqueInPersonUnits = new Set<string>();
  const uniqueOnlineUnits = new Set<string>();

  votes.forEach(v => {
    // Only count active votes or delinquent-released if showDelinquents matches filter
    const isDelinquent = v.isDelinquentVote;
    const isReleased = v.isDelinquentReleased;
    if (!showDelinquents && isDelinquent && !isReleased) {
      return; 
    }
    
    if (v.zoomName === "VOTO PRESENCIAL") {
      uniqueInPersonUnits.add(v.unit);
    } else {
      uniqueOnlineUnits.add(v.unit);
    }
  });

  const overallInPersonCount = uniqueInPersonUnits.size;
  const overallOnlineCount = uniqueOnlineUnits.size;

  const getAssemblyTypeLabel = (type: AssemblyType | null) => {
    switch (type) {
      case AssemblyType.ONLINE: return "Online";
      case AssemblyType.PRESENTIAL: return "Presencial";
      case AssemblyType.HYBRID: return "Híbrida";
      default: return "Não Informada";
    }
  };

  return (
    <div id="report-content" className={`bg-slate-100 font-sans ${isForPDF ? 'w-[794px]' : 'w-full mx-auto'} overflow-hidden shadow-2xl border border-slate-200`}>
      {/* Top Brand Bar */}
      <div className="h-3 bg-red-600 w-full"></div>
      
      <div className={`${isForPDF ? 'p-20' : 'p-8'} bg-white relative`}>
        {/* Subtle Watermark */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.03] rotate-[-35deg] select-none">
          <p className="text-[120px] font-black uppercase tracking-[0.2em] whitespace-nowrap">ZIP CONSULTORIA</p>
        </div>

        {/* Official Document Header */}
        <div className="relative mb-16">
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-12">
            <div className="flex-1">
              <div className="mb-10 h-auto" style={{ width: `${logoSize}px` }}>
                <LogoZip variant="red" className="w-full h-auto" />
              </div>
              <div className="space-y-2">
                <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                  Relatório <span className="text-red-600">Auditado</span>
                </h1>
                <div className="flex items-center gap-3">
                  <div className="h-0.5 w-12 bg-red-600"></div>
                  <p className="text-slate-500 font-bold tracking-[0.3em] uppercase text-[10px]">Documento de Deliberação Condominial</p>
                </div>
              </div>
            </div>
            <div className="text-right flex flex-col items-end pt-4">
              <div className="bg-red-600 text-white px-6 py-3 rounded-sm mb-6 shadow-lg shadow-red-100">
                <p className="text-xs font-black uppercase tracking-[0.2em] leading-none">{cleanText(condoName)}</p>
              </div>
              <div className="space-y-3">
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] leading-none mb-1">Modalidade</p>
                  <p className="text-sm font-black text-slate-900 uppercase tracking-tighter">{getAssemblyTypeLabel(assemblyType)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] leading-none mb-1">Sessão Realizada em</p>
                  <p className="text-3xl font-black text-slate-900 tracking-tighter">{new Date(date).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Advisory Company Banner */}
        {showCompanyInfo && (
          <div className="mb-12 p-6 bg-red-50/40 border-l-4 border-red-600 rounded-sm flex items-start gap-4 break-inside-avoid page-break-inside-avoid shadow-sm">
            <div className="bg-red-600 text-white px-2.5 py-1 rounded-sm font-black text-[9px] uppercase tracking-wider whitespace-nowrap mt-0.5">
              ASSESSORIA
            </div>
            <div className="space-y-1">
              <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Assembleia assessorada tecnicamente por <span className="text-red-600">{companySettings.name || 'ZIP CONSULTORIA'}</span>
              </p>
              <p className="text-[10px] text-slate-500 font-semibold leading-relaxed uppercase tracking-wider">
                Esta sessão de deliberação foi conduzida e auditada sob o amparo da legislação vigente.
                {companySettings.cnpj && <span className="mx-2 text-slate-300">|</span>}
                {companySettings.cnpj && `CNPJ: ${companySettings.cnpj}`}
                {companySettings.phone && <span className="mx-2 text-slate-300">|</span>}
                {companySettings.phone && `Contato: ${companySettings.phone}`}
                {companySettings.address && <span className="mx-2 text-slate-300">|</span>}
                {companySettings.address && `Endereço: ${companySettings.address}`}
              </p>
            </div>
          </div>
        )}

        {/* Summary Stats - Professional Grid */}
        <div className="grid grid-cols-4 gap-1 mb-20 border-2 border-slate-900 bg-slate-900 overflow-hidden rounded-sm">
          <div className="bg-white p-8 flex flex-col justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Enquetes</p>
            <p className="text-5xl font-black text-slate-900 mt-4 tracking-tighter">{polls.length}</p>
          </div>
          <div className="bg-white p-8 flex flex-col justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Votos Coletados</p>
            <p className="text-5xl font-black text-slate-900 mt-4 tracking-tighter">{votes.length}</p>
          </div>
          <div className="bg-white p-8 flex flex-col justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quórum Final</p>
            <div className="flex items-baseline gap-2 mt-4">
              <p className="text-5xl font-black text-slate-900 tracking-tighter">{quorumPercent}%</p>
              <p className="text-[11px] font-black text-slate-400 tracking-tighter uppercase">({participatingUnits}/{totalUnits})</p>
            </div>
          </div>
          <div className="bg-slate-900 p-8 flex flex-col justify-between text-white">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Geral</p>
            <p className="text-2xl font-black uppercase mt-4 tracking-tighter text-red-600">Concluída</p>
          </div>
        </div>

        {assemblyType === AssemblyType.HYBRID && (
          <div className="bg-slate-900 border-t-2 border-red-600 px-8 py-4 -mt-20 mb-20 flex justify-between items-center text-white text-xs rounded-b-sm">
            <span className="font-bold tracking-wider text-slate-400 uppercase text-[9px]">Distribuição de Presença (Canais de Captação)</span>
            <div className="flex gap-8">
              <span className="font-bold">
                <span className="text-red-500 mr-2 font-black">●</span>
                PRESENCIAL: <strong className="text-white text-sm font-black ml-1">{overallInPersonCount}</strong> {overallInPersonCount === 1 ? 'Unidade' : 'Unidades'}
              </span>
              <span className="font-bold">
                <span className="text-indigo-400 mr-2 font-black">●</span>
                ONLINE: <strong className="text-white text-sm font-black ml-1">{overallOnlineCount}</strong> {overallOnlineCount === 1 ? 'Unidade' : 'Unidades'}
              </span>
            </div>
          </div>
        )}

        {/* Polls Results */}
        <div className="space-y-32">
          {polls.map((poll, index) => {
            let pollVotes = votes.filter(v => v.pollId === poll.id);
            
            if (!showDelinquents) {
              pollVotes = pollVotes.filter(v => !v.isDelinquentVote || v.isDelinquentReleased);
            }

            const validVotes = pollVotes.filter(v => !v.isDelinquentVote || v.isDelinquentReleased);
            
            const onlineDataMap = new Map<string, number>();
            const presencialDataMap = new Map<string, number>();
            poll.options.forEach(opt => {
              onlineDataMap.set(opt.id, 0);
              presencialDataMap.set(opt.id, 0);
            });
            
            let totalWeight = 0;
            validVotes.forEach(v => {
              const resident = residents.find(r => r.unit === v.unit);
              let weight = 1;
              if (resident) {
                if (poll.calculationType === PollCalculationType.FRACTION) weight = resident.fraction || 0;
                else if (poll.calculationType === PollCalculationType.HABITE_SE) weight = 1 + (resident.hasHabiteSe ? 1 : 0);
                if (resident.proxyCount && resident.proxyCount > 0) weight += resident.proxyCount;
              }
              
              if (v.zoomName === "VOTO PRESENCIAL") {
                const current = presencialDataMap.get(v.optionId) || 0;
                presencialDataMap.set(v.optionId, current + weight);
              } else {
                const current = onlineDataMap.get(v.optionId) || 0;
                onlineDataMap.set(v.optionId, current + weight);
              }
              totalWeight += weight;
            });

            // Add manual votes to presencial
            if (poll.manualVotes) {
              Object.entries(poll.manualVotes).forEach(([optId, count]) => {
                const current = presencialDataMap.get(optId) || 0;
                presencialDataMap.set(optId, current + count);
                totalWeight += count;
              });
            }

            const chartData = poll.options.map(opt => {
              const onlineVal = onlineDataMap.get(opt.id) || 0;
              const presencialVal = presencialDataMap.get(opt.id) || 0;
              const totalVal = onlineVal + presencialVal;
              
              return {
                name: cleanText(opt.text),
                votos: Number(totalVal.toFixed(4)),
                online: Number(onlineVal.toFixed(4)),
                presencial: Number(presencialVal.toFixed(4)),
                percent: totalWeight > 0 ? Math.round((totalVal / totalWeight) * 100).toString() : "0"
              };
            });

            const pollTotalOnline = chartData.reduce((acc, d) => acc + d.online, 0);
            const pollTotalPresencial = chartData.reduce((acc, d) => acc + d.presencial, 0);

            const winner = [...chartData].sort((a, b) => Number(b.votos) - Number(a.votos))[0];

            return (
              <div key={poll.id} className="break-inside-avoid page-break-inside-avoid">
                <div className="flex items-center gap-6 mb-12">
                  <div className="text-7xl font-black text-slate-100 leading-none select-none">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 border-l-4 border-red-600 pl-8">
                    <p className="text-[11px] font-black text-red-600 uppercase tracking-[0.5em] mb-2">Pauta em Votação</p>
                    <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-4">{cleanText(poll.title)}</h2>
                    <p className="text-base text-slate-500 font-medium leading-relaxed italic max-w-2xl">{cleanText(poll.description)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-16 items-center bg-slate-50 p-12 rounded-sm border border-slate-200 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full -mr-16 -mt-16"></div>
                  
                  {/* Chart */}
                  <div className="md:col-span-5 h-72 relative">
                    <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso Total</p>
                      <p className="text-3xl font-black text-slate-900 tracking-tighter">{Number(totalWeight.toFixed(2))}</p>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={2}
                          dataKey="votos"
                          nameKey="name"
                          isAnimationActive={false}
                        >
                          {chartData.map((_entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} stroke="#fff" strokeWidth={4} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend and Stats */}
                  <div className="md:col-span-7">
                    <div className="space-y-8">
                      {chartData.map((d, i) => (
                        <div key={i} className="relative">
                          <div className="flex justify-between items-end mb-3">
                            <div className="flex items-center gap-4">
                              <div className="w-1.5 h-10 bg-slate-900" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                              <div className="flex flex-col">
                                <span className="font-black text-slate-900 text-sm uppercase tracking-tight leading-none mb-1">{d.name}</span>
                                <div className="flex gap-4 mt-1">
                                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Online: {d.online}</span>
                                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Presencial: {d.presencial}</span>
                                  <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Total: {d.votos}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{d.percent}%</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-200 h-1 overflow-hidden">
                            <div 
                              className="h-full transition-all duration-1000 ease-out" 
                              style={{ width: `${d.percent}%`, backgroundColor: COLORS[i % COLORS.length] }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {assemblyType === AssemblyType.HYBRID && (
                  <div className="mt-6 bg-red-50/50 border border-red-100 p-6 rounded-sm grid grid-cols-2 gap-8 divide-x divide-red-100 break-inside-avoid page-break-inside-avoid">
                    <div className="flex flex-col justify-between">
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-none mb-2">Votos Presenciais</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-black text-slate-800">{Number(pollTotalPresencial.toFixed(4))}</p>
                        <span className="text-xs text-slate-400 font-bold">
                          {poll.calculationType === PollCalculationType.FRACTION ? 'Coeficiente' : poll.calculationType === PollCalculationType.HABITE_SE ? 'Votos Ponderados' : 'Votos'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">
                        Total de votos coletados fisicamente via mesa presencial (Fichas) ou Urna Eletrônica local.
                      </p>
                    </div>
                    <div className="flex flex-col justify-between pl-8">
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-none mb-2">Votos Online</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-black text-slate-800">{Number(pollTotalOnline.toFixed(4))}</p>
                        <span className="text-xs text-slate-400 font-bold">
                          {poll.calculationType === PollCalculationType.FRACTION ? 'Coeficiente' : poll.calculationType === PollCalculationType.HABITE_SE ? 'Votos Ponderados' : 'Votos'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">
                        Total de votos coletados digitalmente através de dispositivos de moradores da assembleia virtual.
                      </p>
                    </div>
                  </div>
                )}

                {/* Winner Badge */}
                {totalWeight > 0 && winner && (
                  <div className="mt-8 bg-slate-900 p-6 rounded-sm flex items-center justify-between border-l-8 border-red-600">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Resultado da Deliberação</p>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Opção Vencedora: <span className="text-red-600">{winner.name}</span></h3>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Aprovação Final</p>
                      <p className="text-4xl font-black text-white tracking-tighter">{winner.percent}%</p>
                    </div>
                  </div>
                )}

                {/* Detailed Votes Table */}
                <div className="mt-12 border border-slate-200 rounded-sm overflow-hidden break-inside-avoid page-break-inside-avoid">
                  <div className="bg-slate-900 px-4 py-2 flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Detalhamento de Votos Auditados</h4>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{pollVotes.length} Votos Registrados</span>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Unidade</th>
                        <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Nome Morador</th>
                        <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Procurações</th>
                        <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Identificação Zoom</th>
                        <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Tipo</th>
                        <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Opção Votada</th>
                        <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pollVotes.sort((a, b) => a.unit.localeCompare(b.unit)).map((v, i) => {
                        const resident = residents.find(r => r.unit === v.unit);
                        const opt = poll.options.find(o => o.id === v.optionId);
                        return (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="px-4 py-2 text-[11px] font-bold text-slate-900 border-r border-slate-100">{v.unit}</td>
                            <td className="px-4 py-2 text-[10px] text-slate-600 uppercase border-r border-slate-100">{cleanText(resident?.name || '-')}</td>
                            <td className="px-4 py-2 text-[10px] text-slate-500 border-r border-slate-100">
                              {resident?.proxyCount && resident.proxyCount > 0 ? (
                                <span className="font-bold text-blue-600">{resident.proxyCount} ({resident.proxyUnits})</span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-2 text-[10px] text-slate-400 uppercase italic border-r border-slate-100">{cleanText(v.zoomName || resident?.zoomName || '-')}</td>
                            <td className="px-4 py-2 text-[10px] text-slate-500 font-bold border-r border-slate-100">
                              {v.zoomName === "VOTO PRESENCIAL" ? "PRESENCIAL (Urna)" : "ONLINE"}
                            </td>
                            <td className="px-4 py-2 text-[10px] font-bold text-slate-900 uppercase border-r border-slate-100">{cleanText(opt?.text || '-')}</td>
                            <td className="px-4 py-2 text-[9px] font-black">
                              {v.isDelinquentVote ? (
                                v.isDelinquentReleased ? (
                                  <div className="flex flex-col">
                                    <span className="text-emerald-600 font-bold">CONSIDERADO</span>
                                    {v.delinquentReleaseReason && (
                                      <span className="text-[8px] text-emerald-500 font-normal leading-tight block uppercase normal-case">
                                        Motivo: {v.delinquentReleaseReason}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-red-600">INADIMPLENTE</span>
                                )
                              ) : (
                                <span className="text-green-600">VÁLIDO</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {poll.manualVotes && Object.entries(poll.manualVotes).map(([optId, count], idx) => {
                        if (count === 0) return null;
                        const opt = poll.options.find(o => o.id === optId);
                        return (
                          <tr key={`manual-${idx}`} className="bg-slate-50">
                            <td className="px-4 py-2 text-[11px] font-bold text-slate-900 border-r border-slate-100">-</td>
                            <td className="px-4 py-2 text-[10px] text-slate-600 uppercase border-r border-slate-100">Mesa Presencial</td>
                            <td className="px-4 py-2 text-[10px] text-slate-400 uppercase italic border-r border-slate-100">-</td>
                            <td className="px-4 py-2 text-[10px] text-slate-400 uppercase italic border-r border-slate-100">Fichas Físicas</td>
                            <td className="px-4 py-2 text-[10px] text-slate-500 font-bold border-r border-slate-100">PRESENCIAL (Fichas)</td>
                            <td className="px-4 py-2 text-[10px] font-bold text-slate-900 uppercase border-r border-slate-100">{cleanText(opt?.text || '-')}</td>
                            <td className="px-4 py-2 text-[9px] font-black text-slate-600">
                              {count} {poll.calculationType === PollCalculationType.FRACTION ? 'PONTOS' : 'VOTOS'}
                            </td>
                          </tr>
                        );
                      })}
                      {pollVotes.length === 0 && (!poll.manualVotes || Object.keys(poll.manualVotes).length === 0) && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-xs italic">Nenhum voto registrado para esta enquete.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        {/* Participation and Voting Control Section */}
        <div className="mt-32 break-inside-avoid page-break-inside-avoid">
          <div className="flex items-center gap-6 mb-12">
            <div className="text-7xl font-black text-slate-100 leading-none select-none">
              {String(polls.length + 1).padStart(2, '0')}
            </div>
            <div className="flex-1 border-l-4 border-slate-900 pl-8">
              <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.5em] mb-2">Controle de Presença</p>
              <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-4">Unidades Aprovadas e Participação</h2>
              <p className="text-base text-slate-500 font-medium leading-relaxed italic max-w-2xl">
                Listagem de todas as unidades que realizaram o check-in e foram aprovadas para participar da assembleia, com o detalhamento de sua participação nas votações.
              </p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-sm overflow-hidden">
            <div className="bg-slate-900 px-4 py-3 flex justify-between items-center">
              <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Relatório de Engajamento</h4>
              <div className="flex gap-6">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Aprovados: {residents.filter(r => r.attendanceStatus === 'APPROVED').length}
                </span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Participaram: {new Set(votes.map(v => v.unit)).size}
                </span>
              </div>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Unidade</th>
                  <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Nome do Proprietário</th>
                  <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Procurações</th>
                  <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Nome do Zoom</th>
                  <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Enquetes Votadas</th>
                  <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Participação Total</th>
                  <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Enquetes Não Votadas</th>
                  <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">Quais enquetes não foi votada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {residents
                  .filter(r => r.attendanceStatus === 'APPROVED')
                  .sort((a, b) => a.unit.localeCompare(b.unit))
                  .map((r, i) => {
                    const resVotes = votes.filter(v => v.unit === r.unit);
                    const votedPollIds = new Set(resVotes.map(v => v.pollId));
                    const votedCount = votedPollIds.size;
                    const totalPolls = polls.length;
                    const notVotedCount = totalPolls - votedCount;
                    const votedAll = votedCount === totalPolls;
                    
                    const notVotedPolls = polls
                      .map((p, idx) => ({ id: p.id, index: idx + 1 }))
                      .filter(p => !votedPollIds.has(p.id));

                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="px-4 py-2 text-[11px] font-bold text-slate-900 border-r border-slate-100">{r.unit}</td>
                        <td className="px-4 py-2 text-[10px] text-slate-600 uppercase border-r border-slate-100">{cleanText(r.name)}</td>
                        <td className="px-4 py-2 text-[10px] text-slate-500 border-r border-slate-100">
                          {r.proxyCount && r.proxyCount > 0 ? (
                            <span className="font-bold text-blue-600">{r.proxyCount} ({r.proxyUnits})</span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-2 text-[10px] text-slate-400 uppercase italic border-r border-slate-100">{cleanText(r.zoomName || '-')}</td>
                        <td className="px-4 py-2 text-[10px] text-slate-400 border-r border-slate-100">
                          <div className="flex flex-wrap gap-1">
                            {polls.map((p, pIdx) => {
                              const v = resVotes.find(vote => vote.pollId === p.id);
                              if (!v) return null;
                              const opt = p.options.find(o => o.id === v.optionId);
                              return (
                                <span key={p.id} className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-medium text-slate-600 border border-slate-200">
                                  E{pIdx + 1}: <span className="font-bold text-slate-900">{cleanText(opt?.text || '-')}</span>
                                </span>
                              );
                            }).filter(Boolean)}
                            {votedCount === 0 && '-'}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-[10px] text-slate-400 border-r border-slate-100">
                          {totalPolls > 0 ? (
                            votedAll ? (
                              <span className="text-green-600 font-bold">100%</span>
                            ) : (
                              <span className="text-amber-600 font-bold">{((votedCount / totalPolls) * 100).toFixed(0)}%</span>
                            )
                          ) : '-'}
                        </td>
                        <td className="px-4 py-2 text-[10px] text-slate-400 font-bold text-center border-r border-slate-100">
                          {notVotedCount}
                        </td>
                        <td className="px-4 py-2 text-[10px] text-red-600 font-medium">
                          {notVotedPolls.length > 0 
                            ? notVotedPolls.map(p => `Enquete ${p.index}`).join(', ')
                            : <span className="text-green-600 font-bold">NENHUMA</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                {residents.filter(r => r.attendanceStatus === 'APPROVED').length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-xs italic">Nenhuma unidade aprovada para esta assembleia.</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="mt-6 grid grid-cols-3 gap-4 p-4 bg-white border-t border-slate-200">
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Aprovados que Votaram</p>
                <p className="text-xl font-black text-slate-900">
                  {residents.filter(r => r.attendanceStatus === 'APPROVED' && votes.some(v => v.unit === r.unit)).length} de {residents.filter(r => r.attendanceStatus === 'APPROVED').length}
                </p>
              </div>
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Participação Integral</p>
                <p className="text-xl font-black text-slate-900">
                  {residents.filter(r => {
                    if (r.attendanceStatus !== 'APPROVED') return false;
                    const resVotes = votes.filter(v => v.unit === r.unit);
                    const votedPollIds = new Set(resVotes.map(v => v.pollId));
                    return votedPollIds.size === polls.length && polls.length > 0;
                  }).length} Unidades
                </p>
              </div>
              <div className="bg-slate-900 p-4 rounded-sm text-white">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Engajamento Total</p>
                <p className="text-xl font-black text-red-600">
                  {residents.filter(r => r.attendanceStatus === 'APPROVED').length > 0 
                    ? ((residents.filter(r => r.attendanceStatus === 'APPROVED' && votes.some(v => v.unit === r.unit)).length / residents.filter(r => r.attendanceStatus === 'APPROVED').length) * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Delinquency Modifications Section */}
        {delinquencyModifications && delinquencyModifications.length > 0 && (
          <div className="mt-32 break-inside-avoid page-break-inside-avoid">
            <div className="flex items-center gap-6 mb-12">
              <div className="text-7xl font-black text-slate-100 leading-none select-none">
                {String(polls.length + 2).padStart(2, '0')}
              </div>
              <div className="flex-1 border-l-4 border-red-600 pl-8">
                <p className="text-[11px] font-black text-red-600 uppercase tracking-[0.5em] mb-2">Relatório de Alterações</p>
                <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-4">Atualizações de Inadimplência</h2>
                <p className="text-base text-slate-500 font-medium leading-relaxed italic max-w-2xl">
                  Registro de alterações manuais de status de adimplência/inadimplência de condôminos efetuados na mesa diretora antes ou durante a assembleia.
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-sm overflow-hidden">
              <div className="bg-slate-900 px-4 py-3 flex justify-between items-center">
                <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Histórico de Modificações de Inadimplência</h4>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Total de Alterações: {delinquencyModifications.length}
                </span>
              </div>
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Unidade</th>
                    <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Nome do Condômino</th>
                    <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Status Anterior</th>
                    <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Ação / Alteração</th>
                    <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Sinalizador (Inadimplência)</th>
                    <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">Data / Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {delinquencyModifications.map((m, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-4 py-2 text-[11px] font-bold text-slate-900 border-r border-slate-100">{m.unit}</td>
                      <td className="px-4 py-2 text-[10px] text-slate-600 uppercase border-r border-slate-100">{cleanText(m.name)}</td>
                      <td className="px-4 py-2 text-[10px] text-slate-500 border-r border-slate-100 uppercase">
                        {m.previousStatus ? (
                          <span className="text-red-500 font-bold">Inadimplente</span>
                        ) : (
                          <span className="text-green-500 font-bold">Adimplente</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-[10px] text-slate-500 border-r border-slate-100 uppercase font-bold italic">
                        {m.newStatus === true ? (
                          <span className="text-red-600">ADICIONADO</span>
                        ) : (
                          <span className="text-green-600">RETIRADO</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-[10px] border-r border-slate-100">
                        {m.newStatus ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block w-3.5 h-3.5 border border-red-600 bg-red-600 text-white text-[9px] leading-tight flex items-center justify-center font-bold rounded-sm">✓</span>
                            <span className="text-red-600 font-black text-[9px] tracking-wider">ATIVO</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block w-3.5 h-3.5 border border-slate-300 bg-white text-transparent text-[9px] leading-tight flex items-center justify-center font-bold rounded-sm">✓</span>
                            <span className="text-slate-400 font-normal text-[9px] tracking-wider">INATIVO (NO SISTEMA)</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-[10px] text-slate-400">
                        {new Date(m.timestamp).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-40 pt-16 border-t-8 border-slate-900 flex justify-between items-start break-inside-avoid page-break-inside-avoid">
          <div className="max-w-md">
            <div className="flex items-center gap-4 mb-6">
               <div className="h-auto opacity-70" style={{ width: `${Math.round(logoSize * 0.7)}px` }}>
                 <LogoZip variant="grayscale" className="w-full h-auto" />
               </div>
              <div className="h-8 w-[2px] bg-slate-200"></div>
              <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">{companySettings.name || 'ZIP CONSULTORIA'}</p>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-black tracking-widest mb-4">
              Os dados deste relatório foram extraídos dos condôminos aprovados e que os mesmos efetuaram a votação.
            </p>
            {showCompanyInfo && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-sm text-[10px] text-slate-600 space-y-1 font-medium break-inside-avoid">
                <p className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">Assessoria e Organização Executada por:</p>
                <p><span className="font-bold uppercase text-slate-700">Empresa:</span> {companySettings.name}</p>
                {companySettings.cnpj && <p><span className="font-bold uppercase text-slate-700">CNPJ:</span> {companySettings.cnpj}</p>}
                {companySettings.phone && <p><span className="font-bold uppercase text-slate-700">Telefone:</span> {companySettings.phone}</p>}
                {companySettings.address && <p><span className="font-bold uppercase text-slate-700">Endereço:</span> {companySettings.address}</p>}
              </div>
            )}
          </div>
          <div className="text-right space-y-4">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">Data de Emissão</p>
              <p className="text-xs font-black text-slate-900 uppercase tracking-tighter">{new Date().toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
