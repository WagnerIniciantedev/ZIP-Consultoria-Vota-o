
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, getDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

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
} catch (error) {
    console.error("Erro ao inicializar Firebase:", error);
}

export { db, auth, signInAnonymously };
export { doc, setDoc, deleteDoc, onSnapshot, getDoc };
