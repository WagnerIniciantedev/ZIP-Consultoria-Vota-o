
import React, { useState, useEffect } from 'react';
import { AppView, Resident, Poll, VoteRecord, User, AssemblyRecord } from './types';
import { 
  getResidents, saveResidents, 
  getPolls, savePolls, 
  getVotes, saveVotes,
  getUsers, saveUsers,
  getCondoName, saveCondoName,
  getAssemblies, saveAssemblies,
  getAssemblyStatus, saveAssemblyStatus,
  saveSession, getSession, clearSession,
  clearAllData,
  saveAssemblyStartTime, getAssemblyStartTime
} from './services/dataService';
// Import Firebase Firestore & Auth
import { db, doc, onSnapshot, setDoc, auth, signInAnonymously, onAuthStateChanged } from './services/firebase';

// UI Components
import { AdminDashboard } from './components/AdminDashboard';
import { ResidentVoting } from './components/ResidentVoting';
import { Button, Input, Card } from './components/ui';
import { Building2, Phone, Instagram, UserCheck, Eye, EyeOff, AlertTriangle, MonitorPlay, Wifi, WifiOff, ShieldAlert, Lock, ExternalLink } from 'lucide-react';

const App: React.FC = () => {
  
  // ============================================================================
  // --- STATE MANAGEMENT ---
  // ============================================================================
  const [currentView, setCurrentView] = useState<AppView>(AppView.ADMIN_LOGIN);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [condoName, setCondoName] = useState<string>('');
  const [pastAssemblies, setPastAssemblies] = useState<AssemblyRecord[]>([]);
  const [isAssemblyActive, setIsAssemblyActive] = useState<boolean>(false);
  const [assemblyStartTime, setAssemblyStartTime] = useState<number>(0);

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false); 
  const [loginError, setLoginError] = useState('');

  // Firebase Connection Status
  const [isConnected, setIsConnected] = useState(false);
  // NEW: Wait for Auth to be ready before listening to DB
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  // NEW: Track Auth Configuration Errors
  const [authConfigError, setAuthConfigError] = useState<string | null>(null);

  // ============================================================================
  // --- EFFECTS & PERSISTENCE ---
  // ============================================================================
  
  // Initial Load from LocalStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isResidentAccess = params.get('access') === 'resident';

    setResidents(getResidents());
    setPolls(getPolls());
    setVotes(getVotes());
    // getUsers initial load (fallback until Firestore connects)
    setUsers(getUsers());
    setCondoName(getCondoName());
    setPastAssemblies(getAssemblies());
    setIsAssemblyActive(getAssemblyStatus());
    setAssemblyStartTime(getAssemblyStartTime());

    const savedUser = getSession();
    
    if (isResidentAccess) {
      setCurrentView(AppView.VOTE_IDENTIFY);
    } else if (savedUser) {
      // Check if saved session user still exists in the (potentially updated) users list
      // Note: We might re-check this after Firestore updates the users list
      setCurrentUser(savedUser);
      setCurrentView(AppView.ADMIN_DASHBOARD);
    }
  }, []);

  // --- FIREBASE AUTH HANDLER ---
  useEffect(() => {
    if (!auth) return;

    // Monitor Auth State
    const unsubscribe = onAuthStateChanged(auth, (user: any) => {
        if (user) {
            console.log("🔐 Autenticado no Firebase (UID):", user.uid);
            setIsFirebaseReady(true);
            setAuthConfigError(null);
        } else {
            console.log("⚠️ Usuário desconectado. Tentando login anônimo...");
            signInAnonymously(auth).catch((err: any) => {
                console.error("Erro no login anônimo:", err);
                // Check for specific configuration errors
                if (err.code === 'auth/admin-restricted-operation' || err.code === 'auth/operation-not-allowed') {
                    setAuthConfigError('admin-restricted');
                } else {
                    setAuthConfigError('generic');
                }
            });
        }
    });

    return () => unsubscribe();
  }, []);

  // --- FIRESTORE REALTIME LISTENER ---
  useEffect(() => {
    // Only connect listeners if DB exists AND Auth is ready
    if (!db || !isFirebaseReady) {
      setIsConnected(false);
      return;
    }

    // Determine the safe key based on condo name or localstorage default
    const currentName = condoName || localStorage.getItem('condovote_condo_name') || 'setup';
    const safeKey = currentName.replace(/[^a-zA-Z0-9]/g, '_');
    
    console.log(`[Firestore] Listening to document assemblies/${safeKey}`);
    setIsConnected(true);

    // --- 1. GLOBAL LISTENER FOR ACTIVE CONDO (Multi-device Sync) ---
    // Listens to 'system/global' to find out which condo is active
    const globalRef = doc(db, 'system', 'global');
    const unsubGlobal = onSnapshot(globalRef, (docSnapshot) => {
        const data = docSnapshot.data();
        const val = data?.active_condo;
        
        // Auto-switch condo context if needed
        if (val && val !== condoName && val !== 'null') {
             if (currentView !== AppView.ADMIN_DASHBOARD || !condoName) {
                 console.log("Syncing with Global Active Condo:", val);
                 setCondoName(val);
             }
        }
    }, (error) => {
        console.error("Erro listener Global:", error);
    });

    // --- 2. GLOBAL USERS LISTENER (Sync Logins) ---
    const usersRef = doc(db, 'system', 'users');
    const unsubUsers = onSnapshot(usersRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            if (data && Array.isArray(data.list)) {
                setUsers(data.list);
                localStorage.setItem('condovote_users', JSON.stringify(data.list));
                
                // If we are logged in, ensure our user data is up to date with DB
                if (currentUser) {
                    const meInDb = data.list.find((u: User) => u.id === currentUser.id);
                    if (meInDb && JSON.stringify(meInDb) !== JSON.stringify(currentUser)) {
                        setCurrentUser(meInDb);
                    }
                }
            }
        } else {
            // Self-Healing: If DB is empty, upload current defaults so admin doesn't get locked out
            console.log("Database users empty. Initializing defaults.");
            const defaultUsers = getUsers();
            setUsers(defaultUsers);
            setDoc(usersRef, { list: defaultUsers }, { merge: true }).catch(err => console.error(err));
        }
    }, (error) => {
        console.error("Erro listener Users:", error);
    });

    // --- 3. MAIN DATA LISTENER (One Doc for efficiency) ---
    // Listens to 'assemblies/[safeKey]'
    const assemblyRef = doc(db, 'assemblies', safeKey);
    const unsubAssembly = onSnapshot(assemblyRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            
            // Update Polls
            if (data.polls) {
                setPolls(data.polls);
                localStorage.setItem('condovote_polls', JSON.stringify(data.polls));
            } else {
                setPolls([]);
            }

            // Update Votes
            if (data.votes) {
                setVotes(data.votes);
                localStorage.setItem('condovote_votes', JSON.stringify(data.votes));
            } else {
                setVotes([]);
            }

            // Update Residents
            if (data.residents) {
                setResidents(data.residents);
                localStorage.setItem('condovote_residents', JSON.stringify(data.residents));
            } else {
                setResidents([]);
            }

            // Update Active Status
            if (data.isActive !== undefined) {
                setIsAssemblyActive(data.isActive);
                localStorage.setItem('condovote_is_active', JSON.stringify(data.isActive));
            }

            // Update Time & Check Expiry
            if (data.startTime) {
                setAssemblyStartTime(data.startTime);
                localStorage.setItem('condovote_assembly_start_time', data.startTime.toString());
                
                // --- 24 HOUR AUTO-CLOSE CHECK ---
                const ONE_DAY_MS = 24 * 60 * 60 * 1000;
                const now = Date.now();
                if (now - data.startTime > ONE_DAY_MS) {
                   console.log("⚠️ Sessão expirada (mais de 24h).");
                   // If admin, we clear. If resident, we just disconnect visuals.
                   if (currentView === AppView.ADMIN_DASHBOARD) {
                       clearAllData(currentName);
                       alert("A sessão expirou (24h) e foi encerrada automaticamente.");
                       setCurrentView(AppView.ADMIN_LOGIN);
                       setCurrentUser(null);
                       clearSession();
                   }
                }
            }
        } else {
            // Document does not exist (was deleted/cleared)
            console.log("Document deleted or empty. Clearing local state.");
            setPolls([]);
            setVotes([]);
            setResidents([]);
            setIsAssemblyActive(false);
            setAssemblyStartTime(0);
            
            localStorage.removeItem('condovote_polls');
            localStorage.removeItem('condovote_votes');
            localStorage.removeItem('condovote_residents');
        }
    }, (error) => {
        console.error("Erro listener Assembly:", error);
    });

    return () => {
        unsubGlobal();
        unsubAssembly();
        unsubUsers();
    };
  }, [condoName, currentView, currentUser, isFirebaseReady]); // Added isFirebaseReady dependency


  // --- TAB SYNCHRONIZATION (LOCAL) ---
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'condovote_polls') setPolls(getPolls());
      if (e.key === 'condovote_votes') setVotes(getVotes());
      if (e.key === 'condovote_residents') setResidents(getResidents());
      if (e.key === 'condovote_is_active') setIsAssemblyActive(getAssemblyStatus());
      if (e.key === 'condovote_condo_name') setCondoName(getCondoName());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);


  // Persistence Listeners (Triggers Save -> which triggers Cloud Sync in dataService)
  useEffect(() => saveResidents(residents), [residents]);
  useEffect(() => savePolls(polls), [polls]);
  useEffect(() => saveVotes(votes), [votes]);
  useEffect(() => saveUsers(users), [users]);
  useEffect(() => saveCondoName(condoName), [condoName]);
  useEffect(() => saveAssemblies(pastAssemblies), [pastAssemblies]);
  useEffect(() => saveAssemblyStatus(isAssemblyActive), [isAssemblyActive]);
  useEffect(() => saveAssemblyStartTime(assemblyStartTime), [assemblyStartTime]);

  useEffect(() => {
    if (currentUser) {
      const updatedSelf = users.find(u => u.id === currentUser.id);
      if (updatedSelf && JSON.stringify(updatedSelf) !== JSON.stringify(currentUser)) {
        setCurrentUser(updatedSelf);
        const isInLocal = localStorage.getItem('condovote_admin_auth');
        saveSession(updatedSelf, !!isInLocal); 
      }
    }
  }, [users, currentUser]);


  // ============================================================================
  // --- BUSINESS LOGIC ---
  // ============================================================================

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const validUser = users.find(u => u.username === adminEmail && u.password === adminPass);
    if (validUser) {
      setCurrentUser(validUser);
      saveSession(validUser, rememberMe);
      setCurrentView(AppView.ADMIN_DASHBOARD);
      setLoginError('');
      setAdminEmail('');
      setAdminPass('');
    } else {
      setLoginError('Credenciais inválidas.');
    }
  };

  const handleStartAssembly = (name: string) => {
    // FIX: Ensure data is clean when starting a new assembly
    setResidents([]);
    setPolls([]);
    setVotes([]);
    
    setCondoName(name);
    setIsAssemblyActive(true);
    setAssemblyStartTime(Date.now()); // Record start time for 24h limit
  };

  const handleVoteSubmit = (pollId: string, unit: string, optionId: string, isDelinquent: boolean) => {
    setVotes(prevVotes => {
      if (prevVotes.some(v => v.unit === unit && v.pollId === pollId)) {
        return prevVotes;
      }
      const newVote: VoteRecord = {
        pollId,
        unit,
        optionId,
        timestamp: Date.now(),
        isDelinquentVote: isDelinquent
      };
      return [...prevVotes, newVote];
    });
  };

  // UPDATED HANDLER: Removed Visitor Mode Logic
  // Now strictly updates existing residents found in the Excel list
  const handleRegisterAttendance = (unit: string, zoomName: string) => {
     setResidents(prev => {
       const existingResident = prev.find(r => r.unit.toLowerCase() === unit.toLowerCase());
       
       if (existingResident) {
         // Update existing resident status
         return prev.map(r => {
           if (r.unit.toLowerCase() === unit.toLowerCase()) {
             return { ...r, zoomName, attendanceStatus: 'PENDING' as const };
           }
           return r;
         });
       }
       // If not in list, do nothing (validation is handled in UI now)
       return prev;
     });
  };

  const hasVoted = (pollId: string, unit: string) => votes.some(v => v.unit === unit && v.pollId === pollId);

  const handleEndPoll = (id: string) => {
    setPolls(prev => prev.map(p => 
      p.id === id ? { ...p, isActive: false, isEnded: true } : p
    ));
  };

  const handleTogglePoll = (id: string) => {
    setPolls(prev => prev.map(p => 
      p.id === id ? { ...p, isActive: !p.isActive } : p
    ));
  };

  const handleDeletePoll = (id: string) => {
    setPolls(prev => prev.filter(p => p.id !== id));
    setVotes(prev => prev.filter(v => v.pollId !== id)); 
  };

  const handleDeleteUser = (id: string) => {
    setUsers(prevUsers => prevUsers.filter(u => u.id !== id));
  };

  const handleEndAssembly = () => {
    if (condoName && condoName !== 'Modo Administrativo') {
      const assemblySnapshot: AssemblyRecord = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        condoName: condoName,
        date: Date.now(),
        polls: [...polls], 
        votes: [...votes], 
        residentsSnapshot: [...residents]
      };
      setPastAssemblies(prev => [assemblySnapshot, ...prev]);
    }
    
    // IMPORTANT: Clear ALL data (Cloud and Local) BEFORE resetting state.
    // We pass the current 'condoName' to ensure the correct firebase node is wiped.
    clearAllData(condoName);

    setPolls([]);
    setVotes([]);
    setResidents([]);
    setCondoName('');
    setIsAssemblyActive(false);
    setAssemblyStartTime(0);
  };

  const handleDeleteAssembly = (id: string) => {
    setPastAssemblies(prev => prev.filter(a => a.id !== id));
  };

  // ============================================================================
  // --- CONFIGURATION ERROR MODAL ---
  // ============================================================================
  if (authConfigError === 'admin-restricted') {
     return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-8 shadow-2xl border-l-8 border-red-600">
                <div className="flex items-center gap-3 mb-4 text-red-600">
                    <ShieldAlert size={48} />
                    <h1 className="text-2xl font-bold">Configuração Necessária</h1>
                </div>
                <p className="text-gray-700 font-medium mb-4">
                    O Login Anônimo está <span className="text-red-600 font-bold uppercase">desativado</span> no seu painel do Firebase.
                </p>
                <p className="text-gray-600 text-sm mb-6">
                    Por segurança, o Google bloqueia o acesso ao banco de dados até que você autorize. 
                    Isso não é um erro do sistema, é uma trava de configuração.
                </p>

                <div className="bg-gray-100 p-4 rounded-lg text-sm space-y-3 mb-6 border border-gray-200">
                    <p className="font-bold text-gray-800">Como Resolver (Leva 30 segundos):</p>
                    <ol className="list-decimal list-inside space-y-2 text-gray-700">
                        <li>Acesse o painel: <a href="https://console.firebase.google.com" target="_blank" className="text-blue-600 underline">console.firebase.google.com</a></li>
                        <li>Entre no menu <strong>Authentication</strong> (Criação).</li>
                        <li>Vá na aba <strong>Sign-in method</strong>.</li>
                        <li>Clique em <strong>Anônimo</strong> (Anonymous).</li>
                        <li>Mude a chave para <strong>Ativado</strong> e clique em Salvar.</li>
                    </ol>
                </div>

                <Button onClick={() => window.location.reload()} className="w-full py-3 bg-red-600 hover:bg-red-700">
                    Já ativei! Recarregar página
                </Button>
            </div>
        </div>
     )
  }

  // ============================================================================
  // --- RENDER ---
  // ============================================================================

  if (currentView === AppView.ADMIN_LOGIN) {
    return (
      <div className="min-h-screen bg-[#E60000] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
           <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-white blur-3xl"></div>
           <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full bg-black blur-3xl"></div>
        </div>
        
        <div className="flex flex-col items-center w-full max-w-md z-10">
          <div className="mb-8 text-center">
             <img 
               src="https://i.postimg.cc/Y0w6w1cm/Whats-App-Image-2025-11-29-at-22-21-41-removebg-preview.png" 
               alt="Zip Consultoria" 
               className="h-64 w-auto mx-auto object-contain drop-shadow-xl"
             />
          </div>
          
          <div className="w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-8 pt-10 pb-8">
              <div className="mb-6 text-center">
                 <h2 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Portal de Votação</h2>
                 <h1 className="text-gray-900 font-bold text-2xl">Identificação</h1>
                 <div className="h-1 w-12 bg-red-600 mx-auto mt-4 rounded-full"></div>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Usuário Administrativo</label>
                  <Input 
                    type="text" 
                    placeholder="Digite seu usuário" 
                    value={adminEmail} 
                    onChange={e => setAdminEmail(e.target.value)}
                    className="bg-gray-50 border-gray-200 py-3 focus:bg-white text-gray-900 placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Senha</label>
                  <div className="relative">
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••" 
                      value={adminPass} 
                      onChange={e => setAdminPass(e.target.value)} 
                      className="bg-gray-50 border-gray-200 py-3 focus:bg-white text-gray-900 placeholder-gray-400 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1"
                      title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center pl-1">
                  <input 
                    id="remember-me" 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                  />
                  <label htmlFor="remember-me" className="ml-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
                    Permanecer conectado
                  </label>
                </div>
                
                {loginError && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-600 text-sm font-medium">
                     <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
                     {loginError}
                  </div>
                )}
                
                <Button type="submit" className="w-full bg-[#E60000] hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-200 transition-all transform active:scale-[0.99]">
                  ENTRAR COMO ADMIN
                </Button>
              </form>

              {/* DIVIDER */}
              <div className="mt-8 relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500 font-medium text-[10px] tracking-widest">ÁREA DO CONDÔMINO</span>
                  </div>
              </div>

              {/* RESIDENT BIG BUTTON - VISIBLE ONLY IF ASSEMBLY ACTIVE */}
              {isAssemblyActive && (
                <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <Button 
                    onClick={() => setCurrentView(AppView.VOTE_IDENTIFY)}
                    variant="outline"
                    className="w-full py-4 border-2 border-blue-600 text-blue-700 hover:bg-blue-50 hover:border-blue-700 font-bold flex items-center justify-center gap-3 text-base rounded-xl transition-all"
                  >
                    <UserCheck className="w-6 h-6" />
                    SOU MORADOR / QUERO VOTAR
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-8 text-center">
               {!isConnected ? (
                   <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs backdrop-blur-sm border border-white/10">
                       <WifiOff size={12} /> Modo Offline (Dados Locais)
                   </span>
               ) : (
                   <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 text-white text-xs backdrop-blur-sm border border-green-400/30">
                       <Wifi size={12} /> Sistema Online
                   </span>
               )}
          </div>
        </div>
      </div>
    );
  }

  if (currentView === AppView.ADMIN_DASHBOARD) {
    return (
      <AdminDashboard 
        isAssemblyActive={isAssemblyActive}
        residents={residents}
        setResidents={setResidents}
        polls={polls}
        setPolls={setPolls}
        votes={votes}
        users={users}
        setUsers={setUsers}
        currentUser={currentUser}
        condoName={condoName}
        setCondoName={setCondoName}
        pastAssemblies={pastAssemblies}
        onLogout={() => {
          clearSession(); 
          setCurrentUser(null);
          setCurrentView(AppView.ADMIN_LOGIN);
        }}
        onGoToVoting={() => setCurrentView(AppView.VOTE_IDENTIFY)}
        onTogglePoll={handleTogglePoll}
        onEndPoll={handleEndPoll}
        onDeletePoll={handleDeletePoll}
        onDeleteUser={handleDeleteUser}
        onStartAssembly={handleStartAssembly}
        onEndAssembly={handleEndAssembly}
        onDeleteAssembly={handleDeleteAssembly}
      />
    );
  }

  return (
    <div>
      <ResidentVoting 
        residents={residents}
        polls={polls}
        onVoteSubmit={handleVoteSubmit}
        onRegisterAttendance={handleRegisterAttendance}
        hasVoted={hasVoted}
        isAdmin={!!currentUser}
        onBack={() => {
          if (currentUser) {
            setCurrentView(AppView.ADMIN_DASHBOARD);
          } else {
            setCurrentView(AppView.ADMIN_LOGIN);
          }
        }}
      />
    </div>
  );
};

export default App;
