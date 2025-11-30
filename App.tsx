
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
  clearAllData
} from './services/dataService';
// Import Firebase Hookup
import { db, ref, onValue } from './services/firebase';

// UI Components
import { AdminDashboard } from './components/AdminDashboard';
import { ResidentVoting } from './components/ResidentVoting';
import { Button, Input } from './components/ui';
import { Building2, Phone, Instagram, UserCheck, Eye, EyeOff, AlertTriangle, MonitorPlay, Wifi, WifiOff } from 'lucide-react';

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

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false); 
  const [loginError, setLoginError] = useState('');

  // Firebase Connection Status
  const [isConnected, setIsConnected] = useState(false);

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
    setUsers(getUsers());
    setCondoName(getCondoName());
    setPastAssemblies(getAssemblies());
    setIsAssemblyActive(getAssemblyStatus());

    const savedUser = getSession();
    
    if (isResidentAccess) {
      setCurrentView(AppView.VOTE_IDENTIFY);
    } else if (savedUser) {
      const validSavedUser = getUsers().find(u => u.id === savedUser.id);
      if (validSavedUser) {
        setCurrentUser(validSavedUser);
        setCurrentView(AppView.ADMIN_DASHBOARD);
      } else {
        clearSession();
      }
    }
  }, []);

  // --- FIREBASE REALTIME LISTENER ---
  // This connects the app to the cloud db. When data changes in the cloud,
  // it updates the local state automatically.
  useEffect(() => {
    if (!db) {
      setIsConnected(false);
      return;
    }

    // Determine the safe key based on condo name or localstorage default
    // NOTE: This creates a dependency. If condoName changes, listeners re-bind.
    const currentName = condoName || localStorage.getItem('condovote_condo_name') || 'setup';
    const safeKey = currentName.replace(/[^a-zA-Z0-9]/g, '_');
    
    console.log(`[Firebase] Listening to nodes at /${safeKey}`);
    setIsConnected(true);

    const pollsRef = ref(db, `${safeKey}/polls`);
    const votesRef = ref(db, `${safeKey}/votes`);
    const residentsRef = ref(db, `${safeKey}/residents`);
    const activeRef = ref(db, `${safeKey}/isActive`);

    // --- GLOBAL LISTENER FOR ACTIVE CONDO (Multi-device Sync) ---
    // This allows residents to automatically find the correct session
    const globalRef = ref(db, '_system/active_condo');
    const unsubGlobal = onValue(globalRef, (snapshot) => {
        const val = snapshot.val();
        // If there is an active condo in the cloud, and it's different from what we have, update locally
        // But only if we are NOT in admin mode or if we are a fresh session
        if (val && val !== condoName && val !== 'null') {
             // Only auto-switch if we are not actively managing another named session
             // or if we are a resident client
             if (currentView !== AppView.ADMIN_DASHBOARD || !condoName) {
                 console.log("Syncing with Global Active Condo:", val);
                 setCondoName(val);
             }
        }
    });

    // Listeners
    const unsubPolls = onValue(pollsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            setPolls(data);
            localStorage.setItem('condovote_polls', JSON.stringify(data));
        } else {
            // FIX: Explicitly clear local state if cloud data is null (wiped)
            setPolls([]);
            localStorage.removeItem('condovote_polls');
        }
    });

    const unsubVotes = onValue(votesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            setVotes(data);
            localStorage.setItem('condovote_votes', JSON.stringify(data));
        } else {
            // FIX: Explicitly clear local state if cloud data is null
            setVotes([]);
            localStorage.removeItem('condovote_votes');
        }
    });

    const unsubResidents = onValue(residentsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            setResidents(data);
            localStorage.setItem('condovote_residents', JSON.stringify(data));
        } else {
            // FIX: Explicitly clear local state if cloud data is null
            setResidents([]);
            localStorage.removeItem('condovote_residents');
        }
    });

    const unsubActive = onValue(activeRef, (snapshot) => {
        const data = snapshot.val();
        if (data !== null) {
            setIsAssemblyActive(data);
            localStorage.setItem('condovote_is_active', JSON.stringify(data));
        }
    });

    return () => {
        unsubPolls();
        unsubVotes();
        unsubResidents();
        unsubActive();
        unsubGlobal();
    };
  }, [condoName, currentView]); // Re-subscribe if Condo Name changes


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

  const handleRegisterAttendance = (unit: string, zoomName: string) => {
     setResidents(prev => prev.map(r => {
       if (r.unit === unit) {
         return { ...r, zoomName, attendanceStatus: 'PENDING' as const };
       }
       return r;
     }));
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
  };

  const handleDeleteAssembly = (id: string) => {
    setPastAssemblies(prev => prev.filter(a => a.id !== id));
  };

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

              {/* RESIDENT BIG BUTTON */}
              <div className="mt-6">
                <Button 
                  onClick={() => setCurrentView(AppView.VOTE_IDENTIFY)}
                  variant="outline"
                  className="w-full py-4 border-2 border-blue-600 text-blue-700 hover:bg-blue-50 hover:border-blue-700 font-bold flex items-center justify-center gap-3 text-base rounded-xl transition-all"
                >
                  <UserCheck className="w-6 h-6" />
                  SOU MORADOR / QUERO VOTAR
                </Button>
              </div>
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
