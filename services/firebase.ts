
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, update } from "firebase/database";

// ============================================================================
// INSTRUÇÕES:
// 1. O Google te deu um código parecido com: const firebaseConfig = { ... }
// 2. Copie os valores que o Google te deu (apiKey, authDomain, etc).
// 3. Substitua os textos "COLE_AQUI" abaixo pelos códigos do Google.
// 4. NÃO APAGUE os 'imports' acima nem o código 'export' no final.
// ============================================================================

const firebaseConfig = {
  apiKey:"AIzaSyDuzgGUGY2Q4050ML_0wbsNAXTWXgGdGeo",
  authDomain:"zip-consultoria-votacao.firebaseapp.com",
  databaseURL: "https://zip-consultoria-votacao-default-rtdb.firebaseio.com",
  projectId: "zip-consultoria-votacao",
  storageBucket: "zip-consultoria-votacao.firebasestorage.app",
  messagingSenderId: "922958275726",
  appId: "1:922958275726:web:94a52493bbe015a9b855df",
  measurementId: "G-6J3600FX44"
};

// ============================================================================
// NÃO MEXA DAQUI PARA BAIXO
// ============================================================================

let db: any = null;

try {
    // Verifica se a chave ainda é a padrão (placeholder) ou se já foi configurada
    if (firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("COLE_SUA_API_KEY")) {
        const app = initializeApp(firebaseConfig);
        db = getDatabase(app);
        console.log("✅ Firebase conectado com sucesso!");
    } else {
        console.warn("⚠️ Firebase não configurado. O sistema está rodando em modo offline.");
    }
} catch (error) {
    console.error("Erro ao inicializar Firebase:", error);
}

export { db };
export { ref, set, onValue, update };
