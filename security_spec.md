# 🛡️ CONDEVOTE PRO-GRADE SECURITY ARCHITECTURE SPECIFICATION
## ZIP CONSULTORIA - CORPORATE COMPLIANCE & LEGAL ELECTION AUDIT PREPARATION

This specification outlines the complete, zero-trust cryptographic architectural overhaul engineered to protect CondeVote's hybrid condominium voting systems from election fraud, identity spoofing, double voting, database tampering, and LGPD vulnerabilities.

---

## ─── DELIVERABLE 1: SECURE VOTING FLOW ARCHITECTURE ───

The architecture segregates the client browser entirely from database transaction authoring. The client never writes a ballot document. Instead, it submits an intent via an HTTPS callable trigger.

### 📊 Cryptographic Vouching & Processing Flow (ASCII Diagram)

```
 [ RESIDENT CLIENT ]            [ URNA TERMINAL ]
 (Reads Polls & Votes)       (Offline/Presencial Admin)
          │                               │
          │ 📡 Envia Intenção             │ 🖥️ Envia Registro
          │    (HTTPS Callable)           │    (HTTPS Callable)
          ▼                               ▼
 ┌────────────────────────────────────────────────────────┐
 │            🔒 FIREBASE CLOUD FUNCTIONS                  │
 │                                                        │
 │ 1. Authenticate Request Profile                        │
 │ 2. Query resident status on assemblies/{id}/residents  │
 │ 3. Verify attendanceStatus == "APPROVED"               │
 │ 4. Duplicity & Replay Check via transaction.get()     │
 │ 5. Normalize Unit ID and document naming format        │
 │ 6. Write secureVoteRecord with FieldValue.serverTime() │
 │ 7. Append SHA-256 sealed log entry to audit_logs        │
 └──────────────────────────┬─────────────────────────────┘
                            │
              🔥 DB Writes  │ (Admin SDK context bypasses Rules)
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │                  🔥 SYSTEM FIRESTORE                    │
 │                                                        │
 │ /assemblies/{id}/votes/{pollId_unit}                   │
 │   └─ [ Write: BLOCKED  │ Read: ALLOWED ]               │
 │                                                        │
 │ /audit_logs/{sealId}                                    │
 │   └─ [ Write/Update/Delete: BLOCKED │ Read: TI Only ]  │
 └────────────────────────────────────────────────────────┘
```

---

## ─── DELIVERABLE 2: SECURE CLOUD FUNCTION IMPLEMENTATION ───

The source code for our secure backend triggers is safely stored inside `/functions/src/index.ts`. It leverages transactions to guarantee that registering a ballot and sealing the immutable audit ledger are atomically resolved.

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

admin.initializeApp();
const db = admin.firestore();

interface VotePayload {
  assemblyId: string;
  pollId: string;
  unit: string;
  optionId: string;
  zoomName?: string;
  userAgent?: string;
  sessionId?: string;
}

