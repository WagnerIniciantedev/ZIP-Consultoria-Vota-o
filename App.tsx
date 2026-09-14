
import React, { useState, useEffect, useRef } from 'react';
import { AppView, Resident, Poll, VoteRecord, User, AssemblyRecord, SystemLog, AssemblyType, ErrorLog, Condominium } from './types';
import { 
  getResidents, saveResidents, 
  getPolls, savePolls, 
  getVotes, saveVotes,
  getUsers, saveUsers,
  getCondoName, saveCondoName,
  getAssemblies, saveAssemblies,
  getAssemblyStatus, saveAssemblyStatus,
  saveAssemblyId,
  saveSession, getSession, clearSession,
  getMasterSecurityUsers,
  getActiveAssemblies, saveActiveAssemblies,
  addLog,
  getLogs, saveLogs, registerAdminUid, setAdminStatus, clearAdminStatus,
  testConnection,
  clearErrorLogs,
  getDelinquencyModifications,
  getCondominiums, saveCondominiums,
  handleFirestoreError, OperationType
} from './services/dataService';
import { ActiveAssembly } from './types';
import { onSnapshot, doc, setDoc, collection } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth, functions } from './services/firebase';
import { httpsCallable } from 'firebase/functions';

// UI Components
import { AdminDashboard } from './components/AdminDashboard';
import { CompanyDashboard } from './components/CompanyDashboard';
import { ResidentVoting } from './components/ResidentVoting';
import { UrnaEletronica } from './components/UrnaEletronica';
import { ProfileModal } from './components/ProfileModal';
import { LiveRoom } from './components/live/LiveRoom';
import { Button, Input, Card } from './components/ui';
import { LogoZip } from './components/LogoZip';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Eye, EyeOff, Wifi, WifiOff, AlertCircle, RefreshCw } from 'lucide-react';

// --- DEBOUNCE HELPER FOR PERFORMANCE OPTIMIZATION ---
const debounce = <T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void => {
  let timeout: any;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
};

