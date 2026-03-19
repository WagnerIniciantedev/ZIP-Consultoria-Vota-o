
import React, { useState, useRef } from 'react';
import { Resident, PollCalculationType, User } from '../../types';
import { parseCSV, saveResidents, addLog } from '../../services/dataService'; // Import saveResidents directly
import { db, doc, setDoc } from '../../services/firebase';
import { FileSpreadsheet, Download, AlertCircle, FileText, CheckCircle2, UploadCloud, Database, AlertTriangle } from 'lucide-react';
import { Button, Card, Badge } from '../ui';

interface SetupPanelProps {
  residents: Resident[];
  setResidents: React.Dispatch<React.SetStateAction<Resident[]>>;
  condoName?: string;
  selectedAssemblyId?: string;
  currentUser: User | null;
}

export const SetupPanel: React.FC<SetupPanelProps> = ({ residents, setResidents, condoName, selectedAssemblyId, currentUser }) => {
  const [importType, setImportType] = useState<PollCalculationType>(PollCalculationType.NORMAL);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  // New State for Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingResidents, setPendingResidents] = useState<Resident[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        const parsed = parseCSV(text);
        
        if (parsed.length > 0) {
          // Instead of saving immediately, store in pending and show modal
          setPendingResidents(parsed);
          setShowConfirmModal(true);
          
          // Clear input so same file can be selected again if cancelled
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } else {
          alert("Não foi possível ler os dados. Verifique se o arquivo segue o modelo abaixo.");
        }
      };
      reader.readAsText(file);
    }
  };

  const confirmUploadToCloud = async () => {
      if (pendingResidents.length === 0) return;

      setIsSaving(true);
      
      try {
          // Sanitize residents data to remove any undefined fields before sending to Firestore
          const cleanResidents = JSON.parse(JSON.stringify(pendingResidents));

          // 1. Explicitly write to Firestore (Bypassing race conditions)
          // Use the selectedAssemblyId or condoName passed via props to ensure we write to the active session
          if (db && (selectedAssemblyId || condoName)) {
              const safeKey = (selectedAssemblyId || condoName || '').replace(/[^a-zA-Z0-9]/g, '_');
              const docRef = doc(db, 'assemblies', safeKey);
              
              // Save metadata/summary to main doc
              await setDoc(docRef, { 
                residentsCount: cleanResidents.length,
                lastImportAt: Date.now(),
                sampleUnit: cleanResidents[0]?.unit || ''
              }, { merge: true });

              // Save EACH resident to subcollection for secure identification
              // We use Promise.all to speed up, but for very large lists we might need chunks
              const savePromises = cleanResidents.map((r: Resident) => {
                  const resRef = doc(db, 'assemblies', safeKey, 'residents_list', r.unit.toLowerCase());
                  return setDoc(resRef, r, { merge: true });
              });
              
              await Promise.all(savePromises);
              console.log(`[SetupPanel] Explicit write to assemblies/${safeKey}/residents_list successful.`);
          }
          
          // 2. Also call the service (which updates LocalStorage)
          saveResidents(pendingResidents);

          // 3. Update Local State (Visual)
          setResidents(pendingResidents);

          if (currentUser) {
            addLog(currentUser, 'IMPORTAR_MORADORES', `Importou ${pendingResidents.length} moradores para ${condoName}`);
          }

          // Short delay to show loading state
          setTimeout(() => {
            alert(`${pendingResidents.length} moradores importados e sincronizados com a nuvem com SUCESSO!`);
            setIsSaving(false);
            setShowConfirmModal(false);
            setPendingResidents([]);
          }, 500);
      } catch (err) {
          console.error("Error syncing residents:", err);
          alert("Erro ao sincronizar com o banco de dados. Verifique sua conexão.");
          setIsSaving(false);
      }
  };

  const cancelUpload = () => {
      setShowConfirmModal(false);
      setPendingResidents([]);
  };

  const handleDownloadTemplate = () => {
    // CSV Template with Header and one example row
    const headers = "CPF;Unidade;Nome;Inadimplente;HabiteSe;Fracao";
    const example1 = "12345678900;101;João Silva;Não;Sim;0,0150";
    const example2 = "98765432100;202;Maria Oliveira;Sim;Sim;0,0155";
    
    const csvContent = `${headers}\n${example1}\n${example2}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_importacao_condovote.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card title="Configuração Inicial - Importar Moradores" className="min-h-[500px] relative">
      
      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
              <div className="bg-blue-600 p-6 text-white text-center">
                  <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4 backdrop-blur-md">
                      <Database size={32} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold">Sincronizar Banco de Dados?</h3>
                  <p className="text-blue-100 text-sm mt-2">
                    Você está prestes a atualizar a lista oficial de moradores.
                  </p>
              </div>
              
              <div className="p-6 space-y-4">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-between">
                      <span className="text-gray-600 font-medium">Registros Encontrados:</span>
                      <span className="text-2xl font-bold text-gray-900">{pendingResidents.length}</span>
                  </div>

                  <div className="flex items-start gap-3 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                      <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={18} />
                      <p className="text-xs text-yellow-800 text-justify leading-relaxed">
                        Ao confirmar, estes dados serão enviados para o <strong>Firestore (Nuvem)</strong> e substituirão a lista atual. Os condôminos poderão acessar o sistema imediatamente usando estes dados.
                      </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                      <Button 
                        onClick={cancelUpload} 
                        variant="outline" 
                        className="flex-1 py-3 border-gray-300 hover:bg-gray-50"
                        disabled={isSaving}
                      >
                        Cancelar
                      </Button>
                      <Button 
                        onClick={confirmUploadToCloud} 
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 font-bold shadow-lg shadow-blue-200"
                        disabled={isSaving}
                      >
                        {isSaving ? "Enviando..." : "SIM, ATUALIZAR"}
                      </Button>
                  </div>
              </div>
           </div>
        </div>
      )}

      <div className="space-y-8">
        
        {/* STEP 1: SELECT TYPE */}
        <div>
           <label className="block text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
            Selecione o Tipo de Apuração Principal
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => setImportType(PollCalculationType.NORMAL)}
              className={`p-4 rounded-xl border text-left transition-all relative ${importType === PollCalculationType.NORMAL ? 'border-red-500 bg-red-50 ring-1 ring-red-500 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <div className="font-bold text-gray-900 mb-1">Padrão (Unitário)</div>
              <div className="text-xs text-gray-500">Cada unidade vale 1 voto.</div>
              {importType === PollCalculationType.NORMAL && <CheckCircle2 className="absolute top-4 right-4 text-red-600" size={18} />}
            </button>
            <button
              onClick={() => setImportType(PollCalculationType.HABITE_SE)}
              className={`p-4 rounded-xl border text-left transition-all relative ${importType === PollCalculationType.HABITE_SE ? 'border-red-500 bg-red-50 ring-1 ring-red-500 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <div className="font-bold text-gray-900 mb-1">Com Habite-se</div>
              <div className="text-xs text-gray-500">Voto extra para proprietários com registro.</div>
              {importType === PollCalculationType.HABITE_SE && <CheckCircle2 className="absolute top-4 right-4 text-red-600" size={18} />}
            </button>
            <button
              onClick={() => setImportType(PollCalculationType.FRACTION)}
              className={`p-4 rounded-xl border text-left transition-all relative ${importType === PollCalculationType.FRACTION ? 'border-red-500 bg-red-50 ring-1 ring-red-500 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <div className="font-bold text-gray-900 mb-1">Fração Ideal</div>
              <div className="text-xs text-gray-500">Peso do voto baseado na fração ideal.</div>
              {importType === PollCalculationType.FRACTION && <CheckCircle2 className="absolute top-4 right-4 text-red-600" size={18} />}
            </button>
          </div>
        </div>

        {/* STEP 2: INSTRUCTIONS */}
        <div>
            <label className="block text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
                Prepare seu Arquivo Excel / CSV
            </label>
            
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Visual Table Example */}
                    <div className="flex-1">
                        <h4 className="font-bold text-blue-900 text-sm mb-3 flex items-center gap-2">
                            <FileSpreadsheet size={16} /> Estrutura Obrigatória das Colunas
                        </h4>
                        <div className="bg-white rounded border border-blue-100 overflow-hidden text-xs shadow-sm">
                            <div className="grid grid-cols-6 bg-blue-100 p-2 font-bold text-blue-800 border-b border-blue-200">
                                <div>A (CPF)</div>
                                <div>B (Unid)</div>
                                <div>C (Nome)</div>
                                <div>D (Inad.)</div>
                                <div>E (Habite)</div>
                                <div>F (Frac)</div>
                            </div>
                            <div className="grid grid-cols-6 p-2 text-gray-600 border-b border-gray-100 font-mono">
                                <div className="truncate">123456...</div>
                                <div>101</div>
                                <div className="truncate">João Silva</div>
                                <div>Não</div>
                                <div>Sim</div>
                                <div>0,0125</div>
                            </div>
                            <div className="grid grid-cols-6 p-2 text-gray-400 font-mono italic">
                                <div>...</div>
                                <div>...</div>
                                <div>...</div>
                                <div>...</div>
                                <div>...</div>
                                <div>...</div>
                            </div>
                        </div>
                        <div className="mt-3">
                             <Button onClick={handleDownloadTemplate} variant="outline" size="sm" className="bg-white hover:bg-blue-50 text-blue-700 border-blue-200 w-full md:w-auto">
                                <Download size={14} className="mr-2" /> Baixar Modelo CSV
                             </Button>
                        </div>
                    </div>

                    {/* Legend / Rules */}
                    <div className="flex-1 text-sm space-y-3">
                        <div className="flex items-start gap-2">
                            <AlertCircle size={16} className="text-blue-600 mt-0.5 shrink-0" />
                            <p className="text-blue-800">
                                <strong>Formato:</strong> Salve sua planilha como <strong>CSV (Separado por ponto e vírgula)</strong> ou CSV padrão.
                            </p>
                        </div>
                        <ul className="list-disc list-inside text-blue-700 space-y-1 ml-1 text-xs md:text-sm">
                            <li><strong>Col A (CPF):</strong> Apenas números (os pontos são removidos automaticamente).</li>
                            <li><strong>Col B (Unidade):</strong> Número do apto/casa (Ex: 101, 12B).</li>
                            <li><strong>Col C (Nome):</strong> Nome completo do proprietário.</li>
                            <li><strong>Col D (Inadimplente):</strong> Digite "Sim" ou "Não".</li>
                            <li><strong>Col E (Habite-se):</strong> Digite "Sim" ou "Não" (Opcional).</li>
                            <li><strong>Col F (Fração):</strong> Use vírgula para decimais (Ex: 0,0235).</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        
        {/* STEP 3: UPLOAD */}
        <div className="pt-4 border-t border-gray-100">
             <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex gap-4 items-center w-full sm:w-auto">
                    <input 
                    type="file" 
                    accept=".csv,.txt" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    />
                    <Button 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={isSaving}
                        className={`flex items-center gap-2 py-3 px-6 shadow-md shadow-red-100 w-full sm:w-auto justify-center ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
                    >
                    <span className="bg-white/20 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
                    {isSaving ? "Processando..." : "Carregar Arquivo CSV"}
                    </Button>
                </div>
                
                {residents.length > 0 && (
                     <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg border border-green-200 text-green-700 animate-in fade-in">
                        {isSaving ? <UploadCloud className="animate-bounce" size={20} /> : <CheckCircle2 size={20} />}
                        <span className="font-bold">{residents.length}</span> unidades carregadas.
                     </div>
                )}
            </div>
        </div>

        {/* PREVIEW TABLE */}
        {residents.length > 0 && (
          <div className="border rounded-xl mt-4 overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                <FileText size={16} className="text-gray-500" />
                <span className="text-xs font-bold text-gray-500 uppercase">Pré-visualização dos dados</span>
            </div>
            <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white sticky top-0 z-10 shadow-sm">
                    <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proprietário</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPF</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    {importType === PollCalculationType.FRACTION && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fração</th>
                    )}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {residents.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-900">{r.unit}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">{r.name}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {r.cpf ? `***.${r.cpf.slice(0,3)}...` : '-'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm">
                        {r.isDelinquent ? (
                            <Badge color="red">Inadimplente</Badge>
                        ) : (
                            <Badge color="green">Adimplente</Badge>
                        )}
                        </td>
                        {importType === PollCalculationType.FRACTION && (
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">
                                {r.fraction?.toFixed(4).replace('.', ',')}
                            </td>
                        )}
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
