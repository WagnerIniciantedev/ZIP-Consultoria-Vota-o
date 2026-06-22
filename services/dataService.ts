
import { Resident, Poll, VoteRecord, User, AssemblyRecord, ErrorLog, DelinquencyModification } from '../types';
import { doc, setDoc, deleteDoc, getDoc, collection, query, where, getDocs, getDocFromServer, arrayUnion } from 'firebase/firestore';
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

let isLoggingError = false;
let errorThrottle = {
  count: 0,
  lastTime: 0
};

export function safeStringify(value: any, space?: string | number): string {
  const seen = new WeakSet();
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object') {
      if (seen.has(val)) {
        return undefined; // skip circular reference
      }
      seen.add(val);
      
      // Prevent serialization of Firestore/Firebase instances or other SDK internals
      const proto = Object.getPrototypeOf(val);
      if (proto && proto !== Object.prototype && proto !== Array.prototype) {
        if (
          val.firestore || 
          val._firestore || 
          val._database || 
          val._delegate ||
          val.constructor?.name === 'Y2' ||
          val.constructor?.name === 'Ka' ||
          (val.constructor && 
           val.constructor.name !== 'Object' && 
           val.constructor.name !== 'Array' &&
           (val.constructor.name.length <= 3 || 
            val.constructor.name.includes('Firestore') || 
            val.constructor.name.includes('Firebase') ||
            val.constructor.name.includes('Auth')))
        ) {
          return undefined; // skip Firestore / Firebase / Auth complex objects
        }
      }
    }
    return val;
  }, space);
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const now = Date.now();
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Stop immediately if it's a quota error to prevent further damage
  if (errorMessage.includes('resource-exhausted') || errorMessage.includes('Quota exceeded')) {
    console.error("❌ CRITICAL: Firestore Quota Exceeded. Stopping all cloud operations.");
    isCloudRegistered = false; // Disable further syncs
    throw new Error("QUOTA_DEATH");
  }
  
  // Throttle errors: if more than 5 errors in 10 seconds, stop logging to Firestore
  if (now - errorThrottle.lastTime < 10000) {
    errorThrottle.count++;
  } else {
    errorThrottle.count = 1;
    errorThrottle.lastTime = now;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
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
  
  console.error('Firestore Error: ', safeStringify(errInfo));

  // Prevent infinite loop if logging the error itself fails
  if (!isLoggingError && errorThrottle.count <= 5 && !errorMessage.includes('permission-denied')) {
    isLoggingError = true;
    const errorLog: ErrorLog = {
      id: `err_${now}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now,
      error: errInfo.error,
      operationType: errInfo.operationType,
      path: errInfo.path,
      userId: errInfo.authInfo.userId,
      userName: auth?.currentUser?.displayName || 'Desconhecido'
    };
    
    // Save to Firestore if possible
    if (db && isAdminUser && isCloudRegistered) {
      const errorRef = doc(db, SYSTEM_COLLECTION, 'error_logs');
      // Use arrayUnion to avoid getDoc read
      setDoc(errorRef, { 
        logs: arrayUnion(errorLog),
        lastUpdated: now
      }, { merge: true })
        .catch(e => console.error("Failed to save error log to Firestore:", e))
        .finally(() => { isLoggingError = false; });
    } else {
      isLoggingError = false;
    }
  }

  throw new Error(safeStringify(errInfo));
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
  { id: '1', name: 'Wagner Silva', username: 'wagner.silva', password: 'wagner123', role: 'TI', jobTitle: 'Administrador TI' }
];

let isAdminUser = false;
let isCloudRegistered = false;

export const setAdminStatus = (status: boolean) => {
  isAdminUser = status;
  if (!status) isCloudRegistered = false;
};

export const clearAdminStatus = () => {
  isAdminUser = false;
  isCloudRegistered = false;
};

const syncToCloud = (key: string, data: any, specificAssemblyId?: string) => {
    if (db && isAdminUser && isCloudRegistered) {
        const assemblyId = specificAssemblyId || localStorage.getItem(STORAGE_KEYS.ASSEMBLY_ID) || localStorage.getItem(STORAGE_KEYS.CONDO_NAME) || 'setup';
        const safeKey = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
        
        let fieldName = '';
        if (key === STORAGE_KEYS.POLLS) fieldName = 'polls';
        if (key === STORAGE_KEYS.VOTES) fieldName = 'votes';
        if (key === STORAGE_KEYS.RESIDENTS) fieldName = 'residents';
        if (key === STORAGE_KEYS.IS_ASSEMBLY_ACTIVE) fieldName = 'isActive';
        if (key === STORAGE_KEYS.ASSEMBLY_START_TIME) fieldName = 'startTime';
        if (key === STORAGE_KEYS.CONDO_NAME) fieldName = 'name';

        if (fieldName && fieldName !== 'residents' && fieldName !== 'votes') {
            try {
                // Use the ultra-robust safeStringify to avoid circular reference and Firebase leaks
                const cleanData = JSON.parse(safeStringify(data));
                const docRef = doc(db, ASSEMBLIES_COLLECTION, safeKey);
                setDoc(docRef, { [fieldName]: cleanData }, { merge: true })
                   .catch(err => handleFirestoreError(err, OperationType.WRITE, `${ASSEMBLIES_COLLECTION}/${safeKey}`));
            } catch (e) {
                console.error(`[syncToCloud] Critical error cleaning data for ${fieldName}:`, e);
                // If JSON.stringify fails, we try a simpler approach for non-objects
                if (typeof data !== 'object') {
                   const docRef = doc(db, ASSEMBLIES_COLLECTION, safeKey);
                   setDoc(docRef, { [fieldName]: data }, { merge: true })
                      .catch(err => handleFirestoreError(err, OperationType.WRITE, `${ASSEMBLIES_COLLECTION}/${safeKey}`));
                }
            }
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

export const saveLogs = (logs: any[], syncToCloud: boolean = true) => {
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  if (syncToCloud && db && isAdminUser && isCloudRegistered) {
    const ref = doc(db, SYSTEM_COLLECTION, 'logs');
    setDoc(ref, { 
      list: logs, 
      lastUpdated: Date.now(),
      updatedBy: getSession()?.username || 'system'
    }, { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.WRITE, `${SYSTEM_COLLECTION}/logs`));
  }
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
    // Agora 'authorized_admins' é uma coleção de nível superior para evitar erros de segmentos ímpares
    const adminRef = doc(db, 'authorized_admins', uid);
    try {
      await setDoc(adminRef, { 
        username: username.toLowerCase(), 
        role,
        authorizedAt: Date.now(),
        lastLogin: Date.now()
      }, { merge: true });
      isCloudRegistered = true;
      console.log(`✅ UID do administrador (${role}) registrado no Firestore`);
    } catch (err) {
      console.warn("⚠️ Falha ao registrar UID do administrador:", err);
    }
  }
};

export const cleanupAnonymousAdmins = async (currentUid: string) => {
  if (db) {
    try {
      const adminsRef = collection(db, 'authorized_admins');
      const querySnap = await getDocs(adminsRef);
      
      const deletePromises: Promise<void>[] = [];
      querySnap.forEach((docSnap: any) => {
        // Delete all anonymous admin records except the current one
        if (docSnap.id !== currentUid) {
          deletePromises.push(deleteDoc(doc(db, 'authorized_admins', docSnap.id)));
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

export const saveUsers = async (users: User[], syncToCloud: boolean = true) => {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  if (syncToCloud && db && isAdminUser && isCloudRegistered) {
    const usersRef = doc(db, SYSTEM_COLLECTION, USERS_DOC_ID);
    const rolesRef = doc(db, SYSTEM_COLLECTION, 'roles');
    
    try {
      // 1. Sincroniza a lista completa de usuários
      await setDoc(usersRef, { 
        list: users,
        lastUpdated: Date.now(),
        updatedBy: getSession()?.username || 'system'
      });

      // 2. Sincroniza um mapa de username -> role para as regras do Firestore
      const rolesMap: Record<string, string> = {};
      users.forEach(u => {
        if (u.username && u.role) {
          rolesMap[u.username.toLowerCase()] = u.role;
        }
      });
      
      await setDoc(rolesRef, rolesMap);
      
      console.log("✅ Usuários e papéis sincronizados com Firestore");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${SYSTEM_COLLECTION}/${USERS_DOC_ID}`);
      throw err;
    }
  }
};

