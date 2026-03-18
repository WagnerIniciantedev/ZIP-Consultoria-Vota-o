
import { Resident, Poll, VoteRecord, User, AssemblyRecord } from '../types';
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
  ASSEMBLY_START_TIME: 'condovote_assembly_start_time',
  ACTIVE_ASSEMBLIES: 'condovote_active_assemblies',
  LOGS: 'condovote_logs'
};

// Firestore Collections
const ASSEMBLIES_COLLECTION = 'assemblies';
const SYSTEM_COLLECTION = 'system';
const GLOBAL_DOC_ID = 'global';
const USERS_DOC_ID = 'users';
const ACTIVE_ASSEMBLIES_DOC_ID = 'active_assemblies';

const DEFAULT_USERS: User[] = [
  { id: '1', name: 'Administrador', username: 'admin', password: 'admin', role: 'ADMIN' },
  { id: '2', name: 'Wagner Silva', username: 'wagner.silva', password: 'wagner21', role: 'ADMIN' },
  { id: '3', name: 'Fillype Sampaio', username: 'fillype.sampaio', password: 'fellypi123', role: 'ADMIN', jobTitle: 'Administrador' },
  { id: '4', name: 'Zeferino Batista', username: 'zeferino.batista', password: 'zeferino123', role: 'ADMIN', jobTitle: 'Administrador' },
  { id: '5', name: 'Wagner Lima', username: 'wagner.lima', password: 'wagner21', role: 'TI' }
];

const syncToCloud = (key: string, data: any, specificAssemblyId?: string) => {
    if (db) {
        const assemblyId = specificAssemblyId || localStorage.getItem(STORAGE_KEYS.CONDO_NAME) || 'setup';
        const safeKey = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
        
        let fieldName = '';
        if (key === STORAGE_KEYS.POLLS) fieldName = 'polls';
        if (key === STORAGE_KEYS.VOTES) fieldName = 'votes';
        if (key === STORAGE_KEYS.RESIDENTS) fieldName = 'residents';
        if (key === STORAGE_KEYS.IS_ASSEMBLY_ACTIVE) fieldName = 'isActive';
        if (key === STORAGE_KEYS.ASSEMBLY_START_TIME) fieldName = 'startTime';
        if (key === STORAGE_KEYS.CONDO_NAME) fieldName = 'name';
        if (key === STORAGE_KEYS.LOGS) fieldName = 'logs';

        if (fieldName) {
            const cleanData = JSON.parse(JSON.stringify(data));
            const docRef = doc(db, ASSEMBLIES_COLLECTION, safeKey);
            setDoc(docRef, { [fieldName]: cleanData }, { merge: true })
               .catch(err => console.error("Erro Firestore Sync:", err));
        }
    }
};

export const saveSession = (user: User, remember: boolean = true) => {
  if (remember) localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, JSON.stringify(user));
  else sessionStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, JSON.stringify(user));
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
  return data ? JSON.parse(data) : [];
};

export const saveVotes = (votes: VoteRecord[]) => {
  localStorage.setItem(STORAGE_KEYS.VOTES, JSON.stringify(votes));
  syncToCloud(STORAGE_KEYS.VOTES, votes);
};

export const getVotes = (): VoteRecord[] => {
  const data = localStorage.getItem(STORAGE_KEYS.VOTES);
  return data ? JSON.parse(data) : [];
};

export const saveLogs = (logs: any[]) => {
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  syncToCloud(STORAGE_KEYS.LOGS, logs);
};

export const getLogs = (): any[] => {
  const data = localStorage.getItem(STORAGE_KEYS.LOGS);
  return data ? JSON.parse(data) : [];
};

export const addLog = (user: User, action: string, details?: string) => {
  const logs = getLogs();
  const newLog = {
    id: Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    userId: user.id,
    userName: user.name,
    action,
    details,
    assemblyId: localStorage.getItem(STORAGE_KEYS.CONDO_NAME) || 'setup'
  };
  const updatedLogs = [...logs, newLog];
  saveLogs(updatedLogs);
};

export const saveUsers = (users: User[]) => {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  if (db) {
    const usersRef = doc(db, SYSTEM_COLLECTION, USERS_DOC_ID);
    setDoc(usersRef, { list: users }, { merge: true })
      .catch(err => console.error("Erro salvar usuários:", err));
  }
};

export const getUsers = (): User[] => {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  let userList: User[] = data ? JSON.parse(data) : [];
  
  // Garantir que os usuários TI mestre sempre existam na lista
  DEFAULT_USERS.forEach(defUser => {
    if (!userList.some(u => u.username.toLowerCase() === defUser.username.toLowerCase())) {
        userList.push(defUser);
    }
  });

  return userList;
};

// Helper para exportar a lista mestre em caso de falha crítica
export const getMasterSecurityUsers = () => DEFAULT_USERS;

