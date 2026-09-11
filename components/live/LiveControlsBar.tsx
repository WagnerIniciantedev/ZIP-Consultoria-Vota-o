import React from 'react';
import { Button } from '../ui';
import { Mic, MicOff, Video, VideoOff, Share2, LogOut, PhoneOff } from 'lucide-react';

interface LiveControlsBarProps {
  isAdmin: boolean;
  isMicOn: boolean;
  isVideoOn: boolean;
  isSharingScreen: boolean;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onLeaveOrEnd: () => void;
  canSpeak: boolean;
}

export const LiveControlsBar: React.FC<LiveControlsBarProps> = ({
  isAdmin,
  isMicOn,
  isVideoOn,
  isSharingScreen,
  onToggleMic,
  onToggleVideo,
  onToggleScreenShare,
  onLeaveOrEnd,
  canSpeak,
}) => {
  return (
    <div className="bg-slate-900 border-t border-slate-800 px-3 py-2.5 flex items-center justify-center gap-2 md:gap-3 shadow-lg shrink-0">
      {(isAdmin || canSpeak) && (
        <button
          onClick={onToggleMic}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 md:px-4 py-2.5 rounded-xl transition-all ${
            isMicOn ? 'bg-red-650 hover:bg-red-700 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={isMicOn ? 'Silenciar' : 'Ativar Microfone'}
        >
          {isMicOn ? <Mic size={16} /> : <MicOff size={16} />}
          <span className="hidden sm:inline">{isMicOn ? 'Silenciar' : 'Áudio'}</span>
        </button>
      )}

      {isAdmin && (
        <>
          <button
            onClick={onToggleVideo}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 md:px-4 py-2.5 rounded-xl transition-all ${
              isVideoOn ? 'bg-red-650 hover:bg-red-700 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
            title={isVideoOn ? 'Parar Câmera' : 'Câmera'}
          >
            {isVideoOn ? <Video size={16} /> : <VideoOff size={16} />}
            <span className="hidden sm:inline">{isVideoOn ? 'Parar Câmera' : 'Câmera'}</span>
          </button>

          <button
            onClick={onToggleScreenShare}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 md:px-4 py-2.5 rounded-xl transition-all ${
              isSharingScreen ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
            title={isSharingScreen ? 'Parar Tela' : 'Compartilhar Tela'}
          >
            <Share2 size={16} />
            <span className="hidden lg:inline">{isSharingScreen ? 'Parar Tela' : 'Tela'}</span>
          </button>
        </>
      )}

      <button
        onClick={onLeaveOrEnd}
        className="flex items-center gap-1.5 text-xs font-bold px-3.5 md:px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white ml-auto transition-all"
        title={isAdmin ? 'Encerrar' : 'Sair'}
      >
        {isAdmin ? <PhoneOff size={16} /> : <LogOut size={16} />}
        <span>{isAdmin ? 'Encerrar' : 'Sair'}</span>
      </button>
    </div>
  );
};