/**
 * Exclui um usuário completamente do sistema, incluindo referências de UID autorizados e logs
 */
export const deleteUserCompletely = async (userId: string, username: string, allUsers: User[]) => {
  // 1. Atualiza a lista local e no Firestore (documento de usuários)
  const updatedUsers = allUsers.filter(u => u.id !== userId);
  await saveUsers(updatedUsers);

  // 2. Limpa o UID autorizado no Firestore se existir
  if (db) {
    try {
      const adminsRef = collection(db, 'authorized_admins');
      // Buscamos pelo username completo (sem prefixo conforme solicitado)
      const q = query(adminsRef, where("username", "==", username.toLowerCase()));
      const querySnap = await getDocs(q);
      
      const deletePromises: Promise<void>[] = [];
      querySnap.forEach((docSnap) => {
        deletePromises.push(deleteDoc(doc(db, 'authorized_admins', docSnap.id)));
      });
      
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
        console.log(`🧹 Removidos ${deletePromises.length} registros de UID autorizados para o usuário ${username}`);
      }

      // 3. Limpa logs globais associados a este usuário
      const logs = getLogs();
      const filteredLogs = logs.filter(l => l.userId !== userId);
      if (filteredLogs.length !== logs.length) {
        await saveLogs(filteredLogs);
        console.log(`🧹 Removidos ${logs.length - filteredLogs.length} registros de log para o usuário ${username}`);
      }
    } catch (err) {
      console.warn("⚠️ Falha ao limpar dados do usuário excluído:", err);
    }
  }
  
  return updatedUsers;
};

