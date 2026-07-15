
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, getDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// ============================================================================
// CONFIGURAÇÃO DO FIREBASE (FIRESTORE + AUTH)
// ============================================================================

const firebaseConfig = {
  apiKey: "AIzaSyDuzgGUGY2Q4050ML_0wbsNAXTWXgGdGeo",
  authDomain: "zip-consultoria-votacao.firebaseapp.com",
  databaseURL: "https://zip-consultoria-votacao-default-rtdb.firebaseio.com",
  projectId: "zip-consultoria-votacao",
  storageBucket: "zip-consultoria-votacao.firebasestorage.app",
  messagingSenderId: "922958275726",
  appId: "1:922958275726:web:94a52493bbe015a9b855df",
  measurementId: "G-6J3600FX44"
};

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

let db: any = null;
let auth: any = null;

try {
    const app = initializeApp(firebaseConfig);
    // Inicializa o Firestore
    db = getFirestore(app);
    // Inicializa a Autenticação
    auth = getAuth(app);
    
    console.log("✅ Firebase Firestore e Auth inicializados!");

    // ============================================================================
    // ACTIVATION OF FIREBASE APP CHECK (Zero-Trust Anti-Abuse Shield)
    // ============================================================================
    if (typeof window !== "undefined") {
        const appCheckKey = (import.meta as any).env?.VITE_RECAPTCHA_V3_KEY;
        if (appCheckKey) {
            initializeAppCheck(app, {
                provider: new ReCaptchaV3Provider(appCheckKey),
                isTokenAutoRefreshEnabled: true
            });
            console.log("🔒 Firebase App Check ativado via ReCAPTCHA v3!");
        } else {
            console.info("ℹ️ Firebase App Check: Forneça VITE_RECAPTCHA_V3_KEY nas variáveis de ambiente para ativar o escudo anti-abuso.");
        }
    }
} catch (error) {
    console.error("Erro ao inicializar Firebase:", error);
}

export { db, auth, signInAnonymously };
export { doc, setDoc, deleteDoc, onSnapshot, getDoc };
