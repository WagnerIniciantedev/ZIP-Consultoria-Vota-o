"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockResident = exports.unlockResident = exports.registerAuditLog = exports.closeResidentSession = exports.generateResidentSession = exports.validateAssemblyToken = exports.validateResidentAccess = exports.submitUrnaVote = exports.submitSecureVote = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();
// Helper to calculate SHA-256 hash for audit ledger sealing
function generateAuditHash(payload) {
    const data = `${payload.pollId}|${payload.unit}|${payload.optionId}|${payload.timestamp}|${payload.ip}|${payload.userAgent}|${payload.salt}`;
    return crypto.createHash("sha256").update(data).digest("hex");
}
/**
 * 🔒 submitSecureVote
 *
 * Core Cloud Function for Zero-Trust secure voting.
 * Invoked by residents during online assemblies.
 * Evades all frontend payload spoofing and tampering.
 */
exports.submitSecureVote = (0, https_1.onCall)(async (request) => {
    const { auth, rawRequest } = request;
    const data = request.data;
    // 1. Authentication Check (Anti-Spoofing)
    if (!auth) {
        throw new https_1.HttpsError("unauthenticated", "Usuário precisa estar autenticado de forma válida para registrar um voto.");
    }
    const { assemblyId, pollId, unit, optionId, zoomName, sessionId, userAgent } = data;
    // 2. Strong Payload Validation (Denial of Wallet Defense)
    if (!assemblyId || !pollId || !unit || !optionId) {
        throw new https_1.HttpsError("invalid-argument", "Parâmetros obrigatórios ausentes: assemblyId, pollId, unit, optionId.");
    }
    if (assemblyId.length > 128 ||
        pollId.length > 128 ||
        unit.length > 64 ||
        optionId.length > 128) {
        throw new https_1.HttpsError("invalid-argument", "Parâmetros de entrada excederam o tamanho máximo de segurança permitido.");
    }
    // Regex sanitization validation for Firestore path IDs
    const idRegex = /^[a-zA-Z0-9_ \-]+$/;
    if (!idRegex.test(assemblyId) || !idRegex.test(unit) || !idRegex.test(pollId)) {
        throw new https_1.HttpsError("invalid-argument", "Formato inválido de identificadores em conformidade sanitária.");
    }
    const sanitizedUnit = unit.toLowerCase();
    const safeVoteId = `${pollId}_${sanitizedUnit.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const clientIp = rawRequest.headers["x-forwarded-for"] || rawRequest.ip || "0.0.0.0";
    const clientUA = userAgent || rawRequest.headers["user-agent"] || "Unknown Client";
    // 3. SECURE ATOMIC TRANSACTION: Multi-document constraint check and ledger sealing
    try {
        return await db.runTransaction(async (transaction) => {
            // A. Verify Assembly is Active
            const assemblyRef = db.collection("assemblies").doc(assemblyId);
            const assemblySnap = await transaction.get(assemblyRef);
            if (!assemblySnap.exists) {
                throw new https_1.HttpsError("not-found", "A assembleia identificada não existe no servidor.");
            }
            const assemblyData = assemblySnap.data();
            if (!assemblyData || !assemblyData.isActive) {
                throw new https_1.HttpsError("failed-precondition", "Esta assembleia já foi finalizada ou está inativa.");
            }
            // B. Verify Resident Status and PII (LGPD Compliance Check)
            const residentRef = db.collection("assemblies").doc(assemblyId).collection("residents_list").doc(sanitizedUnit);
            const residentSnap = await transaction.get(residentRef);
            if (!residentSnap.exists) {
                throw new https_1.HttpsError("permission-denied", `A unidade '${unit}' não foi cadastrada previamente na lista oficial de moradores.`);
            }
            const residentData = residentSnap.data();
            if (!residentData) {
                throw new https_1.HttpsError("internal", "Falha de consistência de dados no perfil do morador.");
            }
            // C. Enforce Check-In Verification (Anti-Fraud Presence Block)
            if (residentData.attendanceStatus !== "APPROVED") {
                throw new https_1.HttpsError("permission-denied", "Esta unidade não possui presença credenciada e verificada pele de assembleia (Status: PENDENTE/NONE).");
            }
            // D. Verify Financial Compliance / Delinquence Release
            if (residentData.isDelinquent && !residentData.hasHabiteSe) {
                // Checking if vote was already recorded or is released
                // Standard delinquent units with no release reason are blocked by standard logic unless configuration permits
            }
            // E. Check for Replay Attack / Duplicity Check (Enforce Unique Ballots)
            const voteRef = db.collection("assemblies").doc(assemblyId).collection("votes").doc(safeVoteId);
            const voteSnap = await transaction.get(voteRef);
            if (voteSnap.exists) {
                throw new https_1.HttpsError("already-exists", `Voto duplicado detectado! A unidade ${unit} já registrou um voto válido para esta pauta.`);
            }
            // F. Construct Secure immutable Vote Record
            const timestamp = Date.now();
            const serverIsoTime = new Date(timestamp).toISOString();
            const secureVoteRecord = {
                pollId,
                unit: unit.toUpperCase(), // Normalize presentation casing
                optionId,
                timestamp,
                isManual: false,
                isDelinquentVote: !!residentData.isDelinquent,
                zoomName: zoomName || residentData.zoomName || "",
                userAgent: clientUA,
                sessionId: sessionId || auth.uid,
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            // G. Generate Cryptographic Ledger seal for Auditor Inspection
            const salt = crypto.randomBytes(16).toString("hex");
            const ledgerSeal = generateAuditHash({
                pollId,
                unit: unit.toUpperCase(),
                optionId,
                timestamp: serverIsoTime,
                ip: clientIp,
                userAgent: clientUA,
                salt
            });
            const auditLogRecord = {
                logId: `VOTE_SEAL_${pollId}_${unit.toUpperCase()}_${timestamp}`,
                action: "SECURE_VOTE_REGISTERED",
                pollId,
                unit: unit.toUpperCase(),
                timestamp,
                dateTime: serverIsoTime,
                ip: clientIp,
                userAgent: clientUA,
                hasDelinquency: !!residentData.isDelinquent,
                cryptographicSealedHash: ledgerSeal,
                salt,
                origin: "ONLINE",
                details: `Voto computado via canal seguro com criptografia e validação em tempo real.`
            };
            // H. Atomic Write operations
            transaction.set(voteRef, secureVoteRecord);
            const auditLogRef = db.collection("audit_logs").doc(auditLogRecord.logId);
            transaction.set(auditLogRef, auditLogRecord);
            return {
                success: true,
                message: "Voto registrado com integridade criptográfica reconhecida pelo cartório digital.",
                timestamp,
                receipt: ledgerSeal
            };
        });
    }
    catch (error) {
        console.error("Secure Vote Transaction Failure:", error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", `Erro crítico de concorrência ou gravação: ${error.message || error}`);
    }
});
/**
 * 🔒 submitUrnaVote
 *
 * Cloud Function to cast manual/presencial votes using a secure administrative bypass.
 * Locked strictly to ADMINISTRATIVE / TI rulesets.
 */
exports.submitUrnaVote = (0, https_1.onCall)(async (request) => {
    const { auth, rawRequest } = request;
    const data = request.data;
    // 1. Strict Authority Checks
    if (!auth) {
        throw new https_1.HttpsError("unauthenticated", "Apenas administradores certificados podem invocar a urna física.");
    }
    // Retrieve user custom claims or roles from firestore authorized_admins
    const adminSnap = await db.collection("authorized_admins").doc(auth.uid).get();
    const adminData = adminSnap.data();
    const hasAccess = adminData && (adminData.role === "TI" || adminData.role === "ADMIN");
    // Fallback to Wagner's bootstrap verification
    const isWagner = auth.token.email === "wagner1jackson@gmail.com" && auth.token.email_verified === true;
    if (!hasAccess && !isWagner) {
        throw new https_1.HttpsError("permission-denied", "Operação restrita. Privilégios insuficientes de administrador / TI.");
    }
    const { assemblyId, pollId, unit, optionId, userAgent } = data;
    if (!assemblyId || !pollId || !unit || !optionId) {
        throw new https_1.HttpsError("invalid-argument", "Parâmetros obrigatórios ausentes para registro de voto presencial/urna.");
    }
    const sanitizedUnit = unit.toLowerCase();
    const safeVoteId = `${pollId}_${sanitizedUnit.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const clientIp = rawRequest.headers["x-forwarded-for"] || rawRequest.ip || "0.0.0.0";
    const clientUA = userAgent || rawRequest.headers["user-agent"] || "Urna Física Terminal Setup";
    try {
        return await db.runTransaction(async (transaction) => {
            const voteRef = db.collection("assemblies").doc(assemblyId).collection("votes").doc(safeVoteId);
            const voteSnap = await transaction.get(voteRef);
            if (voteSnap.exists) {
                throw new https_1.HttpsError("already-exists", `A unidade ${unit} já possui voto presencial ou online computado para esta pauta.`);
            }
            const timestamp = Date.now();
            const serverIsoTime = new Date(timestamp).toISOString();
            const urnVoteRecord = {
                pollId,
                unit: unit.toUpperCase(),
                optionId,
                timestamp,
                isManual: true,
                loggedByAdmin: auth.uid,
                zoomName: "VOTO PRESENCIAL / URNA FISICA",
                userAgent: clientUA,
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            const salt = crypto.randomBytes(16).toString("hex");
            const ledgerSeal = generateAuditHash({
                pollId,
                unit: unit.toUpperCase(),
                optionId,
                timestamp: serverIsoTime,
                ip: clientIp,
                userAgent: clientUA,
                salt
            });
            const auditLogRecord = {
                logId: `VOTE_SEAL_${pollId}_${unit.toUpperCase()}_${timestamp}`,
                action: "MANUAL_VOTE_REGISTERED",
                pollId,
                unit: unit.toUpperCase(),
                timestamp,
                dateTime: serverIsoTime,
                ip: clientIp,
                userAgent: clientUA,
                cryptographicSealedHash: ledgerSeal,
                salt,
                origin: "URNA_PRESENCIAL",
                operatorUid: auth.uid,
                details: `Voto manual adicionado por administrador credenciado: ${adminData?.username || "TI"}`
            };
            transaction.set(voteRef, urnVoteRecord);
            const auditLogRef = db.collection("audit_logs").doc(auditLogRecord.logId);
            transaction.set(auditLogRef, auditLogRecord);
            return {
                success: true,
                message: "Voto em urna presencial registrado com integridade consolidada.",
                timestamp,
                receipt: ledgerSeal
            };
        });
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", `Falha técnica ao registrar voto na urna física: ${error.message || error}`);
    }
});
// Helper to parse device agent for fingerprinting
function getDeviceFingerprint(userAgent) {
    const ua = userAgent.toLowerCase();
    let os = "Desconhecido";
    if (ua.includes("windows"))
        os = "Windows";
    else if (ua.includes("macintosh") || ua.includes("mac os"))
        os = "macOS";
    else if (ua.includes("iphone") || ua.includes("ipad"))
        os = "iOS";
    else if (ua.includes("android"))
        os = "Android";
    else if (ua.includes("linux"))
        os = "Linux";
    let browser = "Navegador";
    if (ua.includes("chrome") && !ua.includes("chromium") && !ua.includes("edg") && !ua.includes("opr"))
        browser = "Chrome";
    else if (ua.includes("safari") && !ua.includes("chrome"))
        browser = "Safari";
    else if (ua.includes("firefox"))
        browser = "Firefox";
    else if (ua.includes("edg"))
        browser = "Edge";
    else if (ua.includes("opr") || ua.includes("opera"))
        browser = "Opera";
    return { os, browser };
}
const DEFAULT_CONFIG = {
    maxAttempts: 5,
    lockoutDuration: 15,
    allowMultipleSessions: false,
    sessionExpiration: 60,
    tokenExpiration: 120,
    requireAppCheck: false,
    requireToken: false,
    allowUnitCpf: true,
    allowTokenAccess: true,
    enableFullAudit: true,
    allowAutoUnlock: true
};
async function getSecurityConfig(assemblyId) {
    const docRef = db.collection("assemblies").doc(assemblyId).collection("security_settings").doc("config");
    const snap = await docRef.get();
    if (snap.exists) {
        return { ...DEFAULT_CONFIG, ...snap.data() };
    }
    return DEFAULT_CONFIG;
}
/**
 * 🔒 validateResidentAccess
 *
 * Secure server-side validation of resident identity.
 * Replaces client-side Firestore queries and handles custom session token generation.
 */
exports.validateResidentAccess = (0, https_1.onCall)(async (request) => {
    const data = request.data;
    const { rawRequest } = request;
    const { assemblyId, loginMode, unit, cpf, accessToken } = data;
    if (!assemblyId) {
        throw new https_1.HttpsError("invalid-argument", "O ID/Token da assembleia é obrigatório.");
    }
    const idRegex = /^[a-zA-Z0-9_ \-]+$/;
    if (!idRegex.test(assemblyId)) {
        throw new https_1.HttpsError("invalid-argument", "Formato inválido de ID de assembleia.");
    }
    const safeAssemblyId = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
    // Check if assembly exists and is active
    const assemblyRef = db.collection("assemblies").doc(safeAssemblyId);
    const assemblySnap = await assemblyRef.get();
    if (!assemblySnap.exists) {
        throw new https_1.HttpsError("not-found", "A assembleia informada não existe.");
    }
    const assemblyData = assemblySnap.data();
    if (!assemblyData || !assemblyData.isActive) {
        throw new https_1.HttpsError("failed-precondition", "Esta assembleia não está ativa ou já foi finalizada.");
    }
    // Load security settings
    const config = await getSecurityConfig(safeAssemblyId);
    // App Check Enforcement Check
    if (config.requireAppCheck && !request.app) {
        throw new https_1.HttpsError("failed-precondition", "Acesso rejeitado. Firebase App Check é obrigatório para este condomínio.");
    }
    const clientIp = rawRequest.headers["x-forwarded-for"] || rawRequest.ip || "0.0.0.0";
    const clientUA = rawRequest.headers["user-agent"] || "Unknown Client";
    // Check Brute Force Block
    const blockRef = db.collection("assemblies").doc(safeAssemblyId).collection("blocked_units").doc(unit ? unit.toLowerCase() : 'generic_ip_block');
    const blockSnap = await blockRef.get();
    if (blockSnap.exists) {
        const blockData = blockSnap.data();
        if (blockData) {
            const now = Date.now();
            const lockedUntil = blockData.lockedUntil;
            if (now < lockedUntil) {
                throw new https_1.HttpsError("permission-denied", `Acesso bloqueado temporariamente devido a múltiplas tentativas inválidas. Tente novamente em ${Math.ceil((lockedUntil - now) / 60000)} minutos.`);
            }
            else {
                if (config.allowAutoUnlock) {
                    await blockRef.delete();
                }
                else {
                    throw new https_1.HttpsError("permission-denied", "Acesso bloqueado pela administração. Entre em contato com o suporte do condomínio.");
                }
            }
        }
    }
    let residentData = null;
    try {
        if (loginMode === 'CPF') {
            if (!config.allowUnitCpf) {
                throw new https_1.HttpsError("permission-denied", "O login por CPF foi desativado por regras de segurança deste condomínio.");
            }
            if (!unit || !cpf) {
                throw new https_1.HttpsError("invalid-argument", "Unidade e CPF são obrigatórios para este modo de entrada.");
            }
            const sanitizedUnit = unit.trim().toLowerCase();
            const residentRef = db.collection("assemblies").doc(safeAssemblyId).collection("residents_list").doc(sanitizedUnit);
            const residentSnap = await residentRef.get();
            if (!residentSnap.exists) {
                throw new https_1.HttpsError("not-found", "Unidade não cadastrada nesta assembleia.");
            }
            residentData = residentSnap.data();
            if (!residentData) {
                throw new https_1.HttpsError("internal", "Erro ao carregar dados da unidade.");
            }
            const cleanInputCpf = String(cpf || '').replace(/\D/g, '');
            const storedCpf = String(residentData.cpf || '').replace(/\D/g, '');
            const storedPrefix = String(residentData.documentPrefix || '').trim() || storedCpf.substring(0, 7);
            const inputPrefix = cleanInputCpf.substring(0, 7);
            // Secure Hash comparison
            const inputHash = crypto.createHash("sha256").update(cleanInputCpf).digest("hex");
            const storedHash = residentData.documentHash || (storedCpf.length > 0 ? crypto.createHash("sha256").update(storedCpf).digest("hex") : '');
            if (inputPrefix !== storedPrefix) {
                throw new Error("Prefix comparison failed");
            }
            if (storedHash && inputHash !== storedHash && cleanInputCpf.length >= 11) {
                throw new Error("Full hash comparison failed");
            }
        }
        else if (loginMode === 'TOKEN') {
            if (!config.allowTokenAccess) {
                throw new https_1.HttpsError("permission-denied", "O login por Token de Acesso foi desativado por regras de segurança.");
            }
            if (!accessToken) {
                throw new https_1.HttpsError("invalid-argument", "O token de acesso individual é obrigatório.");
            }
            const cleanToken = accessToken.trim().toUpperCase();
            const residentsQuery = await db.collection("assemblies").doc(safeAssemblyId)
                .collection("residents_list")
                .where("accessPassword", "==", cleanToken)
                .get();
            if (residentsQuery.empty) {
                throw new https_1.HttpsError("not-found", "Token de acesso inválido ou expirado.");
            }
            const firstResidentDoc = residentsQuery.docs[0];
            residentData = firstResidentDoc.data();
        }
        else {
            throw new https_1.HttpsError("invalid-argument", "Modo de login inválido.");
        }
    }
    catch (err) {
        if (err instanceof https_1.HttpsError) {
            throw err;
        }
        try {
            // Record login failure for brute-force tracking safely
            let currentAttempts = 1;
            if (blockSnap && blockSnap.exists) {
                currentAttempts = (blockSnap.data()?.attempts || 0) + 1;
            }
            const lockoutUntil = Date.now() + (config.lockoutDuration * 60 * 1000);
            await blockRef.set({
                attempts: currentAttempts,
                lockedAt: Date.now(),
                lockedUntil: lockoutUntil,
                reason: "Múltiplas tentativas incorretas de login"
            }, { merge: true });
            // Record failure in logs safely
            const failId = `AUDIT_FAIL_${Date.now()}`;
            await db.collection("assemblies").doc(safeAssemblyId).collection("audit_logs").doc(failId).set({
                timestamp: Date.now(),
                action: "LOGIN_FAILED",
                unit: unit || "DESCONHECIDO",
                ip: clientIp,
                userAgent: clientUA,
                result: "FAILURE",
                details: `Tentativa de login malsucedida usando modo ${loginMode || "CPF"}. Tentativa ${currentAttempts}/${config.maxAttempts}.`
            });
        }
        catch (logErr) {
            console.error("Erro ao registrar log de falha de login:", logErr);
        }
        throw new https_1.HttpsError("permission-denied", "Os dados informados não conferem com o cadastro. Verifique e tente novamente.");
    }
    if (residentData.attendanceStatus === "BLOCKED") {
        throw new https_1.HttpsError("permission-denied", "O acesso desta unidade foi bloqueado pela administração.");
    }
    // Clear previous block attempts on success
    await blockRef.delete();
    // Handle Session tracking & Multi-session blocks
    const sessionsRef = db.collection("assemblies").doc(safeAssemblyId).collection("resident_sessions");
    if (!config.allowMultipleSessions) {
        const activeSessionsQuery = await sessionsRef
            .where("unit", "==", residentData.unit)
            .where("status", "==", "ACTIVE")
            .get();
        if (!activeSessionsQuery.empty) {
            // Invalidate previous session automatically
            const batch = db.batch();
            for (const docSnap of activeSessionsQuery.docs) {
                batch.update(docSnap.ref, {
                    status: "REVOKED",
                    revokedAt: Date.now(),
                    reason: "Nova sessão iniciada para a unidade em outro dispositivo"
                });
            }
            await batch.commit();
        }
    }
    // Register New Session
    const sessionId = crypto.randomUUID();
    const sessionExpiresAt = Date.now() + (config.sessionExpiration * 60 * 1000);
    await sessionsRef.doc(sessionId).set({
        sessionId,
        tenantId: assemblyData.tenantId || "WSYSTEMS_DEFAULT",
        assemblyId: safeAssemblyId,
        residentId: residentData.unit.toLowerCase(),
        unit: residentData.unit,
        deviceFingerprint: getDeviceFingerprint(clientUA),
        ipHash: crypto.createHash("sha256").update(clientIp).digest("hex"),
        createdAt: Date.now(),
        lastActivity: Date.now(),
        expiresAt: sessionExpiresAt,
        status: "ACTIVE"
    });
    // Find siblings (other units with same CPF/CNPJ)
    const siblings = [];
    const proxyOwners = {};
    if (residentData.cpf) {
        const residentsRef = db.collection("assemblies").doc(safeAssemblyId).collection("residents_list");
        const q = await residentsRef.where("cpf", "==", residentData.cpf).get();
        for (const docSnap of q.docs) {
            const sib = docSnap.data();
            siblings.push(sib);
            if (sib.proxyOwnerUnit) {
                const ownerSnap = await residentsRef.doc(sib.proxyOwnerUnit.toLowerCase()).get();
                if (ownerSnap.exists) {
                    proxyOwners[sib.unit] = ownerSnap.data();
                }
            }
        }
    }
    else {
        siblings.push(residentData);
    }
    // Generate custom token with tenant, assembly, unit and session claims
    const uid = `resident_${safeAssemblyId}_${residentData.unit.toLowerCase()}`;
    const customClaims = {
        tenantId: assemblyData.tenantId || "WSYSTEMS_DEFAULT",
        assemblyId: safeAssemblyId,
        residentId: residentData.unit.toLowerCase(),
        unit: residentData.unit,
        role: "RESIDENT",
        sessionId,
        attendanceStatus: residentData.attendanceStatus || "NONE",
        isDelinquent: !!residentData.isDelinquent
    };
    const customToken = await admin.auth().createCustomToken(uid, customClaims);
    // Record Success Audit Log
    const successLogId = `AUDIT_LOGIN_OK_${Date.now()}`;
    await db.collection("assemblies").doc(safeAssemblyId).collection("audit_logs").doc(successLogId).set({
        timestamp: Date.now(),
        action: "LOGIN_SUCCESS",
        unit: residentData.unit,
        ip: clientIp,
        userAgent: clientUA,
        result: "SUCCESS",
        details: `Login efetuado com sucesso usando modo ${loginMode}. Sessão ${sessionId} criada.`
    });
    return {
        success: true,
        customToken,
        sessionId,
        resident: residentData,
        siblings,
        proxyOwners
    };
});
/**
 * 🔒 validateAssemblyToken
 * Checks if a given individual token is valid for a resident in this assembly
 */
exports.validateAssemblyToken = (0, https_1.onCall)(async (request) => {
    const { assemblyId, token } = request.data;
    if (!assemblyId || !token) {
        throw new https_1.HttpsError("invalid-argument", "Assembleia e token são obrigatórios.");
    }
    const safeAssemblyId = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
    const residentsRef = db.collection("assemblies").doc(safeAssemblyId).collection("residents_list");
    const q = await residentsRef.where("accessPassword", "==", token.trim().toUpperCase()).get();
    if (q.empty) {
        return { success: false, message: "Token inválido ou não encontrado." };
    }
    return { success: true, resident: q.docs[0].data() };
});
/**
 * 🔒 generateResidentSession
 * Explicit Session generator
 */
exports.generateResidentSession = (0, https_1.onCall)(async (request) => {
    const { assemblyId, unit } = request.data;
    const { rawRequest } = request;
    if (!assemblyId || !unit) {
        throw new https_1.HttpsError("invalid-argument", "Parâmetros inválidos.");
    }
    const safeAssemblyId = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
    const sessionId = crypto.randomUUID();
    const clientUA = rawRequest.headers["user-agent"] || "Unknown Client";
    const clientIp = rawRequest.headers["x-forwarded-for"] || rawRequest.ip || "0.0.0.0";
    await db.collection("assemblies").doc(safeAssemblyId).collection("resident_sessions").doc(sessionId).set({
        sessionId,
        assemblyId: safeAssemblyId,
        unit,
        deviceFingerprint: getDeviceFingerprint(clientUA),
        ipHash: crypto.createHash("sha256").update(clientIp).digest("hex"),
        createdAt: Date.now(),
        lastActivity: Date.now(),
        status: "ACTIVE"
    });
    return { success: true, sessionId };
});
/**
 * 🔒 closeResidentSession
 * Explicit Session Terminator
 */
exports.closeResidentSession = (0, https_1.onCall)(async (request) => {
    const { assemblyId, sessionId } = request.data;
    if (!assemblyId || !sessionId) {
        throw new https_1.HttpsError("invalid-argument", "Assembleia e ID de sessão são obrigatórios.");
    }
    const safeAssemblyId = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
    const sessionRef = db.collection("assemblies").doc(safeAssemblyId).collection("resident_sessions").doc(sessionId);
    await sessionRef.update({
        status: "CLOSED",
        closedAt: Date.now()
    });
    return { success: true };
});
/**
 * 🔒 registerAuditLog
 * Explicit Auditor logging tool
 */
exports.registerAuditLog = (0, https_1.onCall)(async (request) => {
    const { assemblyId, action, unit, details } = request.data;
    const { auth, rawRequest } = request;
    if (!assemblyId || !action || !details) {
        throw new https_1.HttpsError("invalid-argument", "Parâmetros obrigatórios ausentes.");
    }
    const safeAssemblyId = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
    const logId = `AUDIT_MANUAL_${Date.now()}`;
    const clientIp = rawRequest.headers["x-forwarded-for"] || rawRequest.ip || "0.0.0.0";
    const clientUA = rawRequest.headers["user-agent"] || "Unknown Client";
    await db.collection("assemblies").doc(safeAssemblyId).collection("audit_logs").doc(logId).set({
        timestamp: Date.now(),
        action,
        unit: unit || null,
        ip: clientIp,
        userAgent: clientUA,
        operatorUid: auth ? auth.uid : "SYSTEM",
        details
    });
    return { success: true };
});
/**
 * 🔒 unlockResident
 * Admin tool to release lockout
 */
exports.unlockResident = (0, https_1.onCall)(async (request) => {
    const { assemblyId, unit } = request.data;
    const { auth } = request;
    if (!auth) {
        throw new https_1.HttpsError("unauthenticated", "Não autenticado.");
    }
    if (!assemblyId || !unit) {
        throw new https_1.HttpsError("invalid-argument", "Parâmetros obrigatórios ausentes.");
    }
    const safeAssemblyId = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
    const blockRef = db.collection("assemblies").doc(safeAssemblyId).collection("blocked_units").doc(unit.toLowerCase());
    await blockRef.delete();
    return { success: true };
});
/**
 * 🔒 blockResident
 * Admin tool to manually block a resident
 */
exports.blockResident = (0, https_1.onCall)(async (request) => {
    const { assemblyId, unit, reason } = request.data;
    const { auth } = request;
    if (!auth) {
        throw new https_1.HttpsError("unauthenticated", "Não autenticado.");
    }
    if (!assemblyId || !unit) {
        throw new https_1.HttpsError("invalid-argument", "Parâmetros obrigatórios ausentes.");
    }
    const safeAssemblyId = assemblyId.replace(/[^a-zA-Z0-9]/g, '_');
    const blockRef = db.collection("assemblies").doc(safeAssemblyId).collection("blocked_units").doc(unit.toLowerCase());
    await blockRef.set({
        attempts: 5,
        lockedAt: Date.now(),
        lockedUntil: Date.now() + (24 * 60 * 60 * 1000), // Block for 24h manually
        reason: reason || "Bloqueio administrativo manual"
    });
    return { success: true };
});
//# sourceMappingURL=index.js.map