export const getUsers = (): User[] => {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  let users: User[] = [];
  
  if (data) {
    try {
      users = JSON.parse(data);
    } catch (e) {
      users = DEFAULT_USERS;
    }
  } else {
    users = DEFAULT_USERS;
  }

  // Retornamos todos os usuários sem filtro para que os novos apareçam
  return users;
};

// Helper para exportar a lista mestre em caso de falha crítica
export const getMasterSecurityUsers = () => DEFAULT_USERS;

export const getErrorLogs = async (): Promise<ErrorLog[]> => {
  if (db && isAdminUser && isCloudRegistered) {
    try {
      const errorRef = doc(db, SYSTEM_COLLECTION, 'error_logs');
      const docSnap = await getDoc(errorRef);
      if (docSnap.exists()) {
        return docSnap.data().logs || [];
      }
    } catch (error) {
      console.error("Error fetching error logs:", error);
    }
  }
  return [];
};

export const clearErrorLogs = async () => {
  if (db && isAdminUser && isCloudRegistered) {
    try {
      const errorRef = doc(db, SYSTEM_COLLECTION, 'error_logs');
      await setDoc(errorRef, { logs: [] }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SYSTEM_COLLECTION}/error_logs`);
    }
  }
};

export const saveCondoName = (name: string) => {
  localStorage.setItem(STORAGE_KEYS.CONDO_NAME, name);
  if (name && isAdminUser) syncToCloud(STORAGE_KEYS.CONDO_NAME, name);
  if (db && name && name !== 'Modo Administrativo' && isAdminUser && isCloudRegistered) {
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

export const identifyResidentWithPassword = async (assemblyId: string, unit: string, passwordPart: string): Promise<{
  resident: Resident | null,
  siblings: Resident[],
  proxyOwners: Record<string, Resident>
}> => {
  if (!assemblyId) return { resident: null, siblings: [], proxyOwners: {} };

  // Fallback to local storage if Firestore isn't connected or configured yet
  if (!db) {
    const list = getResidents();
    const resident = list.find(r => r.unit.toLowerCase() === unit.toLowerCase() && (r.accessPassword || '').trim().toUpperCase() === passwordPart.trim().toUpperCase());
    if (!resident) return { resident: null, siblings: [], proxyOwners: {} };
    
    // Check siblings in local
    const siblings = list.filter(r => r.cpf === resident.cpf);
    const proxyOwners: Record<string, Resident> = {};
    for (const sib of siblings) {
      if (sib.proxyOwnerUnit) {
        const owner = list.find(r => r.unit.toLowerCase() === sib.proxyOwnerUnit?.toLowerCase());
        if (owner) proxyOwners[sib.unit] = owner;
      }
    }
    return { resident, siblings, proxyOwners };
  }

  const safeAssemblyId = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
  
  try {
    const residentRef = doc(db, ASSEMBLIES_COLLECTION, safeAssemblyId, 'residents_list', unit.toLowerCase());
    const snap = await getDoc(residentRef);
    
    if (!snap.exists()) return { resident: null, siblings: [], proxyOwners: {} };
    
    const resident = snap.data() as Resident;
    
    const recordPassword = (resident.accessPassword || '').trim().toUpperCase();
    const inputPassword = passwordPart.trim().toUpperCase();
    
    if (recordPassword !== inputPassword) {
      return { resident: null, siblings: [], proxyOwners: {} };
    }

    const residentsRef = collection(db, ASSEMBLIES_COLLECTION, safeAssemblyId, 'residents_list');
    const q = query(residentsRef, where("cpf", "==", resident.cpf));
    const querySnap = await getDocs(q);
    
    const siblings: Resident[] = [];
    const proxyOwners: Record<string, Resident> = {};

    for (const docSnap of querySnap.docs) {
      const sib = docSnap.data() as Resident;
      siblings.push(sib);
      
      if (sib.proxyOwnerUnit) {
        const ownerRef = doc(db, ASSEMBLIES_COLLECTION, safeAssemblyId, 'residents_list', sib.proxyOwnerUnit.toLowerCase());
        const ownerSnap = await getDoc(ownerRef);
        if (ownerSnap.exists()) {
          proxyOwners[sib.unit] = ownerSnap.data() as Resident;
        }
      }
    }

    return { resident, siblings, proxyOwners };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${ASSEMBLIES_COLLECTION}/${safeAssemblyId}/residents_list`);
    return { resident: null, siblings: [], proxyOwners: {} };
  }
};

