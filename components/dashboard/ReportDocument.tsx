
import React from 'react';
import { Poll, VoteRecord, Resident, PollCalculationType, AssemblyType } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { cleanText } from '../../services/dataService';

interface ReportDocumentProps {
  condoName: string;
  date: number;
  polls: Poll[];
  votes: VoteRecord[];
  residents: Resident[];
  isForPDF?: boolean;
  showDelinquents?: boolean;
  assemblyType?: AssemblyType | null;
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
  assemblyType = null
}) => {
  const totalUnits = new Set(residents.map(r => r.unit)).size;
  const participatingUnits = new Set(votes.map(v => v.unit)).size;
  const quorumPercent = totalUnits > 0 ? ((participatingUnits / totalUnits) * 100).toFixed(1) : 0;

  const getAssemblyTypeLabel = (type: AssemblyType | null) => {
    switch (type) {
      case AssemblyType.ONLINE: return "Online";
      case AssemblyType.PRESENTIAL: return "Presencial";
      case AssemblyType.HYBRID: return "Híbrida";
      default: return "Não Informada";
    }
  };

  return (
    <div id="report-content" className={`bg-slate-100 font-sans ${isForPDF ? 'w-[794px] min-h-[1123px]' : 'w-full'} mx-auto overflow-hidden shadow-2xl border border-slate-200`}>
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
              <div className="mb-10">
                <img 
                  src="https://i.postimg.cc/rsSDGbPr/Whats_App_Image_2025_11_29_at_22_21_41.jpg" 
                  alt="ZIP Logo" 
                  className="h-20 w-auto object-contain" 
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
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

        {/* Polls Results */}
        <div className="space-y-32">
          {polls.map((poll, index) => {
            let pollVotes = votes.filter(v => v.pollId === poll.id);
            
            if (!showDelinquents) {
              pollVotes = pollVotes.filter(v => !v.isDelinquentVote);
            }

            const validVotes = pollVotes.filter(v => !v.isDelinquentVote);
            
            const dataMap = new Map<string, number>();
            poll.options.forEach(opt => dataMap.set(opt.id, 0));
            
            let totalWeight = 0;
            validVotes.forEach(v => {
              const resident = residents.find(r => r.unit === v.unit);
              let weight = 1;
              if (resident) {
                if (poll.calculationType === PollCalculationType.FRACTION) weight = resident.fraction || 0;
                else if (poll.calculationType === PollCalculationType.HABITE_SE) weight = 1 + (resident.hasHabiteSe ? 1 : 0);
                if (resident.proxyCount && resident.proxyCount > 0) weight += resident.proxyCount;
              }
              const current = dataMap.get(v.optionId) || 0;
              dataMap.set(v.optionId, current + weight);
              totalWeight += weight;
            });

            // Add manual votes
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
                name: cleanText(opt.text),
                votos: Number(val.toFixed(4)),
                percent: totalWeight > 0 ? ((val / totalWeight) * 100).toFixed(1) : 0
              };
            });

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
                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{d.votos} pontos auditados</span>
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
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-40 pt-16 border-t-8 border-slate-900 flex justify-between items-start">
          <div className="max-w-md">
            <div className="flex items-center gap-4 mb-6">
               <img 
                src="https://i.postimg.cc/rsSDGbPr/Whats_App_Image_2025_11_29_at_22_21_41.jpg" 
                alt="ZIP Logo" 
                className="h-12 w-auto grayscale" 
                referrerPolicy="no-referrer"
              />
              <div className="h-8 w-[2px] bg-slate-200"></div>
              <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">ZIP CONSULTORIA</p>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-black tracking-widest">
              Os dados deste relatório foram extraídos dos condôminos aprovados e que os mesmos efetuaram a votação.
            </p>
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
