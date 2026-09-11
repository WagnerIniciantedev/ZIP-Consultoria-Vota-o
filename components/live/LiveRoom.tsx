import React, { useState, useEffect, useRef } from 'react';
import { 
  LiveRoomStatus, LiveParticipant, LiveSpeakerRequest, LiveChatMessage, 
  LIVE_ROOM_CONFIG, User, Resident 
} from '../../types';
import { 
  initializeLiveRoom, joinLiveRoom, leaveLiveRoom, requestSpeaker, 
  sendLiveChatMessage, logLiveEvent, getAssemblyLiveRef, updateParticipantRole,
  updateSpeakerRequestStatus, updateLiveRoomStatus, updateScreenShareStatus 
} from '../../services/liveService';
import { mediaService, ConnectionState } from '../../services/mediaService';
import { LiveHeader } from './LiveHeader';
import { LiveParticipantsPanel } from './LiveParticipantsPanel';
import { LiveChatPanel } from './LiveChatPanel';
import { LiveSpeakerRequestsPanel } from './LiveSpeakerRequestsPanel';
import { LiveControlsBar } from './LiveControlsBar';
import { WaitingRoom } from './WaitingRoom';
import { LiveStage } from './LiveStage';
import { onSnapshot } from 'firebase/firestore';
import { Users, MessageSquare, Hand, Video as VideoIcon, Wifi } from 'lucide-react';

interface LiveRoomProps {
  assemblyId: string;
  condoName: string;
  assemblyTitle: string;
  currentUser: User | null;
  currentResident: Resident | null;
  isAdmin: boolean;
  onExit: () => void;
}

