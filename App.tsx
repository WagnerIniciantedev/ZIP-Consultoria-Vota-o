
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
  saveAssemblyStartTime, getAssemblyStartTime,
  getMasterSecurityUsers
} from './services/dataService';
import { db, doc, onSnapshot, setDoc, auth, signInAnonymously } from './services/firebase';

// UI Components
import { AdminDashboard } from './components/AdminDashboard';
import { ResidentVoting } from './components/ResidentVoting';
import { Button, Input } from './components/ui';
import { Eye, EyeOff, Wifi, WifiOff, AlertCircle, UserCheck } from 'lucide-react';

const App: React.FC = () => {
  
  // --- STATE MANAGEMENT ---
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
  const [isConnected, setIsConnected] = useState(false);

  // --- INITIAL LOAD ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isResidentAccess = params.get('access') === 'resident';

    const initialUsers = getUsers();
    setResidents(getResidents());
    setPolls(getPolls());
    setVotes(getVotes());
    setUsers(initialUsers);
    setCondoName(getCondoName());
    setPastAssemblies(getAssemblies());
    setIsAssemblyActive(getAssemblyStatus());
    setAssemblyStartTime(getAssemblyStartTime());

    const savedUser = getSession();
    
    if (isResidentAccess) {
      setCurrentView(AppView.VOTE_IDENTIFY);
    } else if (savedUser) {
      setCurrentUser(savedUser);
      setCurrentView(AppView.ADMIN_DASHBOARD);
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
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            if (data && Array.isArray(data.list) && data.list.length > 0) {
                // Merge cloud users with default safety users
                const cloudUsers = data.list;
                const safetyUsers = getMasterSecurityUsers();
                const mergedMap = new Map();
                
                // Add cloud users first
                cloudUsers.forEach((u: User) => mergedMap.set(u.username.toLowerCase(), u));
                // Overlay safety users to ensure they exist
                safetyUsers.forEach((u: User) => mergedMap.set(u.username.toLowerCase(), u));
                
                const finalUsersList = Array.from(mergedMap.values());
                setUsers(finalUsersList);
                localStorage.setItem('condovote_users', JSON.stringify(finalUsersList));
            }
        } else {
            const defaultUsers = getUsers();
            setDoc(usersRef, { list: defaultUsers }, { merge: true });
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
  }, []);

  // --- 2. ASSEMBLY SPECIFIC LISTENER ---
  useEffect(() => {
    if (!db) return;

    const currentName = condoName || localStorage.getItem('condovote_condo_name') || 'setup';
    const safeKey = currentName.replace(/[^a-zA-Z0-9]/g, '_');
    const assemblyRef = doc(db, 'assemblies', safeKey);

    const unsubAssembly = onSnapshot(assemblyRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            if (data.polls) setPolls(data.polls);
            if (data.votes) setVotes(data.votes);
            if (data.residents) setResidents(data.residents);
            if (data.isActive !== undefined) setIsAssemblyActive(data.isActive);
            if (data.startTime) setAssemblyStartTime(data.startTime);
        } else {
            if (condoName && condoName !== 'Modo Administrativo') {
              setPolls([]);
              setVotes([]);
              setResidents([]);
              setIsAssemblyActive(false);
            }
        }
    });

    return () => unsubAssembly();
  }, [condoName]);

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
      setCurrentView(AppView.ADMIN_DASHBOARD);
      setLoginError('');
      setAdminEmail('');
      setAdminPass('');
    } else {
      setLoginError('Credenciais inválidas. Verifique usuário e senha.');
    }
  };

  const handleStartAssembly = (name: string) => {
    setResidents([]);
    setPolls([]);
    setVotes([]);
    setCondoName(name);
    setIsAssemblyActive(true);
    setAssemblyStartTime(Date.now());
    
    saveResidents([]);
    savePolls([]);
    saveVotes([]);
    saveCondoName(name);
    saveAssemblyStatus(true);
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
    
    clearAllData(condoName);

    setPolls([]);
    setVotes([]);
    setResidents([]);
    setCondoName('');
    setIsAssemblyActive(false);
    setAssemblyStartTime(0);
    setCurrentView(AppView.ADMIN_DASHBOARD);
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
                  <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500 font-medium text-[10px] tracking-widest">ÁREA DO CONDÔMINO</span></div>
              </div>

              {isAssemblyActive && (
                <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <Button onClick={() => setCurrentView(AppView.VOTE_IDENTIFY)} variant="outline" className="w-full py-4 border-2 border-blue-600 text-blue-700 hover:bg-blue-50 font-bold flex items-center justify-center gap-3">
                    <UserCheck className="w-6 h-6" /> SOU MORADOR / QUERO VOTAR
                  </Button>
                </div>
              )}
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
  if (currentView === AppView.VOTE_IDENTIFY && !isAssemblyActive && !currentUser) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
                <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="text-red-600" size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Nenhuma Assembleia Ativa</h2>
                <p className="text-gray-500 mb-8">Aguarde o administrador iniciar a sessão de votação para poder acessar.</p>
                <Button onClick={() => setCurrentView(AppView.ADMIN_LOGIN)} variant="outline" className="w-full">Voltar ao Início</Button>
            </div>
        </div>
      );
  }

  if (currentView === AppView.ADMIN_DASHBOARD) {
    return (
      <AdminDashboard 
        isAssemblyActive={isAssemblyActive}
        residents={residents} setResidents={setResidents}
        polls={polls} setPolls={setPolls}
        votes={votes}
        users={users} setUsers={setUsers}
        currentUser={currentUser}
        condoName={condoName} setCondoName={setCondoName}
        pastAssemblies={pastAssemblies}
        onLogout={() => { clearSession(); setCurrentUser(null); setCurrentView(AppView.ADMIN_LOGIN); }}
        onGoToVoting={() => setCurrentView(AppView.VOTE_IDENTIFY)}
        onTogglePoll={(id) => {
            const updated = polls.map(p => p.id === id ? {...p, isActive: !p.isActive} : p);
            setPolls(updated);
            savePolls(updated);
        }}
        onEndPoll={(id) => {
            const updated = polls.map(p => p.id === id ? {...p, isActive: false, isEnded: true} : p);
            setPolls(updated);
            savePolls(updated);
        }}
        onDeletePoll={(id) => {
            const updated = polls.filter(p => p.id !== id);
            setPolls(updated);
            savePolls(updated);
        }}
        onDeleteUser={(id) => {
            const updated = users.filter(u => u.id !== id);
            setUsers(updated);
            saveUsers(updated);
        }}
        onStartAssembly={handleStartAssembly}
        onEndAssembly={handleEndAssembly}
        onDeleteAssembly={(id) => setPastAssemblies(prev => prev.filter(a => a.id !== id))}
      />
    );
  }

  return (
    <ResidentVoting 
      residents={residents}
      polls={polls}
      onVoteSubmit={handleVoteSubmit}
      onRegisterAttendance={handleRegisterAttendance}
      hasVoted={(pId, unit) => votes.some(v => v.unit === unit && v.pollId === pId)}
      isAdmin={!!currentUser}
      onBack={() => setCurrentView(currentUser ? AppView.ADMIN_DASHBOARD : AppView.ADMIN_LOGIN)}
    />
  );
};

export default App;
