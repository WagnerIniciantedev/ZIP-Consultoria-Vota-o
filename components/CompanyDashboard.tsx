
import React, { useState, useEffect } from 'react';
import { User, ActiveAssembly, AssemblyRecord, SystemLog } from '../types';
import { 
  getActiveAssemblies, saveActiveAssemblies, 
  saveUsers,
  parseCSV,
  exportVotesToCSV
} from '../services/dataService';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Users as UsersIcon, 
  History, 
  LogOut, 
  Building2, 
  ArrowRight,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Download,
  Menu,
  X,
  Share2,
  Check
} from 'lucide-react';
import { Button, Input, Card, Badge } from './ui';
import { UsersManagement } from './Users';

interface CompanyDashboardProps {
  currentUser: User | null;
  onLogout: () => void;
  onSelectAssembly: (assemblyId: string, condoName: string) => void;
  onStartAssembly: (name: string, assemblyId: string, residents: any[]) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  pastAssemblies: AssemblyRecord[];
  logs: SystemLog[];
  onDeleteAssembly: (id: string) => void;
  onDeleteLog?: (id: string) => void;
  onClearLogs?: () => void;
}

const ConfirmPasswordModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentUser: User | null;
  title: string;
  message: string;
}> = ({ isOpen, onClose, onConfirm, currentUser, title, message }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (password === currentUser?.password) {
      onConfirm();
      setPassword('');
      setError('');
    } else {
      setError('Senha incorreta. Tente novamente.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full p-6 shadow-2xl">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirme sua senha</label>
            <Input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button onClick={handleConfirm} className="flex-1 bg-red-600 hover:bg-red-700 text-white">Confirmar Exclusão</Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export const CompanyDashboard: React.FC<CompanyDashboardProps> = ({ 
  currentUser, 
  onLogout, 
  onSelectAssembly,
  onStartAssembly,
  users,
  setUsers,
  pastAssemblies,
  logs,
  onDeleteAssembly,
  onDeleteLog,
  onClearLogs
}) => {
  const [activeTab, setActiveTab] = useState<'assemblies' | 'create' | 'users' | 'past_assemblies' | 'history'>('assemblies');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [assemblies, setAssemblies] = useState<ActiveAssembly[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Create Assembly Form
  const [newCondoName, setNewCondoName] = useState('');
  const [csvData, setCsvData] = useState<any[]>([]);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null; type: 'active' | 'history' | 'log' | 'all_logs' }>({
    isOpen: false,
    id: null,
    type: 'active'
  });

  useEffect(() => {
    setAssemblies(getActiveAssemblies());
  }, []);

  const handleCreateAssembly = () => {
    if (!newCondoName.trim()) return;
    
    const timestamp = Date.now();
    const assemblyId = `${newCondoName.trim().replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}`;
    const newAssembly: ActiveAssembly = {
      id: assemblyId,
      condoName: newCondoName.trim(),
      createdAt: timestamp,
      isActive: true
    };

    const updated = [newAssembly, ...assemblies];
    setAssemblies(updated);
    saveActiveAssemblies(updated);
    
    // Initialize the assembly in cloud with residents if provided
    onStartAssembly(newCondoName.trim(), assemblyId, csvData);
    
    setNewCondoName('');
    setCsvData([]);
    setActiveTab('assemblies');
    
    // Switch to the new assembly dashboard
    onSelectAssembly(assemblyId, newCondoName.trim());
  };

  const handleDeleteClick = (id: string | null, type: 'active' | 'history' | 'log' | 'all_logs') => {
    setDeleteModal({ isOpen: true, id, type });
  };

  const handleCopyLink = (id: string) => {
    // Obfuscate the token more with a prefix to look "encrypted"
    const data = { a: 'r', id, ts: Date.now() };
    const token = btoa(JSON.stringify(data));
    const url = `${window.location.origin}?t=ZV_${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleConfirmDelete = () => {
    if (deleteModal.type !== 'all_logs' && !deleteModal.id) return;

    if (deleteModal.type === 'active') {
      const updated = assemblies.filter(a => a.id !== deleteModal.id);
      setAssemblies(updated);
      saveActiveAssemblies(updated);
    } else if (deleteModal.type === 'history') {
      onDeleteAssembly(deleteModal.id!);
    } else if (deleteModal.type === 'log') {
      if (onDeleteLog) onDeleteLog(deleteModal.id!);
    } else if (deleteModal.type === 'all_logs') {
      if (onClearLogs) onClearLogs();
    }
    
    setDeleteModal({ isOpen: false, id: null, type: 'active' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        setCsvData(parsed);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden bg-red-600 p-4 flex items-center justify-between text-white shadow-md sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <img src="https://i.postimg.cc/Y0w6w1cm/Whats-App-Image-2025-11-29-at-22-21-41-removebg-preview.png" alt="Logo" className="h-8 w-auto brightness-0 invert" />
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
        fixed inset-y-0 left-0 z-50 w-64 bg-red-600 border-r border-red-700 flex flex-col text-white transition-transform duration-300 ease-in-out transform
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        <div className="p-6 border-b border-red-500/30">
          <img src="https://i.postimg.cc/Y0w6w1cm/Whats-App-Image-2025-11-29-at-22-21-41-removebg-preview.png" alt="Logo" className="h-20 w-auto mx-auto brightness-0 invert" />
          <p className="text-[10px] text-center font-bold text-red-100 mt-2 uppercase tracking-widest">Painel Corporativo</p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          <button 
            onClick={() => { setActiveTab('assemblies'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'assemblies' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
          >
            <LayoutDashboard size={20} /> Assembleias Ativas
          </button>
          <button 
            onClick={() => { setActiveTab('create'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'create' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
          >
            <PlusCircle size={20} /> Criar Assembleia
          </button>
          <button 
            onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
          >
            <UsersIcon size={20} /> Funcionários
          </button>
          <button 
            onClick={() => { setActiveTab('past_assemblies'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'past_assemblies' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
          >
            <CheckCircle2 size={20} /> Assembleias Concluídas
          </button>
          <button 
            onClick={() => { setActiveTab('history'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
          >
            <History size={20} /> Histórico
          </button>
        </nav>

        <div className="p-4 border-t border-red-500/30">
          <div className="bg-white/10 rounded-xl p-3 mb-4">
            <p className="text-xs font-bold text-red-200 uppercase tracking-tight">Usuário</p>
            <p className="text-sm font-bold text-white truncate">{currentUser?.name}</p>
            <p className="text-[10px] text-red-100/70">{currentUser?.role}</p>
          </div>
          <Button 
            onClick={onLogout}
            variant="outline" 
            className="w-full flex items-center justify-center gap-2 text-white border-white/30 hover:bg-white/10"
          >
            <LogOut size={18} /> Sair
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {activeTab === 'assemblies' && 'Assembleias em Andamento'}
            {activeTab === 'create' && 'Nova Assembleia'}
            {activeTab === 'users' && 'Gestão de Funcionários'}
            {activeTab === 'past_assemblies' && 'Assembleias Concluídas'}
            {activeTab === 'history' && 'Histórico do Sistema'}
          </h1>
          <p className="text-gray-500">
            {activeTab === 'assemblies' && 'Gerencie as assembleias que estão ocorrendo agora.'}
            {activeTab === 'create' && 'Configure uma nova assembleia para um condomínio.'}
            {activeTab === 'users' && 'Controle o acesso dos administradores ao sistema.'}
            {activeTab === 'past_assemblies' && 'Visualize os resultados de assembleias passadas.'}
            {activeTab === 'history' && 'Veja todas as movimentações realizadas no sistema.'}
          </p>
        </header>

        {activeTab === 'assemblies' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assemblies.filter(a => a.isActive).map(assembly => (
              <Card key={assembly.id} className="p-6 hover:shadow-lg transition-shadow border-t-4 border-t-red-600">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-red-50 rounded-xl text-red-600">
                    <Building2 size={24} />
                  </div>
                  <button 
                    onClick={() => handleDeleteClick(assembly.id, 'active')}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{assembly.condoName}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
                  <Clock size={14} /> Criada em {new Date(assembly.createdAt).toLocaleDateString()}
                </div>
                
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={() => onSelectAssembly(assembly.id, assembly.condoName)}
                    className="w-full bg-gray-900 hover:bg-black text-white flex items-center justify-center gap-2"
                  >
                    Entrar na Assembleia <ArrowRight size={18} />
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={() => handleCopyLink(assembly.id)}
                    className={`w-full flex items-center justify-center gap-2 transition-all ${copiedId === assembly.id ? 'bg-green-50 border-green-200 text-green-600' : 'border-blue-200 text-blue-600 hover:bg-blue-50'}`}
                  >
                    {copiedId === assembly.id ? <Check size={16} /> : <Share2 size={16} />} 
                    {copiedId === assembly.id ? 'Link Copiado!' : 'Copiar Link de Votação'}
                  </Button>
                </div>
              </Card>
            ))}
            
            {assemblies.filter(a => a.isActive).length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
                <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="text-gray-300" size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Nenhuma assembleia ativa</h3>
                <p className="text-gray-500 mb-6">Comece criando uma nova assembleia para um condomínio.</p>
                <Button onClick={() => setActiveTab('create')} className="bg-red-600 hover:bg-red-700">
                  Criar Agora
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'create' && (
          <div className="max-w-2xl mx-auto">
            <Card className="p-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Nome do Condomínio</label>
                  <Input 
                    placeholder="Ex: Edifício Solar das Palmeiras" 
                    value={newCondoName}
                    onChange={e => setNewCondoName(e.target.value)}
                    className="text-lg py-6"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Lista de Condôminos (Excel/CSV)</label>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-red-300 transition-colors cursor-pointer relative">
                    <input 
                      type="file" 
                      accept=".csv" 
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <FileSpreadsheet className="mx-auto text-gray-300 mb-4" size={48} />
                    <p className="text-sm text-gray-600 font-medium">
                      {csvData.length > 0 ? `${csvData.length} condôminos carregados` : 'Clique ou arraste o arquivo CSV aqui'}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">Formato: CPF, Unidade, Nome, Inadimplente, Habite-se, Fração</p>
                  </div>
                </div>

                <div className="pt-4">
                  <Button 
                    onClick={handleCreateAssembly}
                    disabled={!newCondoName.trim()}
                    className="w-full py-6 bg-red-600 hover:bg-red-700 text-white font-bold text-lg shadow-xl shadow-red-100"
                  >
                    INICIAR NOVA ASSEMBLEIA
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'users' && (
          <UsersManagement 
            users={users} 
            setUsers={setUsers} 
            currentUser={currentUser} 
            onDeleteUser={(id: string) => {
              const updated = users.filter(u => u.id !== id);
              setUsers(updated);
              saveUsers(updated);
            }} 
          />
        )}

        {activeTab === 'past_assemblies' && (
          <div className="space-y-6">
            {!selectedReportId ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pastAssemblies.map(assembly => (
                  <Card key={assembly.id} className="p-6 hover:shadow-lg transition-shadow border-t-4 border-t-gray-400">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-gray-50 rounded-xl text-gray-600">
                        <Building2 size={24} />
                      </div>
                      <div className="flex gap-2">
                        {currentUser?.username === 'wagner.silva' && (
                          <button 
                            onClick={() => setDeleteModal({ isOpen: true, id: assembly.id, type: 'history' })}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{assembly.condoName}</h3>
                    <p className="text-sm text-gray-500 mb-4 flex items-center gap-1">
                      <Clock size={14} /> {new Date(assembly.date).toLocaleDateString()}
                    </p>
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-400 uppercase font-bold">Enquetes</span>
                        <span className="text-sm font-bold text-gray-700">{assembly.polls.length}</span>
                      </div>
                      <Button 
                        onClick={() => setSelectedReportId(assembly.id)}
                        variant="outline" 
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        Ver Relatório <ArrowRight size={16} />
                      </Button>
                    </div>
                  </Card>
                ))}
                
                {pastAssemblies.length === 0 && (
                  <div className="py-20 text-center text-gray-400 bg-white rounded-2xl border-2 border-dashed border-gray-100">
                    Nenhuma assembleia concluída ainda.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={() => setSelectedReportId(null)}>
                    ← Voltar para a lista
                  </Button>
                  <h2 className="text-xl font-bold text-gray-900">
                    Relatório: {pastAssemblies.find(a => a.id === selectedReportId)?.condoName}
                  </h2>
                  <div className="w-24"></div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {pastAssemblies.find(a => a.id === selectedReportId)?.polls.map(poll => {
                    const assembly = pastAssemblies.find(a => a.id === selectedReportId)!;
                    return (
                      <Card key={poll.id} className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">{poll.title}</h3>
                            <p className="text-sm text-gray-500">{poll.description}</p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => exportVotesToCSV(assembly.votes, assembly.residentsSnapshot, poll)}
                            className="flex items-center gap-2"
                          >
                            <Download size={16} /> Exportar CSV
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {poll.options.map(option => {
                            const votes = assembly.votes.filter(v => v.pollId === poll.id && v.optionId === option.id);
                            const totalVotes = assembly.votes.filter(v => v.pollId === poll.id).length;
                            const percentage = totalVotes > 0 ? (votes.length / totalVotes) * 100 : 0;

                            return (
                              <div key={option.id} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="font-medium text-gray-700">{option.text}</span>
                                  <span className="text-gray-500">{votes.length} votos ({percentage.toFixed(1)}%)</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                  <div 
                                    className="bg-red-600 h-full transition-all duration-500" 
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* ASSEMBLY SPECIFIC LOGS */}
                {pastAssemblies.find(a => a.id === selectedReportId)?.logs && (
                  <div className="mt-8">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Movimentações desta Assembleia</h3>
                    <Card className="p-0 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Data/Hora</th>
                              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Usuário</th>
                              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Ação</th>
                              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Detalhes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {pastAssemblies.find(a => a.id === selectedReportId)?.logs?.slice().reverse().map((log) => (
                              <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 text-sm text-gray-500">
                                  {new Date(log.timestamp).toLocaleString('pt-BR')}
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                  {log.userName}
                                </td>
                                <td className="px-6 py-4 text-sm">
                                  <Badge color={
                                    log.action.includes('LOGIN') ? 'green' : 
                                    log.action.includes('ERRO') ? 'red' : 
                                    log.action.includes('DELETE') ? 'red' : 'blue'
                                  }>
                                    {log.action}
                                  </Badge>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                  {log.details}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-gray-800">Histórico Geral de Movimentações</h2>
                <Badge color="blue">{logs.length} Registros</Badge>
              </div>
              {currentUser?.username === 'wagner.silva' && logs.length > 0 && (
                <Button 
                  onClick={() => handleDeleteClick(null, 'all_logs')}
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 size={16} /> Limpar Histórico
                </Button>
              )}
            </div>
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Data/Hora</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Usuário</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Ação</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Detalhes</th>
                      {currentUser?.username === 'wagner.silva' && (
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Ações</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logs.slice().reverse().map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {log.userName}
                          <div className="text-[10px] text-gray-400 font-normal uppercase tracking-tighter">
                            {log.assemblyId !== 'setup' ? log.assemblyId : 'Sistema'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <Badge color={
                            log.action.includes('LOGIN') ? 'green' : 
                            log.action.includes('ERRO') ? 'red' : 
                            log.action.includes('DELETE') ? 'red' : 'blue'
                          }>
                            {log.action}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {log.details}
                        </td>
                        {currentUser?.username === 'wagner.silva' && (
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDeleteClick(log.id, 'log')}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                              title="Excluir registro"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">
                          Nenhum registro de movimentação encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>

      <ConfirmPasswordModal 
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null, type: 'active' })}
        onConfirm={handleConfirmDelete}
        currentUser={currentUser}
        title="Confirmar Exclusão"
        message={
          deleteModal.type === 'active' 
            ? "Tem certeza que deseja excluir esta assembleia ativa? Todos os dados em tempo real serão perdidos permanentemente."
            : deleteModal.type === 'history'
            ? "Tem certeza que deseja excluir este relatório do histórico? Esta ação não pode ser desfeita."
            : deleteModal.type === 'log'
            ? "Tem certeza que deseja excluir este registro do histórico?"
            : "Tem certeza que deseja LIMPAR TODO o histórico do sistema? Esta ação é irreversível."
        }
      />
    </div>
  );
};
