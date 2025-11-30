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
  clearAllData
} from './services/dataService';

// UI Components
import { AdminDashboard } from './components/AdminDashboard';
import { ResidentVoting } from './components/ResidentVoting';
import { Button, Input } from './components/ui';
import { Building2, Phone, Instagram, UserCheck, Eye, EyeOff } from 'lucide-react';

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
  const [loginError, setLoginError] = useState('');

  // ============================================================================
  // --- EFFECTS & PERSISTENCE ---
  // ============================================================================
  
  // Initial Load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('access') === 'resident') {
      setCurrentView(AppView.VOTE_IDENTIFY);
    }
    setResidents(getResidents());
    setPolls(getPolls());
    setVotes(getVotes());
    setUsers(getUsers());
    setCondoName(getCondoName());
    setPastAssemblies(getAssemblies());
    setIsAssemblyActive(getAssemblyStatus());
  }, []);

  // Persistence Listeners
  useEffect(() => saveResidents(residents), [residents]);
  useEffect(() => savePolls(polls), [polls]);
  useEffect(() => saveVotes(votes), [votes]);
  useEffect(() => saveUsers(users), [users]);
  useEffect(() => saveCondoName(condoName), [condoName]);
  useEffect(() => saveAssemblies(pastAssemblies), [pastAssemblies]);
  useEffect(() => saveAssemblyStatus(isAssemblyActive), [isAssemblyActive]);

  // Sync Current User Data (Real-time updates if admin edits self)
  useEffect(() => {
    if (currentUser) {
      const updatedSelf = users.find(u => u.id === currentUser.id);
      if (updatedSelf && JSON.stringify(updatedSelf) !== JSON.stringify(currentUser)) {
        setCurrentUser(updatedSelf);
      }
    }
  }, [users, currentUser]);


  // ============================================================================
  // --- BUSINESS LOGIC & HANDLERS ---
  // ============================================================================

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const validUser = users.find(u => u.username === adminEmail && u.password === adminPass);
    if (validUser) {
      setCurrentUser(validUser);
      setCurrentView(AppView.ADMIN_DASHBOARD);
      setLoginError('');
      setAdminEmail('');
      setAdminPass('');
    } else {
      setLoginError('Credenciais inválidas.');
    }
  };

  const handleStartAssembly = (name: string) => {
    setCondoName(name);
    setIsAssemblyActive(true);
  };

  const handleVoteSubmit = (pollId: string, unit: string, optionId: string, isDelinquent: boolean) => {
    // Functional Update to prevent race conditions
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

  // --- ACTIONS: POLLS ---
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
    setVotes(prev => prev.filter(v => v.pollId !== id)); // Remove associated votes
  };

  // --- ACTIONS: USERS ---
  const handleDeleteUser = (id: string) => {
    console.log(`[App] Deleting user ${id}`);
    setUsers(prevUsers => prevUsers.filter(u => u.id !== id));
  };

  // --- ACTIONS: ASSEMBLIES ---
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

    // Reset Memory State
    setPolls([]);
    setVotes([]);
    setResidents([]);
    setCondoName('');
    setIsAssemblyActive(false);

    // Clear Storage Session
    clearAllData();
  };

  // NEW: Delete Historical Assembly (TI Only)
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
          <div className="mb-12 text-center text-white scale-90 sm:scale-100 transform drop-shadow-lg">
            <div className="flex items-end justify-center leading-none mb-2 relative">
              <span className="text-[7rem] font-serif font-bold tracking-tighter">Z</span>
              <div className="mx-1 mb-2 relative top-1">
                <Building2 className="h-24 w-20" strokeWidth={2} absoluteStrokeWidth /> 
                <div className="absolute inset-0 border-l-2 border-r-2 border-white/20 rounded opacity-0"></div>
              </div>
              <span className="text-[7rem] font-serif font-bold tracking-tighter">P</span>
            </div>
            <div className="text-2xl tracking-[0.3em] font-light font-sans pl-2">CONSULTORIA</div>
          </div>
          
          <div className="w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-8 py-10">
              <div className="mb-8 text-center">
                 <h2 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Acesso ao Sistema</h2>
                 <h1 className="text-gray-900 font-bold text-2xl">Portal de Votação</h1>
                 <div className="h-1 w-12 bg-red-600 mx-auto mt-4 rounded-full"></div>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">Usuário</label>
                  <Input 
                    type="text" 
                    placeholder="Digite seu usuário" 
                    value={adminEmail} 
                    onChange={e => setAdminEmail(e.target.value)}
                    className="bg-gray-50 border-gray-200 py-3 focus:bg-white text-gray-900 placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">Senha</label>
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
                
                {loginError && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-600 text-sm font-medium">
                     <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
                     {loginError}
                  </div>
                )}
                
                <Button type="submit" className="w-full bg-[#E60000] hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-200 transition-all transform active:scale-[0.99]">
                  ENTRAR
                </Button>
              </form>
            </div>
            
            <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
              <button 
                onClick={() => setCurrentView(AppView.VOTE_IDENTIFY)}
                className="text-gray-600 hover:text-[#E60000] text-sm font-medium transition-colors flex items-center justify-center gap-2 mx-auto"
              >
                <div className="p-1 bg-white border rounded-md shadow-sm">
                   <UserCheck className="w-4 h-4" />
                </div>
                Acesso Morador / Votar
              </button>
            </div>
          </div>

          <div className="mt-12 text-white/90 text-center space-y-3 font-medium">
            <div className="flex items-center justify-center gap-3 text-lg hover:text-white transition-colors">
              <Phone className="fill-white/20" size={20} />
              <span>(71) 4141-6903</span>
            </div>
            <div className="flex items-center justify-center gap-3 text-lg hover:text-white transition-colors">
              <Instagram size={20} />
              <span>zipconsultoria.oficial</span>
            </div>
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