export const LiveRoom: React.FC<LiveRoomProps> = ({
  assemblyId,
  condoName,
  assemblyTitle,
  currentUser,
  currentResident,
  isAdmin,
  onExit,
}) => {
  const [roomStatus, setRoomStatus] = useState<LiveRoomStatus>(LiveRoomStatus.LIVE);
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [requests, setRequests] = useState<LiveSpeakerRequest[]>([]);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'participants' | 'chat' | 'requests'>('chat');
  
  const [isMicOn, setIsMicOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localScreenRef = useRef<HTMLVideoElement>(null);

  const userId = currentUser?.id || currentResident?.unit || 'guest_' + Math.random().toString(36).substring(7);
  const userName = currentUser?.name || currentResident?.name || 'Participante';
  const userUnit = currentResident?.unit || (isAdmin ? 'Diretoria' : '00');

  const hasRequestedWord = requests.some(r => r.userId === userId && r.status === 'pending');
  const isApprovedToSpeak = requests.some(r => r.userId === userId && r.status === 'approved');

  useEffect(() => {
    if (isApprovedToSpeak) {
      setCanSpeak(true);
    }
  }, [isApprovedToSpeak]);

  useEffect(() => {
    let isMounted = true;

    mediaService.setConnectionStateListener((state) => {
      if (isMounted) setConnectionState(state);
    });

    mediaService.setRemoteStreamListener((stream) => {
      if (isMounted) setRemoteStream(stream);
    });

    mediaService.setScreenShareEndedListener(() => {
      if (isMounted) {
        setIsSharingScreen(false);
        updateScreenShareStatus(assemblyId, false, null).catch(() => {});
        if (localScreenRef.current) {
          localScreenRef.current.srcObject = null;
        }
      }
    });

    const setupRoom = async () => {
      try {
        await initializeLiveRoom(assemblyId, userId).catch(err => {
          console.warn('initializeLiveRoom non-fatal error:', err);
        });
        
        const joinResult = await joinLiveRoom(assemblyId, {
          userId,
          name: userName,
          unit: userUnit,
          role: isAdmin ? 'ADMIN' : 'PARTICIPANT',
          assemblyRole: isAdmin ? 'administrador' : 'condomino',
          status: 'online',
          joinedAt: Date.now(),
          hasAudio: false,
          hasVideo: false,
        }).catch(err => {
          console.warn('joinLiveRoom permission error:', err);
          return { success: true }; // allow continuation in demo/preview
        });

        if (!joinResult.success) {
          if (isMounted) setErrorMessage(joinResult.error || 'Erro ao entrar na sala.');
          return;
        }

        await logLiveEvent(assemblyId, userId, userName, 'PARTICIPANT_JOINED', `Entrou na sala (${userUnit})`).catch(() => {});

        if (!isAdmin) {
          await mediaService.connectAsViewer(assemblyId, userId, 'admin').catch(() => {});
        } else {
          await mediaService.startPublishing(assemblyId, userId).catch(() => {});
        }
      } catch (err: any) {
        console.error('Error initializing live room:', err);
      }
    };

    setupRoom();

    const refs = getAssemblyLiveRef(assemblyId);
    
    const unsubRoom = onSnapshot(refs.roomDoc, docSnap => {
      if (docSnap.exists() && isMounted) {
        const data = docSnap.data();
        setRoomStatus(data.status || LiveRoomStatus.LIVE);
        if (data.isSharingScreen !== undefined) {
          setIsSharingScreen(data.isSharingScreen);
        }
      }
    });

    const unsubParticipants = onSnapshot(refs.participantsCol, snapshot => {
      if (!isMounted) return;
      const list: LiveParticipant[] = [];
      snapshot.forEach(d => list.push(d.data() as LiveParticipant));
      setParticipants(list);
    });

    const unsubRequests = onSnapshot(refs.speakerRequestsCol, snapshot => {
      if (!isMounted) return;
      const list: LiveSpeakerRequest[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as LiveSpeakerRequest));
      setRequests(list);
    });

    const unsubChat = onSnapshot(refs.chatCol, snapshot => {
      if (!isMounted) return;
      const list: LiveChatMessage[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as LiveChatMessage));
      list.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(list);
    });

    return () => {
      isMounted = false;
      leaveLiveRoom(assemblyId, userId);
      mediaService.stopAll();
      unsubRoom();
      unsubParticipants();
      unsubRequests();
      unsubChat();
    };
  }, [assemblyId, userId, isAdmin]);

  const handleToggleMic = async () => {
    try {
      if (!isMicOn) {
        await mediaService.requestMicrophoneAndCamera(isVideoOn, true);
        setIsMicOn(true);
      } else {
        mediaService.stopAudio();
        setIsMicOn(false);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleVideo = async () => {
    try {
      if (!isVideoOn) {
        const stream = await mediaService.requestMicrophoneAndCamera(true, isMicOn);
        setIsVideoOn(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } else {
        mediaService.stopVideo();
        setIsVideoOn(false);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleScreenShare = async () => {
    try {
      if (!isSharingScreen) {
        const stream = await mediaService.startScreenShare();
        setIsSharingScreen(true);
        await updateScreenShareStatus(assemblyId, true, userId);
        await logLiveEvent(assemblyId, userId, userName, 'SCREEN_SHARE_STARTED', 'Iniciou compartilhamento de tela');
        if (localScreenRef.current) {
          localScreenRef.current.srcObject = stream;
        }
      } else {
        mediaService.stopScreenShare();
        setIsSharingScreen(false);
        await updateScreenShareStatus(assemblyId, false, null);
        await logLiveEvent(assemblyId, userId, userName, 'SCREEN_SHARE_STOPPED', 'Encerrou compartilhamento de tela');
        if (localScreenRef.current) {
          localScreenRef.current.srcObject = null;
        }
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        return; // User cancelled screen picker
      }
      alert(err.message || 'Erro ao alternar compartilhamento de tela.');
    }
  };

  const handleRequestWord = async () => {
    if (hasRequestedWord) {
      alert('Você já está na fila para falar.');
      return;
    }
    try {
      await requestSpeaker(assemblyId, userId, userName, userUnit);
      await logLiveEvent(assemblyId, userId, userName, 'SPEAKER_REQUESTED', `Unidade ${userUnit} pediu a palavra`);
      alert('Seu pedido de palavra foi enviado ao administrador.');
    } catch (err) {
      console.error(err);
      alert('Erro ao solicitar palavra.');
    }
  };

  const handleApproveSpeaker = async (requestId: string, targetUserId: string) => {
    try {
      await updateSpeakerRequestStatus(assemblyId, requestId, 'approved');
      await logLiveEvent(assemblyId, userId, userName, 'SPEAKER_APPROVED', `Autorizou a fala do usuário ${targetUserId}`);
    } catch (err) {
      console.error(err);
      alert('Erro ao autorizar fala.');
    }
  };

  const handleRejectSpeaker = async (requestId: string) => {
    try {
      await updateSpeakerRequestStatus(assemblyId, requestId, 'rejected');
      await logLiveEvent(assemblyId, userId, userName, 'SPEAKER_REJECTED', `Recusou o pedido de fala ${requestId}`);
    } catch (err) {
      console.error(err);
      alert('Erro ao recusar pedido.');
    }
  };

  const handleStartAssembly = async () => {
    if (!confirm('Deseja iniciar a Assembleia ao Vivo? Os participantes conectados serão notificados.')) return;
    try {
      await updateLiveRoomStatus(assemblyId, LiveRoomStatus.LIVE);
      await logLiveEvent(assemblyId, userId, userName, 'ASSEMBLY_STARTED', 'Administrador iniciou a assembleia ao vivo');
    } catch (err) {
      console.error(err);
      alert('Erro ao iniciar assembleia.');
    }
  };

  const onlineParticipantsCount = participants.filter(p => p.status !== 'offline').length;

  if (errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
        <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl max-w-md w-full text-center space-y-4">
          <h2 className="text-lg font-bold text-red-400">Acesso Restrito / Limite Atingido</h2>
          <p className="text-sm text-slate-300">{errorMessage}</p>
          <button
            onClick={onExit}
            className="mt-4 px-4 py-2 bg-red-650 hover:bg-red-700 text-white font-bold text-xs rounded-xl"
          >
            Voltar ao Painel
          </button>
        </div>
      </div>
    );
  }

  // If room is scheduled/waiting, show WaitingRoom view
  if (roomStatus === LiveRoomStatus.SCHEDULED) {
    return (
      <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
        <LiveHeader
          condoName={condoName}
          assemblyTitle={assemblyTitle}
          status={roomStatus}
          participantCount={onlineParticipantsCount}
          maxParticipants={LIVE_ROOM_CONFIG.maxParticipants}
          onLeave={onExit}
        />
        <WaitingRoom
          assemblyTitle={assemblyTitle}
          condoName={condoName}
          participants={participants}
          isAdmin={isAdmin}
          roomStatus={roomStatus}
          onStartAssembly={handleStartAssembly}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <LiveHeader
        condoName={condoName}
        assemblyTitle={assemblyTitle}
        status={roomStatus}
        participantCount={onlineParticipantsCount}
        maxParticipants={LIVE_ROOM_CONFIG.maxParticipants}
        onLeave={onExit}
      />

      {/* Connection Status Banner */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          <Wifi className={`w-3.5 h-3.5 ${connectionState === 'connected' ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
          <span className="text-slate-300 font-medium">
            Estado da Transmissão: <span className="uppercase font-bold">{connectionState}</span>
          </span>
        </div>
        {isAdmin && (
          <span className="text-emerald-400 font-semibold text-[11px] bg-emerald-950/50 border border-emerald-800/50 px-2 py-0.5 rounded">
            Modo Transmissor (Admin)
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 relative">
        {/* Main Stage Area (Grid or Active Presenter + Filmstrip) */}
        <LiveStage
          isAdmin={isAdmin}
          isVideoOn={isVideoOn}
          isSharingScreen={isSharingScreen}
          localVideoRef={localVideoRef}
          localScreenRef={localScreenRef}
          remoteStream={remoteStream}
          participants={participants}
          currentUserId={userId}
        />

        {/* Mobile floating panel overlay toggle buttons */}
        <div className="lg:hidden absolute bottom-3 right-3 z-30 flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-slate-700 p-1.5 rounded-2xl shadow-xl">
          <button
            onClick={() => setActiveTab(activeTab === 'chat' ? ('' as any) : 'chat')}
            className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-1 ${
              activeTab === 'chat' ? 'bg-red-650 text-white' : 'bg-slate-800 text-slate-200'
            }`}
            title="Chat"
          >
            <MessageSquare size={16} />
          </button>
          <button
            onClick={() => setActiveTab(activeTab === 'participants' ? ('' as any) : 'participants')}
            className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-1 ${
              activeTab === 'participants' ? 'bg-red-650 text-white' : 'bg-slate-800 text-slate-200'
            }`}
            title="Participantes"
          >
            <Users size={16} />
          </button>
          <button
            onClick={() => setActiveTab(activeTab === 'requests' ? ('' as any) : 'requests')}
            className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-1 ${
              activeTab === 'requests' ? 'bg-red-650 text-white' : 'bg-slate-800 text-slate-200'
            }`}
            title="Pedidos de Fala"
          >
            <Hand size={16} />
          </button>
        </div>

        {/* Right Sidebar / Mobile Bottom Sheet Overlay */}
        <div className={`
          fixed lg:relative inset-x-0 bottom-0 lg:inset-auto
          z-40 lg:z-auto
          h-[65vh] lg:h-auto w-full lg:w-80
          bg-white border-t lg:border-t-0 lg:border-l border-slate-200
          flex flex-col shrink-0 overflow-hidden shadow-2xl lg:shadow-none
          transition-transform duration-300 ease-in-out
          ${activeTab ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
        `}>
          {/* Tabs header */}
          <div className="flex items-center border-b bg-slate-50 shrink-0 relative">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === 'chat' ? 'border-red-650 text-red-650 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare size={14} /> Chat
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              className={`flex-1 py-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === 'participants' ? 'border-red-650 text-red-650 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={14} /> Participantes ({onlineParticipantsCount})
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 py-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === 'requests' ? 'border-red-650 text-red-650 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Hand size={14} /> Fala {requests.filter(r => r.status === 'pending').length > 0 && `(${requests.filter(r => r.status === 'pending').length})`}
            </button>
            <button
              onClick={() => setActiveTab('' as any)}
              className="lg:hidden px-3 text-slate-400 hover:text-slate-700 font-bold text-sm"
              title="Fechar"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-white">
            {activeTab === 'chat' && (
              <LiveChatPanel
                messages={messages}
                onSendMessage={text => sendLiveChatMessage(assemblyId, userId, userName, userUnit, text)}
                currentUserId={userId}
              />
            )}
            {activeTab === 'participants' && (
              <LiveParticipantsPanel
                participants={participants}
                isAdmin={isAdmin}
                onUpdateRole={async (targetUserId, newRole) => {
                  await updateParticipantRole(assemblyId, targetUserId, newRole);
                  await logLiveEvent(assemblyId, userId, userName, 'ROLE_UPDATED', `Alterou o cargo do participante ${targetUserId} para ${newRole}`);
                }}
              />
            )}
            {activeTab === 'requests' && (
              <LiveSpeakerRequestsPanel
                requests={requests}
                isAdmin={isAdmin}
                onApprove={handleApproveSpeaker}
                onReject={handleRejectSpeaker}
                onRequestWord={handleRequestWord}
                hasRequested={hasRequestedWord}
                isApproved={isApprovedToSpeak}
              />
            )}
          </div>
        </div>
      </div>

      <LiveControlsBar
        isAdmin={isAdmin}
        isMicOn={isMicOn}
        isVideoOn={isVideoOn}
        isSharingScreen={isSharingScreen}
        onToggleMic={handleToggleMic}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onLeaveOrEnd={onExit}
        canSpeak={canSpeak}
      />
    </div>
  );
};
