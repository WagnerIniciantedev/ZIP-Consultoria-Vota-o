
import React from 'react';
import { Poll, VoteRecord, Resident, PollCalculationType, SystemLog } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { cleanText } from '../../services/dataService';

interface ReportDocumentProps {
  condoName: string;
  date: number;
  polls: Poll[];
  votes: VoteRecord[];
  residents: Resident[];
  logs?: SystemLog[];
  isForPDF?: boolean;
  showDelinquents?: boolean;
}

const COLORS = ['#DC2626', '#EA580C', '#D97706', '#65A30D', '#059669', '#2563EB', '#7C3AED', '#DB2777'];

export const ReportDocument: React.FC<ReportDocumentProps> = ({
  condoName,
  date,
  polls,
  votes,
  residents,
  logs,
  isForPDF = false,
  showDelinquents = true
}) => {
  const totalUnits = new Set(residents.map(r => r.unit)).size;
  const participatingUnits = new Set(votes.map(v => v.unit)).size;
  const quorumPercent = totalUnits > 0 ? ((participatingUnits / totalUnits) * 100).toFixed(1) : 0;

  return (
    <div id="report-content" className={`bg-white font-sans ${isForPDF ? 'p-12 w-[794px] min-h-[1123px]' : 'p-0'}`}>
      {/* Official Document Header */}
      <div className="relative mb-16">
        <div className="flex justify-between items-start border-b-4 border-gray-900 pb-10">
          <div className="flex-1">
            <div className="mb-8">
              <img 
                src="https://i.postimg.cc/Y0w6w1cm/Whats-App-Image-2025-11-29-at-22-21-41-removebg-preview.png" 
                alt="ZIP Logo" 
                className="h-24 w-auto object-contain" 
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
              />
            </div>
            <h1 className="text-4xl font-black text-gray-900 uppercase tracking-tighter leading-none mb-4">Relatório de Assembleia</h1>
            <div className="flex items-center gap-3">
              <div className="h-2 w-16 bg-red-600"></div>
              <p className="text-xl font-black text-gray-800 tracking-tight uppercase">{cleanText(condoName)}</p>
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="bg-red-600 text-white px-8 py-4 mb-6 shadow-md">
              <p className="text-sm font-black uppercase tracking-[0.2em] leading-none">Auditoria Oficial</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] leading-none">Data da Sessão</p>
              <p className="text-2xl font-black text-gray-900">{new Date(date).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats - Editorial Grid */}
      <div className="grid grid-cols-4 gap-4 mb-16">
        <div className="bg-gray-50 p-6 border-l-4 border-gray-900">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Enquetes</p>
          <p className="text-3xl font-black text-gray-900 leading-none">{polls.length}</p>
        </div>
        <div className="bg-gray-50 p-6 border-l-4 border-gray-900">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Votos Totais</p>
          <p className="text-3xl font-black text-gray-900 leading-none">{votes.length}</p>
        </div>
        <div className="bg-gray-50 p-6 border-l-4 border-gray-900">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Quórum</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-black text-gray-900 leading-none">{quorumPercent}%</p>
            <p className="text-[10px] font-bold text-gray-400">({participatingUnits}/{totalUnits})</p>
          </div>
        </div>
        <div className="bg-red-600 p-6 text-white shadow-lg">
          <p className="text-[9px] font-black text-red-200 uppercase tracking-[0.2em] mb-2">Status Final</p>
          <p className="text-xl font-black uppercase leading-none">CONCLUÍDA</p>
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
              <div className="border-l-[8px] border-red-600 pl-6 mb-10">
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.4em]">PAUTA {index + 1}</p>
                </div>
                <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter mb-3 leading-tight">{cleanText(poll.title)}</h2>
                <p className="text-lg text-gray-500 font-medium leading-relaxed max-w-2xl italic">{cleanText(poll.description)}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">
                {/* Chart */}
                <div className="md:col-span-5 h-64 bg-gray-50 border-2 border-gray-900 p-4 relative">
                  <div className="absolute top-3 left-3 text-[7px] font-black text-gray-300 uppercase tracking-widest">Gráfico de Distribuição</div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={6}
                        dataKey="votos"
                        nameKey="name"
                        isAnimationActive={false}
                      >
                        {chartData.map((_entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend and Stats */}
                <div className="md:col-span-7 flex flex-col justify-center">
                  <div className="space-y-6">
                    {chartData.map((d, i) => (
                      <div key={i} className="relative">
                        <div className="flex justify-between items-end mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-5 h-5 shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                            <span className="font-black text-gray-900 uppercase text-sm tracking-tight">{d.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-black text-gray-900">{d.percent}%</span>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{d.votos} pontos</p>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 h-2 overflow-hidden rounded-full">
                          <div 
                            className="h-full" 
                            style={{ width: `${d.percent}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-10 pt-6 border-t-2 border-gray-900 flex justify-between items-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Total de Pontos Válidos</p>
                    <p className="text-3xl font-black text-gray-900">{Number(totalWeight.toFixed(4))}</p>
                  </div>
                </div>
              </div>

              {/* Voter List for this poll */}
              <div className="mt-12">
                <div className="flex items-center gap-4 mb-4">
                  <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.3em]">Detalhamento de Votos</h3>
                  <div className="flex-1 h-[2px] bg-gray-900"></div>
                </div>
                
                <div className="border-2 border-gray-900 overflow-hidden shadow-lg">
                  <table className="w-full text-left text-[10px]">
                    <thead className="bg-gray-900 text-white uppercase tracking-[0.1em]">
                      <tr>
                        <th className="px-4 py-3 font-black">Unidade</th>
                        <th className="px-4 py-3 font-black">Morador</th>
                        <th className="px-4 py-3 font-black">Opção Escolhida</th>
                        {poll.calculationType !== PollCalculationType.NORMAL && (
                          <th className="px-4 py-3 font-black text-right">Peso</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-900">
                      {pollVotes.sort((a, b) => a.unit.localeCompare(b.unit)).map((v, idx) => {
                        const resident = residents.find(r => r.unit === v.unit);
                        const opt = poll.options.find(o => o.id === v.optionId);
                        let weight = 1;
                        if (resident && !v.isDelinquentVote) {
                          if (poll.calculationType === PollCalculationType.FRACTION) weight = resident.fraction || 0;
                          else if (poll.calculationType === PollCalculationType.HABITE_SE) weight = 1 + (resident.hasHabiteSe ? 1 : 0);
                          if (resident.proxyCount && resident.proxyCount > 0) weight += resident.proxyCount;
                        } else if (v.isDelinquentVote) weight = 0;

                        return (
                          <tr key={idx} className={`${v.isDelinquentVote ? 'bg-red-50' : 'bg-white'} hover:bg-gray-50 transition-colors`}>
                            <td className="px-4 py-3 font-black text-gray-900 border-r border-gray-900 text-xs">{v.unit}</td>
                            <td className="px-4 py-3 font-bold text-gray-700">
                              {cleanText(resident?.name || 'N/A')}
                              <p className="text-[8px] text-gray-400 font-medium italic uppercase tracking-tighter">{cleanText(v.zoomName || 'Voto Direto')}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`font-black uppercase tracking-tighter text-xs ${v.isDelinquentVote ? 'text-gray-300 line-through' : 'text-red-600'}`}>
                                {cleanText(opt?.text || 'N/A')}
                              </span>
                              {v.isDelinquentVote && <span className="ml-2 text-[8px] font-black bg-red-600 text-white px-1.5 py-0.5">INADIMPLENTE</span>}
                            </td>
                            {poll.calculationType !== PollCalculationType.NORMAL && (
                              <td className="px-4 py-3 font-mono text-right font-black text-gray-900 text-xs">{weight.toFixed(4)}</td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Logs Section */}
      {logs && logs.length > 0 && (
        <div className="mt-20 break-before-page">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Histórico de Auditoria</h2>
            <div className="flex-1 h-1 bg-gray-900"></div>
          </div>
          
          <div className="border-2 border-gray-900 overflow-hidden">
            <table className="w-full text-left text-[9px]">
              <thead className="bg-gray-900 text-white uppercase tracking-widest">
                <tr>
                  <th className="px-3 py-2 font-black">Data/Hora</th>
                  <th className="px-3 py-2 font-black">Usuário</th>
                  <th className="px-3 py-2 font-black">Ação</th>
                  <th className="px-3 py-2 font-black">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.slice().reverse().map((log) => (
                  <tr key={log.id} className="bg-white hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500 font-mono">{new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2 font-black text-gray-900 uppercase tracking-tighter">{cleanText(log.userName)}</td>
                    <td className="px-3 py-2">
                      <span className={`font-black uppercase px-1.5 py-0.5 text-[7px] ${
                        log.action.includes('LOGIN') ? 'bg-green-100 text-green-800' : 
                        log.action.includes('DELETE') ? 'bg-red-100 text-red-800' : 
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 font-medium">{cleanText(log.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-20 pt-10 border-t-2 border-gray-900 flex justify-between items-start">
        <div className="max-w-md">
          <p className="text-[10px] font-black text-gray-900 uppercase tracking-widest mb-1">ZIP CONSULTORIA E ASSESSORIA CONDOMINIAL</p>
          <p className="text-[9px] text-gray-500 leading-relaxed">
            Este documento é um registro oficial das deliberações realizadas via sistema Condovote. 
            A autenticidade deste relatório pode ser verificada junto à administração do condomínio.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Sistema Condovote</p>
          <p className="text-[9px] text-gray-900">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
        </div>
      </div>
    </div>
  );
};
