import React, { useState } from 'react';
import { LiveParticipant, LIVE_ROOM_ROLES } from '../../types';
import { Search, Shield, ChevronDown, Check } from 'lucide-react';

interface LiveParticipantsPanelProps {
  participants: LiveParticipant[];
  isAdmin: boolean;
  onUpdateRole?: (userId: string, newRole: string) => void;
}

export const LiveParticipantsPanel: React.FC<LiveParticipantsPanelProps> = ({
  participants,
  isAdmin,
  onUpdateRole
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);

  const onlineParticipants = participants.filter(p => p.status !== 'offline');

  const filtered = onlineParticipants.filter(p => {
    const term = searchTerm.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.unit && p.unit.toLowerCase().includes(term))
    );
  });

  // Priority sorting: presidente, secretario, sindico, subsindico, conselheiro, then others alphabetically
  const rolePriority: { [key: string]: number } = {
    presidente: 1,
    secretario: 2,
    sindico: 3,
    subsindico: 4,
    conselheiro: 5,
    administrador: 6,
  };

  const sorted = [...filtered].sort((a, b) => {
    const ra = rolePriority[a.assemblyRole || ''] || 99;
    const rb = rolePriority[b.assemblyRole || ''] || 99;
    if (ra !== rb) return ra - rb;
    return (a.name || '').localeCompare(b.name || '');
  });

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-3 border-b bg-slate-50 flex items-center justify-between">
        <span className="font-bold text-xs text-slate-700 uppercase tracking-wider">
          Participantes
        </span>
        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
          {onlineParticipants.length} online
        </span>
      </div>

      <div className="p-2 border-b bg-slate-50/50">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou unidade..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
        {sorted.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            Nenhum participante encontrado.
          </div>
        ) : (
          sorted.map(p => {
            const isMenuOpen = activeMenuUserId === p.userId;
            return (
              <div key={p.userId} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors relative">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-100">
                    {p.name ? p.name.substring(0, 2).toUpperCase() : 'US'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                      <span>{p.name}</span>
                      {p.assemblyRole && (
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                          {p.assemblyRole}
                        </span>
                      )}
                      {p.role === 'ADMIN' && !p.assemblyRole && (
                        <span className="bg-red-50 text-red-600 border border-red-100 text-[9px] px-1.5 py-0.5 rounded font-extrabold">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">Unidade {p.unit}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {p.status === 'speaking' ? (
                    <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">Falando</span>
                  ) : p.status === 'requesting_to_speak' ? (
                    <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Pediu a palavra</span>
                  ) : null}

                  {isAdmin && onUpdateRole && (
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenuUserId(isMenuOpen ? null : p.userId)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-500 transition"
                        title="Alterar cargo"
                      >
                        <ChevronDown size={14} />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1">
                          <div className="px-3 py-1.5 border-b text-[10px] font-bold text-slate-400 uppercase">
                            Definir Cargo
                          </div>
                          {LIVE_ROOM_ROLES.map(roleOption => (
                            <button
                              key={roleOption}
                              onClick={() => {
                                onUpdateRole(p.userId, roleOption);
                                setActiveMenuUserId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between capitalize"
                            >
                              <span>{roleOption}</span>
                              {p.assemblyRole === roleOption && <Check size={12} className="text-blue-600" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
