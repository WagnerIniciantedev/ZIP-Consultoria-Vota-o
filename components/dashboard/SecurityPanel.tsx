import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Activity, 
  Settings as SettingsIcon, 
  Unlock, 
  Lock, 
  LogOut, 
  RefreshCw, 
  Search, 
  Download, 
  Check, 
  AlertTriangle,
  Clock,
  UserCheck,
  FileText
} from 'lucide-react';
import { Button, Card, Input } from '../ui';
import { db } from '../../services/firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  getDocs, 
  onSnapshot, 
  writeBatch,
  updateDoc,
  deleteDoc,
  where,
  orderBy
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { Resident } from '../../types';

interface SecurityPanelProps {
  selectedAssemblyId: string;
  condoName: string;
  currentUser: any;
  residents: Resident[];
  setResidents: React.Dispatch<React.SetStateAction<Resident[]>>;
}

interface SecurityConfig {
  maxAttempts: number;
  lockoutDuration: number; // in minutes
  allowMultipleSessions: boolean;
  sessionExpiration: number; // in minutes
  tokenExpiration: number; // in minutes
  requireAppCheck: boolean;
  requireToken: boolean;
  allowUnitCpf: boolean;
  allowTokenAccess: boolean;
  enableFullAudit: boolean;
  allowAutoUnlock: boolean;
}

const DEFAULT_CONFIG: SecurityConfig = {
  maxAttempts: 5,
  lockoutDuration: 15,
  allowMultipleSessions: false,
  sessionExpiration: 60,
  tokenExpiration: 120,
  requireAppCheck: false,
  requireToken: false,
  allowUnitCpf: true,
  allowTokenAccess: true,
  enableFullAudit: true,
  allowAutoUnlock: true
};

