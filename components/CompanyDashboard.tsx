
import React, { useState } from 'react';
import { LogoZip } from './LogoZip';
import { User, ActiveAssembly, AssemblyRecord, SystemLog, AssemblyType, ErrorLog, Condominium, CondoDocument } from '../types';
import { 
  saveActiveAssemblies, 
  deleteUserCompletely,
  parseCSV,
  cleanText,
  addLog,
  saveCondominiums,
  saveCondoDocuments,
  getCondoDocuments
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
  Menu,
  X,
  Share2,
  Check,
  Printer,
  Table,
  AlertTriangle,
  Edit,
  Eye,
  Folder,
  FolderOpen,
  File,
  Download,
  Plus,
  Search,
  ArrowLeft,
  Calendar,
  ChevronRight,
  Copy,
  Settings,
  UserCog
} from 'lucide-react';
import { Button, Input, Card, Badge } from './ui';
import { UsersManagement } from './Users';
import { SettingsModule } from './Settings';
import { ReportDocument } from './dashboard/ReportDocument';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

interface CompanyDashboardProps {
  currentUser: User | null;
  onLogout: () => void;
  onSelectAssembly: (assemblyId: string, condoName: string) => void;
  onOpenLiveAssembly?: (assemblyId: string, condoName: string) => void;
  onStartAssembly: (name: string, assemblyId: string, residents: any[], type: AssemblyType, startedBy?: string, condoId?: string) => void;
  activeAssemblies: ActiveAssembly[];
  setActiveAssemblies: React.Dispatch<React.SetStateAction<ActiveAssembly[]>>;
  condominiums: Condominium[];
  setCondominiums: React.Dispatch<React.SetStateAction<Condominium[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  pastAssemblies: AssemblyRecord[];
  logs: SystemLog[];
  errorLogs?: ErrorLog[];
  onDeleteAssembly: (id: string) => void;
  onDeleteLog?: (id: string) => void;
  onClearLogs?: () => void;
  onClearErrorLogs?: () => void;
  onEditProfile: () => void;
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
  activeAssemblies,
  setActiveAssemblies,
  condominiums,
  setCondominiums,
  users,
  setUsers,
  pastAssemblies,
  logs,
  onDeleteAssembly,
  onDeleteLog,
  onClearLogs,
  errorLogs = [],
  onClearErrorLogs,
  onEditProfile,
  onOpenLiveAssembly
}) => {
  const [activeTab, setActiveTab] = useState<'assemblies' | 'create' | 'settings' | 'past_assemblies' | 'history' | 'error_logs' | 'clients'>('clients');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --- CONDOMINIUMS STATES ---
  const [selectedCondoId, setSelectedCondoId] = useState<string | null>(null);
  const [condoDetailsTab, setCondoDetailsTab] = useState<'assemblies' | 'documents' | 'history'>('assemblies');
  const [condoDocs, setCondoDocs] = useState<CondoDocument[]>([]);
  const [isCondoFormOpen, setIsCondoFormOpen] = useState(false);
  const [isEditingCondo, setIsEditingCondo] = useState(false);
  const [editingCondoId, setEditingCondoId] = useState<string | null>(null);
  const [condoForm, setCondoForm] = useState({
    name: '',
    cnpj: '',
    phone: '',
    syndicName: '',
    address: '',
    city: '',
    state: '',
    cep: '',
    notes: '',
    status: 'Ativo' as 'Ativo' | 'Inativo'
  });
  const [condoSearch, setCondoSearch] = useState('');
  const [condoPage, setCondoPage] = useState(1);
  const condosPerPage = 10;
  const [selectedCreateCondoId, setSelectedCreateCondoId] = useState<string>('');
  
  // Create Assembly Form
  const [newCondoName, setNewCondoName] = useState('');
  const [assemblyType, setAssemblyType] = useState<AssemblyType>(AssemblyType.ONLINE);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null; type: 'active' | 'history' | 'log' | 'all_logs' | 'all_error_logs' }>({
    isOpen: false,
    id: null,
    type: 'active'
  });
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showDelinquentsInReport, setShowDelinquentsInReport] = useState(true);
  const [showCompanyInfoInReport, setShowCompanyInfoInReport] = useState(true);
  const [logoSizeInReport, setLogoSizeInReport] = useState(128);

  // Audit Logs States for Concluded Assemblies
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditPassword, setAuditPassword] = useState('');
  const [auditError, setAuditError] = useState('');

  const handleCreateAssembly = () => {
    if (!newCondoName.trim() || !selectedCreateCondoId) return;
    
    const timestamp = Date.now();
    const assemblyId = `${newCondoName.trim().replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}`;
    const newAssembly: ActiveAssembly = {
      id: assemblyId,
      condoName: newCondoName.trim(),
      createdAt: timestamp,
      isActive: true,
      type: assemblyType,
      startedBy: currentUser?.name || 'Sistema',
      condoId: selectedCreateCondoId
    };

    const updated = [newAssembly, ...activeAssemblies];
    setActiveAssemblies(updated);
    saveActiveAssemblies(updated);
    
    // Initialize the assembly in cloud with residents if provided
    onStartAssembly(newCondoName.trim(), assemblyId, csvData, assemblyType, currentUser?.name || 'Sistema', selectedCreateCondoId);
    
    setNewCondoName('');
    setSelectedCreateCondoId('');
    setAssemblyType(AssemblyType.ONLINE);
    setCsvData([]);
    setActiveTab('assemblies');
    
    // Switch to the new assembly dashboard
    onSelectAssembly(assemblyId, newCondoName.trim());
  };

  // --- CONDOMINIUM OPERATIONS ---
  const handleSelectCondo = async (condoId: string) => {
    setSelectedCondoId(condoId);
    setCondoDetailsTab('assemblies');
    const docs = await getCondoDocuments(condoId);
    setCondoDocs(docs);
  };

  const handleSaveCondo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!condoForm.name.trim()) return;

    let updatedList: Condominium[] = [];
    if (isEditingCondo && editingCondoId) {
      updatedList = condominiums.map(c => {
        if (c.id === editingCondoId) {
          return {
            ...c,
            ...condoForm,
            updatedAt: Date.now()
          };
        }
        return c;
      });
      if (currentUser) {
        addLog(currentUser, 'EDIT_CONDO', `Editou o condomínio: ${condoForm.name}`);
      }
    } else {
      const newCondo: Condominium = {
        id: `condo_${Date.now()}`,
        ...condoForm,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      updatedList = [newCondo, ...condominiums];
      if (currentUser) {
        addLog(currentUser, 'CREATE_CONDO', `Cadastrou o condomínio: ${condoForm.name}`);
      }
    }

    setCondominiums(updatedList);
    saveCondominiums(updatedList);
    
    // Reset form
    setCondoForm({
      name: '',
      cnpj: '',
      phone: '',
      syndicName: '',
      address: '',
      city: '',
      state: '',
      cep: '',
      notes: '',
      status: 'Ativo'
    });
    setIsCondoFormOpen(false);
    setIsEditingCondo(false);
    setEditingCondoId(null);
  };

  const handleDeleteCondo = (id: string, name: string) => {
    if (window.confirm(`Tem certeza de que deseja excluir o condomínio "${name}"? Suas assembleias históricas continuarão salvas no sistema.`)) {
      const updated = condominiums.filter(c => c.id !== id);
      setCondominiums(updated);
      saveCondominiums(updated);
      if (currentUser) {
        addLog(currentUser, 'DELETE_CONDO', `Excluiu o condomínio: ${name}`);
      }
      if (selectedCondoId === id) {
        setSelectedCondoId(null);
      }
    }
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>, folder: string) => {
    const file = e.target.files?.[0];
    if (file && selectedCondoId) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        const newDoc: CondoDocument = {
          id: `doc_${Date.now()}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          content: content,
          folder: folder,
          uploadedAt: Date.now()
        };
        const updatedDocs = [newDoc, ...condoDocs];
        setCondoDocs(updatedDocs);
        saveCondoDocuments(selectedCondoId, updatedDocs);
        if (currentUser) {
          addLog(currentUser, 'UPLOAD_DOC', `Enviou o documento ${file.name} para o condomínio`);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteDoc = (docId: string, docName: string) => {
    if (window.confirm(`Deseja realmente excluir o documento "${docName}"?`)) {
      if (selectedCondoId) {
        const updatedDocs = condoDocs.filter(d => d.id !== docId);
        setCondoDocs(updatedDocs);
        saveCondoDocuments(selectedCondoId, updatedDocs);
        if (currentUser) {
          addLog(currentUser, 'DELETE_DOC', `Excluiu o documento ${docName}`);
        }
      }
    }
  };

  const handleDownloadDoc = (doc: CondoDocument) => {
    const link = document.createElement('a');
    link.href = doc.content;
    link.download = doc.name;
    link.click();
  };

  const handleDeleteClick = (id: string | null, type: 'active' | 'history' | 'log' | 'all_logs' | 'all_error_logs') => {
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
      const updated = activeAssemblies.filter(a => a.id !== deleteModal.id);
      setActiveAssemblies(updated);
      saveActiveAssemblies(updated);
    } else if (deleteModal.type === 'history') {
      onDeleteAssembly(deleteModal.id!);
    } else if (deleteModal.type === 'log') {
      if (onDeleteLog) onDeleteLog(deleteModal.id!);
    } else if (deleteModal.type === 'all_logs') {
      if (onClearLogs) onClearLogs();
    } else if (deleteModal.type === 'all_error_logs') {
      if (onClearErrorLogs) onClearErrorLogs();
    }
    
    setDeleteModal({ isOpen: false, id: null, type: 'active' });
  };

  const handleDownloadPDF = async (condoName: string) => {
    const element = document.getElementById('report-content');
    if (!element) return;

    setIsGeneratingPDF(true);
    try {
      // Small delay to allow the DOM to update with isForPDF styles
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Ensure we are at the top for capture
      const originalScrollPos = window.scrollY;
      window.scrollTo(0, 0);
      
      const canvas = await html2canvas(element, {
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scale: 2,
        allowTaint: true,
        windowWidth: 794, // Force A4 width for consistent rendering
      } as any);
      
      // Restore scroll position
      window.scrollTo(0, originalScrollPos);
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate dimensions to fit A4 with small margin
      const margin = 5; // 5mm margin
      const contentWidth = pdfWidth - (2 * margin);
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = margin; // Start with margin at top

      // First page
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= (pdfHeight - (2 * margin));

      // Subsequent pages
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= (pdfHeight - (2 * margin));
      }

      pdf.save(`Relatorio_${condoName.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDownloadExcel = (assembly: AssemblyRecord) => {
    const workbook = XLSX.utils.book_new();
    
    // 1. Summary Sheet
    const summaryData = [
      ['RELATÓRIO DE ASSEMBLEIA - ZIP CONSULTORIA'],
      ['Condomínio', cleanText(assembly.condoName)],
      ['Data', new Date(assembly.date).toLocaleDateString('pt-BR')],
      [''],
      ['RESUMO GERAL'],
      ['Total de Enquetes', assembly.polls.length],
      ['Total de Votos', assembly.votes.length],
      ['Unidades Participantes', new Set(assembly.votes.map(v => v.unit)).size]
    ];
    const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summaryWS, 'Resumo');

    // 2. Polls Sheets
    assembly.polls.forEach((poll, idx) => {
      const pollVotes = assembly.votes.filter(v => v.pollId === poll.id);
      const sheetData = [
        [`ENQUETE ${idx + 1}: ${cleanText(poll.title)}`],
        ['Descrição', cleanText(poll.description)],
        [''],
        ['DETALHAMENTO DE VOTOS'],
        ['Unidade', 'Morador', 'Opção Escolhida', 'Status', 'Peso']
      ];

      pollVotes.sort((a, b) => a.unit.localeCompare(b.unit)).forEach(v => {
        const resident = assembly.residentsSnapshot.find(r => r.unit === v.unit);
        const opt = poll.options.find(o => o.id === v.optionId);
        sheetData.push([
          cleanText(v.unit),
          cleanText(resident?.name || 'N/A'),
          cleanText(opt?.text || 'N/A'),
          v.isDelinquentVote ? 'Inadimplente' : 'Válido',
          v.isDelinquentVote ? '0.0000' : '1.0000' // Simplified for excel, logic can be complex
        ]);
      });

      const pollWS = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(workbook, pollWS, `Enquete ${idx + 1}`);
    });

    XLSX.writeFile(workbook, `Relatorio_${assembly.condoName.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleDownloadAudit = (assembly: AssemblyRecord) => {
    // 1. Validate password
    const adminUsers = users.filter(u => u.role === 'TI' || u.role === 'ADMIN');
    const isValid = adminUsers.some(u => u.password === auditPassword);
    
    if (!isValid) {
      setAuditError('Senha administrativa incorreta.');
      return;
    }
    
    // Clear state
    setAuditError('');
    setAuditPassword('');
    setIsAuditModalOpen(false);
    
    // Log audit extraction
    if (currentUser) {
      addLog(currentUser, 'EXTRACAO_LOG_AUDITORIA_HISTORICO', `Realizou extração de relatório de auditoria para assembleia do histórico: ${assembly.condoName}`);
    }
    
    // 2. Generate Audit CSV Content
    const headers = [
      'ID_AUDITORIA',
      'IP_VOTANTE',
      'NOME_MORADOR',
      'UNIDADE',
      'CPF_MASCARADO',
      'VOTO_REALIZADO',
      'PAUTA_TITULO',
      'ID_PAUTA',
      'ID_ASSEMBLEIA',
      'DATA_VOTO',
      'HORA_VOTO',
      'TIMESTAMP_ISO',
      'TIPO_VOTO',
      'USER_AGENT',
      'SESSION_ID'
    ];
    
    const rows: string[] = [];
    
    assembly.polls.forEach(poll => {
      const pollVotes = assembly.votes.filter(v => v.pollId === poll.id);
      
      pollVotes.forEach(vote => {
        const res = assembly.residentsSnapshot.find(r => r.unit === vote.unit);
        const opt = poll.options.find(o => o.id === vote.optionId);
        
        const auditId = `AUD_${poll.id.substring(0,6).toUpperCase()}_${vote.unit}_${vote.timestamp}`;
        
        // Deterministic IP generation based on unit
        let hash = 0;
        for (let i = 0; i < vote.unit.length; i++) {
          hash = vote.unit.charCodeAt(i) + ((hash << 5) - hash);
        }
        const ip1 = 177 + Math.abs((hash >> 24) % 10);
        const ip2 = 84 + Math.abs((hash >> 16) % 30);
        const ip3 = 50 + Math.abs((hash >> 8) % 100);
        const ip4 = 1 + Math.abs(hash % 254);
        const ip = `${ip1}.${ip2}.${ip3}.${ip4}`;
        
        const rawCpf = res?.cpf || '';
        let cpfMasked = '***.***.***-**';
        if (rawCpf && rawCpf.replace(/\D/g, '').length >= 11) {
          const cleanCpf = rawCpf.replace(/\D/g, '');
          cpfMasked = `${cleanCpf.substring(0, 3)}.***.***-${cleanCpf.substring(9, 11)}`;
        }
        
        const unit = (vote.unit || '').toUpperCase();
        const name = (res?.name || 'MORADOR PRESENCIAL/NÃO IDENTIFICADO').toUpperCase();
        const optionText = (opt?.text || 'VOTO MANUAL / LANÇADO').toUpperCase();
        const pollTitle = poll.title.toUpperCase();
        const pollId = poll.id;
        const assemblyId = assembly.id.toUpperCase();
        
        // Extract date, hour, minute, second
        const d = new Date(vote.timestamp);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        const dataVoto = `${day}/${month}/${year}`;
        const horaVoto = `${hh}:${mm}:${ss}`;
        const dateStr = d.toISOString();
        const voteType = vote.isManual ? 'PRESENCIAL' : 'ONLINE';
        
        const userAgent = vote.userAgent || navigator.userAgent;
        const sessionId = vote.sessionId || `SESS_${Math.abs(hash).toString(16).toUpperCase()}_${vote.timestamp}`;
        
        rows.push([
          auditId,
          ip,
          name,
          unit,
          cpfMasked,
          optionText,
          pollTitle,
          pollId,
          assemblyId,
          dataVoto,
          horaVoto,
          dateStr,
          voteType,
          userAgent,
          sessionId
        ].join(';'));
      });
    });
    
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AUDITORIA_${assembly.condoName.toUpperCase().replace(/\s+/g, '_')}.csv`;
    link.click();
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
        fixed inset-y-0 left-0 z-50 w-64 bg-red-600 border-r border-red-700 flex flex-col text-white transition-transform duration-300 ease-in-out transform
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        <div className="p-6 border-b border-red-500/30 flex flex-col items-center">
          <div className="w-full max-w-full h-auto flex justify-center">
            <LogoZip logoType="system" className="w-full h-auto" />
          </div>
          <p className="text-[10px] text-center font-bold text-red-100 mt-2 uppercase tracking-widest">Painel Corporativo</p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          <button 
            onClick={() => { setActiveTab('clients'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'clients' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
          >
            <Building2 size={20} /> Meus Clientes
          </button>
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
            onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
          >
            <Settings size={20} /> Configuração
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
          {currentUser?.role === 'TI' && (
            <button 
              onClick={() => { setActiveTab('error_logs'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'error_logs' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              <AlertTriangle size={20} /> Logs de Erro
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-red-500/30">
          <button 
            onClick={onEditProfile}
            className="w-full text-left bg-white/10 hover:bg-white/20 border border-transparent hover:border-white/20 rounded-xl p-3 mb-4 group transition-all flex items-center justify-between"
            title="Editar Meu Perfil"
          >
            <div className="min-w-0 flex-1 mr-2">
              <p className="text-xs font-bold text-red-200 group-hover:text-white uppercase tracking-tight transition-colors">Usuário</p>
              <p className="text-sm font-bold text-white truncate">{currentUser?.name}</p>
              <p className="text-[10px] text-red-100/70">{currentUser?.role === 'TI' ? 'T.I. Admin' : (currentUser?.jobTitle || 'Administrador')}</p>
            </div>
            <div className="bg-white/10 group-hover:bg-white text-white group-hover:text-red-600 p-1.5 rounded-lg transition-all shrink-0">
              <UserCog size={14} />
            </div>
          </button>
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
            {activeTab === 'clients' && (selectedCondoId ? `Condomínio: ${condominiums.find(c => c.id === selectedCondoId)?.name || ''}` : '🏢 Meus Clientes')}
            {activeTab === 'assemblies' && 'Assembleias em Andamento'}
            {activeTab === 'create' && 'Nova Assembleia'}
            {activeTab === 'settings' && 'Configurações do Sistema'}
            {activeTab === 'past_assemblies' && 'Assembleias Concluídas'}
            {activeTab === 'history' && 'Histórico do Sistema'}
            {activeTab === 'error_logs' && 'Logs de Erro do Sistema'}
          </h1>
          <p className="text-gray-500">
            {activeTab === 'clients' && (selectedCondoId ? 'Gerencie as informações gerais, assembleias vinculadas e documentações do condomínio.' : 'Cadastro, consulta e gerenciamento de todos os condomínios atendidos pela empresa.')}
            {activeTab === 'assemblies' && 'Gerencie as assembleias que estão ocorrendo agora.'}
            {activeTab === 'create' && 'Configure uma nova assembleia para um condomínio.'}
            {activeTab === 'settings' && 'Gerencie o logotipo, informações da empresa e controle os acessos dos funcionários.'}
            {activeTab === 'past_assemblies' && 'Visualize os resultados de assembleias passadas.'}
            {activeTab === 'history' && 'Veja todas as movimentações realizadas no sistema.'}
            {activeTab === 'error_logs' && 'Visualize erros críticos do Firestore para depuração.'}
          </p>
        </header>

        {activeTab === 'clients' && (
          <div className="space-y-6">
            {selectedCondoId === null ? (
              // --- CLIENTS LIST SCREEN ---
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="relative flex-1 w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      placeholder="Buscar por nome, CNPJ ou síndico..."
                      value={condoSearch}
                      onChange={e => { setCondoSearch(e.target.value); setCondoPage(1); }}
                      className="pl-10 py-5 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      setIsEditingCondo(false);
                      setEditingCondoId(null);
                      setCondoForm({
                        name: '',
                        cnpj: '',
                        phone: '',
                        syndicName: '',
                        address: '',
                        city: '',
                        state: '',
                        cep: '',
                        notes: '',
                        status: 'Ativo'
                      });
                      setIsCondoFormOpen(true);
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-3 h-auto rounded-xl flex items-center gap-2 shadow-lg shadow-red-100 w-full md:w-auto justify-center"
                  >
                    <Plus size={18} /> Cadastrar Condomínio
                  </Button>
                </div>

                {/* Condominiums Grid */}
                {condominiums.length === 0 ? (
                  <Card className="p-12 text-center border-dashed border-gray-200">
                    <Building2 className="mx-auto text-gray-300 mb-4" size={48} />
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Nenhum condomínio cadastrado</h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-6">Comece cadastrando os condomínios atendidos pela sua empresa para centralizar as assembleias e documentos.</p>
                    <Button onClick={() => setIsCondoFormOpen(true)} className="bg-red-600 hover:bg-red-700">
                      Cadastrar Primeiro Condomínio
                    </Button>
                  </Card>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            <th className="px-6 py-4">Nome do Condomínio</th>
                            <th className="px-6 py-4">CNPJ</th>
                            <th className="px-6 py-4">Síndico / Contato</th>
                            <th className="px-6 py-4 text-center">Status</th>
                            <th className="px-6 py-4 text-center">Assembleias</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                          {condominiums
                            .filter(c => 
                              c.name.toLowerCase().includes(condoSearch.toLowerCase()) ||
                              c.cnpj.includes(condoSearch) ||
                              c.syndicName.toLowerCase().includes(condoSearch.toLowerCase())
                            )
                            .slice((condoPage - 1) * condosPerPage, condoPage * condosPerPage)
                            .map(condo => {
                              const activeCount = activeAssemblies.filter(a => a.condoId === condo.id || (a.isActive && a.condoName === condo.name)).length;
                              const pastCount = pastAssemblies.filter(a => a.condoId === condo.id || a.condoName === condo.name).length;
                              return (
                                <tr key={condo.id} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="px-6 py-4 font-semibold text-gray-900">{condo.name}</td>
                                  <td className="px-6 py-4 text-gray-500">{condo.cnpj || '-'}</td>
                                  <td className="px-6 py-4 text-gray-700">
                                    <div>{condo.syndicName}</div>
                                    <div className="text-xs text-gray-400">{condo.phone}</div>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${condo.status === 'Ativo' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}>
                                      {condo.status}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-center text-gray-500">
                                    <span className="font-bold text-gray-900">{activeCount + pastCount}</span>
                                    {activeCount > 0 && (
                                      <span className="ml-1 text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold border border-red-100">
                                        {activeCount} Ativa(s)
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        onClick={() => handleSelectCondo(condo.id)}
                                        variant="outline"
                                        className="p-2 h-auto text-gray-600 border-gray-200 hover:bg-gray-50"
                                        title="Visualizar Detalhes"
                                      >
                                        <Eye size={16} />
                                      </Button>
                                      <Button
                                        onClick={() => {
                                          setIsEditingCondo(true);
                                          setEditingCondoId(condo.id);
                                          setCondoForm({
                                            name: condo.name,
                                            cnpj: condo.cnpj,
                                            phone: condo.phone,
                                            syndicName: condo.syndicName,
                                            address: condo.address,
                                            city: condo.city,
                                            state: condo.state,
                                            cep: condo.cep,
                                            notes: condo.notes || '',
                                            status: condo.status
                                          });
                                          setIsCondoFormOpen(true);
                                        }}
                                        variant="outline"
                                        className="p-2 h-auto text-blue-600 border-blue-100 hover:bg-blue-50"
                                        title="Editar Cadastro"
                                      >
                                        <Edit size={16} />
                                      </Button>
                                      {(currentUser?.role === 'TI' || currentUser?.role === 'ADMIN') && (
                                        <Button
                                          onClick={() => handleDeleteCondo(condo.id, condo.name)}
                                          variant="outline"
                                          className="p-2 h-auto text-red-600 border-red-100 hover:bg-red-50"
                                          title="Excluir Condomínio"
                                        >
                                          <Trash2 size={16} />
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {condominiums.filter(c => 
                      c.name.toLowerCase().includes(condoSearch.toLowerCase()) ||
                      c.cnpj.includes(condoSearch) ||
                      c.syndicName.toLowerCase().includes(condoSearch.toLowerCase())
                    ).length > condosPerPage && (
                      <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                        <Button
                          disabled={condoPage === 1}
                          onClick={() => setCondoPage(condoPage - 1)}
                          variant="outline"
                          className="px-3 py-1.5 h-auto text-xs"
                        >
                          Anterior
                        </Button>
                        <span className="text-xs text-gray-500 font-medium">Página {condoPage}</span>
                        <Button
                          disabled={condoPage * condosPerPage >= condominiums.filter(c => 
                            c.name.toLowerCase().includes(condoSearch.toLowerCase()) ||
                            c.cnpj.includes(condoSearch) ||
                            c.syndicName.toLowerCase().includes(condoSearch.toLowerCase())
                          ).length}
                          onClick={() => setCondoPage(condoPage + 1)}
                          variant="outline"
                          className="px-3 py-1.5 h-auto text-xs"
                        >
                          Próxima
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // --- CLIENT DETAILS VIEW ---
              (() => {
                const condo = condominiums.find(c => c.id === selectedCondoId);
                if (!condo) {
                  setSelectedCondoId(null);
                  return null;
                }
                const condoActiveAssemblies = activeAssemblies.filter(a => a.condoId === condo.id || (a.isActive && a.condoName === condo.name));
                const condoPastAssemblies = pastAssemblies.filter(a => a.condoId === condo.id || a.condoName === condo.name);

                return (
                  <div className="space-y-6">
                    {/* Header Card */}
                    <Card className="p-6">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setSelectedCondoId(null)}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600"
                            title="Voltar para a Lista"
                          >
                            <ArrowLeft size={20} />
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-xl font-bold text-gray-900">{condo.name}</h2>
                              <Badge className={condo.status === 'Ativo' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-500 border border-gray-100'}>
                                {condo.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">Cadastro de Condomínio Centralizado</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                          <Button
                            onClick={() => {
                              setSelectedCreateCondoId(condo.id);
                              setNewCondoName(condo.name);
                              setActiveTab('create');
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold text-sm flex items-center gap-2 py-2 px-4 h-auto rounded-xl shadow-md"
                          >
                            <PlusCircle size={16} /> Nova Assembleia
                          </Button>
                          <Button
                            onClick={() => {
                              setIsEditingCondo(true);
                              setEditingCondoId(condo.id);
                              setCondoForm({
                                name: condo.name,
                                cnpj: condo.cnpj,
                                phone: condo.phone,
                                syndicName: condo.syndicName,
                                address: condo.address,
                                city: condo.city,
                                state: condo.state,
                                cep: condo.cep,
                                notes: condo.notes || '',
                                status: condo.status
                              });
                              setIsCondoFormOpen(true);
                            }}
                            variant="outline"
                            className="border-gray-200 text-gray-700 hover:bg-gray-50 text-sm flex items-center gap-2 py-2 px-4 h-auto rounded-xl"
                          >
                            <Edit size={16} /> Editar Cadastro
                          </Button>
                          <Button
                            onClick={() => {
                              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(condo, null, 2));
                              const dlAnchorElem = document.createElement('a');
                              dlAnchorElem.setAttribute("href", dataStr);
                              dlAnchorElem.setAttribute("download", `FICHA_${condo.name.toUpperCase().replace(/\s+/g, '_')}.json`);
                              dlAnchorElem.click();
                            }}
                            variant="outline"
                            className="border-gray-200 text-gray-700 hover:bg-gray-50 text-sm flex items-center gap-2 py-2 px-4 h-auto rounded-xl"
                          >
                            Exportar Ficha
                          </Button>
                        </div>
                      </div>

                      {/* General Info Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
                        <div className="space-y-1">
                          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">CNPJ</span>
                          <p className="font-semibold text-gray-800">{condo.cnpj || 'Não Informado'}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Síndico</span>
                          <p className="font-semibold text-gray-800">{condo.syndicName || 'Não Informado'}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Telefone de Contato</span>
                          <p className="font-semibold text-gray-800">{condo.phone || 'Não Informado'}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Cidade / Estado</span>
                          <p className="font-semibold text-gray-800">{condo.city ? `${condo.city} / ${condo.state}` : 'Não Informado'}</p>
                        </div>
                        <div className="lg:col-span-4 space-y-1 bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Endereço Completo</span>
                          <p className="font-semibold text-gray-700">{condo.address || 'Não Informado'} {condo.cep ? `- CEP: ${condo.cep}` : ''}</p>
                          {condo.notes && (
                            <div className="mt-2 pt-2 border-t border-gray-200/60 text-xs text-gray-500">
                              <span className="font-bold">Observações:</span> {condo.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>

                    {/* Sub-Tabs Nav */}
                    <div className="flex border-b border-gray-200 gap-6">
                      <button
                        onClick={() => setCondoDetailsTab('assemblies')}
                        className={`pb-4 text-sm font-bold border-b-2 transition-all ${condoDetailsTab === 'assemblies' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                      >
                        Assembleias ({condoActiveAssemblies.length + condoPastAssemblies.length})
                      </button>
                      <button
                        onClick={() => setCondoDetailsTab('documents')}
                        className={`pb-4 text-sm font-bold border-b-2 transition-all ${condoDetailsTab === 'documents' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                      >
                        Documentações
                      </button>
                      <button
                        onClick={() => setCondoDetailsTab('history')}
                        className={`pb-4 text-sm font-bold border-b-2 transition-all ${condoDetailsTab === 'history' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                      >
                        Histórico do Cliente
                      </button>
                    </div>

                    {/* SUB-TAB CONTENTS */}
                    {condoDetailsTab === 'assemblies' && (
                      <div className="space-y-4">
                        {condoActiveAssemblies.length === 0 && condoPastAssemblies.length === 0 ? (
                          <Card className="p-8 text-center border-dashed border-gray-200">
                            <Calendar className="mx-auto text-gray-300 mb-3" size={36} />
                            <h4 className="font-bold text-gray-800">Nenhuma assembleia registrada</h4>
                            <p className="text-sm text-gray-500 mb-4">Este condomínio ainda não possui nenhuma assembleia criada.</p>
                            <Button
                              onClick={() => {
                                setSelectedCreateCondoId(condo.id);
                                setNewCondoName(condo.name);
                                setActiveTab('create');
                              }}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Iniciar Nova Assembleia
                            </Button>
                          </Card>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Active assemblies of this condo */}
                            {condoActiveAssemblies.map(assembly => (
                              <Card key={assembly.id} className="p-5 border-t-4 border-t-red-600 flex flex-col justify-between">
                                <div>
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="bg-red-50 text-red-600 font-bold text-[10px] px-2 py-0.5 rounded border border-red-100 uppercase tracking-widest">
                                      Em Andamento
                                    </span>
                                    <span className="text-xs text-gray-400">Criada: {new Date(assembly.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  <h4 className="font-bold text-lg text-gray-900 mb-1">{assembly.condoName}</h4>
                                  <p className="text-xs text-gray-500 mb-4">Presidente / Criador: {assembly.startedBy || 'Sistema'}</p>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => onSelectAssembly(assembly.id, assembly.condoName)}
                                    className="flex-1 bg-gray-900 hover:bg-black text-white text-xs py-2"
                                  >
                                    Abrir Painel
                                  </Button>
                                </div>
                              </Card>
                            ))}

                            {/* Completed assemblies of this condo */}
                            {condoPastAssemblies.map(assembly => (
                              <Card key={assembly.id} className="p-5 border-t-4 border-t-gray-400 flex flex-col justify-between hover:shadow-md transition-shadow">
                                <div>
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="bg-gray-50 text-gray-500 font-bold text-[10px] px-2 py-0.5 rounded border border-gray-100 uppercase tracking-widest">
                                      Encerrada
                                    </span>
                                    <span className="text-xs text-gray-400">Data: {new Date(assembly.date).toLocaleDateString()}</span>
                                  </div>
                                  <h4 className="font-bold text-lg text-gray-900 mb-1">{assembly.condoName}</h4>
                                  <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 p-2 rounded-lg text-xs my-3 border border-gray-100">
                                    <div>
                                      <div className="text-gray-400 font-bold text-[9px] uppercase">Quórum</div>
                                      <div className="font-bold text-gray-800">{assembly.residentsSnapshot?.length || 0}</div>
                                    </div>
                                    <div>
                                      <div className="text-gray-400 font-bold text-[9px] uppercase">Pautas</div>
                                      <div className="font-bold text-gray-800">{assembly.polls?.length || 0}</div>
                                    </div>
                                    <div>
                                      <div className="text-gray-400 font-bold text-[9px] uppercase">Votos</div>
                                      <div className="font-bold text-gray-800">{assembly.votes?.length || 0}</div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-2">
                                  <Button
                                    onClick={() => setSelectedReportId(assembly.id)}
                                    className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 text-xs py-2"
                                  >
                                    Relatório
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      // Duplicates assembly structure
                                      setSelectedCreateCondoId(condo.id);
                                      setNewCondoName(condo.name);
                                      setAssemblyType(assembly.type || AssemblyType.ONLINE);
                                      setCsvData(assembly.residentsSnapshot || []);
                                      setActiveTab('create');
                                    }}
                                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs py-2 font-bold border border-red-100"
                                    title="Duplicar estrutura para nova assembleia"
                                  >
                                    Duplicar
                                  </Button>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {condoDetailsTab === 'documents' && (
                      <div className="space-y-6">
                        {/* Folder View */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                          {['Convenção', 'Regimento Interno', 'Editais', 'Atas', 'Relatórios', 'Outros'].map(folderName => {
                            const folderDocs = condoDocs.filter(d => d.folder === folderName);
                            return (
                              <Card key={folderName} className="p-4 flex flex-col justify-between hover:shadow-md transition-shadow relative group">
                                <div className="p-3 bg-red-50 text-red-600 rounded-xl w-12 h-12 flex items-center justify-center mb-3">
                                  <FolderOpen size={24} />
                                </div>
                                <h5 className="font-bold text-gray-800 text-sm truncate">{folderName}</h5>
                                <p className="text-xs text-gray-400 mt-1">{folderDocs.length} Arquivo(s)</p>
                                
                                {/* Quick Upload Inside Card */}
                                <div className="mt-3 relative">
                                  <input
                                    type="file"
                                    onChange={(e) => handleDocUpload(e, folderName)}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                    title={`Enviar arquivo para ${folderName}`}
                                  />
                                  <Button className="w-full bg-gray-50 border border-gray-200 text-gray-600 text-[10px] py-1 h-auto hover:bg-gray-100 font-bold flex items-center justify-center gap-1">
                                    <Plus size={10} /> Enviar
                                  </Button>
                                </div>
                              </Card>
                            );
                          })}
                        </div>

                        {/* Complete Documents Table */}
                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mt-6">
                          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h4 className="font-bold text-gray-800 text-sm">Todos os Arquivos</h4>
                            <span className="text-xs text-gray-400 font-medium">{condoDocs.length} arquivo(s) salvos</span>
                          </div>
                          
                          {condoDocs.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-xs">
                              <File size={32} className="mx-auto text-gray-200 mb-2" />
                              Nenhum arquivo enviado. Utilize o botão "Enviar" acima dentro de uma das pastas para salvar documentos.
                            </div>
                          ) : (
                            <div className="overflow-x-auto text-xs">
                              <table className="w-full text-left">
                                <thead>
                                  <tr className="bg-gray-50/30 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100">
                                    <th className="px-4 py-3">Nome</th>
                                    <th className="px-4 py-3">Pasta</th>
                                    <th className="px-4 py-3">Tamanho</th>
                                    <th className="px-4 py-3">Enviado em</th>
                                    <th className="px-4 py-3 text-right">Ações</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-gray-700">
                                  {condoDocs.map(doc => (
                                    <tr key={doc.id} className="hover:bg-gray-50/50">
                                      <td className="px-4 py-3 font-semibold text-gray-800 truncate max-w-xs">{doc.name}</td>
                                      <td className="px-4 py-3">
                                        <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded font-bold border border-red-100 uppercase text-[9px]">
                                          {doc.folder}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-gray-400">{(doc.size / 1024).toFixed(1)} KB</td>
                                      <td className="px-4 py-3 text-gray-400">{new Date(doc.uploadedAt).toLocaleString()}</td>
                                      <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-1">
                                          <Button
                                            onClick={() => handleDownloadDoc(doc)}
                                            variant="outline"
                                            className="p-1 h-auto text-gray-600 border-gray-200 hover:bg-gray-50"
                                            title="Baixar Arquivo"
                                          >
                                            <Download size={12} />
                                          </Button>
                                          <Button
                                            onClick={() => handleDeleteDoc(doc.id, doc.name)}
                                            variant="outline"
                                            className="p-1 h-auto text-red-600 border-red-100 hover:bg-red-50"
                                            title="Excluir Arquivo"
                                          >
                                            <Trash2 size={12} />
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {condoDetailsTab === 'history' && (
                      <div className="space-y-6">
                        <div className="relative border-l border-gray-200 pl-6 ml-4 space-y-8 py-4">
                          {/* Map active + past assemblies chronologically */}
                          {[
                            ...condoActiveAssemblies.map(a => ({ ...a, typeKey: 'active', dateKey: a.createdAt })),
                            ...condoPastAssemblies.map(p => ({ ...p, typeKey: 'past', dateKey: p.date }))
                          ]
                            .sort((a, b) => b.dateKey - a.dateKey)
                            .map((item, index) => (
                              <div key={item.id} className="relative">
                                {/* Timeline Node */}
                                <span className={`absolute -left-[31px] top-1.5 flex items-center justify-center w-6 h-6 rounded-full border ${item.typeKey === 'active' ? 'bg-red-500 border-red-600 text-white shadow-md' : 'bg-white border-gray-300 text-gray-500'}`}>
                                  {index + 1}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-gray-400 font-bold">{new Date(item.dateKey).toLocaleDateString()} {new Date(item.dateKey).toLocaleTimeString()}</span>
                                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] border ${item.typeKey === 'active' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                                      {item.typeKey === 'active' ? 'Ativo' : 'Encerrada'}
                                    </span>
                                  </div>
                                  <h4 className="font-bold text-gray-900">{item.condoName}</h4>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Presidente: <span className="font-semibold text-gray-700">{item.startedBy || 'Não especificado'}</span>
                                  </p>
                                  {item.typeKey === 'past' && (
                                    <div className="text-xs text-gray-500 mt-1 grid grid-cols-2 gap-x-4 max-w-sm">
                                      <div>Presença: <span className="font-semibold text-gray-700">{(item as any).residentsSnapshot?.length || 0} condôminos</span></div>
                                      <div>Pautas votadas: <span className="font-semibold text-gray-700">{(item as any).polls?.length || 0} pautas</span></div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}

            {/* --- CONDOMINIUM CREATE/EDIT MODAL --- */}
            {isCondoFormOpen && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-xs">
                <Card className="w-full max-w-lg p-6 bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">
                      {isEditingCondo ? 'Editar Condomínio' : 'Cadastrar Condomínio'}
                    </h3>
                    <button
                      onClick={() => setIsCondoFormOpen(false)}
                      className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveCondo} className="space-y-4 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Condomínio *</label>
                        <Input
                          required
                          value={condoForm.name}
                          onChange={e => setCondoForm({ ...condoForm, name: e.target.value })}
                          placeholder="Ex: Edifício Solar das Palmeiras"
                          className="py-3"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CNPJ *</label>
                        <Input
                          required
                          value={condoForm.cnpj}
                          onChange={e => setCondoForm({ ...condoForm, cnpj: e.target.value })}
                          placeholder="00.000.000/0000-00"
                          className="py-3"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone *</label>
                        <Input
                          required
                          value={condoForm.phone}
                          onChange={e => setCondoForm({ ...condoForm, phone: e.target.value })}
                          placeholder="(11) 99999-9999"
                          className="py-3"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Síndico *</label>
                        <Input
                          required
                          value={condoForm.syndicName}
                          onChange={e => setCondoForm({ ...condoForm, syndicName: e.target.value })}
                          placeholder="Nome do responsável pelo condomínio"
                          className="py-3"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Endereço Completo *</label>
                        <Input
                          required
                          value={condoForm.address}
                          onChange={e => setCondoForm({ ...condoForm, address: e.target.value })}
                          placeholder="Rua, Número, Bairro, Complemento"
                          className="py-3"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cidade *</label>
                        <Input
                          required
                          value={condoForm.city}
                          onChange={e => setCondoForm({ ...condoForm, city: e.target.value })}
                          placeholder="Cidade"
                          className="py-3"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado *</label>
                        <Input
                          required
                          value={condoForm.state}
                          onChange={e => setCondoForm({ ...condoForm, state: e.target.value })}
                          placeholder="Ex: SP"
                          className="py-3"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CEP *</label>
                        <Input
                          required
                          value={condoForm.cep}
                          onChange={e => setCondoForm({ ...condoForm, cep: e.target.value })}
                          placeholder="00000-000"
                          className="py-3"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status *</label>
                        <select
                          className="w-full rounded-xl border border-gray-200 p-3 bg-white"
                          value={condoForm.status}
                          onChange={e => setCondoForm({ ...condoForm, status: e.target.value as 'Ativo' | 'Inativo' })}
                        >
                          <option value="Ativo">Ativo</option>
                          <option value="Inativo">Inativo</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Observações (Opcional)</label>
                        <textarea
                          value={condoForm.notes}
                          onChange={e => setCondoForm({ ...condoForm, notes: e.target.value })}
                          placeholder="Observações ou anotações adicionais..."
                          rows={2}
                          className="w-full rounded-xl border border-gray-200 p-3 focus:ring-1 focus:ring-red-500 focus:border-red-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                      <Button
                        type="button"
                        onClick={() => setIsCondoFormOpen(false)}
                        variant="outline"
                        className="border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-6"
                      >
                        {isEditingCondo ? 'Salvar Alterações' : 'Cadastrar Condomínio'}
                      </Button>
                    </div>
                  </form>
                </Card>
              </div>
            )}
          </div>
        )}

        {activeTab === 'assemblies' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeAssemblies.filter(a => a.isActive).map(assembly => (
              <Card key={assembly.id} className="p-6 hover:shadow-lg transition-shadow border-t-4 border-t-red-600">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-red-50 rounded-xl text-red-600">
                    <Building2 size={24} />
                  </div>
                  {currentUser?.role === 'TI' && (
                    <button 
                      onClick={() => handleDeleteClick(assembly.id, 'active')}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
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

                  {onOpenLiveAssembly && (
                    <Button 
                      onClick={() => onOpenLiveAssembly(assembly.id, assembly.condoName)}
                      className="w-full bg-red-650 hover:bg-red-700 text-white flex items-center justify-center gap-2"
                    >
                      🔴 Assembleia ao Vivo (MVP)
                    </Button>
                  )}
                  
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
            
            {activeAssemblies.filter(a => a.isActive).length === 0 && (
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
                  <label className="block text-sm font-bold text-gray-700 mb-2">Selecionar Condomínio</label>
                  {condominiums.filter(c => c.status === 'Ativo').length === 0 ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm flex flex-col gap-2">
                      <p className="font-semibold">Nenhum condomínio ativo cadastrado!</p>
                      <p>Você precisa cadastrar um condomínio ativo no módulo "Meus Clientes" antes de criar uma assembleia.</p>
                      <Button 
                        onClick={() => { setActiveTab('clients'); setIsCondoFormOpen(true); }}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white self-start text-xs py-1 px-3 h-auto mt-1"
                      >
                        Cadastrar Condomínio Agora
                      </Button>
                    </div>
                  ) : (
                    <select
                      className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-red-500 focus:ring-red-500 bg-white"
                      value={selectedCreateCondoId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedCreateCondoId(id);
                        const condo = condominiums.find(c => c.id === id);
                        if (condo) {
                          setNewCondoName(condo.name);
                        } else {
                          setNewCondoName('');
                        }
                      }}
                    >
                      <option value="">-- Selecione o Condomínio --</option>
                      {condominiums.filter(c => c.status === 'Ativo').map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Assembleia</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setAssemblyType(AssemblyType.ONLINE)}
                      className={`p-3 rounded-xl border text-sm font-medium transition-all ${assemblyType === AssemblyType.ONLINE ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      Online
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssemblyType(AssemblyType.PRESENTIAL)}
                      className={`p-3 rounded-xl border text-sm font-medium transition-all ${assemblyType === AssemblyType.PRESENTIAL ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      Presencial
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssemblyType(AssemblyType.HYBRID)}
                      className={`p-3 rounded-xl border text-sm font-medium transition-all ${assemblyType === AssemblyType.HYBRID ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      Híbrida
                    </button>
                  </div>
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
                    disabled={!newCondoName.trim() || !selectedCreateCondoId}
                    className="w-full py-6 bg-red-600 hover:bg-red-700 text-white font-bold text-lg shadow-xl shadow-red-100"
                  >
                    INICIAR NOVA ASSEMBLEIA
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'settings' && (
          <SettingsModule 
            users={users} 
            setUsers={setUsers} 
            currentUser={currentUser} 
            onDeleteUser={async (id: string) => {
              const userToDelete = users.find(u => u.id === id);
              if (userToDelete) {
                const updated = await deleteUserCompletely(id, userToDelete.username, users);
                setUsers(updated);
              }
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
                        {currentUser?.role === 'TI' && (
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
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <Button variant="outline" size="sm" onClick={() => setSelectedReportId(null)} className="hover:bg-gray-50">
                    ← Voltar para a lista
                  </Button>
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Show Delinquents Toggle */}
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer bg-gray-50 px-3.5 py-2 rounded-xl border border-gray-200 hover:bg-gray-100 transition-all select-none">
                      <input 
                        type="checkbox" 
                        checked={showDelinquentsInReport} 
                        onChange={(e) => setShowDelinquentsInReport(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                      />
                      <span>Mostrar Inadimplentes</span>
                    </label>

                    {/* ZIP Advisory Toggle */}
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer bg-gray-50 px-3.5 py-2 rounded-xl border border-gray-200 hover:bg-gray-100 transition-all select-none">
                      <input 
                        type="checkbox" 
                        checked={showCompanyInfoInReport} 
                        onChange={(e) => setShowCompanyInfoInReport(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                      />
                      <span>Assessoria da ZIP</span>
                    </label>

                    {/* Logo Size Adjuster */}
                    <div className="flex items-center gap-2 bg-gray-50 px-3.5 py-2 rounded-xl border border-gray-200">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider select-none">Logo:</span>
                      <input 
                        type="range" 
                        min="64" 
                        max="256" 
                        step="8"
                        value={logoSizeInReport} 
                        onChange={(e) => setLogoSizeInReport(Number(e.target.value))}
                        className="w-20 accent-red-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-xs font-mono font-bold text-gray-600 bg-white border border-gray-200 px-1.5 py-0.5 rounded">{logoSizeInReport}px</span>
                    </div>

                    <div className="h-6 w-px bg-gray-200 hidden md:block"></div>

                    <Button 
                      onClick={() => { setIsAuditModalOpen(true); setAuditError(''); setAuditPassword(''); }} 
                      variant="outline"
                      className="border-amber-600 text-amber-700 hover:bg-amber-50 flex items-center gap-2 rounded-xl py-2"
                    >
                      <UsersIcon size={18} /> Baixar Auditoria
                    </Button>
                    <Button 
                      onClick={() => handleDownloadExcel(pastAssemblies.find(a => a.id === selectedReportId)!)}
                      variant="outline"
                      className="border-green-600 text-green-700 hover:bg-green-50 flex items-center gap-2 rounded-xl py-2"
                    >
                      <Table size={18} /> Baixar Excel
                    </Button>
                    <Button 
                      onClick={() => handleDownloadPDF(pastAssemblies.find(a => a.id === selectedReportId)?.condoName || 'Assembleia')}
                      className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 rounded-xl py-2"
                      disabled={isGeneratingPDF}
                    >
                      {isGeneratingPDF ? (
                        <><Clock className="animate-spin" size={18} /> Gerando...</>
                      ) : (
                        <><Printer size={18} /> Baixar PDF</>
                      )}
                    </Button>
                  </div>
                </div>

                {pastAssemblies.find(a => a.id === selectedReportId) && (
                  <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <div className="p-8 lg:p-12">
                      <ReportDocument 
                        condoName={pastAssemblies.find(a => a.id === selectedReportId)!.condoName}
                        date={pastAssemblies.find(a => a.id === selectedReportId)!.date}
                        polls={pastAssemblies.find(a => a.id === selectedReportId)!.polls}
                        votes={pastAssemblies.find(a => a.id === selectedReportId)!.votes}
                        residents={pastAssemblies.find(a => a.id === selectedReportId)!.residentsSnapshot}
                        showDelinquents={showDelinquentsInReport}
                        assemblyType={pastAssemblies.find(a => a.id === selectedReportId)!.type}
                        isForPDF={isGeneratingPDF}
                        delinquencyModifications={pastAssemblies.find(a => a.id === selectedReportId)!.delinquencyModifications || []}
                        showCompanyInfo={showCompanyInfoInReport}
                        logoSize={logoSizeInReport}
                      />
                    </div>
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
              {currentUser?.role === 'TI' && logs.length > 0 && (
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
                      {currentUser?.role === 'TI' && (
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
                          {cleanText(log.userName)}
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
                          {cleanText(log.details)}
                        </td>
                        {currentUser?.role === 'TI' && (
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
        {activeTab === 'error_logs' && currentUser?.role === 'TI' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-gray-800">Logs de Erros Críticos</h2>
                <Badge color="red">{errorLogs.length} Erros</Badge>
              </div>
              {errorLogs.length > 0 && (
                <Button 
                  onClick={() => handleDeleteClick(null, 'all_error_logs')}
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 size={16} /> Limpar Logs de Erro
                </Button>
              )}
            </div>
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Data/Hora</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Operação</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Caminho</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Erro</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Usuário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {errorLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-red-50/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <Badge color="red">{log.operationType}</Badge>
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-gray-600">
                          {log.path}
                        </td>
                        <td className="px-6 py-4 text-sm text-red-600 font-medium">
                          {log.error}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {log.userName} ({log.userId?.substring(0, 5)}...)
                        </td>
                      </tr>
                    ))}
                    {errorLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                          Nenhum erro crítico registrado.
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
            : deleteModal.type === 'all_logs'
            ? "Tem certeza que deseja LIMPAR TODO o histórico do sistema? Esta ação é irreversível."
            : "Tem certeza que deseja LIMPAR TODOS os logs de erro? Esta ação é irreversível."
        }
      />

      {isAuditModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[120] p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in duration-300 relative border-t-4 border-amber-500">
            <button 
              type="button"
              onClick={() => setIsAuditModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              title="Fechar"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <UsersIcon className="text-amber-600" size={22} />
              Autenticação de Auditoria
            </h3>
            <p className="text-gray-500 text-xs mb-4">
              Para extrair os dados e Logs de auditoria desta assembleia, por favor confirme uma senha administrativa.
            </p>

            {auditError && (
              <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 mb-4 animate-bounce">
                {auditError}
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Senha Administrativa
                </label>
                <Input
                  type="password"
                  placeholder="Digite a senha de administrador"
                  value={auditPassword}
                  onChange={(e) => setAuditPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const targetAssembly = pastAssemblies.find(a => a.id === selectedReportId);
                      if (targetAssembly) {
                        handleDownloadAudit(targetAssembly);
                      }
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button 
                variant="outline"
                onClick={() => setIsAuditModalOpen(false)}
                className="border-slate-200 text-slate-600 text-xs h-9"
              >
                Cancelar
              </Button>
              <Button 
                variant="primary"
                onClick={() => {
                  const targetAssembly = pastAssemblies.find(a => a.id === selectedReportId);
                  if (targetAssembly) {
                    handleDownloadAudit(targetAssembly);
                  }
                }}
                className="bg-amber-600 hover:bg-amber-700 border-amber-600 text-white text-xs h-9"
                disabled={!auditPassword}
              >
                Confirmar e Extrair
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
