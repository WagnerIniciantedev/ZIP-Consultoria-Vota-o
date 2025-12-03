
import { Resident, Poll, VoteRecord, PollCalculationType, User, AssemblyRecord } from '../types';
import { db, doc, setDoc, deleteDoc } from './firebase';

const STORAGE_KEYS = {
  RESIDENTS: 'condovote_residents',
  POLLS: 'condovote_polls',
  VOTES: 'condovote_votes',
  USERS: 'condovote_users',
  ADMIN_AUTH: 'condovote_admin_auth',
  CONDO_NAME: 'condovote_condo_name',
  ASSEMBLIES: 'condovote_assemblies_history',
  IS_ASSEMBLY_ACTIVE: 'condovote_is_active',
  ASSEMBLY_START_TIME: 'condovote_assembly_start_time'
};

// Firestore Collections
const ASSEMBLIES_COLLECTION = 'assemblies';
const SYSTEM_COLLECTION = 'system';
const GLOBAL_DOC_ID = 'global';
const USERS_DOC_ID = 'users';

// --- CLOUD SYNC HELPERS (FIRESTORE VERSION) ---

const syncToCloud = (key: string, data: any) => {
    if (db) {
        const condoName = localStorage.getItem(STORAGE_KEYS.CONDO_NAME) || 'setup';
        const safeKey = condoName.replace(/[^a-zA-Z0-9]/g, '_');
        
        // Mapeia a chave de storage para o campo dentro do documento do condomínio
        let fieldName = '';
        if (key === STORAGE_KEYS.POLLS) fieldName = 'polls';
        if (key === STORAGE_KEYS.VOTES) fieldName = 'votes';
        if (key === STORAGE_KEYS.RESIDENTS) fieldName = 'residents';
        if (key === STORAGE_KEYS.IS_ASSEMBLY_ACTIVE) fieldName = 'isActive';
        if (key === STORAGE_KEYS.ASSEMBLY_START_TIME) fieldName = 'startTime';
        if (key === STORAGE_KEYS.CONDO_NAME) fieldName = 'name';

        if (fieldName) {
            // Firestore: Update specific field in the document 'assemblies/{safeKey}'
            const docRef = doc(db, ASSEMBLIES_COLLECTION, safeKey);
            // merge: true garante que não sobrescrevemos outros campos (ex: salvar votos não apaga enquetes)
            setDoc(docRef, { [fieldName]: data }, { merge: true })
               .catch(err => console.error("Erro ao sincronizar Firestore:", err));
        }
    }
};

// --------------------------------

export const saveSession = (user: User, remember: boolean = true) => {
  if (remember) {
    localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, JSON.stringify(user));
  } else {
    sessionStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, JSON.stringify(user));
  }
};

export const getSession = (): User | null => {
  const localData = localStorage.getItem(STORAGE_KEYS.ADMIN_AUTH);
  if (localData) return JSON.parse(localData);

  const sessionData = sessionStorage.getItem(STORAGE_KEYS.ADMIN_AUTH);
  if (sessionData) return JSON.parse(sessionData);

  return null;
};

export const clearSession = () => {
  localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
  sessionStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
};

export const saveAssemblyStatus = (isActive: boolean) => {
  localStorage.setItem(STORAGE_KEYS.IS_ASSEMBLY_ACTIVE, JSON.stringify(isActive));
  syncToCloud(STORAGE_KEYS.IS_ASSEMBLY_ACTIVE, isActive);
};

export const getAssemblyStatus = (): boolean => {
  const data = localStorage.getItem(STORAGE_KEYS.IS_ASSEMBLY_ACTIVE);
  return data ? JSON.parse(data) : false;
};

export const saveAssemblyStartTime = (timestamp: number) => {
  localStorage.setItem(STORAGE_KEYS.ASSEMBLY_START_TIME, timestamp.toString());
  syncToCloud(STORAGE_KEYS.ASSEMBLY_START_TIME, timestamp);
};

export const getAssemblyStartTime = (): number => {
  const data = localStorage.getItem(STORAGE_KEYS.ASSEMBLY_START_TIME);
  return data ? parseInt(data) : 0;
};

export const saveResidents = (residents: Resident[]) => {
  localStorage.setItem(STORAGE_KEYS.RESIDENTS, JSON.stringify(residents));
  syncToCloud(STORAGE_KEYS.RESIDENTS, residents);
};

export const getResidents = (): Resident[] => {
  const data = localStorage.getItem(STORAGE_KEYS.RESIDENTS);
  return data ? JSON.parse(data) : [];
};

export const savePolls = (polls: Poll[]) => {
  localStorage.setItem(STORAGE_KEYS.POLLS, JSON.stringify(polls));
  syncToCloud(STORAGE_KEYS.POLLS, polls);
};

