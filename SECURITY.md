# 🛡️ CONDEVOTE SECURITY MODEL & AUDIT COMPLIANCE CHARTER

This document specifies the professional security posture, cryptographic audit capabilities, and threat-modeling defense mechanisms implemented in CondeVote (ZIP Consultoria).

---

## 1. Zero-Trust Ballot Isolation Model

The core objective of CondeVote is to guarantee the **legal integrity of ballots**. If a standard client browser could directly write or mutate files in the database, a malicious actor could spoof unit numbers, commit double-voting, or modify existing votes.

CondeVote resolves this via an **isolation barrier**:
- **Client Direct Writes Blocked**: Direct write operations (`create`, `update`, `delete`) to `/votes` or `/audit_logs` collections are strictly denied for all client connections under `firestore.rules`.
- **Backend-Only Authority**: All ballots are authored by **Firebase Cloud Functions** (utilizing the Admin SDK). 
- **Double-Voting Prevention**: Cloud Functions process the ballot registration inside an **atomic database transaction**. The function validates:
  1. The resident check-in status (`attendanceStatus == "APPROVED"`).
  2. The unique unit record existence in the assembly's `/residents_list`.
  3. The exact deterministic document ID matching `${pollId}_${unit}` to prevent double ballots.

---

## 2. Immutable Cryptographic Seal Ledger

To ensure results are legally undisputable in court under civil litigation:
- **Tamper-Evident Logs**: Each registered ballot generates an entry in `/audit_logs`.
- **SHA-256 Signatures**: The server signs each ballot with an audit footprint containing the `pollId`, `unit`, `timestamp`, `ip`, `userAgent`, and a server-generated cryptographically secure `salt`.
- **Client Mutability Nullified**: The audit log collection is completely write-protected for clients.

---

## 3. OWASP Top 10 Mitigation Profile

| Vulnerability Profile | Mitigation Strategy |
| :--- | :--- |
| **A01:2021-Broken Access Control** | Standard clients are restricted from executing mass listing (`list`) of residents or logs. All administrative routes require active validation inside `authorized_admins` collections or Firebase Auth tokens. |
| **A02:2021-Cryptographic Failures** | Dynamic password hashing and cryptographic SHA-256 ledger seals utilizing 16-byte random salts. Sensitive client-to-server data runs strictly over TLS 1.3. |
| **A03:2021-Injection** | Input size thresholds and strict regular expression checks on all key inputs (e.g., regex constraints restricting unit strings to alphanumeric formats). |
| **A04:2021-Insecure Design** | Separation of concerns where the database structure is segmented by assembly keys. The client operates strictly under a read-only role for vote tallies. |
| **A05:2021-Security Misconfiguration** | Strict catch-all deny rule at the root level of Firestore Rules (`match /{document=**} { allow read, write: if false; }`). |

---

## 4. Administrative Security Partitioning

CondeVote segregates staff roles to limit administrative surface risks:
1. **T.I. (Technical Infrastructure)**: Full system access, capacity to delete assemblies, manage administrative user roles in `/authorized_admins`, and review core ledger logs.
2. **ADMIN (Staff/Moderators)**: Capacity to manage polls, initiate check-ins, verify resident documents (RG/Selfie), register manual presential ballots, and trigger credential dispatches. Standard admins cannot self-elevate or delete database registers.
