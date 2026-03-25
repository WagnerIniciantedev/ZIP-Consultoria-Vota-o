
import { Resident, Poll, VoteRecord, User, AssemblyRecord } from '../types';
import { doc, setDoc, deleteDoc, getDoc, collection, query, where, getDocs, getDocFromServer } from 'firebase/firestore';
import { db, auth } from './firebase';

// --- FIRESTORE ERROR HANDLING ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData.map((provider: any) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- CONNECTION TEST ---
export async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("✅ Conexão com Firestore verificada!");
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    } else {
      // Log other errors but don't throw to avoid crashing startup
      console.warn("⚠️ Firestore Connection Test Warning:", error);
    }
  }
}
// testConnection(); // Removed top-level call to prevent potential startup issues

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
  LOGS: 'condovote_logs',
  ASSEMBLY_ID: 'condovote_assembly_id',
  RESIDENT_IDENTITY: 'condovote_my_identity',
  RESIDENT_ZOOM_NAME: 'condovote_my_zoom_name'
};

// Firestore Collections
const ASSEMBLIES_COLLECTION = 'assemblies';
const SYSTEM_COLLECTION = 'system';
const GLOBAL_DOC_ID = 'global';
const USERS_DOC_ID = 'users';
const ACTIVE_ASSEMBLIES_DOC_ID = 'active_assemblies';

const DEFAULT_USERS: User[] = [
  { id: '1', name: 'Administrador', username: 'admin@zipconsultoria.com', password: 'admin', role: 'ADMIN' },
  { id: '2', name: 'Wagner Jackson', username: 'wagner.jackson@zipconsultoria.com', password: 'wagner123', role: 'TI', jobTitle: 'Desenvolvedor' },
  { id: '3', name: 'Fillype Sampaio', username: 'fillype.sampaio@zipconsultoria.com', password: 'fellypi123', role: 'ADMIN', jobTitle: 'Administrador' },
  { id: '4', name: 'Zeferino Batista', username: 'zeferino.batista@zipconsultoria.com', password: 'zeferino123', role: 'ADMIN', jobTitle: 'Administrador' }
];

let isAdminUser = false;

export const setAdminStatus = (status: boolean) => {
  isAdminUser = status;
};

const syncToCloud = (key: string, data: any, specificAssemblyId?: string) => {
    if (db && isAdminUser) {
        const assemblyId = specificAssemblyId || localStorage.getItem(STORAGE_KEYS.ASSEMBLY_ID) || localStorage.getItem(STORAGE_KEYS.CONDO_NAME) || 'setup';
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
               .catch(err => handleFirestoreError(err, OperationType.WRITE, `${ASSEMBLIES_COLLECTION}/${safeKey}`));
        }
    }
};

export const cleanText = (text: string | undefined | null) => {
  if (!text) return "";
  // Remove "Certificado Digital" case-insensitive
  return text.replace(/Certificado Digital/gi, "").trim();
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
  localStorage.removeItem(STORAGE_KEYS.RESIDENT_IDENTITY);
  localStorage.removeItem(STORAGE_KEYS.RESIDENT_ZOOM_NAME);
};

export const saveAssemblyStatus = (isActive: boolean | null) => {
  if (isActive === null) return;
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

export const registerAdminUid = async (uid: string, username: string, role: 'TI' | 'ADMIN' = 'ADMIN') => {
  if (db) {
    const adminRef = doc(db, SYSTEM_COLLECTION, 'authorized_admins', uid);
    try {
      await setDoc(adminRef, { 
        username, 
        role,
        authorizedAt: Date.now(),
        lastLogin: Date.now()
      }, { merge: true });
      console.log(`✅ UID do administrador (${role}) registrado no Firestore`);
    } catch (err) {
      console.warn("⚠️ Falha ao registrar UID do administrador:", err);
    }
  }
};

export const cleanupAnonymousAdmins = async (currentUid: string) => {
  if (db) {
    try {
      const adminsRef = collection(db, SYSTEM_COLLECTION, 'authorized_admins');
      const querySnap = await getDocs(adminsRef);
      
      const deletePromises: Promise<void>[] = [];
      querySnap.forEach((docSnap: any) => {
        // Delete all anonymous admin records except the current one
        if (docSnap.id !== currentUid) {
          deletePromises.push(deleteDoc(doc(db, SYSTEM_COLLECTION, 'authorized_admins', docSnap.id)));
        }
      });
      
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
        console.log(`🧹 Limpeza concluída: ${deletePromises.length} registros de administradores anônimos removidos.`);
      }
    } catch (err) {
      console.warn("⚠️ Falha ao limpar administradores anônimos:", err);
    }
  }
};

