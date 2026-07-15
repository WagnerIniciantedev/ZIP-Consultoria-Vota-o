# ⚖️ CONDEVOTE LGPD COMPLIANCE & DATA PRIVACY PLAN

This document outlines the strict engineering controls and guidelines implemented in CondeVote (ZIP Consultoria) to ensure full compliance with Brazil's General Data Protection Law (**LGPD - Lei Geral de Proteção de Dados, Lei nº 13.709/2018**).

---

## 1. Core Privacy Pillars Implemented

CondeVote is built on the core LGPD principles of **minimization, necessity, purpose, and security**:

- **Minimização de Dados (Minimization)**: Only data strictly required to prove voter eligibility and run the assembly is processed (unit number, full name, ideal fraction, CPF first 5 digits, and contact email).
- **Legítimo Interesse e Consentimento (Consent & Legitimate Interest)**:
  - Condominium assemblies carry legal weight; thus, processing participant data is backed by legitimate legal obligations.
  - For online biometric verification (Selfie + Photo ID upload), explicit user permission is requested before camera access is activated.
- **Mascaramento e Anonimização (Data Masking)**:
  - Personal documents like CPFs and email addresses are masked or restricted in administrative logs (e.g., displaying `***.***.123-**`).
  - Standard participants are programmatically blocked from reading or scraping personal data belonging to other units.

---

## 2. Document Retention & Automated Deletion Policy

Under LGPD, sensitive personal data must not be stored indefinitely once the purpose of its processing has been resolved:

- **Verification Files**: Uploaded identity documents (RG/CNH and selfies) are used solely to grant presence check-in.
- **Automated Lifecycle Policy**: We recommend setting a Firebase Storage lifecycle rule to **automatically delete uploaded photos within 30 days** after an assembly's formal minutes (Ata) have been registered and signed.
- **Right to Rectification**: Residents can request updates to inaccurate email or registration data directly via the moderator panel.

---

## 3. Auditing and Access Traceability

To satisfy accountability demands under Article 6, X of LGPD:
- **Traceable Admin Operations**: All administrative operations (credential generation, manual check-ins, or status modifications) write structured audit logs.
- **Zero Sensitive Data in Logs**: Full CPFs, email credentials, passwords, and security tokens are strictly stripped and masked before logs are saved.
- **Encryption in Transit and at Rest**: All private databases use Advanced Encryption Standard (AES-256) at rest, and all client-to-server exchanges use Transport Layer Security (TLS 1.3).
