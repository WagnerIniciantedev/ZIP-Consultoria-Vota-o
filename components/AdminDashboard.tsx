
import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  StopCircle, 
  LogOut,
  Building2,
  List,
  ArrowLeft,
  UserCog,
  Archive,
  History,
  Play,
  LayoutDashboard,
  UserCheck,
  Clock,
  FileText,
  Download,
  Trash2,
  HelpCircle
} from 'lucide-react';
import { Button, Card, Input } from './ui';
import { Resident, Poll, VoteRecord, User, AssemblyRecord } from '../types';
import { exportVotesToCSV } from '../services/dataService';

// Imported Sub-Panels
import { SetupPanel } from './dashboard/SetupPanel';
import { PollCreator, PollList } from './dashboard/PollsPanels';
import { AttendancePanel } from './dashboard/AttendancePanel';
import { ResultsPanel } from './dashboard/ResultsPanel';
import { UsersManagement } from './Users'; 
import { TourGuide, TourStep } from './TourGuide';

interface AdminDashboardProps {
  isAssemblyActive: boolean;
  residents: Resident[];
  setResidents: React.Dispatch<React.SetStateAction<Resident[]>>;
  polls: Poll[];
  setPolls: React.Dispatch<React.SetStateAction<Poll[]>>;
  votes: VoteRecord[];
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User | null;
  condoName: string;
  setCondoName: React.Dispatch<React.SetStateAction<string>>;
  pastAssemblies: AssemblyRecord[];
  onLogout: () => void;
  onGoToVoting: () => void;
  onTogglePoll: (id: string) => void;
  onEndPoll: (id: string) => void;
  onDeletePoll: (id: string) => void;
  onDeleteUser: (id: string) => void;
  onStartAssembly: (name: string) => void;
  onEndAssembly: () => void;
  onDeleteAssembly: (id: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isAssemblyActive,
  residents,
  setResidents,
  polls,
  setPolls,
  votes,
  users,
  setUsers,
  currentUser,
  condoName,
  setCondoName,
  pastAssemblies,
  onLogout,
  onGoToVoting,
  onTogglePoll,
  onEndPoll,
  onDeletePoll,
  onDeleteUser,
  onStartAssembly,
  onEndAssembly,
  onDeleteAssembly
}) => {
  const [activeTab, setActiveTab] = useState<'setup_excel' | 'create_poll' | 'manage_polls' | 'users' | 'attendance' | 'history' | 'past_assemblies' | 'end_assembly'>('setup_excel');
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  
  // Start Assembly State
  const [startNameInput, setStartNameInput] = useState('');
  
  // Delete Assembly Confirm State
  const [confirmDeleteAssemblyId, setConfirmDeleteAssemblyId] = useState<string | null>(null);

  // TOUR STATE
  const [isTourOpen, setIsTourOpen] = useState(false);

  // --- Auth Checks ---
  const isSuperUser = currentUser?.role === 'TI';
  const isDemoMode = condoName === 'Modo Administrativo';

  // --- Derived State ---
  const activePollsCount = polls.filter(p => p.isActive).length;
  const pendingResidentsCount = residents.filter(r => r.attendanceStatus === 'PENDING').length;
  const viewingPoll = polls.find(p => p.id === selectedPollId);

  // --- EFFECT: CHECK TOUR STATUS ---
  useEffect(() => {
    // Only show tour automatically if assembly is ACTIVE (dashboard mode)
    if (isAssemblyActive) {
      const tourSeen = localStorage.getItem('condovote_tour_seen');
      if (!tourSeen) {
        setIsTourOpen(true);
      }
    }
  }, [isAssemblyActive]);

  const handleFinishTour = () => {
    setIsTourOpen(false);
    localStorage.setItem('condovote_tour_seen', 'true');
  };

  const handleRestartTour = () => {
    setIsTourOpen(true);
  };

  const tourSteps: TourStep[] = [
    {
      title: "Bem-vindo ao Zip Consultoria",
      content: "Este é o seu painel de controle administrativo. Aqui você gerencia todo o fluxo de votação, desde o cadastro de moradores até a emissão de relatórios finais.",
      position: 'center'
    },
    {
      targetId: 'tour-setup',
      title: "1. Importar Moradores",
      content: "Comece por aqui. Utilize nossa planilha modelo para importar a lista de moradores, definir frações ideais e inadimplência. É a base do sistema.",
      position: 'right'
    },
    {
      targetId: 'tour-create',
      title: "2. Criar Enquetes",
      content: "Crie novas pautas de votação. Você pode escolher entre votação unitária, fração ideal ou peso qualificado (Habite-se).",
      position: 'right'
    },
    {
      targetId: 'tour-manage',
      title: "3. Gerenciar Votações",
      content: "Ative, pause e encerre votações. Aqui você também acompanha os resultados em tempo real e gera gráficos.",
      position: 'right'
    },
    {
      targetId: 'tour-attendance',
      title: "4. Sala de Espera",
      content: "Controle a entrada! Moradores solicitam acesso e você aprova aqui. Fundamental para garantir que apenas pessoas autorizadas votem.",
      position: 'right'
    },
    {
      targetId: 'tour-users',
      title: "5. Usuários do Sistema",
      content: "Cadastre outros administradores ou equipe de apoio para ajudar na gestão da assembleia.",
      position: 'right'
    },
    {
      targetId: 'tour-end',
      title: "6. Encerrar Assembleia",
      content: "Ao final de tudo, clique aqui. O sistema irá gerar um histórico completo e limpar a sessão para a próxima reunião.",
      position: 'right'
    }
  ];

  // --- Start Handlers ---
  const handleStartRealAssembly = () => {
      if (!startNameInput.trim()) {
          alert("Por favor, digite o nome do condomínio.");
          return;
      }
      onStartAssembly(startNameInput);
      setStartNameInput('');
      setActiveTab('setup_excel');
  };

  const handleEnterDashboardMode = () => {
      onStartAssembly('Modo Administrativo');
      setActiveTab('past_assemblies'); 
  };

  // --- End Assembly Handlers ---
  const handleEndAssemblyClick = () => {
    onEndAssembly();
  };

  const handleExportHistorical = (poll: Poll, historicalVotes: VoteRecord[], historicalResidents: Resident[]) => {
      exportVotesToCSV(historicalVotes, historicalResidents, poll);
  };


  // --- RENDER: START SCREEN (If assembly not active) ---
  if (!isAssemblyActive) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="bg-red-600 p-1.5 rounded text-white">
                            <Building2 className="h-6 w-6" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900">ZIP <span className="font-light">CONSULTORIA</span></h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-gray-700">{currentUser?.name}</span>
                        <Button variant="outline" onClick={onLogout} size="sm">Sair</Button>
                    </div>
                </div>
            </header>
            
            <div className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
                    {/* OPTION 1: START ASSEMBLY */}
                    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 flex flex-col justify-center text-center hover:border-red-200 transition-all group">
                        <div className="mb-6 flex justify-center">
                             <div className="bg-red-50 p-6 rounded-full group-hover:bg-red-100 transition-colors">
                                 <Play size={48} className="text-red-600 ml-1" />
                             </div>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Iniciar Nova Assembleia</h2>
                        <p className="text-gray-500 mb-8 min-h-[48px]">Configure uma nova votação agora. Digite o nome do condomínio abaixo.</p>
                        
                        <div className="space-y-4">
                            <Input 
                                placeholder="Nome do Condomínio" 
                                value={startNameInput}
                                onChange={(e) => setStartNameInput(e.target.value)}
                                className="text-lg py-3 text-center"
                            />
                            <Button 
                                onClick={handleStartRealAssembly} 
                                className="w-full py-4 text-lg font-bold shadow-lg shadow-red-200 bg-red-600 hover:bg-red-700"
                            >
                                INICIAR
                            </Button>
                        </div>
                    </div>

                    {/* OPTION 2: DASHBOARD / HISTORY */}
                    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 flex flex-col justify-center text-center hover:border-blue-200 transition-all group">
                        <div className="mb-6 flex justify-center">
                             <div className="bg-blue-50 p-6 rounded-full group-hover:bg-blue-100 transition-colors">
                                 <LayoutDashboard size={48} className="text-blue-600" />
                             </div>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Acessar Painel</h2>
                        <p className="text-gray-500 mb-8 min-h-[48px]">Visualize o histórico de assembleias, gerencie usuários ou audite o sistema sem iniciar votação.</p>
                        
                        <div className="space-y-4 mt-auto">
                            <div className="h-[50px] w-full"></div> 
                            <Button 
                                onClick={handleEnterDashboardMode} 
                                className="w-full py-4 text-lg font-bold shadow-lg shadow-blue-200 bg-blue-600 hover:bg-blue-700"
                            >
                                VER DASHBOARD
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  // --- RENDER: MAIN DASHBOARD ---
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* TOUR COMPONENT */}
      <TourGuide 
        isOpen={isTourOpen} 
        onClose={() => handleFinishTour()} 
        onComplete={() => handleFinishTour()}
        steps={tourSteps}
      />

      {/* Top Navbar */}
      <header className="bg-white shadow-sm sticky top-0 z-20 border-b border-red-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="bg-red-600 p-1.5 rounded text-white">
                <Building2 className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">ZIP <span className="font-light">CONSULTORIA</span></h1>
            </div>

            <div className="flex-1 mx-4 lg:mx-8 text-center">
               <h2 className="text-xl font-bold text-gray-800 flex items-center justify-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isDemoMode ? 'bg-blue-500' : 'bg-green-500 animate-pulse'}`}></div>
                  {condoName}
               </h2>
            </div>

            <div className="flex items-center gap-4">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleRestartTour}
                className="hidden md:flex items-center gap-2 bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                title="Como usar o sistema"
              >
                <HelpCircle size={16} /> <span className="hidden lg:inline">Tour / Ajuda</span>
              </Button>

              {isDemoMode && (
                 <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={onEndAssembly}
                    className="hidden sm:flex items-center gap-2"
                 >
                    <ArrowLeft size={16} /> Voltar ao Início
                 </Button>
              )}
              <div className="text-right hidden sm:block">
                 <p className="text-sm font-semibold text-gray-800">{currentUser?.name}</p>
                 <p className="text-xs text-gray-500">{currentUser?.role === 'TI' ? 'T.I. Admin' : (currentUser?.jobTitle || 'Administrador')}</p>
              </div>
              <Button variant="outline" onClick={onLogout} className="text-sm flex items-center gap-2 hover:text-red-600 hover:border-red-200">
                <LogOut size={16} /> <span className="hidden md:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* --- SIDEBAR NAVIGATION --- */}
          <div className="lg:col-span-1 space-y-2">
            
            <button 
              id="tour-setup"
              onClick={() => { setActiveTab('setup_excel'); setSelectedPollId(null); }}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'setup_excel' ? 'bg-red-50 text-red-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <FileSpreadsheet size={20} /> Configuração Inicial
            </button>

            <button 
              id="tour-create"
              onClick={() => { setActiveTab('create_poll'); setSelectedPollId(null); }}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'create_poll' ? 'bg-red-50 text-red-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Plus size={20} /> Criar Enquete
            </button>

            <button 
              id="tour-manage"
              onClick={() => { setActiveTab('manage_polls'); setSelectedPollId(null); }}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'manage_polls' && !selectedPollId ? 'bg-red-50 text-red-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <List size={20} /> Gerenciar Votações
            </button>
            
            <button 
              id="tour-attendance"
              onClick={() => { setActiveTab('attendance'); setSelectedPollId(null); }}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-colors ${activeTab === 'attendance' ? 'bg-red-50 text-red-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <div className="flex items-center gap-3">
                 <UserCheck size={20} /> Sala de Espera
              </div>
              {pendingResidentsCount > 0 && (
                <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingResidentsCount}</span>
              )}
            </button>

            <div className="border-t my-2 border-gray-200"></div>

            <button 
              onClick={() => { setActiveTab('past_assemblies'); setSelectedPollId(null); }}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'past_assemblies' ? 'bg-red-50 text-red-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Archive size={20} /> Assembleias Realizadas
            </button>

            <button 
              id="tour-users"
              onClick={() => { setActiveTab('users'); setSelectedPollId(null); }}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'users' ? 'bg-red-50 text-red-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <UserCog size={20} /> Gestão de Usuários
            </button>
            
            {isSuperUser && (
              <button 
                onClick={() => { setActiveTab('history'); setSelectedPollId(null); }}
                className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'history' ? 'bg-red-50 text-red-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <History size={20} /> Logs do Sistema (TI)
              </button>
            )}

            <div className="pt-6">
                <button 
                  id="tour-end"
                  onClick={() => setActiveTab('end_assembly')}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors border ${activeTab === 'end_assembly' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}
                >
                    {isDemoMode ? <ArrowLeft size={20} /> : <StopCircle size={20} />} 
                    {isDemoMode ? "Voltar ao Início" : "Encerrar Assembleia"}
                </button>
            </div>
            
            {activePollsCount > 0 && (
               <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
                 <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    {activePollsCount} Votação(ões) Ativa(s)
                 </h4>
                 <Button onClick={onGoToVoting} className="w-full text-sm" variant="outline">
                   Abrir Tela de Votação
                 </Button>
               </div>
            )}
          </div>

          {/* --- MAIN CONTENT AREA --- */}
          <div className="lg:col-span-3">
            
            {/* 1. SETUP */}
            {activeTab === 'setup_excel' && (
              <SetupPanel 
                residents={residents}
                setResidents={setResidents}
              />
            )}

            {/* 2. CREATE POLL */}
            {activeTab === 'create_poll' && (
              <PollCreator 
                setPolls={setPolls}
                onSuccess={() => setActiveTab('manage_polls')}
              />
            )}

            {/* 3. MANAGE POLLS (List View) */}
            {activeTab === 'manage_polls' && !selectedPollId && (
              <PollList 
                polls={polls}
                onTogglePoll={onTogglePoll}
                onEndPoll={onEndPoll}
                onDeletePoll={onDeletePoll}
                onSelectPoll={(id) => { setSelectedPollId(id); }}
              />
            )}

            {/* 4. RESULTS VIEW (Specific Poll) */}
            {activeTab === 'manage_polls' && selectedPollId && viewingPoll && (
              <ResultsPanel 
                 poll={viewingPoll}
                 votes={votes}
                 residents={residents}
                 onBack={() => setSelectedPollId(null)}
                 onTogglePoll={onTogglePoll}
                 onEndPoll={onEndPoll}
              />
            )}

            {/* 5. ATTENDANCE */}
            {activeTab === 'attendance' && (
              <AttendancePanel 
                residents={residents}
                setResidents={setResidents}
                condoName={condoName}
              />
            )}

            {/* 6. USERS */}
            {activeTab === 'users' && (
              <UsersManagement 
                users={users}
                setUsers={setUsers}
                currentUser={currentUser}
                onDeleteUser={onDeleteUser}
              />
            )}

            {/* 7. END ASSEMBLY */}
            {activeTab === 'end_assembly' && (
                <Card title={isDemoMode ? "Sair do Modo Administrativo" : "Encerrar Processo de Assembleia"}>
                    <div className="text-center py-12 max-w-lg mx-auto">
                        <div className="bg-red-100 p-6 rounded-full inline-flex mb-6">
                            {isDemoMode ? <LogOut size={48} className="text-red-600" /> : <Archive size={48} className="text-red-600" />}
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">{isDemoMode ? "Sair do Painel?" : "Você tem certeza?"}</h2>
                        <p className="text-gray-600 mb-8">
                            {isDemoMode 
                              ? "Você está visualizando o histórico. Nenhuma informação será salva." 
                              : `Ao encerrar a assembleia **${condoName}**, todas as votações atuais serão arquivadas e a tela será limpa.`
                            }
                        </p>
                        
                        <div className="flex flex-col gap-4">
                            <Button 
                                type="button"
                                onClick={handleEndAssemblyClick} 
                                variant="danger" 
                                size="lg"
                                className="w-full flex justify-center items-center gap-2 py-4"
                            >
                                <StopCircle size={24} /> {isDemoMode ? "SIM, SAIR DO PAINEL" : "SIM, ENCERRAR ASSEMBLEIA"}
                            </Button>
                            <Button onClick={() => setActiveTab('manage_polls')} variant="outline" className="w-full">
                                Cancelar e Voltar
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* 8. PAST ASSEMBLIES */}
            {activeTab === 'past_assemblies' && (
              <div className="space-y-6">
                 <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Archive size={24} className="text-red-600" />
                    Catálogo de Assembleias Realizadas
                 </h2>

                 {pastAssemblies.length === 0 ? (
                    <Card>
                       <div className="text-center py-12 text-gray-500">
                          Nenhuma assembleia foi encerrada e arquivada ainda.
                       </div>
                    </Card>
                 ) : (
                    <div className="grid grid-cols-1 gap-6">
                       {pastAssemblies.map((assembly) => {
                          const isConfirmingDelete = confirmDeleteAssemblyId === assembly.id;
                          
                          return (
                          <Card key={assembly.id}>
                             <div className="border-b pb-4 mb-4 flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{assembly.condoName}</h3>
                                    <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                                    <Clock size={14} /> Encerrada em: {new Date(assembly.date).toLocaleString()}
                                    </p>
                                </div>
                                {isSuperUser && (
                                    <div className="flex items-center">
                                        {isConfirmingDelete ? (
                                            <div className="flex items-center bg-red-50 rounded p-1 border border-red-200 animate-in fade-in zoom-in">
                                                <span className="text-xs text-red-700 font-bold mr-2 ml-1">Excluir?</span>
                                                <Button
                                                    onClick={() => {
                                                        onDeleteAssembly(assembly.id);
                                                        setConfirmDeleteAssemblyId(null);
                                                    }}
                                                    className="h-7 px-2 bg-red-600 hover:bg-red-700 text-white text-xs mr-1"
                                                >
                                                    Sim
                                                </Button>
                                                <Button
                                                    onClick={() => setConfirmDeleteAssemblyId(null)}
                                                    variant="outline"
                                                    className="h-7 px-2 text-xs hover:bg-gray-50"
                                                >
                                                    Não
                                                </Button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => setConfirmDeleteAssemblyId(assembly.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                                                title="Excluir Registro de Assembleia (Ação Irreversível)"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                )}
                             </div>
                             <div className="space-y-4">
                                <h4 className="font-semibold text-gray-700 text-sm uppercase">Relatório de Enquetes</h4>
                                {assembly.polls.length === 0 ? (
                                   <p className="text-sm text-gray-500 italic">Sem votações registradas.</p>
                                ) : (
                                   <div className="grid grid-cols-1 gap-2">
                                      {assembly.polls.map(poll => (
                                         <div key={poll.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                                            <div className="flex items-center gap-2">
                                               <FileText size={16} className="text-gray-400" />
                                               <span className="font-medium text-gray-800">{poll.title}</span>
                                            </div>
                                            <Button 
                                               size="sm" 
                                               variant="outline"
                                               onClick={() => handleExportHistorical(poll, assembly.votes, assembly.residentsSnapshot)}
                                               className="text-xs flex items-center gap-1"
                                            >
                                               <Download size={12} /> Baixar CSV
                                            </Button>
                                         </div>
                                      ))}
                                   </div>
                                )}
                             </div>
                          </Card>
                       )})}
                    </div>
                 )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