export const saveUsers = async (users: User[]) => {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  if (db) {
    const usersRef = doc(db, SYSTEM_COLLECTION, USERS_DOC_ID);
    try {
      // Usamos merge: false para garantir que a lista seja exatamente o que passamos (substituição total)
      await setDoc(usersRef, { 
        list: users,
        lastUpdated: Date.now(),
        updatedBy: getSession()?.username || 'system'
      });
      console.log("✅ Usuários sincronizados com Firestore");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${SYSTEM_COLLECTION}/${USERS_DOC_ID}`);
      throw err;
    }
  }
};

/**
 * Exclui um usuário completamente do sistema, incluindo referências de UID autorizados
 */
export const deleteUserCompletely = async (userId: string, username: string, allUsers: User[]) => {
  // 1. Atualiza a lista local e no Firestore (documento de usuários)
  const updatedUsers = allUsers.filter(u => u.id !== userId);
  await saveUsers(updatedUsers);

  // 2. Limpa o UID autorizado no Firestore se existir
  if (db) {
    try {
      const adminsRef = collection(db, SYSTEM_COLLECTION, 'authorized_admins');
      // Buscamos pelo username (sem o domínio se for o caso, mas aqui usamos o username completo salvo)
      const q = query(adminsRef, where("username", "==", username.split('@')[0].toLowerCase()));
      const querySnap = await getDocs(q);
      
      const deletePromises: Promise<void>[] = [];
      querySnap.forEach((docSnap) => {
        deletePromises.push(deleteDoc(doc(db, SYSTEM_COLLECTION, 'authorized_admins', docSnap.id)));
      });
      
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
        console.log(`🧹 Removidos ${deletePromises.length} registros de UID autorizados para o usuário ${username}`);
      }
    } catch (err) {
      console.warn("⚠️ Falha ao limpar UID autorizado do usuário excluído:", err);
    }
  }
  
  return updatedUsers;
};

export const getUsers = (): User[] => {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  if (data) {
    return JSON.parse(data);
  }
  
  // Se não houver nada no localStorage, usamos os padrões (primeira inicialização)
  return DEFAULT_USERS;
};

// Helper para exportar a lista mestre em caso de falha crítica
export const getMasterSecurityUsers = () => DEFAULT_USERS;

export const saveCondoName = (name: string) => {
  localStorage.setItem(STORAGE_KEYS.CONDO_NAME, name);
  if (name && isAdminUser) syncToCloud(STORAGE_KEYS.CONDO_NAME, name);
  if (db && name && name !== 'Modo Administrativo' && isAdminUser) {
      const globalRef = doc(db, SYSTEM_COLLECTION, GLOBAL_DOC_ID);
      setDoc(globalRef, { active_condo: name }, { merge: true })
        .catch(err => handleFirestoreError(err, OperationType.WRITE, `${SYSTEM_COLLECTION}/${GLOBAL_DOC_ID}`));
  }
};

export const getCondoName = (): string => {
  return localStorage.getItem(STORAGE_KEYS.CONDO_NAME) || '';
};

export const saveAssemblyId = (id: string) => {
  localStorage.setItem(STORAGE_KEYS.ASSEMBLY_ID, id);
};

export const getAssemblyId = (): string => {
  return localStorage.getItem(STORAGE_KEYS.ASSEMBLY_ID) || '';
};

export const identifyResident = async (assemblyId: string, unit: string, cpfPart: string): Promise<{ resident: Resident | null, siblings: Resident[] }> => {
  if (!db || !assemblyId) return { resident: null, siblings: [] };

  const safeAssemblyId = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
  
  try {
    // 1. Try to get the specific unit
    const residentRef = doc(db, ASSEMBLIES_COLLECTION, safeAssemblyId, 'residents_list', unit.toLowerCase());
    const snap = await getDoc(residentRef);
    
    if (!snap.exists()) return { resident: null, siblings: [] };
    
    const resident = snap.data() as Resident;
    
    // 2. Validate CPF (first 5 digits)
    const recordCpf = (resident.cpf || '').replace(/\D/g, '');
    if (!recordCpf.startsWith(cpfPart)) {
      return { resident: null, siblings: [] };
    }

    // 3. Find siblings (other units with same CPF)
    const residentsRef = collection(db, ASSEMBLIES_COLLECTION, safeAssemblyId, 'residents_list');
    const q = query(residentsRef, where("cpf", "==", resident.cpf));
    const querySnap = await getDocs(q);
    
    const siblings: Resident[] = [];
    querySnap.forEach((doc: any) => {
      siblings.push(doc.data() as Resident);
    });

    return { resident, siblings };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${ASSEMBLIES_COLLECTION}/${safeAssemblyId}/residents_list`);
    return { resident: null, siblings: [] };
  }
};

