import React from 'react';
import { RemoteVideo } from './RemoteVideo';
import { ParticipantGrid } from './ParticipantGrid';
import { ParticipantFilmstrip } from './ParticipantFilmstrip';
import { LiveParticipant } from '../../types';
import { Video as VideoIcon, Radio } from 'lucide-react';

interface LiveStageProps {
  isAdmin: boolean;
  isVideoOn: boolean;
  isSharingScreen: boolean;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  localScreenRef: React.RefObject<HTMLVideoElement | null>;
  remoteStream: MediaStream | null;
  participants: LiveParticipant[];
  currentUserId: string;
}

export const LiveStage: React.FC<LiveStageProps> = ({
  isAdmin,
  isVideoOn,
  isSharingScreen,
  localVideoRef,
  localScreenRef,
  remoteStream,
  participants,
  currentUserId,
}) => {
  // Determine if there is an active broadcaster / presenter
  const hasActivePresenter = isAdmin ? (isVideoOn || isSharingScreen) : (remoteStream !== null);

  if (!hasActivePresenter && !isSharingScreen) {
    // If no one is broadcasting, show the Participant Grid
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-slate-950 overflow-hidden">
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-red-500 animate-pulse" />
            <span className="font-bold text-slate-200">Assembleia ao Vivo — Visão Geral dos Participantes</span>
          </div>
          <span className="text-[11px] text-slate-400">Nenhum apresentador ativo no palco principal</span>
        </div>
        <ParticipantGrid participants={participants} currentUserId={currentUserId} />
      </div>
    );
  }

  // Active Presenter or Screen Share on Stage + Filmstrip
  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 bg-slate-950 overflow-hidden">
      {/* Main Stage */}
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 relative p-4 overflow-hidden min-h-0">
        <div className="w-full h-full max-w-6xl max-h-[85vh] bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl">
          <div className="absolute top-4 left-4 z-20 bg-slate-900/85 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="font-bold text-slate-200">
              {isSharingScreen ? 'Apresentação de Tela (Compartilhamento)' : (isAdmin ? 'Painel de Transmissão (Admin)' : 'Palco Principal (Mesa Diretora)')}
            </span>
          </div>

          {isAdmin ? (
            <div className="w-full h-full relative flex items-center justify-center bg-slate-950">
              {isSharingScreen ? (
                <>
                  <video
                    ref={localScreenRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain bg-black"
                  />
                  {isVideoOn && (
                    <div className="absolute bottom-4 right-4 w-44 h-32 bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-2xl z-30">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        style={{ transform: 'scaleX(-1)' }}
                      />
                    </div>
                  )}
                </>
              ) : isVideoOn ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <VideoIcon size={48} className="stroke-[1.5] text-slate-600" />
                  <p className="text-xs font-medium text-slate-400">Câmera desativada. Clique em "Câmera" para transmitir.</p>
                </div>
              )}
            </div>
          ) : (
            <RemoteVideo
              stream={remoteStream}
              className="w-full h-full"
              label={isSharingScreen ? 'Apresentação de Tela' : 'Transmissão da Mesa Diretora'}
              objectFit={isSharingScreen ? 'contain' : 'cover'}
            />
          )}
        </div>
      </div>

      {/* Filmstrip sidebar */}
      <ParticipantFilmstrip participants={participants} currentUserId={currentUserId} />
    </div>
  );
};
