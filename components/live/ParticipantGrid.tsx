import React from 'react';
import { LiveParticipant } from '../../types';
import { Mic, MicOff, Video, Crown, Shield, User as UserIcon } from 'lucide-react';

interface ParticipantGridProps {
  participants: LiveParticipant[];
  currentUserId: string;
}

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({
  participants,
  currentUserId,
}) => {
  const onlineParticipants = participants.filter(p => p.status !== 'offline');

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const getRoleBadge = (role?: string, assemblyRole?: string) => {
    if (role === 'ADMIN' || assemblyRole === 'administrador') {
      return (
        <span className="flex items-center gap-1 bg-red-950/80 border border-red-700/50 text-red-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
          <Crown size={10} className="text-red-400" /> Admin
        </span>
      );
    }
    if (assemblyRole === 'sindico') {
      return (
        <span className="flex items-center gap-1 bg-amber-950/80 border border-amber-700/50 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
          <Shield size={10} className="text-amber-400" /> Síndico
        </span>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 bg-slate-950 p-3 md:p-6 overflow-y-auto flex items-center justify-center">
      {onlineParticipants.length === 0 ? (
        <div className="text-center py-20 text-slate-500 text-xs">
          Nenhum participante conectado no momento.
        </div>
      ) : (
        <div className="w-full max-w-6xl grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 auto-rows-[160px] md:auto-rows-[200px]">
          {onlineParticipants.map(p => {
            const isSelf = p.userId === currentUserId;
            const initials = getInitials(p.name);
            const isSpeaking = p.hasAudio;

            return (
              <div
                key={p.userId}
                className={`relative bg-slate-900 border rounded-xl md:rounded-2xl p-3 md:p-4 flex flex-col items-center justify-between shadow-xl transition-all duration-300 overflow-hidden group ${
                  isSpeaking 
                    ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-gradient-to-b from-slate-900 to-emerald-950/20' 
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Top badges */}
                <div className="w-full flex items-center justify-between z-10">
                  <div className="text-[10px] md:text-[11px] font-mono font-medium text-slate-400 bg-slate-950/65 px-2 py-0.5 rounded-md border border-slate-800">
                    Un. {p.unit}
                  </div>
                  {getRoleBadge(p.role, p.assemblyRole)}
                </div>

                {/* Center Avatar */}
                <div className="flex flex-col items-center gap-1.5 md:gap-2 my-auto">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-red-650 to-red-800 text-white font-black text-sm md:text-lg flex items-center justify-center shadow-lg border-2 border-slate-800">
                    {initials || <UserIcon size={20} />}
                  </div>
                  <div className="text-center px-1">
                    <h3 className="text-[11px] md:text-xs font-bold text-slate-200 line-clamp-1">
                      {p.name.split(' ')[0]} {isSelf && <span className="text-red-400 font-normal text-[9px]">(Você)</span>}
                    </h3>
                  </div>
                </div>

                {/* Bottom indicators */}
                <div className="w-full flex items-center justify-between pt-1.5 md:pt-2 border-t border-slate-800/80 text-[10px] md:text-[11px] text-slate-400">
                  <div className="flex items-center gap-1">
                    {p.hasAudio ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <Mic size={11} className="animate-pulse" /> <span className="hidden sm:inline">Ativo</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-500">
                        <MicOff size={11} /> <span className="hidden sm:inline">Mudo</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {p.hasVideo && <Video size={11} className="text-blue-400" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
