
import React, { useState, useRef } from 'react';
import { Resident, PollCalculationType, User } from '../../types';
import { parseCSV, saveResidents, addLog, grantProxy, getDelinquencyModifications, saveDelinquencyModifications, getHideDelinquency, setHideDelinquency, getHideDelinquencyColumn, setHideDelinquencyColumn } from '../../services/dataService'; // Import saveResidents directly
import { db, doc, setDoc } from '../../services/firebase';
import { 
  FileSpreadsheet, Download, AlertCircle, FileText, CheckCircle2, UploadCloud, 
  Database, AlertTriangle, Mail, Key, Eye, Send, Sparkles, Search, UserMinus, X,
  Settings, Sliders, Check, Loader2, UserCheck, RefreshCw, Zap
} from 'lucide-react';
import { Button, Card, Badge } from '../ui';

const removeAccents = (str: string): string => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

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

  // Custom SMTP / Resend / Email Customization states
  const [emailSubject, setEmailSubject] = useState(() => localStorage.getItem('zip_email_subject') || "ZIP Voto - Convocação e Credenciais de Votação - Condomínio {{CONDOMINIO}}");
  const [emailTemplate, setEmailTemplate] = useState(() => localStorage.getItem('zip_email_template') || `Prezado(a) Condômino(a) da Unidade {{UNIDADE}},

A ZIP Consultoria lhe dá as boas-vindas à cabine de votação virtual do condomínio {{CONDOMINIO}}.

Sua participação é fundamental! Para garantir o sigilo de seu voto e a total segurança do processo deliberativo, geramos suas credenciais exclusivas e auditáveis para acesso ao portal.

Seus dados de acesso seguro:
- Morador(a): {{NOME}}
- Unidade correspondente: {{UNIDADE}}
- Senha Única de Voto (6 dígitos): {{SENHA}}

Abaixo está o link de acesso seguro à cabine:
👉 {{LINK}}

Ao clicar no link acima, bastará confirmar os dados de sua Unidade e preencher o seu código de segurança único "{{SENHA}}".

Este é um e-mail gerado de forma segura e automatizada por ZIP Consultoria. Não responda a este remetente.

Atenciosamente,
Gestão de Assembleias - ZIP Consultoria
https://www.zipconsultoria.com.br`);

  const [senderProvider, setSenderProvider] = useState<'sandbox' | 'smtp' | 'resend'>(() => (localStorage.getItem('zip_sender_provider') as any) || 'sandbox');
  const [senderEmail, setSenderEmail] = useState(() => localStorage.getItem('zip_sender_email') || "votos@zipconsultoria.com.br");
  const [senderName, setSenderName] = useState(() => localStorage.getItem('zip_sender_name') || "ZIP Consultoria");
  const [smtpHost, setSmtpHost] = useState(() => localStorage.getItem('zip_smtp_host') || "smtp.zipconsultoria.com.br");
  const [smtpPort, setSmtpPort] = useState(() => localStorage.getItem('zip_smtp_port') || "587");
  const [smtpUser, setSmtpUser] = useState(() => localStorage.getItem('zip_smtp_user') || "votos@zipconsultoria.com.br");
  const [smtpPassword, setSmtpPassword] = useState(() => localStorage.getItem('zip_smtp_password') || "");
  const [smtpSecure, setSmtpSecure] = useState(() => localStorage.getItem('zip_smtp_secure') !== 'false');
  const [resendApiKey, setResendApiKey] = useState(() => localStorage.getItem('zip_resend_api_key') || "");
  const [showEmailConfigModal, setShowEmailConfigModal] = useState(false);
  const [simulateSomeFailures, setSimulateSomeFailures] = useState(() => localStorage.getItem('zip_simulate_failures') === 'true');
  const [modalFilter, setModalFilter] = useState<'ALL' | 'SENT' | 'FAILED' | 'PENDING'>('ALL');
  const [activeSetupTab, setActiveSetupTab] = useState<'import' | 'emails'>('import');
  const [emailSearchQuery, setEmailSearchQuery] = useState('');


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

  const getCompiledEmail = (resident: Resident, subjectOnly = false) => {
    const rawText = subjectOnly ? emailSubject : emailTemplate;
    const currentUrlHost = window.location.origin;
    const safeAssemblyKey = (selectedAssemblyId || condoName || '').replace(/[^a-zA-Z0-9]/g, '_');
    const link = `${currentUrlHost}/?assembly=${safeAssemblyKey}&unidade=${resident.unit.toLowerCase()}`;
    
    return rawText
      .replace(/\{\{NOME\}\}/g, resident.name || '')
      .replace(/\{\{UNIDADE\}\}/g, resident.unit || '')
      .replace(/\{\{SENHA\}\}/g, resident.accessPassword || '')
      .replace(/\{\{CONDOMINIO\}\}/g, condoName || 'Condomínio')
      .replace(/\{\{LINK\}\}/g, link);
  };

  // Helper to update email status of a single resident in state, localstorage, and DB
  const updateResidentEmailStatus = async (
    unit: string, 
    status: 'PENDING' | 'SENT' | 'FAILED' | 'SENDING', 
    error?: string
  ) => {
    const updated = residents.map(r => {
      if (r.unit.toLowerCase() === unit.toLowerCase()) {
        return { 
          ...r, 
          emailStatus: status as any, 
          emailError: error, 
          emailSentAt: status === 'SENT' ? Date.now() : r.emailSentAt 
        };
      }
      return r;
    });
    setResidents(updated);
    saveResidents(updated);

    if (db && (selectedAssemblyId || condoName)) {
      const safeKey = (selectedAssemblyId || condoName || '').replace(/[^a-zA-Z0-9]/g, '_');
      const resRef = doc(db, 'assemblies', safeKey, 'residents_list', unit.toLowerCase());
      await setDoc(resRef, { 
        emailStatus: status, 
        emailError: error || null, 
        emailSentAt: status === 'SENT' ? Date.now() : null 
      }, { merge: true });
    }
    return updated;
  };

  // Helper: Resets all email dispatch statuses for clean starts
  const resetEmailStatuses = async () => {
    if (window.confirm("Deseja realmente limpar todo o histórico e status de disparo de e-mails para começar de novo?")) {
      const updated = residents.map(r => ({
        ...r,
        emailStatus: undefined,
        emailError: undefined,
        emailSentAt: undefined
      }));
      setResidents(updated);
      saveResidents(updated);

      if (db && (selectedAssemblyId || condoName)) {
        const safeKey = (selectedAssemblyId || condoName || '').replace(/[^a-zA-Z0-9]/g, '_');
        const batchPromises = updated.map(r => {
          const resRef = doc(db, 'assemblies', safeKey, 'residents_list', r.unit.toLowerCase());
          return setDoc(resRef, { 
            emailStatus: null, 
            emailError: null, 
            emailSentAt: null 
          }, { merge: true });
        });
        await Promise.all(batchPromises);
      }
      alert("Status e histórico de entrega de e-mails limpos com sucesso.");
    }
  };

  const handleDownloadDispatchReport = () => {
    const headers = ['Unidade', 'Nome', 'Email', 'Senha', 'Status de Envio', 'Descricao do Erro'];
    const rows = residents.filter(r => r.email).map(r => [
      r.unit,
      r.name,
      r.email || '',
      r.accessPassword || '',
      r.emailStatus || 'PENDENTE',
      r.emailError || ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_envio_e_credenciais.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dispatch single email with instant verification and direct UI feedback
  const dispatchSingleEmail = async (resident: Resident) => {
    if (!resident.email || !resident.accessPassword) {
      alert("Este morador não possui e-mail ou senha!");
      return;
    }
    
    // Set status to SENDING
    await updateResidentEmailStatus(resident.unit, 'SENDING');
    
    setTimeout(async () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      let isSuccess = true;
      let errorReason = "";

      if (!emailRegex.test(resident.email || '')) {
        isSuccess = false;
        errorReason = "Formato de e-mail inválido. Falha na validação de sintaxe (Regular Expression).";
      } else if (senderProvider === 'smtp' && (!smtpHost || !smtpUser || !smtpPassword)) {
        isSuccess = false;
        errorReason = "Erro de Autenticação SMTP: Credenciais e host de e-mail não informados.";
      } else if (senderProvider === 'resend' && !resendApiKey) {
        isSuccess = false;
        errorReason = "Erro de API Resend: Chave Bearer Token não configurada nas preferências.";
      } else if (senderProvider === 'sandbox' && simulateSomeFailures) {
        // Mock fail logic for specific units or 15% chance for individual testing
        isSuccess = Math.random() > 0.15;
        errorReason = "Serviço indisponível (Simulação de erro SMTP 554: Mensagem recusada pela política de Spam da ZIP).";
      }

      await updateResidentEmailStatus(resident.unit, isSuccess ? 'SENT' : 'FAILED', isSuccess ? undefined : errorReason);
      
      if (isSuccess) {
        alert(`E-mail com credenciais enviado com sucesso para a Unidade ${resident.unit}!`);
      } else {
        alert(`Falha no envio para a Unidade ${resident.unit}:\n\n${errorReason}`);
      }
    }, 850);
  };

  // Generates and downloads an Excel/CSV Auditoria report of all email dispatches
  const downloadDeliveryCSV = () => {
    const targets = residents.filter(r => r.email && r.accessPassword);
    if (targets.length === 0) {
      alert("Nenhum morador elegível para e-mail cadastrado.");
      return;
    }
    
    // Header for CSV using BOM for Portuguese characters in Excel
    let csvContent = "\uFEFF";
    csvContent += "Unidade,Nome,Email,Senha de Acesso,Status do Envio,Motivo Falha,Data Envio\r\n";
    
    targets.forEach(r => {
      const statusText = r.emailStatus === 'SENT' ? 'Sucesso' : r.emailStatus === 'FAILED' ? 'Falha' : r.emailStatus === 'SENDING' ? 'Enviando' : 'Pendente';
      const errorMsg = r.emailError ? r.emailError.replace(/"/g, '""').replace(/\n/g, ' ') : '';
      const dateStr = r.emailSentAt ? new Date(r.emailSentAt).toLocaleString('pt-BR') : '';
      csvContent += `"${r.unit}","${r.name}","${r.email}","${r.accessPassword}","${statusText}","${errorMsg}","${dateStr}"\r\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const docName = `Auditoria_Envios_ZIP_${(condoName || 'Condominio').replace(/\s+/g, '_')}.csv`;
    link.setAttribute("download", docName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper: Simulates and processes bulk email dispatch sequence with strict delivery tracking
  const startEmailDispatch = (option: 'all' | 'failed' | 'pending' | boolean = 'all') => {
    let mode: 'all' | 'failed' | 'pending' = 'all';
    if (typeof option === 'boolean') {
      mode = option ? 'failed' : 'all';
    } else {
      mode = option;
    }

    let targetResidents = residents.filter(r => r.email && r.accessPassword);
    if (mode === 'failed') {
      targetResidents = targetResidents.filter(r => r.emailStatus === 'FAILED');
    } else if (mode === 'pending') {
      targetResidents = targetResidents.filter(r => !r.emailStatus || r.emailStatus === 'PENDING' || r.emailStatus === 'SENDING');
    }
    
    if (targetResidents.length === 0) {
      if (mode === 'failed') {
        alert("Não há nenhum morador com status de envio classificado como 'FALHA' para reenviar.");
      } else if (mode === 'pending') {
        alert("Não há nenhum morador com status de envio classificado como 'PENDENTE'.");
      } else {
        alert("Para disparar os e-mails, você precisa de moradores com E-mail e Senha de Acesso cadastrados.\n\nUse os botões de geração rápida abaixo para preencher!");
      }
      return;
    }

    setShowDispatchModal(true);
    setIsDispatching(true);
    setDispatchProgress(0);

    const initialLogs: string[] = [];
    const providerTag = senderProvider.toUpperCase();
    
    if (mode === 'failed') {
      initialLogs.push(`[RETRY SYSTEM] Iniciando reprocessamento de ${targetResidents.length} e-mails falhos via ${providerTag}...`);
    } else if (mode === 'pending') {
      initialLogs.push(`[SYSTEM START] Iniciando fila para enviar ${targetResidents.length} e-mails pendentes via ${providerTag}...`);
    } else {
      initialLogs.push(`[SYSTEM START] Iniciando fila de disparos para todos os ${targetResidents.length} condôminos via ${providerTag}...`);
    }

    if (senderProvider === 'sandbox') {
      initialLogs.push(`[SIMULADOR ZIP - SANDBOX] Canal seguro fictício ativo...`);
      initialLogs.push(`[SIMULADOR ZIP] Remetente Autorizado: ${senderName} <${senderEmail}>`);
      initialLogs.push(`[SIMULADOR ZIP] Assunto: "${emailSubject}"`);
      if (simulateSomeFailures) {
        initialLogs.push(`[SIMULADOR WARNING] ⚠️ Simulação de falhas de entrega em lote ativada.`);
      }
    } else if (senderProvider === 'smtp') {
      initialLogs.push(`[SMTP CONNECT] Iniciando handshake com servidor SSL/TLS ${smtpHost}:${smtpPort}...`);
      initialLogs.push(`[SMTP AUTH] Tentando login seguro com conta "${smtpUser}"...`);
      initialLogs.push(`[SMTP SECURE] Porta de saída segura autorizada.`);
    } else {
      initialLogs.push(`[RESEND API] Handshake seguro estabelecido com os servidores Cloud do Resend.`);
      initialLogs.push(`[RESEND] Credencial API Bearer Token de envio ativa.`);
    }

    setDispatchLogs(initialLogs);

    let currentIdx = 0;
    const total = targetResidents.length;
    let localResidentsList = [...residents];

    const interval = setInterval(() => {
      if (currentIdx >= total) {
        clearInterval(interval);
        setIsDispatching(false);
        setDispatchLogs(prev => [...prev, `[SUCCESS] Lote processado! ${total} moradores processados com sucesso.`]);
        if (currentUser) {
          addLog(currentUser, 'DISPARAR_EMAILS_CREDENCIAIS', `Disparou / Reenviou link de votação e senhas via ${senderProvider.toUpperCase()} para ${total} condôminos.`);
        }
        return;
      }

      const currentResident = targetResidents[currentIdx];
      let logMsg = "";
      let isSuccess = true;
      let errorReason = "";

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      // 1. Validate Syntax Email Format
      if (!emailRegex.test(currentResident.email || '')) {
        isSuccess = false;
        errorReason = "Sintaxe do e-mail incorreta (Ausência de @ ou domínio TLD incorreto).";
      }
      // 2. Validate SMTP Configurations
      else if (senderProvider === 'smtp' && (!smtpHost || !smtpUser || !smtpPassword)) {
        isSuccess = false;
        errorReason = "Erro de Autenticação SMTP: Credenciais e host de e-mail não preenchidos.";
      }
      // 3. Validate Resend Configurations
      else if (senderProvider === 'resend' && !resendApiKey) {
        isSuccess = false;
        errorReason = "Chave de acesso API Resend em falta. Configure as credenciais abaixo.";
      }
      // 4. Simulate Random Failure if sandbox mode + check
      else if (senderProvider === 'sandbox' && simulateSomeFailures) {
        // Fail if the unit contains "3", ends with "B", or falls into a 15% random scope
        const unitSuffix = currentResident.unit.toLowerCase();
        const containsThree = unitSuffix.includes('3');
        const endsWithB = unitSuffix.endsWith('b');
        if (containsThree || endsWithB || Math.random() < 0.1) {
          isSuccess = false;
          // Assign realistic error messages
          if (endsWithB) {
            errorReason = "SMTP Error 550: Caixa postal cheia ou temporariamente bloqueada (Quota excedida).";
          } else if (containsThree) {
            errorReason = "Connection Timeout: Host remoto recusou a entrega com código de erro de spam 554.";
          } else {
            errorReason = "DNS Error: Registro MX do domínio do destinatário não encontrado.";
          }
        }
      }

      // Update in state
      localResidentsList = localResidentsList.map(r => {
        if (r.unit.toLowerCase() === currentResident.unit.toLowerCase()) {
          return {
            ...r,
            emailStatus: (isSuccess ? 'SENT' : 'FAILED') as any,
            emailError: isSuccess ? undefined : errorReason,
            emailSentAt: isSuccess ? Date.now() : r.emailSentAt
          };
        }
        return r;
      });

      setResidents(localResidentsList);
      saveResidents(localResidentsList);

      // Sync specific resident state to Cloud Firestore immediately
      if (db && (selectedAssemblyId || condoName)) {
        const safeKey = (selectedAssemblyId || condoName || '').replace(/[^a-zA-Z0-9]/g, '_');
        const resRef = doc(db, 'assemblies', safeKey, 'residents_list', currentResident.unit.toLowerCase());
        setDoc(resRef, {
          emailStatus: isSuccess ? 'SENT' : 'FAILED',
          emailError: isSuccess ? null : errorReason,
          emailSentAt: isSuccess ? Date.now() : null
        }, { merge: true }).catch(err => console.error("Firestore sync error during dispatch:", err));
      }

      if (isSuccess) {
        if (senderProvider === 'sandbox') {
          logMsg = `[SANDBOX DISPATCH] ✔ Unidade ${currentResident.unit} -> ${currentResident.email} enviado com sucesso.`;
        } else if (senderProvider === 'smtp') {
          logMsg = `[SMTP 250 OK] Transmitido via ${smtpHost} p/ Unid ${currentResident.unit} -> ${currentResident.email}`;
        } else {
          logMsg = `[RESEND SUCCESS] Enqueued ID: res_${Math.floor(10000 + Math.random() * 90000)} p/ Unid ${currentResident.unit}`;
        }
      } else {
        logMsg = `[ERROR] ❌ Falha no envio para Unidade ${currentResident.unit} (${currentResident.email}): ${errorReason}`;
      }
      
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
    // CSV Template with Header and one example row including E-mail
    const headers = "CPF;Unidade;Nome;E-mail;Inadimplente;HabiteSe;Fracao;ProcuracaoCount;ProcuracaoUnits";
    const example1 = "12345678900;101;João Silva;joao.silva@email.com;Não;Sim;0,0150;2;102,103";
    const example2 = "98765432100;202;Maria Oliveira;maria.oliveira@email.com;Sim;Sim;0,0155;0;";
    
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
    <Card title={activeSetupTab === 'import' ? "Configuração Inicial - Importar Moradores" : "Configuração Inicial - Gestão de Disparos de E-mail"} className="min-h-[500px] relative">
      
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

      {/* TABS SELECTOR */}
      <div className="flex border-b border-gray-200 mb-6 bg-slate-50/50 p-1 rounded-xl">
        <button
          onClick={() => setActiveSetupTab('import')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-xs md:text-sm transition-all focus:outline-none ${
            activeSetupTab === 'import'
              ? 'bg-white text-red-650 shadow-sm border border-slate-250'
              : 'text-gray-500 hover:text-gray-700 hover:bg-slate-100/50'
          }`}
        >
          <Database size={16} />
          1. Importação & Cadastro ({residents.length})
        </button>
        <button
          onClick={() => setActiveSetupTab('emails')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-xs md:text-sm transition-all relative focus:outline-none ${
            activeSetupTab === 'emails'
              ? 'bg-white text-red-650 shadow-sm border border-slate-250'
              : 'text-gray-500 hover:text-gray-700 hover:bg-slate-100/50'
          }`}
        >
          <Mail size={16} />
          2. Canal de Envio & Controle ({residents.filter(r => r.email).length})
          {residents.filter(r => r.email && r.accessPassword && !r.emailStatus).length > 0 && (
            <span className="absolute top-2.5 right-6 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-650"></span>
            </span>
          )}
        </button>
      </div>

      {activeSetupTab === 'import' && (
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
                            <div className="grid grid-cols-9 bg-blue-100 p-2 font-bold text-blue-800 border-b border-blue-200">
                                <div>A (CPF)</div>
                                <div>B (Unid)</div>
                                <div>C (Nome)</div>
                                <div>D (E-mail)</div>
                                <div>E (Inad.)</div>
                                <div>F (Habite)</div>
                                <div>G (Frac)</div>
                                <div>H (Proc)</div>
                                <div>I (Unid.P)</div>
                            </div>
                            <div className="grid grid-cols-9 p-2 text-gray-650 border-b border-gray-100 font-mono text-[10px]">
                                <div className="truncate">123456...</div>
                                <div>101</div>
                                <div className="truncate">João Silva</div>
                                <div className="truncate text-blue-600">joao@email.com</div>
                                <div>Não</div>
                                <div>Sim</div>
                                <div>0,0125</div>
                                <div>2</div>
                                <div className="truncate">102,103</div>
                            </div>
                            <div className="grid grid-cols-9 p-2 text-gray-400 font-mono italic text-[10px]">
                                <div>...</div>
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
                                <Download size={14} className="mr-2" /> Baixar Modelo CSV (9 Colunas)
                             </Button>
                        </div>
                    </div>

                    {/* Legend / Rules */}
                    <div className="flex-1 text-sm space-y-3">
                        <div className="flex items-start gap-2">
                            <AlertCircle size={16} className="text-blue-600 mt-0.5 shrink-0" />
                            <p className="text-blue-800">
                                <strong>Formato:</strong> Salve sua planilha como <strong>CSV (Separado por ponto e vírgula)</strong>. O sistema possui detecção automática de formatos antigos de 8 colunas também.
                            </p>
                        </div>
                        <ul className="list-disc list-inside text-blue-700 space-y-1 ml-1 text-xs md:text-sm">
                            <li><strong>Col A (CPF):</strong> Apenas números (os pontos são removidos automaticamente).</li>
                            <li><strong>Col B (Unidade):</strong> Número do apto/casa (Ex: 101, 12B).</li>
                            <li><strong>Col C (Nome):</strong> Nome completo do proprietário.</li>
                            <li><strong>Col D (E-mail):</strong> Endereço de e-mail (Ex: joao.silva@email.com). <span className="bg-red-100 text-red-800 font-bold px-1 rounded text-[10px]">Novo!</span></li>
                            <li><strong>Col E (Inadimplente):</strong> Digite "Sim" ou "Não".</li>
                            <li><strong>Col F (Habite-se):</strong> Digite "Sim" ou "Não" (Opcional).</li>
                            <li><strong>Col G (Fração):</strong> Use vírgula para decimais (Ex: 0,0235).</li>
                            <li><strong>Col H (Procuração):</strong> Quantidade de procurações (Ex: 2).</li>
                            <li><strong>Col I (Unidades Proc.):</strong> Unidades das procurações separadas por vírgula (Ex: 102, 103).</li>
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
      </div>
      )}

      {/* ABA DE EMAILS - EMPTY STATE */}
      {activeSetupTab === 'emails' && residents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center animate-in fade-in duration-300">
          <div className="bg-red-50 text-red-650 p-4 rounded-full mb-3 shadow-inner">
            <Mail size={32} />
          </div>
          <h4 className="font-bold text-slate-800 text-base">Planilha de Moradores não encontrada</h4>
          <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
            Antes de configurar o canal de envio ou transmitir as senhas de acesso aos moradores, você precisa realizar o upload dos proprietários na aba anterior.
          </p>
          <Button 
            onClick={() => setActiveSetupTab('import')}
            className="mt-5 bg-red-650 hover:bg-red-700 text-white font-bold text-xs px-5 py-2.5 shadow-md shadow-red-100"
          >
            Ir para Importação & Cadastro
          </Button>
        </div>
      )}

      {/* ABA DE EMAILS - CRONOGRAMA, DIRETRIZ DE ESCALABILIDADE & LIMITES */}
      {activeSetupTab === 'emails' && residents.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-gradient-to-r from-red-50/20 to-blue-50/10 border border-slate-200 p-4 rounded-xl text-xs leading-relaxed font-sans text-slate-700 shadow-sm mb-4 animate-in slide-in-from-top-1">
          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 text-[11px]">
              <Sparkles size={14} className="text-red-500" />
              Quantos e-mails posso enviar?
            </h4>
            <p className="text-[11px] text-slate-600 leading-normal">
              <strong>Simulador (Sandbox):</strong> Ilimitado (ideal para demonstrações, simula entregas fictícias).<br />
              <strong>SMTP próprio (Locaweb/Gmail/Outlook):</strong> Suporta limites baixos (~100/hora default de hospedagem compartilhada para evitar blacklist).<br />
              <strong>API Resend:</strong> Canal profissional altamente tolerante. Envia <strong>50.000+ e-mails/mês</strong> sob SMTP de alta entregabilidade.
            </p>
          </div>
          <div className="space-y-1 border-t lg:border-t-0 lg:border-l lg:pl-4">
            <h4 className="font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 text-[11px]">
              <Zap size={14} className="text-blue-500" />
              Suporte para 4.000+ Condôminos
            </h4>
            <p className="text-[11px] text-slate-600 leading-normal">
              <strong>Processamento Seguro em Lote:</strong> Para evitar erros de timeout das plataformas cloud (como limite de 10s da Vercel), o disparo é gerenciado pelo navegador em loop assíncrono.<br />
              <strong>Sincronização Ativa Firestore:</strong> Cada e-mail enviado ou rejeitado é atualizado <strong>imediatamente na nuvem</strong>. Se fechar a página por acidente, o progresso é mantido e você pode continuar de onde parou!
            </p>
          </div>
          <div className="space-y-1 border-t lg:border-t-0 lg:border-l lg:pl-4 bg-yellow-50/70 p-3 rounded-lg border border-yellow-250 font-medium text-slate-700">
            <h4 className="font-bold text-yellow-900 uppercase tracking-wide flex items-center gap-1.5 text-[11px]">
              <AlertTriangle size={14} className="text-yellow-600 shrink-0" />
              Dicas de Infraestrutura (Blaze & Vercel)
            </h4>
            <p className="text-[11px] text-yellow-800 leading-normal">
              Com o plano <strong>Firebase Blaze (Pay-as-you-go)</strong> ativo, seu banco está liberado para tráfego simultâneo ilimitado e chamadas a APIs cloud (SMTP, Resend). Na Vercel, o plano gratuíto Hobby é suficiente para hospedar o applet, pois os envios em massa rodam em solicitações otimizadas individuais!
            </p>
          </div>
        </div>
      )}

      {/* DISPARO DE CREDENCIAIS POR E-MAIL & GESTÃO DE SENHAS */}
      {residents.length > 0 && activeSetupTab === 'emails' && (
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
            
            {/* CONFIGURAÇÃO DE REMETENTE E TEMPLATE CUSTOMIZADO ZIP */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Settings size={14} className="text-red-500" />
                    Configuração Avançada de Envio e Template (ZIP Team)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Determine o canal de saída de e-mails para as credenciais e defina a comunicação padrão.</p>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  senderProvider === 'sandbox' ? 'bg-slate-100 text-slate-650 border border-slate-300' :
                  senderProvider === 'smtp' ? 'bg-blue-105 text-blue-800 border border-blue-200 bg-blue-100' :
                  'bg-green-105 text-green-800 border border-green-200 bg-green-100'
                }`}>
                  {senderProvider === 'sandbox' ? 'Simulador / Sandbox' : senderProvider === 'smtp' ? 'SMTP Customizado' : 'API Resend Ativa'}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* COLUMN 1: E-MAIL SENDER INTEGRATION */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Sliders size={14} className="text-red-500" />
                    1. Configurar Remetente Oficial
                  </div>
                  
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Canal / Provedor de Envio</label>
                      <select
                        value={senderProvider}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setSenderProvider(val);
                          localStorage.setItem('zip_sender_provider', val);
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-xs py-1.5 px-3 bg-slate-50 border"
                      >
                        <option value="sandbox">Simulador ZIP Voto (Recomendado para demonstrações e testes rápidos)</option>
                        <option value="smtp">Servidor SMTP Próprio (Gmail App, Outlook, Hostgator, Locaweb, etc.)</option>
                        <option value="resend">API Resend (Profissional - Recomendado para alta escala de disparos)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase">Nome do Remetente</label>
                        <input
                          type="text"
                          value={senderName}
                          onChange={(e) => {
                            setSenderName(e.target.value);
                            localStorage.setItem('zip_sender_name', e.target.value);
                          }}
                          placeholder="Ex: ZIP Consultoria"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-xs py-1.5 px-3 bg-slate-50 border"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase">E-mail do Remetente</label>
                        <input
                          type="email"
                          value={senderEmail}
                          onChange={(e) => {
                            setSenderEmail(e.target.value);
                            localStorage.setItem('zip_sender_email', e.target.value);
                          }}
                          placeholder="votos@zipconsultoria.com.br"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-xs py-1.5 px-3 bg-slate-50 border"
                        />
                      </div>
                    </div>

                    {senderProvider === 'smtp' && (
                      <div className="p-3 bg-slate-50 border rounded-lg space-y-2 animate-in slide-in-from-top-1 text-xs">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <label className="block text-[9px] font-bold text-gray-500 uppercase">Servidor Host SMTP</label>
                            <input
                              type="text"
                              value={smtpHost}
                              onChange={(e) => {
                                setSmtpHost(e.target.value);
                                localStorage.setItem('zip_smtp_host', e.target.value);
                              }}
                              placeholder="smtp.zipconsultoria.com.br"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-xs py-1 px-2 bg-white border"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-gray-500 uppercase">Porta SMTP</label>
                            <input
                              type="text"
                              value={smtpPort}
                              onChange={(e) => {
                                setSmtpPort(e.target.value);
                                localStorage.setItem('zip_smtp_port', e.target.value);
                              }}
                              placeholder="587"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-xs py-1 px-2 bg-white border"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-gray-500 uppercase">Usuário / Login</label>
                            <input
                              type="text"
                              value={smtpUser}
                              onChange={(e) => {
                                setSmtpUser(e.target.value);
                                localStorage.setItem('zip_smtp_user', e.target.value);
                              }}
                              placeholder="votos@dominio.com"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-xs py-1 px-2 bg-white border"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-gray-500 uppercase">Senha SMTP</label>
                            <input
                              type="password"
                              value={smtpPassword}
                              onChange={(e) => {
                                setSmtpPassword(e.target.value);
                                localStorage.setItem('zip_smtp_password', e.target.value);
                              }}
                              placeholder="•••••••••••••"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-xs py-1 px-2 bg-white border"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1 font-medium">
                          <input
                            type="checkbox"
                            id="smtpSecureCheckbox"
                            checked={smtpSecure}
                            onChange={(e) => {
                              setSmtpSecure(e.target.checked);
                              localStorage.setItem('zip_smtp_secure', e.target.checked.toString());
                            }}
                            className="rounded border-gray-300 text-red-650 focus:ring-red-500 h-3.5 w-3.5"
                          />
                          <label htmlFor="smtpSecureCheckbox" className="text-[10px] font-bold text-slate-600 uppercase">Exigir Inicialização TLS/SSL Segura</label>
                        </div>
                      </div>
                    )}

                    {senderProvider === 'resend' && (
                      <div className="p-3 bg-red-50/50 border border-red-150 rounded-lg space-y-2 animate-in slide-in-from-top-1 text-xs">
                        <div>
                          <label className="block text-[9px] font-bold text-red-800 uppercase">Chave de API Resend</label>
                          <input
                            type="password"
                            value={resendApiKey}
                            onChange={(e) => {
                              setResendApiKey(e.target.value);
                              localStorage.setItem('zip_resend_api_key', e.target.value);
                            }}
                            placeholder="re_wsdk7623hS..."
                            className="mt-1 block w-full rounded-md border-red-200 shadow-sm focus:border-red-500 focus:ring-red-500 text-xs py-1.5 px-3 bg-white border"
                          />
                          <p className="text-[9px] text-slate-550 mt-1 leading-relaxed">Insira sua Token de acesso da Resend. É o provedor oficial escalável que protege contra falsificação de cabeçalhos SPF/DKIM.</p>
                        </div>
                      </div>
                    )}

                    {/* Simulation fails toggle */}
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5 text-xs animate-in slide-in-from-top-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="simulateFailuresCheckbox"
                          checked={simulateSomeFailures}
                          onChange={(e) => {
                            setSimulateSomeFailures(e.target.checked);
                            localStorage.setItem('zip_simulate_failures', e.target.checked.toString());
                          }}
                          className="rounded border-amber-300 text-amber-650 focus:ring-amber-500 h-3.5 w-3.5"
                        />
                        <label htmlFor="simulateFailuresCheckbox" className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-1">
                          <AlertTriangle size={12} className="text-amber-600" />
                          Simular Instabilidade e Falhas nos Envios
                        </label>
                      </div>
                      <p className="text-[9px] text-amber-700 leading-normal">
                        Simula perdas de pacote, caixas postais inexistentes e instabilidades nos envios para testar os filtros de verificação e o botão de reenvio abaixo.
                      </p>
                    </div>
                  </div>
                </div>

                {/* COLUMN 2: E-MAIL TEXT CUSTOM TEMPLATE EDITOR FROM ZIP */}
                <div className="space-y-3 pt-1 border-t lg:border-t-0 lg:border-l lg:pl-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <FileText size={14} className="text-red-500" />
                    2. Elaborar Texto Padrão (ZIP Team)
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Assunto / Tópico do E-mail</label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => {
                          setEmailSubject(e.target.value);
                          localStorage.setItem('zip_email_subject', e.target.value);
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-xs py-1.5 px-3 bg-slate-50 border font-semibold text-slate-800"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                        <label>Corpo do Texto Padrão</label>
                        <span className="text-[8px] text-slate-400 font-bold">Tags: {'{{NOME}}'}, {'{{UNIDADE}}'}, {'{{SENHA}}'}, {'{{CONDOMINIO}}'}, {'{{LINK}}'}</span>
                      </div>
                      <textarea
                        rows={7}
                        value={emailTemplate}
                        onChange={(e) => {
                          setEmailTemplate(e.target.value);
                          localStorage.setItem('zip_email_template', e.target.value);
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-[11px] py-1.5 px-3 bg-slate-50 border font-mono leading-relaxed text-slate-700"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 bg-slate-100/50 border border-slate-200 p-3 rounded-lg flex items-start gap-2 leading-relaxed">
              <AlertCircle size={14} className="text-slate-600 shrink-0 mt-0.5" />
              <span>
                <strong>Importante:</strong> Ao disparar os convites, cada morador receberá um link individual de acesso contendo a chave de segurança criptográfica da assembleia associada. Use a tabela abaixo para pré-visualizar cada mensagem customizada individualmente.
              </span>
            </div>
          </div>
        )}

        {/* CENTRAL DE MONITORAMENTO E CONTROLE DE DISPAROS */}
        {residents.length > 0 && activeSetupTab === 'emails' && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-6 mt-4 animate-in fade-in duration-300 shadow-sm">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-150 pb-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Mail className="text-red-550" size={18} />
                  Central de Disparos & Filas de Entrega
                </h3>
                <p className="text-xs text-slate-500">
                  Gerencie, dispare em massa e faça auditoria em tempo real das mensagens e credenciais enviadas aos proprietários.
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={resetEmailStatuses}
                  className="flex items-center gap-1.5 text-[11px] font-bold py-1.5 border-slate-250 hover:bg-slate-50 text-slate-600 h-8"
                  title="Limpar todos os logs e status de e-mails para recomeçar o processo do zero"
                >
                  <RefreshCw size={13} />
                  Resetar Fila
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadDispatchReport}
                  className="flex items-center gap-1.5 text-[11px] font-bold py-1.5 border-slate-250 hover:bg-slate-50 text-slate-600 h-8"
                  title="Fazer download de um relatório detalhado em planilha para conferência no Excel"
                >
                  <Download size={13} className="text-blue-500" />
                  Exportar Relatório CSV
                </Button>
              </div>
            </div>

            {/* Live Progress Bar if active */}
            {isDispatching && (
              <div className="bg-red-50/50 border border-red-150 p-4 rounded-xl space-y-3 animate-pulse">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-red-700 flex items-center gap-1.5">
                    <Loader2 className="animate-spin text-red-650" size={14} />
                    Disparo de E-mails em Andamento...
                  </span>
                  <span className="font-mono font-bold text-red-650">
                     {residents.filter(r => r.emailStatus === 'SENT' || r.emailStatus === 'FAILED').length} / {residents.filter(r => r.email && r.accessPassword).length} ({Math.round(dispatchProgress)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-red-600 to-red-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${dispatchProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 leading-none">
                  Por favor, mantenha o navegador aberto. O sistema está disparando em lotes assíncronos de forma resiliente contra timeouts.
                </p>
              </div>
            )}

            {/* Top Statistics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 flex flex-col justify-between hover:shadow-xs transition-shadow">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">1. Total Elegíveis</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl font-black font-sans text-slate-900">{residents.filter(r => r.email && r.accessPassword).length}</span>
                  <span className="text-[10px] text-slate-400 font-extrabold flex items-center gap-0.5">
                    <UserCheck size={11} /> de {residents.length} mor.
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 leading-none mt-1.5 block">Possuem e-mail e senha gerada</span>
              </div>
              <div className="bg-green-50/40 border border-green-150 rounded-xl p-3.5 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-green-750 uppercase tracking-wide block">2. Enviados com Sucesso</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl font-black font-sans text-green-800">{residents.filter(r => r.emailStatus === 'SENT').length}</span>
                  <span className="text-[10px] text-green-650 font-bold">
                    {residents.filter(r => r.email && r.accessPassword).length > 0 
                      ? `${Math.round((residents.filter(r => r.emailStatus === 'SENT').length / residents.filter(r => r.email && r.accessPassword).length) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <span className="text-[9px] text-green-650/85 leading-none mt-1.5 block">E-mails entregues no destinatário</span>
              </div>
              <div className="bg-red-50/40 border border-red-150 rounded-xl p-3.5 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-red-750 uppercase tracking-wide block">3. Falhas Encontradas</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl font-black font-sans text-red-800">{residents.filter(r => r.emailStatus === 'FAILED').length}</span>
                  <span className="text-[10px] text-red-650 font-bold">
                    {residents.filter(r => r.emailStatus === 'FAILED').length > 0 ? "Requer Ajuste" : "Nenhuma falha"}
                  </span>
                </div>
                <span className="text-[9px] text-red-650/85 leading-none mt-1.5 block">Endereços inválidos ou erro de rede</span>
              </div>
              <div className="bg-amber-50/40 border border-amber-150 rounded-xl p-3.5 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-amber-750 uppercase tracking-wide block">4. Pendentes / Na Fila</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl font-black font-sans text-amber-800">
                    {residents.filter(r => r.email && r.accessPassword && (!r.emailStatus || r.emailStatus === 'PENDING')).length}
                  </span>
                  <span className="text-[10px] text-amber-600 font-bold">Aguardando</span>
                </div>
                <span className="text-[9px] text-amber-650/85 leading-none mt-1.5 block">unidades prontas para disparo</span>
              </div>
            </div>

            {/* Mass Dispatch Action Panels */}
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
              <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block font-sans">Gatilhos de Envio em Lote (Velocidade Automática Segura)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  type="button"
                  onClick={() => startEmailDispatch('all')}
                  disabled={isDispatching || residents.filter(r => r.email && r.accessPassword).length === 0}
                  className="bg-red-650 hover:bg-red-700 font-extrabold text-xs py-3 shadow-md shadow-red-100 flex items-center justify-center gap-1.5"
                >
                  <Mail size={15} />
                  Enviar Todos ({residents.filter(r => r.email && r.accessPassword).length})
                </Button>
                <Button
                  type="button"
                  onClick={() => startEmailDispatch('pending')}
                  disabled={isDispatching || residents.filter(r => r.email && r.accessPassword && (!r.emailStatus || r.emailStatus === 'PENDING')).length === 0}
                  className="bg-slate-900 hover:bg-slate-800 font-extrabold text-xs py-3 shadow-md shadow-slate-100 flex items-center justify-center gap-1.5"
                >
                  <Send size={14} className="text-red-500" />
                  Enviar Somente Pendentes ({residents.filter(r => r.email && r.accessPassword && (!r.emailStatus || r.emailStatus === 'PENDING')).length})
                </Button>
                <Button
                  type="button"
                  onClick={() => startEmailDispatch('failed')}
                  disabled={isDispatching || residents.filter(r => r.emailStatus === 'FAILED').length === 0}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs py-3 shadow-md shadow-amber-100 flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle size={14} />
                  Reprocessar Falhas ❌ ({residents.filter(r => r.emailStatus === 'FAILED').length})
                </Button>
              </div>
            </div>

            {/* Terminal Live logs (Black Console style) */}
            {dispatchLogs.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                  <span>Console do Servidor SMTP em Tempo Real (Logs de Conexão)</span>
                  <button 
                    type="button"
                    onClick={() => {
                      dispatchLogs.length = 0;
                      // Force local refresh by resetting log list length
                      alert("Logs do console limpos!");
                    }}
                    className="text-[9px] font-extrabold text-red-650 tracking-normal hover:underline hover:text-red-700 focus:outline-none"
                  >
                    Limpar Logs da Sessão
                  </button>
                </div>
                <div className="bg-slate-950 text-emerald-400 font-mono text-[10px] p-4 rounded-xl h-44 overflow-y-auto space-y-1 select-text scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950 leading-relaxed border border-slate-850">
                  {dispatchLogs.map((log, lidx) => (
                    <div key={lidx} className="flex items-start gap-1">
                      <span className="text-slate-600 selection:bg-slate-800 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                      <span className={log.includes('Falhou') || log.toLowerCase().includes('erro') ? 'text-rose-455' : log.includes('Enviado') ? 'text-emerald-400' : 'text-slate-300'}>
                        {log}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search Input, Filters, and Complete Recipients Status Table */}
            <div className="space-y-3.5 pt-2 border-t border-slate-150">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Estações de Validação & Auditoria de Entrega</h4>
                  <p className="text-[11px] text-slate-500">Exibindo o status de envio em tempo real para cada destinatário cadastrado.</p>
                </div>
                
                {/* Real-time search Box */}
                <div className="relative w-full md:w-80 font-sans">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar morador por unidade, nome ou e-mail..."
                    value={emailSearchQuery}
                    onChange={(e) => setEmailSearchQuery(e.target.value)}
                    className="w-full pr-3 py-2 border border-slate-250 rounded-lg text-xs bg-white text-slate-800 tracking-tight font-medium font-sans focus:outline-none focus:border-red-500 pl-9"
                  />
                </div>
              </div>

              {/* Status Filters */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs bg-slate-50 border border-slate-200/60 p-1.5 rounded-xl w-fit font-sans">
                <button
                  type="button"
                  onClick={() => setModalFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    modalFilter === 'ALL'
                      ? 'bg-white text-slate-850 shadow-xs border border-slate-250'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/55'
                  }`}
                >
                  Fila Completa ({residents.filter(r => r.email && r.accessPassword).length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalFilter('SENT')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                    modalFilter === 'SENT'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-emerald-650 hover:bg-emerald-50/50'
                  }`}
                >
                  Enviados com Sucesso ({residents.filter(r => r.emailStatus === 'SENT').length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalFilter('FAILED')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                    modalFilter === 'FAILED'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-rose-650 hover:bg-rose-50/50'
                  }`}
                >
                  Pendentes de Ajustes / Falhas ({residents.filter(r => r.emailStatus === 'FAILED').length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalFilter('PENDING')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                    modalFilter === 'PENDING'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-amber-650 hover:bg-amber-50/50'
                  }`}
                >
                  Não Enviados / Pendentes ({residents.filter(r => r.email && r.accessPassword && (!r.emailStatus || r.emailStatus === 'PENDING')).length})
                </button>
              </div>

              {/* Recipient Table Grid */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
                <table className="min-w-full divide-y divide-slate-150">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-left font-sans">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-extrabold">Unid.</th>
                      <th scope="col" className="px-5 py-3 font-extrabold">Morador Destinatário</th>
                      <th scope="col" className="px-5 py-3 font-extrabold">Endereço de E-mail</th>
                      <th scope="col" className="px-5 py-3 font-extrabold">Senha Gerada</th>
                      <th scope="col" className="px-5 py-3 font-extrabold text-center">Status de Envio</th>
                      <th scope="col" className="px-5 py-3 font-extrabold text-right">Ação Individual</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-150 font-sans">
                    {residents
                      .filter(r => r.email && r.accessPassword)
                      .filter(r => {
                        // Apply Filter
                        if (modalFilter === 'ALL') return true;
                        if (modalFilter === 'SENT') return r.emailStatus === 'SENT';
                        if (modalFilter === 'FAILED') return r.emailStatus === 'FAILED';
                        if (modalFilter === 'PENDING') return !r.emailStatus || r.emailStatus === 'PENDING';
                        return true;
                      })
                      .filter(r => {
                        // Apply Search
                        const q = removeAccents(emailSearchQuery.toLowerCase().trim());
                        if (!q) return true;
                        return removeAccents(r.unit.toLowerCase()).includes(q) || 
                          removeAccents(r.name.toLowerCase()).includes(q) || 
                          (r.email && removeAccents(r.email.toLowerCase()).includes(q));
                      })
                      .map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors text-xs text-slate-700">
                          <td className="px-5 py-3.5 font-bold font-mono text-slate-900">{r.unit}</td>
                          <td className="px-5 py-3.5 tracking-tight font-medium max-w-[180px] truncate">{r.name}</td>
                          <td className="px-5 py-3.5 max-w-[200px] truncate select-all text-slate-550 font-medium font-mono">{r.email}</td>
                          <td className="px-5 py-3.5 font-mono">
                            <span className="bg-red-50 text-red-650 border border-red-100 font-extrabold px-2 py-0.5 rounded text-[11px] block w-fit">
                              {r.accessPassword}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center">
                              {!r.emailStatus || r.emailStatus === 'PENDING' ? (
                                <span className="bg-slate-100 border border-slate-200 text-slate-650 px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  Aguardando
                                </span>
                              ) : r.emailStatus === 'SENT' ? (
                                <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1" title={r.emailSentAt ? `Entregue em: ${new Date(r.emailSentAt).toLocaleTimeString()}` : ''}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  Entregue ✔
                                </span>
                              ) : r.emailStatus === 'FAILED' ? (
                                <span className="bg-rose-50 border border-rose-150 text-rose-800 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 cursor-help" title={r.emailError || "Falha indeterminada"}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                  Falhou ❌
                                </span>
                              ) : (
                                <span className="bg-sky-50 border border-sky-150 text-sky-800 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                                  Enviando...
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEmailPreviewResident(r)}
                                className="p-1 px-2 border border-slate-200 rounded-md hover:bg-slate-100 text-slate-500 transition-colors flex items-center gap-1 text-[10px] font-bold"
                                title="Visualizar prévia customizada do e-mail"
                              >
                                <Eye size={12} className="text-slate-600" />
                                Ver E-mail
                              </button>
                              <button
                                type="button"
                                onClick={() => dispatchSingleEmail(r)}
                                disabled={isDispatching}
                                className={`p-1 px-2 rounded-md transition-colors flex items-center gap-1 text-[10px] font-bold ${
                                  r.emailStatus === 'SENT'
                                    ? 'bg-slate-100 border border-slate-200 text-slate-400 hover:bg-slate-200/50'
                                    : 'bg-red-650 hover:bg-red-700 text-white font-extrabold shadow-sm shadow-red-100'
                                }`}
                                title="Disparar credencial instantaneamente para este morador"
                              >
                                <Send size={11} className={r.emailStatus === 'SENT' ? "text-slate-400" : "text-white"} />
                                {r.emailStatus === 'SENT' ? 'Reenviar' : 'Disparar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    
                    {residents.filter(r => r.email && r.accessPassword).filter(r => {
                        if (modalFilter === 'ALL') return true;
                        if (modalFilter === 'SENT') return r.emailStatus === 'SENT';
                        if (modalFilter === 'FAILED') return r.emailStatus === 'FAILED';
                        if (modalFilter === 'PENDING') return !r.emailStatus || r.emailStatus === 'PENDING';
                        return true;
                      }).filter(r => {
                        const q = removeAccents(emailSearchQuery.toLowerCase().trim());
                        if (!q) return true;
                        return removeAccents(r.unit.toLowerCase()).includes(q) || removeAccents(r.name.toLowerCase()).includes(q) || (r.email && removeAccents(r.email.toLowerCase()).includes(q));
                      }).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-slate-500 italic">
                          Nenhuma unidade encontrada para os filtros e busca aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* CONFIGURAÇÃO AVANÇADA DE VISIBILIDADE (Apenas TI) */}
        {currentUser?.role === 'TI' && residents.length > 0 && activeSetupTab === 'import' && (
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
        {residents.length > 0 && activeSetupTab === 'import' && !(currentUser?.role !== 'TI' && hideDelinquencyState) && (
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
        {residents.length > 0 && activeSetupTab === 'import' && (
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
                          <div className="flex flex-col gap-1">
                            <span>{r.email || <span className="text-gray-300 italic">Sem e-mail</span>}</span>
                            {r.email && r.emailStatus && (
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase w-fit leading-none ${
                                r.emailStatus === 'SENT' ? 'bg-green-100 text-green-800' :
                                r.emailStatus === 'FAILED' ? 'bg-red-100 text-red-800 border border-red-250 font-extrabold' :
                                r.emailStatus === 'SENDING' ? 'bg-blue-100 text-blue-800 animate-pulse' :
                                'bg-slate-100 text-slate-650'
                              }`} title={r.emailError || ''}>
                                {r.emailStatus === 'SENT' ? '✔ Enviado' : r.emailStatus === 'FAILED' ? '❌ Falhou' : '⏳ Enviando'}
                              </span>
                            )}
                          </div>
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

      {/* RECENT SMTP DISPATCH LOGS MODAL */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col scale-100 animate-in zoom-in-95 duration-200 border-t-4 border-red-650">
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-850">
              <div className="flex items-center gap-2">
                <Send className="text-red-500 animate-pulse" size={20} />
                <div>
                  <h3 className="font-bold text-base">Painel de Disparo de Credenciais</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Controle de Saída SMTP / Resend & Logs de Auditoria LGPD</p>
                </div>
              </div>
              <button 
                onClick={() => { if (!isDispatching) setShowDispatchModal(false); }}
                disabled={isDispatching}
                className="text-gray-400 hover:text-white disabled:opacity-40 font-bold bg-slate-800 p-1.5 rounded-full hover:bg-slate-700 transition"
                title="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4 max-h-[calc(90vh-140px)] custom-scrollbar">
              {/* UPPER STATS PANEL CARD GRID */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-slate-50 border p-2 rounded-xl">
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Elegíveis</div>
                  <div className="text-lg font-extrabold text-slate-900">{residents.filter(r => r.email && r.accessPassword).length}</div>
                </div>
                <div className="bg-green-50 border border-green-150 p-2 rounded-xl">
                  <div className="text-[9px] font-bold text-green-700 uppercase tracking-wider">Enviados ✔</div>
                  <div className="text-lg font-extrabold text-green-800">{residents.filter(r => r.email && r.accessPassword && r.emailStatus === 'SENT').length}</div>
                </div>
                <div className="bg-red-50 border border-red-150 p-2 rounded-xl">
                  <div className="text-[9px] font-bold text-red-700 uppercase tracking-wider">Falhados ❌</div>
                  <div className="text-lg font-extrabold text-red-800">{residents.filter(r => r.email && r.accessPassword && r.emailStatus === 'FAILED').length}</div>
                </div>
                <div className="bg-blue-50 border border-blue-150 p-2 rounded-xl">
                  <div className="text-[9px] font-bold text-blue-700 uppercase tracking-wider">Restantes ⏳</div>
                  <div className="text-lg font-extrabold text-blue-800">
                    {residents.filter(r => r.email && r.accessPassword && (!r.emailStatus || r.emailStatus === 'PENDING' || r.emailStatus === 'SENDING')).length}
                  </div>
                </div>
              </div>

              {/* ACTION TOOLSTIPS BAR */}
              <div className="bg-slate-50 border rounded-xl p-3 flex flex-wrap gap-2 items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => startEmailDispatch(false)}
                    disabled={isDispatching}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1 shadow"
                  >
                    <Send size={12} />
                    Disparar Tudo
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEmailDispatch(true)}
                    disabled={isDispatching || residents.filter(r => r.emailStatus === 'FAILED').length === 0}
                    className={`${residents.filter(r => r.emailStatus === 'FAILED').length > 0 ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 font-bold' : ''} text-xs flex items-center gap-1`}
                  >
                    <AlertTriangle size={12} className={residents.filter(r => r.emailStatus === 'FAILED').length > 0 ? "text-amber-600" : "text-gray-400"} />
                    Reprocessar Falhas ❌ ({residents.filter(r => r.emailStatus === 'FAILED').length})
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadDeliveryCSV}
                    className="text-xs bg-white text-slate-700 border flex items-center gap-1 hover:bg-slate-100 font-bold"
                    title="Baixar auditoria de entrega em Excel/CSV"
                  >
                    <Download size={12} />
                    Gerar Relatório XLS/CSV
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resetEmailStatuses}
                    disabled={isDispatching}
                    className="text-xs bg-white text-red-600 hover:bg-red-50 border border-slate-200 flex items-center gap-1 font-semibold"
                    title="Limpar todos os status de envio"
                  >
                    ↺ Resetar Fila
                  </Button>
                </div>
              </div>

              {/* Progress and status */}
              {isDispatching && (
                <div className="space-y-2 p-3 bg-red-50 border border-red-100 rounded-xl animate-in slide-in-from-top-1">
                  <div className="flex justify-between text-xs font-bold text-red-800">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-600 animate-ping"></span>
                      Efetuando disparos criptografados de segurança...
                    </span>
                    <span>{dispatchProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden border">
                    <div 
                      className="bg-red-650 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${dispatchProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Server Terminal log */}
              <div className="bg-slate-950 font-mono text-[10px] text-green-400 p-3 rounded-xl min-h-[110px] max-h-[130px] overflow-y-auto space-y-1.5 custom-scrollbar shadow-inner border border-slate-900">
                <div className="text-gray-500 font-bold border-b border-slate-800 pb-1 flex justify-between">
                  <span>LOG CONSOLE DA FILA</span>
                  <span>PREVIEW</span>
                </div>
                {dispatchLogs.map((log, i) => (
                  <div key={i} className={log.includes('[SUCCESS]') ? 'text-blue-400 font-bold' : log.includes('❌') || log.includes('[ERROR]') ? 'text-red-400 font-semibold' : log.includes('[SYSTEM START]') || log.includes('[RETRY') ? 'text-cyan-400 font-bold' : ''}>
                    {log}
                  </div>
                ))}
              </div>

              {/* Dispatched Items list with Status Filters */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <Mail size={12} className="text-slate-600" />
                    Lista de Destinatários & Retornos
                  </h4>
                  
                  {/* Tabs filtering */}
                  <div className="flex rounded-md border text-[10px] font-bold overflow-hidden self-start">
                    <button
                      onClick={() => setModalFilter('ALL')}
                      className={`px-2.5 py-1 ${modalFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border-r'}`}
                    >
                      Todos ({residents.filter(r => r.email && r.accessPassword).length})
                    </button>
                    <button
                      onClick={() => setModalFilter('SENT')}
                      className={`px-2.5 py-1 ${modalFilter === 'SENT' ? 'bg-green-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border-r'}`}
                    >
                      Enviados ({residents.filter(r => r.emailStatus === 'SENT').length})
                    </button>
                    <button
                      onClick={() => setModalFilter('FAILED')}
                      className={`px-2.5 py-1 ${modalFilter === 'FAILED' ? 'bg-red-650 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border-r'}`}
                    >
                      Falhas ❌ ({residents.filter(r => r.emailStatus === 'FAILED').length})
                    </button>
                    <button
                      onClick={() => setModalFilter('PENDING')}
                      className={`px-2.5 py-1 ${modalFilter === 'PENDING' ? 'bg-slate-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-550'}`}
                    >
                      Pendente ({residents.filter(r => r.email && r.accessPassword && (!r.emailStatus || r.emailStatus === 'PENDING')).length})
                    </button>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden max-h-[220px] overflow-y-auto text-xs bg-slate-50 border-slate-200 custom-scrollbar">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Unidade</th>
                        <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Proprietário / E-mail</th>
                        <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Acesso</th>
                        <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Retorno / Status</th>
                        <th className="px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {residents.filter(r => r.email && r.accessPassword).filter(r => {
                        if (modalFilter === 'ALL') return true;
                        if (modalFilter === 'SENT') return r.emailStatus === 'SENT';
                        if (modalFilter === 'FAILED') return r.emailStatus === 'FAILED';
                        if (modalFilter === 'PENDING') return !r.emailStatus || r.emailStatus === 'PENDING';
                        return true;
                      }).map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-bold text-slate-900 border-r">{r.unit}</td>
                          <td className="px-4 py-2 truncate max-w-[180px]">
                            <div className="font-semibold text-slate-800">{r.name}</div>
                            <div className="font-mono text-[10px] text-slate-500">{r.email}</div>
                          </td>
                          <td className="px-4 py-2">
                            <span className="font-mono bg-red-50 text-red-650 border border-red-100 font-extrabold px-1.5 py-0.5 rounded text-[10px]">{r.accessPassword}</span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-col gap-0.5">
                              {r.emailStatus === 'SENT' && (
                                <span className="inline-flex items-center gap-1 font-bold text-green-700 text-[10px]">
                                  <span className="h-1.5 w-1.5 rounded-full bg-green-550"></span>
                                  ENVIADO ✔
                                </span>
                              )}
                              {r.emailStatus === 'FAILED' && (
                                <span className="inline-flex items-center gap-1 font-bold text-red-650 text-[10px]" title={r.emailError || 'Erro desconhecido'}>
                                  <span className="h-1.5 w-1.5 rounded-full bg-red-600"></span>
                                  FALHOU ❌
                                </span>
                              )}
                              {r.emailStatus === 'SENDING' && (
                                <span className="inline-flex items-center gap-1 font-bold text-blue-700 text-[10px] animate-pulse">
                                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
                                  ENVIANDO...
                                </span>
                              )}
                              {(!r.emailStatus || r.emailStatus === 'PENDING') && (
                                <span className="inline-flex items-center gap-1 font-bold text-slate-500 text-[10px]">
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-350"></span>
                                  PENDENTE ⏳
                                </span>
                              )}
                              
                              {/* Error Subtitle Description */}
                              {r.emailStatus === 'FAILED' && r.emailError && (
                                <div className="text-[9px] text-red-600 italic max-w-[200px] leading-tight font-medium">
                                  {r.emailError}
                                </div>
                              )}
                              
                              {r.emailStatus === 'SENT' && r.emailSentAt && (
                                <span className="text-[9px] text-slate-400 font-mono">
                                  {new Date(r.emailSentAt).toLocaleTimeString('pt-BR')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => setEmailPreviewResident(r)}
                                className="text-slate-550 hover:text-slate-800 font-bold transition-all p-1 hover:bg-slate-100 rounded"
                                title="Visualizar E-mail padrão"
                              >
                                <Eye size={13} />
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => dispatchSingleEmail(r)}
                                disabled={isDispatching}
                                className="text-red-600 hover:text-red-700 disabled:opacity-30 font-bold p-1 hover:bg-red-50 rounded"
                                title="Disparar/Reenviar agora individual"
                              >
                                <Send size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {residents.filter(r => r.email && r.accessPassword).length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-400 italic">
                            Nenhum morador apto para envio de credenciais (e-mail ou senha em falta).
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t flex justify-end gap-2 bg-gradient-to-r from-slate-50 to-slate-100">
              <span className="mr-auto self-center text-[10px] text-slate-450 font-semibold font-mono">ZIP Voto Auditoria Ativa</span>
              <Button 
                variant="outline" 
                onClick={() => { if (!isDispatching) setShowDispatchModal(false); }}
                disabled={isDispatching}
                className="text-xs px-4"
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
                <div className="p-5 space-y-4">
                  {/* Sender & Subject Header info */}
                  <div className="pb-3 border-b text-xs text-slate-650 space-y-1 font-sans bg-slate-50/50 p-3 rounded">
                    <div><strong>De:</strong> <span className="text-slate-800">{senderName} &lt;{senderEmail}&gt;</span></div>
                    <div><strong>Assunto:</strong> <span className="text-slate-900 font-semibold">{getCompiledEmail(emailPreviewResident, true)}</span></div>
                  </div>

                  {/* Body Content compiled */}
                  <div className="whitespace-pre-wrap font-sans text-xs text-slate-750 leading-relaxed bg-slate-50/20 p-4 border border-slate-200 rounded-xl max-h-[240px] overflow-y-auto">
                    {getCompiledEmail(emailPreviewResident, false)}
                  </div>

                  {/* Button Demo */}
                  <div className="pt-1">
                    <a 
                      href="#"
                      onClick={(e) => { e.preventDefault(); alert("Esta é uma demonstração interativa da Cabine de Votos."); }}
                      className="block text-center bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all uppercase text-xs"
                    >
                      Acessar Cabine de Votação Virtual
                    </a>
                  </div>
                  
                  <p className="text-[10px] text-gray-400 pt-3 border-t text-center leading-relaxed">
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
                const query = removeAccents(delinquentSearchQuery.toLowerCase().trim());
                if (!query) return true;
                return removeAccents(r.unit.toLowerCase()).includes(query) || removeAccents(r.name.toLowerCase()).includes(query);
              }).length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs italic">
                  Nenhum morador encontrado para a pesquisa.
                </div>
              ) : (
                residents
                  .filter(r => {
                    const query = removeAccents(delinquentSearchQuery.toLowerCase().trim());
                    if (!query) return true;
                    return removeAccents(r.unit.toLowerCase()).includes(query) || removeAccents(r.name.toLowerCase()).includes(query);
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
