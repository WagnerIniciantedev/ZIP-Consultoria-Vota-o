
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
  Check,
  Tablet,
  Menu,
  X,
  UserCog
} from 'lucide-react';
import { Button, Card } from './ui';
import { LogoZip } from './LogoZip';
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
  onGoToUrna: () => void;
  onVoteSubmit: (pollId: string, unit: string, optionId: string, isDelinquent: boolean, zoomName?: string) => Promise<void> | void;
  onReleaseDelinquentVote?: (pollId: string, unit: string, reason: string) => Promise<void> | void;
  onEditProfile: () => void;
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
  startedBy,
  onGoToUrna,
  onVoteSubmit,
  onReleaseDelinquentVote,
  onEditProfile
}) => {
  const [activeTab, setActiveTab] = useState<'setup_excel' | 'create_poll' | 'manage_polls' | 'attendance' | 'end_assembly'>('setup_excel');
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const [isZoomMode, setIsZoomMode] = useState(false);
  const [pollToEdit, setPollToEdit] = useState<Poll | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // TOUR STATE
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedUrna, setCopiedUrna] = useState(false);

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

  const handleCopyUrnaLink = () => {
    const safeKey = selectedAssemblyId || condoName.trim().replace(/[^a-zA-Z0-9]/g, '_');
    // Token with action 'u' for Urna access
    const data = { a: 'u', id: safeKey, ts: Date.now() };
    const token = btoa(JSON.stringify(data));
    const url = `${window.location.origin}?t=ZV_${token}`;
    navigator.clipboard.writeText(url);
    setCopiedUrna(true);
    setTimeout(() => setCopiedUrna(false), 2000);
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
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* TOUR COMPONENT */}
      <TourGuide 
        isOpen={isTourOpen} 
        onClose={() => handleFinishTour()} 
        onComplete={() => handleFinishTour()}
        steps={tourSteps}
      />

      {/* Mobile Header */}
      <div className="lg:hidden bg-red-600 p-4 flex items-center justify-between text-white shadow-md sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-14 max-w-full h-auto flex items-center justify-center">
            <LogoZip logoType="system" className="w-full h-auto" />
          </div>
          <span className="font-bold text-xs uppercase tracking-widest">Painel ZIP</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col text-gray-800 transition-transform duration-300 ease-in-out transform
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        <div className="p-6 border-b border-gray-100 flex flex-col items-center">
          <div className="w-full max-w-full h-auto flex justify-center">
            <LogoZip logoType="system" variant="red" className="w-full h-auto" />
          </div>
          <p className="text-[10px] text-center font-bold text-gray-400 mt-2 uppercase tracking-widest">Painel Assembleia</p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
          <button 
            id="tour-setup"
            onClick={() => { setActiveTab('setup_excel'); setSelectedPollId(null); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'setup_excel' ? 'bg-red-50 text-red-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <FileSpreadsheet size={20} /> Configuração Inicial
          </button>

          <button 
            id="tour-create"
            onClick={() => { setActiveTab('create_poll'); setSelectedPollId(null); setPollToEdit(null); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'create_poll' ? 'bg-red-50 text-red-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <Plus size={20} /> Criar Enquete
          </button>

          <button 
            id="tour-manage"
            onClick={() => { setActiveTab('manage_polls'); setSelectedPollId(null); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'manage_polls' && !selectedPollId ? 'bg-red-50 text-red-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <List size={20} /> Gerenciar Votações
          </button>
          
          <button 
            id="tour-attendance"
            onClick={() => { setActiveTab('attendance'); setSelectedPollId(null); setIsSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'attendance' ? 'bg-red-50 text-red-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <div className="flex items-center gap-3">
               <UserCheck size={20} /> Sala de Espera
            </div>
            {pendingResidentsCount > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingResidentsCount}</span>
            )}
          </button>

          <button 
            onClick={() => { onGoToUrna(); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <Tablet size={20} /> Urna Eletrônica
          </button>

          <div className="border-t my-4 border-gray-100"></div>

          <button 
            onClick={() => { onBackToCompany(); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} /> Voltar ao Painel
          </button>

          <button 
            id="tour-end"
            onClick={() => { setActiveTab('end_assembly'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors border ${activeTab === 'end_assembly' ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}
          >
            {isDemoMode ? <ArrowLeft size={20} /> : <StopCircle size={20} />} 
            {isDemoMode ? "Sair do Painel" : "Encerrar Assembleia"}
          </button>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={onEditProfile}
            className="w-full text-left bg-gray-50 hover:bg-red-50 border border-gray-100 hover:border-red-100 rounded-xl p-3 group transition-all flex items-center justify-between"
            title="Editar Meu Perfil"
          >
            <div className="min-w-0 flex-1 mr-2">
              <p className="text-xs font-bold text-gray-400 group-hover:text-red-500 uppercase tracking-tight transition-colors">Usuário</p>
              <p className="text-sm font-bold text-gray-800 truncate group-hover:text-red-700 transition-colors">{currentUser?.name}</p>
              <p className="text-[10px] text-gray-500">{currentUser?.role === 'TI' ? 'T.I. Admin' : (currentUser?.jobTitle || 'Administrador')}</p>
            </div>
            <div className="bg-white group-hover:bg-red-600 text-gray-400 group-hover:text-white p-1.5 rounded-lg border border-gray-100 group-hover:border-red-600 shadow-sm transition-all shrink-0">
              <UserCog size={14} />
            </div>
          </button>
          <button 
            onClick={onLogout}
            className="w-full mt-3 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            <LogOut size={14} /> Sair do Sistema
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-8">
        {/* Upper Dashboard bar with condo name and quick action buttons */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span className={`w-3.5 h-3.5 rounded-full inline-block ${isDemoMode ? 'bg-blue-500' : 'bg-green-500 animate-pulse'}`} />
              {condoName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
              {startedBy && (
                <span>
                  Iniciado por: <span className="font-semibold">{startedBy}</span>
                </span>
              )}
              {assemblyType && (
                <span className="bg-red-50 text-red-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  Assembleia {assemblyType === 'ONLINE' ? 'Online' : assemblyType === 'PRESENCIAL' ? 'Presencial' : 'Híbrida'}
                </span>
              )}
              {activePollsCount > 0 && (
                <span className="bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  {activePollsCount} Votação(ões) Ativa(s)
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCopyLink}
              className={`flex items-center gap-2 transition-all text-xs font-semibold py-2 px-3 ${copied ? 'bg-green-50 border-green-200 text-green-600' : 'border-blue-200 text-blue-600 hover:bg-blue-50'}`}
            >
              {copied ? <Check size={14} /> : <Share2 size={14} />} 
              {copied ? 'Link Copiado!' : 'Copiar Link de Votação'}
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCopyUrnaLink}
              className={`flex items-center gap-2 transition-all text-xs font-semibold py-2 px-3 ${copiedUrna ? 'bg-green-50 border-green-200 text-green-600' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              {copiedUrna ? <Check size={14} /> : <Tablet size={14} />} 
              {copiedUrna ? 'Link da Urna Copiado!' : 'Copiar Link da Urna'}
            </Button>

            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleRestartTour}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 text-xs font-semibold py-2 px-3"
              title="Como usar o sistema"
            >
              <HelpCircle size={14} />
              <span>Tour / Ajuda</span>
            </Button>
          </div>
        </header>

        {/* Dynamic Panels */}
        <div className="w-full">
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
               onVoteSubmit={onVoteSubmit}
               onReleaseDelinquentVote={onReleaseDelinquentVote}
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
  );
};