export const SecurityPanel: React.FC<SecurityPanelProps> = ({
  selectedAssemblyId,
  condoName,
  currentUser,
  residents,
  setResidents
}) => {
  const [subTab, setSubTab] = useState<'config' | 'sessions' | 'blocked' | 'logs'>('config');
  const safeAssemblyId = selectedAssemblyId.replace(/[^a-zA-Z0-9]/g, '_');

  // Config State
  const [config, setConfig] = useState<SecurityConfig>(DEFAULT_CONFIG);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sessions State
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Blocked Units State
  const [blockedUnits, setBlockedUnits] = useState<any[]>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);

  // Logs State
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logFilterUnit, setLogFilterUnit] = useState('');
  const [logFilterType, setLogFilterType] = useState('');
  const [logFilterResult, setLogFilterResult] = useState('');

  // General Status
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load Config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configRef = doc(db, 'assemblies', safeAssemblyId, 'security_settings', 'config');
        const snap = await getDoc(configRef);
        if (snap.exists()) {
          setConfig({ ...DEFAULT_CONFIG, ...snap.data() });
        } else {
          // Save default config
          await setDoc(configRef, DEFAULT_CONFIG);
        }
      } catch (err) {
        console.error('Error fetching security config:', err);
      }
    };
    fetchConfig();
  }, [safeAssemblyId]);

  // Load Sessions (Real-time sync)
  useEffect(() => {
    if (subTab !== 'sessions') return;
    setIsLoadingSessions(true);
    const sessionsRef = collection(db, 'assemblies', safeAssemblyId, 'resident_sessions');
    const q = query(sessionsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeSessions: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Filter out expired if client-side check is desired, but let's show all and display status
        activeSessions.push({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
          lastActivity: data.lastActivity?.toDate ? data.lastActivity.toDate() : new Date(data.lastActivity || Date.now()),
          expiresAt: data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt || Date.now())
        });
      });
      setSessions(activeSessions);
      setIsLoadingSessions(false);
    }, (err) => {
      console.error('Error listening to sessions:', err);
      setIsLoadingSessions(false);
    });

    return () => unsubscribe();
  }, [safeAssemblyId, subTab]);

  // Load Blocked Units
  useEffect(() => {
    if (subTab !== 'blocked') return;
    setIsLoadingBlocked(true);
    const blockedRef = collection(db, 'assemblies', safeAssemblyId, 'blocked_units');
    
    const unsubscribe = onSnapshot(blockedRef, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          ...data,
          lockedAt: data.lockedAt?.toDate ? data.lockedAt.toDate() : new Date(data.lockedAt || Date.now()),
          lockedUntil: data.lockedUntil?.toDate ? data.lockedUntil.toDate() : new Date(data.lockedUntil || Date.now())
        });
      });
      setBlockedUnits(list);
      setIsLoadingBlocked(false);
    }, (err) => {
      console.error('Error listening to blocked units:', err);
      setIsLoadingBlocked(false);
    });

    return () => unsubscribe();
  }, [safeAssemblyId, subTab]);

  // Load Logs
  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const logsRef = collection(db, 'assemblies', safeAssemblyId, 'audit_logs');
      let q = query(logsRef, orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      const fetchedLogs: any[] = [];
      snap.forEach((docSnap) => {
        fetchedLogs.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      setLogs(fetchedLogs);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (subTab === 'logs') {
      fetchLogs();
    }
  }, [safeAssemblyId, subTab]);

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const configRef = doc(db, 'assemblies', safeAssemblyId, 'security_settings', 'config');
      await setDoc(configRef, config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Log Config Change
      const registerAuditLogFn = httpsCallable(functions, 'registerAuditLog');
      await registerAuditLogFn({
        assemblyId: safeAssemblyId,
        action: 'SECURITY_CONFIG_UPDATED',
        details: `Configurações de segurança atualizadas pelo administrador ${currentUser?.name || currentUser?.email}.`
      });
    } catch (err) {
      console.error('Error saving security config:', err);
      alert('Erro ao salvar as configurações de segurança.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleCloseSession = async (sessionId: string, unit: string) => {
    if (!window.confirm(`Tem certeza que deseja derrubar a sessão ativa da unidade ${unit}?`)) return;
    try {
      const closeSessionFn = httpsCallable(functions, 'closeResidentSession');
      await closeSessionFn({
        assemblyId: safeAssemblyId,
        sessionId
      });

      // Also register log
      const registerAuditLogFn = httpsCallable(functions, 'registerAuditLog');
      await registerAuditLogFn({
        assemblyId: safeAssemblyId,
        action: 'SESSION_TERMINATED_MANUAL',
        unit,
        details: `Sessão ativa da unidade ${unit} derrubada manualmente pelo administrador.`
      });
    } catch (err: any) {
      console.error('Error closing session:', err);
      alert(err.message || 'Erro ao fechar sessão.');
    }
  };

  const handleUnlockUnit = async (unit: string) => {
    if (!window.confirm(`Tem certeza que deseja desbloquear o acesso da unidade ${unit}?`)) return;
    try {
      const unlockResidentFn = httpsCallable(functions, 'unlockResident');
      const res = await unlockResidentFn({
        assemblyId: safeAssemblyId,
        unit
      });

      if (res.data && (res.data as any).success) {
        // Log in Audit
        const registerAuditLogFn = httpsCallable(functions, 'registerAuditLog');
        await registerAuditLogFn({
          assemblyId: safeAssemblyId,
          action: 'MANUAL_UNLOCK',
          unit,
          details: `Unidade ${unit} foi desbloqueada manualmente pelo administrador.`
        });
        
        // Update local residents list if possible to clear blocked status if stored there
        setResidents(prev => prev.map(r => r.unit.toLowerCase() === unit.toLowerCase() ? { ...r, attendanceStatus: 'NONE' } : r));
      }
    } catch (err: any) {
      console.error('Error unlocking unit:', err);
      alert(err.message || 'Erro ao desbloquear unidade.');
    }
  };

  const handleManualBlock = async (unit: string) => {
    const reason = window.prompt(`Digite o motivo do bloqueio para a unidade ${unit}:`, 'Bloqueio administrativo temporário');
    if (reason === null) return;
    try {
      const blockResidentFn = httpsCallable(functions, 'blockResident');
      const res = await blockResidentFn({
        assemblyId: safeAssemblyId,
        unit,
        reason
      });

      if (res.data && (res.data as any).success) {
        // Log in Audit
        const registerAuditLogFn = httpsCallable(functions, 'registerAuditLog');
        await registerAuditLogFn({
          assemblyId: safeAssemblyId,
          action: 'MANUAL_BLOCK',
          unit,
          details: `Unidade ${unit} foi bloqueada manualmente pelo administrador. Motivo: ${reason}`
        });

        // Update local residents list
        setResidents(prev => prev.map(r => r.unit.toLowerCase() === unit.toLowerCase() ? { ...r, attendanceStatus: 'BLOCKED' } : r));
      }
    } catch (err: any) {
      console.error('Error blocking unit:', err);
      alert(err.message || 'Erro ao bloquear unidade.');
    }
  };

  // Log Filtering Logic
  const filteredLogs = logs.filter(log => {
    if (logFilterUnit && !log.unit?.toLowerCase().includes(logFilterUnit.toLowerCase())) return false;
    if (logFilterType && log.action !== logFilterType) return false;
    if (logFilterResult) {
      const isSuccess = log.result === 'SUCCESS' || log.success === true || !log.error;
      if (logFilterResult === 'SUCCESS' && !isSuccess) return false;
      if (logFilterResult === 'FAILURE' && isSuccess) return false;
    }
    return true;
  });

  const handleExportCSV = () => {
    let headers = 'ID,Data/Hora,Unidade,Ação,IP,Dispositivo,Resultado,Detalhes\n';
    const rows = filteredLogs.map(l => {
      const date = l.dateTime || new Date(l.timestamp).toISOString();
      const outcome = (l.result || (l.error ? 'FALHA' : 'SUCESSO'));
      return `"${l.id}","${date}","${l.unit || '-'}","${l.action}","${l.ip || '-'}","${(l.userAgent || '').replace(/"/g, '""')}","${outcome}","${(l.details || '').replace(/"/g, '""')}"`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `auditoria_${safeAssemblyId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-50 min-h-screen rounded-2xl border border-slate-100 overflow-hidden">
      {/* Banner Header */}
      <div className="bg-slate-900 text-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2.5 rounded-xl">
            <Shield size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Módulo de Segurança Zero-Trust</h2>
            <p className="text-xs text-slate-400">Proteção biométrica, controle de sessão ativa e auditoria criptográfica.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
            Escudo Ativo
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={subTab === 'logs' ? fetchLogs : undefined} 
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 h-9"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4">
        <button
          onClick={() => setSubTab('config')}
          className={`px-4 py-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 ${subTab === 'config' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <SettingsIcon size={16} /> Configurações de Segurança
        </button>
        <button
          onClick={() => setSubTab('sessions')}
          className={`px-4 py-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 ${subTab === 'sessions' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Clock size={16} /> Sessões Ativas ({sessions.filter(s => s.status === 'ACTIVE').length})
        </button>
        <button
          onClick={() => setSubTab('blocked')}
          className={`px-4 py-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 ${subTab === 'blocked' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Lock size={16} /> Unidades Bloqueadas ({blockedUnits.length})
        </button>
        <button
          onClick={() => setSubTab('logs')}
          className={`px-4 py-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-all flex items-center gap-2 ${subTab === 'logs' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <FileText size={16} /> Log de Auditoria
        </button>
      </div>

      {/* Tab Panels */}
      <div className="p-6">
        {subTab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card title="Parâmetros Gerais de Segurança">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tentativas Máximas de Entrada</label>
                    <Input 
                      type="number" 
                      value={config.maxAttempts} 
                      onChange={e => setConfig(prev => ({ ...prev, maxAttempts: parseInt(e.target.value) || 5 }))}
                      className="h-10"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Número de erros permitidos antes de bloquear a unidade temporariamente.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tempo de Bloqueio de Força Bruta</label>
                    <Input 
                      type="number" 
                      value={config.lockoutDuration} 
                      onChange={e => setConfig(prev => ({ ...prev, lockoutDuration: parseInt(e.target.value) || 15 }))}
                      className="h-10"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Duração do bloqueio temporário em minutos após as tentativas excedidas.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Expiração da Sessão do Condômino</label>
                    <Input 
                      type="number" 
                      value={config.sessionExpiration} 
                      onChange={e => setConfig(prev => ({ ...prev, sessionExpiration: parseInt(e.target.value) || 60 }))}
                      className="h-10"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Tempo limite de inatividade em minutos após a validação.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Expiração de Token de Acesso</label>
                    <Input 
                      type="number" 
                      value={config.tokenExpiration} 
                      onChange={e => setConfig(prev => ({ ...prev, tokenExpiration: parseInt(e.target.value) || 120 }))}
                      className="h-10"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Validade máxima do Token enviado por e-mail/WhatsApp (em minutos).</p>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
                  <Button 
                    onClick={handleSaveConfig} 
                    className="bg-slate-900 text-white hover:bg-slate-800 px-6 h-11 flex items-center gap-2"
                    disabled={isSavingConfig}
                  >
                    {isSavingConfig ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
                    Salvar Configurações
                  </Button>
                  {saveSuccess && (
                    <span className="text-emerald-600 font-bold text-sm flex items-center gap-1.5 animate-pulse">
                      <Check size={16} /> Configurações salvas com sucesso!
                    </span>
                  )}
                </div>
              </Card>

              <Card title="Mecanismos de Validação e Autenticação">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100/50 transition-colors">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Acesso por Unidade + CPF/CNPJ</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Permite que condôminos encontrem suas credenciais usando CPF ou CNPJ cadastrado.</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={config.allowUnitCpf} 
                      onChange={e => setConfig(prev => ({ ...prev, allowUnitCpf: e.target.checked }))}
                      className="w-5 h-5 accent-red-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100/50 transition-colors">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Acesso por Token Individual Seguro</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Permite que condôminos façam login instantaneamente via Token gerado de uso único.</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={config.allowTokenAccess} 
                      onChange={e => setConfig(prev => ({ ...prev, allowTokenAccess: e.target.checked }))}
                      className="w-5 h-5 accent-red-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100/50 transition-colors">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Bloquear Múltiplas Sessões Ativas</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Impeça novos acessos se uma sessão já estiver ativa para o mesmo apartamento.</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={!config.allowMultipleSessions} 
                      onChange={e => setConfig(prev => ({ ...prev, allowMultipleSessions: !e.target.checked }))}
                      className="w-5 h-5 accent-red-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100/50 transition-colors">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Forçar Firebase App Check Enforcement</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Exigir atestado de integridade do dispositivo do cliente antes de registrar operações críticas.</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={config.requireAppCheck} 
                      onChange={e => setConfig(prev => ({ ...prev, requireAppCheck: e.target.checked }))}
                      className="w-5 h-5 accent-red-600 cursor-pointer"
                    />
                  </div>
                </div>
              </Card>
            </div>

            {/* Quick Audit / Status Box */}
            <div className="space-y-6">
              <Card title="Status do Escudo">
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex gap-3">
                    <Shield className="text-emerald-600 shrink-0" size={20} />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Criptografia SHA-256</h4>
                      <p className="text-[11px] text-emerald-700/80 mt-1">Todas as senhas e hashes são criptografados no servidor. Chave privada protegida pelo KMS.</p>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3">
                    <Activity className="text-blue-600 shrink-0" size={20} />
                    <div>
                      <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wide">Monitor de Concorrência</h4>
                      <p className="text-[11px] text-blue-700/80 mt-1">Transações atômicas garantem consistência impecável durante picos de votação.</p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-100 rounded-xl flex flex-col gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Estatísticas Rápidas:</span>
                    <div className="flex justify-between text-xs text-slate-600 py-1 border-b border-slate-200">
                      <span>Presenças Verificadas:</span>
                      <span className="font-bold">{residents.filter(r => r.attendanceStatus === 'APPROVED').length} / {residents.length}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 py-1 border-b border-slate-200">
                      <span>Sessões Ativas no Momento:</span>
                      <span className="font-bold">{sessions.filter(s => s.status === 'ACTIVE').length}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 py-1">
                      <span>Bloqueios Registrados:</span>
                      <span className="font-bold text-red-600">{blockedUnits.length}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {subTab === 'sessions' && (
          <Card title="Sessões Ativas no Servidor">
            {isLoadingSessions ? (
              <div className="text-center py-12">
                <RefreshCw className="animate-spin text-slate-400 mx-auto mb-3" size={28} />
                <p className="text-sm text-slate-500">Sincronizando sessões...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                <Clock className="text-slate-300 mx-auto mb-2" size={32} />
                <h3 className="text-sm font-bold text-slate-600">Nenhuma sessão ativa encontrada</h3>
                <p className="text-xs text-slate-400 mt-1">Nenhum condômino está logado na assembleia no momento.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Unidade</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Dispositivo</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Última Atividade</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">IP (Mascarado)</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Status</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors text-xs text-slate-700">
                        <td className="px-4 py-3 font-bold text-slate-900">{s.unit}</td>
                        <td className="px-4 py-3 max-w-xs truncate" title={s.deviceFingerprint?.userAgent || s.userAgent}>
                          {s.deviceFingerprint?.os || 'OS Desconhecido'} - {s.deviceFingerprint?.browser || 'Navegador'}
                        </td>
                        <td className="px-4 py-3">{s.lastActivity?.toLocaleTimeString()} ({Math.round((s.expiresAt - Date.now()) / 60000)}m restantes)</td>
                        <td className="px-4 py-3 font-mono">{s.ipHash ? `${s.ipHash.substring(0,6)}***` : '192.168.***'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                            {s.status === 'ACTIVE' ? 'Ativo' : s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {s.status === 'ACTIVE' && (
                            <Button 
                              onClick={() => handleCloseSession(s.id, s.unit)} 
                              variant="danger" 
                              size="sm"
                              className="px-2 py-1 h-7 text-[10px]"
                            >
                              <LogOut size={10} className="mr-1" /> Derrubar
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {subTab === 'blocked' && (
          <Card title="Unidades Bloqueadas por Força Bruta">
            {isLoadingBlocked ? (
              <div className="text-center py-12">
                <RefreshCw className="animate-spin text-slate-400 mx-auto mb-3" size={28} />
                <p className="text-sm text-slate-500">Buscando bloqueios...</p>
              </div>
            ) : blockedUnits.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                <Unlock className="text-emerald-500/80 mx-auto mb-2" size={32} />
                <h3 className="text-sm font-bold text-slate-600">Nenhum bloqueio registrado</h3>
                <p className="text-xs text-slate-400 mt-1">Todas as unidades estão liberadas para votação e login.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Unidade</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Motivo</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Tentativas</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Bloqueado Em</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Tempo Restante</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedUnits.map((u) => {
                      const minutesLeft = Math.max(0, Math.round((u.lockedUntil - Date.now()) / 60000));
                      return (
                        <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors text-xs text-slate-700">
                          <td className="px-4 py-3 font-bold text-slate-900">{u.id}</td>
                          <td className="px-4 py-3">{u.reason || 'Tentativas inválidas de login'}</td>
                          <td className="px-4 py-3 font-semibold text-red-600">{u.attempts || 5}</td>
                          <td className="px-4 py-3">{u.lockedAt?.toLocaleTimeString()}</td>
                          <td className="px-4 py-3 font-semibold text-amber-600">
                            {minutesLeft > 0 ? `${minutesLeft} min` : 'Expirado (aguardando login)'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button 
                              onClick={() => handleUnlockUnit(u.id)} 
                              variant="outline" 
                              size="sm"
                              className="px-2 py-1 h-7 text-[10px] text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            >
                              <Unlock size={10} className="mr-1" /> Desbloquear
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {subTab === 'logs' && (
          <Card 
            title="Log de Auditoria em Tempo Real"
            headerActions={
              <Button onClick={handleExportCSV} variant="outline" size="sm" className="flex items-center gap-1.5 h-8">
                <Download size={12} /> Exportar CSV
              </Button>
            }
          >
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Filtrar por Unidade</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                  <Input 
                    placeholder="Ex: 101, A20..." 
                    value={logFilterUnit} 
                    onChange={e => setLogFilterUnit(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Filtrar por Tipo de Ação</label>
                <select 
                  value={logFilterType} 
                  onChange={e => setLogFilterType(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 h-9 px-3 text-xs outline-none focus:ring-1 focus:ring-slate-300"
                >
                  <option value="">Todas as ações</option>
                  <option value="LOGIN_SUCCESS">Login com Sucesso</option>
                  <option value="LOGIN_FAILED">Tentativa Inválida</option>
                  <option value="SECURE_VOTE_REGISTERED">Voto Computado</option>
                  <option value="MANUAL_VOTE_REGISTERED">Voto Presencial</option>
                  <option value="MANUAL_UNLOCK">Desbloqueio Manual</option>
                  <option value="MANUAL_BLOCK">Bloqueio Manual</option>
                  <option value="SECURITY_CONFIG_UPDATED">Configurações de Segurança Atualizadas</option>
                  <option value="SESSION_TERMINATED_MANUAL">Sessão Derrubada</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Resultado</label>
                <select 
                  value={logFilterResult} 
                  onChange={e => setLogFilterResult(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 h-9 px-3 text-xs outline-none focus:ring-1 focus:ring-slate-300"
                >
                  <option value="">Todos</option>
                  <option value="SUCCESS">Sucesso</option>
                  <option value="FAILURE">Falha / Erro</option>
                </select>
              </div>
            </div>

            {isLoadingLogs ? (
              <div className="text-center py-12">
                <RefreshCw className="animate-spin text-slate-400 mx-auto mb-3" size={28} />
                <p className="text-sm text-slate-500">Carregando logs...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                <FileText className="text-slate-300 mx-auto mb-2" size={32} />
                <h3 className="text-sm font-bold text-slate-600">Nenhum log encontrado</h3>
                <p className="text-xs text-slate-400 mt-1">Nenhum evento registrado corresponde aos filtros selecionados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Timestamp</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Unidade</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Ação</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">IP / Dispositivo</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Resultado</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-slate-400 tracking-wider">Chave de Auditoria (Ledger Seal)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((l) => {
                      const date = new Date(l.timestamp);
                      const isSuccess = l.result === 'SUCCESS' || l.success === true || !l.error;
                      return (
                        <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors text-xs text-slate-700">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-bold text-slate-900">{date.toLocaleDateString()}</span>{' '}
                            <span className="text-slate-400">{date.toLocaleTimeString()}</span>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-800">{l.unit || '-'}</td>
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {l.action}
                            <p className="text-[10px] text-slate-400 font-normal mt-0.5">{l.details}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono text-[10px] text-slate-500">{l.ip || '0.0.0.0'}</p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[150px]" title={l.userAgent}>{l.userAgent || 'Chrome / Android'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${isSuccess ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {isSuccess ? 'SUCESSO' : 'FALHA'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[10px] text-slate-400" title={l.cryptographicSealedHash || l.receipt}>
                            {l.cryptographicSealedHash ? `${l.cryptographicSealedHash.substring(0, 12)}...` : l.receipt ? `${l.receipt.substring(0, 12)}...` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};
