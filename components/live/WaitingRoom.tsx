import React from 'react';
import { Button } from '../ui';
import { Play, Users, Clock, ShieldCheck } from 'lucide-react';
import { LiveParticipant, LiveRoomStatus } from '../../types';

interface WaitingRoomProps {
  assemblyTitle: string;
  condoName: string;
  participants: LiveParticipant[];
  isAdmin: boolean;
  roomStatus: LiveRoomStatus;
  onStartAssembly: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  assemblyTitle,
  condoName,
  participants,
  isAdmin,
  roomStatus,
  onStartAssembly,
}) => {
  const onlineParticipants = participants.filter(p => p.status !== 'offline');

  return (
    <div className="flex-1 flex flex-col items-center justify-between bg-slate-950 p-6 text-white overflow-y-auto relative">
      {/* Background ambient glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-red-950/10 via-transparent to-slate-950 pointer-events-none" />

      <div className="w-full max-w-xl mx-auto my-auto flex flex-col items-center text-center space-y-8 z-10 py-10">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>{roomStatus === LiveRoomStatus.SCHEDULED ? 'Aguardando Início' : 'Assembleia Pausada'}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-100">{assemblyTitle}</h1>
          <p className="text-sm font-medium text-slate-400">{condoName}</p>
        </div>

        {/* Participants Presence Preview */}
        <div className="w-full bg-slate-900/60 backdrop-blur border border-slate-800/80 rounded-2xl p-5 flex flex-col items-center space-y-4">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <Users size={15} className="text-red-500" />
            <span><strong className="text-white font-bold">{onlineParticipants.length}</strong> pessoas na sala de espera</span>
          </div>

          <div className="flex flex-wrap justify-center gap-2 max-w-md">
            {onlineParticipants.slice(0, 8).map(p => {
              const initials = p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
              return (
                <div key={p.userId} className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-full text-xs">
                  <div className="w-6 h-6 rounded-full bg-red-950 text-red-300 font-bold flex items-center justify-center text-[10px] border border-red-800/50">
                    {initials}
                  </div>
                  <span className="text-slate-200 font-medium truncate max-w-[100px]">{p.name.split(' ')[0]}</span>
                  <span className="text-slate-500 text-[10px] font-mono">Un. {p.unit}</span>
                </div>
              );
            })}
            {onlineParticipants.length > 8 && (
              <div className="flex items-center px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono">
                +{onlineParticipants.length - 8} mais
              </div>
            )}
          </div>
        </div>

        {isAdmin ? (
          <div className="w-full space-y-3 pt-2">
            <Button
              onClick={onStartAssembly}
              className="w-full bg-red-650 hover:bg-red-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2.5 text-sm shadow-lg shadow-red-950/40 transition-all"
            >
              <Play size={18} fill="currentColor" /> Iniciar Assembleia ao Vivo
            </Button>
            <p className="text-xs text-slate-500">
              Ao iniciar, a transmissão de vídeo será aberta e os participantes poderão interagir.
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="inline-flex items-center gap-2 text-slate-300 text-sm font-medium">
              <Clock size={16} className="text-red-500 animate-spin" />
              <span>Aguardando o administrador iniciar a transmissão...</span>
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Você já está conectado à sala segura. A assembleia iniciará automaticamente assim que a mesa diretora der início.
            </p>
          </div>
        )}
      </div>

      <div className="w-full text-center py-4 border-t border-slate-900 text-slate-600 text-xs z-10 flex items-center justify-center gap-1.5">
        <ShieldCheck size={14} className="text-slate-500" />
        <span>CondeVote Secure Streaming • Ambiente Auditado</span>
      </div>
    </div>
  );
};
