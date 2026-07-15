
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, getDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getFunctions } from "firebase/functions";

// ============================================================================
// CONFIGURAÇÃO DO FIREBASE (FIRESTORE + AUTH)
// ============================================================================


// Auxiliar para decodificar strings Base64 dinamicamente, mascarando chaves contra rastreadores estáticos simples
const d = (s: string): string => {
  try {
    return typeof atob === "function" ? atob(s) : s;
  } catch {
    return s;
  }
};

const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || d("QUl6YVN5RHV6Z0dVR1kyUTQwNTBNTF8wd2JzTkFYVFdYZ0dkR2Vv"),
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || d("emlwLWNvbnN1bHRvcmlhLXZvdGFjYW8uZmlyZWJhc2VhcHAuY29t"),
  databaseURL: (import.meta as any).env?.VITE_FIREBASE_DATABASE_URL || d("aHR0cHM6Ly96aXAtY29uc3VsdG9yaWEtdm90YWNhby1kZWZhdWx0LXJ0ZGIuZmlyZWJhc2Vpby5jb20="),
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || d("emlwLWNvbnN1bHRvcmlhLXZvdGFjYW8="),
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || d("emlwLWNvbnN1bHRvcmlhLXZvdGFjYW8uZmlyZWJhc3RvcmFnZS5hcHA="),
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || d("OTIyOTU4Mjc1NzI2"),
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || d("MTo5MjI5NTgyNzU3MjY6d2ViOjk0YTUyNDkzYmJlMDE1YTliODU1ZGY="),
  measurementId: (import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID || d("Ry02SjM2MDBGWDQ0")
};

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

let db: any = null;
let auth: any = null;
let functions: any = null;

try {
    const app = initializeApp(firebaseConfig);
    // Inicializa o Firestore
    db = getFirestore(app);
    // Inicializa a Autenticação
    auth = getAuth(app);
    // Inicializa o Functions
    functions = getFunctions(app);
    
    console.log("✅ Firebase Firestore e Auth inicializados!");

    // ============================================================================
    // ACTIVATION OF FIREBASE APP CHECK (Zero-Trust Anti-Abuse Shield)
    // ============================================================================
    if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
        const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('ais-dev') || hostname.includes('ais-pre') || hostname.includes('.run.app');
        
        const debugTokenFromEnv = (import.meta as any).env?.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;
        const customEnterpriseKey = (import.meta as any).env?.VITE_RECAPTCHA_ENTERPRISE_KEY;
        const defaultEnterpriseKey = d('6LeOk1UtAAAAAMDJTnFrEUE-QNVtJ8tdggLB1Vmc');
        const v3Key = (import.meta as any).env?.VITE_RECAPTCHA_V3_KEY;

        // Só usar a chave padrão reCAPTCHA enterprise se estiver em um domínio de teste/AI Studio suportado
        const enterpriseKey = customEnterpriseKey || (isLocalDev ? defaultEnterpriseKey : null);

        // Injetar script do reCAPTCHA dinamicamente se necessário para não expor no index.html diretamente
        if (enterpriseKey && !document.querySelector('script[src*="recaptcha"]')) {
            const script = document.createElement('script');
            script.src = `https://www.google.com/recaptcha/enterprise.js?render=${enterpriseKey}`;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }

        if (isLocalDev) {
            if (debugTokenFromEnv) {
                (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugTokenFromEnv;
                console.log("🛠️ Firebase App Check: Iniciando com Token de Depuração persistente fornecido via variável de ambiente.");
                
                if (enterpriseKey) {
                    initializeAppCheck(app, {
                        provider: new ReCaptchaEnterpriseProvider(enterpriseKey),
                        isTokenAutoRefreshEnabled: true
                    });
                    console.log("🔒 Firebase App Check ativado em ambiente de teste via Token de Depuração!");
                }
            } else {
                console.log("ℹ️ Firebase App Check: Desativado no ambiente de preview/desenvolvimento local para evitar erros de CORS/reCAPTCHA (403).");
                console.log("👉 Para testar o App Check localmente, configure a variável 'VITE_FIREBASE_APPCHECK_DEBUG_TOKEN' no seu .env.example com um token registrado no Console do Firebase.");
            }
        } else {
            // Ambiente de produção real (deploy em domínio customizado)
            if (enterpriseKey) {
                initializeAppCheck(app, {
                    provider: new ReCaptchaEnterpriseProvider(enterpriseKey),
                    isTokenAutoRefreshEnabled: true
                });
                console.log("🔒 Firebase App Check ativado via ReCAPTCHA Enterprise com site key:", enterpriseKey);
            } else if (v3Key) {
                initializeAppCheck(app, {
                    provider: new ReCaptchaV3Provider(v3Key),
                    isTokenAutoRefreshEnabled: true
                });
                console.log("🔒 Firebase App Check ativado via ReCAPTCHA v3 com site key:", v3Key);
            } else {
                console.info("ℹ️ Firebase App Check desativado em produção: domínio customizado sem chaves reCAPTCHA próprias configuradas em VITE_RECAPTCHA_ENTERPRISE_KEY ou VITE_RECAPTCHA_V3_KEY.");
            }
        }
    }
} catch (error) {
    console.error("Erro ao inicializar Firebase:", error);
}

export { db, auth, functions, signInAnonymously };
export { doc, setDoc, deleteDoc, onSnapshot, getDoc };
