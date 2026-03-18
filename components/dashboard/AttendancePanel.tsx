
import React, { useState } from 'react';
import { Resident, User } from '../../types';
import { Button, Input, Card } from '../ui';
import { exportAttendanceCSV, saveResidents, addLog } from '../../services/dataService';
import { FileSpreadsheet, Clock, CheckCircle2, Ban, LogOut, Pencil, Edit3 } from 'lucide-react';

interface AttendancePanelProps {
  residents: Resident[];
  setResidents: React.Dispatch<React.SetStateAction<Resident[]>>;
  condoName: string;
  currentUser: User | null;
}

export const AttendancePanel: React.FC<AttendancePanelProps> = ({ residents, setResidents, condoName, currentUser }) => {
  const [editingResident, setEditingResident] = useState<{unit: string, name: string, zoomName: string} | null>(null);
  const [confirmBlockUnit, setConfirmBlockUnit] = useState<string | null>(null);

  const pendingResidents = residents.filter(r => r.attendanceStatus === 'PENDING');
  const approvedResidents = residents.filter(r => r.attendanceStatus === 'APPROVED');

  const handleApproveResident = (unit: string) => {
    const updated = residents.map(r => 
      r.unit === unit ? { ...r, attendanceStatus: 'APPROVED' as const, checkInTimestamp: Date.now() } : r
    );
    setResidents(updated);
    saveResidents(updated); // Explicit Save
    if (currentUser) {
      addLog(currentUser, 'APROVAR_MORADOR', `Aprovou entrada da unidade: ${unit}`);
    }
  };

  const handleBlockResident = (unit: string) => {
      const updated = residents.map(r => 
        r.unit === unit ? { ...r, attendanceStatus: 'BLOCKED' as const } : r
      );
      setResidents(updated);
      saveResidents(updated); // Explicit Save
      if (currentUser) {
        addLog(currentUser, 'BLOQUEAR_MORADOR', `Bloqueou entrada da unidade: ${unit}`);
      }
  };

  const handleResetResident = (unit: string) => {
      const updated = residents.map(r => {
        if (r.unit === unit) {
           // Create new object extracting ONLY the base properties
           // This effectively removes 'zoomName' and 'checkInTimestamp' keys instead of setting them to undefined
           const { zoomName, checkInTimestamp, ...rest } = r;
           return { ...rest, attendanceStatus: 'NONE' as const };
        }
        return r;
      });
      setResidents(updated);
      saveResidents(updated); // Explicit Save
      if (currentUser) {
        addLog(currentUser, 'RESET_MORADOR', `Resetou status da unidade: ${unit}`);
      }
  };

  const handleExportAttendance = () => {
    if (residents.filter(r => r.attendanceStatus === 'APPROVED').length === 0) {
      alert("Não há participantes aprovados para gerar a lista.");
      return;
    }
    exportAttendanceCSV(residents, condoName);
  };

  const openEditResident = (unit: string, name: string, zoomName: string) => {
    setEditingResident({ unit, name, zoomName: zoomName || '' });
  };

  const handleSaveResidentDetails = () => {
    if (!editingResident) return;
    
    const updated = residents.map(r => 
      r.unit === editingResident.unit 
        ? { ...r, name: editingResident.name, zoomName: editingResident.zoomName } 
        : r
    );
    setResidents(updated);
    saveResidents(updated); // Explicit Save
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
                        <span className="text-gray-600">- {r.name}</span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1 flex items-center gap-2 group">
                         <span className="font-semibold text-blue-700">Zoom:</span> {r.zoomName}
                         <button 
                           onClick={() => openEditResident(r.unit, r.name, r.zoomName || '')}
                           className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Pencil size={14} />
                         </button>
                      </div>
                   </div>
                   
                   {confirmBlockUnit === r.unit ? (
                        <div className="flex gap-2 mt-3 md:mt-0 items-center bg-red-50 p-1 rounded border border-red-200 animate-in fade-in zoom-in">
                            <span className="text-xs font-bold text-red-800">Confirmar?</span>
                            <Button size="sm" onClick={() => { handleBlockResident(r.unit); setConfirmBlockUnit(null); }} className="bg-red-600 text-white h-8 px-3 text-xs">Sim</Button>
                            <Button size="sm" variant="outline" onClick={() => setConfirmBlockUnit(null)} className="h-8 px-3 text-xs">Não</Button>
                        </div>
                   ) : (
                       <div className="flex gap-2 mt-3 md:mt-0">
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

      <Card title={`Participantes na Sala (Aprovados: ${approvedResidents.length})`}>
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
                         <button onClick={() => openEditResident(r.unit, r.name, r.zoomName || '')}>
                            <Pencil size={12} className="text-gray-300 hover:text-blue-600" />
                         </button>
                      </div>
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