export const getPolls = (): Poll[] => {
  const data = localStorage.getItem(STORAGE_KEYS.POLLS);
  if (data) {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed) && parsed.title) {
       return [{...parsed, id: parsed.id || 'legacy-id', calculationType: PollCalculationType.NORMAL}];
    }
    return parsed;
  }
  return [];
};

export const saveVotes = (votes: VoteRecord[]) => {
  localStorage.setItem(STORAGE_KEYS.VOTES, JSON.stringify(votes));
  syncToCloud(STORAGE_KEYS.VOTES, votes);
};

export const getVotes = (): VoteRecord[] => {
  const data = localStorage.getItem(STORAGE_KEYS.VOTES);
  return data ? JSON.parse(data) : [];
};

export const saveUsers = (users: User[]) => {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  // Users Sync to Firestore (Global System Collection)
  if (db) {
    const usersRef = doc(db, SYSTEM_COLLECTION, USERS_DOC_ID);
    setDoc(usersRef, { list: users }, { merge: true })
      .catch(err => console.error("Erro ao salvar usuários no Firestore:", err));
  }
};

export const getUsers = (): User[] => {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  if (data) {
    return JSON.parse(data);
  }
  const defaultUsers: User[] = [
    { id: '1', name: 'Administrador', username: 'admin', password: 'admin', role: 'ADMIN' },
    { id: '2', name: 'Wagner Silva', username: 'wagner.silva', password: 'wagner21', role: 'TI' },
    { id: '3', name: 'Fillype Sampaio', username: 'fillype.sampaio', password: 'fellypi123', role: 'ADMIN', jobTitle: 'Administrador' },
    { id: '4', name: 'Zeferino Batista', username: 'zeferino.batista', password: 'zeferino123', role: 'ADMIN', jobTitle: 'Administrador' },
    { id: '5', name: 'Wagner Lima', username: 'wagner.lima', password: 'wagner21', role: 'TI' }
  ];
  return defaultUsers;
};

export const saveCondoName = (name: string) => {
  localStorage.setItem(STORAGE_KEYS.CONDO_NAME, name);
  syncToCloud(STORAGE_KEYS.CONDO_NAME, name);
  
  // Atualiza o "ponteiro global" no Firestore
  if (db && name && name !== 'Modo Administrativo') {
      const globalRef = doc(db, SYSTEM_COLLECTION, GLOBAL_DOC_ID);
      setDoc(globalRef, { active_condo: name }, { merge: true })
        .catch(e => console.error(e));
  }
};

export const getCondoName = (): string => {
  return localStorage.getItem(STORAGE_KEYS.CONDO_NAME) || '';
};

export const saveAssemblies = (assemblies: AssemblyRecord[]) => {
  localStorage.setItem(STORAGE_KEYS.ASSEMBLIES, JSON.stringify(assemblies));
};

export const getAssemblies = (): AssemblyRecord[] => {
  const data = localStorage.getItem(STORAGE_KEYS.ASSEMBLIES);
  return data ? JSON.parse(data) : [];
};

export const clearAllData = async (specificName?: string) => {
  localStorage.removeItem(STORAGE_KEYS.RESIDENTS);
  localStorage.removeItem(STORAGE_KEYS.POLLS);
  localStorage.removeItem(STORAGE_KEYS.VOTES);
  localStorage.removeItem(STORAGE_KEYS.CONDO_NAME);
  localStorage.removeItem(STORAGE_KEYS.IS_ASSEMBLY_ACTIVE);
  localStorage.removeItem(STORAGE_KEYS.ASSEMBLY_START_TIME);
  
  if (db) {
     const nameToClear = specificName || localStorage.getItem(STORAGE_KEYS.CONDO_NAME) || 'setup';
     const safeKey = nameToClear.replace(/[^a-zA-Z0-9]/g, '_');
     
     try {
         // 1. Delete the specific assembly document
         await deleteDoc(doc(db, ASSEMBLIES_COLLECTION, safeKey));
         
         // 2. Clear global pointer if needed
         await setDoc(doc(db, SYSTEM_COLLECTION, GLOBAL_DOC_ID), { active_condo: null }, { merge: true });
     } catch (e) {
         console.error("Error clearing Firestore:", e);
     }
  }
};