export const saveActiveAssemblies = (assemblies: any[]) => {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_ASSEMBLIES, JSON.stringify(assemblies));
  if (db) {
    const ref = doc(db, SYSTEM_COLLECTION, ACTIVE_ASSEMBLIES_DOC_ID);
    setDoc(ref, { list: assemblies }, { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.WRITE, `${SYSTEM_COLLECTION}/${ACTIVE_ASSEMBLIES_DOC_ID}`));
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
         handleFirestoreError(e, OperationType.DELETE, `${ASSEMBLIES_COLLECTION}/${safeKey}`);
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

const normalizeString = (str: string) => {
  if (!str) return "";
  // Remove accents/diacritics and convert to standard characters
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "") // Remove any remaining non-ASCII characters
    .trim();
};

export const parseCSV = (csvText: string): Resident[] => {
  // Clean potential BOM or weird start characters
  const cleanText = csvText.replace(/^\uFEFF/, '').trim();
  const lines = cleanText.split(/\r?\n/);
  const residents: Resident[] = [];
  
  // Detect header
  let startIndex = 0;
  if (lines[0]) {
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('cpf') || firstLine.includes('unidade') || firstLine.includes('nome')) {
      startIndex = 1;
    }
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Support both semicolon and comma as delimiters
    const delimiter = line.includes(';') ? ';' : ',';
    const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    
    if (cols.length >= 3) {
      residents.push({ 
        unit: normalizeString(cols[1]), 
        name: normalizeString(cols[2]).toUpperCase(), // Standardize names to uppercase
        isDelinquent: (cols[3] || '').toUpperCase().trim() === 'SIM', 
        hasHabiteSe: (cols[4] || '').toUpperCase().trim() === 'SIM', 
        fraction: parseFloat((cols[5] || '1').replace(',', '.')) || 1.0,
        cpf: (cols[0] || '').replace(/\D/g, ''), 
        attendanceStatus: 'NONE',
        proxyCount: parseInt((cols[6] || '0').trim(), 10) || 0,
        proxyUnits: (cols[7] || '').trim()
      });
    }
  }
  return residents;
};

export const exportVotesToCSV = (votes: VoteRecord[], residents: Resident[], poll: Poll) => {
  const headers = ['UNIDADE', 'NOME', 'NOME ZOOM', 'OPCAO VOTADA', 'INADIMPLENTE', 'DATA/HORA'];
  const pollVotes = votes.filter(v => v.pollId === poll.id);
  
  const rows = pollVotes.map(vote => {
    const r = residents.find(res => res.unit === vote.unit);
    const o = poll.options.find(opt => opt.id === vote.optionId);
    
    const unit = (vote.unit || '').toUpperCase();
    const name = (r?.name || '?').toUpperCase();
    const zoomName = (vote.zoomName || '-').toUpperCase();
    const option = (o?.text || '?').toUpperCase();
    const isDelinquent = vote.isDelinquentVote ? 'SIM' : 'NAO';
    const date = new Date(vote.timestamp).toLocaleString().toUpperCase();
    
    return [unit, name, zoomName, option, isDelinquent, date].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `RESULTADO_${poll.title.toUpperCase().replace(/\s+/g, '_')}.csv`;
  link.click();
};

export const exportAttendanceCSV = (residents: Resident[], condoName: string) => {
  const headers = ['UNIDADE', 'NOME', 'ZOOM', 'ENTRADA'];
  const approvedResidents = residents.filter(r => r.attendanceStatus === 'APPROVED');
  
  const rows = approvedResidents.map(r => {
    const unit = (r.unit || '').toUpperCase();
    const name = (r.name || '').toUpperCase();
    const zoom = (r.zoomName || '').toUpperCase();
    const entry = r.checkInTimestamp ? new Date(r.checkInTimestamp).toLocaleString().toUpperCase() : '-';
    
    return [unit, name, zoom, entry].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `PRESENCA_${condoName.toUpperCase().replace(/\s+/g, '_')}.csv`;
  link.click();
};
