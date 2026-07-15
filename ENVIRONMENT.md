# 🗝️ CONDEVOTE SECRET & ENVIRONMENT VARIABLE COMPLIANCE

This document outlines the strict guidelines for managing environment variables, public API keys, and sensitive backend secrets within the CondeVote platform.

---

## 1. Secrets Separation Policy

CondeVote follows a strict separation between public identifiers and sensitive private keys:

| Parameter | Type | Exposure Scope | Storage Guideline |
| :--- | :--- | :--- | :--- |
| `firebaseConfig` | Public Identifier | Safe in client-side code | Standard web bundle |
| `GEMINI_API_KEY` | Server Secret | Server-side only (never browser) | Cloud Run / Functions Environment |
| `SMTP_PASSWORD` / `RESIDENT_DISPATCH_KEYS` | Private Secret | Server-side only | Cloud Secret Manager |

---

## 2. Public vs Private Firebase Keys

A common concern in dynamic architectures is the exposure of the Firebase client configuration (`apiKey`, `authDomain`, `appId`) inside public source files like `/services/firebase.ts`. 

- **Why it is safe**: The Firebase Client API key is **not** a traditional secret key. It is a public API identifier used by Google servers to direct traffic to the correct project. Exposing it in client-side JS is the standard, documented, and required method for Firebase client SDKs.
- **Enforcement Layer**: The security of the platform is strictly governed by **Firestore Security Rules (`firestore.rules`)** and the **Zero-Trust architecture**, which block unauthorized direct mutations regardless of the API key exposure.

---

## 3. Production Hardening Checklist for Secrets

To avoid leakage of administrator assets or dispatch tokens:
1. **Never store SMTP or API Keys in LocalStorage**: Avoid local-storage persistence for raw API keys (such as Resend Bearer tokens or SMTP credentials) in production.
2. **Utilize Firebase Cloud Functions Environment Config**: Bind any external service credentials via backend process variables (`process.env.*`) or Cloud Secret Manager.
3. **App Check Protection**: Activate **Firebase App Check** in the Google Console to prevent unauthorized clients (including postman/curl scripts) from sending queries to the Firestore backend.