export const generateFullBackup = () => {
  const backupData = {
    version: '1.0',
    timestamp: Date.now(),
    condoName: getCondoName(),
    residents: getResidents(),
    polls: getPolls(),
    votes: getVotes(),
    users: getUsers(),
    pastAssemblies: getAssemblies(),
    isActive: getAssemblyStatus()
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  const safeName = (backupData.condoName || 'sistema').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  link.download = `backup_zip_consultoria_${safeName}_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const restoreFullBackup = (jsonText: string): boolean => {
  try {
    const data = JSON.parse(jsonText);
    
    if (!data.users || !Array.isArray(data.users)) {
      throw new Error("Formato de backup inválido (Users missing)");
    }

    if (data.residents) saveResidents(data.residents);
    if (data.polls) savePolls(data.polls);
    if (data.votes) saveVotes(data.votes);
    if (data.users) saveUsers(data.users);
    if (data.condoName) saveCondoName(data.condoName);
    if (data.pastAssemblies) saveAssemblies(data.pastAssemblies);
    if (data.isActive !== undefined) saveAssemblyStatus(data.isActive);

    return true;
  } catch (error) {
    console.error("Backup restore failed:", error);
    return false;
  }
};

export const parseCSV = (csvText: string): Resident[] => {
  const lines = csvText.split('\n');
  const residents: Resident[] = [];

  let startIndex = 0;
  if (lines[0] && (lines[0].toLowerCase().includes('cpf') || lines[0].toLowerCase().includes('unidade'))) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const delimiter = line.includes(';') ? ';' : ',';
    const cols = line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));

    if (cols.length >= 3) {
      const cpfRaw = cols[0] || '';
      const cpf = cpfRaw.replace(/\D/g, ''); 
      const unit = cols[1];
      const name = cols[2];
      
      const isDelinquentStr = cols[3] ? cols[3].toUpperCase() : 'NÃO';
      const isDelinquent = isDelinquentStr === 'SIM' || isDelinquentStr === 'YES' || isDelinquentStr === 'TRUE';
      
      const hasHabiteSeStr = cols[4] ? cols[4].toUpperCase() : 'NÃO';
      const hasHabiteSe = hasHabiteSeStr === 'SIM' || hasHabiteSeStr === 'YES' || hasHabiteSeStr === 'TRUE';

      let fraction = 1.0;
      if (cols.length > 5 && cols[5]) {
        const cleanNum = cols[5].replace(',', '.');
        const parsed = parseFloat(cleanNum);
        if (!isNaN(parsed)) fraction = parsed;
      }

      residents.push({ 
        unit, 
        name, 
        isDelinquent, 
        hasHabiteSe, 
        fraction,
        cpf, 
        attendanceStatus: 'NONE' 
      });
    }
  }
  return residents;
};

export const exportVotesToCSV = (votes: VoteRecord[], residents: Resident[], poll: Poll) => {
  const headers = ['Unidade', 'Nome', 'CPF', 'Inadimplente', 'Habite-se', 'Fração', 'Opção Votada', 'Peso do Voto', 'Contabilizado', 'Data/Hora'];
  
  const pollVotes = votes.filter(v => v.pollId === poll.id);

  const rows = pollVotes.map(vote => {
    const resident = residents.find(r => r.unit === vote.unit);
    const option = poll.options.find(o => o.id === vote.optionId);
    
    let voteWeight = 0;
    if (!vote.isDelinquentVote && resident) {
      if (poll.calculationType === PollCalculationType.FRACTION) {
        voteWeight = resident.fraction;
      } else if (poll.calculationType === PollCalculationType.HABITE_SE) {
        voteWeight = 1 + (resident.hasHabiteSe ? 1 : 0);
      } else {
        voteWeight = 1;
      }
    }

    return [
      vote.unit,
      resident ? resident.name : 'Desconhecido',
      resident?.cpf ? resident.cpf : '',
      vote.isDelinquentVote ? 'SIM' : 'NÃO',
      resident?.hasHabiteSe ? 'SIM' : 'NÃO',
      resident?.fraction?.toString().replace('.', ',') || '0',
      option ? option.text : 'Erro',
      voteWeight.toString().replace('.', ','),
      vote.isDelinquentVote ? 'NÃO' : 'SIM',
      new Date(vote.timestamp).toLocaleString('pt-BR')
    ].map(field => `"${field}"`).join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `resultado_${poll.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportAttendanceCSV = (residents: Resident[], condoName: string) => {
  const headers = ['Unidade', 'Nome do Proprietário', 'CPF', 'Nome no Zoom', 'Horário de Entrada', 'Status'];
  const presentResidents = residents.filter(r => r.attendanceStatus === 'APPROVED');

  const rows = presentResidents.map(r => {
    return [
      r.unit,
      r.name,
      r.cpf ? r.cpf : '',
      r.zoomName || '',
      r.checkInTimestamp ? new Date(r.checkInTimestamp).toLocaleString('pt-BR') : '-',
      'PRESENTE (APROVADO)'
    ].map(field => `"${field}"`).join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const safeName = condoName ? condoName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'condominio';
  link.setAttribute('download', `lista_presenca_${safeName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