export const identifyResident = async (assemblyId: string, unit: string, cpfPart: string): Promise<{ 
  resident: Resident | null, 
  siblings: Resident[],
  proxyOwners: Record<string, Resident> 
}> => {
  if (!db || !assemblyId) return { resident: null, siblings: [], proxyOwners: {} };

  const safeAssemblyId = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
  
  try {
    // 1. Try to get the specific unit
    const residentRef = doc(db, ASSEMBLIES_COLLECTION, safeAssemblyId, 'residents_list', unit.toLowerCase());
    const snap = await getDoc(residentRef);
    
    if (!snap.exists()) return { resident: null, siblings: [], proxyOwners: {} };
    
    const resident = snap.data() as Resident;
    
    // 2. Validate CPF (first 5 digits)
    const recordCpf = (resident.cpf || '').replace(/\D/g, '');
    if (!recordCpf.startsWith(cpfPart)) {
      return { resident: null, siblings: [], proxyOwners: {} };
    }

    // 3. Find siblings (other units with same CPF)
    const residentsRef = collection(db, ASSEMBLIES_COLLECTION, safeAssemblyId, 'residents_list');
    const q = query(residentsRef, where("cpf", "==", resident.cpf));
    const querySnap = await getDocs(q);
    
    const siblings: Resident[] = [];
    const proxyOwners: Record<string, Resident> = {};

    for (const docSnap of querySnap.docs) {
      const sib = docSnap.data() as Resident;
      siblings.push(sib);
      
      if (sib.proxyOwnerUnit) {
        const ownerRef = doc(db, ASSEMBLIES_COLLECTION, safeAssemblyId, 'residents_list', sib.proxyOwnerUnit.toLowerCase());
        const ownerSnap = await getDoc(ownerRef);
        if (ownerSnap.exists()) {
          proxyOwners[sib.unit] = ownerSnap.data() as Resident;
        }
      }
    }

    return { resident, siblings, proxyOwners };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${ASSEMBLIES_COLLECTION}/${safeAssemblyId}/residents_list`);
    return { resident: null, siblings: [], proxyOwners: {} };
  }
};

export const revokeProxy = async (assemblyId: string, unit: string, proxyOwnerUnit: string) => {
  if (!db || !assemblyId) return;
  const safeAssemblyId = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
  
  try {
    // 1. Remove proxyOwnerUnit from the unit
    const unitRef = doc(db, ASSEMBLIES_COLLECTION, safeAssemblyId, 'residents_list', unit.toLowerCase());
    await setDoc(unitRef, { proxyOwnerUnit: null }, { merge: true });

    // 2. Update the proxy owner's proxyUnits list and count
    const ownerRef = doc(db, ASSEMBLIES_COLLECTION, safeAssemblyId, 'residents_list', proxyOwnerUnit.toLowerCase());
    const ownerSnap = await getDoc(ownerRef);
    
    if (ownerSnap.exists()) {
      const ownerData = ownerSnap.data() as Resident;
      const currentUnits = (ownerData.proxyUnits || '').split(',').map(u => u.trim()).filter(u => u !== unit);
      const newProxyCount = Math.max(0, (ownerData.proxyCount || 0) - 1);
      
      await setDoc(ownerRef, { 
        proxyUnits: currentUnits.join(', '),
        proxyCount: newProxyCount
      }, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${ASSEMBLIES_COLLECTION}/${safeAssemblyId}/residents_list`);
  }
};

