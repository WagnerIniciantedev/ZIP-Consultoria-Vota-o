
import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  StopCircle, 
  LogOut,
  List,
  ArrowLeft,
  Archive,
  UserCheck,
  HelpCircle,
  Share2,
  Check
} from 'lucide-react';
import { Button, Card } from './ui';
import { Resident, Poll, VoteRecord, User, AssemblyType } from '../types';

// Imported Sub-Panels
import { SetupPanel } from './dashboard/SetupPanel';
import { PollCreator, PollList } from './dashboard/PollsPanels';
import { AttendancePanel } from './dashboard/AttendancePanel';
import { ResultsPanel } from './dashboard/ResultsPanel';
import { TourGuide, TourStep } from './TourGuide';

interface AdminDashboardProps {
  isAssemblyActive: boolean | null;
  residents: Resident[];
  setResidents: React.Dispatch<React.SetStateAction<Resident[]>>;
  polls: Poll[];
  setPolls: React.Dispatch<React.SetStateAction<Poll[]>>;
  votes: VoteRecord[];
  condoName: string;
  setCondoName: React.Dispatch<React.SetStateAction<string>>;
  onLogout: () => void;
  onGoToVoting: () => void;
  onTogglePoll: (id: string) => void;
  onEndPoll: (id: string) => void;
  onDeletePoll: (id: string) => void;
  onEndAssembly: () => void;
  onBackToCompany: () => void;
  currentUser: User | null;
  selectedAssemblyId?: string;
  residentsCount: number;
  setSampleUnit: React.Dispatch<React.SetStateAction<string>>;
  assemblyType: AssemblyType | null;
  startedBy?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isAssemblyActive,
  residents,
  setResidents,
  polls,
  setPolls,
  votes,
  condoName,
  onLogout,
  onGoToVoting,
  onTogglePoll,
  onEndPoll,
  onDeletePoll,
  onEndAssembly,
  onBackToCompany,
  currentUser,
  selectedAssemblyId,
  residentsCount,
  setSampleUnit,
  assemblyType,
  startedBy
}) => {
  const [activeTab, setActiveTab] = useState<'setup_excel' | 'create_poll' | 'manage_polls' | 'attendance' | 'end_assembly'>('setup_excel');
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const [isZoomMode, setIsZoomMode] = useState(false);
  const [pollToEdit, setPollToEdit] = useState<Poll | null>(null);
  
  // TOUR STATE
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // --- Auth Checks ---
  // (Removed unused isSuperUser)
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

  const handleCopyLink = () => {
    const safeKey = selectedAssemblyId || condoName.trim().replace(/[^a-zA-Z0-9]/g, '_');
    // Obfuscate the token more with a prefix to look "encrypted"
    const data = { a: 'r', id: safeKey, ts: Date.now() };
    const token = btoa(JSON.stringify(data));
    const url = `${window.location.origin}?t=ZV_${token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      targetId: 'tour-end',
      title: "5. Encerrar Assembleia",
      content: "Ao final de tudo, clique aqui. O sistema irá gerar um histórico completo e limpar a sessão para a próxima reunião.",
      position: 'right'
    }
  ];

  // --- Start Handlers ---
  const handleEndAssemblyClick = () => {
    onEndAssembly();
  };


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
          <div className="flex justify-between h-24 items-center">
            <div className="flex items-center gap-2">
               <img 
                    src="https://i.postimg.cc/rsSDGbPr/Whats_App_Image_2025_11_29_at_22_21_41.jpg" 
                    alt="Zip Consultoria" 
                    className="h-24 w-auto object-contain"
               />
            </div>

            <div className="flex-1 mx-4 lg:mx-8 text-center">
               <h2 className="text-xl font-bold text-gray-800 flex items-center justify-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isDemoMode ? 'bg-blue-500' : 'bg-green-500 animate-pulse'}`}></div>
                  {condoName}
               </h2>
               {startedBy && (
                 <p className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">
                   Iniciado por: <span className="font-semibold text-gray-500">{startedBy}</span>
                 </p>
               )}
            </div>

            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopyLink}
                className={`hidden sm:flex items-center gap-2 transition-all ${copied ? 'bg-green-50 border-green-200 text-green-600' : 'border-blue-200 text-blue-600 hover:bg-blue-50'}`}
              >
                {copied ? <Check size={16} /> : <Share2 size={16} />} 
                {copied ? 'Link Copiado!' : 'Copiar Link de Votação'}
              </Button>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={onBackToCompany}
                className="hidden sm:flex items-center gap-2 border-red-200 text-red-600 hover:bg-red-50"
              >
                <ArrowLeft size={16} /> Painel Corporativo
              </Button>

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
              onClick={() => { setActiveTab('create_poll'); setSelectedPollId(null); setPollToEdit(null); }}
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

            <div className="pt-6">
                <button 
                  onClick={onBackToCompany}
                  className="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors border border-gray-200 text-gray-600 hover:bg-gray-100 mb-2"
                >
                    <ArrowLeft size={20} /> Voltar ao Painel
                </button>

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
                condoName={condoName}
                selectedAssemblyId={selectedAssemblyId}
                currentUser={currentUser}
                setSampleUnit={setSampleUnit}
              />
            )}

            {/* 2. CREATE POLL */}
            {activeTab === 'create_poll' && (
              <PollCreator 
                setPolls={setPolls}
                onSuccess={() => { setActiveTab('manage_polls'); setPollToEdit(null); }}
                currentUser={currentUser}
                pollToEdit={pollToEdit}
                onCancelEdit={() => { setActiveTab('manage_polls'); setPollToEdit(null); }}
              />
            )}

            {/* 3. MANAGE POLLS (List View) */}
            {activeTab === 'manage_polls' && !selectedPollId && (
              <PollList 
                polls={polls}
                onTogglePoll={onTogglePoll}
                onEndPoll={onEndPoll}
                onDeletePoll={onDeletePoll}
                onSelectPoll={(id) => { setSelectedPollId(id); setIsZoomMode(false); }}
                onSelectPollZoom={(id) => { setSelectedPollId(id); setIsZoomMode(true); }}
                onEditPoll={(poll) => { setPollToEdit(poll); setActiveTab('create_poll'); }}
                currentUser={currentUser}
                condoName={condoName}
                selectedAssemblyId={selectedAssemblyId}
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
                 currentUser={currentUser}
                 assemblyType={assemblyType}
                 setPolls={setPolls}
                 residentsCount={residentsCount}
                 isZoomMode={isZoomMode}
                 setIsZoomMode={setIsZoomMode}
              />
            )}

            {/* 5. ATTENDANCE */}
            {activeTab === 'attendance' && (
              <AttendancePanel 
                residents={residents}
                setResidents={setResidents}
                condoName={condoName}
                currentUser={currentUser}
                selectedAssemblyId={selectedAssemblyId}
              />
            )}

            {/* 6. END ASSEMBLY */}
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
          </div>
        </div>
      </div>
    </div>
  );
};
