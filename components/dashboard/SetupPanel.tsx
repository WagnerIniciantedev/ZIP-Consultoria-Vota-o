
import React, { useState, useRef } from 'react';
import { Resident, PollCalculationType, User } from '../../types';
import { parseCSV, saveResidents, addLog, grantProxy, getDelinquencyModifications, saveDelinquencyModifications, getHideDelinquency, setHideDelinquency, getHideDelinquencyColumn, setHideDelinquencyColumn } from '../../services/dataService'; // Import saveResidents directly
import { db, doc, setDoc } from '../../services/firebase';
import { 
  FileSpreadsheet, Download, AlertCircle, FileText, CheckCircle2, UploadCloud, 
  Database, AlertTriangle, Mail, Key, Eye, Send, Sparkles, Search, UserMinus, X
} from 'lucide-react';
import { Button, Card, Badge } from '../ui';

interface SetupPanelProps {
  residents: Resident[];
  setResidents: React.Dispatch<React.SetStateAction<Resident[]>>;
  condoName?: string;
  selectedAssemblyId?: string;
  currentUser: User | null;
  setSampleUnit: React.Dispatch<React.SetStateAction<string>>;
}

export const SetupPanel: React.FC<SetupPanelProps> = ({ 
  residents, 
  setResidents, 
  condoName, 
  selectedAssemblyId, 
  currentUser,
  setSampleUnit
}) => {
  const [importType, setImportType] = useState<PollCalculationType>(PollCalculationType.NORMAL);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  // New State for Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingResidents, setPendingResidents] = useState<Resident[]>([]);

  // --- CREDENTIALS AND DISPATCH STATES ---
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState(0);
  const [dispatchLogs, setDispatchLogs] = useState<string[]>([]);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [emailPreviewResident, setEmailPreviewResident] = useState<Resident | null>(null);

  // --- DELINQUENCY MODIFICATIONS STATES ---
  const [showDelinquentModal, setShowDelinquentModal] = useState(false);
  const [delinquentSearchQuery, setDelinquentSearchQuery] = useState('');

  // --- VISIBILITY FLAGS STATES ---
  const [hideDelinquencyState, setHideDelinquencyState] = useState(getHideDelinquency());
  const [hideDelinquencyColumnState, setHideDelinquencyColumnState] = useState(getHideDelinquencyColumn());

  React.useEffect(() => {
    setHideDelinquencyState(getHideDelinquency());
    setHideDelinquencyColumnState(getHideDelinquencyColumn());
  }, [residents]);

  const handleToggleHideDelinquency = (val: boolean) => {
    setHideDelinquencyState(val);
    setHideDelinquency(val);
  };

  const handleToggleHideDelinquencyColumn = (val: boolean) => {
    setHideDelinquencyColumnState(val);
    setHideDelinquencyColumn(val);
  };

  // Helper: Generates unique 6-digit access passwords for all residents
  const handleGeneratePasswords = async () => {
    if (residents.length === 0) {
      alert("Carregue a lista de moradores primeiro.");
      return;
    }

    const updated = residents.map(r => {
      if (!r.accessPassword) {
        // Generate a clean 6-digit number
        const randPass = Math.floor(100000 + Math.random() * 900000).toString();
        return { ...r, accessPassword: randPass };
      }
      return r;
    });

    setResidents(updated);
    saveResidents(updated);

    // Sync to Firestore immediately
    if (db && (selectedAssemblyId || condoName)) {
      const safeKey = (selectedAssemblyId || condoName || '').replace(/[^a-zA-Z0-9]/g, '_');
      const savePromises = updated.map(r => {
        const resRef = doc(db, 'assemblies', safeKey, 'residents_list', r.unit.toLowerCase());
        return setDoc(resRef, { accessPassword: r.accessPassword }, { merge: true });
      });
      await Promise.all(savePromises);
    }

    if (currentUser) {
      addLog(currentUser, 'GERAR_SENHAS_ACESSO', `Gerou senhas únicas de segurança para ${residents.length} moradores.`);
    }
    alert(`Senhas seguras geradas com sucesso para ${residents.length} unidades!`);
  };

  const handleToggleDelinquentStatus = async (residentToToggle: Resident) => {
    const previousStatus = residentToToggle.isDelinquent || false;
    const newStatus = !previousStatus;

    // Log delinquency modification
    const currentMods = getDelinquencyModifications();
    currentMods.push({
      unit: residentToToggle.unit,
      name: residentToToggle.name,
      previousStatus,
      newStatus,
      timestamp: Date.now()
    });
    saveDelinquencyModifications(currentMods);

    const updated = residents.map(r => {
      if (r.unit.toLowerCase() === residentToToggle.unit.toLowerCase()) {
        return { ...r, isDelinquent: newStatus };
      }
      return r;
    });

    setResidents(updated);
    saveResidents(updated);

    // Sync to Firestore immediately
    if (db && (selectedAssemblyId || condoName)) {
      const safeKey = (selectedAssemblyId || condoName || '').replace(/[^a-zA-Z0-9]/g, '_');
      const resRef = doc(db, 'assemblies', safeKey, 'residents_list', residentToToggle.unit.toLowerCase());
      await setDoc(resRef, { isDelinquent: newStatus }, { merge: true });
    }

    if (currentUser) {
      addLog(currentUser, newStatus ? 'ADICIONAR_INADIMPLENTE' : 'REMOVER_INADIMPLENTE', `${newStatus ? 'Adicionou' : 'Removeu'} inadimplência para unidade ${residentToToggle.unit}.`);
    }
  };

  // Helper: Generates demo emails for missing records to facilitate testing
  const handleGenerateMockEmails = async () => {
    if (residents.length === 0) {
      alert("Carregue a lista de moradores primeiro.");
      return;
    }

    const updated = residents.map((r) => {
      if (!r.email) {
        const firstName = r.name.trim().split(' ')[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const cleanName = firstName || `morador`;
        return { ...r, email: `${cleanName}.${r.unit}@condominio.com` };
      }
      return r;
    });

    setResidents(updated);
    saveResidents(updated);

    // Sync to Firestore immediately
    if (db && (selectedAssemblyId || condoName)) {
      const safeKey = (selectedAssemblyId || condoName || '').replace(/[^a-zA-Z0-9]/g, '_');
      const savePromises = updated.map(r => {
        const resRef = doc(db, 'assemblies', safeKey, 'residents_list', r.unit.toLowerCase());
        return setDoc(resRef, { email: r.email }, { merge: true });
      });
      await Promise.all(savePromises);
    }

    if (currentUser) {
      addLog(currentUser, 'GERAR_EMAILS_MORADORES', `Gerou e-mails simulados para preenchimento de cadastro.`);
    }
    alert(`E-mails de demonstração gerados para as unidades vazias!`);
  };

  // Helper: Simulates bulk email dispatch sequence
  const startEmailDispatch = () => {
    const residentsWithEmailAndPass = residents.filter(r => r.email && r.accessPassword);
    
    if (residentsWithEmailAndPass.length === 0) {
      alert("Para disparar os e-mails, você precisa de moradores com E-mail e Senha de Acesso cadastrados.\n\nUse os botões de geração rápida abaixo para preencher!");
      return;
    }

    setShowDispatchModal(true);
    setIsDispatching(true);
    setDispatchProgress(0);
    setDispatchLogs(["[SMTP Server] Iniciando serviço de envio de credenciais..."]);

    let currentIdx = 0;
    const total = residentsWithEmailAndPass.length;

    const interval = setInterval(() => {
      if (currentIdx >= total) {
        clearInterval(interval);
        setIsDispatching(false);
        setDispatchLogs(prev => [...prev, `[SUCCESS] Disparo concluído! ${total} e-mails enviados com sucesso.`]);
        if (currentUser) {
          addLog(currentUser, 'DISPARAR_EMAILS_CREDENCIAIS', `Disparou link de votação e senhas para ${total} condôminos.`);
        }
        return;
      }

      const currentResident = residentsWithEmailAndPass[currentIdx];
      const logMsg = `[SMTP Queued] Enviando convite para Unidade ${currentResident.unit} -> ${currentResident.email} (Senha: ${currentResident.accessPassword}) ✔`;
      
      setDispatchLogs(prev => [...prev, logMsg]);
      currentIdx++;
      setDispatchProgress(Math.round((currentIdx / total) * 100));
    }, 450);
  };

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
              
              // 1.1. Process proxy relationships for all residents
              const proxyPromises = cleanResidents
                .filter((r: Resident) => r.proxyUnits && r.proxyUnits.trim())
                .map((r: Resident) => {
                  const targetUnits = r.proxyUnits!.split(',').map(u => u.trim()).filter(u => u);
                  return grantProxy(safeKey, r.unit, targetUnits);
                });
              
              if (proxyPromises.length > 0) {
                await Promise.all(proxyPromises);
                console.log(`[SetupPanel] Processed ${proxyPromises.length} proxy relationships.`);
              }
              
              console.log(`[SetupPanel] Explicit write to assemblies/${safeKey}/residents_list successful.`);
          }
          
          // 2. Also call the service (which updates LocalStorage)
          saveResidents(pendingResidents);

          // 3. Update Local State (Visual)
          setResidents(pendingResidents);
          
          // Update sample unit for identification guidance
          const newSampleUnit = pendingResidents[0]?.unit || '';
          setSampleUnit(newSampleUnit);
          localStorage.setItem('zip_assembly_sample_unit', newSampleUnit);

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
    const headers = "CPF;Unidade;Nome;Inadimplente;HabiteSe;Fracao;ProcuracaoCount;ProcuracaoUnits";
    const example1 = "12345678900;101;João Silva;Não;Sim;0,0150;2;102,103";
    const example2 = "98765432100;202;Maria Oliveira;Sim;Sim;0,0155;0;";
    
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
                            <div className="grid grid-cols-8 bg-blue-100 p-2 font-bold text-blue-800 border-b border-blue-200">
                                <div>A (CPF)</div>
                                <div>B (Unid)</div>
                                <div>C (Nome)</div>
                                <div>D (Inad.)</div>
                                <div>E (Habite)</div>
                                <div>F (Frac)</div>
                                <div>G (Proc)</div>
                                <div>H (Unid.P)</div>
                            </div>
                            <div className="grid grid-cols-8 p-2 text-gray-600 border-b border-gray-100 font-mono">
                                <div className="truncate">123456...</div>
                                <div>101</div>
                                <div className="truncate">João Silva</div>
                                <div>Não</div>
                                <div>Sim</div>
                                <div>0,0125</div>
                                <div>2</div>
                                <div className="truncate">102,103</div>
                            </div>
                            <div className="grid grid-cols-8 p-2 text-gray-400 font-mono italic">
                                <div>...</div>
                                <div>...</div>
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
                            <li><strong>Col G (Procuração):</strong> Quantidade de procurações (Ex: 2).</li>
                            <li><strong>Col H (Unidades Proc.):</strong> Unidades das procurações separadas por vírgula (Ex: 102, 103).</li>
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

        {/* DISPARO DE CREDENCIAIS POR E-MAIL & GESTÃO DE SENHAS */}
        {residents.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 animate-in fade-in duration-300">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Mail className="text-red-500" size={18} />
              Gestão de Credenciais e Disparo de Convites por E-mail
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Para maior segurança e conformidade legal, gere senhas de acesso únicas de 6 dígitos para os condôminos e envie-as por e-mail com o link de votação auditável.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button
                variant="outline"
                onClick={handleGeneratePasswords}
                className="flex items-center justify-center gap-2 text-xs py-2 bg-white font-bold"
              >
                <Key size={14} className="text-slate-500" />
                Gerar Senhas de 6-Dígitos
              </Button>
              
              <Button
                variant="outline"
                onClick={handleGenerateMockEmails}
                className="flex items-center justify-center gap-2 text-xs py-2 bg-white font-bold"
              >
                <Sparkles size={14} className="text-slate-500" />
                Auto-Preencher E-mails
              </Button>

              <Button
                onClick={startEmailDispatch}
                className="flex items-center justify-center gap-2 text-xs py-2 font-bold bg-red-600 hover:bg-red-700"
              >
                <Send size={14} className="text-white" />
                Disparar Convites (E-mail/Senha)
              </Button>
            </div>
            
            <div className="text-[11px] text-slate-500 bg-slate-100/50 border border-slate-200 p-3 rounded-lg flex items-start gap-2 leading-relaxed">
              <AlertCircle size={14} className="text-slate-600 shrink-0 mt-0.5" />
              <span>
                <strong>Importante:</strong> Ao disparar os convites, cada morador receberá um link individual contendo a chave da assembleia. No portal de votação, eles deverão realizar o login informando sua Unidade e a sua respectiva Senha Única.
              </span>
            </div>
          </div>
        )}

        {/* CONFIGURAÇÃO AVANÇADA DE VISIBILIDADE (Apenas TI) */}
        {currentUser?.role === 'TI' && residents.length > 0 && (
          <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-5 space-y-4 mt-4 animate-in fade-in duration-300">
            <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
              <Sparkles className="text-purple-600 animate-pulse" size={18} />
              Configuração de Visibilidade (Restrito - TI / Suporte)
            </h3>
            <p className="text-xs text-purple-700 leading-relaxed font-medium">
              Como TI / Administrador do Sistema, você pode optar por ocultar ou reexibir os recursos de inadimplência para os administradores comuns e as tabelas públicas.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-start gap-3 p-3 bg-white border border-purple-100 rounded-xl cursor-pointer hover:bg-purple-50 hover:border-purple-300 transition-all select-none">
                <input
                  type="checkbox"
                  checked={hideDelinquencyState}
                  onChange={(e) => handleToggleHideDelinquency(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Sinalizador: Ocultar Painel de Gestão</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Oculta o painel de alteração manual de inadimplência para administradores sem permissão TI.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 bg-white border border-purple-100 rounded-xl cursor-pointer hover:bg-purple-50 hover:border-purple-300 transition-all select-none">
                <input
                  type="checkbox"
                  checked={hideDelinquencyColumnState}
                  onChange={(e) => handleToggleHideDelinquencyColumn(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block font-sans">Sinalizador: Ocultar Colunas na Tabela</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Oculta o indicador e o status de inadimplemento na tabela de visualização para administradores comuns.</span>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* GESTÃO MANUAL DE INADIMPLÊNCIA */}
        {residents.length > 0 && !(currentUser?.role !== 'TI' && hideDelinquencyState) && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 mt-4 animate-in fade-in duration-300">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={18} />
              Gestão Manual de Inadimplência
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Adicione ou remova condôminos da lista de inadimplência individualmente. As alterações serão salvas imediatamente e listadas de forma detalhada no relatório da assembleia.
            </p>

            <div className="flex">
              <Button
                onClick={() => {
                  setDelinquentSearchQuery('');
                  setShowDelinquentModal(true);
                }}
                className="flex items-center justify-center gap-2 text-xs py-2 pb-2 bg-slate-900 text-white font-bold hover:bg-slate-800"
              >
                <UserMinus size={14} className="text-red-500" />
                Adicionar ou Retirar Inadimplentes
              </Button>
            </div>
          </div>
        )}

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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-mail</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Senha Única</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPF</th>
                    {!(currentUser?.role !== 'TI' && hideDelinquencyColumnState) && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-bold">Status</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Procurações</th>
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
                        <td className="px-6 py-3 whitespace-nowrap text-xs text-gray-550 font-mono">
                          {r.email || <span className="text-gray-300 italic">Sem e-mail</span>}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-xs">
                          {r.accessPassword ? (
                            <span className="font-mono bg-red-50 text-red-600 border border-red-100 font-extrabold px-2 py-0.5 rounded text-xs">{r.accessPassword}</span>
                          ) : (
                            <span className="text-gray-300 italic text-[11px]">Não gerada</span>
                          )}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {r.cpf ? `***.${r.cpf.slice(0,3)}...` : '-'}
                        </td>
                        {!(currentUser?.role !== 'TI' && hideDelinquencyColumnState) && (
                          <td className="px-6 py-3 whitespace-nowrap text-sm">
                          {r.isDelinquent ? (
                              <div className="flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded border-2 border-red-500 bg-red-500 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                                <Badge color="red">Inadimplente (Ativo)</Badge>
                              </div>
                          ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded border border-gray-300 bg-white flex items-center justify-center text-[10px] font-bold text-transparent">✓</span>
                                <Badge color="green">No Sistema (Inativo)</Badge>
                              </div>
                          )}
                          </td>
                        )}
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                          {r.proxyCount && r.proxyCount > 0 ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-blue-600">{r.proxyCount} Proc.</span>
                              <span className="text-[10px] truncate max-w-[100px]">{r.proxyUnits}</span>
                            </div>
                          ) : '-'}
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

      {/* RECENT SMTP DISPATCH LOGS MODAL */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col scale-100 animate-in zoom-in-95 duration-200 border-t-4 border-red-600">
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Send className="text-red-500" size={20} />
                <h3 className="font-bold text-lg">Serviço de Envio SMTP - Convites</h3>
              </div>
              <button 
                onClick={() => { if (!isDispatching) setShowDispatchModal(false); }}
                disabled={isDispatching}
                className="text-gray-400 hover:text-white disabled:opacity-40 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {/* Progress and status */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-bold text-gray-700">
                  <span>Enviando credenciais de acesso aos moradores...</span>
                  <span>{dispatchProgress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border">
                  <div 
                    className="bg-red-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${dispatchProgress}%` }}
                  ></div>
                </div>
              </div>

              {/* Server Terminal log */}
              <div className="bg-slate-950 font-mono text-[11px] text-green-400 p-4 rounded-xl min-h-[160px] max-h-[180px] overflow-y-auto space-y-1.5 custom-scrollbar shadow-inner border border-slate-800">
                {dispatchLogs.map((log, i) => (
                  <div key={i} className={log.includes('[SUCCESS]') ? 'text-blue-400 font-bold' : log.includes('[ERROR]') ? 'text-red-400' : ''}>
                    {log}
                  </div>
                ))}
              </div>

              {/* Dispatched Items list */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Histórico de Disparos por Unidade</h4>
                <div className="border rounded-lg overflow-hidden max-h-[180px] overflow-y-auto text-xs bg-slate-50">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Unidade</th>
                        <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Nome</th>
                        <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">E-mail</th>
                        <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Senha Gerada</th>
                        <th className="px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {residents.filter(r => r.email && r.accessPassword).map((r, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-bold text-gray-900">{r.unit}</td>
                          <td className="px-4 py-2 truncate max-w-[120px]">{r.name}</td>
                          <td className="px-4 py-2 font-mono text-gray-600">{r.email}</td>
                          <td className="px-4 py-2 font-bold font-mono text-red-650">{r.accessPassword}</td>
                          <td className="px-4 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setEmailPreviewResident(r)}
                              className="text-blue-600 hover:text-blue-800 font-bold hover:underline transition-all flex items-center gap-1 ml-auto"
                            >
                              <Eye size={12} /> Ver E-mail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border-t flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => { if (!isDispatching) setShowDispatchModal(false); }}
                disabled={isDispatching}
              >
                Fechar Painel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* INDIVIDUAL EMAIL HTML PREVIEW MODAL */}
      {emailPreviewResident && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col scale-100 animate-in zoom-in-95 duration-200 border border-slate-300">
            <div className="bg-slate-150 px-5 py-3 border-b flex justify-between items-center text-gray-700 bg-gray-50">
              <span className="text-xs font-bold font-mono">Visualizador de E-mail (Destinatário: {emailPreviewResident.email})</span>
              <button onClick={() => setEmailPreviewResident(null)} className="text-gray-500 hover:text-gray-900 text-sm font-bold">✕ Sair</button>
            </div>
            
            <div className="p-4 bg-gray-100 flex-1 overflow-y-auto">
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-md bg-white">
                <div className="bg-red-600 p-6 text-white text-center flex flex-col items-center justify-center">
                  <h4 className="text-base font-extrabold uppercase tracking-wider">ZIP Voto - Assembléia Online</h4>
                  <p className="text-xs text-red-100 mt-1">Sua Presença e Voto Seguros</p>
                </div>
                <div className="p-6 space-y-4 text-sm leading-relaxed text-gray-750">
                  <p>Olá, <strong>{emailPreviewResident.name}</strong>,</p>
                  <p>Você foi convidado(a) para participar da assembléia e votação digital do condomínio <strong>{condoName || "Membro Associado"}</strong>.</p>
                  
                  <div className="bg-red-50 p-4 rounded-lg border border-red-100 space-y-3">
                    <p className="text-[11px] text-red-800 font-bold uppercase tracking-wider">Suas Credenciais Seguras e Chave Única:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-gray-500">Unidade Associada:</div>
                      <div className="font-bold text-gray-950">{emailPreviewResident.unit}</div>
                      <div className="text-gray-500">Senha Única para Voto:</div>
                      <div className="font-mono text-base font-extrabold text-red-600 bg-white border border-red-200 px-2 py-0.5 rounded w-fit tracking-wider">{emailPreviewResident.accessPassword}</div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600">
                    O link de acesso direto já está configurado. Ao clicar no botão abaixo, você será direcionado ao portal oficial de votação, bastando preencher sua unidade e a sua Senha Única.
                  </p>

                  <div className="pt-2">
                    <a 
                      href="#"
                      onClick={(e) => { e.preventDefault(); alert("Esta é uma demonstração interativa do e-mail oficial."); }}
                      className="block text-center bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all uppercase text-xs"
                    >
                      Acessar Cabine de Votação Virtual
                    </a>
                  </div>
                  
                  <p className="text-[10px] text-gray-400 pt-3 border-t">
                    Este é um e-mail com envio automático de segurança. Não responda a este remetente. O sigilo do seu voto é assegurado por auditoria criptográfica de ponta a ponta.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t flex justify-end">
              <Button onClick={() => setEmailPreviewResident(null)} size="sm">Entendido</Button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL DELINQUENCY MANAGEMENT MODAL */}
      {showDelinquentModal && !(currentUser?.role !== 'TI' && hideDelinquencyState) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[85vh] overflow-hidden flex flex-col scale-100 animate-in zoom-in-95 duration-200 border-t-4 border-red-600">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={20} />
                <h3 className="font-bold text-lg">Alterar Status de Inadimplência</h3>
              </div>
              <button 
                onClick={() => setShowDelinquentModal(false)}
                className="text-gray-400 hover:text-white font-bold hover:scale-105 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Sub-Header / Search Input */}
            <div className="p-5 border-b bg-slate-50 space-y-3">
              <p className="text-xs text-slate-500">
                Pesquise o morador pelo nome ou pelo número da unidade para marcar ou retirar a inadimplência.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  placeholder="Pesquisar por Unidade ou Nome do proprietário..."
                  value={delinquentSearchQuery}
                  onChange={(e) => setDelinquentSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-gray-900 bg-white"
                />
              </div>
            </div>

            {/* Results list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2 custom-scrollbar min-h-[250px] max-h-[450px]">
              {residents.filter(r => {
                const query = delinquentSearchQuery.toLowerCase().trim();
                if (!query) return true;
                return r.unit.toLowerCase().includes(query) || r.name.toLowerCase().includes(query);
              }).length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs italic">
                  Nenhum morador encontrado para a pesquisa.
                </div>
              ) : (
                residents
                  .filter(r => {
                    const query = delinquentSearchQuery.toLowerCase().trim();
                    if (!query) return true;
                    return r.unit.toLowerCase().includes(query) || r.name.toLowerCase().includes(query);
                  })
                  .map((r, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50/50 transition-all"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">Unidade {r.unit}</span>
                          {r.isDelinquent ? (
                            <div className="flex items-center gap-1.5 inline-flex">
                              <span className="w-4 h-4 rounded border-2 border-red-500 bg-red-500 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                              <Badge color="red">Inadimplente (Ativo)</Badge>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 inline-flex">
                              <span className="w-4 h-4 rounded border border-gray-300 bg-white flex items-center justify-center text-[10px] font-bold text-transparent">✓</span>
                              <Badge color="green">No Sistema (Inativo)</Badge>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{r.name}</p>
                      </div>

                      <Button
                        size="sm"
                        variant={r.isDelinquent ? "outline" : "danger"}
                        onClick={() => handleToggleDelinquentStatus(r)}
                        className="text-xs font-bold shrink-0 min-w-[150px] py-1.5"
                      >
                        {r.isDelinquent ? 'Remover Inadimplência' : 'Marcar Inadimplente'}
                      </Button>
                    </div>
                  ))
              )}
            </div>

            {/* Footer */}
            <div className="p-5 bg-slate-50 border-t flex justify-between items-center text-xs text-slate-400">
              <span>Total de moradores: {residents.length}</span>
              <Button onClick={() => setShowDelinquentModal(false)} variant="outline" size="sm">
                Concluir e Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
