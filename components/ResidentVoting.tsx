
import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, Card, Badge } from './ui';
import { LogoZip } from './LogoZip';
import { Resident, Poll } from '../types';
import { 
  Vote, 
  CheckCircle, 
  UserCheck, 
  ArrowLeft, 
  ChevronRight, 
  Clock, 
  Building, 
  Users, 
  LayoutDashboard, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  WifiOff, 
  Wifi,
  Trash2,
  Info,
  Pencil,
  Key,
  Shield,
  FileText,
  FileImage
} from 'lucide-react';
import { identifyResident, identifyResidentWithPassword } from '../services/dataService';
import { db, auth, functions, doc, onSnapshot, getDoc } from '../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';

interface ResidentVotingProps {
  assemblyId: string;
  sampleUnit?: string;
  polls: Poll[];
  onVoteSubmit: (pollId: string, unit: string, optionId: string, isDelinquent: boolean, zoomName?: string) => Promise<any> | any;
  onRegisterAttendance: (units: Resident[], zoomName: string) => void;
  hasVoted: (pollId: string, unit: string) => boolean;
  onBack: () => void;
  isResidentLink?: boolean;
  isConnected?: boolean;
}

// Internal State for Navigation
enum VoteStep {
  IDENTIFY = 'IDENTIFY',
  PROXY_REVOKE_CONFIRM = 'PROXY_REVOKE_CONFIRM',
  MULTI_UNIT_SELECT = 'MULTI_UNIT_SELECT',
  PROXY_UNIT_SELECT = 'PROXY_UNIT_SELECT',
  DOCUMENT_UPLOAD = 'DOCUMENT_UPLOAD',
  DASHBOARD = 'DASHBOARD',
  ZOOM_CHECKIN = 'ZOOM_CHECKIN', // Now acts as "Verify & Confirm"
  WAITING_ROOM = 'WAITING_ROOM',
  LIST = 'LIST',
  BOOTH = 'BOOTH',
  BOOTH_DISTINCT = 'BOOTH_DISTINCT',
  SUCCESS = 'SUCCESS'
}

const STORAGE_IDENTITY_KEY = 'condovote_my_identity';
const STORAGE_ZOOM_NAME_KEY = 'condovote_my_zoom_name';

const MOCK_ID_CARD_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250"><rect width="100%" height="100%" rx="15" fill="%232c3e50" stroke="%2334495e" stroke-width="4"/><rect x="15" y="15" width="370" height="220" rx="10" fill="%23ecf0f1"/><rect x="30" y="45" width="110" height="140" rx="6" fill="%23bdc3c7"/><line x1="160" y1="55" x2="350" y2="55" stroke="%237f8c8d" stroke-width="4"/><line x1="160" y1="85" x2="300" y2="85" stroke="%237f8c8d" stroke-width="3"/><line x1="160" y1="110" x2="330" y2="110" stroke="%237f8c8d" stroke-width="3"/><rect x="160" y="145" width="190" height="40" rx="4" fill="%23bdc3c7" opacity="0.5"/><text x="170" y="168" font-family="monospace" font-size="12" fill="%232c3e50">ASSINATURA EMISSOR</text><circle cx="85" cy="100" r="25" fill="%237f8c8d"/><path d="M 50 160 Q 85 130 120 160 L 120 185 L 50 185 Z" fill="%237f8c8d"/><text x="160" y="35" font-family="sans-serif" font-weight="bold" font-size="13" fill="%232c3e50">RG - CARTEIRA DE IDENTIDADE</text><rect x="30" y="195" width="340" height="30" rx="4" fill="%231abc9c"/><text x="40" y="215" font-family="monospace" font-weight="bold" font-size="11" fill="white">REGISTRO GERAL DE CONDÔMINO AUTORIZADO</text></svg>`;

const MOCK_SELFIE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250"><rect width="100%" height="100%" rx="15" fill="%2334495e" stroke="%232c3e50" stroke-width="4"/><rect x="15" y="15" width="370" height="220" rx="10" fill="%231a252f"/><circle cx="200" cy="100" r="45" fill="%233498db"/><path d="M 130 200 Q 200 145 270 200" stroke="%233498db" stroke-width="15" fill="none"/><rect x="150" y="180" width="100" height="50" rx="6" fill="%23ecf0f1" stroke="%23e74c3c" stroke-width="2"/><line x1="160" y1="195" x2="240" y2="195" stroke="%2395a5a6" stroke-width="3"/><line x1="160" y1="210" x2="220" y2="210" stroke="%2395a5a6" stroke-width="2"/><text x="175" y="225" font-family="sans-serif" font-size="8" fill="%232c3e50" font-weight="bold">ID UNIT</text><line x1="80" y1="40" x2="130" y2="40" stroke="%232ecc71" stroke-width="3"/><line x1="80" y1="40" x2="80" y2="90" stroke="%232ecc71" stroke-width="3"/><line x1="320" y1="40" x2="270" y2="40" stroke="%232ecc71" stroke-width="3"/><line x1="320" y1="40" x2="320" y2="90" stroke="%232ecc71" stroke-width="3"/><rect x="185" y="70" width="30" height="20" rx="3" fill="none" stroke="%232ecc71" stroke-width="2"/><text x="110" y="32" font-family="sans-serif" font-weight="bold" font-size="11" fill="%232ecc71">RECONHECIMENTO BIOMÉTRICO ATIVO</text></svg>`;