const App: React.FC = () => {
  
  // --- STATE MANAGEMENT ---
  const [currentView, setCurrentView] = useState<AppView>(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('t');
    const accessParam = params.get('access');

    let isResidentAccess = accessParam === 'resident';
    let isLiveTransmissionAccess = accessParam === 'live' || accessParam === 'transmission';
    let isUrnaAccess = accessParam === 'urna';

    if (token) {
      try {
        const cleanToken = token.startsWith('ZV_') ? token.substring(3) : token;
        const decoded = JSON.parse(atob(cleanToken));
        if (decoded.a === 'r') isResidentAccess = true;
        if (decoded.a === 'live') isLiveTransmissionAccess = true;
        if (decoded.a === 'u') isUrnaAccess = true;
      } catch (e) {
        console.error("Invalid token format in lazy init", e);
      }
    }

    if (isResidentAccess || isLiveTransmissionAccess) return AppView.VOTE_IDENTIFY;
    if (isUrnaAccess) return AppView.URNA_ELETRONICA;

    const savedUserStr = sessionStorage.getItem('condovote_user') || localStorage.getItem('condovote_user');
    if (savedUserStr) {
      return AppView.COMPANY_DASHBOARD;
    }

    return AppView.ADMIN_LOGIN;
  });

  const [residents, setResidents] = useState<Resident[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [condoName, setCondoName] = useState<string>('');
  const [sampleUnit, setSampleUnit] = useState<string>('');
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string>('');
  const [pastAssemblies, setPastAssemblies] = useState<AssemblyRecord[]>([]);
  const [activeAssemblies, setActiveAssemblies] = useState<ActiveAssembly[]>([]);
  const [condominiums, setCondominiums] = useState<Condominium[]>(() => getCondominiums());
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [isAssemblyActive, setIsAssemblyActive] = useState<boolean | null>(null);
  const [residentsCount, setResidentsCount] = useState<number>(0);
  const [assemblyType, setAssemblyType] = useState<AssemblyType | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [startedBy, setStartedBy] = useState<string>('');
  const [hasPermissionError, setHasPermissionError] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Auth State
  const [currentResident, setCurrentResident] = useState<Resident | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('t');
    const accessParam = params.get('access');

    let isResidentAccess = accessParam === 'resident';
    let isLiveTransmissionAccess = accessParam === 'live' || accessParam === 'transmission';
    let isUrnaAccess = accessParam === 'urna';

    if (token) {
      try {
        const cleanToken = token.startsWith('ZV_') ? token.substring(3) : token;
        const decoded = JSON.parse(atob(cleanToken));
        if (decoded.a === 'r') isResidentAccess = true;
        if (decoded.a === 'live') isLiveTransmissionAccess = true;
        if (decoded.a === 'u') isUrnaAccess = true;
      } catch (e) {}
    }

    if (isResidentAccess || isLiveTransmissionAccess || isUrnaAccess) {
      return null;
    }

    const savedUserStr = sessionStorage.getItem('condovote_user') || localStorage.getItem('condovote_user');
    if (savedUserStr) {
      try {
        return JSON.parse(savedUserStr);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false); 
  const [loginError, setLoginError] = useState('');
  const [globalError, setGlobalError] = useState('');
  const [isConnected, setIsConnected] = useState(navigator.onLine);

  const currentViewRef = useRef(currentView);
  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  // --- INITIAL LOAD ---
  useEffect(() => {
    const handleOnline = () => setIsConnected(true);
    const handleOffline = () => setIsConnected(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const params = new URLSearchParams(window.location.search);
    const token = params.get('t');
    let isResidentAccess = params.get('access') === 'resident';
    let isUrnaAccess = params.get('access') === 'urna';
    let urlAssemblyId = params.get('assemblyId');

    if (token) {
      try {
        // Handle the "encrypted" prefix if present
        const cleanToken = token.startsWith('ZV_') ? token.substring(3) : token;
        const decoded = JSON.parse(atob(cleanToken));
        if (decoded.a === 'r') isResidentAccess = true;
        if (decoded.a === 'u') isUrnaAccess = true;
        if (decoded.id) urlAssemblyId = decoded.id;
      } catch (e) {
        console.error("Invalid token format");
      }
    }

    const initialUsers = getUsers();
    setResidents(getResidents());
    setPolls(getPolls());
    setVotes(getVotes());
    setUsers(initialUsers);
    setCondoName(getCondoName());
    setPastAssemblies(getAssemblies());
    setActiveAssemblies(getActiveAssemblies());
    setLogs(getLogs());
    
    // Restore sample unit if available
    const savedSampleUnit = localStorage.getItem('condovote_sample_unit');
    if (savedSampleUnit) setSampleUnit(savedSampleUnit);

    // Don't set initial active status from local storage if we have a resident or urna link
    if (!isResidentAccess && !isUrnaAccess) {
      setIsAssemblyActive(getAssemblyStatus());
    }

    const savedUser = getSession();
    const savedAssemblyId = localStorage.getItem('condovote_assembly_id');
    if (savedAssemblyId) setSelectedAssemblyId(savedAssemblyId);
    
    if (isResidentAccess) {
      // Clear any stale admin session if entering as resident
      clearSession();
      setCurrentUser(null);
      setAdminStatus(false);

      if (urlAssemblyId) {
        setSelectedAssemblyId(urlAssemblyId);
        saveAssemblyId(urlAssemblyId);
        // Try to find the original condo name from the active assemblies list
        const active = getActiveAssemblies();
        const found = active.find((a: any) => a.id === urlAssemblyId);
        if (found) {
          setCondoName(found.condoName);
        } else {
          // If not found in local active list, we'll try to use the ID as the name for now
          // The Firestore listener will pick up the real data if it exists
          setCondoName(urlAssemblyId.replace(/_/g, ' '));
        }
      }
      setCurrentView(AppView.VOTE_IDENTIFY);
    } else if (isUrnaAccess) {
      // Clear any stale admin session
      clearSession();
      setCurrentUser(null);
      setAdminStatus(false);

      if (urlAssemblyId) {
        setSelectedAssemblyId(urlAssemblyId);
        saveAssemblyId(urlAssemblyId);
        const active = getActiveAssemblies();
        const found = active.find((a: any) => a.id === urlAssemblyId);
        if (found) {
          setCondoName(found.condoName);
        } else {
          setCondoName(urlAssemblyId.replace(/_/g, ' '));
        }
      }
      setCurrentView(AppView.URNA_ELETRONICA);
    } else if (savedUser) {
      setCurrentUser(savedUser);
      setCurrentView(AppView.COMPANY_DASHBOARD);
    }

    // Authenticate Anonymously
    if (auth) {
        signInAnonymously(auth)
          .then(() => {
            setIsAuthReady(true);
            testConnection();
          })
          .catch(e => {
            console.warn("Firebase Auth Error:", e);
            setIsAuthReady(true);
            testConnection();
          });
    } else {
        setIsAuthReady(true);
        testConnection();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- 1a. ADMIN REGISTRATION & STATUS (Runs only on login status change) ---
  useEffect(() => {
    if (!db || !isAuthReady) return;

    // Update admin status in dataService
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'TI';
    setAdminStatus(isAdmin);

    // Sincroniza o UID se estiver logado mas não registrado nesta sessão do Firebase
    if (isAdmin && auth?.currentUser && currentUser) {
        registerAdminUid(auth.currentUser.uid, currentUser.username.toLowerCase(), currentUser.role || 'ADMIN');
    }
  }, [isAuthReady, currentUser?.id, currentUser?.role]);

  // --- 1b. GLOBAL SYSTEM LISTENER (Users & Pointer - Run only when active) ---
  useEffect(() => {
    if (!db || !isAuthReady) return;
    setIsConnected(true);

    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'TI';

    // Only register these users/global listeners if in admin login or company dashboard views!
    const needsUsersAndGlobal = currentView === AppView.ADMIN_LOGIN || currentView === AppView.COMPANY_DASHBOARD;
    if (!needsUsersAndGlobal) {
        return;
    }

    const usersRef = doc(db, 'system', 'users');
    const unsubUsers = onSnapshot(usersRef, (docSnapshot) => {
        let cloudUsers: User[] = [];
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            if (data && Array.isArray(data.list)) {
                cloudUsers = data.list;
            }
        }

        // Se o Firestore estiver vazio, garantimos que pelo menos os usuários padrão existam (bootstrap)
        const safetyUsers = getMasterSecurityUsers();
        const finalUsersList = cloudUsers.length > 0 ? cloudUsers : safetyUsers;
        
        setUsers(finalUsersList);
        localStorage.setItem('condovote_users', JSON.stringify(finalUsersList));

        // Sync back to cloud if it was empty (bootstrap)
        if (isAdmin && !docSnapshot.exists()) {
            saveUsers(finalUsersList)
                .catch((e: any) => console.error("Erro sincronizando bootstrap de usuários:", e));
        }
    }, (error) => {
        if (error.message && error.message.includes('permission-denied')) {
            console.warn("[App] Users Listener Warning (Permission Denied):", error);
        } else {
            console.error("[App] Users Listener Error:", error);
        }
    });

    const globalRef = doc(db, 'system', 'global');
    const unsubGlobal = onSnapshot(globalRef, (docSnapshot) => {
        const data = docSnapshot.data();
        const val = data?.active_condo;
        // Only update condoName if we are in login view to avoid disrupting active sessions
        if (val && val !== 'null' && currentViewRef.current === AppView.ADMIN_LOGIN) {
            setCondoName(val);
            if (data?.startedBy) setStartedBy(data.startedBy);
        }
    }, (error) => {
        if (error.message && error.message.includes('permission-denied')) {
            console.warn("[App] Global Listener Warning (Permission Denied):", error);
        } else {
            console.error("[App] Global Listener Error:", error);
        }
    });

    const companySettingsRef = doc(db, 'system', 'company_settings');
    const unsubCompanySettings = onSnapshot(companySettingsRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            localStorage.setItem('condovote_company_settings', JSON.stringify(data));
            window.dispatchEvent(new Event('company-settings-updated'));
        }
    }, (error) => {
        if (error.message && error.message.includes('permission-denied')) {
            console.warn("[App] Company Settings Listener Warning (Permission Denied):", error);
        } else {
            console.error("[App] Company Settings Listener Error:", error);
        }
    });

    return () => {
        unsubUsers();
        unsubGlobal();
        unsubCompanySettings();
    };
  }, [isAuthReady, currentView === AppView.ADMIN_LOGIN || currentView === AppView.COMPANY_DASHBOARD]);

  // --- 2. LOGS LISTENER (Global) ---
  useEffect(() => {
    if (!db || !isAuthReady) return;

    // ONLY register these heavy listeners on the Company Dashboard view!
    if (currentView !== AppView.COMPANY_DASHBOARD) {
      return;
    }

    const logsRef = doc(db, 'system', 'logs');
    const unsubLogs = onSnapshot(logsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && Array.isArray(data.list)) {
          setLogs(data.list);
          saveLogs(data.list, false); // Don't sync back to cloud
        }
      }
    }, (error) => {
      if (error.message && error.message.includes('permission-denied')) {
        console.warn("[App] Logs Listener Warning (Permission Denied):", error);
      } else {
        console.error("[App] Logs Listener Error:", error);
      }
    });

    const activeAssembliesRef = doc(db, 'system', 'active_assemblies');
    const unsubActive = onSnapshot(activeAssembliesRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && Array.isArray(data.list)) {
          setActiveAssemblies(data.list);
          saveActiveAssemblies(data.list, false); // Don't sync back to cloud
        }
      }
    }, (error) => {
      if (error.message && error.message.includes('permission-denied')) {
        console.warn("[App] Active Assemblies Listener Warning (Permission Denied):", error);
      } else {
        console.error("[App] Active Assemblies Listener Error:", error);
      }
    });

    const historyRef = doc(db, 'system', 'assemblies_history');
    const unsubHistory = onSnapshot(historyRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && Array.isArray(data.list)) {
          setPastAssemblies(data.list);
          saveAssemblies(data.list, false); // Don't sync back to cloud
        }
      }
    }, (error) => {
      if (error.message && error.message.includes('permission-denied')) {
        console.warn("[App] History Listener Warning (Permission Denied):", error);
      } else {
        console.error("[App] History Listener Error:", error);
      }
    });

    // Error logs listener
    const errorLogsRef = doc(db, 'system', 'error_logs');
    const unsubErrorLogs = onSnapshot(errorLogsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && Array.isArray(data.logs)) {
          setErrorLogs(data.logs);
        }
      }
    }, (error) => {
      if (error.message && error.message.includes('permission-denied')) {
        console.warn("[App] Error Logs Listener Warning (Permission Denied):", error);
      } else {
        console.error("[App] Error Logs Listener Error:", error);
      }
      if (error.message.includes('resource-exhausted') || error.message.includes('Quota exceeded')) {
        setGlobalError("Limite de uso do banco de dados excedido. Por favor, aguarde o reset diário da cota.");
      }
    });

    const condominiumsRef = doc(db, 'system', 'condominiums');
    const unsubCondominiums = onSnapshot(condominiumsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && Array.isArray(data.list)) {
          setCondominiums(data.list);
          saveCondominiums(data.list, false);
        }
      }
    }, (error) => {
      if (error.message && error.message.includes('permission-denied')) {
        console.warn("[App] Condominiums Listener Warning (Permission Denied):", error);
      } else {
        console.error("[App] Condominiums Listener Error:", error);
      }
    });

    return () => {
      unsubLogs();
      unsubActive();
      unsubHistory();
      unsubErrorLogs();
      unsubCondominiums();
    };
  }, [isAuthReady, currentView === AppView.COMPANY_DASHBOARD]);

  // --- 3. ASSEMBLY SPECIFIC LISTENER ---
  const isAssemblyView = currentView !== AppView.COMPANY_DASHBOARD && currentView !== AppView.ADMIN_LOGIN;

  useEffect(() => {
    if (!db || !isAuthReady) return;

    // If we are in company dashboard or admin login, we don't need the assembly listener
    if (!isAssemblyView) {
        setIsDataLoaded(true);
        setIsAssemblyActive(null);
        return;
    }

    const currentAssemblyId = selectedAssemblyId || localStorage.getItem('condovote_assembly_id');
    if (!currentAssemblyId) {
      setIsDataLoaded(true);
      return;
    }

    setIsDataLoaded(false);
    setIsAssemblyActive(null);

    const safeKey = currentAssemblyId.replace(/[^a-zA-Z0-9]/g, '_');
    const assemblyRef = doc(db, 'assemblies', safeKey);

    const unsubAssembly = onSnapshot(assemblyRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            if (data.condoName) setCondoName(data.condoName);
            else if (data.name) setCondoName(data.name);
            
            if (data.sampleUnit) {
                setSampleUnit(data.sampleUnit);
                localStorage.setItem('condovote_sample_unit', data.sampleUnit);
            }
            if (data.polls) setPolls(data.polls);
            if (data.startedBy) setStartedBy(data.startedBy);
            if (data.residentsCount) setResidentsCount(data.residentsCount);
            
            if (data.hideDelinquency !== undefined) {
                localStorage.setItem('condovote_hide_delinquency', data.hideDelinquency ? 'true' : 'false');
            }
            if (data.hideDelinquencyColumn !== undefined) {
                localStorage.setItem('condovote_hide_delinquency_column', data.hideDelinquencyColumn ? 'true' : 'false');
            }
            
            if (data.isActive !== undefined) {
                setIsAssemblyActive(data.isActive);
                if (data.isActive === false && !currentUser) {
                    clearSession();
                }
            }
            setIsDataLoaded(true);
        } else {
            // If assembly doc doesn't exist, wait longer before giving up
            setTimeout(() => {
              if (selectedAssemblyId || (condoName && condoName !== 'Modo Administrativo')) {
                if (!isDataLoaded) {
                  setPolls([]);
                  setVotes([]);
                  setResidents([]);
                  setIsAssemblyActive(false);
                  setIsDataLoaded(true);
                }
              }
            }, 8000);
        }
    }, (error: any) => {
        const isPermissionError = error.code === 'permission-denied' || 
          (error.message && (error.message.includes('permission-denied') || error.message.includes('permissions')));
        
        if (isPermissionError) {
            console.warn("[App] Firestore Listener Warning (Permission Denied):", error);
            setHasPermissionError(true);
            setIsAssemblyActive(false);
            setIsDataLoaded(true);
        } else {
            handleFirestoreError(error, OperationType.GET, `assemblies/${safeKey}`);
        }
        if (error.message && (error.message.includes('resource-exhausted') || error.message.includes('Quota exceeded'))) {
          setGlobalError("Limite de uso do banco de dados excedido. Por favor, aguarde o reset diário da cota.");
        }
    });

    return () => {
        unsubAssembly();
    };
  }, [selectedAssemblyId, isAssemblyView, isAuthReady]);

  // --- 4. RESIDENTS & VOTES LISTENER (Admin & Urna - Separate & Cached) ---
  const isAdminOrUrnaView = currentView === AppView.ADMIN_DASHBOARD || currentView === AppView.URNA_ELETRONICA;

  useEffect(() => {
    if (!db || !isAuthReady || !isAdminOrUrnaView) return;

    const currentAssemblyId = selectedAssemblyId || localStorage.getItem('condovote_assembly_id');
    if (!currentAssemblyId) return;

    const safeKey = currentAssemblyId.replace(/[^a-zA-Z0-9]/g, '_');

    const residentsRef = collection(db, 'assemblies', safeKey, 'residents_list');
    
    const processResidents = debounce((snap: any) => {
        const list: Resident[] = [];
        snap.forEach((doc: any) => list.push(doc.data() as Resident));
        setResidents(list);
        saveResidents(list);
    }, 250);

    const unsubResidents = onSnapshot(residentsRef, (snap: any) => {
        processResidents(snap);
    }, (error) => {
        const isPermissionError = error.code === 'permission-denied' || 
          (error.message && (error.message.includes('permission-denied') || error.message.includes('permissions')));
        
        if (isPermissionError) {
            console.warn("[App] Residents Listener Warning (Permission Denied):", error);
        } else {
            handleFirestoreError(error, OperationType.LIST, `assemblies/${safeKey}/residents_list`);
        }
    });

    const votesRef = collection(db, 'assemblies', safeKey, 'votes');
    
    const processVotes = debounce((snap: any) => {
        const list: VoteRecord[] = [];
        snap.forEach((doc: any) => list.push(doc.data() as VoteRecord));
        setVotes(list);
        saveVotes(list);
    }, 250);

    const unsubVotes = onSnapshot(votesRef, (snap: any) => {
        processVotes(snap);
    }, (error) => {
        const isPermissionError = error.code === 'permission-denied' || 
          (error.message && (error.message.includes('permission-denied') || error.message.includes('permissions')));
        
        if (isPermissionError) {
            console.warn("[App] Votes Listener Warning (Permission Denied):", error);
        } else {
            handleFirestoreError(error, OperationType.LIST, `assemblies/${safeKey}/votes`);
        }
    });

    return () => {
        unsubResidents();
        unsubVotes();
    };
  }, [selectedAssemblyId, isAdminOrUrnaView, isAuthReady]); 

  // --- AUTOMATIC UPDATE & DEPLOYMENT DETECTOR ---
  useEffect(() => {
    let active = true;
    let initialScripts: string[] = [];
    let initialStyles: string[] = [];

    const isAppAsset = (path: string) => {
      if (!path) return false;
      // Filter out external scripts/CDNs (e.g. google recaptcha)
      if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) {
        if (!path.startsWith(window.location.origin)) {
          return false;
        }
      }
      return path.includes('/assets/') || path.includes('index-') || path.includes('.js') || path.includes('.css');
    };

    const getCurrentAssets = () => {
      const scripts = Array.from(document.querySelectorAll('script'))
        .map(s => s.getAttribute('src'))
        .filter((src): src is string => !!src)
        .filter(isAppAsset);
      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(l => l.getAttribute('href'))
        .filter((href): href is string => !!href)
        .filter(isAppAsset);
      return { scripts, styles };
    };

    // Store initial loaded assets in memory
    const assets = getCurrentAssets();
    initialScripts = assets.scripts;
    initialStyles = assets.styles;

    console.log("[AutoUpdater] Current loaded assets at startup:", { initialScripts, initialStyles });

    const checkUpdates = async () => {
      if (!active) return;
      
      // ONLY check and show the banner if we have an authenticated user and are on an administrative view!
      const isAdminView = currentView === AppView.ADMIN_DASHBOARD || currentView === AppView.COMPANY_DASHBOARD;
      if (!currentUser || !isAdminView) {
        return;
      }

      try {
        const url = window.location.origin + '/index.html?t=' + Date.now();
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) return;
        
        const html = await response.text();
        
        // Extract script sources pointing to assets
        const scriptRegex = /src=["']([^"']+\.[jJ][sS][^"']*)["']/gi;
        const rawFetchedScripts: string[] = [];
        let match;
        while ((match = scriptRegex.exec(html)) !== null) {
          rawFetchedScripts.push(match[1]);
        }
        const fetchedScripts = rawFetchedScripts.filter(isAppAsset);

        // Extract style sources pointing to stylesheet assets
        const linkRegex = /href=["']([^"']+\.[cC][sS][sS][^"']*)["']/gi;
        const rawFetchedStyles: string[] = [];
        while ((match = linkRegex.exec(html)) !== null) {
          rawFetchedStyles.push(match[1]);
        }
        const fetchedStyles = rawFetchedStyles.filter(isAppAsset);

        // We only check for mismatches if we actually have assets in the bundle
        if (initialScripts.length > 0 && fetchedScripts.length > 0) {
          const hasNewScript = fetchedScripts.some(s => !initialScripts.includes(s));
          const hasNewStyle = fetchedStyles.some(s => !initialStyles.includes(s));
          
          if (hasNewScript || hasNewStyle) {
            console.log("[AutoUpdater] New deployment detected!", { fetchedScripts, fetchedStyles });
            
            // Show a visual toast/reloading indicator, then reload
            if (!document.getElementById('app-update-banner')) {
              const banner = document.createElement('div');
              banner.id = 'app-update-banner';
              banner.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-gradient-to-r from-red-600 to-indigo-600 text-white px-5 py-3 rounded-full flex items-center gap-3 shadow-2xl font-bold text-xs border border-white/20 animate-bounce';
              banner.innerHTML = `
                <span class="relative flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                Nova versão disponível! Atualizando o sistema...
              `;
              document.body.appendChild(banner);
              
              setTimeout(() => {
                window.location.reload();
              }, 2500);
            }
          }
        }
      } catch (err) {
        console.error("[AutoUpdater] Error checking updates:", err);
      }
    };

    // Set up check interval (every 30 seconds for quick reactive updates)
    const interval = setInterval(checkUpdates, 30 * 1000);

    // Dynamic chunk loading error handler: intercepts and recovers from bundle loading failures
    const handleChunkError = (e: ErrorEvent) => {
      const msg = e.message || '';
      const isChunkError = /chunk|loading|css|js|module/i.test(msg) || (e.error && /chunk|loading/i.test(e.error.message || ''));
      if (isChunkError) {
        console.warn("[AutoUpdater] Captured chunk load failure. Reloading app to fetch newest bundles...");
        window.location.reload();
      }
    };
    
    window.addEventListener('error', handleChunkError, true);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('error', handleChunkError, true);
      // Clean up the banner dynamically if they logged out or navigated away from dashboard
      const existingBanner = document.getElementById('app-update-banner');
      if (existingBanner) {
        existingBanner.remove();
      }
    };
  }, [currentUser, currentView]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Normalização dos inputs para evitar erros de digitação (espaços ou maiúsculas)
    let normalizedEmail = adminEmail.trim().toLowerCase();
    const cleanPass = adminPass.trim();

    // 1. Busca na lista de usuários carregados (Estado)
    let validUser = users.find(u => 
      u.username.toLowerCase() === normalizedEmail && u.password === cleanPass
    );

    // 2. Fallback de Segurança: Se a lista estiver vazia por erro de sincronia, busca na lista mestra
    if (!validUser) {
      const masterUsers = getMasterSecurityUsers();
      validUser = masterUsers.find(u => 
        u.username.toLowerCase() === normalizedEmail && u.password === cleanPass
      );
    }

    if (validUser) {
      setCurrentUser(validUser);
      saveSession(validUser, rememberMe);
      
      // Reset assembly state on login to avoid stale data
      setIsAssemblyActive(false);
      setCondoName('');
      setSelectedAssemblyId('');
      saveAssemblyId('');
      saveAssemblyStatus(false);
      saveCondoName('');
      
      // Sincroniza o UID do Firebase com o usuário administrador para as regras do Firestore
      // Fazemos isso ANTES do log para garantir que as permissões estejam ativas
      if (auth?.currentUser) {
        const isAdmin = validUser.role === 'ADMIN' || validUser.role === 'TI';
        setAdminStatus(isAdmin);
        
        // Usamos o username completo conforme solicitado pelo usuário (sem prefixo)
        const usernameToRegister = validUser.username.toLowerCase();
        await registerAdminUid(auth.currentUser.uid, usernameToRegister, validUser.role || 'ADMIN');
      }
      
      setCurrentView(AppView.COMPANY_DASHBOARD);
      addLog(validUser, 'LOGIN', 'Acesso ao sistema realizado com sucesso');
      setLoginError('');
      setAdminEmail('');
      setAdminPass('');
    } else {
      setLoginError('Credenciais inválidas. Verifique usuário e senha.');
    }
  };

  const handleStartAssembly = async (name: string, assemblyId: string, initialResidents: Resident[] = [], type: AssemblyType = AssemblyType.ONLINE, startedBy?: string) => {
    setResidents(initialResidents);
    setPolls([]);
    setVotes([]);
    setCondoName(name);
    setSelectedAssemblyId(assemblyId);
    setAssemblyType(type);
    saveAssemblyId(assemblyId);
    setIsAssemblyActive(true);
    
    const sampleUnitValue = initialResidents[0]?.unit || '';
    setSampleUnit(sampleUnitValue);
    localStorage.setItem('condovote_sample_unit', sampleUnitValue);

    saveAssemblyId(assemblyId);
    saveResidents(initialResidents);
    savePolls([]);
    saveVotes([]);
    saveCondoName(name);
    saveAssemblyStatus(true);
    
    // Save metadata to Firestore so residents can find the condo name
    if (db && assemblyId) {
      const safeKey = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
      const assemblyRef = doc(db, 'assemblies', safeKey);
      const globalRef = doc(db, 'system', 'global');
      
      try {
        await setDoc(assemblyRef, { 
          condoName: name, 
          isActive: true,
          createdAt: Date.now(),
          sampleUnit: sampleUnitValue,
          residentsCount: initialResidents.length,
          type: type,
          startedBy: startedBy || currentUser?.name || 'Sistema'
        }, { merge: true });

        // Set this as the global active condo for residents without specific link
        await setDoc(globalRef, { 
          active_condo: name,
          startedBy: startedBy || currentUser?.name || 'Sistema'
        }, { merge: true });

        // If there are initial residents, sync them to the subcollection
        if (initialResidents.length > 0) {
          // Use chunks for large lists to avoid hitting limits if necessary, 
          // but for now Promise.all is fine for typical condo sizes
          const savePromises = initialResidents.map((r: Resident) => {
            const resRef = doc(db, 'assemblies', safeKey, 'residents_list', r.unit.toLowerCase());
            return setDoc(resRef, r, { merge: true });
          });
          await Promise.all(savePromises);
        }
      } catch (e) {
        console.error("Error saving assembly data to cloud:", e);
      }
    }

    if (currentUser) {
      addLog(currentUser, 'INÍCIO_ASSEMBLEIA', `Iniciou a assembleia: ${name}`);
    }
  };

  const handleEndAssembly = async () => {
    if (condoName && condoName !== 'Modo Administrativo') {
      // Filter logs for this specific assembly
      const currentLogs = logs.filter((l: SystemLog) => l.assemblyId === condoName);

      const assemblySnapshot: AssemblyRecord = {
        id: selectedAssemblyId || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
        condoName: condoName,
        date: Date.now(),
        polls: [...polls], 
        votes: [...votes], 
        residentsSnapshot: [...residents],
        type: assemblyType || undefined,
        logs: currentLogs,
        delinquencyModifications: getDelinquencyModifications()
      };
      
      const newPastAssemblies = [assemblySnapshot, ...pastAssemblies];
      setPastAssemblies(newPastAssemblies);
      saveAssemblies(newPastAssemblies);

      // Update ActiveAssembly status in the list
      const updatedActive = activeAssemblies.map((a: ActiveAssembly) => 
        (a.id === selectedAssemblyId || a.condoName === condoName) 
        ? { ...a, isActive: false, status: 'completed' as const } 
        : a
      );
      setActiveAssemblies(updatedActive);
      saveActiveAssemblies(updatedActive);
      
      // Update Firestore document to inactive
      if (db && selectedAssemblyId) {
        const safeKey = selectedAssemblyId.replace(/[^a-zA-Z0-9]/g, '_');
        const assemblyRef = doc(db, 'assemblies', safeKey);
        try {
          const { writeBatch, collection, getDocs } = await import('firebase/firestore');
          
          await setDoc(assemblyRef, { isActive: false }, { merge: true });
          
          // CLEANUP: Delete anonymous residents and votes from Firestore to not overload the DB
          // as requested by the user.
          const residentsRef = collection(db, 'assemblies', safeKey, 'residents_list');
          const votesRef = collection(db, 'assemblies', safeKey, 'votes');
          
          const residentsSnap = await getDocs(residentsRef);
          const votesSnap = await getDocs(votesRef);
          
          const batch = writeBatch(db);
          residentsSnap.forEach(doc => batch.delete(doc.ref));
          votesSnap.forEach(doc => batch.delete(doc.ref));
          await batch.commit();

          // Also reset global pointer if this was the active one
          const globalRef = doc(db, 'system', 'global');
          await setDoc(globalRef, { active_condo: 'null' }, { merge: true });
        } catch (e) {
          console.error("Error ending assembly in Firestore:", e);
        }
      }

      if (currentUser) {
        addLog(currentUser, 'FIM_ASSEMBLEIA', `Finalizou a assembleia: ${condoName}`);
      }
    }
    
    // Clear current working state
    setPolls([]);
    setVotes([]);
    setResidents([]);
    setCondoName('');
    setIsAssemblyActive(false);
    setSelectedAssemblyId('');
    saveAssemblyId('');
    saveAssemblyStatus(false);
    saveCondoName('');
    setCurrentView(AppView.COMPANY_DASHBOARD);
  };

  const handleVoteSubmit = async (pollId: string, unit: string, optionId: string, isDelinquent: boolean, zoomName?: string) => {
    const newVote = { pollId, unit, optionId, timestamp: Date.now(), isDelinquentVote: isDelinquent, zoomName };
    
    let canVote = true;
    setVotes(prev => {
      if (prev.some(v => v.unit === unit && v.pollId === pollId)) {
        canVote = false;
        return prev;
      }
      
      // Check if we reached the limit of residents imported
      const pollVotesCount = prev.filter(v => v.pollId === pollId).length;
      if (residentsCount > 0 && pollVotesCount >= residentsCount) {
        canVote = false;
        alert(`Limite de votos atingido (${residentsCount}). Não é possível registrar mais votos para esta enquete.`);
        return prev;
      }

      const updated = [...prev, newVote];
      saveVotes(updated);
      return updated;
    });

    if (!canVote) return;

    const currentId = selectedAssemblyId || condoName || localStorage.getItem('condovote_assembly_id');
    if (!currentId) return;
    const safeKey = currentId.replace(/[^a-zA-Z0-9]/g, '_');

    // Resident secure voting flow
    if (!currentUser) {
      try {
        const submitSecureVoteFn = httpsCallable(functions, 'submitSecureVote');
        await submitSecureVoteFn({
          assemblyId: safeKey,
          pollId,
          unit,
          optionId,
          zoomName,
          userAgent: navigator.userAgent
        });
      } catch (err: any) {
        console.error("Erro ao registrar voto seguro via Cloud Function:", err);
        alert(err.message || "Erro de segurança ao registrar voto. Contate a administração.");
        // Rollback local state on failure
        setVotes(prev => prev.filter(v => !(v.unit === unit && v.pollId === pollId)));
      }
      return;
    }

    // Admin sync flow
    if (db) {
      const voteRef = doc(db, 'assemblies', safeKey, 'votes', `${pollId}_${unit.replace(/[^a-zA-Z0-9]/g, '_')}`);
      try {
        await setDoc(voteRef, newVote, { merge: true });
      } catch (err) {
        console.error("Erro ao sincronizar voto com Firestore:", err);
      }
    }
  };

  const handleReleaseDelinquentVote = async (pollId: string, unit: string, reason: string) => {
    let voteToUpdate: VoteRecord | null = null;
    
    setVotes(prev => {
      const updated = prev.map(v => {
        if (v.pollId === pollId && v.unit === unit) {
          const uv = {
            ...v,
            isDelinquentReleased: true,
            delinquentReleaseReason: reason,
            delinquentReleasedBy: currentUser?.name || 'Administrador'
          };
          voteToUpdate = uv;
          return uv;
        }
        return v;
      });
      saveVotes(updated);
      return updated;
    });

    if (voteToUpdate && db && (selectedAssemblyId || condoName)) {
      const currentId = selectedAssemblyId || condoName;
      const safeKey = currentId.replace(/[^a-zA-Z0-9]/g, '_');
      const voteRef = doc(db, 'assemblies', safeKey, 'votes', `${pollId}_${unit.replace(/[^a-zA-Z0-9]/g, '_')}`);
      try {
        await setDoc(voteRef, voteToUpdate, { merge: true });
        if (currentUser) {
          addLog(currentUser, 'LIBERAÇÃO_INADIMPLENTE', `Liberou o voto da unidade ${unit} na enquete ${pollId}. Motivo: ${reason}`);
        }
      } catch (err) {
        console.error("Erro ao sincronizar liberação de voto:", err);
      }
    }
  };

  const handleRegisterAttendance = async (targetAssemblyId: string, units: Resident[], zoomName: string) => {
    if (db && targetAssemblyId) {
      // Update local state first for immediate feedback
      setResidents(prev => {
        const updated = prev.map(r => {
          const match = units.find(u => u.unit.toLowerCase() === r.unit.toLowerCase());
          if (match) {
            return { ...r, zoomName, attendanceStatus: 'PENDING' as const };
          }
          return r;
        });
        saveResidents(updated);
        return updated;
      });

      // Sync each unit to Firestore subcollection using the explicit assemblyId
      const safeAssemblyId = targetAssemblyId.replace(/[^a-zA-Z0-9]/g, '_');
      const syncPromises = units.map(u => {
        // Preserve APPROVED status if already set, otherwise set to PENDING
        const newStatus = u.attendanceStatus === 'APPROVED' ? 'APPROVED' : 'PENDING';
        const updatedResident = { ...u, zoomName, attendanceStatus: newStatus as any };
        const resRef = doc(db, 'assemblies', safeAssemblyId, 'residents_list', u.unit.toLowerCase());
        return setDoc(resRef, updatedResident, { merge: true });
      });

      try {
        await Promise.all(syncPromises);
      } catch (err) {
        console.error("Erro ao sincronizar presença com o Firestore:", err);
      }
    }
  };

  // --- RENDER ---

  if (currentView === AppView.ADMIN_LOGIN) {
    return (
      <div className="min-h-screen bg-[#FE0000] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-black/10 rounded-full blur-3xl"></div>
        {globalError && currentUser?.role === 'TI' && (
          <div className="fixed top-0 left-0 right-0 bg-white text-red-600 p-4 text-center font-bold z-50 shadow-lg flex items-center justify-center gap-2">
            <AlertCircle size={20} />
            {globalError}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.reload()}
              className="ml-4 bg-red-600 text-white border-red-600 hover:bg-red-700"
            >
              Recarregar
            </Button>
          </div>
        )}
        <div className="flex flex-col items-center w-full max-w-md z-10">
          <div className="mb-8 text-center w-full max-w-full flex justify-center">
             <LogoZip logoType="login" className="w-full h-auto drop-shadow-xl animate-in fade-in duration-1000" />
          </div>
          
          <div className="w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-8 pt-10 pb-8">
              <div className="mb-6 text-center">
                 <h2 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Portal de Votação</h2>
                 <h1 className="text-gray-900 font-bold text-2xl">Identificação</h1>
                 <div className="h-1 w-12 bg-red-600 mx-auto mt-4 rounded-full"></div>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Usuário Administrativo</label>
                  <Input type="text" placeholder="Digite seu usuário" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Senha</label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} placeholder="••••••" value={adminPass} onChange={e => setAdminPass(e.target.value)} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center pl-1">
                  <input id="remember-me" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 text-red-600 cursor-pointer" />
                  <label htmlFor="remember-me" className="ml-2 text-sm font-medium text-gray-700 cursor-pointer">Permanecer conectado</label>
                </div>
                {loginError && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm font-medium animate-bounce">{loginError}</div>}
                <Button type="submit" className="w-full bg-[#FE0000] hover:bg-red-750 text-white font-bold py-3.5 shadow-lg active:scale-95 transition-all text-sm">ENTRAR</Button>
              </form>



              <div className="mt-8 relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                  <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500 font-medium text-[10px] tracking-widest">ACESSO RESTRITO</span></div>
              </div>
            </div>
          </div>
          <div className="mt-8">
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs backdrop-blur-sm border ${isConnected ? 'bg-green-500/20 text-white border-green-400/30' : 'bg-white/10 text-white/70 border-white/10'}`}>
                {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />} {isConnected ? 'Sistema Online' : 'Modo Offline'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // --- RESIDENT VIEW GUARD ---
  if (currentView === AppView.VOTE_IDENTIFY && !currentUser) {
      // If offline, show a specific message
      if (!isConnected) {
          return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
                    <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                        <RefreshCw className="text-yellow-600" size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Sem Conexão</h2>
                    <p className="text-gray-500 mb-8">Parece que você está sem internet. O sistema tentará reconectar automaticamente assim que o sinal voltar.</p>
                </div>
            </div>
          );
      }

      // While data is loading, show a spinner
      if (!isDataLoaded) {
          return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="text-center">
                    <RefreshCw className="animate-spin h-12 w-12 text-red-600 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Sincronizando Assembleia...</p>
                </div>
            </div>
          );
      }

      // If data loaded but assembly is not active, show the "Ended" screen
      if (hasPermissionError) {
          return (
              <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
                  <Card className="max-w-md w-full text-center">
                      <AlertCircle size={48} className="text-red-600 mx-auto mb-4" />
                      <h2 className="text-xl font-bold mb-2">Erro de Permissão</h2>
                      <p className="text-gray-600 mb-6">Não foi possível conectar ao banco de dados. Verifique as regras do Firestore (liberação).</p>
                      <Button onClick={() => window.location.reload()} className="w-full">Tentar Novamente</Button>
                  </Card>
              </div>
          );
      }

      if (isAssemblyActive === false) {
          return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
                    <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="text-red-600" size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Assembleia Indisponível</h2>
                    <p className="text-gray-500 mb-8">Esta assembleia já foi finalizada, ainda não foi iniciada ou o link expirou. Por favor, verifique com a administração.</p>
                    <div className="space-y-3">
                      <Button onClick={() => window.location.reload()} variant="outline" className="w-full flex items-center justify-center gap-2">
                        <RefreshCw size={16} /> Tentar Novamente
                      </Button>
                      <Button onClick={() => window.location.href = window.location.origin} variant="ghost" className="w-full text-sm text-gray-400">
                        Voltar ao Início
                      </Button>
                    </div>
                </div>
            </div>
          );
      }
  }

  if (currentView === AppView.LIVE_ASSEMBLY) {
    return (
      <LiveRoom
        assemblyId={selectedAssemblyId || 'default'}
        condoName={condoName || 'Condomínio'}
        assemblyTitle="Assembleia Geral ao Vivo"
        currentUser={currentUser}
        currentResident={currentUser ? null : currentResident}
        isAdmin={currentUser ? true : false}
        polls={polls}
        votes={votes}
        onVoteSubmit={handleVoteSubmit}
        hasVoted={(pId, unit) => votes.some(v => v.unit === unit && v.pollId === pId)}
        onExit={() => {
          if (currentUser) {
            setCurrentView(AppView.COMPANY_DASHBOARD);
          } else {
            setCurrentView(AppView.VOTE_IDENTIFY);
          }
        }}
      />
    );
  }

  if (currentView === AppView.COMPANY_DASHBOARD) {
    return (
      <div className="min-h-screen bg-gray-50">
        {globalError && currentUser?.role === 'TI' && (
          <div className="bg-red-600 text-white p-4 text-center font-bold flex items-center justify-center gap-2">
            <AlertCircle size={20} />
            {globalError}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.reload()}
              className="ml-4 bg-white text-red-600 border-white hover:bg-red-50"
            >
              Recarregar
            </Button>
          </div>
        )}
        <CompanyDashboard 
        currentUser={currentUser}
        onLogout={() => { 
          if (currentUser) addLog(currentUser, 'LOGOUT', 'Saiu do sistema');
          clearSession(); 
          clearAdminStatus();
          setCurrentUser(null); 
          setCurrentView(AppView.ADMIN_LOGIN); 
        }}
        onSelectAssembly={(id, name) => {
          if (currentUser) addLog(currentUser, 'SELEÇÃO_ASSEMBLEIA', `Selecionou a assembleia: ${name}`);
          const assembly = activeAssemblies.find(a => a.id === id);
          if (assembly && assembly.type) {
            setAssemblyType(assembly.type);
          } else {
            setAssemblyType(AssemblyType.ONLINE); // Default fallback
          }
          setSelectedAssemblyId(id);
          saveAssemblyId(id);
          setCondoName(name);
          saveCondoName(name);
          setIsAssemblyActive(true);
          saveAssemblyStatus(true);
          setCurrentView(AppView.ADMIN_DASHBOARD);
        }}
        onStartAssembly={handleStartAssembly}
        onOpenLiveAssembly={(id, name) => {
          setSelectedAssemblyId(id);
          setCondoName(name);
          saveAssemblyId(id);
          saveCondoName(name);
          setCurrentView(AppView.LIVE_ASSEMBLY);
        }}
        activeAssemblies={activeAssemblies}
        setActiveAssemblies={setActiveAssemblies}
        condominiums={condominiums}
        setCondominiums={setCondominiums}
        users={users}
        setUsers={setUsers}
        pastAssemblies={pastAssemblies}
        logs={logs}
        errorLogs={errorLogs}
        onDeleteAssembly={(id) => {
          const assembly = pastAssemblies.find(a => a.id === id);
          if (currentUser && assembly) addLog(currentUser, 'EXCLUSÃO_RELATÓRIO', `Excluiu o relatório da assembleia: ${assembly.condoName}`);
          const updated = pastAssemblies.filter(a => a.id !== id);
          setPastAssemblies(updated);
          saveAssemblies(updated);
        }}
        onDeleteLog={(id) => {
          const updated = logs.filter(l => l.id !== id);
          setLogs(updated);
          saveLogs(updated);
        }}
        onClearLogs={() => {
          setLogs([]);
          saveLogs([]);
        }}
        onClearErrorLogs={clearErrorLogs}
        onEditProfile={() => setIsProfileModalOpen(true)}
      />
      <ProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        users={users}
        setUsers={setUsers}
      />
      </div>
    );
  }

  if (currentView === AppView.ADMIN_DASHBOARD) {
    return (
      <div className="min-h-screen bg-gray-50">
        {globalError && currentUser?.role === 'TI' && (
          <div className="bg-red-600 text-white p-4 text-center font-bold flex items-center justify-center gap-2">
            <AlertCircle size={20} />
            {globalError}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.reload()}
              className="ml-4 bg-white text-red-600 border-white hover:bg-red-50"
            >
              Recarregar
            </Button>
          </div>
        )}
        <AdminDashboard 
        isAssemblyActive={isAssemblyActive}
        residentsCount={residentsCount}
        residents={residents} setResidents={setResidents}
        polls={polls} setPolls={setPolls}
        votes={votes}
        condoName={condoName} setCondoName={setCondoName}
        onLogout={() => { 
          clearSession(); 
          clearAdminStatus();
          setCurrentUser(null); 
          setCurrentView(AppView.ADMIN_LOGIN); 
        }}
        onGoToVoting={() => setCurrentView(AppView.VOTE_IDENTIFY)}
        onTogglePoll={(id: string) => {
            const updated = polls.map(p => {
                if (p.id === id) {
                    const newIsActive = !p.isActive;
                    return {
                        ...p, 
                        isActive: newIsActive,
                        hasStarted: p.hasStarted || newIsActive
                    };
                }
                return p;
            });
            setPolls(updated);
            savePolls(updated);
        }}
        onEndPoll={(id: string) => {
            const updated = polls.map(p => p.id === id ? {...p, isActive: false, isEnded: true} : p);
            setPolls(updated);
            savePolls(updated);
            
            // Limpeza de administradores anônimos antigos para evitar sobrecarga
            if (auth?.currentUser) {
              import('./services/dataService').then(m => m.cleanupAnonymousAdmins(auth.currentUser.uid));
            }
        }}
        onDeletePoll={(id: string) => {
            const updated = polls.filter(p => p.id !== id);
            setPolls(updated);
            savePolls(updated);
        }}
        onEndAssembly={handleEndAssembly}
        onBackToCompany={() => setCurrentView(AppView.COMPANY_DASHBOARD)}
        currentUser={currentUser}
        selectedAssemblyId={selectedAssemblyId}
        setSampleUnit={setSampleUnit}
        assemblyType={assemblyType}
        startedBy={startedBy}
        onGoToUrna={() => setCurrentView(AppView.URNA_ELETRONICA)}
        onVoteSubmit={handleVoteSubmit}
        onReleaseDelinquentVote={handleReleaseDelinquentVote}
        onEditProfile={() => setIsProfileModalOpen(true)}
      />
      <ProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        users={users}
        setUsers={setUsers}
      />
      </div>
    );
  }

  if (currentView === AppView.URNA_ELETRONICA) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-700 via-rose-650 to-red-800 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-4xl shadow-2xl rounded-2xl overflow-hidden bg-white/10 backdrop-blur-md p-1 border border-white/20">
          <UrnaEletronica
            residents={residents}
            polls={polls}
            votes={votes}
            onVoteSubmit={handleVoteSubmit}
            onBack={() => {
              if (currentUser) {
                setCurrentView(AppView.ADMIN_DASHBOARD);
              } else {
                setCurrentView(AppView.ADMIN_LOGIN);
              }
            }}
            isStandalone={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {globalError && currentUser?.role === 'TI' && (
        <div className="bg-red-600 text-white p-4 text-center font-bold flex items-center justify-center gap-2">
          <AlertCircle size={20} />
          {globalError}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.reload()}
            className="ml-4 bg-white text-red-600 border-white hover:bg-red-50"
          >
            Recarregar
          </Button>
        </div>
      )}
      <ResidentVoting 
        assemblyId={selectedAssemblyId}
        sampleUnit={sampleUnit}
        polls={polls}
        onVoteSubmit={handleVoteSubmit}
        onRegisterAttendance={(units, zoomName) => handleRegisterAttendance(selectedAssemblyId, units, zoomName)}
        hasVoted={(pId, unit) => votes.some(v => v.unit === unit && v.pollId === pId)}
        isResidentLink={new URLSearchParams(window.location.search).get('access') === 'resident' || (new URLSearchParams(window.location.search).get('t') && (() => { try { const d = JSON.parse(atob(new URLSearchParams(window.location.search).get('t')!.startsWith('ZV_') ? new URLSearchParams(window.location.search).get('t')!.substring(3) : new URLSearchParams(window.location.search).get('t')!)); return d.a === 'r'; } catch(e){return false;} })())}
        isTransmissionLink={new URLSearchParams(window.location.search).get('access') === 'live' || new URLSearchParams(window.location.search).get('access') === 'transmission' || (new URLSearchParams(window.location.search).get('t') && (() => { try { const d = JSON.parse(atob(new URLSearchParams(window.location.search).get('t')!.startsWith('ZV_') ? new URLSearchParams(window.location.search).get('t')!.substring(3) : new URLSearchParams(window.location.search).get('t')!)); return d.a === 'live'; } catch(e){return false;} })())}
        isConnected={isConnected}
        onOpenLiveRoom={(res) => {
          setCurrentResident(res);
          setCurrentView(AppView.LIVE_ASSEMBLY);
        }}
        onBack={() => {
          if (currentUser) {
            setCurrentView(AppView.COMPANY_DASHBOARD);
          } else {
            setCurrentView(AppView.ADMIN_LOGIN);
          }
        }}
      />
    </div>
  );
};

const AppWrapper: React.FC = () => {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
};

export default AppWrapper;
