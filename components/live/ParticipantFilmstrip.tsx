import React from 'react';
import { LiveParticipant } from '../../types';
import { Mic, MicOff, Video, Crown, Shield, User as UserIcon } from 'lucide-react';

interface ParticipantFilmstripProps {
  participants: LiveParticipant[];
  currentUserId: string;
}

export const ParticipantFilmstrip: React.FC<ParticipantFilmstripProps> = ({
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

  return (
    <div className="w-full lg:w-72 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col h-28 lg:h-full shrink-0 overflow-hidden">
      <div className="hidden lg:flex p-2.5 border-b border-slate-800 bg-slate-950/80 font-bold text-[11px] text-slate-400 uppercase tracking-wider items-center justify-between">
        <span>Participantes ({onlineParticipants.length})</span>
      </div>

      <div className="flex-1 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden p-2 flex flex-row lg:flex-col gap-2 items-center lg:items-stretch">
        {onlineParticipants.map(p => {
          const isSelf = p.userId === currentUserId;
          const initials = getInitials(p.name);
          const isSpeaking = p.hasAudio;

          return (
            <div
              key={p.userId}
              className={`w-32 lg:w-full min-w-[120px] bg-slate-950 border rounded-xl p-2 flex lg:flex-row flex-col items-center lg:items-center gap-2 shrink-0 transition-all ${
                isSpeaking 
                  ? 'border-emerald-500 bg-emerald-950/10' 
                  : 'border-slate-800'
              }`}
            >
              <div className="relative shrink-0">
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center border border-slate-700">
                  {initials || <UserIcon size={16} />}
                </div>
                {p.hasAudio && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
                )}
              </div>

              <div className="flex-1 min-w-0 text-center lg:text-left">
                <div className="text-[11px] lg:text-xs font-bold text-slate-200 truncate">
                  {p.name.split(' ')[0]} {isSelf && <span className="text-red-400 text-[9px]">(Você)</span>}
                </div>
                <div className="text-[9px] lg:text-[10px] text-slate-400 font-mono">
                  Un. {p.unit}
                </div>
              </div>

              <div className="hidden lg:block text-slate-400">
                {p.hasAudio ? <Mic size={12} className="text-emerald-400" /> : <MicOff size={12} className="text-slate-600" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
