
import React, { useState, useEffect } from 'react';
import { AppView, Resident, Poll, VoteRecord, User, AssemblyRecord, SystemLog } from './types';
import { 
  getResidents, saveResidents, 
  getPolls, savePolls, 
  getVotes, saveVotes,
  getUsers,
  getCondoName, saveCondoName,
  getAssemblies, saveAssemblies,
  getAssemblyStatus, saveAssemblyStatus,
  saveAssemblyId,
  saveSession, getSession, clearSession,
  getMasterSecurityUsers,
  getActiveAssemblies, saveActiveAssemblies,
  addLog,
  getLogs, saveLogs
} from './services/dataService';
import { ActiveAssembly } from './types';
import { onSnapshot, doc, setDoc, collection } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from './services/firebase';

// UI Components
import { AdminDashboard } from './components/AdminDashboard';
import { CompanyDashboard } from './components/CompanyDashboard';
import { ResidentVoting } from './components/ResidentVoting';
import { Button, Input } from './components/ui';
import { Eye, EyeOff, Wifi, WifiOff, AlertCircle, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  
  // --- STATE MANAGEMENT ---
  const [currentView, setCurrentView] = useState<AppView>(AppView.ADMIN_LOGIN);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [condoName, setCondoName] = useState<string>('');
  const [sampleUnit, setSampleUnit] = useState<string>('');
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string>('');
  const [pastAssemblies, setPastAssemblies] = useState<AssemblyRecord[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isAssemblyActive, setIsAssemblyActive] = useState<boolean | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false); 
  const [loginError, setLoginError] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  // --- INITIAL LOAD ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('t');
    let isResidentAccess = params.get('access') === 'resident';
    let urlAssemblyId = params.get('assemblyId');

    if (token) {
      try {
        const decoded = JSON.parse(atob(token));
        if (decoded.a === 'r') isResidentAccess = true;
        if (decoded.id) urlAssemblyId = decoded.id;
      } catch (e) {
        console.error("Invalid token");
      }
    }

    const initialUsers = getUsers();
    setResidents(getResidents());
    setPolls(getPolls());
    setVotes(getVotes());
    setUsers(initialUsers);
    setCondoName(getCondoName());
    setPastAssemblies(getAssemblies());
    setLogs(getLogs());
    
    // Restore sample unit if available
    const savedSampleUnit = localStorage.getItem('condovote_sample_unit');
    if (savedSampleUnit) setSampleUnit(savedSampleUnit);

    // Don't set initial active status from local storage if we have a resident link
    if (!isResidentAccess) {
      setIsAssemblyActive(getAssemblyStatus());
    }

    const savedUser = getSession();
    
    if (isResidentAccess) {
      if (urlAssemblyId) {
        setSelectedAssemblyId(urlAssemblyId);
        // Try to find the original condo name from the active assemblies list
        const active = getActiveAssemblies();
        const found = active.find((a: any) => a.id === urlAssemblyId);
        if (found) {
          setCondoName(found.condoName);
        } else {
          // If not found in local active list, we'll try to use the ID as the name for now
          // The Firestore listener will pick up the real data if it exists
          setCondoName(urlAssemblyId.replace(/_/g, ' '));
        }
      }
      setCurrentView(AppView.VOTE_IDENTIFY);
    } else if (savedUser) {
      setCurrentUser(savedUser);
      setCurrentView(AppView.COMPANY_DASHBOARD);
    }

    // Authenticate Anonymously
    if (auth) {
        signInAnonymously(auth).catch(e => console.warn("Firebase Auth Error:", e));
    }
  }, []);

  // --- 1. GLOBAL SYSTEM LISTENER (Users & Pointer) ---
  useEffect(() => {
    if (!db) return;
    setIsConnected(true);

    const usersRef = doc(db, 'system', 'users');
    const unsubUsers = onSnapshot(usersRef, (docSnapshot) => {
        let cloudUsers: User[] = [];
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            if (data && Array.isArray(data.list)) {
                cloudUsers = data.list;
            }
        }

        const safetyUsers = getMasterSecurityUsers();
        const mergedMap = new Map();
        
        // Add safety users first (as baseline)
        safetyUsers.forEach((u: User) => mergedMap.set(u.username.toLowerCase(), u));
        // Overlay cloud users (database changes will win)
        cloudUsers.forEach((u: User) => mergedMap.set(u.username.toLowerCase(), u));
        
        const finalUsersList = Array.from(mergedMap.values());
        setUsers(finalUsersList);
        localStorage.setItem('condovote_users', JSON.stringify(finalUsersList));

        // Check if we need to sync back to cloud (if cloud is empty or missing safety users)
        const missingInCloud = safetyUsers.some(su => !cloudUsers.some(cu => cu.username.toLowerCase() === su.username.toLowerCase()));

        if (!docSnapshot.exists() || cloudUsers.length === 0 || missingInCloud) {
            setDoc(usersRef, { list: finalUsersList }, { merge: true })
                .catch(e => console.error("Erro sincronizando usuários no Firestore:", e));
        }
    });

    const globalRef = doc(db, 'system', 'global');
    const unsubGlobal = onSnapshot(globalRef, (docSnapshot) => {
        const data = docSnapshot.data();
        const val = data?.active_condo;
        if (val && val !== 'null' && currentView === AppView.ADMIN_LOGIN) {
            setCondoName(val);
        }
    });

    return () => {
        unsubUsers();
        unsubGlobal();
    };
  }, [currentView]);

  // --- 2. LOGS LISTENER (Global) ---
  useEffect(() => {
    if (!db) return;
    const logsRef = doc(db, 'system', 'logs');
    const unsubLogs = onSnapshot(logsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && Array.isArray(data.list)) {
          setLogs(data.list);
          saveLogs(data.list);
        }
      }
    });
    return () => unsubLogs();
  }, []);

  // --- 3. ASSEMBLY SPECIFIC LISTENER ---
  useEffect(() => {
    if (!db) return;

    const safeKey = selectedAssemblyId || (condoName || localStorage.getItem('condovote_condo_name') || 'setup').replace(/[^a-zA-Z0-9]/g, '_');
    const assemblyRef = doc(db, 'assemblies', safeKey);

    const unsubAssembly = onSnapshot(assemblyRef, (docSnapshot) => {
        setIsDataLoaded(true);
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            if (data.condoName) setCondoName(data.condoName);
            else if (data.name) setCondoName(data.name);
            
            if (data.sampleUnit) {
                setSampleUnit(data.sampleUnit);
                localStorage.setItem('condovote_sample_unit', data.sampleUnit);
            }
            if (data.polls) setPolls(data.polls);
            if (data.votes) setVotes(data.votes);
            // We no longer get residents from the main document for security
            if (data.isActive !== undefined) {
                setIsAssemblyActive(data.isActive);
                // If assembly ended and we are a resident, clear session
                if (data.isActive === false && !currentUser) {
                    clearSession();
                }
            }
        } else {
            if (selectedAssemblyId || (condoName && condoName !== 'Modo Administrativo')) {
              setPolls([]);
              setVotes([]);
              setResidents([]);
              setIsAssemblyActive(false);
            }
        }
    });

    // 4. RESIDENTS LISTENER (Admin only)
    let unsubResidents = () => {};
    if (currentView === AppView.ADMIN_DASHBOARD) {
        const residentsRef = collection(db, 'assemblies', safeKey, 'residents_list');
        unsubResidents = onSnapshot(residentsRef, (snap: any) => {
            const list: Resident[] = [];
            snap.forEach((doc: any) => list.push(doc.data() as Resident));
            setResidents(list);
            saveResidents(list);
        });
    }

    return () => {
        unsubAssembly();
        unsubResidents();
    };
  }, [selectedAssemblyId, condoName, currentView]);

  // Persistence triggers
  useEffect(() => { if(condoName) saveCondoName(condoName) }, [condoName]);
  useEffect(() => saveAssemblies(pastAssemblies), [pastAssemblies]);
  useEffect(() => saveAssemblyStatus(isAssemblyActive), [isAssemblyActive]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Normalização dos inputs para evitar erros de digitação (espaços ou maiúsculas)
    const normalizedEmail = adminEmail.trim().toLowerCase();
    const cleanPass = adminPass.trim();

    // 1. Busca na lista de usuários carregados (Estado)
    let validUser = users.find(u => 
      u.username.toLowerCase() === normalizedEmail && u.password === cleanPass
    );

    // 2. Fallback de Segurança: Se a lista estiver vazia por erro de sincronia, busca na lista mestra
    if (!validUser) {
      const masterUsers = getMasterSecurityUsers();
      validUser = masterUsers.find(u => 
        u.username.toLowerCase() === normalizedEmail && u.password === cleanPass
      );
    }

    if (validUser) {
      setCurrentUser(validUser);
      saveSession(validUser, rememberMe);
      setCurrentView(AppView.COMPANY_DASHBOARD);
      addLog(validUser, 'LOGIN', 'Acesso ao sistema realizado com sucesso');
      setLoginError('');
      setAdminEmail('');
      setAdminPass('');
    } else {
      setLoginError('Credenciais inválidas. Verifique usuário e senha.');
    }
  };

  const handleStartAssembly = async (name: string, assemblyId: string, initialResidents: Resident[] = []) => {
    setResidents(initialResidents);
    setPolls([]);
    setVotes([]);
    setCondoName(name);
    setSelectedAssemblyId(assemblyId);
    setIsAssemblyActive(true);
    
    const sampleUnitValue = initialResidents[0]?.unit || '';
    setSampleUnit(sampleUnitValue);
    localStorage.setItem('condovote_sample_unit', sampleUnitValue);

    saveAssemblyId(assemblyId);
    saveResidents(initialResidents);
    savePolls([]);
    saveVotes([]);
    saveCondoName(name);
    saveAssemblyStatus(true);
    
    // Save metadata to Firestore so residents can find the condo name
    if (db && assemblyId) {
      const assemblyRef = doc(db, 'assemblies', assemblyId);
      try {
        await setDoc(assemblyRef, { 
          condoName: name, 
          isActive: true,
          createdAt: Date.now(),
          sampleUnit: sampleUnitValue,
          residentsCount: initialResidents.length
        }, { merge: true });

        // If there are initial residents, sync them to the subcollection
        if (initialResidents.length > 0) {
          // Use chunks for large lists to avoid hitting limits if necessary, 
          // but for now Promise.all is fine for typical condo sizes
          const savePromises = initialResidents.map((r: Resident) => {
            const resRef = doc(db, 'assemblies', assemblyId, 'residents_list', r.unit.toLowerCase());
            return setDoc(resRef, r, { merge: true });
          });
          await Promise.all(savePromises);
        }
      } catch (e) {
        console.error("Error saving assembly data to cloud:", e);
      }
    }

    if (currentUser) {
      addLog(currentUser, 'INÍCIO_ASSEMBLEIA', `Iniciou a assembleia: ${name}`);
    }
  };

  const handleEndAssembly = () => {
    if (condoName && condoName !== 'Modo Administrativo') {
      // Filter logs for this specific assembly
      const currentLogs = logs.filter((l: SystemLog) => l.assemblyId === condoName);

      const assemblySnapshot: AssemblyRecord = {
        id: selectedAssemblyId || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
        condoName: condoName,
        date: Date.now(),
        polls: [...polls], 
        votes: [...votes], 
        residentsSnapshot: [...residents],
        logs: currentLogs
      };
      
      const newPastAssemblies = [assemblySnapshot, ...pastAssemblies];
      setPastAssemblies(newPastAssemblies);
      saveAssemblies(newPastAssemblies);

      // Update ActiveAssembly status in the list
      const activeAssembliesList = getActiveAssemblies();
      const updatedActive = activeAssembliesList.map((a: ActiveAssembly) => 
        (a.id === selectedAssemblyId || a.condoName === condoName) 
        ? { ...a, isActive: false, status: 'completed' as const } 
        : a
      );
      saveActiveAssemblies(updatedActive);
      
      // Update Firestore document to inactive
      if (db && selectedAssemblyId) {
        const assemblyRef = doc(db, 'assemblies', selectedAssemblyId);
        setDoc(assemblyRef, { isActive: false }, { merge: true }).catch(e => console.error("Error ending assembly in Firestore:", e));
      }

      if (currentUser) {
        addLog(currentUser, 'FIM_ASSEMBLEIA', `Finalizou a assembleia: ${condoName}`);
      }
    }
    
    // Clear current working state but don't delete cloud data yet if we want to keep it for reports
    // Actually, clearAllData deletes the cloud doc. We should probably keep it or rely on pastAssemblies.
    // The user wants "Concluídas" to have the report.
    
    setPolls([]);
    setVotes([]);
    setResidents([]);
    setCondoName('');
    setIsAssemblyActive(false);
    setSelectedAssemblyId('');
    setCurrentView(AppView.COMPANY_DASHBOARD);
  };

  const handleVoteSubmit = (pollId: string, unit: string, optionId: string, isDelinquent: boolean) => {
    setVotes(prev => {
      if (prev.some(v => v.unit === unit && v.pollId === pollId)) return prev;
      const newVote = { pollId, unit, optionId, timestamp: Date.now(), isDelinquentVote: isDelinquent };
      const updated = [...prev, newVote];
      saveVotes(updated);
      return updated;
    });
  };

  const handleRegisterAttendance = (unit: string, zoomName: string) => {
     setResidents(prev => {
       const updated = prev.map(r => r.unit.toLowerCase() === unit.toLowerCase() ? { ...r, zoomName, attendanceStatus: 'PENDING' as const } : r);
       saveResidents(updated);
       return updated;
     });
  };

  // --- RENDER ---

  if (currentView === AppView.ADMIN_LOGIN) {
    return (
      <div className="min-h-screen bg-[#E60000] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="flex flex-col items-center w-full max-w-md z-10">
          <div className="mb-8 text-center">
             <img src="https://i.postimg.cc/Y0w6w1cm/Whats-App-Image-2025-11-29-at-22-21-41-removebg-preview.png" alt="Zip Consultoria" className="h-64 w-auto mx-auto object-contain drop-shadow-xl" />
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
                  <Input type="text" placeholder="wagner.silva" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Senha</label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} placeholder="••••••" value={adminPass} onChange={e => setAdminPass(e.target.value)} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center pl-1">
                  <input id="remember-me" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 text-red-600 cursor-pointer" />
                  <label htmlFor="remember-me" className="ml-2 text-sm font-medium text-gray-700 cursor-pointer">Permanecer conectado</label>
                </div>
                {loginError && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm font-medium animate-bounce">{loginError}</div>}
                <Button type="submit" className="w-full bg-[#E60000] hover:bg-red-700 text-white font-bold py-3.5 shadow-lg active:scale-95 transition-all">ENTRAR</Button>
              </form>

              <div className="mt-8 relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                  <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500 font-medium text-[10px] tracking-widest">ACESSO RESTRITO</span></div>
              </div>
            </div>
          </div>
          <div className="mt-8">
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs backdrop-blur-sm border ${isConnected ? 'bg-green-500/20 text-white border-green-400/30' : 'bg-white/10 text-white/70 border-white/10'}`}>
                {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />} {isConnected ? 'Sistema Online' : 'Modo Offline'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // --- RESIDENT VIEW GUARD ---
  if (currentView === AppView.VOTE_IDENTIFY && !currentUser) {
      // While data is loading, show a spinner
      if (!isDataLoaded) {
          return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="text-center">
                    <RefreshCw className="animate-spin h-12 w-12 text-red-600 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Sincronizando Assembleia...</p>
                </div>
            </div>
          );
      }

      // If data loaded but assembly is not active, show the "Ended" screen
      if (isAssemblyActive === false || (isDataLoaded && !condoName && isAssemblyActive !== true)) {
          return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
                    <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="text-red-600" size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Assembleia Indisponível</h2>
                    <p className="text-gray-500 mb-8">Esta assembleia já foi finalizada ou ainda não foi iniciada. Não é mais possível registrar votos.</p>
                    <Button onClick={() => window.location.reload()} variant="outline" className="w-full">Atualizar Página</Button>
                </div>
            </div>
          );
      }
  }

  if (currentView === AppView.COMPANY_DASHBOARD) {
    return (
      <CompanyDashboard 
        currentUser={currentUser}
        onLogout={() => { 
          if (currentUser) addLog(currentUser, 'LOGOUT', 'Saiu do sistema');
          clearSession(); 
          setCurrentUser(null); 
          setCurrentView(AppView.ADMIN_LOGIN); 
        }}
        onSelectAssembly={(id, name) => {
          if (currentUser) addLog(currentUser, 'SELEÇÃO_ASSEMBLEIA', `Selecionou a assembleia: ${name}`);
          setSelectedAssemblyId(id);
          setCondoName(name);
          setIsAssemblyActive(true);
          setCurrentView(AppView.ADMIN_DASHBOARD);
        }}
        onStartAssembly={handleStartAssembly}
        users={users}
        setUsers={setUsers}
        pastAssemblies={pastAssemblies}
        logs={logs}
        onDeleteAssembly={(id) => {
          const assembly = pastAssemblies.find(a => a.id === id);
          if (currentUser && assembly) addLog(currentUser, 'EXCLUSÃO_RELATÓRIO', `Excluiu o relatório da assembleia: ${assembly.condoName}`);
          const updated = pastAssemblies.filter(a => a.id !== id);
          setPastAssemblies(updated);
          saveAssemblies(updated);
        }}
      />
    );
  }

  if (currentView === AppView.ADMIN_DASHBOARD) {
    return (
      <AdminDashboard 
        isAssemblyActive={isAssemblyActive}
        residents={residents} setResidents={setResidents}
        polls={polls} setPolls={setPolls}
        votes={votes}
        condoName={condoName} setCondoName={setCondoName}
        onLogout={() => { clearSession(); setCurrentUser(null); setCurrentView(AppView.ADMIN_LOGIN); }}
        onGoToVoting={() => setCurrentView(AppView.VOTE_IDENTIFY)}
        onTogglePoll={(id: string) => {
            const updated = polls.map(p => p.id === id ? {...p, isActive: !p.isActive} : p);
            setPolls(updated);
            savePolls(updated);
        }}
        onEndPoll={(id: string) => {
            const updated = polls.map(p => p.id === id ? {...p, isActive: false, isEnded: true} : p);
            setPolls(updated);
            savePolls(updated);
        }}
        onDeletePoll={(id: string) => {
            const updated = polls.filter(p => p.id !== id);
            setPolls(updated);
            savePolls(updated);
        }}
        onEndAssembly={handleEndAssembly}
        onBackToCompany={() => setCurrentView(AppView.COMPANY_DASHBOARD)}
        currentUser={currentUser}
        selectedAssemblyId={selectedAssemblyId}
        setSampleUnit={setSampleUnit}
      />
    );
  }

  return (
    <ResidentVoting 
      assemblyId={selectedAssemblyId}
      sampleUnit={sampleUnit}
      polls={polls}
      onVoteSubmit={handleVoteSubmit}
      onRegisterAttendance={handleRegisterAttendance}
      hasVoted={(pId, unit) => votes.some(v => v.unit === unit && v.pollId === pId)}
      isResidentLink={new URLSearchParams(window.location.search).get('access') === 'resident'}
      onBack={() => {
        if (currentUser) {
          setCurrentView(AppView.ADMIN_DASHBOARD);
        } else {
          setCurrentView(AppView.ADMIN_LOGIN);
        }
      }}
    />
  );
};

export default App;
