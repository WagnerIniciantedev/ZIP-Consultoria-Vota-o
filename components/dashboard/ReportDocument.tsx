
import React from 'react';
import { Poll, VoteRecord, Resident, PollCalculationType, SystemLog } from '../../types';
import { Badge } from '../ui';
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
  return (
    <div id="report-content" className={`bg-white ${isForPDF ? 'p-10 w-[800px]' : 'p-0'}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-10 border-b-2 border-red-600 pb-6">
        <div>
          <img 
            src="https://i.postimg.cc/Y0w6w1cm/Whats-App-Image-2025-11-29-at-22-21-41-removebg-preview.png" 
            alt="ZIP Logo" 
            className="h-32 w-auto mb-4 brightness-0" 
            referrerPolicy="no-referrer"
          />
          <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">Relatório de Assembleia</h1>
          <p className="text-gray-600 font-medium">{condoName}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Data da Assembleia</p>
          <p className="text-lg font-bold text-gray-900">{new Date(date).toLocaleDateString('pt-BR')}</p>
          <p className="text-xs text-gray-500 mt-1">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-6 mb-10">
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total de Enquetes</p>
          <p className="text-2xl font-bold text-gray-900">{polls.length}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total de Votos</p>
          <p className="text-2xl font-bold text-gray-900">{votes.length}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Unidades Participantes</p>
          <p className="text-2xl font-bold text-gray-900">{new Set(votes.map(v => v.unit)).size}</p>
        </div>
      </div>

      {/* Polls Results */}
      <div className="space-y-12">
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
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">{index + 1}</span>
                <h2 className="text-xl font-bold text-gray-900">{poll.title}</h2>
              </div>
              <p className="text-gray-600 text-sm mb-6 ml-11">{poll.description}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 ml-11">
                {/* Chart */}
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="votos"
                        nameKey="name"
                        isAnimationActive={!isForPDF}
                      >
                        {chartData.map((_entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend and Stats */}
                <div className="space-y-4">
                  {chartData.map((d, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                          <span className="font-bold text-gray-700">{d.name}</span>
                        </div>
                        <span className="text-gray-900 font-bold">{d.percent}% <span className="text-gray-400 font-normal ml-1">({d.votos} pts)</span></span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-red-600 h-full" 
                          style={{ width: `${d.percent}%`, backgroundColor: COLORS[i % COLORS.length] }}
                        ></div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-gray-100 text-right">
                    <p className="text-xs text-gray-400 uppercase font-bold">Total de Pontos Válidos</p>
                    <p className="text-lg font-bold text-gray-900">{Number(totalWeight.toFixed(4))}</p>
                  </div>
                </div>
              </div>

              {/* Voter List for this poll */}
              <div className="mt-8 ml-11">
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-3 tracking-widest">Lista de Votantes</h3>
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-2 font-bold text-gray-600">Unidade</th>
                        <th className="px-4 py-2 font-bold text-gray-600">Morador</th>
                        <th className="px-4 py-2 font-bold text-gray-600">Nome Zoom</th>
                        <th className="px-4 py-2 font-bold text-gray-600">Opção</th>
                        {poll.calculationType !== PollCalculationType.NORMAL && (
                          <th className="px-4 py-2 font-bold text-gray-600">Peso</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
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
                          <tr key={idx} className={v.isDelinquentVote ? 'bg-red-50' : ''}>
                            <td className="px-4 py-2 font-bold">{v.unit}</td>
                            <td className="px-4 py-2">{resident?.name || 'N/A'}</td>
                            <td className="px-4 py-2 italic">{v.zoomName || '-'}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded-full ${v.isDelinquentVote ? 'bg-gray-200 text-gray-600' : 'bg-red-50 text-red-700'}`}>
                                {opt?.text || 'N/A'}
                              </span>
                            </td>
                            {poll.calculationType !== PollCalculationType.NORMAL && (
                              <td className="px-4 py-2 font-mono">{weight.toFixed(4)}</td>
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
        <div className="mt-16 break-before-page">
          <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Histórico de Movimentações</h2>
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 font-bold text-gray-600">Data/Hora</th>
                  <th className="px-4 py-3 font-bold text-gray-600">Usuário</th>
                  <th className="px-4 py-3 font-bold text-gray-600">Ação</th>
                  <th className="px-4 py-3 font-bold text-gray-600">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.slice().reverse().map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 text-gray-500">{new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 font-bold">{log.userName}</td>
                    <td className="px-4 py-3">
                      <Badge color={log.action.includes('LOGIN') ? 'green' : log.action.includes('DELETE') ? 'red' : 'blue'}>
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-20 pt-10 border-t border-gray-100 text-center">
        <p className="text-sm font-bold text-gray-900">ZIP CONSULTORIA E ASSESSORIA CONDOMINIAL</p>
        <p className="text-xs text-gray-400 mt-1">Relatório oficial gerado pelo sistema Condovote</p>
      </div>
    </div>
  );
};
