/**
 * MediaService: Abstraction layer for audio/video, WebRTC MVP signaling, and media streams in Live Assemblies.
 * Designed for MVP (up to 10 participants) and prepared for future SFU/WebRTC professional
 * server migration for 500+ participants without altering UI components.
 */

import { db } from './firebase';
import { 
  collection, deleteDoc, onSnapshot, addDoc 
} from 'firebase/firestore';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed';

export class MediaService {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private signalingUnsubscribes: (() => void)[] = [];
  private connectionState: ConnectionState = 'idle';
  private onConnectionStateChangeCallback?: (state: ConnectionState) => void;
  private onRemoteStreamCallback?: (stream: MediaStream) => void;

  constructor() {}

  public setConnectionStateListener(cb: (state: ConnectionState) => void) {
    this.onConnectionStateChangeCallback = cb;
  }

  public setRemoteStreamListener(cb: (stream: MediaStream) => void) {
    this.onRemoteStreamCallback = cb;
  }

  private updateState(state: ConnectionState) {
    this.connectionState = state;
    if (this.onConnectionStateChangeCallback) {
      this.onConnectionStateChangeCallback(state);
    }
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  async requestMicrophoneAndCamera(video: boolean = false, audio: boolean = true): Promise<MediaStream> {
    try {
      if (this.localStream) {
        const constraints: MediaStreamConstraints = {
          audio: audio ? true : false,
          video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Handle audio track replacement
        const newAudioTrack = newStream.getAudioTracks()[0];
        const existingAudioTrack = this.localStream.getAudioTracks()[0];
        if (newAudioTrack) {
          if (existingAudioTrack) {
            existingAudioTrack.stop();
            this.localStream.removeTrack(existingAudioTrack);
          }
          this.localStream.addTrack(newAudioTrack);
          this.peerConnections.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio' || s.track === null);
            if (sender && sender.track?.kind === 'audio' || (sender && !sender.track)) {
              sender.replaceTrack(newAudioTrack).catch(err => console.warn('[MediaService] Error replacing audio track:', err));
            } else {
              pc.addTrack(newAudioTrack, this.localStream!);
            }
          });
        } else if (!audio && existingAudioTrack) {
          existingAudioTrack.stop();
          this.localStream.removeTrack(existingAudioTrack);
          this.peerConnections.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
            if (sender) sender.replaceTrack(null).catch(() => {});
          });
        }

        // Handle video track replacement
        const newVideoTrack = newStream.getVideoTracks()[0];
        const existingVideoTrack = this.localStream.getVideoTracks()[0];
        if (newVideoTrack) {
          if (existingVideoTrack) {
            existingVideoTrack.stop();
            this.localStream.removeTrack(existingVideoTrack);
          }
          this.localStream.addTrack(newVideoTrack);
          this.peerConnections.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video' || s.track === null);
            if (sender && sender.track?.kind === 'video' || (sender && !sender.track)) {
              sender.replaceTrack(newVideoTrack).catch(err => console.warn('[MediaService] Error replacing video track:', err));
            } else {
              pc.addTrack(newVideoTrack, this.localStream!);
            }
          });
        } else if (!video && existingVideoTrack) {
          existingVideoTrack.stop();
          this.localStream.removeTrack(existingVideoTrack);
          this.peerConnections.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) sender.replaceTrack(null).catch(() => {});
          });
        }

        return this.localStream;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audio ? true : false,
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
      this.localStream = stream;

      // Update existing peer connections with new tracks
      this.peerConnections.forEach(pc => {
        stream.getTracks().forEach(track => {
          const sender = pc.getSenders().find(s => !s.track || s.track.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track).catch(() => {});
          } else {
            pc.addTrack(track, stream);
          }
        });
      });

      return stream;
    } catch (error: any) {
      console.error('[MediaService] Error acquiring media devices:', error);
      throw new Error(this.getFriendlyMediaError(error));
    }
  }

  public stopAudio() {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.stop();
        this.localStream?.removeTrack(track);
      });
      this.peerConnections.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
        if (sender) sender.replaceTrack(null).catch(() => {});
      });
    }
  }

  public stopVideo() {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.stop();
        this.localStream?.removeTrack(track);
      });
      this.peerConnections.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(null).catch(() => {});
      });
    }
  }

  private getSafeKey(assemblyId: string): string {
    return assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private getIceServers(): RTCIceServer[] {
    const stunUrl = (typeof process !== 'undefined' && process.env?.WEBRTC_STUN_URL) || 'stun:stun.l.google.com:19302';
    const servers: RTCIceServer[] = [{ urls: stunUrl }];

    const turnUrl = typeof process !== 'undefined' && process.env?.WEBRTC_TURN_URL;
    if (turnUrl) {
      servers.push({
        urls: turnUrl,
        username: process.env.WEBRTC_TURN_USERNAME,
        credential: process.env.WEBRTC_TURN_CREDENTIAL,
      });
    }
    return servers;
  }

  async startPublishing(assemblyId: string, publisherId: string): Promise<void> {
    this.updateState('connecting');
    const safeKey = this.getSafeKey(assemblyId);
    const signalsRef = collection(db, 'assemblies', safeKey, 'live_signals');

    const unsub = onSnapshot(signalsRef, async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.type === 'offer' && data.targetId === publisherId) {
            const viewerId = data.senderId;
            const offer = data.offer;

            try {
              const pc = new RTCPeerConnection({ iceServers: this.getIceServers() });
              this.peerConnections.set(viewerId, pc);

              if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                  pc.addTrack(track, this.localStream!);
                });
              }

              pc.onicecandidate = async (event) => {
                if (event.candidate) {
                  await addDoc(signalsRef, {
                    type: 'candidate',
                    senderId: publisherId,
                    targetId: viewerId,
                    candidate: event.candidate.toJSON(),
                    timestamp: Date.now()
                  }).catch(() => {});
                }
              };

              pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'connected') {
                  this.updateState('connected');
                } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                  this.updateState('reconnecting');
                }
              };

              await pc.setRemoteDescription(new RTCSessionDescription(offer));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              await addDoc(signalsRef, {
                type: 'answer',
                senderId: publisherId,
                targetId: viewerId,
                answer: answer,
                timestamp: Date.now()
              });

              await deleteDoc(change.doc.ref).catch(() => {});
            } catch (err) {
              console.error('[MediaService] Error handling viewer offer:', err);
            }
          } else if (data.type === 'candidate' && data.targetId === publisherId) {
            const pc = this.peerConnections.get(data.senderId);
            if (pc && data.candidate) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                await deleteDoc(change.doc.ref).catch(() => {});
              } catch (e) {
                console.warn('[MediaService] Error adding ice candidate:', e);
              }
            }
          }
        }
      });
    });

    this.signalingUnsubscribes.push(unsub);
    this.updateState('connected');
  }

  async connectAsViewer(assemblyId: string, viewerId: string, publisherId: string = 'admin'): Promise<void> {
    this.updateState('connecting');
    const safeKey = this.getSafeKey(assemblyId);
    const signalsRef = collection(db, 'assemblies', safeKey, 'live_signals');

    try {
      const pc = new RTCPeerConnection({ iceServers: this.getIceServers() });
      this.peerConnections.set('publisher', pc);

      const remoteStream = new MediaStream();

      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
          remoteStream.addTrack(track);
        });
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(remoteStream);
        }
      };

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await addDoc(signalsRef, {
            type: 'candidate',
            senderId: viewerId,
            targetId: publisherId,
            candidate: event.candidate.toJSON(),
            timestamp: Date.now()
          }).catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          this.updateState('connected');
        } else if (pc.connectionState === 'disconnected') {
          this.updateState('reconnecting');
        } else if (pc.connectionState === 'failed') {
          this.updateState('failed');
        }
      };

      pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.addTransceiver('video', { direction: 'recvonly' });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await addDoc(signalsRef, {
        type: 'offer',
        senderId: viewerId,
        targetId: publisherId,
        offer: offer,
        timestamp: Date.now()
      });

      const unsub = onSnapshot(signalsRef, async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.type === 'answer' && data.targetId === viewerId) {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                await deleteDoc(change.doc.ref).catch(() => {});
              } catch (err) {
                console.error('[MediaService] Error setting remote answer:', err);
              }
            } else if (data.type === 'candidate' && data.targetId === viewerId) {
              try {
                if (data.candidate) {
                  await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                  await deleteDoc(change.doc.ref).catch(() => {});
                }
              } catch (e) {
                console.warn('[MediaService] Error adding viewer ice candidate:', e);
              }
            }
          }
        });
      });

      this.signalingUnsubscribes.push(unsub);
    } catch (error: any) {
      console.error('[MediaService] Error connecting as viewer:', error);
      this.updateState('failed');
    }
  }

  public getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  async startScreenShare(): Promise<MediaStream> {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Compartilhamento de tela não suportado neste navegador.');
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } } as any,
        audio: false,
      });
      this.screenStream = stream;
      
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          if (this.onScreenShareEndedCallback) {
            this.onScreenShareEndedCallback();
          }
          this.stopScreenShare();
        };
        this.peerConnections.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video' || s.track === null);
          if (sender) {
            sender.replaceTrack(videoTrack).catch(err => console.warn('[MediaService] Error replacing track with screen:', err));
          } else {
            pc.addTrack(videoTrack, stream);
          }
        });
      }

      return stream;
    } catch (error: any) {
      if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
        throw error;
      }
      console.error('[MediaService] Error starting screen share:', error);
      throw new Error('Não foi possível iniciar o compartilhamento de tela.');
    }
  }

  private onScreenShareEndedCallback?: () => void;
  public setScreenShareEndedListener(cb: () => void) {
    this.onScreenShareEndedCallback = cb;
  }

  stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    const cameraTrack = this.localStream?.getVideoTracks()[0] || null;
    this.peerConnections.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video' || s.track === null);
      if (sender) {
        sender.replaceTrack(cameraTrack).catch(() => {});
      }
    });
  }

  stopAll() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.stopScreenShare();

    this.peerConnections.forEach((pc) => {
      pc.close();
    });
    this.peerConnections.clear();

    this.signalingUnsubscribes.forEach(unsub => unsub());
    this.signalingUnsubscribes = [];

    this.updateState('disconnected');
  }

  private getFriendlyMediaError(error: any): string {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'O acesso ao microfone/câmera foi bloqueado. Verifique as permissões do navegador.';
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'Nenhum dispositivo de áudio ou vídeo foi encontrado no seu sistema.';
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return 'O dispositivo de mídia já está sendo usado por outro aplicativo.';
    }
    return 'Erro ao acessar os dispositivos de mídia.';
  }
}

export const mediaService = new MediaService();