export const grantProxy = async (assemblyId: string, proxyOwnerUnit: string, targetUnits: string[]) => {
  if (!db || !assemblyId) return;
  const safeAssemblyId = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
  
  try {
    // 1. Update each target unit to point to the proxy owner
    for (const unit of targetUnits) {
      const unitRef = doc(db, ASSEMBLIES_COLLECTION, safeAssemblyId, 'residents_list', unit.toLowerCase());
      await setDoc(unitRef, { proxyOwnerUnit }, { merge: true });
    }

    // 2. Update the proxy owner
    const ownerRef = doc(db, ASSEMBLIES_COLLECTION, safeAssemblyId, 'residents_list', proxyOwnerUnit.toLowerCase());
    const ownerSnap = await getDoc(ownerRef);
    
    if (ownerSnap.exists()) {
      const ownerData = ownerSnap.data() as Resident;
      const existingUnits = (ownerData.proxyUnits || '').split(',').map(u => u.trim()).filter(u => u);
      const allUnits = Array.from(new Set([...existingUnits, ...targetUnits]));
      
      await setDoc(ownerRef, { 
        proxyUnits: allUnits.join(', '),
        proxyCount: allUnits.length
      }, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${ASSEMBLIES_COLLECTION}/${safeAssemblyId}/residents_list`);
  }
};

export const saveActiveAssemblies = (assemblies: any[], syncToCloud: boolean = true) => {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_ASSEMBLIES, JSON.stringify(assemblies));
  if (syncToCloud && db && isAdminUser && isCloudRegistered) {
    const ref = doc(db, SYSTEM_COLLECTION, ACTIVE_ASSEMBLIES_DOC_ID);
    setDoc(ref, { list: assemblies, lastUpdated: Date.now() }, { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.WRITE, `${SYSTEM_COLLECTION}/${ACTIVE_ASSEMBLIES_DOC_ID}`));
  }
};

export const getActiveAssemblies = (): any[] => {
  const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_ASSEMBLIES);
  return data ? JSON.parse(data) : [];
};

export const saveAssemblies = (assemblies: AssemblyRecord[], syncToCloud: boolean = true) => {
  localStorage.setItem(STORAGE_KEYS.ASSEMBLIES, JSON.stringify(assemblies));
  if (syncToCloud && db && isAdminUser && isCloudRegistered) {
    const ref = doc(db, SYSTEM_COLLECTION, 'assemblies_history');
    setDoc(ref, { list: assemblies, lastUpdated: Date.now() }, { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.WRITE, `${SYSTEM_COLLECTION}/assemblies_history`));
  }
};

export const getAssemblies = (): AssemblyRecord[] => {
  const data = localStorage.getItem(STORAGE_KEYS.ASSEMBLIES);
  return data ? JSON.parse(data) : [];
};

export const saveDelinquencyModifications = (modifications: DelinquencyModification[]) => {
  localStorage.setItem('condovote_delinquency_modifications', JSON.stringify(modifications));
};

export const getDelinquencyModifications = (): DelinquencyModification[] => {
  const data = localStorage.getItem('condovote_delinquency_modifications');
  return data ? JSON.parse(data) : [];
};

export const getHideDelinquency = (): boolean => {
  return localStorage.getItem('condovote_hide_delinquency') === 'true';
};

export const setHideDelinquency = async (val: boolean) => {
  localStorage.setItem('condovote_hide_delinquency', val ? 'true' : 'false');
  if (db && isAdminUser) {
    const assemblyId = localStorage.getItem('condovote_assembly_id') || localStorage.getItem('condovote_condo_name') || 'setup';
    const safeKey = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
    try {
      await setDoc(doc(db, 'assemblies', safeKey), { hideDelinquency: val }, { merge: true });
    } catch (e) {
      console.error("[setHideDelinquency] Error synching with Firebase:", e);
    }
  }
};

export const getHideDelinquencyColumn = (): boolean => {
  return localStorage.getItem('condovote_hide_delinquency_column') === 'true';
};

export const setHideDelinquencyColumn = async (val: boolean) => {
  localStorage.setItem('condovote_hide_delinquency_column', val ? 'true' : 'false');
  if (db && isAdminUser) {
    const assemblyId = localStorage.getItem('condovote_assembly_id') || localStorage.getItem('condovote_condo_name') || 'setup';
    const safeKey = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
    try {
      await setDoc(doc(db, 'assemblies', safeKey), { hideDelinquencyColumn: val }, { merge: true });
    } catch (e) {
      console.error("[setHideDelinquencyColumn] Error synching with Firebase:", e);
    }
  }
};

export const clearAllData = async (specificName?: string) => {
  // LIMPA APENAS DADOS DA ASSEMBLEIA, MANTÉM USUÁRIOS
  localStorage.removeItem(STORAGE_KEYS.RESIDENTS);
  localStorage.removeItem(STORAGE_KEYS.POLLS);
  localStorage.removeItem(STORAGE_KEYS.VOTES);
  localStorage.removeItem(STORAGE_KEYS.CONDO_NAME);
  localStorage.removeItem(STORAGE_KEYS.IS_ASSEMBLY_ACTIVE);
  localStorage.removeItem(STORAGE_KEYS.ASSEMBLY_START_TIME);
  localStorage.removeItem('condovote_delinquency_modifications');
  
  if (db && isAdminUser && isCloudRegistered) {
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
  let headerCols: string[] = [];
  if (lines[0]) {
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('cpf') || firstLine.includes('unidade') || firstLine.includes('nome')) {
      startIndex = 1;
      headerCols = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase());
    }
  }

  // To maintain backward compatibility, we check if the header has "email" or "e-mail"
  const hasEmailInHeader = headerCols.some(h => h.includes('email') || h.includes('e-mail'));
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Support both semicolon and comma as delimiters
    const delimiter = line.includes(';') ? ';' : ',';
    const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    
    if (cols.length >= 3) {
      if (hasEmailInHeader) {
        // If has e-mail in header, use the new 9-column structure
        residents.push({ 
          unit: normalizeString(cols[1]), 
          name: normalizeString(cols[2]).toUpperCase(), // Standardize names to uppercase
          email: (cols[3] || '').trim(),
          isDelinquent: (cols[4] || '').toUpperCase().trim() === 'SIM', 
          hasHabiteSe: (cols[5] || '').toUpperCase().trim() === 'SIM', 
          fraction: parseFloat((cols[6] || '1').replace(',', '.')) || 1.0,
          cpf: (cols[0] || '').replace(/\D/g, ''), 
          attendanceStatus: 'NONE',
          proxyCount: parseInt((cols[7] || '0').trim(), 10) || 0,
          proxyUnits: (cols[8] || '').trim()
        });
      } else {
        // Safe fallback to old 8-column structure (without E-mail column)
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
  }
  return residents;
};

export const exportVotesToCSV = (votes: VoteRecord[], residents: Resident[], poll: Poll) => {
  const headers = ['UNIDADE', 'NOME', 'OPCAO VOTADA', 'INADIMPLENTE', 'LIBERADO_RECURSO', 'MOTIVO_LIBERACAO', 'DATA/HORA'];
  const pollVotes = votes.filter(v => v.pollId === poll.id);
  
  const rows = pollVotes.map(vote => {
    const r = residents.find(res => res.unit === vote.unit);
    const o = poll.options.find(opt => opt.id === vote.optionId);
    
    const unit = (vote.unit || '').toUpperCase();
    const name = (r?.name || '?').toUpperCase();
    const option = (o?.text || '?').toUpperCase();
    const isDelinquent = vote.isDelinquentVote ? 'SIM' : 'NAO';
    const released = vote.isDelinquentReleased ? 'SIM' : 'NAO';
    const reason = (vote.delinquentReleaseReason || '').toUpperCase();
    const date = new Date(vote.timestamp).toLocaleString().toUpperCase();
    
    return [unit, name, option, isDelinquent, released, reason, date].join(';');
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
