
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, getDoc } from "firebase/firestore";

// ============================================================================
// CONFIGURAÇÃO DO FIREBASE (FIRESTORE)
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

try {
    const app = initializeApp(firebaseConfig);
    // Inicializa o Firestore em vez do Realtime DB
    db = getFirestore(app);
    console.log("✅ Firestore conectado com sucesso!");
} catch (error) {
    console.error("Erro ao inicializar Firebase:", error);
}

export { db };
export { doc, setDoc, deleteDoc, onSnapshot, getDoc };
