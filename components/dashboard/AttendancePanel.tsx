
import React, { useState } from 'react';
import { Resident, User } from '../../types';
import { Button, Input, Card } from '../ui';
import { exportAttendanceCSV, saveResidents, addLog } from '../../services/dataService';
import { 
  FileSpreadsheet, Clock, CheckCircle2, Ban, LogOut, Pencil, Edit3, RefreshCcw,
  FileImage, Eye, Shield, ShieldCheck, UserCheck, AlertCircle, FileText
} from 'lucide-react';

interface AttendancePanelProps {
  residents: Resident[];
  setResidents: React.Dispatch<React.SetStateAction<Resident[]>>;
  condoName: string;
  currentUser: User | null;
  selectedAssemblyId?: string;
}

export const AttendancePanel: React.FC<AttendancePanelProps> = ({ 
  residents, 
  setResidents, 
  condoName, 
  currentUser,
  selectedAssemblyId
}) => {
  const [editingResident, setEditingResident] = useState<{
    unit: string, 
    name: string, 
    zoomName: string,
    proxyCount: number,
    proxyUnits: string
  } | null>(null);
  const [confirmBlockUnit, setConfirmBlockUnit] = useState<string | null>(null);
  const [inspectingResident, setInspectingResident] = useState<Resident | null>(null);

  const pendingResidents = residents.filter(r => r.attendanceStatus === 'PENDING');
  const approvedResidents = residents.filter(r => r.attendanceStatus === 'APPROVED');

  const [isRestoringAll, setIsRestoringAll] = useState(false);

  const updateResidentInCloud = async (resident: Resident) => {
    if (!selectedAssemblyId) return;
    try {
      const { db } = await import('../../services/firebase');
      const { doc, setDoc } = await import('firebase/firestore');
      const residentRef = doc(db, 'assemblies', selectedAssemblyId, 'residents_list', resident.unit.toLowerCase());
      await setDoc(residentRef, resident);
    } catch (error) {
      console.error("Error updating resident in cloud:", error);
    }
  };

  const handleApproveResident = (unit: string) => {
    const resident = residents.find(r => r.unit === unit);
    if (!resident) return;

    const updatedResident = { ...resident, attendanceStatus: 'APPROVED' as const, checkInTimestamp: Date.now() };
    const updated = residents.map(r => r.unit === unit ? updatedResident : r);
    
    setResidents(updated);
    saveResidents(updated); // Local Save
    updateResidentInCloud(updatedResident); // Cloud Sync

    if (currentUser) {
      addLog(currentUser, 'APROVAR_MORADOR', `Aprovou entrada da unidade: ${unit}`);
    }
  };

  const handleApproveDocument = (unit: string) => {
    const resident = residents.find(r => r.unit === unit);
    if (!resident) return;

    const updatedResident = { 
      ...resident, 
      verificationStatus: 'APPROVED' as const, 
      attendanceStatus: 'APPROVED' as const, 
      checkInTimestamp: Date.now() 
    };
    const updated = residents.map(r => r.unit === unit ? updatedResident : r);
    
    setResidents(updated);
    saveResidents(updated);
    updateResidentInCloud(updatedResident);

    if (currentUser) {
      addLog(currentUser, 'APROVAR_DOCUMENTO_MORADOR', `Aprovou RG/Selfie e entrada da unidade: ${unit}`);
    }
    setInspectingResident(null);
    alert(`Documentação da unidade ${unit} aprovada com SUCESSO!`);
  };

  const handleRejectDocument = (unit: string) => {
    const resident = residents.find(r => r.unit === unit);
    if (!resident) return;

    const updatedResident = { 
      ...resident, 
      verificationStatus: 'REJECTED' as const, 
      attendanceStatus: 'NONE' as const 
    };
    const updated = residents.map(r => r.unit === unit ? updatedResident : r);
    
    setResidents(updated);
    saveResidents(updated);
    updateResidentInCloud(updatedResident);

    if (currentUser) {
      addLog(currentUser, 'REPROVAR_DOCUMENTO_MORADOR', `Rejeitou RG/Selfie da unidade: ${unit}`);
    }
    setInspectingResident(null);
    alert(`Documentação da unidade ${unit} REJEITADA. O morador foi notificado.`);
  };

  const handleBlockResident = (unit: string) => {
      const resident = residents.find(r => r.unit === unit);
      if (!resident) return;

      const updatedResident = { ...resident, attendanceStatus: 'BLOCKED' as const };
      const updated = residents.map(r => r.unit === unit ? updatedResident : r);
      
      setResidents(updated);
      saveResidents(updated); // Local Save
      updateResidentInCloud(updatedResident); // Cloud Sync

      if (currentUser) {
        addLog(currentUser, 'BLOQUEAR_MORADOR', `Bloqueou entrada da unidade: ${unit}`);
      }
  };

  const handleResetResident = (unit: string) => {
      const resident = residents.find(r => r.unit === unit);
      if (!resident) return;

      // Create new object extracting ONLY the base properties
      const { zoomName, checkInTimestamp, ...rest } = resident;
      const updatedResident = { ...rest, attendanceStatus: 'NONE' as const };
      
      const updated = residents.map(r => r.unit === unit ? updatedResident : r);
      
      setResidents(updated);
      saveResidents(updated); // Local Save
      updateResidentInCloud(updatedResident); // Cloud Sync

      if (currentUser) {
        addLog(currentUser, 'RESET_MORADOR', `Resetou status da unidade: ${unit}`);
      }
  };

  const handleRestoreAllProxies = async () => {
    if (!selectedAssemblyId || !confirm("Deseja realmente restituir todas as procurações? Isso irá remover todos os vínculos atuais e você precisará re-importar ou re-atribuir manualmente.")) return;
    
    setIsRestoringAll(true);
    try {
      const updated = residents.map(r => ({
        ...r,
        proxyOwnerUnit: undefined,
        proxyUnits: '',
        proxyCount: 0
      }));
      
      setResidents(updated);
      saveResidents(updated);
      
      // Update all in cloud (this is heavy, but necessary if we want to "restore" or "reset")
      const { db } = await import('../../services/firebase');
      const { doc, writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      updated.forEach(res => {
        const ref = doc(db, 'assemblies', selectedAssemblyId, 'residents_list', res.unit.toLowerCase());
        batch.set(ref, res);
      });
      
      await batch.commit();
      
      if (currentUser) {
        addLog(currentUser, 'RESTITUIR_TODAS_PROCURACOES', 'Resetou todas as procurações da assembleia');
      }
      alert("Todas as procurações foram resetadas com sucesso.");
    } catch (error) {
      console.error("Error restoring proxies:", error);
      alert("Erro ao processar restauração.");
    } finally {
      setIsRestoringAll(false);
    }
  };

  const handleExportAttendance = () => {
    if (residents.filter(r => r.attendanceStatus === 'APPROVED').length === 0) {
      alert("Não há participantes aprovados para gerar a lista.");
      return;
    }
    exportAttendanceCSV(residents, condoName);
  };

  const openEditResident = (unit: string, name: string, zoomName: string, proxyCount: number = 0, proxyUnits: string = '') => {
    setEditingResident({ unit, name, zoomName: zoomName || '', proxyCount, proxyUnits });
  };

  const handleSaveResidentDetails = async () => {
    if (!editingResident || !selectedAssemblyId) return;
    
    const resident = residents.find(r => r.unit === editingResident.unit);
    if (!resident) return;

    const updatedResident = { 
      ...resident, 
      name: editingResident.name, 
      zoomName: editingResident.zoomName,
      proxyCount: editingResident.proxyCount,
      proxyUnits: editingResident.proxyUnits
    };
    const updated = residents.map(r => r.unit === editingResident.unit ? updatedResident : r);
    
    setResidents(updated);
    saveResidents(updated); // Local Save
    updateResidentInCloud(updatedResident); // Cloud Sync

    // Update target units with proxyOwnerUnit
    if (editingResident.proxyUnits) {
      const { grantProxy } = await import('../../services/dataService');
      const targetUnits = editingResident.proxyUnits.split(',').map(u => u.trim()).filter(u => u);
      await grantProxy(selectedAssemblyId, editingResident.unit, targetUnits);
    }

    setEditingResident(null);
  };

  return (
    <div className="space-y-6">
      {/* Edit Modal Overlay */}
      {editingResident && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
               <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Edit3 className="text-blue-600" size={20} />
                  Editar Dados do Participante
               </h3>
               <div className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded border">
                     <span className="text-xs text-gray-500 uppercase font-bold">Unidade</span>
                     <div className="text-xl font-bold text-gray-900">{editingResident.unit}</div>
                  </div>
                  
                  <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Nome no Zoom</label>
                     <Input 
                       value={editingResident.zoomName}
                       onChange={(e) => setEditingResident({...editingResident, zoomName: e.target.value})}
                       placeholder="Ex: João da Silva - 101"
                     />
                  </div>

                  <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Proprietário</label>
                     <Input 
                       value={editingResident.name}
                       onChange={(e) => setEditingResident({...editingResident, name: e.target.value})}
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Qtd. Procurações</label>
                      <Input 
                        type="number"
                        value={editingResident.proxyCount}
                        onChange={(e) => setEditingResident({...editingResident, proxyCount: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unidades Proc.</label>
                      <Input 
                        value={editingResident.proxyUnits}
                        onChange={(e) => setEditingResident({...editingResident, proxyUnits: e.target.value})}
                        placeholder="Ex: 102, 103"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                     <Button variant="outline" onClick={() => setEditingResident(null)} className="flex-1">Cancelar</Button>
                     <Button onClick={handleSaveResidentDetails} className="flex-1">Salvar Alterações</Button>
                  </div>
               </div>
           </div>
        </div>
      )}

      <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Controle de Presença (Sala de Espera)</h2>

          {/* Security Document Audit Modal */}
          {inspectingResident && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-155 transform animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500 rounded-lg text-white">
                      <Shield size={22} className="animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-bold">Auditoria de Segurança Digital</h3>
                      <p className="text-xs text-slate-400 font-sans">Verificação biométrica e documental do condômino</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setInspectingResident(null)}
                    className="text-slate-400 hover:text-white bg-slate-805 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors text-xs font-semibold"
                  >
                    ✕ Fechar
                  </button>
                </div>

                {/* Content Body */}
                <div className="p-6 overflow-y-auto space-y-6 bg-slate-50 flex-1">
                  {/* Resident info summary card */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm font-sans">
                    <div>
                      <span className="text-[10px] text-gray-450 uppercase font-bold tracking-wider">Unidade / Bloco</span>
                      <p className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-550 animate-ping"></span>
                        {inspectingResident.unit}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-450 uppercase font-bold tracking-wider">Nome do Proprietário</span>
                      <p className="text-lg font-semibold text-slate-800 truncate">{inspectingResident.name}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-450 uppercase font-bold tracking-wider">Status de Entrada</span>
                      <p className="text-sm mt-1">
                        <span className="bg-amber-100 text-amber-800 text-xs py-1 px-2.5 rounded-full font-bold">
                          Aguardando Verificação
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Photos comparison grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* ID photo frame */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                      <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <FileText size={16} className="text-indigo-500" />
                        1. Documento com Foto (RG / CNH)
                      </h4>
                      <div className="border border-dashed border-gray-200 rounded-lg p-2 bg-slate-50 flex-1 flex items-center justify-center min-h-[250px] relative overflow-hidden group">
                        {inspectingResident.documentPhotoUrl ? (
                          <img 
                            src={inspectingResident.documentPhotoUrl} 
                            alt="Documento de Identidade de Amostra" 
                            referrerPolicy="no-referrer"
                            className="max-h-[280px] rounded-lg object-contain shadow-md scale-100 group-hover:scale-[1.02] transition-transform duration-250 cursor-pointer"
                          />
                        ) : (
                          <div className="text-center p-6 text-gray-400">
                            <FileImage size={48} className="mx-auto mb-2 text-gray-300" />
                            <p className="text-xs font-sans">Foto não encontrada</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selfie photo frame */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                      <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <UserCheck size={16} className="text-indigo-500" />
                        2. Selfie Segurando o Documento
                      </h4>
                      <div className="border border-dashed border-gray-200 rounded-lg p-2 bg-slate-50 flex-1 flex items-center justify-center min-h-[250px] relative overflow-hidden group">
                        {inspectingResident.selfiePhotoUrl ? (
                          <img 
                            src={inspectingResident.selfiePhotoUrl} 
                            alt="Selfie Biométrica de Amostra" 
                            referrerPolicy="no-referrer"
                            className="max-h-[280px] rounded-lg object-contain shadow-md scale-100 group-hover:scale-[1.02] transition-transform duration-250 cursor-pointer"
                          />
                        ) : (
                          <div className="text-center p-6 text-gray-400">
                            <FileImage size={48} className="mx-auto mb-2 text-gray-300" />
                            <p className="text-xs font-sans">Selfie não encontrada</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Security Advisory notice */}
                  <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-100 flex gap-2.5">
                    <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-[11px] text-blue-800 leading-relaxed font-sans">
                      <strong>Responsabilidade de Auditoria:</strong> Ao aprovar esta documentação, você atesta para fins de ata que a assinatura digital baseada em face-matching foi verificada com sucesso para a unidade <strong>{inspectingResident.unit}</strong>.
                    </p>
                  </div>
                </div>

                {/* Footer actions */}
                <div className="p-6 bg-slate-100 border-t border-gray-200 flex justify-between gap-3 flex-wrap">
                  <Button 
                    variant="outline"
                    onClick={() => setInspectingResident(null)}
                    className="px-5 font-bold text-slate-705"
                  >
                    Voltar
                  </Button>
                  <div className="flex gap-3">
                    <Button 
                      onClick={() => handleRejectDocument(inspectingResident.unit)}
                      variant="danger"
                      className="px-6 font-bold flex items-center gap-1 bg-red-650 hover:bg-red-700"
                    >
                      ✕ Rejeitar Documento
                    </Button>
                    <Button 
                      onClick={() => handleApproveDocument(inspectingResident.unit)}
                      className="px-6 font-bold flex items-center gap-1.5 bg-green-600 hover:bg-green-700 shadow-md shadow-green-200"
                    >
                      <ShieldCheck size={18} /> Aprovar Documentação
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
         {approvedResidents.length > 0 && (
           <Button onClick={handleExportAttendance} variant="outline" className="text-sm flex items-center gap-2">
             <FileSpreadsheet size={16} /> Baixar Lista de Presença
           </Button>
         )}
      </div>

      <Card title="Aguardando Aprovação">
         {pendingResidents.length === 0 ? (
             <div className="text-center py-8 text-gray-500 italic flex flex-col items-center">
                <Clock className="mb-2 h-8 w-8 text-gray-300" />
                Ninguém na fila de espera.
             </div>
         ) : (
           <div className="space-y-3">
              {pendingResidents.map((r) => (
                <div key={r.unit} className="flex flex-col md:flex-row justify-between items-center p-4 border border-yellow-200 bg-yellow-50 rounded-lg shadow-sm">
                   <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-gray-900">{r.unit}</span>
                        <span className="text-gray-600">- {r.name}</span>{r.documentPhotoUrl && <span className="bg-blue-100 text-blue-800 text-[10px] py-0.5 px-2 font-bold inline-flex items-center gap-1 rounded border border-blue-200 ml-2 animate-pulse"><FileImage size={11} className="text-blue-600" /> RG + Selfie Pendentes</span>}
                      </div>
                      <div className="text-sm text-gray-500 mt-1 flex items-center gap-2 group">
                         <span className="font-semibold text-blue-700">Zoom:</span> {r.zoomName}
                         <button 
                           onClick={() => openEditResident(r.unit, r.name, r.zoomName || '', r.proxyCount, r.proxyUnits)}
                           className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Pencil size={14} />
                         </button>
                      </div>
                      {r.proxyCount && r.proxyCount > 0 ? (
                        <div className="text-[10px] text-orange-600 font-bold mt-0.5">
                          {r.proxyCount} Procuração(ões) ({r.proxyUnits})
                        </div>
                      ) : null}
                   </div>
                   
                   {confirmBlockUnit === r.unit ? (
                        <div className="flex gap-2 mt-3 md:mt-0 items-center bg-red-50 p-1 rounded border border-red-200 animate-in fade-in zoom-in">
                            <span className="text-xs font-bold text-red-800">Confirmar?</span>
                            <Button size="sm" onClick={() => { handleBlockResident(r.unit); setConfirmBlockUnit(null); }} className="bg-red-600 text-white h-8 px-3 text-xs">Sim</Button>
                            <Button size="sm" variant="outline" onClick={() => setConfirmBlockUnit(null)} className="h-8 px-3 text-xs">Não</Button>
                        </div>
                   ) : (
                       <div className="flex gap-2 mt-3 md:mt-0">
                          {r.documentPhotoUrl && (
                            <Button 
                              onClick={() => setInspectingResident(r)}
                              variant="outline" 
                              className="text-sm flex items-center gap-1 border-blue-200 hover:bg-blue-50 text-blue-700 font-bold"
                            >
                               <Eye size={16} /> Verificar Fotos
                            </Button>
                          )}
                          <Button onClick={() => setConfirmBlockUnit(r.unit)} variant="danger" className="text-sm flex items-center gap-1">
                             <Ban size={16} /> Bloquear
                          </Button>
                          <Button onClick={() => handleApproveResident(r.unit)} className="bg-green-600 hover:bg-green-700 text-sm flex items-center gap-1">
                             <CheckCircle2 size={16} /> Aprovar Entrada
                          </Button>
                       </div>
                   )}
                </div>
              ))}
           </div>
         )}
      </Card>

      <Card 
        title={`Participantes na Sala (Aprovados: ${approvedResidents.length})`}
        headerActions={
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRestoreAllProxies}
              disabled={isRestoringAll}
              className="text-orange-600 border-orange-100 hover:bg-orange-50 flex items-center gap-1"
            >
              <RefreshCcw size={14} className={isRestoringAll ? 'animate-spin' : ''} />
              Restituir Procuradores
            </Button>
          </div>
        }
      >
         {approvedResidents.length === 0 ? (
             <p className="text-gray-500 text-sm italic">Nenhum participante aprovado ainda.</p>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
               {approvedResidents.map((r) => (
                 <div key={r.unit} className="p-3 border rounded-lg bg-white flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-800">{r.unit}</div>
                      <div className="text-xs text-gray-500 truncate">{r.name}</div>
                      <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                         <span className="truncate font-semibold">Zoom: {r.zoomName}</span>
                         <button 
                           onClick={() => openEditResident(r.unit, r.name, r.zoomName || '', r.proxyCount, r.proxyUnits)}
                           className="text-gray-400 hover:text-blue-600 flex items-center gap-1 ml-1"
                         >
                            <Pencil size={12} />
                            <span className="text-[10px] font-bold uppercase">Editar</span>
                         </button>
                      </div>
                      {r.proxyCount && r.proxyCount > 0 ? (
                        <div className="text-[10px] text-orange-600 font-bold mt-0.5">
                          {r.proxyCount} Procuração(ões) ({r.proxyUnits})
                        </div>
                      ) : null}
                    </div>
                    <button onClick={() => handleResetResident(r.unit)} className="text-gray-400 hover:text-red-500 ml-2">
                       <LogOut size={16} />
                    </button>
                 </div>
               ))}
            </div>
         )}
      </Card>
    </div>
  );
};