export const saveCondoName = (name: string) => {
  localStorage.setItem(STORAGE_KEYS.CONDO_NAME, name);
  if (name) syncToCloud(STORAGE_KEYS.CONDO_NAME, name);
  if (db && name && name !== 'Modo Administrativo') {
      const globalRef = doc(db, SYSTEM_COLLECTION, GLOBAL_DOC_ID);
      setDoc(globalRef, { active_condo: name }, { merge: true }).catch(e => console.error(e));
  }
};

export const getCondoName = (): string => {
  return localStorage.getItem(STORAGE_KEYS.CONDO_NAME) || '';
};

export const saveActiveAssemblies = (assemblies: any[]) => {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_ASSEMBLIES, JSON.stringify(assemblies));
  if (db) {
    const ref = doc(db, SYSTEM_COLLECTION, ACTIVE_ASSEMBLIES_DOC_ID);
    setDoc(ref, { list: assemblies }, { merge: true })
      .catch(err => console.error("Erro salvar assembleias ativas:", err));
  }
};

export const getActiveAssemblies = (): any[] => {
  const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_ASSEMBLIES);
  return data ? JSON.parse(data) : [];
};

export const saveAssemblies = (assemblies: AssemblyRecord[]) => {
  localStorage.setItem(STORAGE_KEYS.ASSEMBLIES, JSON.stringify(assemblies));
};

export const getAssemblies = (): AssemblyRecord[] => {
  const data = localStorage.getItem(STORAGE_KEYS.ASSEMBLIES);
  return data ? JSON.parse(data) : [];
};

export const clearAllData = async (specificName?: string) => {
  // LIMPA APENAS DADOS DA ASSEMBLEIA, MANTÉM USUÁRIOS
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
         await deleteDoc(doc(db, ASSEMBLIES_COLLECTION, safeKey));
         await setDoc(doc(db, SYSTEM_COLLECTION, GLOBAL_DOC_ID), { active_condo: 'null' }, { merge: true });
     } catch (e) {
         console.error("Erro clearing Firestore:", e);
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
    logs: getLogs(),
    pastAssemblies: getAssemblies(),
    isActive: getAssemblyStatus()
  };
  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `backup_zip_${new Date().toISOString().slice(0,10)}.json`;
  link.click();
};

export const restoreFullBackup = (jsonText: string): boolean => {
  try {
    const data = JSON.parse(jsonText);
    if (data.residents) saveResidents(data.residents);
    if (data.polls) savePolls(data.polls);
    if (data.votes) saveVotes(data.votes);
    if (data.users) saveUsers(data.users);
    if (data.logs) saveLogs(data.logs);
    if (data.condoName) saveCondoName(data.condoName);
    if (data.pastAssemblies) saveAssemblies(data.pastAssemblies);
    if (data.isActive !== undefined) saveAssemblyStatus(data.isActive);
    return true;
  } catch (error) {
    return false;
  }
};

const normalizeName = (name: string) => {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const parseCSV = (csvText: string): Resident[] => {
  const lines = csvText.split('\n');
  const residents: Resident[] = [];
  let startIndex = 0;
  if (lines[0] && (lines[0].toLowerCase().includes('cpf') || lines[0].toLowerCase().includes('unidade'))) startIndex = 1;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const delimiter = line.includes(';') ? ';' : ',';
    const cols = line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length >= 3) {
      residents.push({ 
        unit: cols[1], 
        name: normalizeName(cols[2]), 
        isDelinquent: (cols[3] || '').toUpperCase() === 'SIM', 
        hasHabiteSe: (cols[4] || '').toUpperCase() === 'SIM', 
        fraction: parseFloat((cols[5] || '1').replace(',', '.')) || 1.0,
        cpf: (cols[0] || '').replace(/\D/g, ''), 
        attendanceStatus: 'NONE' 
      });
    }
  }
  return residents;
};

export const exportVotesToCSV = (votes: VoteRecord[], residents: Resident[], poll: Poll) => {
  const headers = ['Unidade', 'Nome', 'Opção Votada', 'Inadimplente', 'Data/Hora'];
  const rows = votes.filter(v => v.pollId === poll.id).map(vote => {
    const r = residents.find(res => res.unit === vote.unit);
    const o = poll.options.find(opt => opt.id === vote.optionId);
    return [vote.unit, r?.name || '?', o?.text || '?', vote.isDelinquentVote ? 'SIM' : 'NÃO', new Date(vote.timestamp).toLocaleString()].join(',');
  });
  const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `resultado_${poll.title}.csv`;
  link.click();
};

export const exportAttendanceCSV = (residents: Resident[], condoName: string) => {
  const headers = ['Unidade', 'Nome', 'Zoom', 'Entrada'];
  const rows = residents.filter(r => r.attendanceStatus === 'APPROVED').map(r => [r.unit, r.name, r.zoomName || '', r.checkInTimestamp ? new Date(r.checkInTimestamp).toLocaleString() : '-'].join(','));
  const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `presenca_${condoName}.csv`;
  link.click();
};
