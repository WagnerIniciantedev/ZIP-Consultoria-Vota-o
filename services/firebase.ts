
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
  apiKey: "COLE_SUA_API_KEY_AQUI",             
  authDomain: "COLE_SEU_AUTH_DOMAIN_AQUI",     
  databaseURL: "COLE_SUA_DATABASE_URL_AQUI",   
  projectId: "COLE_SEU_PROJECT_ID_AQUI",       
  storageBucket: "COLE_SEU_STORAGE_BUCKET_AQUI",
  messagingSenderId: "COLE_SEU_SENDER_ID_AQUI",
  appId: "COLE_SEU_APP_ID_AQUI"
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
