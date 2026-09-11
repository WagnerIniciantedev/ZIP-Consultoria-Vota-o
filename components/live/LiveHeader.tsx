import React from 'react';
import { LiveRoomStatus } from '../../types';
import { Shield, Users, Radio, ArrowLeft } from 'lucide-react';
import { Button } from '../ui';

interface LiveHeaderProps {
  condoName: string;
  assemblyTitle: string;
  status: LiveRoomStatus;
  participantCount: number;
  maxParticipants: number;
  onLeave: () => void;
}

export const LiveHeader: React.FC<LiveHeaderProps> = ({
  condoName,
  assemblyTitle,
  status,
  participantCount,
  maxParticipants,
  onLeave,
}) => {
  return (
    <header className="bg-slate-900 text-white px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 shadow-md">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onLeave}
          className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
        >
          <ArrowLeft size={16} className="mr-1.5" /> Sair
        </Button>
        <div>
          <h1 className="text-sm font-bold text-slate-100">{condoName}</h1>
          <p className="text-xs text-slate-400">{assemblyTitle || 'Assembleia Geral'}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 self-end sm:self-center">
        <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-full border border-slate-700 text-xs">
          {status === LiveRoomStatus.LIVE ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="font-bold text-red-400 tracking-wider uppercase text-[10px]">AO VIVO</span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="font-bold text-amber-400 tracking-wider uppercase text-[10px]">AGENDADA</span>
            </>
          )}
          <span className="text-slate-500">|</span>
          <div className="flex items-center gap-1 text-slate-300 font-medium">
            <Users size={13} className="text-slate-400" />
            <span>{participantCount} / {maxParticipants} participantes</span>
          </div>
        </div>
      </div>
    </header>
  );
};
