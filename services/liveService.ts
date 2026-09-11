/**
 * liveService.ts: Handles Firestore operations and real-time listeners for Live Assemblies.
 * Respects existing Firestore structure and minimizes unnecessary read/writes.
 */

import { db } from './firebase';
import { 
  doc, setDoc, getDoc, updateDoc, collection, addDoc, getDocs 
} from 'firebase/firestore';
import { LiveParticipant, LiveRoomStatus, LIVE_ROOM_CONFIG } from '../types';

export const getSafeUserId = (userId: string) => {
  return userId.replace(/[^a-zA-Z0-9_-]/g, '_');
};

export const getAssemblyLiveRef = (assemblyId: string) => {
  const safeKey = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
  return {
    roomDoc: doc(db, 'assemblies', safeKey, 'live_room', 'status'),
    participantsCol: collection(db, 'assemblies', safeKey, 'live_participants'),
    speakerRequestsCol: collection(db, 'assemblies', safeKey, 'live_speaker_requests'),
    chatCol: collection(db, 'assemblies', safeKey, 'live_chat'),
    eventsCol: collection(db, 'assemblies', safeKey, 'live_events'),
  };
};

export async function initializeLiveRoom(assemblyId: string, userId: string): Promise<void> {
  const refs = getAssemblyLiveRef(assemblyId);
  const docSnap = await getDoc(refs.roomDoc);
  if (!docSnap.exists()) {
    await setDoc(refs.roomDoc, {
      status: LiveRoomStatus.SCHEDULED,
      maxParticipants: LIVE_ROOM_CONFIG.maxParticipants,
      maxPublishers: LIVE_ROOM_CONFIG.maxPublishers,
      maxActiveSpeakers: LIVE_ROOM_CONFIG.maxActiveSpeakers,
      startedAt: Date.now(),
      startedBy: getSafeUserId(userId),
    }, { merge: true });
  }
}

export async function updateLiveRoomStatus(assemblyId: string, status: LiveRoomStatus, activePublisherId?: string | null): Promise<void> {
  const refs = getAssemblyLiveRef(assemblyId);
  const payload: any = { status };
  if (activePublisherId !== undefined) {
    payload.activePublisherId = activePublisherId;
  }
  if (status === LiveRoomStatus.ENDED) {
    payload.endedAt = Date.now();
    payload.activePublisherId = null;
  }
  await updateDoc(refs.roomDoc, payload);
}

export async function updateActivePublisher(assemblyId: string, activePublisherId: string | null): Promise<void> {
  const refs = getAssemblyLiveRef(assemblyId);
  await updateDoc(refs.roomDoc, { activePublisherId });
}

export async function updateScreenShareStatus(assemblyId: string, isSharingScreen: boolean, ownerId?: string | null): Promise<void> {
  const refs = getAssemblyLiveRef(assemblyId);
  await updateDoc(refs.roomDoc, {
    isSharingScreen,
    screenShareOwnerId: isSharingScreen ? (ownerId || null) : null,
  }).catch(() => {});
}

export async function joinLiveRoom(
  assemblyId: string, 
  participant: LiveParticipant
): Promise<{ success: boolean; error?: string }> {
  const refs = getAssemblyLiveRef(assemblyId);
  
  // Check max participants limit
  const participantsSnap = await getDocs(refs.participantsCol);
  const onlineCount = participantsSnap.docs.filter(d => d.data().status !== 'offline').length;
  
  if (onlineCount >= LIVE_ROOM_CONFIG.maxParticipants && participant.role !== 'ADMIN') {
    return { success: false, error: 'Esta sala atingiu o limite máximo de participantes.' };
  }

  const safeUserId = getSafeUserId(participant.userId);
  const userRef = doc(refs.participantsCol, safeUserId);
  await setDoc(userRef, {
    ...participant,
    userId: safeUserId,
    status: 'online',
    joinedAt: Date.now(),
  }, { merge: true });

  return { success: true };
}

export async function leaveLiveRoom(assemblyId: string, userId: string): Promise<void> {
  const refs = getAssemblyLiveRef(assemblyId);
  const safeUserId = getSafeUserId(userId);
  const userRef = doc(refs.participantsCol, safeUserId);
  await updateDoc(userRef, { status: 'offline' }).catch(() => {});
}

export async function updateParticipantRole(assemblyId: string, userId: string, assemblyRole: string): Promise<void> {
  const refs = getAssemblyLiveRef(assemblyId);
  const safeUserId = getSafeUserId(userId);
  const userRef = doc(refs.participantsCol, safeUserId);
  await updateDoc(userRef, { assemblyRole });
}

export async function requestSpeaker(assemblyId: string, userId: string, name: string, unit: string): Promise<string> {
  const refs = getAssemblyLiveRef(assemblyId);
  const reqRef = await addDoc(refs.speakerRequestsCol, {
    userId,
    name,
    unit,
    status: 'pending',
    timestamp: Date.now(),
  });
  return reqRef.id;
}

export async function updateSpeakerRequestStatus(assemblyId: string, requestId: string, status: 'approved' | 'rejected'): Promise<void> {
  const refs = getAssemblyLiveRef(assemblyId);
  const reqRef = doc(refs.speakerRequestsCol, requestId);
  await updateDoc(reqRef, { status });
}

export async function sendLiveChatMessage(assemblyId: string, userId: string, name: string, unit: string, message: string): Promise<void> {
  const refs = getAssemblyLiveRef(assemblyId);
  const sanitized = message.replace(/<[^>]*>?/gm, '').trim();
  if (!sanitized) return;
  
  await addDoc(refs.chatCol, {
    userId,
    name,
    unit,
    message: sanitized.substring(0, 500),
    timestamp: Date.now(),
  });
}

export async function logLiveEvent(assemblyId: string, userId: string, userName: string, action: string, details?: string): Promise<void> {
  const refs = getAssemblyLiveRef(assemblyId);
  await addDoc(refs.eventsCol, {
    userId,
    userName,
    action,
    details: details || '',
    timestamp: Date.now(),
  }).catch(() => {});
}
