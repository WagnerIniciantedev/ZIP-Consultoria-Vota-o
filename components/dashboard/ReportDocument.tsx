
import React from 'react';
import { Poll, VoteRecord, Resident, PollCalculationType, SystemLog } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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
    <div id="report-content" className={`bg-white font-sans ${isForPDF ? 'p-12 w-[800px]' : 'p-0'}`}>
      {/* Official Document Header */}
      <div className="relative mb-12">
        <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
          <img 
            src="https://i.postimg.cc/Y0w6w1cm/Whats-App-Image-2025-11-29-at-22-21-41-removebg-preview.png" 
            alt="" 
            className="h-48 w-auto grayscale" 
          />
        </div>
        
        <div className="flex justify-between items-end border-b-4 border-gray-900 pb-8">
          <div>
            <img 
              src="https://i.postimg.cc/Y0w6w1cm/Whats-App-Image-2025-11-29-at-22-21-41-removebg-preview.png" 
              alt="ZIP Logo" 
              className="h-24 w-auto mb-6 brightness-0" 
              referrerPolicy="no-referrer"
            />
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter leading-none mb-2">Relatório Oficial de Assembleia</h1>
            <div className="flex items-center gap-2">
              <div className="h-1 w-12 bg-red-600"></div>
              <p className="text-lg font-bold text-gray-700 tracking-tight">{condoName}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-gray-900 text-white px-4 py-2 mb-4 inline-block">
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">Documento de Auditoria</p>
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Data da Sessão</p>
            <p className="text-xl font-black text-gray-900">{new Date(date).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
      </div>

      {/* Summary Stats - Bento Style */}
      <div className="grid grid-cols-4 gap-4 mb-12">
        <div className="bg-gray-50 p-5 border border-gray-200">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Enquetes</p>
          <p className="text-3xl font-black text-gray-900 leading-none">{polls.length}</p>
        </div>
        <div className="bg-gray-50 p-5 border border-gray-200">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Votos Totais</p>
          <p className="text-3xl font-black text-gray-900 leading-none">{votes.length}</p>
        </div>
        <div className="bg-gray-50 p-5 border border-gray-200">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Quórum</p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-black text-gray-900 leading-none">{quorumPercent}%</p>
            <p className="text-xs font-bold text-gray-400">({participatingUnits}/{totalUnits})</p>
          </div>
        </div>
        <div className="bg-red-600 p-5 text-white">
          <p className="text-[10px] font-black text-red-200 uppercase tracking-widest mb-2">Status</p>
          <p className="text-xl font-black uppercase leading-none">CONCLUÍDA</p>
        </div>
      </div>

      {/* Polls Results */}
      <div className="space-y-20">
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
              name: opt.text,
              votos: Number(val.toFixed(4)),
              percent: totalWeight > 0 ? ((val / totalWeight) * 100).toFixed(1) : 0
            };
          });

          return (
            <div key={poll.id} className="break-inside-avoid">
              <div className="border-l-8 border-red-600 pl-6 mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <p className="text-xs font-black text-red-600 uppercase tracking-[0.3em]">Questão {index + 1}</p>
                </div>
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight mb-2">{poll.title}</h2>
                <p className="text-gray-500 font-medium leading-relaxed max-w-2xl">{poll.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">
                {/* Chart */}
                <div className="md:col-span-5 h-64 bg-gray-50 border border-gray-100 p-4 rounded-sm">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="votos"
                        nameKey="name"
                        isAnimationActive={!isForPDF}
                      >
                        {chartData.map((_entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '0px', border: '1px solid #000', fontWeight: 'bold' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend and Stats */}
                <div className="md:col-span-7 flex flex-col justify-center">
                  <div className="space-y-6">
                    {chartData.map((d, i) => (
                      <div key={i} className="group">
                        <div className="flex justify-between items-end mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                            <span className="font-black text-gray-900 uppercase text-sm tracking-tight">{d.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-black text-gray-900">{d.percent}%</span>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{d.votos} pts</p>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 overflow-hidden">
                          <div 
                            className="h-full transition-all duration-1000" 
                            style={{ width: `${d.percent}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-8 pt-6 border-t-2 border-dashed border-gray-200 flex justify-between items-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Total de Pontos Apurados</p>
                    <p className="text-2xl font-black text-gray-900">{Number(totalWeight.toFixed(4))}</p>
                  </div>
                </div>
              </div>

              {/* Voter List for this poll */}
              <div className="mt-12">
                <div className="flex items-center gap-4 mb-4">
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em]">Detalhamento de Votos</h3>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>
                
                <div className="border-2 border-gray-900 overflow-hidden">
                  <table className="w-full text-left text-[10px]">
                    <thead className="bg-gray-900 text-white uppercase tracking-widest">
                      <tr>
                        <th className="px-4 py-3 font-black">Unidade</th>
                        <th className="px-4 py-3 font-black">Morador</th>
                        <th className="px-4 py-3 font-black">Nome Zoom</th>
                        <th className="px-4 py-3 font-black">Opção</th>
                        {poll.calculationType !== PollCalculationType.NORMAL && (
                          <th className="px-4 py-3 font-black text-right">Peso</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
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
                            <td className="px-4 py-3 font-black text-gray-900 border-r border-gray-100">{v.unit}</td>
                            <td className="px-4 py-3 font-bold text-gray-700">{resident?.name || 'N/A'}</td>
                            <td className="px-4 py-3 italic text-gray-500">{v.zoomName || '-'}</td>
                            <td className="px-4 py-3">
                              <span className={`font-black uppercase tracking-tighter ${v.isDelinquentVote ? 'text-gray-400' : 'text-red-600'}`}>
                                {opt?.text || 'N/A'}
                                {v.isDelinquentVote && <span className="ml-2 text-[8px] border border-gray-300 px-1">INADIMPLENTE</span>}
                              </span>
                            </td>
                            {poll.calculationType !== PollCalculationType.NORMAL && (
                              <td className="px-4 py-3 font-mono text-right font-bold text-gray-900">{weight.toFixed(4)}</td>
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
        <div className="mt-24 break-before-page">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Histórico de Auditoria</h2>
            <div className="flex-1 h-1 bg-gray-900"></div>
          </div>
          
          <div className="border-2 border-gray-900 overflow-hidden">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-gray-900 text-white uppercase tracking-widest">
                <tr>
                  <th className="px-4 py-3 font-black">Data/Hora</th>
                  <th className="px-4 py-3 font-black">Usuário</th>
                  <th className="px-4 py-3 font-black">Ação</th>
                  <th className="px-4 py-3 font-black">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.slice().reverse().map((log) => (
                  <tr key={log.id} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 font-mono">{new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 font-black text-gray-900 uppercase tracking-tighter">{log.userName}</td>
                    <td className="px-4 py-3">
                      <span className={`font-black uppercase px-2 py-1 text-[8px] ${
                        log.action.includes('LOGIN') ? 'bg-green-100 text-green-800' : 
                        log.action.includes('DELETE') ? 'bg-red-100 text-red-800' : 
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-medium">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-24 pt-12 border-t-4 border-gray-900 flex justify-between items-start">
        <div className="max-w-xs">
          <p className="text-xs font-black text-gray-900 uppercase tracking-widest mb-2">ZIP CONSULTORIA</p>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            Este documento é um registro oficial e inalterável das deliberações realizadas via sistema Condovote. 
            A autenticidade deste relatório pode ser verificada junto à administração.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Certificação Digital</p>
          <p className="text-[10px] font-mono text-gray-900">ID: {Math.random().toString(36).substring(2, 15).toUpperCase()}</p>
        </div>
      </div>
    </div>
  );
};