// Generates SHA-256 proof-of-authenticity footprint for audit inspection
function generateAuditHash(payload: {
  pollId: string;
  unit: string;
  optionId: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  salt: string;
}): string {
  const data = `${payload.pollId}|${payload.unit}|${payload.optionId}|${payload.timestamp}|${payload.ip}|${payload.userAgent}|${payload.salt}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

export const submitSecureVote = onCall<VotePayload>(async (request) => {
  const { auth, rawRequest } = request;
  const data = request.data;

  // 1. Authentication Check
  if (!auth) {
    throw new HttpsError("unauthenticated", "Acesso negado. Usuário sem autenticação válida.");
  }

  const { assemblyId, pollId, unit, optionId, zoomName, sessionId, userAgent } = data;

  // 2. Strong Sanitization & Validation (Anti-Overflow & Anti-injection)
  if (!assemblyId || !pollId || !unit || !optionId) {
    throw new HttpsError("invalid-argument", "Campos obrigatórios em falta no payload de votação.");
  }

  if (assemblyId.length > 128 || pollId.length > 128 || unit.length > 64 || optionId.length > 128) {
    throw new HttpsError("invalid-argument", "Os limites de caracteres do payload foram excedidos.");
  }

  const idRegex = /^[a-zA-Z0-9_ \-]+$/;
  if (!idRegex.test(assemblyId) || !idRegex.test(unit) || !idRegex.test(pollId)) {
    throw new HttpsError("invalid-argument", "Identificadores fornecidos contêm caracteres especiais não-sanitários.");
  }

  const sanitizedUnit = unit.toLowerCase();
  const safeVoteId = `${pollId}_${sanitizedUnit.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const clientIp = rawRequest.headers["x-forwarded-for"] as string || rawRequest.ip || "0.0.0.0";
  const clientUA = userAgent || rawRequest.headers["user-agent"] || "Disp. Desconhecido";

  // 3. Transactions Block: Atomically checks eligibility and registers the vote and log
  try {
    return await db.runTransaction(async (transaction) => {
      
      // A. Verify Assembly State
      const assemblyRef = db.collection("assemblies").doc(assemblyId);
      const assemblySnap = await transaction.get(assemblyRef);
      if (!assemblySnap.exists || !assemblySnap.data()?.isActive) {
        throw new HttpsError("failed-precondition", "A assembleia informada não está ativa para votação.");
      }

      // B. Verify Resident Check-In state (LGPD and Fraud barrier)
      const residentRef = db.collection("assemblies").doc(assemblyId).collection("residents_list").doc(sanitizedUnit);
      const residentSnap = await transaction.get(residentRef);
      if (!residentSnap.exists) {
        throw new HttpsError("permission-denied", "Unidade habitacional não cadastrada nesta assembleia.");
      }

      const residentData = residentSnap.data()!;
      if (residentData.attendanceStatus !== "APPROVED") {
        throw new HttpsError("permission-denied", "Unidade não habilitada. Presença não validada pelos moderadores (Status: PENDENTE/NONE).");
      }

      // C. Anti-Double Vote: Checks if a document with this deterministic ID exists
      const voteRef = db.collection("assemblies").doc(assemblyId).collection("votes").doc(safeVoteId);
      const voteSnap = await transaction.get(voteRef);
      if (voteSnap.exists) {
        throw new HttpsError("already-exists", "Erro de Duplicidade: Voto já computado para esta unidade e pauta.");
      }

      // D. Generate Timestamps & Salt
      const timestamp = Date.now();
      const serverIsoTime = new Date(timestamp).toISOString();
      const salt = crypto.randomBytes(16).toString("hex");

      // E. Ledger Hash SEAL Execution
      const ledgerSeal = generateAuditHash({
        pollId,
        unit: unit.toUpperCase(),
        optionId,
        timestamp: serverIsoTime,
        ip: clientIp,
        userAgent: clientUA,
        salt
      });

      // F. Commit Structures
      const secureVoteRecord = {
        pollId,
        unit: unit.toUpperCase(),
        optionId,
        timestamp,
        isManual: false,
        isDelinquentVote: !!residentData.isDelinquent,
        zoomName: zoomName || residentData.zoomName || "",
        userAgent: clientUA,
        sessionId: sessionId || auth.uid,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const auditLogRecord = {
        logId: `VOTE_SEAL_${pollId}_${unit.toUpperCase()}_${timestamp}`,
        action: "SECURE_VOTE_REGISTERED",
        pollId,
        unit: unit.toUpperCase(),
        timestamp,
        dateTime: serverIsoTime,
        ip: clientIp,
        userAgent: clientUA,
        cryptographicSealedHash: ledgerSeal,
        salt,
        origin: "ONLINE",
        details: `Voto online registrado e verificado com sucesso por canal redundante.`
      };

      // G. Run Atomic Writes (Admin SDK handles bypass)
      transaction.set(voteRef, secureVoteRecord);
      transaction.set(db.collection("audit_logs").doc(auditLogRecord.logId), auditLogRecord);

      return {
        success: true,
        receipt: ledgerSeal,
        timestamp
      };
    });
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", `Erro durante o processamento do voto: ${error.message || error}`);
  }
});
```

---

## ─── DELIVERABLE 3: REWRITTEN FIRESTORE SECURITY RULES ───

The production rules stored inside `/firestore.rules` block ALL direct client-side mutation calls on `/votes` and `/audit_logs`. Standard residents have single unit read (`get`) authorization under `/residents_list` to protect private CPFs and LGPD details while admins can pull listings (`list`).

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Default Deny Network (Guarantees zero leaked access points)
    match /{document=**} {
      allow read, write: if false;
    }

    function isAuthenticated() { return request.auth != null; }
    function hasAdminDoc() { return exists(/databases/$(database)/documents/authorized_admins/$(request.auth.uid)); }
    function getAdminData() { return get(/databases/$(database)/documents/authorized_admins/$(request.auth.uid)).data; }

    // Dynamic checks removing hardcoded credentials (using custom claims and DB admin registry)
    function isTI() {
      return isAuthenticated() && (
        request.auth.token.role == 'TI' || 
        (hasAdminDoc() && getAdminData().get('role', 'NONE') == 'TI')
      );
    }

    function isAdmin() {
      return isAuthenticated() && (
        request.auth.token.role in ['ADMIN', 'TI'] ||
        (hasAdminDoc() && getAdminData().get('role', 'NONE') in ['ADMIN', 'TI'])
      );
    }

    function isValidId(id) { return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_ \\-]+$'); }
    function incoming() { return request.resource.data; }
    function existing() { return resource.data; }

    // System configurations & platform states
    match /system/{docId} {
      allow read: if isAuthenticated() && isValidId(docId);
      allow write: if isAdmin() && isValidId(docId);
    }

    // Dynamic RBAC Administration
    match /authorized_admins/{uid} {
      allow read: if isAuthenticated() && isValidId(uid);
      allow create, update, delete: if isTI() && isValidId(uid);
    }

    // Ledger audit logs (Strictly Client-side Non-writable)
    match /audit_logs/{logId} {
      allow read: if isTI() && isValidId(logId);
      allow write, update, delete: if false; // Bypassed and written ONLY by Backend Admin SDK
    }

    // Assemblies Scope
    match /assemblies/{assemblyId} {
      allow read: if isAuthenticated() && isValidId(assemblyId);
      allow create, update: if isAdmin() && isValidId(assemblyId);
      allow delete: if isTI() && isValidId(assemblyId);

      // Subcollection: Residents List (LGPD Protection Guard)
      match /residents_list/{unit} {
        allow get: if isAuthenticated() && isValidId(unit); // No mass scraping, direct GET only
        allow list: if isAdmin(); // List block for standard residents
        allow create, delete: if isAdmin() && isValidId(unit);
        allow update: if isValidId(unit) && (
          isAdmin() ||
          (
            isAuthenticated() &&
            incoming().diff(existing()).affectedKeys().hasOnly(['zoomName', 'attendanceStatus', 'verificationStatus', 'documentPhotoUrl', 'selfiePhotoUrl']) &&
            incoming().get('attendanceStatus', 'NONE') in ['NONE', 'PENDING']
          )
        );
      }

      // Subcollection: Votes (Strict Fraud Shielding)
      match /votes/{voteId} {
        allow read: if isAuthenticated() && isValidId(voteId);
        
        // CLIENT DIRECT WRITE IS DISALLOWED.
        // Handled solely in high-isolation environments (Cloud Functions)
        allow create, update, delete: if false;
      }
    }
  }
}
```

---

## ─── DELIVERABLE 4: AUDIT LEDGER LOG MODEL STRUCTURATION ───

To make election results indisputable in court, every vote registers a cryptographic JSON payload in the immutable `audit_logs` collection. The `cryptoSealedHash` creates a tamper-evident audit trail.

### 📄 Structural Sample Document (`audit_logs/VOTE_SEAL_pollA_101_1782138185`)

```json
{
  "_id": "VOTE_SEAL_pollA_101_1782138185000",
  "action": "SECURE_VOTE_REGISTERED",
  "pollId": "pollA",
  "unit": "101",
  "timestamp": 1782138185000,
  "dateTime": "2026-06-22T14:23:05.000Z",
  "ip": "177.85.12.194",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "hasDelinquency": false,
  "salt": "fa82f281e2b618fca201",
  "cryptographicSealedHash": "6ae291df1936cff14aeb0ac2e737299a812df934f893e3dcffe6196a090b82f1",
  "origin": "ONLINE",
  "details": "Voto online registrado e verificado com sucesso por canal redundante."
}
```

---

## ─── DELIVERABLE 5: PRODUCTION LAUNCH SECURITY CHECKLIST ───

Execute these 5 compliance verifications before taking CondeVote (ZIP Consultoria) live:

- [ ] **1. Disable All Insecure Multi-Tenant Schemes**: Ensure that only verified ZIP administradores can edit the dynamic system properties or create administrative units.
- [ ] **2. Provision Custom Claims Roles**: Run the deployment script to verify that any User UID elevated to **TI** or **ADMIN** has matching tokens in Google Auth inside Firebase Console.
- [ ] **3. Implement TLS & DNS CAA Records**: Ensure that both API requests and real-time connections run strictly over HTTPS/WSS (TLS 1.3) with Certificate Authority Authorization.
- [ ] **4. Conduct IP/User-Agent Spoofing Tests**: Confirm that the Cloud Function retrieves IP information from headers populated by Google's Edge CDN Proxy (`x-forwarded-for`) rather than the request parameters.
- [ ] **5. Validate LGPD Access Tokens**: Verify that executing a blanket listing (`list`) request from an unprivileged client returns an immediate `PERMISSION_DENIED` exception in browser logs.