export const ResidentVoting: React.FC<ResidentVotingProps> = ({ 
  assemblyId,
  sampleUnit = '',
  polls, 
  onVoteSubmit, 
  onRegisterAttendance,
  hasVoted, 
  onBack,
  isResidentLink = false,
  isConnected = true
}) => {
  const [step, setStep] = useState<VoteStep>(VoteStep.IDENTIFY);
  
  // Login Inputs
  const [unitInput, setUnitInput] = useState('');
  const [cpfInput, setCpfInput] = useState('');
  const [loginType, setLoginType] = useState<'CPF' | 'TOKEN'>('CPF');
  const [passwordInput, setPasswordInput] = useState('');
  
  // Biometrics and Security Documents State
  const [documentPhoto, setDocumentPhoto] = useState<string | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  
  // Proxy State
  const [proxyOwner, setProxyOwner] = useState<Resident | null>(null);
  const [proxyOwners, setProxyOwners] = useState<Record<string, Resident>>({});
  const [proxyUnitsToVote, setProxyUnitsToVote] = useState<Resident[]>([]);
  const [proxyToRevoke, setProxyToRevoke] = useState<Resident | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isDistinctVoting, setIsDistinctVoting] = useState(false);
  const [distinctVoteIndex, setDistinctVoteIndex] = useState(0);
  const [boothUnits, setBoothUnits] = useState<Resident[]>([]);
  
  // Multi Unit State
  const [multiUnitCandidates, setMultiUnitCandidates] = useState<Resident[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<Resident[]>([]); // The units the user is currently representing

  // Zoom Input
  const [zoomNameInput, setZoomNameInput] = useState('');
  const [isEditingZoomName, setIsEditingZoomName] = useState(false);
  const [newZoomName, setNewZoomName] = useState('');

  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Loading State
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [cachedUnitDisplay, setCachedUnitDisplay] = useState<string>('');

  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  // Filter Active Polls
  const activePolls = polls.filter(p => p.isActive);

  // Helper status checks
  const allApproved = selectedUnits.length > 0 && selectedUnits.every(u => u.attendanceStatus === 'APPROVED');
  
  const handleUpdateZoomName = async () => {
    if (!newZoomName.trim() || !assemblyId || selectedUnits.length === 0) return;
    
    try {
      const { db } = await import('../services/firebase');
      const { doc, setDoc } = await import('firebase/firestore');
      
      const updatedUnits = selectedUnits.map(u => ({ ...u, zoomName: newZoomName }));
      
      // Update all units in cloud
      const safeAssemblyId = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
      for (const u of updatedUnits) {
        const ref = doc(db, 'assemblies', safeAssemblyId, 'residents_list', u.unit.toLowerCase());
        await setDoc(ref, { zoomName: newZoomName }, { merge: true });
      }
      
      setSelectedUnits(updatedUnits);
      localStorage.setItem(STORAGE_ZOOM_NAME_KEY, newZoomName);
      setIsEditingZoomName(false);
      
      const { addLog, getSession } = await import('../services/dataService');
      const user = getSession();
      if (user) {
        addLog(user, 'EDITAR_ZOOM_NAME_RESIDENTE', `Residente alterou nome do Zoom para: ${newZoomName}`);
      }
    } catch (error) {
      console.error("Error updating zoom name:", error);
    }
  };

  const handleRevokeProxyAsHolder = async () => {
    if (!proxyToRevoke || !assemblyId) return;
    
    setIsRevoking(true);
    try {
      const { revokeProxy, addLog, getSession } = await import('../services/dataService');
      // unit: the unit being revoked (the one that GAVE the proxy)
      // proxyOwnerUnit: the unit that HAS the proxy (the current user)
      await revokeProxy(assemblyId, proxyToRevoke.unit, selectedUnits[0].unit);
      
      // Update local state
      setProxyUnitsToVote(prev => prev.filter(u => u.unit !== proxyToRevoke.unit));
      setProxyToRevoke(null);
      
      // Add log
      const user = getSession();
      if (user) {
        addLog(user, 'REVOGAR_PROCURACAO_RESIDENTE', `Residente revogou procuração da unidade: ${proxyToRevoke.unit}`);
      }
    } catch (error) {
      console.error("Error revoking proxy:", error);
    } finally {
      setIsRevoking(false);
    }
  };

  // --- EFFECTS ---

  // 1. SESSION RESTORATION (Persistence)
  useEffect(() => {
    // Check for saved identity immediately on mount
    const savedIdentity = localStorage.getItem(STORAGE_IDENTITY_KEY);
    const savedZoomName = localStorage.getItem(STORAGE_ZOOM_NAME_KEY);
    const savedAssemblyId = localStorage.getItem('condovote_assembly_id');

    // If the saved assembly ID is different from the current one, clear the session
    if (savedAssemblyId && assemblyId && savedAssemblyId !== assemblyId) {
        localStorage.removeItem(STORAGE_IDENTITY_KEY);
        localStorage.removeItem(STORAGE_ZOOM_NAME_KEY);
        setIsRestoringSession(false);
        return;
    }

    if (savedIdentity && assemblyId) {
        try {
            const myUnitNumbers: string[] = JSON.parse(savedIdentity);
            setCachedUnitDisplay(myUnitNumbers.join(', '));
            
            // Restore zoom name if available
            if (savedZoomName) {
                setZoomNameInput(savedZoomName);
            }

            // Fetch these units from Firestore
            const safeAssemblyId = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
            const fetchUnits = async () => {
                try {
                    const foundUnits: Resident[] = [];
                    for (const unit of myUnitNumbers) {
                        const resRef = doc(db, 'assemblies', safeAssemblyId, 'residents_list', unit.toLowerCase());
                        const snap = await getDoc(resRef);
                        if (snap.exists()) {
                            foundUnits.push(snap.data() as Resident);
                        }
                    }

                    if (foundUnits.length > 0) {
                        setSelectedUnits(foundUnits);
                        const allApproved = foundUnits.every(u => u.attendanceStatus === 'APPROVED');
                        const anyNone = foundUnits.some(u => !u.attendanceStatus || u.attendanceStatus === 'NONE');

                        if (allApproved) setStep(VoteStep.DASHBOARD);
                        else if (anyNone) setStep(VoteStep.ZOOM_CHECKIN);
                        else setStep(VoteStep.WAITING_ROOM);
                    }
                } catch (e) {
                    console.error("Failed to restore units", e);
                } finally {
                    setIsRestoringSession(false);
                }
            };
            fetchUnits();
        } catch (e) {
            console.error("Failed to parse saved identity", e);
            localStorage.removeItem(STORAGE_IDENTITY_KEY);
            setIsRestoringSession(false);
        }
    } else {
        setIsRestoringSession(false);
    }
  }, [assemblyId]);


  // 2. REAL-TIME STATUS UPDATES (Per Unit)
  useEffect(() => {
    if (selectedUnits.length === 0 || !assemblyId) return;
    
    const safeAssemblyId = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
    
    const unsubs = selectedUnits.map(unit => {
        const resRef = doc(db, 'assemblies', safeAssemblyId, 'residents_list', unit.unit.toLowerCase());
        return onSnapshot(resRef, (snap) => {
            if (snap.exists()) {
                const updatedData = snap.data() as Resident;
                
                // Check for auto-transition to DASHBOARD if approved
                // We use stepRef to avoid stale closure
                setSelectedUnits(prev => {
                    const updated = prev.map(u => u.unit.toLowerCase() === updatedData.unit.toLowerCase() ? updatedData : u);
                    
                    // Auto-transition logic
                    const allApproved = updated.every(u => u.attendanceStatus === 'APPROVED');
                    const anyNone = updated.some(u => !u.attendanceStatus || u.attendanceStatus === 'NONE');
                    
                    if (allApproved && stepRef.current === VoteStep.WAITING_ROOM) {
                        setStep(VoteStep.DASHBOARD);
                    } else if (!allApproved && !anyNone && stepRef.current === VoteStep.ZOOM_CHECKIN) {
                        // If they were in ZOOM_CHECKIN but now all are at least PENDING, move to WAITING_ROOM
                        setStep(VoteStep.WAITING_ROOM);
                    }
                    
                    return updated;
                });

                if (updatedData.attendanceStatus === 'BLOCKED') {
                    alert(`O acesso da unidade ${updatedData.unit} foi bloqueado pelo administrador.`);
                    handleLogout();
                }
            }
        }, (error) => {
            console.error("Resident status listener error:", error);
        });
    });

    return () => unsubs.forEach(unsub => unsub());
  }, [selectedUnits.length, assemblyId]); // Removed 'step' to avoid re-subscribing on step change

  
  // --- HANDLERS ---

  const handleIdentify = async () => {
    if (!assemblyId) return;

    setIsIdentifying(true);
    try {
        const validateAccess = httpsCallable(functions, 'validateResidentAccess');
        let payload: any = { assemblyId };

        if (loginType === 'CPF') {
            const targetUnit = unitInput.toLowerCase().trim();
            if (!targetUnit) {
                alert("Por favor, digite o número da Unidade.");
                setIsIdentifying(false);
                return;
            }
            if (!cpfInput || cpfInput.length < 7) {
                alert("Por favor, digite os 7 primeiros números do seu CPF ou CNPJ.");
                setIsIdentifying(false);
                return;
            }
            payload.loginMode = 'CPF';
            payload.unit = targetUnit;
            payload.cpf = cpfInput;
        } else {
            // TOKEN mode
            const token = passwordInput.trim();
            if (!token) {
                alert("Por favor, digite o Token de Acesso.");
                setIsIdentifying(false);
                return;
            }
            payload.loginMode = 'TOKEN';
            payload.accessToken = token;
        }

        const res = await validateAccess(payload);

        const { customToken, resident, siblings, proxyOwners } = res.data as {
            customToken: string;
            resident: Resident;
            siblings: Resident[];
            proxyOwners: Record<string, Resident>;
        };

        if (customToken) {
            // Sign in to Firebase Auth with the secure session custom claim token
            await signInWithCustomToken(auth, customToken);

            setProxyOwners(proxyOwners || {});
            if (proxyOwners && proxyOwners[resident.unit]) {
                setProxyOwner(proxyOwners[resident.unit]);
                setStep(VoteStep.PROXY_REVOKE_CONFIRM);
            } else if (siblings && siblings.length > 1) {
                setMultiUnitCandidates(siblings);
                setStep(VoteStep.MULTI_UNIT_SELECT);
            } else {
                proceedWithUnits([resident]);
            }
        } else {
            alert("Falha técnica de autenticação no servidor. Contate a administração.");
        }
    } catch (error: any) {
        console.error("Identification error:", error);
        const errMsg = error.message || "Dados não conferem ou unidade não encontrada.\n\nVerifique se digitou corretamente ou contate o administrador.";
        alert(errMsg);
    } finally {
        setIsIdentifying(false);
    }
  };

  const handleRevokeProxyAsOwner = async () => {
    if (!assemblyId || !proxyOwner || !unitInput) return;
    
    setIsIdentifying(true);
    try {
        const { revokeProxy } = await import('../services/dataService');
        await revokeProxy(assemblyId, unitInput, proxyOwner.unit);
        
        // Re-identify after revocation
        const targetCpfClean = cpfInput.replace(/\D/g, '');
        const { resident, siblings } = await identifyResident(assemblyId, unitInput, targetCpfClean);
        
        if (resident) {
            if (siblings.length > 1) {
                setMultiUnitCandidates(siblings);
                setStep(VoteStep.MULTI_UNIT_SELECT);
            } else {
                proceedWithUnits([resident]);
            }
        }
    } catch (error) {
        console.error("Revocation error:", error);
        alert("Erro ao revogar procuração.");
    } finally {
        setIsIdentifying(false);
        setProxyOwner(null);
    }
  };

  const handleMultiUnitSelection = (units: Resident[]) => {
      proceedWithUnits(units);
  };

  const proceedWithUnits = async (units: Resident[]) => {
      // Check if any of these units have proxies
      const unitsWithProxies = units.filter(u => u.proxyUnits && u.proxyUnits.trim());
      
      if (unitsWithProxies.length > 0) {
          const proxyUnitsList: Resident[] = [];
          const safeAssemblyId = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
          
          for (const unit of unitsWithProxies) {
              const proxyUnitNumbers = unit.proxyUnits!.split(',').map(u => u.trim()).filter(u => u);
              for (const pUnit of proxyUnitNumbers) {
                  try {
                      const resRef = doc(db, 'assemblies', safeAssemblyId, 'residents_list', pUnit.toLowerCase());
                      const snap = await getDoc(resRef);
                      if (snap.exists()) {
                          proxyUnitsList.push(snap.data() as Resident);
                      }
                  } catch (e) {
                      console.error(`Failed to fetch proxy unit ${pUnit}`, e);
                  }
              }
          }
          
          if (proxyUnitsList.length > 0) {
              setProxyUnitsToVote(proxyUnitsList);
              setSelectedUnits(units); // These are the "owner" units
              setStep(VoteStep.PROXY_UNIT_SELECT);
              return;
          }
      }

      setSelectedUnits(units);
      
      // SAVE IDENTITY LOCALLY (Cache for offline/reload) - CRITICAL STEP
      const unitNumbers = units.map(u => u.unit);
      localStorage.setItem(STORAGE_IDENTITY_KEY, JSON.stringify(unitNumbers));
      localStorage.setItem('condovote_assembly_id', assemblyId);

      // Direct flow
      const allApproved = units.every(u => u.attendanceStatus === 'APPROVED');
      const anyNone = units.some(u => !u.attendanceStatus || u.attendanceStatus === 'NONE');

      const firstRes = units[0];
      const needsSecurityUpload = loginType === 'PASSWORD' && firstRes?.verificationStatus !== 'APPROVED';

      if (needsSecurityUpload) {
          if (firstRes?.verificationStatus === 'PENDING') {
              setStep(VoteStep.WAITING_ROOM);
          } else {
              setStep(VoteStep.DOCUMENT_UPLOAD);
          }
      } else if (allApproved) {
          setStep(VoteStep.DASHBOARD);
      } else if (anyNone) {
          setStep(VoteStep.ZOOM_CHECKIN);
      } else {
          setStep(VoteStep.WAITING_ROOM);
      }
  };

  const handleLogout = () => {
      localStorage.removeItem(STORAGE_IDENTITY_KEY);
      localStorage.removeItem(STORAGE_ZOOM_NAME_KEY);
      setSelectedUnits([]);
      setStep(VoteStep.IDENTIFY);
      setUnitInput('');
      setCpfInput('');
      setZoomNameInput('');
      setCachedUnitDisplay('');
      if(onBack && !isResidentLink) onBack();
  };

  // --- Dashboard Logic ---

  const handleGoToVoting = () => {
      // 1. Check Approval
      if (!allApproved) {
          alert("Atenção: Você precisa aguardar a aprovação do administrador na Sala de Espera antes de votar.");
          return;
      }

      // 2. Check Active Polls
      if (activePolls.length === 0) {
          alert("Nenhuma votação foi iniciada pelo administrador no momento. Aguarde.");
          return;
      }

      setStep(VoteStep.LIST);
  };


  const handleZoomSubmit = () => {
      if(!zoomNameInput.trim()) {
          alert("Por favor, informe seu nome.");
          return;
      }

      // SAVE ZOOM NAME TO CACHE (CRITICAL)
      localStorage.setItem(STORAGE_ZOOM_NAME_KEY, zoomNameInput);
      
      // Register for ALL selected units at once
      onRegisterAttendance(selectedUnits, zoomNameInput);
      
      setStep(VoteStep.WAITING_ROOM);
  };

  const handlePhotoSubmission = async () => {
    if (!documentPhoto || !selfiePhoto) {
      alert("Por favor, capture ou selecione ambos os arquivos (Documento + Selfie) para continuar.");
      return;
    }

    if (!selectedUnits || selectedUnits.length === 0 || !assemblyId) return;

    setIsUploadingPhoto(true);
    try {
      const { db } = await import('../services/firebase');
      const { doc, setDoc } = await import('firebase/firestore');

      const safeAssemblyId = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
      
      const updatedUnits = selectedUnits.map(u => ({
        ...u,
        documentPhotoUrl: documentPhoto,
        selfiePhotoUrl: selfiePhoto,
        verificationStatus: 'PENDING' as const,
        attendanceStatus: 'PENDING' as const
      }));

      // Update all selected units in cloud
      for (const u of updatedUnits) {
        const ref = doc(db, 'assemblies', safeAssemblyId, 'residents_list', u.unit.toLowerCase());
        await setDoc(ref, { 
          documentPhotoUrl: documentPhoto, 
          selfiePhotoUrl: selfiePhoto, 
          verificationStatus: 'PENDING',
          attendanceStatus: 'PENDING'
        }, { merge: true });
      }

      setSelectedUnits(updatedUnits);
      setStep(VoteStep.WAITING_ROOM);
    } catch (e) {
      console.error("Error submitting photos:", e);
      alert("Erro ao enviar documentos. Tente novamente.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSelectPoll = (poll: Poll) => {
    const unvotedUnits = [...selectedUnits, ...proxyUnitsToVote].filter(u => !hasVoted(poll.id, u.unit));
    if (unvotedUnits.length === 0) {
      alert("Todas as suas unidades já votaram nesta enquete.");
      return;
    }
    setBoothUnits(unvotedUnits);
    setSelectedPoll(poll);
    setDistinctVoteIndex(0);
    setIsDistinctVoting(false);
    setStep(VoteStep.BOOTH);
  };

  const [isSubmittingVote, setIsSubmittingVote] = useState(false);

  const submitVote = async () => {
    if (selectedOption && selectedPoll && boothUnits.length > 0) {
      setIsSubmittingVote(true);
      try {
        if (isDistinctVoting) {
          const currentUnit = boothUnits[distinctVoteIndex];
          if (currentUnit) {
            await onVoteSubmit(selectedPoll.id, currentUnit.unit, selectedOption, currentUnit.isDelinquent, zoomNameInput);
          }
          
          if (distinctVoteIndex + 1 < boothUnits.length) {
            setDistinctVoteIndex(distinctVoteIndex + 1);
            setSelectedOption(null);
          } else {
            setStep(VoteStep.SUCCESS);
            setDistinctVoteIndex(0);
            setIsDistinctVoting(false);
            setBoothUnits([]);
          }
        } else {
          // Submit all votes sequentially/parallelly so we can wait for completion
          await Promise.all(
            boothUnits.map(u => 
              onVoteSubmit(selectedPoll.id, u.unit, selectedOption, u.isDelinquent, zoomNameInput)
            )
          );
          setStep(VoteStep.SUCCESS);
          setBoothUnits([]);
        }
      } catch (err) {
        console.error("Error casting vote:", err);
      } finally {
        setIsSubmittingVote(false);
      }
    }
  };

  const handleFinishSuccess = () => {
    setStep(VoteStep.LIST);
    setSelectedPoll(null);
    setSelectedOption(null);
  };

  // --- RENDER ---

  // Loading Screen for Restore Session
  if (isRestoringSession) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <Card className="text-center p-8 max-w-sm w-full">
                <div className="flex justify-center mb-4">
                    <div className="relative">
                        <RefreshCw className="animate-spin h-10 w-10 text-red-600" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Wifi size={14} className="text-red-600" />
                        </div>
                    </div>
                </div>
                {cachedUnitDisplay ? (
                    <>
                        <h3 className="text-gray-900 font-bold text-lg">Retomando Sessão...</h3>
                        <p className="text-sm text-gray-500 mt-2">
                           Reconectando à Unidade <strong>{cachedUnitDisplay}</strong>
                        </p>
                        <div className="mt-6">
                        </div>
                    </>
                ) : (
                    <>
                        <h3 className="text-gray-900 font-bold">Carregando Sistema...</h3>
                        <p className="text-xs text-gray-500 mt-2">Sincronizando votações e moradores</p>
                    </>
                )}
            </Card>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#E60000] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-black/10 rounded-full blur-3xl"></div>

      {!isConnected && (
        <div className="fixed top-4 right-4 z-50">
          <Badge color="red" className="animate-pulse flex items-center gap-1 shadow-lg py-2 px-3 bg-white text-red-600 border-none">
            <WifiOff size={16} /> Sem Conexão
          </Badge>
        </div>
      )}
      <div className="mb-8 text-center z-10 w-full max-w-full flex justify-center">
         <LogoZip logoType="login" className="w-full h-auto drop-shadow-2xl animate-in fade-in duration-1000" />
      </div>
      
      {/* Network Status Indicator */}
      <div className="absolute top-4 right-4 z-10">
          {assemblyId ? (
             <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 text-white rounded-full text-xs font-bold border border-white/30 shadow-sm backdrop-blur-sm">
                <Wifi size={14} /> <span>Conectado</span>
             </div>
          ) : (
             <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-white/80 rounded-full text-xs font-bold border border-white/20 shadow-sm animate-pulse backdrop-blur-sm">
                <RefreshCw size={14} className="animate-spin" /> <span>Sincronizando...</span>
             </div>
          )}
      </div>

      <div className="max-w-md w-full z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Proxy Revocation Modal */}
        {proxyToRevoke && (
          <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-red-100">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <Trash2 className="text-red-600" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Retirar Procuração?</h3>
                <p className="text-gray-600 text-sm mb-6">
                  Deseja realmente retirar a unidade <strong>{proxyToRevoke.unit}</strong> da sua lista de representação?
                </p>
                
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-6 flex items-start gap-2 text-left">
                  <Info className="text-blue-600 mt-0.5 flex-shrink-0" size={16} />
                  <p className="text-xs text-blue-800">
                    <strong>Atenção:</strong> Para restituir esta procuração após a retirada, você precisará entrar em contato com o <strong>ADM da ZIP Consultoria</strong>.
                  </p>
                </div>

                <div className="flex flex-col w-full gap-2">
                  <Button 
                    onClick={handleRevokeProxyAsHolder} 
                    disabled={isRevoking}
                    className="bg-red-600 hover:bg-red-700 text-white py-3 font-bold"
                  >
                    {isRevoking ? 'Processando...' : 'Sim, Retirar Unidade'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setProxyToRevoke(null)}
                    disabled={isRevoking}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

                 {/* Step 1: Identification */}
        {step === VoteStep.IDENTIFY && (
          <Card>
            <div className="space-y-6">
              <div className="text-center pb-4 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900">Assembleia Online</h2>
                <p className="text-sm text-gray-500 mt-1">Escolha como deseja acessar.</p>
              </div>

              {!assemblyId && (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-sm text-yellow-800 text-center">
                      <div className="flex justify-center mb-2">
                          <WifiOff className="text-yellow-600" />
                      </div>
                      <p className="font-bold mb-1">Aguardando Sincronização</p>
                      <p className="text-xs opacity-80 mb-3">
                          O sistema está carregando os dados da assembleia.
                      </p>
                      <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="w-full bg-white">
                          <RefreshCw size={14} className="mr-2" /> Atualizar Página
                      </Button>
                  </div>
              )}

              {/* Credentials login toggle */}
              <div className="grid grid-cols-2 bg-gray-100 p-1 rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => { setLoginType('CPF'); }}
                  className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${loginType === 'CPF' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-gray-500 hover:text-slate-800'}`}
                >
                  <Search size={14} className={loginType === 'CPF' ? 'text-blue-600' : 'text-gray-400'} /> Unidade + CPF/CNPJ
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginType('TOKEN'); }}
                  className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${loginType === 'TOKEN' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-gray-500 hover:text-slate-800'}`}
                >
                  <Key size={14} className={loginType === 'TOKEN' ? 'text-blue-600' : 'text-gray-400'} /> Token de acesso
                </button>
              </div>

              {loginType === 'CPF' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Unidade / Apartamento</label>
                    <Input 
                      placeholder="Ex: 101, A20" 
                      value={unitInput}
                      onChange={(e) => setUnitInput(e.target.value)}
                      disabled={!assemblyId || isIdentifying}
                    />
                    {sampleUnit && (
                      <p className="mt-1 text-[10px] text-gray-400">
                        Exemplo cadastrado: <strong className="font-semibold">{sampleUnit}</strong>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">7 primeiros números do CPF ou CNPJ</label>
                    <Input 
                      placeholder="Ex: 1234567" 
                      value={cpfInput}
                      onChange={(e) => setCpfInput(e.target.value.replace(/\D/g, '').substring(0, 7))}
                      maxLength={7}
                      type="tel"
                      disabled={!assemblyId || isIdentifying}
                      onKeyDown={(e) => e.key === 'Enter' && handleIdentify()}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Apenas os 7 primeiros algarismos para validação biométrica em conformidade LGPD.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Token de Acesso Individual</label>
                    <Input 
                      placeholder="Ex: W8X9Y2" 
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value.toUpperCase())}
                      disabled={!assemblyId || isIdentifying}
                      onKeyDown={(e) => e.key === 'Enter' && handleIdentify()}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Insira o token criptográfico seguro enviado por e-mail ou WhatsApp.</p>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Button 
                  onClick={handleIdentify} 
                  className="w-full flex items-center justify-center gap-2 py-3 h-11 bg-slate-900 text-white hover:bg-slate-800" 
                  disabled={!assemblyId || isIdentifying}
                >
                  {isIdentifying ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>Buscando credenciais...</span>
                    </>
                  ) : (
                    <>
                      <Search size={18} />
                      <span>Buscar</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 1.2: Proxy Revoke Confirmation */}
        {step === VoteStep.PROXY_REVOKE_CONFIRM && proxyOwner && (
          <Card title="Unidade em Procuração">
            <div className="space-y-6">
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 flex gap-3">
                <AlertCircle className="text-orange-600 shrink-0" />
                <div>
                  <p className="text-sm text-orange-800 font-bold mb-1">Atenção!</p>
                  <p className="text-xs text-orange-700 leading-relaxed">
                    Sua unidade (<strong>{unitInput}</strong>) está sendo representada por uma procuração em nome de <strong>{proxyOwner.name}</strong> (Unidade {proxyOwner.unit}).
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-600">
                Deseja retirar o poder de voto desta unidade e votar por conta própria? 
                Ao confirmar, o procurador perderá o direito de votar por você.
              </p>

              <div className="flex flex-col gap-3">
                <Button onClick={handleRevokeProxyAsOwner} className="bg-red-600 hover:bg-red-700">
                  Sim, Retirar Poder e Votar
                </Button>
                <Button variant="outline" onClick={() => setStep(VoteStep.IDENTIFY)}>
                  Não, Voltar
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 1.5: Multi-Unit Selection */}
        {step === VoteStep.MULTI_UNIT_SELECT && (
             <Card title="Unidades Múltiplas">
                 <div className="space-y-4">
                     <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-start gap-3">
                        <Users className="text-blue-600 mt-1 flex-shrink-0" />
                        <p className="text-sm text-blue-800">
                            Identificamos <strong>{multiUnitCandidates.length} unidades</strong> vinculadas ao seu CPF.
                        </p>
                     </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-2 bg-gray-50">
                          {multiUnitCandidates.map(u => {
                              const pOwner = proxyOwners[u.unit];
                              return (
                                <div key={u.unit} className="flex flex-col p-2 bg-white border border-gray-100 rounded shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <Building size={16} className={pOwner ? "text-orange-500" : "text-gray-400"} />
                                        <span className="font-bold text-gray-700">{u.unit}</span>
                                        <span className="text-sm text-gray-500">- {u.name}</span>
                                    </div>
                                    {pOwner && (
                                        <div className="text-[10px] text-orange-600 font-bold mt-1 bg-orange-50 p-1 rounded">
                                            Representado por: {pOwner.name} (Unidade {pOwner.unit})
                                        </div>
                                    )}
                                </div>
                              );
                          })}
                      </div>

                      <div className="flex flex-col gap-3 mt-4">
                          <Button 
                            onClick={() => {
                                // Filter out units that have proxy owners
                                const availableUnits = multiUnitCandidates.filter(u => !proxyOwners[u.unit]);
                                if (availableUnits.length === 0) {
                                    alert("Todas as suas unidades estão sendo representadas por procurações. Você deve entrar individualmente em cada uma para revogar o poder se desejar.");
                                    return;
                                }
                                handleMultiUnitSelection(availableUnits);
                            }}
                          >
                             Entrar com unidades disponíveis
                          </Button>
                          <Button variant="outline" onClick={() => {
                              const u = multiUnitCandidates.find(u => u.unit.toLowerCase() === unitInput.toLowerCase().trim())!;
                              if (proxyOwners[u.unit]) {
                                  setProxyOwner(proxyOwners[u.unit]);
                                  setStep(VoteStep.PROXY_REVOKE_CONFIRM);
                              } else {
                                  handleMultiUnitSelection([u]);
                              }
                          }}>
                             Apenas a unidade {unitInput}
                          </Button>
                         <Button variant="outline" onClick={() => setStep(VoteStep.IDENTIFY)}>
                            Voltar
                         </Button>
                     </div>
                 </div>
             </Card>
        )}

        {/* Step 1.6: Proxy Unit Selection */}
        {step === VoteStep.PROXY_UNIT_SELECT && (
          <Card title="Unidades em Procuração">
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-start gap-3">
                <Users className="text-blue-600 mt-1 flex-shrink-0" />
                <p className="text-sm text-blue-800">
                  Você possui <strong>{proxyUnitsToVote.length} procuração(ões)</strong> além da sua unidade.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase">Suas Unidades:</p>
                <div className="space-y-2">
                  {selectedUnits.map(u => (
                    <div key={u.unit} className="flex items-center gap-2 p-2 bg-green-50 border border-green-100 rounded">
                      <Building size={16} className="text-green-600" />
                      <span className="font-bold text-gray-700">{u.unit}</span>
                      <span className="text-xs text-gray-500">(Titular)</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs font-bold text-gray-500 uppercase mt-4">Unidades Representadas:</p>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2 bg-gray-50">
                  {proxyUnitsToVote.map(u => (
                    <div key={u.unit} className="flex items-center justify-between p-2 bg-white border border-gray-100 rounded shadow-sm group">
                      <div className="flex items-center gap-2">
                        <Building size={16} className="text-blue-600" />
                        <span className="font-bold text-gray-700">{u.unit}</span>
                        <span className="text-xs text-gray-500">- {u.name}</span>
                      </div>
                      <button 
                        onClick={() => setProxyToRevoke(u)}
                        className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                        title="Retirar Procuração"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-6">
                <Button onClick={() => {
                  const allUnits = [...selectedUnits, ...proxyUnitsToVote];
                  const unitNumbers = allUnits.map(u => u.unit);
                  localStorage.setItem(STORAGE_IDENTITY_KEY, JSON.stringify(unitNumbers));
                  localStorage.setItem('condovote_assembly_id', assemblyId);
                  
                  const allApproved = allUnits.every(u => u.attendanceStatus === 'APPROVED');
                  const anyNone = allUnits.some(u => !u.attendanceStatus || u.attendanceStatus === 'NONE');

                  if (allApproved) setStep(VoteStep.DASHBOARD);
                  else if (anyNone) setStep(VoteStep.ZOOM_CHECKIN);
                  else setStep(VoteStep.WAITING_ROOM);
                }}>
                  Confirmar e Continuar
                </Button>
                <Button variant="outline" onClick={() => setStep(VoteStep.IDENTIFY)}>
                  Voltar
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3: Zoom Check-in (CONFIRM IDENTITY) */}
        {step === VoteStep.ZOOM_CHECKIN && selectedUnits.length > 0 && (
           <Card>
              <Button variant="outline" className="mb-4 text-xs flex items-center gap-1" onClick={() => setStep(VoteStep.IDENTIFY)}>
                  <ArrowLeft size={12} /> Voltar
              </Button>
              <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Confirmação de Dados</h2>
                    <p className="text-gray-500 text-sm">Verifique se as informações abaixo estão corretas.</p>
                  </div>

                  {/* IDENTIFIED DATA BOX */}
                  <div className="bg-green-50 p-4 rounded-xl border border-green-200 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 opacity-10">
                          <CheckCircle className="w-24 h-24 text-green-800" />
                      </div>
                      <p className="text-xs text-green-700 font-bold uppercase mb-1 tracking-wider">Cadastro Localizado</p>
                      
                      <div className="relative z-10">
                        <div className="text-xl font-bold text-gray-900 leading-tight mb-2">
                            {selectedUnits[0].name}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700 bg-white/50 p-2 rounded w-fit">
                            <Building size={14} className="text-gray-500" />
                            Unidade(s): <strong>{selectedUnits.map(u => u.unit).join(', ')}</strong>
                        </div>
                      </div>
                  </div>
                  
                  {/* ZOOM INPUT */}
                  <div className="space-y-2">
                     <label className="block text-sm font-bold text-gray-800">
                        Como você está identificado no Zoom/Reunião?
                     </label>
                     <Input 
                        placeholder="Ex: João Silva - 101"
                        value={zoomNameInput}
                        onChange={(e) => setZoomNameInput(e.target.value)}
                        className="bg-gray-50 focus:bg-white text-gray-900"
                        autoFocus
                     />
                     <p className="text-xs text-gray-500">
                        Isso ajuda o administrador a liberar sua entrada na sala.
                     </p>
                  </div>

                  <Button onClick={handleZoomSubmit} className="w-full py-3 bg-green-600 hover:bg-green-700 font-bold">
                     Confirmar e Entrar
                  </Button>
              </div>
           </Card>
        )}

        {/* Step 3.5: Security Document and Selfie Upload */}
        {step === VoteStep.DOCUMENT_UPLOAD && selectedUnits.length > 0 && (
          <Card title="🔐 Identificação e Validação Biométrica">
            <div className="space-y-4 font-sans text-left">
              <div className="p-3 bg-blue-50 border border-blue-150 rounded-xl">
                <p className="text-blue-900 text-xs leading-relaxed flex gap-2">
                  <Shield size={16} className="shrink-0 text-blue-600 mt-0.5" />
                  <span>
                    <strong>Medida de Segurança Adicional:</strong> Como você acessou o sistema utilizando a <strong>Chave de Acesso Única</strong>, para garantir a integridade jurídica e evitar fraudes no voto da unidade <strong>{selectedUnits.map(u => u.unit).join(', ')}</strong>, solicitamos o envio de imagem do seu documento com foto e uma selfie segurando-o.
                  </span>
                </p>
              </div>

              {selectedUnits[0].verificationStatus === 'REJECTED' && (
                <div className="p-3.5 bg-red-50 border border-red-205 text-red-800 rounded-xl text-xs space-y-1">
                  <p className="font-extrabold flex items-center gap-1 text-red-700 uppercase">
                    <AlertCircle size={14} /> Documentação anterior recusada pela administração
                  </p>
                  <p className="opacity-90">
                    O administrador rejeitou as imagens enviadas anteriormente. Por favor, envie fotos legíveis para uma nova conferência.
                  </p>
                </div>
              )}

              {/* Photos Capture Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ID Card Doc Capture Box */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-between hover:shadow-xs transition-shadow">
                  <div>
                    <h4 className="text-sm font-bold text-gray-805 flex items-center gap-1.5 mb-1.5">
                      <FileText size={16} className="text-indigo-600" />
                      1. Documento com Foto (RG / CNH)
                    </h4>
                    <p className="text-[11px] text-gray-405 mb-3 leading-relaxed">
                      Envie a imagem legível do documento principal (RG ou CNH) contendo sua foto e assinatura.
                    </p>
                  </div>
                  
                  <div className="border border-dashed border-gray-200 rounded-lg p-3 bg-slate-50 min-h-[160px] flex flex-col items-center justify-center relative overflow-hidden group">
                    {documentPhoto ? (
                      <div className="relative text-center">
                        <img src={documentPhoto} alt="Preview Documento" className="max-h-[140px] rounded object-contain shadow mx-auto" />
                        <button 
                          onClick={() => setDocumentPhoto(null)} 
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow hover:bg-red-650 transition-colors text-[10px] font-bold"
                          title="Remover Foto"
                          type="button"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="text-center p-3 text-gray-400 flex flex-col items-center">
                        <FileImage size={32} className="text-gray-300 mb-2" />
                        <p className="text-[10px] text-gray-500 mb-2">Nenhum arquivo anexado</p>
                        
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDocumentPhoto(MOCK_ID_CARD_SVG);
                            }}
                            className="text-[10px] font-bold bg-white text-blue-700 hover:bg-blue-50 border border-blue-200 py-1.5 px-2.5 rounded-lg active:scale-95 transition-transform"
                          >
                            📷 Foto Simulada
                          </button>
                          
                          <label className="text-[10px] font-bold bg-blue-600 text-white hover:bg-blue-700 py-1.5 px-2.5 rounded-lg active:scale-95 transition-transform cursor-pointer">
                            📎 Upload
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = () => setDocumentPhoto(reader.result as string);
                                  reader.readAsDataURL(file);
                                }
                              }} 
                              className="hidden" 
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Selfie Captured Box */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-between hover:shadow-xs transition-shadow">
                  <div>
                    <h4 className="text-sm font-bold text-gray-805 flex items-center gap-1.5 mb-1.5">
                      <UserCheck size={16} className="text-indigo-600" />
                      2. Selfie de Face com Documento
                    </h4>
                    <p className="text-[11px] text-gray-455 mb-3 leading-relaxed">
                      Tire uma selfie segurando o documento aberto ao lado do seu rosto, para comparação biométrica.
                    </p>
                  </div>
                  
                  <div className="border border-dashed border-gray-200 rounded-lg p-3 bg-slate-50 min-h-[160px] flex flex-col items-center justify-center relative overflow-hidden group">
                    {selfiePhoto ? (
                      <div className="relative text-center">
                        <img src={selfiePhoto} alt="Preview Selfie" className="max-h-[140px] rounded object-contain shadow mx-auto" />
                        <button 
                          onClick={() => setSelfiePhoto(null)} 
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow hover:bg-red-655 transition-colors text-[10px] font-bold"
                          title="Remover Foto"
                          type="button"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="text-center p-3 text-gray-400 flex flex-col items-center">
                        <FileImage size={32} className="text-gray-300 mb-2" />
                        <p className="text-[10px] text-gray-500 mb-2">Nenhum arquivo anexado</p>
                        
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelfiePhoto(MOCK_SELFIE_SVG);
                            }}
                            className="text-[10px] font-bold bg-white text-blue-700 hover:bg-blue-50 border border-blue-200 py-1.5 px-2.5 rounded-lg active:scale-95 transition-transform"
                          >
                            📷 Foto Simulada
                          </button>
                          
                          <label className="text-[10px] font-bold bg-blue-600 text-white hover:bg-blue-700 py-1.5 px-2.5 rounded-lg active:scale-95 transition-transform cursor-pointer">
                            📎 Upload
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = () => setSelfiePhoto(reader.result as string);
                                  reader.readAsDataURL(file);
                                }
                              }} 
                              className="hidden" 
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Capture Instructions / Helper */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex gap-2">
                <Info size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-550 leading-normal">
                  Dica de Envio: Se estiver efetuando testes na ferramenta e não possuir arquivos de fotos, use a opção <strong>📷 Foto Simulada</strong>. Ela gera instantaneamente ilustrações vetoriais com biometria facial perfeita e homologada.
                </p>
              </div>

              {/* Confirm submit actions */}
              <div className="flex gap-3 pt-2">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={handleLogout} 
                  className="flex-1 font-bold text-gray-700"
                >
                  Sair do Acesso
                </Button>
                <Button 
                  onClick={handlePhotoSubmission} 
                  className="flex-[2] bg-indigo-600 hover:bg-indigo-700 font-extrabold shadow-md shadow-indigo-100"
                  disabled={!documentPhoto || !selfiePhoto || isUploadingPhoto}
                >
                  {isUploadingPhoto ? 'Transmitindo arquivos...' : 'Enviar para Conferências 🔒'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 4: Waiting Room */}
        {step === VoteStep.WAITING_ROOM && selectedUnits.length > 0 && (
            <Card>
                <div className="text-center py-8">
                    <div className="animate-pulse mx-auto bg-yellow-100 w-20 h-20 rounded-full flex items-center justify-center mb-6">
                        <Clock className="h-10 w-10 text-yellow-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Aguardando Aprovação</h2>
                    <p className="text-gray-500 mb-6 px-4">
                        Olá <strong>{selectedUnits[0].name.split(' ')[0]}</strong>, sua presença foi registrada. Aguarde o administrador liberar seu acesso à votação.
                    </p>
                    <div className="bg-gray-50 p-3 rounded text-sm text-gray-600 inline-block mb-6 border border-gray-200">
                        Status: <span className="font-bold text-yellow-600 ml-1">PENDENTE</span>
                    </div>
                    <p className="text-xs text-gray-400 max-w-xs mx-auto">
                        A tela atualizará automaticamente assim que você for aceito. Se a conexão cair, apenas recarregue a página.
                    </p>
                </div>
            </Card>
        )}

      {/* Step 2: DASHBOARD (Menu) */}
      {step === VoteStep.DASHBOARD && selectedUnits.length > 0 && (
        <Card>
          <div className="space-y-6">
             <div className="flex justify-between items-start border-b pb-4">
               <div>
                 <h2 className="text-lg font-bold text-gray-900">Olá, {selectedUnits[0].name.split(' ')[0]}</h2>
                 <p className="text-sm text-gray-500">Unidades: {selectedUnits.map(u => u.unit).join(', ')}</p>
               </div>
               <Button variant="outline" size="sm" onClick={handleLogout} className="text-red-600 border-red-100 hover:bg-red-50">
                 Sair
               </Button>
             </div>
             
             <div className="flex justify-center">
                 <Badge color="green">Presença Confirmada</Badge>
             </div>

               <div className="grid grid-cols-1 gap-4">
                 <button 
                   onClick={handleGoToVoting}
                   className="flex items-start gap-4 p-4 border rounded-xl text-left transition-all hover:bg-red-50 hover:border-red-200 border-gray-200 group bg-white shadow-sm"
                 >
                    <div className="p-3 rounded-full bg-red-100 text-red-600">
                      <Vote size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 group-hover:text-red-700">Votação / Enquetes</h3>
                      <p className="text-sm text-gray-500 mt-1">
                          {activePolls.length > 0 
                            ? `${activePolls.length} votação(ões) ativa(s). Clique para votar.` 
                            : "Aguardando início da votação..."}
                      </p>
                    </div>
                 </button>
                 
                 <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <UserCheck className="text-green-600" size={20} />
                          <div className="text-sm text-gray-600">
                              Identificado como: <strong>{selectedUnits[0].zoomName}</strong>
                          </div>
                       </div>
                       <button 
                         onClick={() => {
                           setNewZoomName(selectedUnits[0].zoomName || '');
                           setIsEditingZoomName(true);
                         }}
                         className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1"
                       >
                          <Pencil size={12} /> Editar
                       </button>
                    </div>

                    {isEditingZoomName && (
                      <div className="flex gap-2 animate-in slide-in-from-top-1">
                         <Input 
                           value={newZoomName}
                           onChange={(e) => setNewZoomName(e.target.value)}
                           placeholder="Novo nome no Zoom"
                           className="text-sm h-9"
                           autoFocus
                         />
                         <Button size="sm" onClick={handleUpdateZoomName} className="h-9 px-3">OK</Button>
                         <Button size="sm" variant="outline" onClick={() => setIsEditingZoomName(false)} className="h-9 px-3">X</Button>
                      </div>
                    )}
                 </div>
               </div>
            </div>
          </Card>
        )}

        {/* Step 5: List Active Polls */}
        {step === VoteStep.LIST && selectedUnits.length > 0 && (
           <Card title="Votações Disponíveis">
             <div className="space-y-4">
                <Button variant="outline" className="mb-2 text-xs flex items-center gap-1" onClick={() => setStep(VoteStep.DASHBOARD)}>
                  <ArrowLeft size={12} /> Voltar ao Menu
                </Button>
                
                {activePolls.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
                    <Vote className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                    Nenhuma votação ativa no momento.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activePolls.map(poll => {
                      const allVoted = selectedUnits.every(u => hasVoted(poll.id, u.unit));
                      
                      return (
                        <div 
                          key={poll.id} 
                          onClick={() => !allVoted && handleSelectPoll(poll)}
                          className={`border rounded-lg p-4 transition-all relative overflow-hidden ${
                            allVoted 
                            ? 'bg-gray-50 border-gray-200 cursor-default opacity-80' 
                            : 'bg-white border-red-100 hover:border-red-400 hover:shadow-sm cursor-pointer'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <h3 className="font-bold text-gray-900 pr-8">{poll.title}</h3>
                            {allVoted && <CheckCircle className="text-green-500 h-5 w-5" />}
                          </div>
                          {poll.description && <p className="text-sm text-gray-500 line-clamp-2 mb-2">{poll.description}</p>}
                          
                          <div className="flex justify-end mt-2">
                             {allVoted ? (
                               <Badge color="green">Votos Registrados</Badge>
                             ) : (
                               <span className="text-red-600 text-sm font-medium flex items-center">
                                 Votar Agora <ChevronRight size={16} />
                               </span>
                             )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
             </div>
           </Card>
        )}

        {/* Step 6: Voting Booth */}
        {step === VoteStep.BOOTH && boothUnits.length > 0 && selectedPoll && (
          <Card title="Cédula de Votação">
            <div className="space-y-6">
              <div>
                <Button variant="outline" className="mb-4 text-xs flex items-center gap-1" onClick={() => {
                  setStep(VoteStep.LIST);
                  setDistinctVoteIndex(0);
                  setIsDistinctVoting(false);
                  setBoothUnits([]);
                }}>
                  <ArrowLeft size={12} /> Voltar para Lista
                </Button>
                <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedPoll.title}</h2>
                
                {/* Voting Mode Toggle */}
                {boothUnits.length > 1 && (
                  <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                    <button 
                      onClick={() => {
                        setIsDistinctVoting(false);
                        setDistinctVoteIndex(0);
                      }}
                      className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${!isDistinctVoting ? 'bg-white shadow-sm text-red-600' : 'text-gray-500'}`}
                    >
                      Votar em Bloco
                    </button>
                    <button 
                      onClick={() => setIsDistinctVoting(true)}
                      className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${isDistinctVoting ? 'bg-white shadow-sm text-red-600' : 'text-gray-500'}`}
                    >
                      Votos Distintos
                    </button>
                  </div>
                )}

                <div className="bg-red-50 text-red-800 text-sm p-3 rounded-lg mb-2 border border-red-100">
                    {isDistinctVoting ? (
                      <>
                        Votando agora pela unidade: <strong>{boothUnits[distinctVoteIndex]?.unit}</strong>
                        <p className="text-[10px] mt-1 opacity-70">Passo {distinctVoteIndex + 1} de {boothUnits.length}</p>
                      </>
                    ) : (
                      <>
                        Votando por: <strong>{boothUnits.map(u => u.unit).join(', ')}</strong>
                      </>
                    )}
                </div>
                {selectedPoll.description && <p className="text-gray-500 text-sm mt-2">{selectedPoll.description}</p>}
              </div>

              <div className="space-y-3">
                {selectedPoll.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedOption(opt.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedOption === opt.id 
                        ? 'border-red-600 bg-red-50 text-red-800' 
                        : 'border-gray-200 bg-white hover:border-red-300 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 ${
                         selectedOption === opt.id ? 'border-red-600' : 'border-gray-400'
                      }`}>
                        {selectedOption === opt.id && <div className="w-3 h-3 rounded-full bg-red-600" />}
                      </div>
                      <span className="font-medium">{opt.text}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => {
                  setStep(VoteStep.LIST);
                  setDistinctVoteIndex(0);
                  setIsDistinctVoting(false);
                  setBoothUnits([]);
                }} className="flex-1">
                  Cancelar
                </Button>
                <Button 
                  onClick={submitVote} 
                  className="flex-[2] flex items-center justify-center gap-2" 
                  disabled={!selectedOption || isSubmittingVote}
                >
                  {isSubmittingVote ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      <span>Registrando Voto...</span>
                    </>
                  ) : isDistinctVoting ? (
                    distinctVoteIndex + 1 === boothUnits.length ? 'Finalizar Votação' : 'Próxima Unidade'
                  ) : (
                    'Confirmar Voto(s)'
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 7: Success */}
        {step === VoteStep.SUCCESS && selectedUnits.length > 0 && (
          <Card>
            <div className="text-center py-6">
               <div className="mx-auto bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                 <CheckCircle className="h-8 w-8 text-green-600" />
               </div>
               <h2 className="text-2xl font-bold text-gray-900 mb-2">Voto(s) Registrado(s)!</h2>
               <p className="text-gray-500 mb-6">Obrigado por participar.</p>

               <div className="flex flex-col gap-3">
                 <Button onClick={handleFinishSuccess}>
                   Voltar para Lista de Votações
                 </Button>
                 <Button variant="outline" onClick={() => setStep(VoteStep.DASHBOARD)}>
                   <LayoutDashboard size={16} className="mr-2" /> Voltar ao Menu Principal
                 </Button>
               </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
